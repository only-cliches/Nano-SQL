import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { DynamoDB } from "./index";
import * as AWS from "aws-sdk";

const dynamodbLocal = require("dynamodb-localhost");
dynamodbLocal.install(() => {
    dynamodbLocal.start({
        port: 9090,
        inMemory: true
    });

    setTimeout(() => {
        AWS.config.update({
            accessKeyId: 'XXXX', 
            secretAccessKey: 'XXXX', 
            region: "us-west-1",
            endpoint: "http://localhost:9090"
        } as any);
          
        
        new nanoSQLAdapterTest(DynamoDB, []).test().then(() => {
            console.log("DynamoDB Test Passed");
            dynamodbLocal.stop(9090);
            setTimeout(() => {
                process.exit();
            }, 250);
        }).catch((err) => {
            console.log("Test Failed", err);
            dynamodbLocal.stop(9090);
            setTimeout(() => {
                process.exit();
            }, 250);
        });
    }, 500);

});
