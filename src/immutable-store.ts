import { NanoSQLInstance, _assign, NanoSQLBackend, ActionOrView, QueryLine, DBRow, DataModel, StdObject, DBConnect, DBExec, JoinArgs, DBFunction } from "./index";
import { Promise } from "lie-ts";

/* NODE-START */

import levelup = require("levelup");
import leveldown = require("leveldown");
import fs = require("fs");

/* NODE-END */

/**
 * Min/Max function for database
 *
 * @internal
 * @param {number} type
 * @param {DBRow} row
 * @param {string[]} args
 * @param {number[]} ptr
 * @param {*} prev
 * @returns
 */
const minMax = (type: number, row: DBRow, args: string[], ptr: number[], prev: any) => {
    const key = args[0];
    if (ptr[0] === 0) prev[key] = type === -1 ? Number.MAX_VALUE : Number.MIN_VALUE;
    let nextRow = {};
    if (type === -1 ? parseFloat(row[key]) < parseFloat(prev[key]) : parseFloat(row[key]) > parseFloat(prev[key])) {
        nextRow = row;
    } else {
        nextRow = prev;
    }
    if (ptr[0] === ptr[1]) { // last row
        let r = _assign(nextRow);
        r[type === -1 ? "MIN" : "MAX"] = nextRow[key];
        return r;
    } else {
        return nextRow;
    }
};

/**
 * @internal
 */
let _functions: {
    [key: string]: DBFunction
} = {
    SUM: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: number) => {
            if (ptr[0] === 0) prev = 0;
            prev += parseInt(row[args[0]]);
            if (ptr[0] === ptr[1]) {
                let r = _assign(row);
                r.SUM = prev;
                return r;
            } else {
                return prev;
            }
        }
    },
    MIN: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: any) => {
            return minMax(-1, row, args, ptr, prev);
        }
    },
    MAX: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: any) => {
            return minMax(1, row, args, ptr, prev);
        }
    },
    AVG: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: number) => {
            if (ptr[0] === 0) prev = 0;
            prev += parseInt(row[args[0]]);
            if (ptr[0] === ptr[1]) {
                let r = _assign(row);
                r.AVG = (prev / (ptr[1] + 1)) || prev;
                return r;
            } else {
                return prev;
            }
        }
    },
    COUNT: {
        type: "aggregate",
        call: (row: DBRow, args: string[], ptr: number[], prev: number) => {
            if (ptr[0] === 0) prev = 0;

            if (args[0] === "*") {
                prev++;
            } else {
                prev += row[args[0]] ? 1 : 0;
            }

            if (ptr[0] === ptr[1]) {
                let r = _assign(row);
                r.COUNT = prev;
                return r;
            } else {
                return prev;
            }
        }
    }
};

/**
 * The main class for the immutable database, holds the indexes, data and primary methods.
 *
 * A majority of data moving around for select statements and the like is indexes, not the actual data.
 *
 * @export
 * @class _NanoSQLImmuDB
 * @implements {NanoSQLBackend}
 */
// tslint:disable-next-line
export class _NanoSQLImmuDB implements NanoSQLBackend {

    /**
     * Unique database hash ID based on the data model.
     *
     * @internal
     * @type {number}
     * @memberOf _NanoSQLImmuDB
     */
    public _databaseID: number;

    /**
     * An array holding any queries that should be executed after the current one.
     *
     * @internal
     * @type {Array<DBExec>}
     * @memberOf _NanoSQLImmuDB
     */
    private _pendingQuerys: Array<DBExec>;

    /**
     * The NanoSQL instance this database is attached to.
     *
     * @internal
     * @type {NanoSQLInstance}
     * @memberOf _NanoSQLImmuDB
     */
    public _parent: NanoSQLInstance;

    /**
     * A hash of the current table name.
     *
     * @internal
     * @type {number}
     * @memberOf _NanoSQLImmuDB
     */
    public _selectedTable: number;

    /**
     * A query hash split up by tables.
     *
     * @internal
     * @type {{
     *         [tableID: number]: {
     *             [queryHash: number]: Array<DBRow>
     *         }
     *     }}
     * @memberOf _NanoSQLImmuDB
     */
    public _queryCache: {
        [tableID: number]: {
            [queryHash: number]: Array<DBRow>
        }
    };

    /**
     * Holds the database data.
     *
     * @type {_NanoSQL_Storage}
     * @memberOf _NanoSQLImmuDB
     */
    public _store: _NanoSQL_Storage;

    constructor() {
        let t = this;
        t._pendingQuerys = [];
        t._queryCache = {};
    }


    /**
     * Called once to init the database, prep all the needed variables and data models
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf _NanoSQLImmuDB
     */
    public _connect(connectArgs: DBConnect): void {
        let t = this;
        t._databaseID = NanoSQLInstance._hash(JSON.stringify(connectArgs._models));
        t._parent = connectArgs._parent;
        t._store = new _NanoSQL_Storage(t, connectArgs);
    }

    /**
     * Called by NanoSQL to execute queries on this database.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf _NanoSQLImmuDB
     */
    public _exec(execArgs: DBExec): void {
        let t = this;

        if (t._pendingQuerys.length) {
            t._pendingQuerys.push(execArgs);
        } else {
            t._selectedTable = NanoSQLInstance._hash(execArgs._table);
            new _NanoSQLQuery(t)._doQuery(execArgs, (query) => {
                if (t._pendingQuerys.length) {
                    t._exec(<any> t._pendingQuerys.pop());
                }
            });
        }
    }

    /**
     * Invalidate the query cache based on the rows being affected
     *
     * @internal
     * @param {boolean} triggerChange
     *
     * @memberOf _NanoSQLImmuDB
     */
    public _invalidateCache(changedTableID: number, changedRows: DBRow[], type: string, action?: string): void {
        let t = this;

        t._queryCache[t._selectedTable] = {};

        if (changedRows.length && action) {
            t._parent.triggerEvent({
                name: "change",
                actionOrView: "",
                table: t._store._tables[changedTableID]._name,
                query: [],
                time: new Date().getTime(),
                result: [{msg: action + " was performed.", type: action}],
                changedRows: changedRows,
                changeType: type
            }, ["change"]);
        }
    }

    /**
     * Recursively freezes a js object, used to prevent the rows from being edited once they're added.
     *
     * @internal
     * @param {*} obj
     * @returns {*}
     *
     * @memberOf _NanoSQLQuery
     */
    public _deepFreeze(obj: any): any {
        if (!obj) return obj;
        let t = this;
        t._store._models[t._selectedTable].forEach((model) => {
            let prop = obj[model.key];
            if (["map", "array"].indexOf(typeof prop) >= 0) {
                obj[model.key] = t._deepFreeze(prop);
            }
        });
        return Object.freeze(obj);
    }

    public _transaction(type: "start"|"end") {
        if (type === "start") this._store._doingTransaction = true;
        if (type === "end") this._store._doingTransaction = false;
        return !!this._store._doingTransaction;
    }

