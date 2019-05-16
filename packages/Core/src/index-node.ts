import { SnapDBAdapter } from "./adapters/snapDB";

declare const global: any;
global._crypto = require("crypto");
global._snapAdapter = SnapDBAdapter;

import {
    nSQL, nanoSQL, InanoSQLInstance, nSQLv1Config
} from "./index";


export {
    nSQL,
    nanoSQL,
    InanoSQLInstance,
    nSQLv1Config
};
