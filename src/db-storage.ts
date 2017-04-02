import { NanoSQLInstance, _assign, NanoSQLBackend, ActionOrView, QueryLine, DBRow, DataModel, StdObject, DBConnect, DBExec, JoinArgs, DBFunction } from "./index";
import { _NanoSQLDB, _str } from "./db-index";
import { _functions } from "./db-query";

declare var global: any;

export interface IHistoryPoint {
    id: number;
    historyPoint: number;
    tableID: number;
    rowKeys: number[];
    type: string;
}

// tslint:disable-next-line
export class _NanoSQL_Storage {

    public _mode;

    public _indexedDB: IDBDatabase;

    public _parent: _NanoSQLDB;

    /**
     * Stores a row index for each table.
     *
     * @internal
     * @type {{
     *         [tableHash: number]: Array<DataModel>;
     *     }}
     * @memberOf _NanoSQLDB
     */
    public _models: {
        [tableHash: number]: Array<DataModel>;
    };

    /**
     * Utility data for each table, including holding the primary key, name, incriment number and primary keys
     *
     * @type {{
     *         [tableHash: number]: {
     *             _pk: string // Table primary key
     *             _pkType: string; // Primary key data type
     *             _name: string // Table name
     *             _incriment: number; // Table incriment counter
     *             _index: string[]; // The table index of row IDs in this table
     *             _keys: string[]; // Array of column keys
     *             _defaults: any[]; // Array of column defaults
     *             _rows: { // If memory mode is enabled, row data is stored here.
     *                 [key: string]: DBRow
     *             }
     *         }
     *     }}
     * @memberOf _NanoSQL_Storage
     */
    public _tables: {
        [tableHash: number]: {
            _pk: string
            _pkType: string;
            _name: string
            _incriment: number;
            _index: (string|number)[];
            _keys: string[];
            _defaults: any[];
            _rows: {
                [key: string]: DBRow|null
            }
        }
    };



    /**
     * Utility table to store misc data.
     *
     * This is populated regardless of the memory db setting.
     *
     * @type {{
     *         [key: string]: {
     *             key: string,
     *             value: any;
     *         }
     *     }}
     * @memberOf _NanoSQL_Storage
     */
    public _utilityTable: {
        [key: string]: {
            key: string,
            value: any;
        }
    };

    /**
     * The pointer that indiciates where in history to pull from.
     *
     * @internal
     * @type {number}
     * @memberOf _NanoSQLDB
     */
    public _historyPoint: number;

    /**
     * Keeps track of how many total history points we have
     *
     * @type {number}
     * @memberOf _NanoSQLDB
     */
    public _historyLength: number;

    /**
     * A variable to hold the state of the history pointer and history length
     *
     * @internal
     * @type {Array<number>}
     * @memberOf _NanoSQLDB
     */
    public _historyArray: Array<number>;

    /**
     * Flag to indicate the state of transactions
     *
     * @type {boolean}
     * @memberOf _NanoSQLDB
     */
    public _doingTransaction: boolean;

    /**
     * Wether to enable the persistent storage system or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLDB
     */
    public _persistent: boolean;

    /**
     * Flag to store wether history is enabled or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLDB
     */
    public _doHistory: boolean;

    /**
     * Flag to store wether tables are stored in memory or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLDB
     */
    public _storeMemory: boolean;

    /**
     * Save the connect args so we can re init the store on command.
     *
     * @type {DBConnect}
     * @memberOf _NanoSQL_Storage
     */
    public _savedArgs: DBConnect;

    /**
     * Level Up store variable.
     *
     * @type {{
     *         [key: string]: any;
     *     }}
     * @memberOf _NanoSQL_Storage
     */
    public _levelDBs: {
        [key: string]: any;
    };

    constructor(database: _NanoSQLDB, args: DBConnect) {
        this._savedArgs = args;
        this.init(database, args);
    }

