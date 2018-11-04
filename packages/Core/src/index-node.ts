declare const global: any;
global._fs = require("fs");
global._path = require("path");
global._crypto = require("crypto");
import { RocksDB } from "./adapters/rocksDB";

try {
    global._rocks = require("rocksdb");
    global._levelup = require("levelup");
    global._Int64BE = require("int64-buffer").Uint64BE;
    global._rocksAdapter = RocksDB;
} catch (e) { }

import {
    nSQL, NanoSQL
} from "./index";


export {
    nSQL,
    NanoSQL
};
