declare var global: any;

import {
    StdObject,
    DBFunction,
    ActionOrView,
    DataModel,
    QueryLine,
    DatabaseEvent,
    JoinArgs,
    DBRow,
    _assign,
    NanoSQLInstance,
    _NanoSQLQuery,
    DBConnect,
    DBExec,
    NanoSQLBackend,
    nSQL
 } from "./index";

global._fs = require("fs");
global._levelup = require("levelup");
global._crypto = require("crypto");

 export {
    StdObject,
    DBFunction,
    ActionOrView,
    DataModel,
    QueryLine,
    DatabaseEvent,
    JoinArgs,
    DBRow,
    _assign,
    NanoSQLInstance,
    _NanoSQLQuery,
    DBConnect,
    DBExec,
    NanoSQLBackend,
    nSQL
 }