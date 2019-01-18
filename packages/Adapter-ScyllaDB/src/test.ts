import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { Scylla } from "./index";

new nanoSQLAdapterTest(Scylla, [{
    contactPoints: ['127.0.0.1:9042']
}]).test().then(() => {
    console.log("ScyllaDB Test Passed");
    setTimeout(() => {
        process.exit();
    }, 250);
}).catch((err) => {
    console.log("Test Failed", err);
    setTimeout(() => {
        process.exit();
    }, 250);
});