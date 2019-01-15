Object.defineProperty(exports, "__esModule", { value: true });
global._fs = require("fs");
global._path = require("path");
global._crypto = require("crypto");
var rocksDB_1 = require("./adapters/rocksDB");
try {
    global._rocks = require("rocksdb");
    global._levelup = require("levelup");
    global._encode = require("encoding-down");
    global._lexint = require("lexicographic-integer-encoding")("hex", { strict: true });
    global._rocksAdapter = rocksDB_1.RocksDB;
}
catch (e) { }
var index_1 = require("./index");
exports.nSQL = index_1.nSQL;
exports.nanoSQL = index_1.nanoSQL;
exports.InanoSQLInstance = index_1.InanoSQLInstance;
exports.nSQLv1Config = index_1.nSQLv1Config;
//# sourceMappingURL=index-node.js.map