import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { MongoDB } from "./index";

new nanoSQLAdapterTest(MongoDB, ["mongodb://localhost:27017"]).test().then(() => {
    console.log("MongoDB Test Passed");
    setTimeout(() => {
        process.exit();
    }, 250);
}).catch((err) => {
    console.log("Test Failed", err);
    setTimeout(() => {
        process.exit();
    }, 250);
});
