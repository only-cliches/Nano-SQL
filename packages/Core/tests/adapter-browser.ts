import { nanoSQLAdapterTest } from "../src/adapter-test";
import { IndexedDB } from "../src/adapters/indexedDB";
import { WebSQL } from "../src/adapters/webSQL";
import { RSE } from "really-small-events";
import { SyncStorage } from "../src/adapters/syncStorage";
window["RSE"] = RSE;

let errors = 0;
console.log("Testing IndexedDB");
new nanoSQLAdapterTest(IndexedDB, []).test().then(() => {
    console.log("Testing WebSQL");
    new nanoSQLAdapterTest(WebSQL, []).test().then(() => {
        console.log("Tests Sync Storage (LocalStorage)");
        new nanoSQLAdapterTest(SyncStorage, [true]).test().then(() => {
            console.log("Tests Complete");
            RSE.trigger("done", errors);
        }).catch((err) => {
            console.error(err);
            errors++;
        });
    }).catch((err) => {
        console.error(err);
        errors++;
    });
}).catch((err) => {
    console.error(err);
    errors++;
});