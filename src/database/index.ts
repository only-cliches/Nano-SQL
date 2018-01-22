import { Trie } from "prefix-trie-ts";
import { IdbQuery } from "../query/std-query";
import { NanoSQLPlugin, DBConnect, NanoSQLInstance  } from "../index";
import { _NanoSQLStorageQuery } from "./query";
import { fastALL, Promise, fastCHAIN } from "../utilities";
import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "./storage";

declare var global: any;

export class NanoSQLDefaultBackend implements NanoSQLPlugin {

    private _store: _NanoSQLStorage;

    public parent: NanoSQLInstance;

    private _queryPool: _NanoSQLStorageQuery[];
    private _queryPtr: number;

    constructor() {
        this._queryPool = [];
        this._queryPtr = 0;
    }

    public willConnect(connectArgs: DBConnect, next: (connectArgs: DBConnect) => void): void {

        this.parent = connectArgs.parent;

        this._store = new _NanoSQLStorage(connectArgs.parent, {
            ...connectArgs.config,
        } as any);

        for (let i = 0; i < 100; i++) {
            this._queryPool.push(new _NanoSQLStorageQuery(this._store));
        }

        this._store.init(connectArgs.models, (newModels) => {
            connectArgs.models = {
                ...connectArgs.models,
                ...newModels
            };
            next(connectArgs);
        });
    }

    public doExec(execArgs: IdbQuery, next: (execArgs: IdbQuery) => void): void {
        execArgs.state = "complete";
        this._queryPtr++;
        if (this._queryPtr > this._queryPool.length - 1) {
            this._queryPtr = 0;
        }
        this._queryPool[this._queryPtr].doQuery(execArgs, next);
    }

    /*public transactionBegin(id: string, next: () => void): void {
        next();
    }

    public transactionEnd(id: string, next: () => void): void {
        next();
    }
    */

    public dumpTables(tables?: string[]) {
        return new Promise((res, rej) => {
            let dump = {};
            let exportTables = tables && tables.length ? tables : Object.keys(this._store.tableInfo);
            fastALL(exportTables, (table, i, done) => {
                dump[table] = [];
                this._store._adapter.rangeRead(table, (r, idx, rowDone) => {
                    dump[table].push(r);
                    rowDone();
                }, done);
            }).then(() => {
                res(dump);
            });
        });
    }

    public importTables(tables) {
        return new Promise((res, rej) => {
            fastALL(Object.keys(tables), (tableName, i, done) => {
                const pkKey = this._store.tableInfo[tableName]._pk;
                fastALL(tables[tableName], (row, i, done) => {
                    this._store._adapter.write(tableName, row[pkKey], row, done, true);
                }).then(done);
            }).then(() => {
                res();
            });
        });
    }

    public extend(next: (args: any[], result: any[]) => void, args: any[], result: any[]): void {
        switch (args[0]) {
            case "clone":
                const nSQLi = new NanoSQLInstance();
                Object.keys(this.parent._models).forEach((table) => {
                    nSQLi.table(table).model(this.parent._models[table], [], true);
                })
                nSQLi
                .config({
                    id: this._store._id,
                    mode: args[1]
                })
                .connect().then(() => {
                    let i = 0;
                    fastCHAIN(Object.keys(this.parent._models), (table, i, done) => {
                        console.log(`Importing ${table}...`);
                        this.parent.rawDump([table])
                        .then((data) => {
                            return nSQLi.rawImport(data)
                        })
                        .then(done);
                    }).then(() => {
                        next(args, []);
                    });
                });
            break;
            case "idx.length":
            case "idx":
                const table = args[1];
                if (Object.keys(this._store.tableInfo).indexOf(table) > -1) {
                    this._store._adapter.getIndex(table, args[0] !== "idx", (idx: any) => {
                        next(args, idx);
                    });
                } else {
                    next(args, []);
                }
            break;
            case "rebuild_idx":
                if (args[1]) {
                    this._store.rebuildIndexes(args[1], (time) => {
                        next(args, [time]);
                    });
                } else {
                    fastALL(Object.keys(this._store.tableInfo), (table, i, done) => {
                        this._store.rebuildIndexes(table, done);
                    }).then((times) => {
                        next(args, times);
                    });
                }

            break;
            case "clear_cache":
                if (args[1] && args[2]) { // invalidate rows on a table
                    this._store._invalidateCache(args[1], args[2]);
                } else if (args[1]) { // invalidate whole table
                    this._store._cache[args[1]] = {};
                    this._store._cacheKeys[args[1]] = {};
                } else { // invalidate all tables
                    Object.keys(this._store.tableInfo).forEach((table) => {
                        this._store._cache[table] = {};
                        this._store._cacheKeys[table] = {};
                    });
                }
                next(args, args[1] || Object.keys(this._store.tableInfo));
            break;
            default:
                next(args, result);
        }
    }
}