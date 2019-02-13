Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("./utilities");
var syncStorage_1 = require("./adapters/syncStorage");
var webSQL_1 = require("./adapters/webSQL");
var indexedDB_1 = require("./adapters/indexedDB");
var RocksDB;
if (typeof global !== "undefined") {
    RocksDB = global._rocksAdapter;
}
exports.detectStorage = function () {
    // NodeJS
    if (typeof window === "undefined") {
        return "RKS";
    }
    // Browser
    // Safari / iOS always gets WebSQL (mobile and desktop)
    // newer versions of safari drop WebSQL, so also do feature detection
    if (utilities_1.isSafari && typeof window.openDatabase !== "undefined") {
        return "WSQL";
    }
    // everyone else (FF + Chrome + Edge + IE)
    // check for support for indexed db
    if (typeof indexedDB !== "undefined") { // use indexed DB if possible
        return "IDB";
    }
    // fall back to WebSQL
    if (typeof window.openDatabase !== "undefined") {
        return "WSQL";
    }
    // nothing else works, we gotta do local storage. :(
    return "LS";
};
exports.resolveMode = function (mode, args) {
    if (typeof mode === "string") {
        if (mode === "PERM") {
            mode = exports.detectStorage();
        }
        switch (mode) {
            case "TEMP":
                return new syncStorage_1.SyncStorage(false);
            case "LS":
                return new syncStorage_1.SyncStorage(true);
            case "WSQL":
                return new webSQL_1.WebSQL(args && args.size);
            case "IDB":
                return new indexedDB_1.IndexedDB(args && args.version);
            case "RKS":
            case "LVL":
                return new RocksDB(args && args.path);
            default:
                throw new Error("Cannot find mode " + mode + "!");
        }
    }
    else {
        return mode;
    }
};
//# sourceMappingURL=adapter-detect.js.map