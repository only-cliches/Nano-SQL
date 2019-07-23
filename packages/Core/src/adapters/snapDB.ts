import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION, configFilter } from "../interfaces";
import { noop, deepFreeze, generateID, binarySearch, assign, cast, blankTableDefinition, deepSet, chainAsync, deepGet } from "../utilities";
import { nanoSQLMemoryIndex } from "./memoryIndex";
import { SnapDB } from "snap-db";
import * as fs from "fs";
import * as path from "path";

export class SnapDBAdapter extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "SnapDB Adapter",
        version: VERSION,
        filters: [
            {
                name: "config",
                priority: 1000,
                call: (inputArgs: configFilter, complete, cancel) => {
                    if (inputArgs.res.path && inputArgs.res.path.length) {
                        this._path = inputArgs.res.path;
                    }
                    complete(inputArgs);
                }
            }
        ]
    };

    nSQL: InanoSQLInstance;

    _id: string;

    _ai: {
        [tableName: string]: number;
    };

    _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    _tables: {
        [tableName: string]: SnapDB<any>
    }

    _baseFolder: string;

    _path: string = typeof process !== "undefined" ? process.cwd() : "";

    constructor(public snapDBArgs?: {
        dir: string;
        key: "string" | "float" | "int";
        cache?: boolean;
        autoFlush?: number | boolean;
        mainThread?: boolean;
    }) {
        super(true, false);
        this._ai = {};
        this._tableConfigs = {};
        this._tables = {};
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        this._baseFolder = path.join(this._path, "db_" + id);

        if (!fs.existsSync(this._baseFolder)) {
            fs.mkdirSync(this._baseFolder, {recursive: true});
        }
            
        this._tables["_ai_store"] = new SnapDB({dir: path.join(this._baseFolder, "_ai_store"), key: "string"});
        this._tables["_ai_store"].ready().then(() => {
            complete();
        }).catch(error);

    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._tableConfigs[tableName] = tableData;

        this._tables[tableName] = new SnapDB({
            dir: path.join(this._baseFolder, tableName), 
            key: tableData.isPkNum ? "float" : "string",
            ...this.snapDBArgs ? this.snapDBArgs : {}
        });

        if (this._tableConfigs[tableName].ai) {
            this._tables["_ai_store"].get(tableName).then((aiValue) => {
                this._ai[tableName] = parseInt(aiValue || "0");
                this._tables[tableName].ready().then(complete).catch(error);
            }).catch(() => {
                this._ai[tableName] = 0;
                this._tables[tableName].ready().then(complete).catch(error);
            });
        } else {
            this._tables[tableName].ready().then(complete).catch(error);
        }
    }

    batch(table: string, actions: {type: "put"|"del", data: any}[], success: (result: any[]) => void, error: (msg: any) => void) {
        this._tables[table].begin_transaction().then(() => {
            return Promise.all(actions.map(a => {
                if (a.type === "put") {
                    return this._tables[table].put(deepGet(this._tableConfigs[table].pkCol, a.data), JSON.stringify(a.data));
                } else {
                    return this._tables[table].delete(a.data);
                }
            }))
        }).then(() => {
            return this._tables[table].end_transaction();
        }).then(success).catch(error);
    }

    dropTable(tableName: string, complete: () => void, error: (err: any) => void) {
        this._tables["_ai_store"].delete(tableName).then(() => {
            this._ai[tableName] = 0;
            return this._tables[tableName].empty();
        }).then(() => {
            return this._tables[tableName].close();
        }).then(() => {
            delete this._tables[tableName];
            delete this._tableConfigs[tableName];
            complete();
        }).catch(error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {

        chainAsync(Object.keys(this._tables), (table, i, next, err) => {
            this._tables[table].close().then(() => {
                delete this._tables[table];
                delete this._tableConfigs[table];
                next();
            }).catch(err);
        }).then(complete).catch(error);
    }

    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void) {

        pk = pk || generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);

        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }

        if (this._tableConfigs[table].ai) {
            this._ai[table] = Math.max(this._ai[table] || 0, pk);
        }

        deepSet(this._tableConfigs[table].pkCol, row, pk);

        this._tables[table].put(pk, JSON.stringify(row)).then(() => {
            if (this._tableConfigs[table].ai) {
                return this._tables["_ai_store"].put(table, String(this._ai[table]));
            }
            return Promise.resolve();
        }).then(() => {
            complete(pk);
        }).catch(error);

    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        this._tables[table].get(pk).then((row) => {
            // found
            complete(JSON.parse(row))
        }).catch(() => {
            // row not found
            complete(undefined);
        });
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this._tables[table].delete(pk).then(() => {
            complete();
        }).catch(error);
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {

        let ct = 0;
        switch(type) {
            case "range":
                this._tables[table].range(offsetOrLow, limitOrHigh, (key, data) => {
                    onRow(JSON.parse(data), ct);
                    ct++;
                }, (err) => {
                    if (err) {
                        error(err);
                    } else {
                        complete();
                    }
                }, reverse);
            break;
            case "offset":
                const ranges = reverse ? [(offsetOrLow || 0) + 1, limitOrHigh] : [(offsetOrLow || 0), limitOrHigh];
                this._tables[table].offset(ranges[0], ranges[1], (key, data) => {
                    onRow(JSON.parse(data), ct);
                    ct++;
                }, (err) => {
                    if (err) {
                        error(err);
                    } else {
                        complete();
                    }
                }, reverse);
            break;
            case "all":
                this._tables[table].getAll((key, data) => {
                    onRow(JSON.parse(data), ct);
                    ct++;
                }, (err) => {
                    if (err) {
                        error(err);
                    } else {
                        complete();
                    }
                }, reverse);
            break;
        }
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        let idx: any[] = [];
        this._tables[table].getAllKeys((key) => {
            idx.push(key);
        }, (err) => {
            if (err) {
                error(err);
            } else {
                complete(idx);
            }
        });
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        this._tables[table].getCount().then(complete).catch(error);
    }
}


export const rimraf = (dir_path: string) => {
    if (fs.existsSync(dir_path)) {
        fs.readdirSync(dir_path).forEach(function(entry) {
            const entry_path = path.join(dir_path, entry);
            if (fs.lstatSync(entry_path).isDirectory()) {
                rimraf(entry_path);
            } else {
                fs.unlinkSync(entry_path);
            }
        });
        fs.rmdirSync(dir_path);
    }
};