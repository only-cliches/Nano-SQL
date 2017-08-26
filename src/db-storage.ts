import {
    NanoSQLInstance,
    _assign,
    NanoSQLBackend,
    ActionOrView,
    QueryLine,
    DBRow,
    DataModel,
    StdObject,
    DBConnect,
    DBExec,
    JoinArgs,
    DBFunction
} from "./index";
import { _NanoSQLDB, _str } from "./db-index";
import { _functions } from "./db-query";
import { Promise, setFast } from "lie-ts";
import { Trie } from "prefix-trie-ts";

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
	 * Optional path of the level DB store.
	 *
	 * @internal
	 * @type {string}
	 * @memberof _NanoSQL_Storage
	 */
    private _dbPath: string;

	/**
	 * Optional LevelDB write cache size.
	 *
	 * internal
	 * @type {number}
	 * @memberof _NanoSQL_Storage
	 */
    private _dbWriteCacheMB: number;

	/**
	 * Optional LevelDB read cache size.
	 *
	 * internal
	 * @type {number}
	 * @memberof _NanoSQL_Storage
	 */
    private _dbReadCacheMB: number;

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
        [tableHash: number]: Array<DataModel>
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
            _pkType: string
            _relations: {
                _table: string
                _key: string
                _mapTo: string
                _type: "array" | "single"
            }[]
            _name: string
            _incriment: number
            _index: (string | number)[]
            _trieIndex: Trie
            _secondaryIndexes: string[]
            _trieColumns: string[]
            _trieObjects: {
                [column: string]: Trie
            }
            _keys: string[]
            _defaults: any[]
            _rows: {
                [key: string]: DBRow | null
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
            key: string
            value: any
        }
    };

	/**
	   * Since multiple rows might be inside a single history point, this keeps track
	   * of which history points are attached to which history point rows for fast seeking.
	   *
	   * @type {{
	   *         [historyPoint: number]: number[]; // History Row IDs
	   *     }}
	   * @memberOf _NanoSQL_Storage
	   */
    public _historyPointIndex: {
        [historyPoint: number]: number[] // History Row IDs
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
	   * Store current, active transaction information.
	   *
	   * @type {number[]}
	   * @memberof _NanoSQL_Storage
	   */
    public _activeTransactions: number[];

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
	   * The current history mode, linear (standard) or parallel.
	   * (mode 1) Linear mode records evey change in the databse as a timeline.
	   * (mode 2) Parallel mode creates a linear history for every row, recording revisions to the row.
	   *
	   * @type {("lin"|"par")}
	   * @memberof _NanoSQL_Storage
	   */
    public _historyMode: 1 | 2;

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
    // tslint:disable-next-line:indent
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
        [key: string]: any
    };

	/**
	   * Tracks transaction data in memory to commit to the data store when the transaction ends.
	   *
	   * @type {({
	   *         [tableName: string]:    {
	   *             type: string;
	   *             key: string|number;
	   *             value: string;
	   *         }[]
	   *     })}
	   * @memberOf _NanoSQL_Storage
	   */
    public _transactionData: {
        [transactionID: number]: {
            [tableName: string]: {
                type: string
                key: string | number
                value: string
            }[]
        }
    };

	/**
	   * Should we rebuild secondary indexes on connect?
	   *
	   * @private
	   * @type {boolean}
	   * @memberOf _NanoSQL_Storage
	   */
    private _rebuildIndexes: boolean;

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
        t._activeTransactions = [];
        t._transactionData = {};
        t._doHistory = true;
        t._historyMode = 1;
        t._storeMemory = true;
        t._persistent = false;
        t._utilityTable = {};
        t._historyPointIndex = {};
        t._dbPath = ".";
        t._dbWriteCacheMB = 12;
        t._dbReadCacheMB = 24;

        t._mode = 0;
        t._parent = database;

        if (args._config.length) {
            t._persistent = args._config[0].persistent !== undefined
                ? args._config[0].persistent
                : false;
            t._doHistory = args._config[0].history !== undefined
                ? args._config[0].history
                : true;
            t._storeMemory = args._config[0].memory !== undefined
                ? args._config[0].memory
                : true;
            t._mode =
                {
                    IDB: 1,
                    LS: 2,
                    // WSQL: 3,
                    LVL: 4
                }[args._config[0].mode] || 0;

            if (
                args._config[0].historyMode &&
                args._config[0].history === "revisions"
            ) {
                t._historyMode = 2;
            }

            // Check if we should rebuild secondary indexes
            if (args._config[0].rebuildIndexes) t._rebuildIndexes = true;

            // Set database ID
            if (args._config[0].id) t._parent._databaseID = String(args._config[0].id);

            // Look for config Path
            if (args._config[0].dbPath) t._dbPath = String(args._config[0].dbPath);

            // Set Write Cache Size
            if (args._config[0].writeCache) t._dbWriteCacheMB = parseFloat(args._config[0].writeCache);

            // Set Read Cache Size
            if (args._config[0].readCache) t._dbReadCacheMB = parseFloat(args._config[0].readCache);
        }

        let upgrading = false;
        let index = 0;
        let isNewStore = true;

        Object.keys(args._models).forEach(t => {
            let pkRow: DataModel = { key: "x", type: "x" };
            let secondaryIndexes: DataModel[] = [];
            args._models[t].forEach(m => {
                if (m.props && m.props.indexOf("pk") !== -1) {
                    pkRow = _assign(m);
                }
                if (
                    m.props &&
                    (m.props.indexOf("idx") !== -1 || m.props.indexOf("trie") !== -1)
                ) {
                    secondaryIndexes.push(m);
                }
            });

            // Seperate tables for history meta and history row records.
            if (pkRow.key !== "x" && pkRow.type !== "x") {
                args._models["_" + t + "_hist__data"] = _assign(
                    args._models[t]
                ).map(m => {
                    return {
                        key: m.key,
                        type: m.type
                    };
                });
                args._models["_" + t + "_hist__data"].unshift({
                    key: _str(4),
                    type: "int"
                });

                args._models["_" + t + "_hist__meta"] = [
                    pkRow,
                    { key: "_pointer", type: "int", default: 0 },
                    { key: "_historyDataRowIDs", type: "array" }
                ];
            }

            // Seperate tables for each secondary index
            if (
                secondaryIndexes.length &&
                (pkRow.key !== "x" && pkRow.type !== "x")
            ) {
                secondaryIndexes.forEach(s => {
                    args._models["_" + t + "_idx_" + s.key] = [
                        { key: "id", type: s.type, props: ["pk"] },
                        { key: "rowPK", type: pkRow.type }
                    ];
                });
            }
        });

        args._models[_str(1)] = [
            { key: "id", type: "int", props: ["ai", "pk"] },
            { key: "tableID", type: "int" },
            { key: "historyPoint", type: "int" }, // TODO build a manual seconday index for history pionts.
            { key: "rowKeys", type: "array" },
            { key: "type", type: "string" }
        ];

        args._models[_str(0)] = [
            { key: "key", type: "string", props: ["pk"] },
            { key: "value", type: "blob" }
        ];

        let tables = Object.keys(args._models);

        let beforeHist;
        let beforeMode;

        Object.keys(args._models).forEach(tableName => {
            t._newTable(tableName, args._models[tableName]);
        });

        Object.keys(args._functions || {}).forEach(f => {
            _functions[f] = args._functions[f];
        });

        // Rebuild secondary indexes
        const rebuildSecondaryIndexes = () => {
            if (!t._rebuildIndexes) {
                t._rebuildTries(args._onSuccess);
            } else {
                Promise.all(
                    Object.keys(args._models).map(tableName => {
                        return new Promise((res, rej) => {
                            t._rebuildSecondaryIndex(tableName, () => {
                                res();
                            });
                        });
                    })
                ).then(() => {
                    t._rebuildTries(args._onSuccess);
                });
            }
        };

        const completeSetup = () => {
            let tables = Object.keys(args._models);
            let i = 0;

            t._mode = beforeMode;

            if (beforeHist && t._historyMode === 1) {
                // Restore history point and length
                t._read(_str(0), "all", rows => {
                    rows.forEach(d => {
                        t._utility("w", d.key, d.value);
                        if (d.key === "historyPoint") t._historyPoint = d.value || 0;
                        if (d.key === "historyLength") t._historyLength = d.value || 0;
                    });
                });

                // Rebuild history point index
                t._read(_str(1), "all", rows => {
                    rows.forEach(row => {
                        if (!t._historyPointIndex[row.historyPoint]) {
                            t._historyPointIndex[row.historyPoint] = [];
                        }
                        t._historyPointIndex[row.historyPoint].push(row.id);
                    });
                });
            }

            const restoreHistoryData = () => {
                if (i < tables.length) {
                    if (tables[i].indexOf("_hist__data") !== -1) {
                        let ta = NanoSQLInstance._hash(tables[i]);
                        if (isNewStore) {
                            // setup initial null row
                            // t._tables[ta]._index.push(0);
                            // t._tables[ta]._rows[0] = null;
                            t._upsert(tables[i], 0, null, () => {
                                i++;
                                restoreHistoryData();
                            });
                        } else {
                            i++;
                            restoreHistoryData();
                        }
                    } else {
                        i++;
                        restoreHistoryData();
                    }
                } else {
                    t._doHistory = beforeHist;
                    rebuildSecondaryIndexes();
                }
            };
            restoreHistoryData();
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
            if (t._mode !== 0) {
                // Mode has been set by dev, make sure it will work in our current environment.  If not, set mode to 0
                switch (t._mode) {
                    case 1:
                        if (typeof indexedDB === "undefined") t._mode = 0;
                        break;
                    case 2:
                        if (typeof localStorage === "undefined") t._mode = 0;
                        break;
                    case 4:
                        if (typeof window !== "undefined") t._mode = 0;
                        break;
                }
            } else {
                // Auto detect mode
                if (typeof window !== "undefined") {
                    if (typeof localStorage !== "undefined") t._mode = 2; // Local storage is the fail safe
                    if (typeof indexedDB !== "undefined") t._mode = 1; // Use indexedDB instead if it's there
                }
                if (typeof global !== "undefined") {
                    if (
                        typeof global._levelup !== "undefined" &&
                        typeof global._fs !== "undefined"
                    ) {
                        t._mode = 4; // Use LevelUp in NodeJS if it's there.
                    }
                }
            }
        } else {
            t._mode = 0;
        }

        beforeHist = t._doHistory;
        beforeMode = t._mode;
        t._mode = 0;

        const createTables = (
            makeTable: (tableName: string, tableHash: number, tableData: any) => void,
            complete: () => void
        ) => {
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

        const cacheTableData = (
            args: {
                requestIndex: (
                    tableName: string,
                    callBack: (tableIndex: (string | number)[]) => void
                ) => void
                requestTable: (
                    tableName: string,
                    callBack: (tableData: any[]) => void
                ) => void
                forceIndex?: boolean
                cleanup?: (done: () => void) => void
            }
        ) => {
            isNewStore = false;
            let index = 0;
            const next = () => {
                if (index < tables.length) {
                    // Load data into memory store
                    let ta = NanoSQLInstance._hash(tables[index]);

                    // Do not import history tables if history is disabled.
                    if (
                        !beforeHist &&
                        (tables[index].indexOf("_hist__data") !== -1 ||
                            tables[index].indexOf("_hist__meta") !== -1)
                    ) {
                        index++;
                        next();
                        return;
                    }

                    if (t._storeMemory) {
                        args.requestTable(tables[index], tableData => {
                            t._parent._parent.loadJS(tables[index], tableData).then(() => {
                                if (tables[index].indexOf("_hist__data") !== -1) {
                                    t._tables[ta]._rows[0] = null;
                                }
                                index++;
                                next();
                            });
                        });
                    } else if (!t._storeMemory || args.forceIndex) {
                        args.requestIndex(tables[index], indexData => {
                            t._parent._store._tables[ta]._index = indexData;
                            t._parent._store._tables[
                                ta
                            ]._incriment = indexData.reduce((prev, cur) => {
                                return Math.max(prev as number, parseInt(cur as string) || 0);
                            }, 0) as number;
                            t._parent._store._tables[ta]._incriment++;
                            index++;
                            next();
                        });
                    }
                } else {
                    if (args.cleanup) {
                        args.cleanup(() => {
                            completeSetup();
                        });
                    } else {
                        completeSetup();
                    }
                    return;
                }
            };
            next();
        };

        switch (beforeMode) {
            case 0: // memory DB
                completeSetup();
                break;
            case 1: // Indexed DB
                let idb = indexedDB.open(t._parent._databaseID, 1);

                // Called only when there is no existing DB, creates the tables and data store.
                idb.onupgradeneeded = (event: any) => {
                    upgrading = true;
                    let db: IDBDatabase = event.target.result;
                    let transaction: IDBTransaction = event.target.transaction;
                    t._indexedDB = db;
                    createTables(
                        (tableName, tableHash, tableObj) => {
                            let config = tableObj._pk ? { keyPath: tableObj._pk } : {};
                            db.createObjectStore(tableName, config); // Standard Tables
                        },
                        () => {
                            transaction.oncomplete = () => {
                                completeSetup();
                            };
                        }
                    );
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
                            requestTable: (tableName, complete) => {
                                getIDBData(tableName, complete);
                            }
                        });
                    }
                };
                break;
            case 2: // Local Storage
                if (localStorage.getItem("dbID") !== t._parent._databaseID) {
                    // New storage, just set it up
                    localStorage.setItem("dbID", t._parent._databaseID);
                    createTables(
                        (tableName, tableHash, tableObj) => {
                            localStorage.setItem(tableName, JSON.stringify([]));
                        },
                        () => {
                            completeSetup();
                        }
                    );
                } else {
                    // Existing, import data from local storage
                    cacheTableData({
                        forceIndex: true,
                        requestIndex: (tableName, complete) => {
                            let tableIndex = JSON.parse(
                                localStorage.getItem(tableName) || "[]"
                            );
                            complete(tableIndex);
                        },
                        requestTable: (tableName, complete) => {
                            let items: any[] = [];
                            JSON.parse(
                                localStorage.getItem(tableName) || "[]"
                            ).forEach(ptr => {
                                items.push(
                                    JSON.parse(localStorage.getItem(tableName + "-" + ptr) || "")
                                );
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
                        let stream = t._storeMemory
                            ? t._levelDBs[tName].createValueStream()
                            : t._levelDBs[tName].createKeyStream();
                        stream
                            .on("data", data => {
                                items.push(t._storeMemory ? JSON.parse(data) : data);
                            })
                            .on("end", () => {
                                callBack(items);
                            });
                    };

                    cacheTableData({
                        requestIndex: (tableName, complete) => {
                            getLevelData(tableName, complete);
                        },
                        requestTable: (tableName, complete) => {
                            getLevelData(tableName, complete);
                        }
                    });
                };

                const dbFolder = t._dbPath + "/db_" + t._parent._databaseID;
                let existing = true;
                if (!global._fs.existsSync(dbFolder)) {
                    global._fs.mkdirSync(dbFolder);
                    existing = false;
                }

                tables.forEach(table => {
                    t._levelDBs[table] = global._levelup(dbFolder + "/" + table, {
                        cacheSize: t._dbReadCacheMB * 1024 * 1024,
                        writeBufferSize: t._dbWriteCacheMB * 1024 * 1024
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

    public _rebuildSecondaryIndex(tableName: string, complete: () => void) {
        let t = this;
        const ta = NanoSQLInstance._hash(tableName);
        let rowPTR = 0;
        let secondIdx: string[] = t._tables[ta]._secondaryIndexes;

        this._read(tableName, "all", rows => {
            let PK = t._tables[ta]._pk;
            const step2 = () => {
                if (rowPTR < rows.length) {
                    let ptr3 = 0;
                    const step3 = () => {
                        if (ptr3 < secondIdx.length) {
                            let key = secondIdx[ptr3];
                            let idxTbl = "_" + tableName + "_idx_" + key;
                            t._delete(idxTbl, "all", () => {
                                let rowKey = String(rows[rowPTR][key]).toLowerCase();
                                t._read(
                                    idxTbl,
                                    rowKey,
                                    readRows => {
                                        let indexedRows: any[] = [rows[rowPTR][PK]];
                                        if (readRows.length && readRows[0].rowPK) {
                                            indexedRows = indexedRows
                                                .concat(readRows[0].rowPK)
                                                .filter((item, pos) => {
                                                    return indexedRows.indexOf(item) === pos;
                                                });
                                        }
                                        t._upsert(idxTbl, rowKey, {
                                            id: rows[rowPTR][key],
                                            rowPK: indexedRows
                                        },
                                            () => {
                                                ptr3++;
                                                setFast(step3);
                                            }
                                        );
                                    },
                                    true
                                );
                            });
                        } else {
                            rowPTR++;
                            setFast(step2);
                        }
                    };
                    step3();
                } else {
                    complete();
                }
            };
            step2();
        });
    }

	/**
	   * Rebuild Trie structures on secondary indexes
	   *
	   *
	   * @memberOf _NanoSQL_Storage
	   */
    public _rebuildTries(callBack: Function) {
        let rebuildJob: {
            [tableName: string]: string[]
        } = {};
        let jobLength = 0;
        let t = this;

        Object.keys(t._tables).forEach(tableID => {
            let tableName = t._tables[tableID]._name;
            if (tableName.indexOf("_") !== 0) {
                // only check non internal tables
                if (t._tables[tableID]._trieColumns.length) {
                    rebuildJob[tableName] = t._tables[tableID]._trieColumns;
                    jobLength++;
                }
            }
        });

        if (jobLength === 0) {
            callBack();
        } else {
            let tables = Object.keys(rebuildJob);
            let ptr = 0;
            const step = () => {
                if (ptr < tables.length) {
                    const ta = NanoSQLInstance._hash(tables[ptr]);
                    t._read(tables[ptr], "all", rows => {
                        rows.forEach((row, i) => {
                            rebuildJob[tables[ptr]].forEach(key => {
                                if (row[key]) t._tables[ta]._trieObjects[key].addWord(row[key]);
                            });
                        });
                        ptr++;
                        step();
                    });
                } else {
                    callBack();
                }
            };
            step();
        }
    }

	/**
	   * Complets a transaction.
	   *
	   *
	   * @memberOf _NanoSQL_Storage
	   */
    public _execTransaction(transactionID: number): Promise<any[]> {
        let t = this;

        return new Promise((res, rej) => {
            const complete = () => {
                if (t._transactionData[transactionID]) {
                    Promise.all(
                        Object.keys(t._transactionData[transactionID]).map(table => {
                            return new Promise(resolve => {
                                t._rebuildSecondaryIndex(table, resolve);
                            });
                        })
                    ).then(() => {
                        res(
                            [
                                {
                                    msg:
                                    Object.keys(t._transactionData[transactionID]).length +
                                    " transactions performed."
                                }
                            ],
                            t._parent._parent
                        );
                        delete t._transactionData[transactionID];
                    });
                } else {
                    res([{ msg: "0 transactions performed." }], t._parent._parent);
                }
            };

            switch (t._mode) {
                /* NODE-START */
                case 4: // LevelDB
                    Object.keys(t._transactionData[transactionID]).forEach(tableName => {
                        t._levelDBs[tableName].batch(
                            t._transactionData[transactionID][tableName]
                        );
                    });
                    complete();
                    break;
                /* NODE-END */
                default:
                    complete();
            }
        });
    }

	/**
	   * Clears everything from the data store.
	   *
	   * @param {("all"|"hist")} type
	   * @param {Function} complete
	   *
	   * @memberOf _NanoSQL_Storage
	   */
    public _clear(type: "all" | "hist", complete: Function): void {
        let t = this;

        let tables = Object.keys(t._tables).map(k => t._tables[k]._name);

        const setupNewHist = () => {
            Promise.all(
                tables.map(table => {
                    return new Promise((res, rej) => {
                        if (table.indexOf("_hist__meta") !== -1) {
                            let referenceTable = String(table)
                                .slice(1)
                                .replace("_hist__meta", "");
                            let ta = NanoSQLInstance._hash(referenceTable);
                            let pk = t._tables[ta]._pk;
                            t._upsert("_" + referenceTable + "_hist__data", 0, null);
                            t._tables["_" + referenceTable + "_hist__data"]._index.push(0);
                            t._read(referenceTable, "all", rows => {
                                rows.forEach((row, i) => {
                                    let hist = {};
                                    hist[_str(2)] = 0;
                                    hist[_str(3)] = [i + 1];
                                    t._upsert(table, row[pk], hist);
                                    t._upsert("_" + referenceTable + "_hist__data", i + 1, row);
                                });
                                res();
                            });
                        } else {
                            res();
                        }
                    });
                })
            ).then(() => {
                complete();
            });
        };

        Promise.all(
            tables.map(table => {
                return new Promise((res, rej) => {
                    let deleteTable = false;
                    if (
                        type === "hist" &&
                        (table === _str(1) ||
                            table.indexOf("_hist__meta") !== -1 ||
                            table.indexOf("_hist__data") !== -1)
                    ) {
                        deleteTable = true;
                    }
                    if (type === "all" && table !== "_utility") {
                        deleteTable = true;
                    }
                    if (deleteTable) {
                        t._delete(table, "all", () => {
                            if (table.indexOf("_hist__data") !== -1) {
                                t._upsert(table, 0, null);
                            }
                            res();
                        });
                    } else {
                        res();
                    }
                });
            })
        ).then(() => {
            setupNewHist();
        });
    }

	/**
	   * Removes rows from the store.
	   *
	   * @param {string} tableName
	   * @param {(string|number)} rowID
	   * @param {(success: boolean) => void} [callBack]
	   * @returns {void}
	   *
	   * @memberOf _NanoSQL_Storage
	   */
    public _delete(
        tableName: string,
        rowID: string | number,
        callBack?: (success: boolean) => void,
        transactionID?: number
    ): void {
        let t = this;
        let editingHistory = false;

        const ta = NanoSQLInstance._hash(tableName);
        let deleteRowIDS: any[] = [];

        if (rowID === "all") {
            deleteRowIDS = t._tables[ta]._index.slice().filter(i => i);
            t._tables[ta]._index = [];
            t._tables[ta]._trieIndex = new Trie([]);
        } else {
            deleteRowIDS.push(rowID);
            t._tables[ta]._trieIndex.removeWord(String(rowID));
            t._tables[ta]._index.splice(t._tables[ta]._index.indexOf(rowID), 1); // Update Index
        }

        if (t._storeMemory) {
            if (rowID === "all") {
                t._tables[ta]._rows = {};
            } else {
                delete t._tables[ta]._rows[rowID];
            }
        }

        NanoSQLInstance.chain(
            deleteRowIDS.map(rowID => {
                return nextRow => {
                    if (transactionID) {
                        if (!t._transactionData[transactionID])
                            t._transactionData[transactionID] = {};
                        if (!t._transactionData[transactionID][tableName]) {
                            t._transactionData[transactionID][tableName] = [];
                        }
                        t._transactionData[transactionID][tableName].push({
                            type: "del",
                            key: rowID,
                            value: ""
                        });
                    }

                    switch (t._mode) {
                        case 0:
                            nextRow();
                            break;
                        case 1: // IndexedDB
                            t._indexedDB
                                .transaction(tableName, "readwrite")
                                .objectStore(tableName)
                                .delete(rowID);
                            nextRow();
                            break;
                        case 2: // Local Storage
                            localStorage.setItem(
                                tableName,
                                JSON.stringify(t._tables[ta]._index)
                            );
                            localStorage.removeItem(tableName + "-" + String(rowID));
                            nextRow();
                            break;
                        /* NODE-START */
                        case 4: // Level Up
                            t._levelDBs[tableName].del(rowID, () => {
                                nextRow();
                            });
                            break;
                        /* NODE-END */
                        default:
                            nextRow();
                    }
                };
            })
        )(() => {
            if (callBack) callBack(true);
        });
    }

	/**
	   * Update the secondary attached to a specific row and table.
	   *
	   * @param {DBRow} newRow
	   * @param {number} tableID
	   * @param {() => void} [callBack]
	   *
	   * @memberof _NanoSQL_Storage
	   */
    public _updateSecondaryIndex(
        newRow: DBRow,
        tableID: number,
        callBack?: () => void
    ) {
        let t = this;

        const table = t._tables[tableID];

        let oldRow = {};

        if (table._name.indexOf("_") !== 0) {
            let emptyColumns: string[] = [];

            const updateIndex = (
                tableName: string,
                rowID: any,
                key: string,
                complete?: () => void
            ) => {
                t._read(
                    tableName,
                    rowID,
                    rows => {
                        let indexedRows: any[] = [];
                        if (rows.length && rows[0].rowPK)
                            indexedRows = indexedRows.concat(rows[0].rowPK);
                        indexedRows.push(newRow[table._pk]);
                        // if (!rem) indexedRows.push(newRow[table._pk]);
                        indexedRows = indexedRows.filter((item, pos, arr) => {
                            // remove duplicates
                            return arr.indexOf(item) === pos;
                            // return indexedRows.indexOf(item) === pos || !(rem && item === newRow[table._pk]);
                        });

                        if (indexedRows.length) {
                            t._upsert(
                                tableName,
                                rowID,
                                {
                                    id: rowID,
                                    rowPK: indexedRows
                                },
                                complete
                            );
                        } else {
                            emptyColumns.push(key);
                            t._delete(tableName, rowID, complete);
                        }
                    },
                    true
                );
            };

            // Update tries
            table._trieColumns.forEach(key => {
                const word = String(newRow[key]).toLocaleLowerCase();
                if (emptyColumns.indexOf(key) !== -1) {
                    t._tables[tableID]._trieObjects[key].removeWord(word);
                } else {
                    t._tables[tableID]._trieObjects[key].addWord(word);
                }
            });

            // Update secondary indexes
            if (table._secondaryIndexes.length) {
                Promise.all(
                    table._secondaryIndexes.map(key => {
                        return new Promise((res, rej) => {
                            const idxTable = "_" + table._name + "_idx_" + key;
                            const rowID = String(newRow[key]).toLowerCase();
                            const oldRowID = String(oldRow[key]).toLowerCase();
                            if (rowID !== oldRowID && oldRow[key]) {
                                // Remove old value from secondary index
                                t._read(idxTable, oldRowID, oldRowIndex => {
                                    let indexes: any[] = oldRowIndex[0]
                                        ? _assign(oldRowIndex[0].rowPK || [])
                                        : [];
                                    const oldRowLoc = indexes.indexOf(oldRowID[table._pk]);
                                    if (oldRowLoc !== -1) {
                                        indexes.splice(oldRowLoc, 1);
                                        t._upsert(
                                            idxTable,
                                            oldRowID,
                                            {
                                                id: oldRowID,
                                                rowPK: indexes
                                            },
                                            () => {
                                                // Add new value where it belongs
                                                updateIndex(idxTable, rowID, key, res);
                                            }
                                        );
                                    } else {
                                        updateIndex(idxTable, rowID, key, res);
                                    }
                                });
                            } else {
                                if (newRow[key] !== undefined) {
                                    updateIndex(idxTable, rowID, key, res);
                                } else {
                                    if (callBack) callBack();
                                }
                            }
                        });
                    })
                ).then(callBack);
            } else {
                if (callBack) callBack();
            }
        } else {
            if (callBack) callBack();
        }
    }

	/**
	   * Add a record of the previous row data to the history system.
	   *
	   * @param {number} tableID
	   * @param {DBRow} rowData
	   * @param {number} transactionID
	   * @param {(rowID: number) => void} complete
	   *
	   * @memberof _NanoSQL_Storage
	   */
    public _addHistoryRow(
        tableID: number,
        rowData: DBRow,
        transactionID: number,
        complete: (rowID: number) => void
    ) {
        let t = this;
        const table = t._tables[tableID];
        const histTableName = "_" + table._name + "_hist__data";
        const histTable = t._tables[NanoSQLInstance._hash(histTableName)];
        rowData = _assign(rowData);
        let pk = (histTable._index[histTable._index.length - 1] as number) + 1;
        histTable._index.push(pk);
        rowData[_str(4)] = pk;
        t._upsert(
            histTableName,
            pk,
            rowData,
            () => {
                complete(pk);
            },
            transactionID
        );
    }

	/**
	   * Add a new history record to the system.
	   *
	   * @param {number} tableID
	   * @param {any[]} updatedPKs
	   * @param {() => void} complete
	   * @returns
	   *
	   * @memberof _NanoSQL_Storage
	   */
    public _addHistoryPoint(
        tableID: number,
        updatedPKs: any[],
        describe: string,
        complete: () => void
    ) {
        let t = this;

        if (!t._doHistory) {
            complete();
            return;
        }

        const makeRecord = () => {
            t._utility("w", "historyLength", t._historyLength);
            t._utility("w", "historyPoint", t._historyPoint);

            const histPoint = t._historyLength - t._historyPoint;

            t._upsert(
                _str(1),
                null,
                {
                    historyPoint: histPoint,
                    tableID: tableID,
                    rowKeys: updatedPKs,
                    type: describe
                },
                rowID => {
                    // Sync memory cache
                    if (!t._historyPointIndex[histPoint]) {
                        t._historyPointIndex[histPoint] = [];
                    }
                    t._historyPointIndex[histPoint].push(rowID as number);
                    complete();
                }
            );
        };

        if (t._historyPoint === 0) {
            // just append to history, nothing special
            t._historyLength++;
            makeRecord();
        } else if (t._historyPoint > 0) {
            // remove history in front of this, then append
            let histPoints: number[] = [];
            let k = 0,
                j = 0;
            let startIndex = t._historyLength - t._historyPoint + 1;
            while (t._historyPointIndex[startIndex]) {
                histPoints = histPoints.concat(t._historyPointIndex[startIndex].slice());
                delete t._historyPointIndex[startIndex]; // Update index
                startIndex++;
            }
            t._readArray(_str(1), histPoints, (historyPoints: IHistoryPoint[]) => {
                NanoSQLInstance.chain(
                    historyPoints.map(histPoint => {
                        return nextHistPoint => {
                            let tableName = t._tables[histPoint.tableID]._name;
                            NanoSQLInstance.chain(
                                histPoint.rowKeys.map(rowKey => {
                                    return nextRowKey => {
                                        // Set this row history pointer to 0;
                                        t._read("_" + tableName + "_hist__meta", rowKey, rows => {
                                            rows[0] = _assign(rows[0]);
                                            rows[0][_str(2)] = 0;
                                            let del = rows[0][_str(3)].shift(); // Shift off the most recent update
                                            t._upsert(
                                                "_" + tableName + "_hist__meta",
                                                rowKey,
                                                rows[0],
                                                () => {
                                                    if (del) {
                                                        t._delete(
                                                            "_" + tableName + "_hist__data",
                                                            del,
                                                            () => {
                                                                k++;
                                                                nextRowKey();
                                                            }
                                                        );
                                                    } else {
                                                        k++;
                                                        nextRowKey();
                                                    }
                                                }
                                            );
                                        });
                                    };
                                })
                            )(() => {
                                t._delete(_str(1), histPoint.id, nextHistPoint);
                            });
                        };
                    })
                )(() => {
                    t._historyLength -= t._historyPoint;
                    t._historyLength++;
                    t._historyPoint = 0;
                    makeRecord();
                });
            });
        }
    }

	/**
	   * Generate a row ID given the type of ID needed and the row incriment value.
	   *
	   * @param {string} type
	   * @param {number} tableIncriment
	   * @returns
	   *
	   * @memberof _NanoSQL_Storage
	   */
    public _generateID(type: string, tableHash: number) {
        switch (type) {
            case "int":
                return this._tables[tableHash]._incriment++;
            case "uuid":
                return NanoSQLInstance.uuid();
            case "timeId":
                return NanoSQLInstance.timeid();
            case "timeIdms":
                return NanoSQLInstance.timeid(true);
        }
        return "";
    }

	/**
	   * Inserts data into the store.
	   *
	   * @param {string} tableName
	   * @param {(string|number|null)} rowID
	   * @param {*} value
	   * @param {((rowID: number|string) => void)} [callBack]
	   * @returns {void}
	   *
	   * @memberOf _NanoSQL_Storage
	   */
    public _upsert(
        tableName: string,
        rowID: string | number | null,
        rowData: any,
        callBack?: (rowID: number | string) => void,
        transactionID?: number
    ): void {
        let t = this;
        rowData = _assign(rowData);
        const ta = NanoSQLInstance._hash(tableName);
        const pk = t._tables[ta]._pk;

        if (tableName.indexOf("_hist__data") !== -1 && rowData) {
            rowID = rowData[_str(4)];
        } else {
            if (rowID === undefined || rowID === null) {
                t._models[ta].forEach(m => {
                    if (m.props && m.props.indexOf("pk") !== -1) {
                        rowID = t._generateID(m.type, ta);
                    }
                });

                if (!rowID)
                    rowID =
                        parseInt(
                            (t._tables[ta]._index[
                                t._tables[ta]._index.length - 1
                            ] as string) || "0"
                        ) + 1;
            }

            if (pk && pk.length && rowData && rowData[pk] === undefined) {
                rowData[pk] = rowID;
            }
        }

        rowID = rowID !== undefined && rowID !== null ? rowID : -1;

        // add to index
        if (!t._tables[ta]._trieIndex.getPrefix(String(rowID)).length) {
            t._tables[ta]._trieIndex.addWord(String(rowID));
            t._tables[ta]._index.push(rowID);
        }

        if (transactionID) {
            if (!t._transactionData[transactionID])
                t._transactionData[transactionID] = {};
            if (!t._transactionData[transactionID][tableName]) {
                t._transactionData[transactionID][tableName] = [];
            }

            t._transactionData[transactionID][tableName].push({
                type: tableName.indexOf("_hist__data") !== -1
                    ? "put"
                    : !rowData ? "del" : "put",
                key: rowID,
                value: rowData ? JSON.stringify(rowData) : "" // for LevelDB
            });
        }

        if (t._storeMemory) {
            t._tables[ta]._rows[rowID] = t._parent._deepFreeze(rowData, ta);
            if (t._mode === 0 && callBack) return callBack(rowID);
        }

        switch (t._mode) {
            case 1: // IndexedDB
                const transaction = t._indexedDB.transaction(tableName, "readwrite");
                const store = transaction.objectStore(tableName);
                if (pk.length && rowData) {
                    store.put(rowData);
                } else {
                    if (tableName.indexOf("_hist__data") !== -1) {
                        store.put(rowData, rowID);
                    } else {
                        if (rowData) store.put(rowData);
                        if (!rowData) store.delete(rowID);
                    }
                }
                transaction.oncomplete = function () {
                    if (callBack) callBack(rowID as string);
                };
                break;
            case 2: // Local Storage
                localStorage.setItem(
                    tableName + "-" + String(rowID),
                    rowData ? JSON.stringify(rowData) : ""
                );
                localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                if (callBack) callBack(rowID as string);
                break;
            /* NODE-START */
            case 4: // Level Up
                if (transactionID) {
                    if (callBack) callBack(rowID as string);
                } else {
                    if (tableName.indexOf("_hist__data") !== -1) {
                        t._levelDBs[tableName].put(
                            rowID,
                            rowData ? JSON.stringify(rowData) : null,
                            () => {
                                if (callBack) callBack(rowID as string);
                            }
                        );
                    } else {
                        if (rowData) {
                            t._levelDBs[tableName].put(rowID, JSON.stringify(rowData), () => {
                                if (callBack) callBack(rowID as string);
                            });
                        } else {
                            t._levelDBs[tableName].del(rowID, () => {
                                if (callBack) callBack(rowID as string);
                            });
                        }
                    }
                }

                break;
            /* NODE-END */
        }
    }

	/**
	   * This method is used to convert a set of primary keys read from a secondary index into the actual row data.
	   *
	   * @private
	   * @param {string} tableName
	   * @param {DBRow[]} rows
	   * @param {(rows: DBRow[]) => void} callBack
	   * @param {boolean} [getIndex]
	   *
	   * @memberOf _NanoSQL_Storage
	   */
    private _indexRead(
        tableName: string,
        rows: DBRow[],
        callBack: (rows: DBRow[]) => void,
        getIndex?: boolean
    ): void {
        const isSecondIndex =
            tableName.indexOf("_") === 0 && tableName.indexOf("_idx_") !== -1;

        if (!isSecondIndex || getIndex) {
            callBack(rows);
        } else {
            const parentTable = !isSecondIndex
                ? ""
                : tableName.slice(1, tableName.indexOf("_idx_"));

            const allRowIDs = rows.reduce((prev, cur) => {
                return prev.concat(cur.rowPK);
            }, []);

            let resultRows: DBRow[] = [];
            let ptr = 0;
            const step = () => {
                if (ptr < allRowIDs.length) {
                    this._read(parentTable, allRowIDs[ptr], rows => {
                        resultRows = resultRows.concat(rows);
                        ptr++;
                        step();
                    });
                } else {
                    callBack(resultRows);
                }
            };
            step();
        }
    }

	/**
	   * Read an array of rows from a given database by an array of primary keys.
	   *
	   * @param {string} tableName
	   * @param {any[]} pkArray
	   * @param {(rows: DBRow[]) => void} callBack
	   *
	   * @memberOf _NanoSQL_Storage
	   */
    public _readArray(
        tableName: string,
        pkArray: any[],
        callBack: (rows: DBRow[]) => void
    ) {
        let rows: any[] = [];
        let ptr = 0;
        const readRow = () => {
            if (ptr < pkArray.length) {
                this._read(tableName, pkArray[ptr], (newRows: any[]) => {
                    rows = rows.concat(newRows);
                    ptr++;
                    readRow();
                });
            } else {
                callBack(rows);
            }
        };
        readRow();
    }

	/**
	   * IndexedDB and LevelDB both have optimizations for reading a range of primary keys,
	   * this method takes advantage of those optimizations.
	   *
	   * @param {string} tableName
	   * @param {string} key
	   * @param {any[]} between
	   * @param {(rows: DBRow[]) => void} callBack
	   * @returns {void}
	   *
	   * @memberOf _NanoSQL_Storage
	   */
    public _readRange(
        tableName: string,
        key: string,
        between: any[],
        callBack: (rows: DBRow[]) => void
    ): void {
        let t = this;
        const ta = NanoSQLInstance._hash(tableName);
        // Memory and local storage can't be range optimized in the same way.
        if (t._mode === 0 || t._mode === 2) {
            let startPtr = t._tables[ta]._index.indexOf(between[0]);
            let resultRows: DBRow[] = [];

            if (startPtr === -1) {
                callBack(resultRows);
                return;
            }

            const stepRead = () => {
                let pk = t._tables[ta]._index[startPtr];
                if (!pk) {
                    callBack(resultRows);
                    return;
                }
                if (pk <= between[1]) {
                    t._read(tableName, pk, rows => {
                        resultRows = resultRows.concat(rows);
                        startPtr++;
                        stepRead();
                    });
                } else {
                    callBack(resultRows);
                }
            };
            stepRead();
            return;
        }

        let rows: any[] = [];

        // Let other folks do the hard work for us.
        switch (t._mode) {
            case 1: // IndexedDB
                const transaction = t._indexedDB.transaction(tableName, "readonly");
                const store = transaction.objectStore(tableName);
                let cursorRequest = store.openCursor(
                    IDBKeyRange.bound(between[0], between[1])
                );
                transaction.oncomplete = () => {
                    this._indexRead(tableName, rows, callBack);
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
                t._levelDBs[tableName]
                    .createValueStream({
                        gte: between[0],
                        lte: between[1]
                    })
                    .on("data", data => {
                        if (data) rows.push(JSON.parse(data));
                    })
                    .on("end", () => {
                        this._indexRead(tableName, rows, callBack);
                    });
                break;
            /* NODE-END */
        }
    }

	/**
	   * Simple read from the database store.
	   *
	   * You can either pass in a primary key or a function for the row.  If a function is passed in,
	   * that function is called for every row to allow filtering.
	   * You can also pass in the string "all" to just read every row.
	   *
	   * @param {string} tableName
	   * @param {(string|number|Function)} row
	   * @param {(rows: any[]) => void} callBack
	   * @param {boolean} [readIndex]
	   *
	   * @memberOf _NanoSQL_Storage
	   */
    public _read(
        tableName: string,
        row: string | number | Function,
        callBack: (rows: any[]) => void,
        readIndex?: boolean
    ): void {
        let t = this;
        const ta = NanoSQLInstance._hash(tableName);

        // Perfer read from memory
        if (t._storeMemory) {
            let rows = t._tables[ta]._rows;
            if (row === "all" || typeof row === "function") {
                let allRows = Object.keys(rows).map(r => rows[r]);
                if (row === "all") {
                    t._indexRead(
                        tableName,
                        allRows.filter(r => r) as DBRow[],
                        callBack,
                        readIndex
                    );
                } else {
                    t._indexRead(
                        tableName,
                        allRows.filter(r => row(r)) as DBRow[],
                        callBack,
                        readIndex
                    );
                }
            } else {
                t._indexRead(
                    tableName,
                    [rows[row]].filter(r => r) as DBRow[],
                    callBack,
                    readIndex
                );
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
                        this._indexRead(tableName, rows, callBack, readIndex);
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
                    singleReq.onsuccess = event => {
                        this._indexRead(tableName, [singleReq.result], callBack, readIndex);
                    };
                }
                break;
            case 2: // Local Storage
                if (row === "all" || typeof row === "function") {
                    let rows = t._tables[ta]._index.map(idx => {
                        let item = localStorage.getItem(tableName + "-" + idx);
                        return item && item.length ? JSON.parse(item) : null;
                    });
                    if (row !== "all") {
                        this._indexRead(
                            tableName,
                            rows.filter(r => row(r)),
                            callBack,
                            readIndex
                        );
                    } else {
                        this._indexRead(tableName, rows, callBack, readIndex);
                    }
                } else {
                    let item = localStorage.getItem(tableName + "-" + row);
                    this._indexRead(
                        tableName,
                        [item && item.length ? JSON.parse(item) : null],
                        callBack,
                        readIndex
                    );
                }
                break;

            /* NODE-START */
            case 4: // Level Up
                if (row === "all" || typeof row === "function") {
                    let rows: any[] = [];
                    t._levelDBs[tableName]
                        .createValueStream()
                        .on("data", data => {
                            if (data) rows.push(JSON.parse(data));
                        })
                        .on("end", () => {
                            if (row !== "all") {
                                this._indexRead(
                                    tableName,
                                    rows.filter(r => row(r)),
                                    callBack,
                                    readIndex
                                );
                            } else {
                                this._indexRead(tableName, rows, callBack, readIndex);
                            }
                        });
                } else {
                    t._levelDBs[tableName].get(row, (err, data) => {
                        if (err) {
                            this._indexRead(tableName, [], callBack, readIndex);
                        } else {
                            this._indexRead(
                                tableName,
                                [JSON.parse(data)],
                                callBack,
                                readIndex
                            );
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
    public _utility(type: "r" | "w", key: string, value?: any): any {
        let t = this;
        if (type === "r") {
            // Read
            if (t._utilityTable[key]) {
                return t._utilityTable[key].value;
            } else {
                return null;
            }
        } else {
            // Write
            t._upsert(_str(0), key, { key: key, value: value });
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
            _relations: [],
            _defaults: [],
            _secondaryIndexes: [],
            _trieColumns: [],
            _trieObjects: {},
            _name: tableName,
            _incriment: 1,
            _index: [],
            _trieIndex: new Trie([]),
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

            // Check for primary key
            if (p.props && p.props.indexOf("pk") >= 0) {
                t._tables[ta]._pk = p.key;
                t._tables[ta]._pkType = p.type;
            }

            // Check for secondary indexes
            if (
                p.props &&
                (p.props.indexOf("idx") >= 0 || p.props.indexOf("trie") >= 0)
            ) {
                t._tables[ta]._secondaryIndexes.push(p.key);
            }

            // Check for trie indexes
            if (p.props && p.props.indexOf("trie") >= 0) {
                t._tables[ta]._trieColumns.push(p.key);
                t._tables[ta]._trieObjects[p.key] = new Trie([]);
            }

            // Check for relations
            if (
                p.props &&
                t._parent._parent._tableNames.indexOf(p.type.replace("[]", "")) !== -1
            ) {
                let mapTo = "";
                p.props.forEach(p => {
                    if (p.indexOf("ref=>") !== -1) mapTo = p.replace("ref=>", "");
                });
                t._tables[ta]._relations.push({
                    _table: p.type.replace("[]", ""),
                    _key: p.key,
                    _mapTo: mapTo,
                    _type: p.type.indexOf("[]") === -1 ? "single" : "array"
                });
            }
        }

        return tableName;
    }
}
