import { TestAdapter } from "NanoSQL-Adapter-Test";
import { _IndexedDBStore } from "./database/adapter-indexedDB";
import { _SyncStore } from "./database/adapter-sync";
import { _WebSQLStore } from "./database/adapter-websql";
import { fastCHAIN } from "./utilities";



fastCHAIN([_IndexedDBStore, _SyncStore, _WebSQLStore], (store, i, next) => {
    switch (i) {
        case 0:
            console.log("Testing IndexedDB...");
        break;
        case 1:
            console.log("");
            console.log("Testing Sync Store...");
        break;
        case 2:
            console.log("");
            console.log("Testing WebSQL...");
        break;
    }
    new TestAdapter(store, []);
    setTimeout(next, 3000);
}).then(() => {
    console.log("TESTS COMPLETE");
});

