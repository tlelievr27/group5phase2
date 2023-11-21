import { Request, Response } from 'express';
import * as schemas from "../models/api_schemas"
import * as types from "../models/api_types"
import logger from "../utils/logger";
import { verifyAuthToken } from '../services/user_auth/generate_auth_token';
import { JsonWebTokenError } from 'jsonwebtoken';
//import { inject, injectable } from "tsyringe";

//This file contains a class that acts a controller for everything relating to getting data about a package

export class PkgDataManager {

    public async getPackageQuery(req: Request, res: Response) {
        logger.debug("Got a package query request");
        //Get any packages fitting the query. Search for packages satisfying the indicated query.
    
        //If you want to enumerate all packages, provide an array with a single PackageQuery whose name is "*".
    
        //The response is paginated; the response header includes the offset to use in the next query.
    
        //Proposed design to protect from DDOS: only allow an auth token to call the * endpoint 3 times

        //Post requests have a "request body" that is the data being posted
        const req_body: schemas.PackageQuery = req.body;
        const offset = req.params.offset;
        const auth_token = req.params.auth_token;
        var response_obj: schemas.PackageMetadata[];
        var response_code; //Probably wont implement it like this, just using it as a placeholder
    
        //Validate request body
        if(!(types.PackageQuery.is(req_body))) {
            logger.debug("Invalid or malformed Package in request body to endpoint POST /packages")
            res.status(400).send("Invalid or malformed Package in request body");
        }

        //Verify user permissions
        try {
            await verifyAuthToken(auth_token, ["search"]) //Can ensure auth exists bc we check for it in middleware
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

        response_code = 200;
    
        if(response_code == 200) {
            res.status(200).send("Successfully queried for X packages");
        }
        else if(response_code == 400) {
            if(auth_token) { //If its invalid
            //VALIDATION CHECK UNIMPLEMENTED
                res.status(400).send("Invalid auth token");
            }
            else {
                res.status(400).send("Invalid or malformed request body");
            }
        }
        else if(response_code == 413) {
            res.status(413).send("Too many packages returned");
        }
    
        res.send('List of packages');
    }
    
    public async getPkgById (req: Request, res: Response) {
        //Retrieves a package by its ID
        //Return this package
        const id = req.params.id;
        const auth_token = req.params.auth_token;
        var response_obj: schemas.Package;
    
        if(!id) {
            logger.debug("Malformed/missing PackageID in request body to endpoint GET /package/{id}")
            return res.status(400).send("Missing PackageID in params");
        }
    
        //Verify user permissions
        try {
            await verifyAuthToken(auth_token, ["download"]) //Can ensure auth exists bc we check for it in middleware
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
    
    
        var response_code = 200; //Probably wont implement it like this, just using it as a placeholder
    
        if(response_code == 200) {
            res.status(200).send(`Successfully returned {packageName} with ID = ${id}`);
        }
        else if(response_code == 400) {
            if(auth_token) { //If its invalid
                //VALIDATION CHECK UNIMPLEMENTED
                res.status(400).send("Invalid auth token");
            }
            else {
                res.status(400).send("Invalid package ID");
            }
        }
        else if(response_code == 401) {
            res.status(401).send("You do not have permission to reset the registry");
        }
    
        //res.send(`Retrieve package with ID: ${id}`);
    }
    
    
    
    public async ratePkgById(req: Request, res: Response) {
        //Gets scores for the specified package
        const id = req.params.id;
        const auth_token = req.params.auth_token;
        var response_obj: schemas.PackageRating;
    
        if(!id) {
            logger.debug("Malformed/missing PackageID in request body to endpoint GET /package/{id}/rate")
            return res.status(400).send("Invalid or malformed PackageID in params");
        }

        //Verify user permissions
        try {
            await verifyAuthToken(auth_token, ["search"]) //Can ensure auth exists bc we check for it in middleware
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
    
    
        var response_code = 200; //Probably wont implement it like this, just using it as a placeholder
    
        if(response_code == 200) {
            res.status(200).send("Successfully rated {packageName}");
        }
        else if(response_code == 400) {
            if(auth_token) { //If its invalid
                //VALIDATION CHECK UNIMPLEMENTED
                res.status(400).send("Invalid auth token");
            }
            else {
                res.status(400).send("Invalid package ID");
            }
        }
        else if(response_code == 404) {
            res.status(404).send("Could not find existing package with matching ID");
        }
        else if(response_code == 500) {
            res.status(500).send("Fatal error during rating calculations");
        }
        res.send(`Get rating for package with ID: ${id}`);
    }
    
    getPkgHistoryByName(req: Request, res: Response) {
        const name = req.params.name;
        const auth_token = req.params.auth_token;
        var response_obj: schemas.PackageHistoryEntry[];
    
    
    
        var response_code = 200; //Probably wont implement it like this, just using it as a placeholder
    
        if(response_code == 200) {
            res.status(200).send("Successfully retrieved package history");
        }
        else if(response_code == 400) {
            if(auth_token) { //If its invalid
                //VALIDATION CHECK UNIMPLEMENTED
                res.status(400).send("Invalid auth token");
            }
            else {
                res.status(400).send("Invalid package name");
            }
        }
        else if(response_code == 404) {
            res.status(404).send("Could not find existing package with matching name");
        }
        res.send(`Get history for package with name: ${name}`);
    }
    
    
    
    public async getPkgByRegex(req: Request, res: Response) {
        //Search for a package using regular expression over package names and READMEs. This is similar to search by name.
    
        const auth_token = req.params.auth_token;
        const regex: schemas.PackageRegEx = req.body;
        var response_obj: schemas.PackageMetadata[];
    
        if(!(types.PackageRegEx.is(regex))) {
            logger.debug("Invalid or malformed Package in request body to endpoint POST /packages")
            return res.status(400).send("Invalid or malformed Package in request body");
        }

        //Verify user permissions
        try {
            await verifyAuthToken(auth_token, ["search"]) //Can ensure auth exists bc we check for it in middleware
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

        var response_code = 200; //Probably wont implement it like this, just using it as a placeholder
    
        if(response_code == 200) {
            res.status(200).send("Successfully retrieved package history");
        }
        else if(response_code == 400) {
            if(auth_token) { //If its invalid
                //VALIDATION CHECK UNIMPLEMENTED
                res.status(400).send("Invalid auth token");
            }
            else {
                res.status(400).send("Invalid or malformed PackageRegEx in request body");
            }
        }
        else if(response_code == 404) {
            res.status(404).send("Could not find existing package matching regex");
        }
        res.send('Get packages based on regular expression');
    }
}