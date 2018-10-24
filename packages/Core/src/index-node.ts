declare var global: any;
global._fs = require("fs");
global._path = require("path");
global._crypto = require("crypto");
try {
    global._levelup = require("levelup");
} catch (e) { }

try {
    global._leveldown = require("leveldown");
} catch (e) { }

try {
    global._Int64BE = require("int64-buffer").Uint64BE;
} catch (e) { }

import {
    nSQL, NanoSQL
} from "./index";


export {
    nSQL,
    NanoSQL
};
