// const mochaTestData = require("mocha-testdata");
const colors = require("colors");

console.log(("Tests Beginning at " + new Date().toLocaleTimeString() + ", " + new Date().toDateString() as any).magenta);

declare const global: any;
global._fs = require("fs");
global._path = require("path");
global._crypto = require("crypto");
import { RocksDB } from "../src/adapters/rocksDB";
import * as wasm from "../src/db-index.js";

try {
    global._wasm = wasm;
    global._rocks = require("rocksdb");
    global._levelup = require("levelup");
    global._encode = require("encoding-down");
    global._lexint = require("lexicographic-integer-encoding")("hex", {strict: true});
    global._rocksAdapter = RocksDB;
} catch (e) { }

require("./01-import&export");
require("./02-primarykeys");
require("./03-sqlite");
require("./04-query");
// require("./05-adapters");