    /**
     * Setup persistent storage engine and import any existing data into memory.
     *
     * @static
     * @param {_NanoSQLDB} database
     * @param {DBConnect} args
     * @returns {boolean}
     *
     * @memberOf _NanoSQL_Persistent
     */
    public init(database: _NanoSQLDB, args: DBConnect) {
        let t = this;
        t._models = {};
        t._tables = {};
        t._levelDBs = {};
        t._historyPoint = 0;
        t._historyLength = 0;
        t._historyArray = [0, 0];
        t._doingTransaction = false;
        t._doHistory = true;
        t._storeMemory = true;
        t._persistent = false;
        t._utilityTable = {};

        t._mode = 0;
        t._parent = database;

        let size: number = 5;
        if (args._config.length) {
            t._persistent = args._config[0].persistent !== undefined ? args._config[0].persistent : false;
            t._doHistory = args._config[0].history !== undefined ? args._config[0].history : true;
            t._storeMemory = args._config[0].memory !== undefined ? args._config[0].memory : true;
            size = args._config[0].size || 5;
            t._mode = {
                IDB: 1,
                LS: 2,
                // WSQL: 3,
                LVL: 4
            }[args._config[0].mode] || 0;
        }

        let upgrading = false;
        let index = 0;
        let isNewStore = true;

        Object.keys(args._models).forEach((t) => {
            let pkRow: any;
            args._models[t].forEach((m) => {
                if (m.props && m.props.indexOf("pk") !== -1) pkRow = _assign(m);
            });
            if (pkRow) {
                args._models["_" + t + "_hist__data"] = _assign(args._models[t]).map((m) => {
                    delete m.props;
                    return m;
                });
                args._models["_" + t + "_hist__meta"] = [
                    pkRow,
                    {key: "_pointer", type: "int"},
                    {key: "_historyDataRowIDs", type: "array"},
                ];
            }
        });

        args._models[_str(0)] = [
            {key: "key", type: "string", props: ["pk"]},
            {key: "value", type: "blob"},
        ];

        args._models[_str(1)] = [
            {key: "id", type: "int", props: ["ai", "pk"]},
            {key: "tableID", type: "int"},
            {key: "historyPoint", type: "int"},
            {key: "rowKeys", type: "array"},
            {key: "type", type: "string"}
        ];

        let tables = Object.keys(args._models);

        let beforeHist;
        let beforeMode;

        Object.keys(args._models).forEach((tableName) => {
            t._newTable(tableName, args._models[tableName]);
        });

        Object.keys(args._functions || []).forEach((f) => {
            _functions[f] = args._functions[f];
        });

        const completeSetup = () => {
            let tables = Object.keys(args._models);
            let i = 0;

            t._mode = beforeMode;
            if (beforeHist) {
                t._read(_str(0), "all", (rows) => {
                    rows.forEach((d) => {
                        t._utility("w", d.key, d.value);
                        if (d.key === "historyPoint") t._historyPoint = d.value || 0;
                        if (d.key === "historyLength") t._historyLength = d.value || 0;
                    });
                });
            }

            if (isNewStore) {
                const step = () => {
                    if (i < tables.length) {
                        if (tables[i].indexOf("_hist__data") !== -1) {
                            t._upsert(tables[i], 0, null, () => {
                                i++;
                                step();
                            });
                        } else {
                            i++;
                            step();
                        }
                    } else {
                        t._doHistory = beforeHist;
                        args._onSuccess();
                    }
                };
                step();
            } else {
                t._doHistory = beforeHist;
                args._onSuccess();
            }
        };

        beforeMode = t._mode;

        /**
         * mode 0: no persistent storage, memory only
         * mode 1: Indexed DB // Preferred, forward compatible browser persistence
         * mode 2: Local Storage // Default fallback
         * mode 3: WebSQL // No longer planned
         * mode 4: Level Up // Used by NodeJS
         */
        if (t._persistent) {
            if (t._mode !== 0) { // Mode has been set by dev, make sure it will work in our current environment.  If not, set mode to 0
                switch (t._mode) {
                    case 1: if (typeof indexedDB === "undefined") t._mode = 0;
                    break;
                    case 2: if (typeof localStorage === "undefined") t._mode = 0;
                    break;
                    case 4: if (typeof window !== "undefined") t._mode = 0;
                    break;
                }
            } else { // Auto detect mode
                if (typeof window !== "undefined") {
                    if (typeof localStorage !== "undefined")                t._mode = 2; // Local storage is the fail safe
                    if (typeof indexedDB !== "undefined")                   t._mode = 1; // Use indexedDB instead if it's there
                }
                if (typeof global !== "undefined") {
                    if (typeof global._levelup !== "undefined" && typeof global._fs !== "undefined") {
                        t._mode = 4; // Use LevelUp in NodeJS if it's there.
                    }
                }
            }
        } else {
            t._mode = 0;
            completeSetup();
        }

        beforeHist = t._doHistory;
        beforeMode = t._mode;
        t._mode = 0;
        t._doHistory = false;

        const createTables = (makeTable: (tableName: string, tableHash: number, tableData: any) => void, complete: () => void) => {
            const next = () => {
                if (index < tables.length) {
                    let ta = NanoSQLInstance._hash(tables[index]);
                    makeTable(tables[index], ta, t._tables[ta]);
                    index++;
                    next();
                } else {
                    complete();
                }
            };
            next();
        };

        const cacheTableData = (args: {
            requestIndex: (tableName: string, callBack: (tableIndex: (string|number)[]) => void) => void,
            requestTable: (tableName: string, callBack: (tableData: any[]) => void) => void,
            forceIndex?: boolean,
            cleanup?: (done: () => void) => void
        }) => {
            isNewStore = false;
            let index = 0;
            const next = () => {
                if (index >= tables.length) {
                    if (args.cleanup) {
                        args.cleanup(() => {
                            completeSetup();
                        });
                    } else {
                        completeSetup();
                    }
                    return;
                }

                // Do not import history tables if history is disabled.
                if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                    index++;
                    next();
                    return;
                }

                // Load data into memory store
                if (index < tables.length) {
                    let ta = NanoSQLInstance._hash(tables[index]);

                    if (t._storeMemory) {
                        args.requestTable(tables[index], (tableData) => {
                            if (tables[index].indexOf("_hist__data") !== -1) {
                                t._tables[ta]._index.push("0");
                                t._tables[ta]._rows["0"] = null;
                                t._tables[ta]._incriment++;
                                t._parent._parent.loadJS(tables[index], tableData).then(() => {
                                    index++;
                                    next();
                                });
                            } else {
                                t._parent._parent.loadJS(tables[index], tableData).then(() => {
                                    index++;
                                    next();
                                });
                            }
                        });

                    } else if (!t._storeMemory || args.forceIndex) {
                        args.requestIndex(tables[index], (indexData) => {
                            t._parent._parent.loadJS(tables[index], indexData).then(() => {
                                index++;
                                next();
                            });
                        });
                    }
                }
            };
            next();
        };

