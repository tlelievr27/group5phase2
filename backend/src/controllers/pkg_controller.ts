import { Request, Response } from 'express';
import * as schemas from "../models/api_schemas"
import * as types from "../models/api_types"
import { decodeB64ContentsToZip } from '../services/upload/unzip_contents';
import logger from "../utils/logger";
import { MetricsController } from '../services/scoring/controllers/metrics-controller';

import { container } from '../services/scoring/container';
import graphqlWithAuth from '../utils/graphql_query_setup';
import { extractGitHubInfo, isGitHubUrl, resolveNpmToGitHub } from '../services/scoring/services/parseURL';
import uploadToS3 from '../services/aws/s3upload';

import { extractBase64ContentsFromUrl } from '../services/upload/convert_zipball';
import { checkMetadataExists, checkPkgIDInDB, genericPkgDataGet, insertPackageIntoDB, updatePackageInDB } from '../services/database/operation_queries';
import { deleteFromS3 } from '../services/aws/s3delete';
import { deletePackageDataByID } from '../services/database/delete_queries';
import { RepoIdentifier } from '../models/other_schemas';
import { verifyAuthToken } from '../services/user_auth/generate_auth_token';
import { JsonWebTokenError } from 'jsonwebtoken';

//Controllers are basically a way to organize the functions called by your API
//Obviously most of our functions will be too complex to have within the API endpoint declaration
//Instead we can group them into "controllers" based their primary functionality and purpose

//Controllers will call "services", which are more granular functions that perform a specific task needed by the controller
//That may be reused across multiple controllers
//For example, getting info from a database, or calling an external API
//The actual data processing should be handled by services
//While input validation, building the output object
//And providing the correct status will be done by the controller


const controller = container.resolve(MetricsController); //Basically gets an instance of the MetricsController class


//This controller contains a class that handles everything related to creating, deleting, and updating packages
export class PackageUploader {

