import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { NativeStorage } from "./index";

new nanoSQLAdapterTest(NativeStorage, []).test().then(() => {
    console.log("Native Storage Test Passed!");
    setTimeout(() => {
        process.exit();
    }, 250);
}).catch((err) => {
    console.log("Test Failed", err);
    setTimeout(() => {
        process.exit();
    }, 250);
});
