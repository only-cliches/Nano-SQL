declare var global: any;
global._fs = require("fs");
global._path = require("path");
global._crypto = require("crypto");
try {
    global._levelup = require("levelup");
} catch (e) {}

try {
    global._leveldown = require("leveldown");
} catch (e) {}

try {
    global._Int64BE = require("int64-buffer").Uint64BE;
} catch (e) {}

import {
    ActionOrView,
    DataModel,
    DatabaseEvent,
    JoinArgs,
    DBRow,
    NanoSQLInstance,
    DBConnect,
    nSQL
 } from "./index";


 export {
    ActionOrView,
    DataModel,
    DatabaseEvent,
    JoinArgs,
    DBRow,
    NanoSQLInstance,
    DBConnect,
    nSQL
 };
