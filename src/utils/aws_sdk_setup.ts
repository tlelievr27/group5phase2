import AWS from "aws-sdk"

AWS.config.getCredentials(function(err) { //Checks AWS 
    if (err) {
      console.log("Error, failed to load AWS credentials properly")
      console.log("Please ensure credentials are either in the .env file or you have the /.aws/credentials file set up properly")
      console.log(err.stack) 
    }
  
    else if ( AWS.config.credentials !== null &&  AWS.config.credentials !== undefined ){
      console.log("Access key:", AWS.config.credentials.accessKeyId);
    }
  });


AWS.config.update({region: 'us-east-2'});

const aws_s3 = new AWS.S3({apiVersion: '2006-03-01'});

// Call S3 to list the buckets


export default aws_s3;