import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { Redis } from "./index";

new nanoSQLAdapterTest(Redis, []).test().then(() => {
    console.log("Redis Test Passed");
    setTimeout(() => {
        process.exit();
    }, 250);
}).catch((err) => {
    console.log("Test Failed", err);
    setTimeout(() => {
        process.exit();
    }, 250);
});
