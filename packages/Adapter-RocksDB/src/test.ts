import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { RocksDB } from "./index";

new nanoSQLAdapterTest(RocksDB, [undefined, true]).test().then(() => {
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