        switch (beforeMode) {
            case 0: // memory DB
                completeSetup();
            break;
            case 1: // Indexed DB
                let idb = indexedDB.open(String(t._parent._databaseID), 1);

                // Called only when there is no existing DB, creates the tables and data store.
                idb.onupgradeneeded = (event: any) => {
                    upgrading = true;
                    let db: IDBDatabase = event.target.result;
                    let transaction: IDBTransaction = event.target.transaction;
                    t._indexedDB = db;
                    createTables((tableName, tableHash, tableObj) => {
                        let config = tableObj._pk ? { keyPath: tableObj._pk } : {};
                        db.createObjectStore(tableName, config); // Standard Tables
                    }, () => {
                        transaction.oncomplete = () => {
                            completeSetup();
                        };
                    });
                };

                // Called once the database is connected and working
                idb.onsuccess = (event: any) => {
                    t._indexedDB = event.target.result;

                    if (!upgrading) {

                        const getIDBData = (tName: string, callBack: (items) => void) => {
                            let items: any[] = [];
                            let transaction = t._indexedDB.transaction(tName, "readonly");
                            let store = transaction.objectStore(tName);
                            let cursorRequest = store.openCursor();
                            cursorRequest.onsuccess = (evt: any) => {
                                let cursor: IDBCursorWithValue = evt.target.result;
                                if (cursor) {
                                    items.push(t._storeMemory ? cursor.value : cursor.key);
                                    cursor.continue();
                                }
                            };
                            transaction.oncomplete = () => {
                                callBack(items);
                            };
                        };

                        cacheTableData({
                            requestIndex: (tableName, complete) => {
                                getIDBData(tableName, complete);
                            },
                            requestTable: (tableName, complete ) => {
                                getIDBData(tableName, complete);
                            }
                        });

                    }
                };
            break;
            case 2: // Local Storage
                if (localStorage.getItem("dbID") !== String(t._parent._databaseID)) { // New storage, just set it up
                    localStorage.setItem("dbID", String(t._parent._databaseID));
                    createTables((tableName, tableHash, tableObj) => {
                        localStorage.setItem(tableName, JSON.stringify([]));
                    }, () => {
                        completeSetup();
                    });
                } else { // Existing, import data from local storage
                    cacheTableData({
                        forceIndex: true,
                        requestIndex: (tableName, complete) => {
                            let tableIndex = JSON.parse(localStorage.getItem(tableName) || "[]");
                            complete(tableIndex);
                        },
                        requestTable: (tableName, complete ) => {
                            let items: any[] = [];
                            JSON.parse(localStorage.getItem(tableName) || "[]").forEach((ptr) => {
                                items.push(JSON.parse(localStorage.getItem(tableName + "-" + ptr) || ""));
                            });
                            complete(items);
                        }
                    });
                }
            break;
            /* NODE-START */
            case 4: // Level Up

                // Called to import existing  data into the memory store.
                const existingStore = () => {

                    const getLevelData = (tName: string, callBack: (items) => void) => {
                        let items: any[] = [];
                        let stream = t._storeMemory ? t._levelDBs[tName].createValueStream() : t._levelDBs[tName].createKeyStream();
                        stream.on("data", (data) => {
                            items.push(data);
                        })
                        .on("end", () => {
                            callBack(items);
                        });
                    };

                    cacheTableData({
                        requestIndex: (tableName, complete) => {
                            getLevelData(tableName, complete);
                        },
                        requestTable: (tableName, complete ) => {
                            getLevelData(tableName, complete);
                        }
                    });
                };

                const dbFolder = "./db_" + t._parent._databaseID;
                let existing = true;
                if (!global._fs.existsSync(dbFolder)) {
                    global._fs.mkdirSync(dbFolder);
                    existing = false;
                }

                tables.forEach((table) => {
                    t._levelDBs[table] = global._levelup(dbFolder + "/" + table, {
                        valueEncoding: "json"
                    });
                });

                if (existing) {
                    existingStore();
                } else {
                    completeSetup();
                }

            break;
            /* NODE-END */
        }

    }

    public _clear(type: "all"|"hist", complete: Function): void {
        let t = this;

        let tables = Object.keys(t._tables).map(k => t._tables[k]._name);
        let index = 0;
        const setupNewHist = () => {
            let index = 0;
            const histStep = () => {
                if (index < tables.length) {
                    if (tables[index].indexOf("_hist__meta") !== -1) {
                        let referenceTable = String(tables[index]).slice(1).replace("_hist__meta", "");
                        let ta = NanoSQLInstance._hash(referenceTable);
                        let pk = t._tables[ta]._pk;
                        t._read(referenceTable, "all", (rows) => {
                            rows.forEach((row, i) => {
                                let hist = {};
                                hist[_str(2)] = 0;
                                hist[_str(3)] = [i + 1];
                                t._upsert(tables[index], row[pk], hist);
                                t._upsert("_" + referenceTable + "_hist__data", i + 1, row);
                            });
                            index++;
                            histStep();
                        });
                    } else {
                        index++;
                        histStep();
                    }
                } else {
                    complete();
                }
            };
            histStep();
        };

        const step = () => {
            if (index < tables.length) {
                let deleteTable = false;
                if (type === "hist" && (tables[index] === "_historyPoints" || tables[index].indexOf("_hist__meta") !== -1 || tables[index].indexOf("_hist__data") !== -1)) {
                    deleteTable = true;
                }
                if (type === "all" && tables[index] !== "_utility") {
                    deleteTable = true;
                }
                if (deleteTable) {
                    t._delete(tables[index], "all", () => {
                        if (tables[index].indexOf("_hist__data") !== -1) {
                            t._upsert(tables[index], 0, null);
                        }
                        index++;
                        step();
                    });
                } else {
                    index++;
                    step();
                }
            } else {
                if (type === "hist") {
                    setupNewHist();
                } else {
                    complete();
                }
            }
        };

        step();
    }


    public _delete(tableName: string, rowID: string|number, callBack?: (success: boolean) => void): void {
        let t = this;
        let editingHistory = false;

        const ta = NanoSQLInstance._hash(tableName);
        let deleteRowIDS: any[] = [];

        if (rowID === "all") {
            deleteRowIDS = t._tables[ta]._index.slice();
            t._tables[ta]._index = [];
        } else {
            deleteRowIDS.push(rowID);
            t._tables[ta]._index.splice(t._tables[ta]._index.indexOf(rowID), 1); // Update Index
        }

        if (t._storeMemory) {
            if (rowID === "all") {
                t._tables[ta]._rows = {};
            } else {
                delete t._tables[ta]._rows[rowID];
                if (t._mode === 0 && callBack) return callBack(true);
            }
        }

        if (t._mode > 0) {

            let i = 0;
            const step = () => {
                if (i < deleteRowIDS.length) {
                    switch (t._mode) {
                        case 1: // IndexedDB
                            t._indexedDB.transaction(tableName, "readwrite").objectStore(tableName).delete(parseInt(deleteRowIDS[i]));
                            i++;
                            step();
                        break;
                        case 2: // Local Storage
                            localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                            localStorage.removeItem(tableName + "-" + String(deleteRowIDS[i]));
                            i++;
                            step();
                        break;
                        /* NODE-START */
                        case 4: // Level Up
                            t._levelDBs[tableName].del(deleteRowIDS[i], () => {
                                i++;
                                step();
                            });
                        break;
                        /* NODE-END */
                        default:
                        i++;
                        step();
                    }
                } else {
                    if (callBack) callBack(true);
                }
            };
            step();
        }


    }

    public _upsert(tableName: string, rowID: string|number|null, value: any, callBack?: (rowID: number|string) => void): void {
        let t = this;
        const ta = NanoSQLInstance._hash(tableName);
        if (rowID === undefined || rowID === null) {
            t._models[ta].forEach((m) => {
                if (m.props && m.props.indexOf("pk") !== -1) {
                    if (m.type === "uuid") {
                        rowID = NanoSQLInstance.uuid();
                    } else {
                        rowID = t._tables[ta]._incriment++;
                    }
                }
            });

            if (!rowID) rowID = parseInt(t._tables[ta]._index[t._tables[ta]._index.length - 1] as string || "0") + 1;
        }

        if (t._tables[ta]._pkType === "int") rowID = parseInt(rowID as string);

        const pk = t._tables[ta]._pk;
        if (pk && pk.length && value && !value[pk]) {
            value[pk] = rowID;
        }

        // Index update
        if (t._tables[ta] && t._tables[ta]._index.indexOf(rowID) === -1) {
            t._tables[ta]._index.push(rowID);
        }

        // Memory Store Update
        if (t._storeMemory && t._tables[ta]) {
            t._tables[ta]._rows[rowID] = t._parent._deepFreeze(value, ta);
            if (t._mode === 0 && callBack) return callBack(rowID);
        }

        switch (t._mode) {
            case 1: // IndexedDB
                const transaction = t._indexedDB.transaction(tableName, "readwrite");
                const store = transaction.objectStore(tableName);
                if (pk.length && value) {
                    store.put(value);
                } else {
                    if (tableName.indexOf("_hist__data") !== -1) {
                        store.put(value, rowID);
                    } else {
                        if (value) store.put(value);
                        if (!value) store.delete(rowID);
                    }
                }
                transaction.oncomplete = function() {
                    if (callBack) callBack(rowID as string);
                };
            break;
            case 2: // Local Storage
                localStorage.setItem(tableName + "-" + String(rowID), value ? JSON.stringify(value) : "");
                localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                if (callBack) callBack(rowID as string);
            break;
            /* NODE-START */
            case 4: // Level Up

                if (tableName.indexOf("_hist__data") !== -1) {
                    t._levelDBs[tableName].put(rowID, value ? value : null, () => {
                        if (callBack) callBack(rowID as string);
                    });
                } else {
                    if (value) {
                        t._levelDBs[tableName].put(rowID, value, () => {
                            if (callBack) callBack(rowID as string);
                        });
                    } else {
                        t._levelDBs[tableName].del(rowID, () => {
                            if (callBack) callBack(rowID as string);
                        });
                    }
                }


            break;
            /* NODE-END */
        }

    }

    public _readRange(tableName: string, key: string, between: any[], callBack: (rows: DBRow[]) => void): void {
        let t = this;
        const ta = NanoSQLInstance._hash(tableName);
        // Memory is faster, local storage cannot be optimized in this way.
        if ((t._storeMemory && t._tables[ta]) || t._mode === 2 ) {
            this._read(tableName, (row) => {
                return row[key] >= between[0] && row[key] <= between[1];
            }, callBack);
            return;
        }

        let rows: any[] = [];

        switch (t._mode) {
            case 1: // IndexedDB
                const transaction = t._indexedDB.transaction(tableName, "readonly");
                const store = transaction.objectStore(tableName);
                let cursorRequest = store.openCursor(IDBKeyRange.bound(between[0], between[1]));
                transaction.oncomplete = () => {
                    callBack(rows);
                };
                cursorRequest.onsuccess = (evt: any) => {
                    let cursor = evt.target.result;
                    if (cursor) {
                        rows.push(cursor.value);
                        cursor.continue();
                    }
                };
            break;
            /* NODE-START */
            case 4: // LevelDB
                t._levelDBs[tableName].createValueStream({
                    gte: between[0],
                    lte: between[1]
                })
                .on("data", (data) => {
                    if (data) rows.push(data);
                })
                .on("end", () => {
                    callBack(rows);
                });
            break;
            /* NODE-END */
        }
    }

    public _read(tableName: string, row: string|number|Function, callBack: (rows: any[]) => void): void {
        let t = this;

        const ta = NanoSQLInstance._hash(tableName);
        // Way faster to read directly from memory if we can.
        if (t._storeMemory && t._tables[ta]) {
            let rows = t._tables[ta]._rows;
            if (row === "all" || typeof row === "function") {
                let allRows = Object.keys(rows).map(r => rows[r]);
                if (row === "all") {
                    callBack(allRows.filter((r) => r));
                } else {
                    callBack(allRows.filter((r) => row(r)));
                }
            } else {
                callBack([rows[row]].filter((r) => r));
            }
            return;
        }

        switch (t._mode) {
            case 1: // IndexedDB
                const transaction = t._indexedDB.transaction(tableName, "readonly");
                const store = transaction.objectStore(tableName);
                if (row === "all" || typeof row === "function") {
                    let cursorRequest = store.openCursor();
                    let rows: any[] = [];
                    transaction.oncomplete = () => {
                        callBack(rows);
                    };

                    cursorRequest.onsuccess = (evt: any) => {
                        let cursor = evt.target.result;
                        if (cursor) {
                            if (row !== "all") {
                                if (row(cursor.value)) rows.push(cursor.value);
                            } else {
                                rows.push(cursor.value);
                            }
                            cursor.continue();
                        }
                    };
                } else {
                    let singleReq = store.get(row);
                    singleReq.onsuccess = (event) => {
                        callBack([singleReq.result]);
                    };
                }
            break;
            case 2: // Local Storage
                if (row === "all" || typeof row === "function") {
                    let rows = t._tables[ta]._index.map((idx) => {
                        let item = localStorage.getItem(tableName + "-" + idx);
                        return item && item.length ? JSON.parse(item) : null;
                    });
                    if (row !== "all") {
                        callBack(rows.filter((r) => row(r)));
                    } else {
                        callBack(rows);
                    }
                } else {
                    let item = localStorage.getItem(tableName + "-" + row);
                    callBack([item && item.length ? JSON.parse(item) : null]);
                }
            break;

            /* NODE-START */
            case 4: // Level Up

                if (row === "all" || typeof row === "function") {
                    let rows: any[] = [];
                    t._levelDBs[tableName].createValueStream()
                    .on("data", (data) => {
                        if (data) rows.push(data);
                    })
                    .on("end", () => {
                        if (row !== "all") {
                            callBack(rows.filter((r) => row(r)));
                        } else {
                            callBack(rows);
                        }
                    });
                } else {
                    t._levelDBs[tableName].get(row, (err, data) => {
                        if (err) {
                            callBack([null]);
                        } else {
                            callBack([JSON.parse(data)]);
                        }
                    });
                }
            break;
            /* NODE-END */
        }
    }

    /**
     * Write or access utility options.
     *
     * @param {("r"|"w")} type
     * @param {string} key
     * @param {*} [value]
     * @returns
     *
     * @memberOf _NanoSQLDB
     */
    public _utility(type: "r"|"w", key: string, value?: any): any {
        let t = this;
        if (type === "r") { // Read
            if (t._utilityTable[key]) {
                return t._utilityTable[key].value;
            } else {
                return null;
            }
        } else { // Write
            t._upsert(_str(0), key, {key: key, value: value});
            t._utility[key] = {
                key: key,
                value: value
            };
            return value;
        }
    }

    /**
     * Setup a new table.
     *
     * @param {string} tableName
     * @param {DataModel[]} dataModels
     * @returns {string}
     *
     * @memberOf _NanoSQL_Storage
     */
    public _newTable(tableName: string, dataModels: DataModel[]): string {
        let t = this;
        let ta = NanoSQLInstance._hash(tableName);

        t._models[ta] = dataModels;
        t._parent._queryCache[ta] = {};

        t._tables[ta] = {
            _pk: "",
            _pkType: "",
            _keys: [],
            _defaults: [],
            _name: tableName,
            _incriment: 1,
            _index: [],
            _rows: {}
        };

        // Discover primary keys for each table
        let i = t._models[ta].length;
        let keys: string[] = [];
        let defaults: any[] = [];
        while (i--) {
            const p = t._models[ta][i];
            t._tables[ta]._keys.unshift(p.key);
            t._tables[ta]._defaults[i] = p.default;
            if (p.props && p.props.indexOf("pk") >= 0) {
                t._tables[ta]._pk = p.key;
                t._tables[ta]._pkType = p.type;
            }
        }

        return tableName;
    }
}