import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { MySQL } from "./index";

new nanoSQLAdapterTest(MySQL, [{ 
    host: "localhost",
    user: "root",
    database: "test",
    password: ""
}]).test().then(() => {
    console.log("MySQL Test Passed");
    setTimeout(() => {
        process.exit();
    }, 250);
}).catch((err) => {
    console.log("Test Failed", err);
    setTimeout(() => {
        process.exit();
    }, 250);
});