    public async updatePkgById (req: Request, res: Response) {
        //The name, version, and ID must match.
        //The package contents (from PackageData) will replace the previous contents.

        logger.info("*************Request recieved for endpoint PUT /package/{id}*************")

        const req_body = req.body;

        const id = req.params.id;
        const auth_token: string = req.headers.authorization! || req.headers['x-authorization']! as string;

        //Validate package body NEED TO FIX
        if(!(types.Package.is(req_body))) {
            logger.error("Invalid or malformed Package in request body to endpoint PUT /package/{id}")

            return res.status(400).send("Invalid or malformed Package in request body");
        }

            
        if((req_body.data.hasOwnProperty("Content"))) {
            const temp = req_body.data.Content
            if(req_body.data.Content != null && req_body.data.Content != undefined) {
                try {
                    req_body.data.Content = temp?.slice(0, 10) + "..." + temp?.slice(-10)
                }
                catch (err) {
                    req_body.data.Content = temp
                }
            }
            else {
                logger.debug("Contents are null")

                req_body.data.Content = "null"
            }
            logger.debug("Request body:\n" + JSON.stringify(req_body, null, 4))
    
            req_body.data.Content = temp
            
        }
        else {
            logger.debug("Request body:\n" + JSON.stringify(req_body, null, 4))
        }

        if(req_body.data.hasOwnProperty("URL") && req_body.data.hasOwnProperty("Content") && req_body.data.Content != null && req_body.data.URL != null) { //If both are defined and not null
            logger.debug("Invalid or malformed PackageData in request body, both URL and contents defined")
            return res.status(400).send("Invalid or malformed PackageData in request body (both URL and contents defined)");
        }

        //Check user has permissions for this operation
        try {
            await verifyAuthToken(auth_token, ["upload"]) //Can ensure auth exists bc we check for it in middleware
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (err: any) {
            if(err instanceof JsonWebTokenError) { //If the token lacks permissions or is expired
                logger.error(`Error validating auth token ${auth_token}`)
                return res.status(401).send("Error validating auth token: " + err.message);
            }
            else {
                logger.error(`Error: Invalid/malformed auth token`)
                return res.status(400).send("Error validating auth token: " + err.message);
            }
        }
        
        const debloated = await checkMetadataExists({ ID: req.params.id, Name: req_body.metadata.Name, Version: req_body.metadata.Version })
        //Kill 2 birds with 1 stone here, if the is matching metadata we get the debloating setting that we need, and if there's no match it just returns null and we exit

        if(debloated == null) {
            logger.error("Could not find existing package with matching metadata")
            return res.status(404).send("Could not find existing package with matching metadata");
        }

        logger.debug("URL ID: " + req.params.id)

        if(id != req_body.metadata.ID) {
            logger.error("Inconsistant package ID between request metadata and URL")
            return res.status(400).send("Inconsistant package ID between request metadata and URL");
        }

        else {
            let extractedContents;
            let base64contents;
            let repoInfo: RepoIdentifier | undefined; //Need to have this defined here to seperate if statements
            let repoURL: string;
            
            if(req_body.data.hasOwnProperty("URL") && req_body.data.URL != null && req_body.data.URL != undefined) {

                //logger.debug("Recieved URL in request body")
                repoURL = req_body.data.URL!
    
                //Handle 
                if(!isGitHubUrl(repoURL)) {
                    const githubFromNPM = await resolveNpmToGitHub(repoURL);
                    if(githubFromNPM == "") {
                        logger.error("Invalid URL in request body")
                        return res.status(400).send("Invalid URL in request body");
                    }
                    else {
                        repoURL = githubFromNPM;
                    }
                }
                //Get the owner and repo name from the URL
                repoInfo = extractGitHubInfo(repoURL);
    
                //Get the zipped version of the file from the GitHub API
    
                const zipball_query = `{
                    repository(owner: "${repoInfo.owner}", name: "${repoInfo.repo}") {
                  
                      defaultBranchRef {
                        target {
                          ... on Commit {
                            zipballUrl
                          }
                        }
                      }
                    }
                  }`
    
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let response: any;
                try {
    
                    response = await graphqlWithAuth(zipball_query);
                }
                catch (err) {
                    logger.error(`Error while querying GitHub API for zipball URL: ${err}`)
                    return res.status(400).send("Invalid URL in request body");
                } 
    
                const zipballUrl = response.repository.defaultBranchRef.target.zipballUrl;
                //Query returns a URL that downloads the repo when GET requested
                logger.debug(`Retrieved zipball URL ${zipballUrl} from GitHub API`)
                
                base64contents = await extractBase64ContentsFromUrl(zipballUrl);
    
                //And now we can proceed the same way
    
                //The reason we get the zipball before doing the score check is we would've had to clone the repo anyways, which probably takes a similar amount of memory and time
                //Doing this makes it easier to integrate with the other input formats
                
                extractedContents = await decodeB64ContentsToZip(base64contents, debloated); //We know it'll exist
    
            }
            else if(req_body.data.hasOwnProperty("Content") && req_body.data.Content != null && req_body.data.Content != undefined) {
                // logger.debug("Recieved encoded package contents in request body")
                try {
                    base64contents = req_body.data.Content; //Do this so we can not have as much in seperate if statements
                    extractedContents = await decodeB64ContentsToZip(req_body.data.Content!, debloated); //We know it'll exist
                }
                catch(err) {
                    logger.error("Error decoding base64 contents: " + err)
                    return res.status(400).send("Error decoding base64 contents: " + err)
                }
    
            }
            else {
                logger.error("Invalid or malformed PackageData in request body")
                return res.status(400).send("Invalid or malformed PackageData in request body");
            }
            const pkg_json = JSON.parse(extractedContents.metadata["package.json"].toString());
    
            if(typeof(repoInfo) === "undefined") { //If we didn't get the repo info yet (it only gets assigned by now if the URL was uploaded)
                repoURL = pkg_json.repository.url; //Assign from the pkg json (URL should already be defined from a URL upload)
                repoInfo = extractGitHubInfo(repoURL);
            }
    
            const repo_ID = repoInfo.owner + "_" + repoInfo.repo + "_" + pkg_json.version
    
            // const response_obj: schemas.PackageMetadata = {
            //         Name: pkg_json.name,
            //         Version: pkg_json.version.split('-')[0], //This makes it so pre-release tags get removed
            //         ID: repo_ID
            // }
    
            // if(response_obj.ID != req_body.metadata.ID || response_obj.Name != req_body.metadata.Name || response_obj.Version != req_body.metadata.Version) {
            //     //Check if the package metadata matches the metadata in the request body
            //     logger.error("Inconsistant package metadata between request body and contents extracted from package data")
            //     return res.status(400).send("Inconsistant package metadata between request body and contents extracted from package data");
            // }

            let metric_scores;
            try {
                metric_scores = await controller.generateMetrics(repoInfo.owner, repoInfo.repo, extractedContents.metadata);
            }
            catch (err) {
                logger.debug("Failed to calculate ratings for package")
                return res.status(500).send("Failed to calculate ratings for package");
            }
            
            logger.debug("Calculated updated metric scores for package: " + JSON.stringify(metric_scores, null, 4))
    
            await uploadToS3(extractedContents, req_body.metadata.ID, req_body.metadata.Name)
            await updatePackageInDB(metric_scores, req_body.metadata.ID);
            //Need to figure out how to make it so that if the DB write fails the uploadToS3 doesn't go through
            //Probably have to redo this function so it updates scores instead of overwriting them
                
            logger.debug("Successfully updated package with ID " + id)
    
            return res.status(200).send(`Updated package with ID: ${id}`);
        }

    }


    public async deletePkgByID (req: Request, res: Response) {
        logger.info("*************Request recieved for endpoint DELETE /package/{id}*************")

        const id = req.params.id;
        const auth_token: string = req.headers.authorization! || req.headers['x-authorization']! as string;
    
        logger.debug("URL ID: " + req.params.id)
        
        //Check user has permissions for this operation
        //Assuming that the only role that should be allowed to delete packages is admins
        try {
            await verifyAuthToken(auth_token, ["admin"]) //Can ensure auth exists bc we check for it in middleware
            //Note that other endpoints exclude admin from the permissions list because its allowed to do everything by default
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (err: any) {
            if(err instanceof JsonWebTokenError) { //If the token lacks permissions or is expired
                logger.error(`Error validating auth token ${auth_token}`)
                return res.status(401).send("Error validating auth token: " + err.message);
            }
            else {
                logger.error(`Error: Invalid/malformed auth token`)
                return res.status(400).send("Error validating auth token: " + err.message);
            }
        }

        if(!id) {
            logger.error("Invalid/missing package ID in header")
            return res.status(400).send("Invalid/missing package ID in header");
        }
        else if(!await checkPkgIDInDB(id)) {
            logger.error("Could not find existing package with matching ID")
            return res.status(404).send("Could not find existing package with matching ID");
        }
        else {
            const pkg_name = await genericPkgDataGet("NAME", id) //Need the name to create the key for the deleted object in S3
            //Delete package from S3 bucket
            await deleteFromS3(id, pkg_name.NAME)
            //Delete all package data from DB
            await deletePackageDataByID(id);

            return res.status(200).send(`Successfully deleted ${id} from the registry`);
        }
        
    }
    

    public async createPkg (req: Request, res: Response) {
        logger.info("*************Request recieved for endpoint POST /package*************")

        const req_body = req.body; //The body here can either be contents of a package or a URL to a GitHub repo for public ingest via npm
        const auth_token: string = req.headers.authorization! || req.headers['x-authorization']! as string;
        let extractedContents;
        let base64contents;
        let repoInfo: RepoIdentifier | undefined; //Need to have this defined here to seperate if statements
        let repoURL: string;
        let debloating;

        if(req.query.debloat) { //If debloat exists set it to the value, otherwise default to false
            logger.debug("Debloating enabled")
            debloating = (req.query.debloat === "true")
        }
        else {
            debloating = false
        }

        if((req_body.hasOwnProperty("Content"))) {
            const temp = req_body.Content
            if(req_body.Content != null && req_body.Content != undefined) {
                try {
                    req_body.Content = temp?.slice(0, 10) + "..." + temp?.slice(-10)
                }
                catch (err) {
                    req_body.Content = temp
                }
            }
            else {
                logger.debug("Contents are null")
                req_body.Content = "null"
            }
            logger.debug("Request body:\n" + JSON.stringify(req_body, null, 4))
    
            req_body.Content = temp
        }
        else {
            logger.debug("Request body:\n" + JSON.stringify(req_body, null, 4))
        }

        if(!(types.PackageData.is(req_body))) {
            logger.error("Invalid or malformed Package in request body to endpoint POST /package")
            return res.status(400).send("Invalid or malformed PackageData in request body");
        }

        if(req_body.hasOwnProperty("URL") && req_body.hasOwnProperty("Content") && req_body.Content != null && req_body.URL != null) { //If both are defined and not null
            logger.debug("Invalid or malformed PackageData in request body, both URL and contents defined")
            return res.status(400).send("Invalid or malformed PackageData in request body (both URL and contents defined)");
        }

        try {
            await verifyAuthToken(auth_token, ["upload"]) //Can ensure auth exists bc we check for it in middleware
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (err: any) {
            if(err instanceof JsonWebTokenError) { //If the token lacks permissions or is expired
                logger.error(`Error validating auth token ${auth_token}`)
                return res.status(401).send("Error validating auth token: " + err.message);
            }
            else {
                logger.error(`Error: Invalid/malformed auth token`)
                return res.status(400).send("Error validating auth token: " + err.message);
            }
        }

        if(req_body.hasOwnProperty("URL") && req_body.URL != null && req_body.URL != undefined) { //not checking if contents is defined, will just automatically prioritize URL if its defined

            // logger.debug("Recieved URL in request body")
            repoURL = req_body.URL!

            //Handle 
            if(!isGitHubUrl(repoURL)) {
                // logger.debug("Identified as non-github URL")
                const githubFromNPM = await resolveNpmToGitHub(repoURL);
                if(githubFromNPM == "") {
                    logger.error("Invalid URL in request body")
                    return res.status(400).send("Invalid URL in request body");
                }
                else {
                    repoURL = githubFromNPM;
                }
            }
            //Get the owner and repo name from the URL
            repoInfo = extractGitHubInfo(repoURL);

            //Get the zipped version of the file from the GitHub API

            const zipball_query = `{
                repository(owner: "${repoInfo.owner}", name: "${repoInfo.repo}") {
              
                  defaultBranchRef {
                    target {
                      ... on Commit {
                        zipballUrl
                      }
                    }
                  }
                }
              }`

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let response: any;
            try {

                response = await graphqlWithAuth(zipball_query);
            }
            catch (err) {
                logger.error(`Error while querying GitHub API for zipball URL: ${err}`)
                return res.status(400).send("Invalid URL in request body");
            } 

            const zipballUrl = response.repository.defaultBranchRef.target.zipballUrl;
            //Query returns a URL that downloads the repo when GET requested
            logger.debug(`Retrieved zipball URL ${zipballUrl} from GitHub API`)
            try {
                base64contents = await extractBase64ContentsFromUrl(zipballUrl);
                logger.debug("Successfully extracted contents from zipball URL")
            }
            catch {
                logger.error("Failed to extract contents from zipball URL")
                return res.status(400).send("Failed to extract contents from zipball URL");
            }


            //And now we can proceed the same way

            //The reason we get the zipball before doing the score check is we would've had to clone the repo anyways, which probably takes a similar amount of memory and time
            //Doing this makes it easier to integrate with the other input formats
            try {
                extractedContents = await decodeB64ContentsToZip(base64contents, debloating); //We know it'll exist
                logger.debug("Converted package contents obtained from zipball URL")
            }
            catch {
                logger.error("Failed to convert package contents from zipball URL")
                return res.status(400).send("Failed to convert package contents from zipball URL");
            }


        }
        else if(req_body.hasOwnProperty("Content") && req_body.Content != null && req_body.Content != undefined) {
            // logger.debug("Recieved encoded package contents in request body")

            base64contents = req_body.Content; //Do this so we can not have as much in seperate if statements

            try {
                extractedContents = await decodeB64ContentsToZip(req_body.Content!, debloating); //We know it'll exist
            }
            catch(err) {
                logger.error("Error decoding base64 contents: " + err)
                return res.status(400).send("Error decoding base64 contents: " + err)
            }
        }
        else {
            logger.debug("Invalid or malformed PackageData in request body")
            return res.status(400).send("Invalid or malformed PackageData in request body");
        }

        const pkg_json = JSON.parse(extractedContents.metadata["package.json"].toString());

        if(typeof(repoInfo) === "undefined") { //If we didn't get the repo info yet (it only gets assigned by now if the URL was uploaded)
            repoURL = pkg_json.repository.url; //Assign from the pkg json (URL should already be defined from a URL upload)
            repoInfo = extractGitHubInfo(repoURL);
        }

        const repo_ID = repoInfo.owner + "_" + repoInfo.repo + "_" + pkg_json.version

        //Check DB if package id already exists in database
        if(await checkPkgIDInDB(repo_ID)) {
            logger.error("Detected package with matching ID already exists in database")
            return res.status(409).send("Uploaded package already exists in registry");
        }

        const response_obj: schemas.Package = {
            metadata: {
                Name: pkg_json.name,
                Version: pkg_json.version.split('-')[0], //This makes it so pre-release tags get removed
                ID: repo_ID
            },
            data: {
                Content: base64contents
            }
        }

        let metric_scores;
        try {
            metric_scores = await controller.generateMetrics(repoInfo.owner, repoInfo.repo, extractedContents.metadata);
        }
        catch (err) {
            logger.debug("Failed to calculate ratings for package")
            return res.status(500).send("Failed to calculate ratings for package");
        }

        logger.debug("Calculated metric scores:\n" + JSON.stringify(metric_scores, null, 4))

        if(metric_scores["BusFactor"] < 0.5 || metric_scores["RampUp"] < 0.5 || metric_scores["Correctness"] < 0.5 || metric_scores["ResponsiveMaintainer"] < 0.5 || metric_scores["LicenseScore"] < 0.5) {
            logger.debug("Package failed to pass check for metric scores, declined to upload")
            return res.status(424).send("npm package failed to pass rating check for public ingestion\nScores: " + JSON.stringify(metric_scores));
        }
        else {
            const contentsPath = await uploadToS3(extractedContents, repo_ID)
            //Need to figure out how to make it so that if the DB write fails the uploadToS3 doesn't go through
            await insertPackageIntoDB(metric_scores, response_obj.metadata, contentsPath, debloating);        
        }

        logger.debug("Response object sent:\n" + JSON.stringify(response_obj.metadata, null, 4))
        logger.debug("Contents: " + response_obj.data.Content?.slice(0, 5) + "..." + response_obj.data.Content?.slice(-5))
    
        return res.status(201).json(response_obj);
    }


}
