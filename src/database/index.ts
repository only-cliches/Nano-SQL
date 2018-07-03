import { Trie } from "prefix-trie-ts";
import { IdbQuery } from "../query/std-query";
import { NanoSQLPlugin, DBConnect, NanoSQLInstance } from "../index";
import { _NanoSQLStorageQuery } from "./query";
import { fastALL, Promise, fastCHAIN } from "../utilities";
import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "./storage";
import { setFast } from "lie-ts";

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

        /*for (let i = 0; i < 100; i++) {
            this._queryPool.push(new _NanoSQLStorageQuery(this._store));
        }*/

        this._store.init(connectArgs.models, (newModels) => {
            connectArgs.models = {
                ...connectArgs.models,
                ...newModels
            };
            next(connectArgs);
        });
    }

    public getId() {
        return this._store._id;
    }

    public doExec(execArgs: IdbQuery, next: (execArgs: IdbQuery) => void, error: (err: Error) => void): void {
        execArgs.state = "complete";
        /*this._queryPtr++;
        if (this._queryPtr > this._queryPool.length - 1) {
            this._queryPtr = 0;
        }*/
        new _NanoSQLStorageQuery(this._store).doQuery(execArgs, next, error);
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
                this._store.adapters[0].adapter.rangeRead(table, (r, idx, rowDone) => {
                    dump[table].push(r);
                    rowDone();
                }, done);
            }).then(() => {
                res(dump);
            });
        });
    }

    public importTables(tables, onProgress) {
        return new Promise((res, rej) => {
            let totalLength = 0;
            let totalProgress = 0;
            Object.keys(tables).forEach((table) => {
                totalLength += (tables[table] || []).length || 0;
            });
            fastALL(Object.keys(tables), (tableName, i, done, err) => {
                const pkKey = this._store.tableInfo[tableName]._pk;
                const length = (tables[tableName] || []).length || 0;
                let k = 0;
                const next = () => {
                    if (k < length) {
                        const row = tables[tableName][k];
                        k++;
                        totalProgress++;
                        if (row[pkKey]) {
                            this._store.adapterWrite(tableName, row[pkKey], row, () => {
                                onProgress(Math.round(((totalProgress + 1) / totalLength) * 10000) / 100);
                                k % 500 === 0 ? setFast(next) : next();
                            }, err);
                        } else {
                            onProgress(Math.round(((totalProgress + 1) / totalLength) * 10000) / 100);
                            k % 500 === 0 ? setFast(next) : next();
                        }
                    } else {
                        done();
                    }
                };
                next();
            }).then(() => {
                res();
            });
        });
    }

    public willDisconnect(next) {
        fastALL(this._store.adapters || [], (adapter: NanoSQLStorageAdapter, i, done) => {
            if (adapter.disconnect) {
                adapter.disconnect(done);
            } else {
                done();
            }
        }).then(next);
    }

    public extend(next: (args: any[], result: any[]) => void, args: any[], result: any[]): void {

        switch (args[0]) {
            case "clone":
                const nSQLi = new NanoSQLInstance();
                Object.keys(this.parent.dataModels).forEach((table) => {
                    nSQLi.table(table).model(this.parent.dataModels[table], [], true);
                });
                nSQLi
                    .config({
                        id: this._store._id,
                        mode: args[1]
                    })
                    .connect().then(() => {
                        let i = 0;
                        fastCHAIN(Object.keys(this.parent.dataModels), (table, i, done) => {
                            console.log(`Importing ${table}...`);
                            this.parent.rawDump([table])
                                .then((data) => {
                                    return nSQLi.rawImport(data);
                                })
                                .then(done);
                        }).then(() => {
                            next(args, []);
                        });
                    });
                break;
            case "flush":
                let tables: string[] = [];
                if (!args[1]) {
                    tables = this.parent.tableNames;
                } else {
                    tables = [args[1]];
                }
                fastCHAIN(tables, (table: string, i, next) => {
                    this._store._drop(table, next);
                }).then(() => {
                    next(args, tables);
                });
                break;
            case "get_adapter":
                if (!args[1]) {
                    next(args, [this._store.adapters[0].adapter]);
                } else {
                    next(args, [this._store.adapters[args[1]].adapter]);
                }

                break;
            case "idx.length":
            case "idx":
                const table = args[1];
                if (Object.keys(this._store.tableInfo).indexOf(table) > -1) {
                    this._store.adapters[0].adapter.getIndex(table, args[0] !== "idx", (idx: any) => {
                        next(args, idx);
                    });
                } else {
                    next(args, []);
                }
                break;
            case "rebuild_search":
                const rebuildTables: string[] = (() => {
                    if (args[1]) return [args[1]];
                    return Object.keys(this._store.tableInfo);
                })();
                const progress: (progress: number) => void = args[2];

                fastALL(rebuildTables, (table, i, done) => {
                    let totalProgress = 0;
                    let currentProgress = 0;
                    fastALL(rebuildTables, (t, kk, lengthDone) => {
                        this._store.adapters[0].adapter.getIndex(t, true, (len: number) => {
                            totalProgress += len;
                            lengthDone();
                        });
                    }).then(() => {

                        let tablesToDrop: string[] = Object.keys(this._store.tableInfo[table]._searchColumns).map(t => "_" + table + "_search_tokens_" + t);
                        tablesToDrop = tablesToDrop.concat(Object.keys(this._store.tableInfo[table]._searchColumns).map(t => "_" + table + "_search_" + t));
                        tablesToDrop = tablesToDrop.concat(Object.keys(this._store.tableInfo[table]._searchColumns).map(t => "_" + table + "_search_fuzzy_" + t));
                        fastALL(tablesToDrop, (dropTable, i, dropDone) => {
                            this._store.adapterDrop(dropTable, dropDone);
                        }).then(() => {
                            this._store.adapters[0].adapter.rangeRead(table, (row, idx, next) => {
                                this.parent.query("upsert", row)
                                    .comment("_rebuild_search_index_")
                                    .manualExec({ table: table }).then(() => {
                                        if (progress) progress(Math.round(((currentProgress + 1) / totalProgress) * 10000) / 100);
                                        currentProgress++;
                                        next();
                                    });
                            }, done);
                        });

                    });
                }).then(() => {
                    next(args, []);
                });
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
            default:
                next(args, result);
        }

    }
}