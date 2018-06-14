Object.defineProperty(exports, "__esModule", { value: true });
global._fs = require("fs");
global._path = require("path");
global._crypto = require("crypto");
try {
    global._levelup = require("levelup");
}
catch (e) { }
try {
    global._leveldown = require("leveldown");
}
catch (e) { }
try {
    global._Int64BE = require("int64-buffer").Uint64BE;
}
catch (e) { }
var index_1 = require("./index");
exports.NanoSQLInstance = index_1.NanoSQLInstance;
exports.nSQL = index_1.nSQL;
//# sourceMappingURL=index-server.js.map