Object.defineProperty(exports, "__esModule", { value: true });
var NanoSQL_Adapter_Test_1 = require("NanoSQL-Adapter-Test");
var adapter_indexedDB_1 = require("./database/adapter-indexedDB");
var adapter_sync_1 = require("./database/adapter-sync");
var adapter_websql_1 = require("./database/adapter-websql");
var utilities_1 = require("./utilities");
utilities_1.fastCHAIN([adapter_indexedDB_1._IndexedDBStore, adapter_sync_1._SyncStore, adapter_websql_1._WebSQLStore], function (store, i, next) {
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
    new NanoSQL_Adapter_Test_1.TestAdapter(store, []);
    setTimeout(next, 3000);
}).then(function () {
    console.log("TESTS COMPLETE");
});
//# sourceMappingURL=adapter-test.js.map