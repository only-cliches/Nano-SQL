import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION } from "../interfaces";
import { hash, generateID, cast, deepGet, deepSet, allAsync, setFast } from "../utilities";
import { nanoSQLMemoryIndex } from "./memoryIndex";
import { deepEqual } from "assert";

export class IndexedDB extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "IndexedDB Adapter",
        version: VERSION
    };

    nSQL: InanoSQLInstance;

    private _db: { [table: string]: IDBDatabase };
    private _id: any;
    private _ai: {
        [key: string]: number;
    };
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    constructor(public version?: number) {
        super(false, false);
        this._db = {};
        this._ai = {};
        this._tableConfigs = {};
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        complete();
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {

        let version = 1;
        this._tableConfigs[tableName] = tableData;
        const dataModelHash = hash(JSON.stringify(tableData.columns));
        if (this.version) { // manually handled by developer
            version = this.version;
        } else { // automatically handled by nanoSQL
            version = parseInt(localStorage.getItem(this._id + "_" + tableName + "_idb_version") || "1");
            const modelHash = localStorage.getItem(this._id + "_" + tableName + "_idb_hash") || dataModelHash;

            if (modelHash !== dataModelHash) {
                version++;
            }

            localStorage.setItem(this._id + "_" + tableName + "_idb_version", String(version));
            localStorage.setItem(this._id + "_" + tableName + "_idb_hash", dataModelHash);
        }

        const idb = indexedDB.open(this._id + "_" + tableName, version);
        this._ai[tableName] = parseInt(localStorage.getItem(this._id + "_" + tableName + "_idb_ai") || "0");

        idb.onerror = error;
        let isUpgrading = false;
        // Called only when there is no existing DB, creates the tables and data store.
        idb.onupgradeneeded = (event: any) => {
            this._db[tableName] = event.target.result;

            if (!this._db[tableName].objectStoreNames.contains(tableName)) {
                this._db[tableName].createObjectStore(tableName, { keyPath: tableData.pkCol.join(".") });
            }
        };

        // Called once the database is connected
        idb.onsuccess = (event: any) => {
            this._db[tableName] = event.target.result;
            complete();
        };
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        // open a read/write db transaction, ready for clearing the data
        const tx = this._db[table].transaction(table, "readwrite");
        tx.onerror = error;
        const objectStoreRequest = tx.objectStore(table).clear();
        objectStoreRequest.onerror = error;
        objectStoreRequest.onsuccess = () => {
            this._db[table].close();
            delete this._db[table];
            localStorage.removeItem(this._id + "_" + table + "_idb_version");
            localStorage.removeItem(this._id + "_" + table + "_idb_hash");
            localStorage.removeItem(this._id + "_" + table + "_idb_ai");
            complete();
        };
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        allAsync(Object.keys(this._db), (table, i, next, error) => {
            this._db[table].close();
            setFast(() => {
                next();
            });
        }).then(complete).catch(error);
    }

    store(table: string, type: IDBTransactionMode, open: (tr: IDBTransaction, store: IDBObjectStore) => void, error: (err: any) => void) {
        const transaction = this._db[table].transaction(table, type);
        transaction.onabort = error;
        transaction.onerror = error;
        open(transaction, transaction.objectStore(table));
    }

    batch(table: string, actions: {type: "put"|"del", data: any}[], success: (result: any[]) => void, error: (msg: any) => void) {
        
        this.store(table, "readwrite", (tx, store) => {
            tx.onerror = error;

            let i = 0;

            while(i < actions.length) {
                const value = actions[i];
                if (value.type === "put") {
                    store.put(value.data);
                } else {
                    store.delete(value.data);
                }
                i++;
            }
            
            tx.oncomplete = () => success([]);
        }, error);
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {

        if (typeof pk === "undefined") {
            pk = generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);
        }

        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }

        this._ai[table] = Math.max(pk, this._ai[table]);

        if (this._tableConfigs[table].ai) {
            this._ai[table] = cast(this._id, "int", Math.max(this._ai[table] || 0, pk));
            localStorage.setItem(this._id + "_" + table + "_idb_ai", String(this._ai[table]));
        }

        deepSet(this._tableConfigs[table].pkCol, row, pk);

        this.store(table, "readwrite", (transaction, store) => {
            try {
                store.put(row).onsuccess = () => {
                    complete(pk);
                };
            } catch (e) {
                error(e);
            }
        }, error);
    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {

        this.store(table, "readonly", (transaction, store) => {
            const singleReq = store.get(pk);
            singleReq.onerror = (err) => {
                complete(undefined);
            };
            singleReq.onsuccess = () => {
                complete(singleReq.result);
            };
        }, error);
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {

        this.store(table, "readwrite", (transaction, store) => {
            const req = store.delete(pk as any);
            req.onerror = error;
            req.onsuccess = (e) => {
                complete();
            };
        }, error);
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {
        const doOffset = type === "offset";
        let count = 0;
        const lowerLimit = doOffset ? offsetOrLow : 0;
        const upperLimit = lowerLimit + limitOrHigh;
        let advancing: boolean = true;
        this.store(table, "readonly", (tr, store) => {
            if ((store as any).getAll) { // IndexedDB 2 (way faster)  
                const request = (store as any).getAll(type !== "range" ? undefined : IDBKeyRange.bound(offsetOrLow, limitOrHigh, false, false), type === "offset" && !reverse ? limitOrHigh + offsetOrLow : undefined);
                request.onsuccess = (event: any) => {
                    const result: any[] = reverse ? event.target.result.reverse() : event.target.result;
                    if (type === "offset") {
                        const add = reverse ? 1 : 0;
                        result.slice(offsetOrLow + add, offsetOrLow + limitOrHigh + add).forEach(onRow);
                    } else {
                        result.forEach(onRow);
                    }
                    complete();
                }
                request.onerror = error;
            } else { // IndexedDB 1
                store.openCursor(type !== "range" ? undefined : IDBKeyRange.bound(offsetOrLow, limitOrHigh, false, false), reverse ? "prev" : "next").onsuccess = (event: any) => {
                    const cursor: IDBCursorWithValue = event.target.result;
                    if (!cursor) {
                        complete();
                        return;
                    }
    
                    if (type === "offset") {
                        if (advancing) {
                            const lower = reverse ? lowerLimit + 1 : lowerLimit;
                            cursor.advance(lower);
                            count = lower;
                            advancing = false;
                            return;
                        }
    
                        if (reverse ? upperLimit >= count : upperLimit > count) {
                            onRow(cursor.value, count - offsetOrLow);
                        }
                    } else {
                        onRow(cursor.value, count);
                    }
                    count++;
                    cursor.continue();
                };
            }
        }, error);

    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        let index: any[] = [];
        this.store(table, "readonly", (tr, store) => {
            if ((store as any).getAllKeys) { // IndexedDB 2 (way faster)
                const request = (store as any).getAllKeys();
                request.onsuccess = (event: any) => {
                    complete(event.target.result);
                };
                request.onerror = error;
            } else { // IndexedDB 1
                const request = store.openCursor()
                request.onsuccess = (event: any) => {
                    const cursor: IDBCursorWithValue = event.target.result;
                    if (cursor) {
                        index.push(deepGet(this._tableConfigs[table].pkCol, cursor.value));
                        cursor.continue();
                    } else {
                        complete(index);
                    }
                };
                request.onerror = error;
            }

        }, error);

    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        let count = 0;
        this.store(table, "readonly", (tr, store) => {
            const ctRequest = tr.objectStore(table).count();
            ctRequest.onsuccess = () => {
                complete(ctRequest.result);
            }
            ctRequest.onerror = error;
        }, error);
    }
}

