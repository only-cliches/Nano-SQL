import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "./storage";
import { DataModel } from "../index";
import { setFast } from "lie-ts";
import { StdObject, hash, fastALL, deepFreeze, uuid, timeid, _assign, generateID, intersect } from "../utilities";
import { DatabaseIndex, syncPeerIndex } from "./db-idx";

/**
 * Handles IndexedDB with and without web workers.
 * Uses blob worker OR eval()s the worker and uses it inline.
 *
 * @export
 * @class _IndexedDBStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
export class _IndexedDBStore implements NanoSQLStorageAdapter {

    private _pkKey: {
        [tableName: string]: string;
    };

    private _dbIndex: {
        [tableName: string]: DatabaseIndex;
    };

    private _id: string;

    private _db: IDBDatabase;

    private _modelHash: string;

    private _dataModels: {[table: string]: DataModel[]};


    constructor(public version?: number) {
        this._pkKey = {};
        this._dbIndex = {};
        this._dataModels = {};
    }

    private onError(ev: Event) {
        console.error(ev);
        throw new Error("nSQL: IndexedDB Error!");
    }

    public connect(complete: () => void) {
        this._modelHash = hash(JSON.stringify(this._dataModels));

        let version = 1;
        if (this.version) { // manually handled by developer
            version = this.version;
        } else { // automatically handled by nanoSQL
            version = parseInt(localStorage.getItem(this._id + "-idb-version") || "") || 1;
            const modelHash = localStorage.getItem(this._id + "-idb-hash") || this._modelHash;

            if (modelHash !== this._modelHash) {
                version++;
            }

            localStorage.setItem(this._id + "-idb-version", String(version));
            localStorage.setItem(this._id + "-idb-hash", this._modelHash);
        }

        const idb = indexedDB.open(this._id, version);

        let idxes = {};

        idb.onerror = this.onError;

        // Called only when there is no existing DB, creates the tables and data store.
        // Sets indexes as empty arrays.
        idb.onupgradeneeded = (event: any) => {

            this._db = event.target.result;

            Object.keys(this._dbIndex).forEach((table) => {
                if (!this._db.objectStoreNames.contains(table)) {
                    this._db.createObjectStore(table, { keyPath: this._pkKey[table] });
                }
                idxes[table] = [];
            });
        };

        // Called once the database is connected and working
        // If an onupgrade wasn't called it's an existing DB, so we import indexes
        idb.onsuccess = (event: any) => {
            this._db = event.target.result;

            const getIDBIndex = (tName: string, callBack: (items) => void) => {
                let items: any[] = [];
                this.store(tName, "readonly", (transaction, store) => {
                    let cursorRequest = store.openCursor();
                    cursorRequest.onsuccess = (evt: any) => {
                        let cursor: IDBCursor = evt.target.result;
                        if (cursor) {
                            items.push(cursor.key);
                            cursor.continue();
                        }
                    };
                    cursorRequest.onerror = this.onError;
                    transaction.oncomplete = () => {
                        callBack(items);
                    };
                });
            };
            fastALL(Object.keys(this._dbIndex), (table, i, tDone) => {
                getIDBIndex(table, (index) => {
                    this._dbIndex[table].set(index);
                    tDone();
                });
            }).then(() => {
                complete();
            });
        };
    }

    public store(table: string, type: IDBTransactionMode, open: (tr: IDBTransaction, store: IDBObjectStore) => void) {
        const transaction = this._db.transaction(table, type);
        transaction.onabort = this.onError;
        transaction.onerror = this.onError;
        open(transaction, transaction.objectStore(table));
    }

    public setID(id: string) {
        this._id = id;
    }

    public makeTable(tableName: string, dataModels: DataModel[]): void {
        this._dbIndex[tableName] = new DatabaseIndex();
        this._dataModels[tableName] = dataModels;

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

    public write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, error: (err: Error) => void): void {

        pk = pk || generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai) as DBKey;

        if (!pk) {
            error(new Error("nSQL: Can't add a row without a primary key!"));
            return;
        }

        if (this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
        }

        let r  = {
            ...data,
            [this._pkKey[table]]: pk,
        };

        this.store(table, "readwrite", (transaction, store) => {
            const req = store.put(r);
            req.onerror = this.onError;
            req.onsuccess = (e) => {
                complete(r);
            };
        });
    }

    public delete(table: string, pk: DBKey, complete: () => void): void {
        let idx = this._dbIndex[table].indexOf(pk);
        if (idx !== -1) {
            this._dbIndex[table].remove(pk);
        }

        this.store(table, "readwrite", (transaction, store) => {
            const req = (pk as any === "_clear_") ? store.clear() : store.delete(pk as any);
            req.onerror = this.onError;
            req.onsuccess = (e) => {
                complete();
            };
        });
    }

    public read(table: string, pk: DBKey, callback: (row: any) => void): void {
        if (this._dbIndex[table].indexOf(pk) === -1) {
            callback(null);
            return;
        }

        this.store(table, "readonly", (transaction, store) => {
            const singleReq = store.get(pk);
            singleReq.onerror = this.onError;
            singleReq.onsuccess = () => {
                callback(singleReq.result);
            };
        });
    }

    public rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void {
        let keys = this._dbIndex[table].keys();
        const usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        let ranges: number[] = usefulValues ? [from as any, to as any] : [0, keys.length - 1];

        if (!keys.length) {
            complete();
            return;
        }

        if (!(usePK && usefulValues) && this._dbIndex[table].sortIndex === false) {
            keys = keys.sort();
        }

        const lower = usePK && usefulValues ? from : keys[ranges[0]];
        const higher = usePK && usefulValues ? to : keys[ranges[1]];


        this.store(table, "readonly", (transaction, store) => {
            let rows: any[] = [];
            const cursorRequest = usefulValues ? store.openCursor(IDBKeyRange.bound(lower, higher)) : store.openCursor();
            transaction.oncomplete = (e) => {
                let i = 0;
                const getRow = () => {
                    if (rows[i]) {
                        rowCallback(rows[i], i, () => {
                            i++;
                            i % 500 === 0 ? setFast(getRow) : getRow(); // handle maximum call stack error
                        });
                    } else {
                        complete();
                    }
                };
                getRow();
            };
            cursorRequest.onsuccess = (evt: any) => {
                const cursor: IDBCursorWithValue = evt.target.result;
                if (cursor) {
                    rows.push(cursor.value);
                    cursor.continue();
                }
            };
            cursorRequest.onerror = this.onError;
        });
    }

    public drop(table: string, callback: () => void): void {

        this._dbIndex[table] = this._dbIndex[table].clone();

        this.delete(table, "_clear_" as any, () => {
            callback();
        });
    }

    public getIndex(table: string, getLength: boolean, complete: (index) => void): void {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    }

    public destroy(complete: () => void) {
        localStorage.removeItem(this._id + "-idb-version");
        localStorage.removeItem(this._id + "-idb-hash");
        fastALL(Object.keys(this._dbIndex), (table, i, done) => {
            this.drop(table, done);
        }).then(complete);
    }

    public setNSQL(nSQL) {
        syncPeerIndex(nSQL, this._dbIndex);
    }
}