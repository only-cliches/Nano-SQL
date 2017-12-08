/**
 * Worker JS file, gets inlined into the release bundle.
 * Uses RAW loader and gets dropped in as a text string.
 * This lets us load it as a blob, then load that blob as a webworker.
 */
/// <reference path="../../node_modules/typescript/lib/lib.es5.d.ts"/>
/// <reference path="../../node_modules/typescript/lib/lib.webworker.d.ts"/>


/**
 * Execute an array of async functions in parallel, return once all are complete.
 *
 * @param {((result: () => void) => void)[]} callbacks
 */
function ALL(callbacks: ((result: () => void) => void)[]) {

    this.go = (complete: (results: any[]) => void) => {
        let ptr = 0;

        if (!callbacks || !callbacks.length) {
            complete([]);
        }

        callbacks.forEach((cb, i) => {
            cb(() => {
                ptr++;
                if (ptr === callbacks.length) {
                    complete([]);
                }
            });
        });
    };
}

/**
 * Indexed DB Worker Class
 * Not using ES6 class syntax since it gets busy and fat when converted to ES5.
 * This worker code won't be doing any fancy module loading or anything, so we can get away with it.
 */
const IDBWorker: {
    db: IDBDatabase,
    store: (table: string, type: IDBTransactionMode, open: (tr: IDBTransaction, store: IDBObjectStore, msg: (act: string, args: any) => () => void) => void) => void;
    setup: (args: { pkKeys: { [tableName: string]: string; }, id: string }) => void;
    init: () => void;
    write: (args: { table: string, id: string, row: any }) => void;
    read: (args: { table: string, id: string, pk: any }) => void;
    readRange: (args: { table: string, id: string, range: [any, any] }) => void;
    delete: (args: { table: string, pk: any, id: string }) => void;
} = {
        // stores the indexed db database object
        db: null,

        // public method to generate a transaction and open a connection to the database
        store: (table: string, type: IDBTransactionMode, open: (tr: IDBTransaction, store: IDBObjectStore, msg: (act: string, args: any) => () => void) => void) => {
            const transaction = IDBWorker.db.transaction(table, type);
            open(transaction, transaction.objectStore(table), (act: string, args: any) => {
                return () => {
                    postMessage({ do: act, args: args });
                };
            });
        },

        // Essentially the constructor method
        init: () => {
            // Single event listener for the whole class
            addEventListener("message", (e) => {
                const message: {
                    do: string;
                    args: any
                } = e.data;

                if (IDBWorker[message.do]) {
                    IDBWorker[message.do](message.args);
                }

            }, false);
        },

        // Sets up the indexed db then sends indexes back to the parent.
        setup: (args) => {
            const idb = indexedDB.open(args.id, 1);
            let upgrading = false;
            let idxes = {};

            // Called only when there is no existing DB, creates the tables and data store.
            // Sets indexes as empty arrays.
            idb.onupgradeneeded = (event: any) => {
                upgrading = true;
                IDBWorker.db = event.target.result;
                Object.keys(args.pkKeys).forEach((table) => {
                    IDBWorker.db.createObjectStore(table, { keyPath: args.pkKeys[table] });
                    idxes[table] = [];
                });
            };

            // Called once the database is connected and working
            // If an onupgrade wasn't called it's an existing DB, so we import indexes
            idb.onsuccess = (event: any) => {
                IDBWorker.db = event.target.result;

                if (!upgrading) {
                    const getIDBIndex = (tName: string, callBack: (items) => void) => {
                        let items: any[] = [];
                        IDBWorker.store(tName, "readonly", (transaction, store, msg) => {
                            let cursorRequest = store.openCursor();
                            cursorRequest.onsuccess = (evt: any) => {
                                let cursor: IDBCursor = evt.target.result;
                                if (cursor) {
                                    items.push(cursor.key);
                                    cursor.continue();
                                }
                            };
                            transaction.oncomplete = () => {
                                callBack(items);
                            };
                        });
                    };
                    new ALL(Object.keys(args.pkKeys).map((table) => {
                        return (tDone) => {
                            getIDBIndex(table, (index) => {
                                idxes[table] = index;
                                tDone();
                            });
                        };
                    })).go(() => {
                        postMessage({ do: "rdy", args: idxes });
                    });
                } else {
                    postMessage({ do: "rdy", args: idxes });
                }
            };
        },

        // Writes a single row object to the database
        write: (args) => {
            IDBWorker.store(args.table, "readwrite", (transaction, store, msg) => {
                store.put(args.row);
                transaction.oncomplete = msg("write_" + args.id, null);
            }, );
        },

        // reads a single row object from the database
        read: (args) => {
            IDBWorker.store(args.table, "readonly", (transaction, store, msg) => {
                const singleReq = store.get(args.pk);
                singleReq.onsuccess = () => {
                    postMessage({ do: "read_" + args.id, args: singleReq.result });
                };
            });
        },

        // reads a range of rows from the database
        readRange: (args) => {
            IDBWorker.store(args.table, "readonly", (transaction, store, msg) => {
                let rows = [];
                const cursorRequest = args.range.indexOf(undefined) === -1 ? store.openCursor(IDBKeyRange.bound(args.range[0], args.range[1])) : store.openCursor();
                transaction.oncomplete = msg("readRange_" + args.id + "_done", rows);
                cursorRequest.onsuccess = (evt: any) => {
                    const cursor: IDBCursorWithValue = evt.target.result;
                    if (cursor) {
                        rows.push(cursor.value);
                        /*if (rows.length > 50) { // spit every 50 rows into a seperate message
                            msg("readRange_" + args.id, rows.slice())();
                            rows = [];
                        }*/
                        cursor.continue();
                    }
                };
            });
        },

        // delets a specific row or all rows in the database
        delete: (args) => {
            IDBWorker.store(args.table, "readwrite", (transaction, store, msg) => {
                transaction.oncomplete = msg("delete_" + args.id, true);
                transaction.onerror = msg("delete_" + args.id, false);
                if (args.pk === "_clear_") {
                    store.clear();
                } else {
                    store.delete(args.pk);
                }
            });
        }
    };

IDBWorker.init();