    /**
     * Undo & Redo logic.
     *
     * ### Undo
     * Reverse the state of the database by one step into the past.
     * Usage: `NanoSQL().extend("<")`;
     *
     * ### Redo
     * Step the database state forward by one.
     * Usage: `NanoSQL().extend(">")`;
     *
     * ### Query
     * Discover the state of the history system
     * ```ts
     * NanoSQL().extend("?").then(function(state) {
     *  console.log(state[0]) // <= length of history records
     *  console.log(state[1]) // <= current history pointer position
     * });
     * ```
     *
     * The history point is zero by default, perforing undo shifts the pointer backward while redo shifts it forward.
     *
     * @param {NanoSQLInstance} db
     * @param {("<"|">"|"?")} command
     * @returns {Promise<any>}
     *
     * @memberOf _NanoSQLImmuDB
     */
    public _extend(db: NanoSQLInstance, command: string): Promise<any> {

        let t = this;
        let i;
        let h;
        let j;
        let rowID;
        let rowData;
        let rowKey;
        let store: IDBObjectStore;
        const shiftRowIDs = (direction: number, callBack: (info: {[tableID: number]: {rows: DBRow[], type: string}}) => void): void  => {
            let results = {};
            let check = (t._store._historyLength - t._store._historyPoint);

            t._store._read("_historyPoints", (row: IHistoryPoint) => {
                return row.historyPoint === check;
            }, (hps: IHistoryPoint[]) => {
                j = 0;
                const nextPoint = () => {
                    if (j < hps.length) {
                        i = 0;
                        let tableID: number = hps[j].tableID;
                        let table = t._store._tables[tableID];
                        let rows: DBRow[] = [];

                        const nextRow = () => {
                            if (i < hps[j].rowKeys.length) {

                                rowID = hps[j].rowKeys[i];
                                if (table._pkType === "int") rowID = parseInt(rowID);

                                t._store._read(table._name, rowID, (rowData) => {

                                    if (direction > 0) rows.push(rowData[0]); // Get current row data befoe shifting to a different row

                                    // Shift the row pointer
                                    t._store._read("_" + table._name + "_hist__meta", rowID, (row) => {
                                        row = _assign(row);
                                        row[0]._pointer += direction;
                                        const historyRowID = row[0]._historyDataRowIDs[row[0]._pointer];
                                        t._store._upsert("_" + table._name + "_hist__meta", rowID, row[0], () => { // Update row pointer
                                            t._store._read("_" + table._name + "_hist__data", historyRowID, (row) => { // Now getting the new row data
                                                let newRow = row[0] ? _assign(row[0]) : null;
                                                t._store._upsert(table._name, rowID, newRow, () => { // Overwriting row data
                                                    if (direction < 0) rows.push(newRow);
                                                    if (!results[tableID]) results[tableID] = {type: hps[j].type, rows: []};
                                                    results[tableID].rows = results[tableID].rows.concat(rows);
                                                    i++;
                                                    nextRow();
                                                });
                                            });
                                        });
                                    });
                                });
                            } else {
                                j++;
                                nextPoint();
                            }
                        };
                        nextRow();
                    } else {
                        callBack(results);
                    }
                };
                nextPoint();
            });

        };

        return new Promise((res, rej) => {

            switch (command) {
                case "<":
                    if (!t._store._historyLength || t._store._historyPoint === t._store._historyLength) { // end of history
                        res(false);
                    } else {
                        shiftRowIDs(1, (affectedTables) => {
                            t._store._historyPoint++;
                            t._store._utility("w", "historyPoint", t._store._historyPoint);
                            Object.keys(affectedTables).forEach((tableID) => {
                                let description = affectedTables[tableID].type;
                                switch (description) {
                                    case "inserted":
                                        description = "deleted";
                                        break;
                                    case "deleted":
                                        description = "inserted";
                                        break;
                                }
                                t._invalidateCache(parseInt(tableID), affectedTables[tableID].rows, description, "undo");
                            });
                            res(true);
                        });
                    }
                break;
                case ">":
                    if (!t._store._historyLength || t._store._historyPoint < 1) { // beginning of history
                        res(false);
                    } else {
                        t._store._historyPoint--;
                        t._store._utility("w", "historyPoint", t._store._historyPoint);
                        shiftRowIDs(-1, (affectedTables) => {
                            Object.keys(affectedTables).forEach((tableID) => {
                                t._invalidateCache(parseInt(tableID), affectedTables[tableID].rows, affectedTables[tableID].type, "redo");
                            });
                            res(true);
                        });
                    }
                break;
                case "?":
                    h = [t._store._historyLength, t._store._historyLength - t._store._historyPoint];
                    if (t._store._historyArray.join("+") !== h.join("+")) {
                        t._store._historyArray = h;
                    }
                    res(t._store._historyArray);
                break;
                case "flush_db":
                    Object.keys(t._store._tables).forEach((tableID) => {
                        let rows = t._store._tables[parseInt(tableID)]._rows;
                        t._invalidateCache(parseInt(tableID), Object.keys(rows).map(r => rows[r]) as DBRow[], "remove", "clear");
                    });
                    t._store._clearAll(res);
                break;
                case "flush_history":
                    t._store._clearHistory(res);
                break;
            }
        });
    }

}

interface IHistoryPoint {
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

    public _parent: _NanoSQLImmuDB;

    /**
     * Stores a row index for each table.
     *
     * @internal
     * @type {{
     *         [tableHash: number]: Array<DataModel>;
     *     }}
     * @memberOf _NanoSQLImmuDB
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
            _index: string[];
            _keys: string[];
            _defaults: any[];
            _rows: {
                [key: string]: DBRow|null
            }
        }
    };


    /**
     * Mirror of active tables, contains all the row modifications
     *
     * @type {{
     *         [tableHash: number]}
     * @memberOf _NanoSQLImmuDB
     */
/*    public _historyDataTables: {
        [tableHash: number]: (DBRow|null)[]
    };*/

    /**
     * Need to store an auto incriment style counter for history data tables.
     *
     * @type {{
     *         [tableHash: number]: number;
     *     }}
     * @memberOf _NanoSQL_Storage
     */
/*    public _historyDataTableLengths: {
        [tableHash: number]: number;
    };*/

    /**
     * Contains the records needed to keep track of and adjust the row histories.
     *
     * Only used if the memory database is enabled.
     *
     * @type {{
     *         [tableHash: number]: {
     *             [rowKey: string]: {
     *                 _pointer: number,
     *                 _historyDataRowIDs: number[]
     *             }
     *         }
     *     }}
     * @memberOf _NanoSQLImmuDB
     */
/*    public _historyMetaTables: {
        [tableHash: number]: {
            [rowKey: string]: {
                _pointer: number,
                _historyDataRowIDs: number[]
            }
        }
    };*/


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
     * @memberOf _NanoSQLImmuDB
     */
    public _historyPoint: number;

    /**
     * Keeps track of how many total history points we have
     *
     * @type {number}
     * @memberOf _NanoSQLImmuDB
     */
    public _historyLength: number;

    /**
     * A variable to hold the state of the history pointer and history length
     *
     * @internal
     * @type {Array<number>}
     * @memberOf _NanoSQLImmuDB
     */
    public _historyArray: Array<number>;

