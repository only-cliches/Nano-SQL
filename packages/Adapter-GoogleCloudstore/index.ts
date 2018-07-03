import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "nano-sql/lib/database/storage";
import { DataModel } from "nano-sql";
import { setFast } from "lie-ts";
import { StdObject, hash, fastALL, deepFreeze, uuid, timeid, _assign, generateID, intersect, Promise } from "nano-sql/lib/utilities";
import { DatabaseIndex } from "nano-sql/lib/database/db-idx";
import * as Datastore from "@google-cloud/datastore";
// import { DatastoreKey } from "@google-cloud/datastore/entity";

export interface GDataEntity {
    key: any;
    data: {
        name: string;
        value: any;
        excludeFromIndexes?: boolean;
    }[] | { [key: string]: any };
}

/**
 * Handles Google Data Store storage.P
 *
 * @export
 * @class _GoogleDataStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
export class GDatastoreAdapter implements NanoSQLStorageAdapter {

    private _pkKey: {
        [tableName: string]: string;
    };

    private _dbIndex: {
        [tableName: string]: DatabaseIndex;
    };

    private _dbColumns: {
        [tableName: string]: string[];
    }

    private _id: string;

    private _path: string;

    private _dataStore: Datastore;

    private _doStrong: boolean;

    private _distributedMode: boolean;

    constructor(args: { projectId: string, keyFilename?: string, strongConsistency?: boolean, distributedMode?: boolean }) {
        this._pkKey = {};
        this._dbIndex = {};
        this._dbColumns = {};
        this._doStrong = args.strongConsistency || false;
        this._distributedMode = args.distributedMode || false;
        this._dataStore = new Datastore(args);
    }

    public connect(complete: () => void) {
        if (this._distributedMode) {
            complete();
            return;
        }
        fastALL(Object.keys(this._dbIndex), (table, i, done) => {
            this._getIndexFromGoogle(table, (idx) => {
                if (idx.length) {
                    this._dbIndex[table].set(idx.map(i => String(i)));
                }
                done();
            });
        }).then(complete);
    }

    public setID(id: string) {
        this._id = id;
    }

    public makeTable(tableName: string, dataModels: DataModel[]): void {

        this._dbIndex[tableName] = new DatabaseIndex();
        this._dbColumns[tableName] = [];
        dataModels.forEach((d) => {
            if (d.props && intersect(["pk", "pk()"], d.props)) {
                this._dbIndex[tableName].pkType = d.type;
                this._pkKey[tableName] = d.key;

                if (d.props && intersect(["ai", "ai()"], d.props) && (d.type === "int" || d.type === "number")) {
                    this._dbIndex[tableName].doAI = true;
                }

                if (d.props && intersect(["ns", "ns()"], d.props) || ["uuid", "timeId", "timeIdms"].indexOf(this._dbIndex[tableName].pkType) !== -1) {
                    this._dbIndex[tableName].sortIndex = false;
                }
            }
        });
    }

    public write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void): void {

        pk = pk || generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai) as DBKey;

        if (!pk) {
            throw Error("Can't add a row without a primary key!");
        }

        if (!this._distributedMode && this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
        }

        let r = {
            ...data,
            [this._pkKey[table]]: pk,
        };


        const d: GDataEntity = {
            key: this._dataStore.key({
                namespace: this._id,
                path: [table, String(pk as any)]
            }),
            data: Object.keys(r).map(k => ({
                name: k,
                value: (r[k] === undefined || r[k] === null) ? "" : r[k],
                excludeFromIndexes: k !== this._pkKey[table]
            }))
        };

        this.doRetry(new Promise((res, rej) => {
            this._dataStore.save(d, (err) => {
                if (err) {
                    rej(err);
                } else {
                    res();
                }
            });
        })).then(() => {
            complete(r);
        }).catch((err) => {
            throw err;
        })

    }

    public delete(table: string, pk: DBKey, complete: () => void): void {
        let idx = this._dbIndex[table].indexOf(pk);

        this.doRetry(new Promise((res, rej) => {
            this._dataStore.delete(this._dataStore.key({
                namespace: this._id,
                path: [table, String(pk as any)]
            }), (err) => {
                if (err) {
                    rej(err);
                } else {
                    if (!this._distributedMode && idx !== -1) {
                        this._dbIndex[table].remove(pk);
                    }
                    res();
                }
            });
        })).then(() => {
            complete();
        }).catch((err) => {
            throw err;
        })
    }

    private _clean(table: string, row: any): any {
        let obj = {};
        let i = this._dbColumns[table].length;
        while (i--) {
            obj[this._dbColumns[table][i]] = row[this._dbColumns[table][i]];
        }
        return obj;
    }

    public batchRead(table: string, pks: DBKey[], callback: (rows: any[]) => void) {
        const keys = pks.map(pk => this._dataStore.key({
            namespace: this._id,
            path: [table, String(pk as any)]
        }));

        this.doRetry(new Promise((res, rej) => {
            this._dataStore.get(keys, (err, entities) => {
                if (err) {
                    rej(err);
                    return;
                }
                res(entities.map(e => this._clean(table, e)));
            });
        })).then((entity) => {
            callback(entity);
        }).catch((err) => {
            throw err;
        })
    }

    public read(table: string, pk: DBKey, callback: (row: any) => void): void {
        if (!this._distributedMode && this._dbIndex[table].indexOf(pk) === -1) {
            callback(null);
            return;
        }

        this.doRetry(new Promise((res, rej) => {
            this._dataStore.get(this._dataStore.key({
                namespace: this._id,
                path: [table, String(pk as any)]
            }), (err, entity) => {
                if (err) {
                    rej(err);
                    return;
                }
                res(this._clean(table, entity));
            });
        })).then((entity) => {
            callback(entity);
        }).catch((err) => {
            throw err;
        })
    }

    public doRetry(doThis: Promise<any>, maxRetries?: number) {
        return new Promise((res, rej) => {
            let retries = 0;
            const runThis = () => {
                doThis.then(res).catch((err) => {
                    if (retries > (maxRetries || 2)) {
                        rej(err);
                    } else {
                        setTimeout(() => {
                            retries++;
                            runThis();
                        }, retries * 50);
                    }
                })
            }
            runThis();
        });
    }

    private _pkRangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any) {
        let rows: any[] = [];

        this.doRetry(new Promise((res, rej) => {

            const q = this._dataStore.createQuery(this._id, table);

            q.order(this._pkKey[table]);
            if (from || to) {
                q.filter(this._pkKey[table], ">=", from).filter(this._pkKey[table], "<=", to)
            }

            this._dataStore.runQueryStream(q, this._doStrong ? undefined : { consistency: "eventual" })
                .on("data", (entity) => {
                    rows.push(this._clean(table, entity));
                })
                .on("end", res)
                .on("error", rej);
        })).then(() => {
            let i = 0;
            const getRow = () => {
                if (i < rows.length) {
                    rowCallback(rows[i], i, () => {
                        i++;
                        i > 1000 ? setFast(getRow) : getRow(); // handle maximum call stack error
                    });
                } else {
                    complete();
                }
            };
            getRow();
        }).catch((err) => {
            throw err;
        })
    }


    private _offsetRangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any) {
        let rows: any[] = [];

        const pkIsNum = ["int", "float", "number"].indexOf(this._dbIndex[table].pkType) !== -1;
        const pk = this._pkKey[table];
        /**
         * This code is more complex than it absolutely has to be, but grabbing the index and
         * stepping through it on our own terms has two benifits:
         * 
         * 1. We don't have to load the entire result set into memory before processing it.  We can just process it in batches.
         * 2. If you do .limit(10).offset(3000) Google will charge you 3100 reads for that.  The method below bypasses that entirely.
         * 
         * The downside is every request has to wait for an index request and do a good deal of processing it wouldn't have to 
         * otherwise do if Google figured out how to properly impliment offset commands and let us paginate more intelligently.
         * 
         */

        this.doRetry(new Promise((res, rej) => {
            this.getIndex(table, false, (idx) => { // step 1, get index (1 entity read cost)

                // step 2, figure out what primary keys we're gonan get
                const PKs = idx.map(k => pkIsNum ? parseFloat(k) : k).filter((k, i) => {
                    return i >= from && i <= to;
                }).sort((a, b) => a > b ? 1 : -1);

                // we're now gonna grab the rows 250 at a time.
                let pageNum = 0;
                const perPage = 250;
                const getBatch = () => {
                    const start = pageNum * perPage;
                    const end = start + perPage;
                    const getKeys: any[] = PKs.filter((k, i) => i >= start && i < end).map(pk => this._dataStore.key({
                        namespace: this._id,
                        path: [table, String(pk)]
                    }));
                    if (!getKeys.length) {
                        res();
                        return;
                    }
                    this._dataStore.get(getKeys, (err, entities) => {
                        if (err) {
                            rej(err);
                            return;
                        }
                        let i = 0;
                        let rows = entities.map(e => this._clean(table, e)).sort((a, b) => a[pk] > b[pk] ? 1 : -1);
                        const getRow = () => {
                            if (i < rows.length) {
                                rowCallback(rows[i], i + (pageNum * perPage), () => {
                                    i++;
                                    getRow();
                                });
                            } else {
                                pageNum++;
                                getBatch();
                            }
                        };
                        getRow();
                    });
                }
                getBatch();
            });
        })).then(complete);

    }

    public rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void {

        const usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;

        if (usePK && usefulValues) { // primary key range
            this._pkRangeRead(table, rowCallback, complete, from, to);
        } else if (usefulValues) { // numerical range
            this._offsetRangeRead(table, rowCallback, complete, from, to);
        } else { // get all records :(
            this._pkRangeRead(table, rowCallback, complete);
        }

    }

    public drop(table: string, callback: () => void): void {

        this.rangeRead(table, (row, idx, next) => {
            this._dataStore.delete(this._dataStore.key({
                namespace: this._id,
                path: [table, String(row[this._pkKey[table]])]
            }), next);
        }, () => {
            let idx = new DatabaseIndex();
            idx.doAI = this._dbIndex[table].doAI;
            this._dbIndex[table] = idx;
            callback();
        })

    }

    private _getIndexFromGoogle(table: string, complete: (index: any[]) => void) {

        this.doRetry(new Promise((res, rej) => {
            const q = this._dataStore.createQuery(this._id, table);
            q
                .select('__key__')
                .run(this._doStrong ? undefined : { consistency: "eventual" }).then((entities: any[]) => {
                    res(entities[0].map(e => e[this._dataStore.KEY].name))
                }).catch(rej);
        }))
            .then(complete)
            .catch((err) => {
                throw err;
            });
    }

    public getIndex(table: string, getLength: boolean, complete: (index) => void): void {
        if (this._distributedMode) {
            this._getIndexFromGoogle(table, (idx) => {
                complete(getLength ? idx.length : idx);
            });
        } else {
            complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
        }

    }

    public destroy(complete: () => void) {
        fastALL(Object.keys(this._dbIndex), (table, i, done) => {
            const pk = this._pkKey[table];
            this._dataStore.createQuery(this._id, table).select('__key__').run().then((entities: any[]) => {
                fastALL(entities[0].map(e => e[this._dataStore.KEY].name), (primaryKey, i, delDone) => {
                    this.delete(table, primaryKey, delDone);
                }).then(done);
            });
        }).then(() => {
            complete();
        });
    }
}