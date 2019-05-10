import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { SQLite } from "./index";

new nanoSQLAdapterTest(SQLite, []).test().then(() => {
    console.log("Test Passed");
    setTimeout(() => {
        process.exit();
    }, 250);
}).catch((err) => {
    console.log("Test Failed", err);
    setTimeout(() => {
        process.exit();
    }, 250);
});