    /**
     * Flag to indicate the state of transactions
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    public _doingTransaction: boolean;

    /**
     * Wether to enable the persistent storage system or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    public _persistent: boolean;

    /**
     * Flag to store wether history is enabled or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    public _doHistory: boolean;

    /**
     * Flag to store wether tables are stored in memory or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
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
     * WebSQL database object.
     *
     * @type {Database}
     * @memberOf _NanoSQL_Storage
     */
    public _webSQL: Database;

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
    }

    constructor(database: _NanoSQLImmuDB, args: DBConnect) {
        this._savedArgs = args;
        this.init(database, args);
    }

    /**
     * Setup persistent storage engine and import any existing data into memory.
     *
     * @static
     * @param {_NanoSQLImmuDB} database
     * @param {DBConnect} args
     * @returns {boolean}
     *
     * @memberOf _NanoSQL_Persistent
     */
    public init(database: _NanoSQLImmuDB, args: DBConnect) {
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
            args._models["_" + t + "_hist__data"] = _assign(args._models[t]);
            args._models["_" + t + "_hist__data"] = args._models["_" + t + "_hist__data"].map((m) => {
                delete m.props;
                return m;
            });
            // args._models["_" + t + "_hist__data"].unshift({key: "__id", type: "int", props:["ai", "pk"]});
            args._models["_" + t + "_hist__meta"] = [
                {key: "id", type: "int", props: ["ai", "pk"]},
                {key: "_pointer", type: "int"},
                {key: "_historyDataRowIDs", type: "array"},
            ];
        });

        args._models["_utility"] = [
            {key: "key", type: "string", props: ["pk"]},
            {key: "value", type: "blob"},
        ];

        args._models["_historyPoints"] = [
            {key: "id", type: "int", props: ["ai", "pk"]},
            {key: "tableID", type: "int"},
            {key: "historyPoint", type: "int"},
            {key: "rowKeys", type: "array"},
            {key: "type", type: "string"}
        ];

        let tables = Object.keys(args._models);

        let beforeHist;
        let beforeSel = t._parent._selectedTable;
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
                t._read("_utility", "all", (rows) => {
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
                            t._parent._selectedTable = NanoSQLInstance._hash(tables[i]);
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
                        t._parent._selectedTable = beforeSel;
                        args._onSuccess();
                    }
                };
                step();
            } else {
                t._doHistory = beforeHist;
                t._parent._selectedTable = beforeSel;
                args._onSuccess();
            }
        };

        beforeMode = t._mode;

        /**
         * mode 0: no persistent storage, memory only
         * mode 1: Indexed DB // Preferred, forward compatible browser persistence
         * mode 2: Local Storage // Default fallback
         * mode 3: WebSQL // Safari hates IndexedDB, use this (non standard) fallback for iOS devices and macOS running safari
         * mode 4: Level Up // Used by NodeJS
         */
        if (t._persistent) {
            if (t._mode !== 0) { // Mode has been set by dev, make sure it will work in our current environment.  If not, set mode to 0
                switch (t._mode) {
                    case 1: if (typeof indexedDB === "undefined") t._mode = 0;
                    break;
                    case 2: if (typeof localStorage === "undefined") t._mode = 0;
                    break;
                    // case 3: if (typeof window === "undefined" || typeof window.openDatabase === "undefined") t._mode = 0;
                    case 3: t._mode = 0;
                    break;
                    case 4: if (typeof window !== "undefined") t._mode = 0;
                    break;
                }
            } else { // Auto detect mode
                if (typeof window !== "undefined") {
                    if (typeof localStorage !== "undefined")                t._mode = 2; // Local storage is the fail safe
                    if (typeof indexedDB !== "undefined")                   t._mode = 1; // Use indexedDB instead if it's there
                    // if ((t._iOS() || t._safari()) && window.openDatabase)   t._mode = 3; // On iOS & Safari, use WebSQL instead of indexedDB.
                } else {
                                                                            t._mode = 4; // Use LevelUp in NodeJS if it's there.
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

        switch (beforeMode) {
            case 1: // Indexed DB
                let idb = indexedDB.open(String(t._parent._databaseID), 1);

                // Called only when there is no existing DB, creates the tables and data store.
                idb.onupgradeneeded = (event: any) => {
                    upgrading = true;
                    let db: IDBDatabase = event.target.result;
                    let transaction: IDBTransaction = event.target.transaction;
                    t._indexedDB = db;
                    const next = () => {
                        if (index < tables.length) {
                            let ta = NanoSQLInstance._hash(tables[index]);
                            let config = t._tables[ta]._pk ? { keyPath: t._tables[ta]._pk } : {};
                            db.createObjectStore(t._tables[ta]._name, config); // Standard Tables
                            index++;
                            next();
                        } else {
                            transaction.oncomplete = () => {
                                completeSetup();
                            };
                        }
                    };
                    next();
                };

                // Called once the database is connected and working
                idb.onsuccess = (event: any) => {
                    t._indexedDB = event.target.result;

                    // Called to import existing indexed DB data into the memory store.
                    if (!upgrading) {
                        isNewStore = false;

                        const next = () => {
                            if (index >= tables.length) {
                                completeSetup();
                                return;
                            }

                            // Do not import history tables if history is disabled.
                            if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                index++;
                                next();
                                return;
                            }

                            // Load data from indexed DB into memory store
                            if (index < tables.length) {
                                let ta = NanoSQLInstance._hash(tables[index]);
                                let transaction = t._indexedDB.transaction(tables[index], "readonly");
                                let store = transaction.objectStore(tables[index]);
                                let cursorRequest = store.openCursor();
                                let items: any[] = [];
                                transaction.oncomplete = () => {

                                    if (t._storeMemory) {
                                        if (tables[index].indexOf("_hist__data") !== -1) {
                                            t._tables[ta]._index.push("0");
                                            t._tables[ta]._rows["0"] = null;
                                            t._tables[ta]._incriment++;
                                            t._parent._parent.table(tables[index]).loadJS(items).then(() => {
                                                index++;
                                                next();
                                            });
                                        } else {
                                            t._parent._parent.table(tables[index]).loadJS(items).then(() => {
                                                index++;
                                                next();
                                            });
                                        }
                                    } else {
                                        t._tables[ta]._index = items;
                                        t._tables[ta]._incriment = items.reduce((prev, cur) => {
                                            return Math.max(parseInt(cur), prev);
                                        }, 0) + 1;
                                        index++;
                                        next();
                                    }

                                };

                                cursorRequest.onsuccess = (evt: any) => {
                                    let cursor: IDBCursorWithValue = evt.target.result;
                                    if (cursor) {
                                        items.push(t._storeMemory ? cursor.value : cursor.key);
                                        cursor.continue();
                                    }
                                };

                            }
                        };

                        next();
                    };
                };
            break;
            case 2: // Local Storage
                if (localStorage.getItem("dbID") !== String(t._parent._databaseID)) { // New storage, just set it up
                    localStorage.clear();
                    localStorage.setItem("dbID", String(t._parent._databaseID));
                    tables.forEach((table) => {
                        let ta = NanoSQLInstance._hash(table);
                        localStorage.setItem(table, JSON.stringify([]));
                    });
                    completeSetup();
                } else { // Existing, import data from local storage
                    isNewStore = false;
                    // import indexes no matter what
                    tables.forEach((tName) => {
                        let ta = NanoSQLInstance._hash(tName);
                        let tableIndex = JSON.parse(localStorage.getItem(tName) || "[]");
                        t._tables[ta]._index = tableIndex;

                        if (!t._storeMemory) {
                            t._tables[ta]._incriment = tableIndex.reduce((prev, cur) => {
                                return Math.max(parseInt(cur), prev);
                            }, 0) + 1;
                        }
                    });

                    // only import data if the memory store is enabled
                    if (t._storeMemory) {
                        let tIndex = 0;
                        const step = () => {
                            if (tIndex < tables.length) {
                                let items: any[] = [];

                                // Do not import history tables if history is disabled.
                                if (!beforeHist && (tables[tIndex].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                    tIndex++;
                                    step();
                                    return;
                                }

                                JSON.parse(localStorage.getItem(tables[tIndex]) || "[]").forEach((ptr) => {
                                    items.push(JSON.parse(localStorage.getItem(tables[tIndex] + "-" + ptr) || ""));
                                });
                                t._parent._parent.table(tables[tIndex]).loadJS(items).then(() => {
                                    tIndex++;
                                    step();
                                });
                            } else {
                                completeSetup();
                            }
                        };
                        step();
                    } else {
                        completeSetup();
                    }
                }
            break;
            /*case 3: // WebSQL

                const success = (tx, rows) => {
                    console.log(rows);
                };

                const error = (tx, error): boolean => {
                    console.log(error);
                    return true;
                }

                const ct = "CREATE TABLE IF NOT EXISTS ";
                const newStore = () => {
                    t._webSQL.transaction((tx) => {
                        tx.executeSql(ct + "tableID (id TEXT);", [], success, error);
                        tx.executeSql("INSERT INTO tableID (id) VALUES (?)", [t._parent._databaseID], success, error);
                        tables.forEach((table) => {
                            let ta = NanoSQLInstance._hash(table);
                            tx.executeSql(ct + table + "(" + t._tables[ta]._keys.join(", ") + ");", [], success, error);
                        });
                        completeSetup();
                    });
                };

                const existingTables = () => {
                    isNewStore = false;
                    index = 0;
                    const next = () => {
                        if (index >= tables.length) {
                            completeSetup();
                            return;
                        }

                        // Do not import history tables if history is disabled.
                        if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                            index++;
                            next();
                            return;
                        }

                        // Load data from WebSQL into memory store
                        if (index < tables.length) {
                            let ta = NanoSQLInstance._hash(tables[index]);
                            let pk = t._tables[ta]._pk;
                            t._webSQL.transaction((tx) => {
                                tx.executeSql("SELECT * FROM " + tables[index], [], (tx, result) => {

                                    let items: any[] = [];
                                    let ptr = result.rows.length;

                                    while (ptr--) {
                                        let r = result.rows.item(ptr);
                                        items.unshift(t._storeMemory ? r : r[pk] | ptr);
                                    }

                                    if (t._storeMemory) {
                                        if (tables[index].indexOf("_hist__data") !== -1) {
                                            t._tables[ta]._index.push("0");
                                            t._tables[ta]._rows["0"] = null;
                                            t._tables[ta]._incriment++;
                                            t._parent._parent.table(tables[index]).loadJS(items).then(() => {
                                                index++;
                                                next();
                                            });
                                        } else {
                                            t._parent._parent.table(tables[index]).loadJS(items).then(() => {
                                                index++;
                                                next();
                                            });
                                        }
                                    } else {
                                        t._tables[ta]._index = items;
                                        t._tables[ta]._incriment = items.reduce((prev, cur) => {
                                            return Math.max(parseInt(cur), prev);
                                        }, 0) + 1;
                                        index++;
                                        next();
                                    }
                                });
                            });
                        }
                    };

                    next();
                };

                t._webSQL = window.openDatabase(String(t._parent._databaseID), "1", String(t._parent._databaseID), size * 1024 * 1024);
                t._webSQL.transaction((tx) => {
                    tx.executeSql("SELECT * FROM tableID;", [], (tx, results) => {
                        let dbID = parseInt(results.rows[0].id);
                        if (dbID === t._parent._databaseID) {
                            existingTables();
                        } else {
                            t._webSQLEmpty(newStore);
                        }
                    }, (tx, error): boolean => {
                        newStore();
                        return true;
                    });
                });
            break;*/

            /* NODE-START */
            case 4: // Level Up

                // Called to import existing  data into the memory store.
                const existingStore = () => {

                    isNewStore = false;

                    const next = () => {
                        if (index < tables.length) {

                            // Do not import history tables if history is disabled.
                            if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                index++;
                                next();
                                return;
                            }

                            // Load data from level up into memory store
                            if (index < tables.length) {
                                let ta = NanoSQLInstance._hash(tables[index]);
                                let items: any[] = [];
                                if (t._storeMemory) {
                                    t._levelDBs[tables[index]].createValueStream()
                                    .on("data", (data) => {
                                        items.push(JSON.parse(data));
                                    })
                                    .on("end", () => {
                                        if (tables[index].indexOf("_hist__data") !== -1) {
                                            t._tables[ta]._index.push("0");
                                            t._tables[ta]._rows["0"] = null;
                                            t._tables[ta]._incriment++;
                                            t._parent._parent.table(tables[index]).loadJS(items).then(() => {
                                                index++;
                                                next();
                                            });
                                        } else {
                                            t._parent._parent.table(tables[index]).loadJS(items).then(() => {
                                                index++;
                                                next();
                                            });
                                        }
                                    });
                                } else {
                                    t._levelDBs[tables[index]].createKeyStream()
                                    .on("data", (data) => {
                                        items.push(data);
                                    })
                                    .on("end", () => {
                                        t._tables[ta]._index = items;
                                        t._tables[ta]._incriment = items.reduce((prev, cur) => {
                                            return Math.max(parseInt(cur), prev);
                                        }, 0) + 1;
                                        index++;
                                        next();
                                    });
                                }
                            }
                        } else {
                            completeSetup();
                            return;
                        }

                    };

                    next();
                }

                const dbFolder = "./db_" + t._parent._databaseID;
                let existing = true;
                if (!fs.existsSync(dbFolder)) {
                    fs.mkdirSync(dbFolder);
                    existing = false;
                }

                tables.forEach((table) => {
                    t._levelDBs[table] = levelup(dbFolder + "/" + table);
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
/*
    public _webSQLEmpty(callBack: Function): void {
        this._webSQL.transaction((tx) => {
            tx.executeSql("SELECT name FROM sqlite_master WHERE type = 'table' AND name != '__WebKitDatabaseInfoTable__'", [], (tx, result) => {
                let i = result.rows.length;
                while (i--) {
                    tx.executeSql("DROP TABLE " + result.rows.item(i).name);
                }
                callBack();
            });
        });
    }
*/
    public _clearHistory(complete: Function): void {
        let t = this;

        let tables = Object.keys(t._tables);
        let index = 0;
        const step = () => {
            if (index < tables.length) {
                if (tables[index].indexOf("_hist__meta") !== -1) {

                }

                if (tables[index].indexOf("_hist__data") !== -1) {

                }

                if (tables[index] === "_historyPoints") {

                }
            } else {
                complete();
            }
        };

        step();
    }


    public _delete(tableName: string, rowID: string|number, callBack?: (success: boolean) => void): void {
        let t = this;
        let editingHistory = false;

        const ta = NanoSQLInstance._hash(tableName);
        t._tables[ta]._index.splice(t._tables[ta]._index.indexOf(String(rowID)), 1); // Update Index

        if (t._storeMemory) {
            delete t._tables[ta]._rows[rowID];
            if (t._mode === 0 && callBack) return callBack(true);
        }

        switch (t._mode) {
            case 1: // IndexedDB
                const transaction = t._indexedDB.transaction(tableName, "readwrite").objectStore(tableName);
                transaction.delete(rowID);
                if (callBack) callBack(true);
            break;
            case 2: // Local Storage
                localStorage.removeItem(tableName + "-" + String(rowID));
                localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                if (callBack) callBack(true);
            break;
            /*case 3: // WebSQL
                t._webSQL.transaction((tx) => {
                    let pk = t._tables[ta]._pk;
                    tx.executeSql("DELETE FROM " + tableName + " WHERE " + pk + " = ?", [rowID]);
                });
            break;*/
            /* NODE-START */
            case 4: // Level Up
                t._levelDBs[tableName].del(rowID, () => {
                    if (callBack) callBack(true);
                });
            break;
            /* NODE-END */
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

            if (!rowID) rowID = parseInt(t._tables[ta]._index[t._tables[ta]._index.length - 1] || "0") + 1;
        }

        if (t._tables[ta]._pkType === "int") rowID = parseInt(rowID as string);

        const pk = t._tables[ta]._pk;
        if (pk && pk.length && value && !value[pk]) {
            value[pk] = rowID;
        }

        // Index update
        if (t._tables[ta] && t._tables[ta]._index.indexOf(String(rowID)) === -1) {
            t._tables[ta]._index.push(String(rowID));
        }

        // Memory Store Update
        if (t._storeMemory && t._tables[ta]) {
            t._tables[ta]._rows[rowID] = t._parent._deepFreeze(value);
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
            /*case 3: // WebSQL
                t._webSQL.transaction((tx) => {
                    let pk = t._tables[ta]._pk;
                    let values = t._models[ta].map((val, i) => {
                        if (val.type === "map" || val.type === "array") {
                            return JSON.stringify(value[val.key]);
                        } else {
                            return value ? value[val.key] : null;
                        }
                    });

                    tx.executeSql("SELECT * FROM " + tableName + " WHERE " + (pk.length ? pk : "rowid") + " = ?", [rowID], (txx, result) => {
                        if (!result.rows.length) {
                            tx.executeSql("INSERT INTO '" + tableName + "' (" + t._tables[ta]._keys.join(", ") + ") VALUES (" + t._tables[ta]._keys.map(k => "?").join(", ") + ");", values, () => {
                                if (callBack) callBack(rowID as string);
                            });
                        } else {
                            values.push(rowID);
                            tx.executeSql("UPDATE '" + tableName + "' SET " + t._tables[ta]._keys.map((k) => k + " = ?").join(", ")  + " WHERE " + pk + " = ?", values, () => {
                                if (callBack) callBack(rowID as string);
                            });
                        }
                    });

                });
            break;*/
            /* NODE-START */
            case 4: // Level Up

                if (tableName.indexOf("_hist__data") !== -1) {
                    t._levelDBs[tableName].put(String(rowID), JSON.stringify(value), () => {
                        if (callBack) callBack(rowID as string);
                    });
                } else {
                    if (value) {
                        t._levelDBs[tableName].put(String(rowID), JSON.stringify(value), () => {
                            if (callBack) callBack(rowID as string);
                        });
                    } else {
                        t._levelDBs[tableName].del(String(rowID), () => {
                            if (callBack) callBack(rowID as string);
                        });
                    }
                }


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
            /*case 3: // WebSQL
                const serialize = (row: DBRow) => {
                    row = _assign(row);
                    t._models[ta].forEach((val, i): void => {
                        if (val.type === "map" || val.type === "array") {
                            row[val.key] = JSON.parse(row[val.key]);
                        }
                        if (row[val.key] === "undefined") {
                            row[val.key] = undefined;
                        }
                    });
                    return row;
                }

                t._webSQL.transaction((tx) => {
                    if (row === "all" || typeof row === "function") {
                        tx.executeSql("SELECT * FROM " + tableName, [], (tx, result) => {
                            let rows: any[] = [];
                            let ptr = result.rows.length;
                            while (ptr--) {
                                rows.unshift(serialize(result.rows.item(ptr)));
                            }
                            if (row !== "all") {
                                callBack(rows.filter((r) => row(r)));
                            } else {
                                callBack(rows);
                            }
                        });
                    } else {
                        let pk = t._tables[ta]._pk;
                        tx.executeSql("SELECT * FROM " + tableName + " WHERE " + pk + " = ?", [row], (tx, result) => {
                            let r: any[] = [];
                            if (result.rows.length) {
                                r.push(serialize(result.rows.item(0)));
                            } else {
                                r.push(null);
                            }
                            callBack(r);
                        });
                    }
                });
            break;*/
            /* NODE-START */
            case 4: // Level Up

                if (row === "all" || typeof row === "function") {
                    let rows: any[] = [];
                    t._levelDBs[tableName].createValueStream()
                    .on("data", (data) => {
                        rows.push(JSON.parse(data));
                    })
                    .on("end", () => {
                        if (row !== "all") {
                            callBack(rows.filter((r) => row(r)));
                        } else {
                            callBack(rows);
                        }
                    });
                } else {
                    t._levelDBs[tableName].get(String(row), (err, data) => {
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

    public _clearAll(callBack: Function): void {
        let t = this;
        t._savedArgs._onSuccess = callBack;
        t._savedArgs._onFail = () => {};
        switch (t._mode) {
            case 0:
                t.init(t._parent, t._savedArgs);
            break;
            case 1: // IndexedDB
                indexedDB.deleteDatabase(String(t._parent._databaseID)).onsuccess = function() {
                    t.init(t._parent, t._savedArgs);
                };
            break;
            case 2: // Local Storage
                localStorage.clear();
                t.init(t._parent, t._savedArgs);
            break;
            /*case 3: // WebSQL
                t._webSQLEmpty(() => {
                    t.init(t._parent, t._savedArgs);
                });
            break;*/
            /* NODE-START */
            case 4: // Level Up

            break;
            /* NODE-END */
        }
        if (callBack) callBack(true);
    }


    /**
     * Write or access utility options.
     *
     * @param {("r"|"w")} type
     * @param {string} key
     * @param {*} [value]
     * @returns
     *
     * @memberOf _NanoSQLImmuDB
     */
    public _utility(type: "r"|"w", key: string, value?: any): any {
        if (type === "r") { // Read
            if (this._utilityTable[key]) {
                return this._utilityTable[key].value;
            } else {
                return null;
            }
        } else { // Write
            this._upsert("_utility", key, {key: key, value: value});
            this._utility[key] = {
                key: key,
                value: value
            };
            return value;
        }
    }

    /**
     * Get the current selected table
     *
     * @returns
     *
     * @memberOf _NanoSQL_Storage
     */
    public _getTable() {
        return this._tables[this._parent._selectedTable];
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

    /**
     * User agent sniffing to discover if we're running in Safari
     *
     * @returns
     *
     * @memberOf _NanoSQLImmuDB
     */
    public _safari() {
        return typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }

    /**
     * User agent sniffing to discover if we're on an iOS device.
     *
     * @returns {boolean}
     *
     * @memberOf _NanoSQLImmuDB
     */
    public _iOS(): boolean {

        let iDevices = [
            "iPad",
            "iPhone",
            "iPod"
        ];

        if (typeof navigator !== "undefined" && !!navigator.platform) {
            while (iDevices.length) {
                if (navigator.platform.indexOf(iDevices.pop() as string) !== -1) return true;
            }
        }

        return false;
    }
}


/**
 * Query module called for each database execution to get the desired result on the data.
 *
 * @internal
 * @class _NanoSQLQuery
 */
// tslint:disable-next-line
class _NanoSQLQuery {

    /**
     * The current action being called by the query. Select, Upsert, etc.
     *
     * @internal
     * @type {(QueryLine|undefined)}
     * @memberOf _NanoSQLQuery
     */
    private _act: QueryLine|undefined;

    /**
     * Query modifiers like where, orderby, etc.
     *
     * @internal
     * @type {Array<QueryLine>}
     * @memberOf _NanoSQLQuery
     */
    private _mod: Array<QueryLine>;

    /**
     * A hash of the current query arguments.
     *
     * @internal
     * @type {number}
     * @memberOf _NanoSQLQuery
     */
    private _queryHash: number;

    /**
     * A reference to the parent immutable storage object.
     *
     * @internal
     * @type {_NanoSQLImmuDB}
     * @memberOf _NanoSQLQuery
     */
    private _db: _NanoSQLImmuDB;

    /**
     * Holds a pointer to the joined table for join queries
     *
     * @internal
     * @type {number}
     * @memberOf _NanoSQLQuery
     */
    private _joinTable: number;

    constructor(database: _NanoSQLImmuDB) {
        this._db = database;
    }

    /**
     * Setup the query then call the execution command.
     *
     * @internal
     * @param {DBExec} query
     * @returns {Promise<any>}
     *
     * @memberOf _NanoSQLQuery
     */
    public _doQuery(query: DBExec, callBack: Function): void {
        let t = this;

        t._mod = [];
        t._act = undefined;

        let simpleQuery: QueryLine[] = [];

        query._query.forEach((q) => {
            if (["upsert", "select", "delete", "drop"].indexOf(q.type) >= 0) {
                t._act = q; // Query Action
                if (q.type === "select") t._queryHash = NanoSQLInstance._hash(JSON.stringify(query._query));
            } else if (["show tables", "describe"].indexOf(q.type) >= 0) {
                simpleQuery.push(q);
            } else {
                t._mod.push(q); // Query Modifiers
            }
        });

        if (simpleQuery.length) {
            switch (simpleQuery[0].type) {
                case "show tables":
                    callBack();
                    query._onSuccess([{tables: Object.keys(this._db._store._tables).map((ta) => this._db._store._tables[ta]._name)}], "info", []);
                break;
                case "describe":
                    let getTable;
                    let tableName = this._db._selectedTable;
                    let rows = {};
                    Object.keys(this._db._store._tables).forEach((ta) => {
                        if (parseInt(ta) === this._db._selectedTable) {
                            getTable = _assign(this._db._store._models[ta]);
                            tableName = this._db._store._tables[ta]._name;
                        }
                    });

                    rows[tableName] = getTable;

                    callBack();
                    query._onSuccess([rows], "info", []);
                break;
            }
        } else {
            t._execQuery((result: Array<Object>, changeType: string, affectedRows: DBRow[]) => {
                query._onSuccess(result, changeType, affectedRows);
                callBack(t);
            });
        }
    }

    /**
     * Get a query modifier (where/orderby/etc...)
     *
     * @internal
     * @param {string} name
     * @returns {(QueryLine|undefined)}
     *
     * @memberOf _NanoSQLQuery
     */
    private _getMod(name: string): QueryLine|undefined {
        return this._mod.filter((v) => v.type === name).pop();
    };


    /**
     * Starting query method, sets up initial environment for the query and sets it off.
     *
     * @internal
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     * @returns {void}
     *
     * @memberOf _NanoSQLQuery
     */
    private _execQuery(callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void): void {
        const t = this;
        if (!t._act) return;

        const doQuery = (rows: DBRow[]) => {
            if (!t._act) return;
            switch (t._act.type) {
                case "upsert":
                    this._upsert(rows, callBack);
                break;
                case "select":
                    this._select(rows, callBack);
                break;
                case "drop":
                case "delete":
                    this._remove(rows, callBack);
                break;
            }
        };

        const tableName = this._db._store._tables[t._db._selectedTable]._name;

        if (!t._getMod("join") && t._act.type !== "drop") {
            if (t._getMod("where")) {
                // We can do the where filtering now if there's no join command and we're using a query that might have a where statement
                t._db._store._read(tableName, (row) => {
                    return row && t._where(row, (t._getMod("where") as QueryLine).args);
                }, (rows) => {
                    doQuery(rows);
                });
            } else {
                if (t._act && t._act.type !== "upsert") {
                    t._db._store._read(tableName, "all", (rows) => {
                        doQuery(rows);
                    });
                } else {
                    doQuery([]);
                }
            }
        } else {
            doQuery([]);
        }

    }

    /**
     * Updates a given row with a specific value, also updates the history for that row as needed.
     *
     * @internal
     * @param {string} rowPK
     *
     * @memberOf _NanoSQLQuery
     */
    private _updateRow(rowPK: string, callBack: Function): void {

        const t = this;
        const tableName = t._db._store._getTable()._name;

        t._db._store._read(tableName, rowPK, (rows) => {
            let newRow = {};
            const oldRow = rows[0] || {};

            const qArgs = (t._act as QueryLine).args;
            const updateType = ((): string => {
                if (t._act) {
                    if (t._act.type === "delete" && !qArgs.length) {
                        return "drop";
                    }
                }
                return t._act ? t._act.type : "";
            })();

            let doRemove = false;

            switch (updateType) {
                case "upsert":
                    newRow = oldRow ? _assign(oldRow) : {};
                    /*if(!t._db._doingTransaction) {
                        newRow = oldRow ? _assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                    } else {
                        newRow = oldRow || {};
                    }*/

                    Object.keys(qArgs).forEach((k) => {
                        newRow[k] = qArgs[k];
                    });

                    // Add default values
                    t._db._store._getTable()._keys.forEach((k, i) => {
                        let def = t._db._store._getTable()._defaults[i];
                        if (!newRow[k] && def) newRow[k] = def;
                    });
                break;
                case "delete":
                    newRow = oldRow ? _assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                    if (qArgs && qArgs.length) {
                        qArgs.forEach((column) => {
                            newRow[column] = null;
                        });
                    } else {
                        doRemove = true;
                        newRow = {};
                    }
                break;
            }

            const finishUpdate = () => {
                if (tableName.indexOf("_") !== 0 && t._db._store._doHistory) {
                    t._db._store._read("_" + tableName + "_hist__meta", parseInt(rowPK), (rows) => {
                        rows[0]._historyDataRowIDs.unshift(len);
                        t._db._store._upsert("_" + tableName + "_hist__meta", parseInt(rowPK), rows[0]);
                    });
                }

                // 3. Move new row data into place on the active table
                // Apply changes to the store
                if (updateType === "upsert") {
                    t._db._store._upsert(tableName, rowPK, newRow, () => {
                        callBack();
                    });
                } else {
                    t._db._store._delete(tableName, rowPK, () => {
                        callBack();
                    });
                }
            };

            // Add to history
            let len = 0; // 0 index contains a null reference used by all rows;
            if (!doRemove && tableName.indexOf("_") !== 0 && t._db._store._doHistory) {
                // 1. copy new row data into histoy data table
                t._db._store._upsert("_" + tableName + "_hist__data", null, newRow, (rowID) => {
                    len = parseInt(rowID as string);
                    finishUpdate();
                });
            } else {
                finishUpdate();
            }

        });
    }

    /**
     * Called to finish drop/delete/upsert queries to affect the history and memoization as needed.
     *
     * @internal
     * @param {string[]} updatedRowPKs
     * @param {string} describe
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    private _tableChanged(updatedRowPKs: string[], describe: string, callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void): void {
        let t = this, k = 0, j = 0;

        if (updatedRowPKs.length > 0) {

            const completeChange = () => {

                if (t._db._store._doHistory) {
                    if (!t._db._store._doingTransaction && t._db._store._historyPoint === 0) {
                        t._db._store._historyLength++;
                    }

                    t._db._store._utility("w", "historyLength", t._db._store._historyLength);
                    t._db._store._utility("w", "historyPoint", t._db._store._historyPoint);

                    // Add history records
                    t._db._store._upsert("_historyPoints", null, {
                        historyPoint: t._db._store._historyLength - t._db._store._historyPoint,
                        tableID: t._db._selectedTable,
                        rowKeys: updatedRowPKs.map(r => parseInt(r)),
                        type: describe
                    }, (rowID) => {
                        let table = t._db._store._tables[this._db._selectedTable];
                        t._db._invalidateCache(t._db._selectedTable, [], "");
                        t._db._store._read(table._name, (row) => {
                            return row && updatedRowPKs.indexOf(row[table._pk]) !== -1;
                        }, (rows) => {
                            callBack([{msg: updatedRowPKs.length + " row(s) " + describe}], describe, rows);
                        });

                    });
                } else {
                    let table = t._db._store._tables[this._db._selectedTable];
                    t._db._invalidateCache(t._db._selectedTable, [], "");
                    t._db._store._read(table._name, (row) => {
                        return row && updatedRowPKs.indexOf(row[table._pk]) !== -1;
                    }, (rows) => {
                        callBack([{msg: updatedRowPKs.length + " row(s) " + describe}], describe, rows);
                    });
                }
            };

            if (t._db._store._doHistory) {
                // Remove history points ahead of the current one if the database has changed
                if (t._db._store._historyPoint > 0 && t._db._store._doingTransaction !== true) {

                    t._db._store._read("_historyPoints", (hp: IHistoryPoint) => {
                        if (hp.historyPoint > t._db._store._historyLength - t._db._store._historyPoint) return true;
                        return false;
                    }, (historyPoints: IHistoryPoint[]) => {

                        j = 0;
                        const nextPoint = () => {

                            if (j < historyPoints.length) {
                                let tableName = t._db._store._tables[historyPoints[j].tableID]._name;
                                k = 0;
                                const nextRow = () => {
                                    if (k < historyPoints[j].rowKeys.length) {
                                        // Set this row history pointer to 0;
                                        t._db._store._read("_" + tableName + "_hist__meta", historyPoints[j].rowKeys[k], (rows) => {
                                            rows[0] = _assign(rows[0]);
                                            rows[0]._pointer = 0;
                                            let del = rows[0]._historyDataRowIDs.shift(); // Shift off the most recent update
                                            t._db._store._upsert("_" + tableName + "_hist__meta", historyPoints[j].rowKeys[k], rows[0], () => {
                                                if (del) {
                                                    t._db._store._delete("_" + tableName + "_hist__data", del, () => {
                                                        k++;
                                                        nextRow();
                                                    });
                                                } else {
                                                    k++;
                                                    nextRow();
                                                }
                                            });
                                        });
                                    } else {
                                        j++;
                                        nextPoint();
                                    }
                                };
                                t._db._store._delete("_historyPoints", historyPoints[j].id, () => { // remove this point from history
                                    nextRow();
                                });
                            } else {
                                t._db._store._historyLength -= t._db._store._historyPoint;
                                t._db._store._historyPoint = 0;
                                completeChange();
                                return;
                            }
                        };
                        nextPoint();
                    });

                } else {
                    completeChange();
                }
            } else {
                completeChange();
            }

        } else {
            callBack([{msg: "0 rows " + describe}], describe, []);
        }
    };

    /**
     * Add/modify records to a specific table based on query parameters.
     *
     * @internal
     * @param {DBRow[]} queryRows
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    private _upsert(queryRows: DBRow[], callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void) {
        let t = this;
        let scribe = "", i, changedPKs: string[] = [];

        const qArgs = (t._act as QueryLine).args  || {},
        table = t._db._store._getTable(),
        pk = table._pk,
        whereMod = t._getMod("where");

        if (whereMod) { // Where statement exists or there's no PK, we're inserting data into existing rows
            scribe = "modified";
            changedPKs = queryRows.map((r) => r[table._pk]);
            i = 0;
            const update = () => {
                if (i < queryRows.length) {
                    t._updateRow(queryRows[i][pk], () => {
                        i++;
                        update();
                    });
                } else {
                    t._tableChanged(changedPKs, scribe, callBack);
                }
            };
            update();
        } else { // No where statment, perform upsert
            scribe = "inserted";

            if (!qArgs[pk]) {
                if (table._pkType === "int") {
                    qArgs[pk] = table._incriment++;
                } else if (table._pkType === "uint") {
                    qArgs[pk] = NanoSQLInstance.uuid();
                }
            } else {
                if (table._pkType === "int") {
                    table._incriment = Math.max(qArgs[pk] + 1, table._incriment);
                }
            }

            const objPK = qArgs[pk] ? String(qArgs[pk]) : String(table._index.length);
            changedPKs = [objPK];

            // Entirely new row, setup all the needed stuff for it.
            if (table._index.indexOf(objPK) === -1) {
                // History
                let tableName = this._db._store._tables[t._db._selectedTable]._name;
                if (tableName.indexOf("_") !== 0) {
                    let histTable = "_" + tableName + "_hist__meta";
                    t._db._store._upsert(histTable, objPK, {
                        _pointer: 0,
                        _historyDataRowIDs: [0]
                    });
                }

                // Index
                table._index.push(objPK);
            }

            t._updateRow(objPK, () => {
                t._tableChanged(changedPKs, scribe, callBack);
            });
        }
    }

    /**
     * Get the table ID for query commands, used to intelligently switch between joined tables and the regular ones.
     *
     * @internal
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    private _getTableID() {
        return this._joinTable ? this._joinTable : this._db._selectedTable;
    }

    /**
     * Selects rows from a given table using the query parameters.
     *
     * @internal
     * @param {DBRow[]} queryRows
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    private _select(queryRows: DBRow[], callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void) {

        let t = this;
        // Memoization
        if (t._db._queryCache[t._db._selectedTable][t._queryHash]) {
            callBack(t._db._queryCache[t._db._selectedTable][t._queryHash], "none", []);
            return;
        }

        const mods = ["join", "groupby", "having", "orderby", "offset", "limit"];
        let curMod, column, i, k, rows, obj, rowData, groups = {};
        const sortObj = (objA: DBRow, objB: DBRow, columns: {[key: string]: string}) => {
            return Object.keys(columns).reduce((prev, cur) => {
                if (!prev) {
                    if (objA[cur] === objB[cur]) return 0;
                    return (objA[cur] > objB[cur] ? 1 : -1) * (columns[cur] === "desc" ? -1 : 1);
                } else {
                    return prev;
                }
            }, 0);
        };

        const modifyQuery = (tableIndex: any[], modIndex: number, next: (tableIndex: any[]) => void): void => {

            curMod = t._getMod(mods[modIndex]);

            // After GROUP BY command apply functions and AS statements
            if (modIndex === 2) {
                let functions: {name: string, args: string[], as: string, type: string}[] = [];
                if (qArgs.length) { // Select statement arguments
                    let funcs = Object.keys(_functions).map((f) => f + "(");
                    let keepColumns: any[] = [];
                    functions = qArgs.filter((q) => {
                        let hasFunc = funcs.reduce((prev, cur) => {
                            return (q.indexOf(cur) < 0 ? 0 : 1) + prev;
                        }, 0) || 0;
                        if (hasFunc > 0) {
                            return true;
                        } else {
                            keepColumns.push(q);
                            return false;
                        }
                    }).map((selectString) => {
                        let regex = selectString.match(/(.*)\((.*)\)/);
                        let funcName = regex[1].trim();
                        let columnName = (selectString.match(/\sAS\s(.*)/) || []).pop() || funcName;
                        let args = regex[2].split(",").map(s => s.trim());

                        if (_functions[funcName].type === "simple" && columnName === funcName) {
                            columnName = args[0];
                        }

                        keepColumns.push(columnName);
                        return {
                            name: funcName,
                            args: args,
                            as: columnName.trim(),
                            type: _functions[funcName].type
                        };
                    });

                    let rows: DBRow[] = [];

                    if (functions.length) {

                        let prevFunc;
                        const doFunctions = (rows: DBRow[]): DBRow[] => {
                            return functions.sort((a, b) => {
                                return a.type > b.type ? 1 : -1;
                            }).reduce((prev, curr) => {
                                let len = prev.length - 1;

                                if (curr.type === "aggregate") {
                                    let newRows = rows.slice();
                                    len = newRows.length - 1;
                                    newRows = [newRows.reduce((p, v, i) => {
                                        return _functions[curr.name].call(v, curr.args, [i, len], p);
                                    }, {})];

                                    if (prevFunc) {
                                        newRows[0][prevFunc] = prev[0][prevFunc];
                                    }
                                    prev = newRows;
                                    prevFunc = curr.name;
                                } else {
                                    prev = prev.map((v, i) => {
                                        return _functions[curr.name].call(v, curr.args, [i, len]);
                                    });
                                }

                                if (curr.name !== curr.as) {
                                    keepColumns.push(curr.name + " AS " + curr.as);
                                } else {
                                    keepColumns.push(curr.name);
                                }

                                return prev;
                            }, rows.slice());
                        };

                        let groupKeys: any = Object.keys(groups);
                        if (groupKeys.length) { // Groups Exist
                            rows = groupKeys
                            .map((k) => doFunctions(groups[k])) // Apply each function to each group (N^2)
                            .reduce((prev, curr) => { // Combine the results into a single array
                                return prev = prev.concat(curr), prev;
                            }, []);
                        } else { // No Groups, apply all functions to the rows
                            rows = doFunctions(tableIndex);
                        }
                    } else {
                        rows = tableIndex;
                    }

                    let convertKeys = keepColumns.map((n) => {
                        return n.match(/(.*)\sAS\s(.*)/) || n;
                    }).filter(n => n) || [];

                    if (convertKeys.length) {
                        rows = rows.map((r) => {
                            r = _assign(r);
                            let newRow = {};
                            convertKeys.forEach((key) => {
                                if (typeof key === "string") {
                                    newRow[key] = r[key];
                                } else {
                                    newRow[key[2]] = r[key[1]];
                                }
                            });
                            return newRow;
                        });
                    }

                    tableIndex = rows;
                }
            }

            if (!curMod) return next(tableIndex);

            switch (modIndex) {
                case 0: // Join
                    let joinConditions;
                    if (curMod.args.type !== "cross") {
                        joinConditions = {
                            _left: curMod.args.where[0].split(".").pop(),
                            _check: curMod.args.where[1],
                            _right: curMod.args.where[2].split(".").pop()
                        };
                    }

                    let leftTableID = t._db._selectedTable;

                    let rightTableID = NanoSQLInstance._hash(curMod.args.table);

                    let where = t._getMod("where") as QueryLine;

                    t._join(curMod.args.type, leftTableID, rightTableID, joinConditions, (joinedRows) => {
                        if (where) {
                            next(joinedRows.filter((row: DBRow) => {
                                return t._where(row, where.args);
                            }));
                        } else {
                            next(joinedRows);
                        }
                    });

                    break;
                case 1: // Group By
                    let columns = curMod.args as {[key: string]: "asc"|"desc"};
                    let sortGroups = {};
                    if (columns) {
                        groups = tableIndex.reduce((prev, curr: DBRow) => {
                            let key = Object.keys(columns).reduce((p, c) => p + "." + String(curr[c]), "").slice(1);
                            (prev[key] = prev[key] || []).push(curr);
                            sortGroups[key] = Object.keys(columns).reduce((pr, cu) => {
                                pr[cu] = curr[cu];
                                return pr;
                            }, {});
                            return prev;
                        }, {});

                        next(Object.keys(groups).sort((a, b) => {
                            return sortObj(sortGroups[a], sortGroups[b], columns);
                        }).reduce((prev, curr) => {
                            return prev.concat(groups[curr]);
                        }, []));
                    } else {
                        next(tableIndex);
                    }
                    break;
                case 2: // Having
                    next(tableIndex.filter((row: DBRow) => {
                        return t._where(row, (t._getMod("having") as QueryLine).args);
                    }));
                    break;
                case 3: // Order By
                    next(tableIndex.sort((a: DBRow, b: DBRow) => {
                        return sortObj(a, b, curMod.args);
                    }));
                    break;
                case 4: // Offset
                    next(tableIndex.filter((row: DBRow, index: number) => {
                        return curMod ? index >= curMod.args : true;
                    }));
                    break;
                case 5: // Limit
                    next(tableIndex.filter((row: DBRow, index: number) => {
                        return curMod ?  index < curMod.args : true;
                    }));
                    break;
            }
        };

        i = -1;

        const qArgs = (t._act as QueryLine).args  || [];
        const stepQuery = (rowPKs: any[]) => {
            if (i < mods.length) {
                i++;
                modifyQuery(rowPKs, i, (resultRows: any[]) => {
                    stepQuery(resultRows);
                });
            } else {
                rowPKs = rowPKs.filter(r => r);
                if (!t._getMod("join")) { // Join commands are not memoized.
                    t._db._queryCache[t._db._selectedTable][t._queryHash] = rowPKs;
                }
                callBack(rowPKs, "none", []);
            }
        };

        stepQuery(queryRows);

    }

    /**
     * Removes elements from the currently selected table based on query conditions.
     *
     * @internal
     * @param {DBRow[]} queryRows
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    private _remove(queryRows: DBRow[], callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void) {
        let scribe = "deleted", i;
        let t = this;
        const qArgs = (t._act as QueryLine).args  || [];
        let pk = this._db._store._getTable()._pk;
        i = 0;

        const remove = () => {
            if (i < queryRows.length) {
                t._updateRow(queryRows[i][pk], () => {
                    i++;
                    remove();
                });
            } else {
                if (qArgs.length) scribe = "modified";
                t._tableChanged(queryRows.map(r => r[pk]), scribe, callBack);
            }
        };
        remove();
    }

    /**
     * Performs "where" filtering on a given table provided where conditions.
     *
     * @internal
     * @param {number} tableID
     * @param {string[]} searchIndex
     * @param {any[]} conditions
     * @returns {string[]}
     *
     * @memberOf _NanoSQLQuery
     */
    private _where(row: DBRow, conditions: any[]): boolean {
        let t = this;
        const commands = ["AND", "OR"];
        if (typeof conditions[0] !== "string") {
            let prevCmd: string;
            return conditions.reduce((prev, cur, i) => {
                if (commands.indexOf(cur) !== -1) {
                    prevCmd = cur;
                    return prev;
                } else {
                    let compare = t._compare(cur[2], cur[1], row[cur[0]]) === 0 ? true : false;
                    if (i === 0) return compare;
                    if (prevCmd === "AND") {
                        return prev && compare;
                    } else { // OR
                        return prev || compare;
                    }
                }
            }, true);
        } else {
            return t._compare(conditions[2], conditions[1], row[conditions[0]]) === 0 ? true : false;
        }
    }

    /**
     * Perform a join between two tables.  Generates a new table with the joined records.
     *
     * Joined tables are not memoized or cached in any way, they are generated from scrach on every query.
     *
     * @private
     * @param {("left"|"inner"|"right"|"cross"|"outer")} type
     * @param {any[]} whereArgs
     * @param {number} leftTableID
     * @param {number} rightTableID
     * @param {(null|{_left: string, _check: string, _right: string})} joinConditions
     * @param {(rows:DBRow[]) => void} complete
     * @returns {void}
     *
     * @memberOf _NanoSQLQuery
     */
    private _join(type: "left"|"inner"|"right"|"cross"|"outer", leftTableID: number, rightTableID: number, joinConditions: null|{_left: string, _check: string, _right: string}, complete: (rows: DBRow[]) => void): void {
        const L = "left";
        const R = "right";
        const O = "outer";
        let joinHelper: {[tableID: number]: {_keys: string[], _name: string}} = {};
        let t = this;

        let leftTableData = t._db._store._tables[leftTableID];
        let rightTableData = t._db._store._tables[rightTableID];

        const doJoinRows = (leftRow: DBRow|null, rightRow: DBRow|null) => {
            return [leftTableData, rightTableData].reduce((prev, cur, i) => {
                cur._keys.forEach((k) => {
                    prev[cur._name + "." + k] = ((i === 0 ? leftRow : rightRow) || {})[k];
                });
                return prev;
            }, {});
        };

        let joinTable: DBRow[] = [];
        let rightUsedPKs: string[] = [];

        t._db._store._read(leftTableData._name, "all", (leftRows: DBRow[]) => {
            t._db._store._read(rightTableData._name, "all", (rightRows: DBRow[]) => {

                leftRows.forEach((leftRow) => {
                    let joinRows = rightRows.filter((rightRow) => {
                        if (!joinConditions) return true;
                        let joinedRow = doJoinRows(leftRow, rightRow);
                        let keep = t._where(joinedRow, [joinConditions._left, joinConditions._check, joinConditions._right]);
                        if (keep) rightUsedPKs.push(rightRow[rightTableData._pk]);
                        return keep;
                    });

                    if (joinRows.length) { // All joins bring together rows that succesfully compare.
                        joinTable = joinTable.concat(joinRows);
                    } else if ([L, O].indexOf(type) >= 0) { // If no comparison, left and outer joins should add an entry with a null right side.
                        joinTable.push(doJoinRows(leftRow, null));
                    }
                });

                rightUsedPKs = rightUsedPKs.sort().filter((item, pos, ary) => {  // Remove duplicates
                    return !pos || item !== ary[pos - 1];
                });

                // If this is a RIGHT or OUTER join we're going to add the right side rows that haven't been used.
                if ([R, O].indexOf(type) >= 0) {
                    rightRows.filter((r) => { // Only include rows not added already
                        return rightUsedPKs.indexOf(r[rightTableData._pk]) === -1;
                    }).forEach((rightRow) => {
                        joinTable.push(doJoinRows(null, rightRow));
                    });
                }

                complete(joinTable);
            });
        });
    }

    /**
     * Compare two values together given a comparison value
     *
     * @internal
     * @param {*} val1
     * @param {string} compare
     * @param {*} val2
     * @returns {number}
     *
     * @memberOf _NanoSQLQuery
     */
    private _compare(val1: any, compare: string, val2: any): number {
        switch (compare) {
            case "=": return val2 === val1 ? 0 : 1;
            case ">": return val2 > val1 ? 0 : 1;
            case "<": return val2 < val1 ? 0 : 1;
            case "<=": return val2 <= val1 ? 0 : 1;
            case ">=": return val2 >= val1 ? 0 : 1;
            case "IN": return val1.indexOf(val2) < 0 ? 1 : 0;
            case "NOT IN": return val1.indexOf(val2) < 0 ? 0 : 1;
            case "REGEX":
            case "LIKE": return val2.search(val1) < 0 ? 1 : 0;
            case "BETWEEN": return val1[0] < val2 && val1[1] > val2 ? 0 : 1;
            default: return 0;
        }
    }
}