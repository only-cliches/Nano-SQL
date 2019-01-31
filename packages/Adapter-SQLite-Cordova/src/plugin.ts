import * as sqliteCordova from "./index";
import {
    nSQL, nanoSQL, nSQLv1Config
} from "@nano-sql/core";

const getMode = sqliteCordova.getMode;

export {
    nSQL,
    nanoSQL,
    nSQLv1Config,
    getMode
};

if (typeof window !== "undefined") {
    window["nSQL"] = nSQL;
    window["nanoSQL"] = nanoSQL;
    window["nSQLv1Config"] = nSQLv1Config;
}