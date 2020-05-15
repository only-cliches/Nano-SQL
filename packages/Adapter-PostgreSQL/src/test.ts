import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { PostgreSQL } from "./index";

new nanoSQLAdapterTest(PostgreSQL, [{
    host: "localhost",
    user: "admin",
    database: "metal_test",
    password: "password"
}]).test().then(() => {
    console.log("PostgresSQL Test Passed");
    setTimeout(() => {
        process.exit();
    }, 250);
}).catch((err) => {
    console.log("Test Failed", err);
    setTimeout(() => {
        process.exit();
    }, 250);
});
