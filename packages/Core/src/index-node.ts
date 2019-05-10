declare const global: any;
global._fs = require("fs");
global._path = require("path");
global._crypto = require("crypto");
import * as wasm from "./db-index.js";
import { RocksDB } from "./adapters/rocksDB";

try {
    global._wasm = wasm;
    global._rocks = require("rocksdb");
    global._levelup = require("levelup");
    global._encode = require("encoding-down");
    global._lexint = require("lexicographic-integer-encoding")("hex", {strict: true});
    global._rocksAdapter = RocksDB;
} catch (e) { }

import {
    nSQL, nanoSQL, InanoSQLInstance, nSQLv1Config
} from "./index";


export {
    nSQL,
    nanoSQL,
    InanoSQLInstance,
    nSQLv1Config
};
