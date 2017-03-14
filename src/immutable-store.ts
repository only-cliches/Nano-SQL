import { NanoSQLInstance, _assign, NanoSQLBackend, ActionOrView, QueryLine, DBRow, DataModel, StdObject, DBConnect, DBExec, JoinArgs, DBFunction } from "./index";
import { Promise } from "./lie";

/**
 * @internal
 */
const _getKey = (args: any[], rows: DBRow[]):string => {
    if(rows.length) {
        let key = args[0] !== "*" ? args[0] : null;
        if(!key) key =  Object.keys(rows[0]).shift() || "";
        return key;
    }
    return "";
};

/**
 * @internal
 */
let _functions: {
    [key: string]: DBFunction
} = {
    SUM: {
        type:"aggregate",
        call: (rows: Array<StdObject<any>>, args: string[], useKey: string) => {
            let total = 0;
            let row = {};
            let key = _getKey(args, rows);
            if(key.length) {
                rows.forEach((row) => {
                    total += parseInt(row[key]);
                });
            }
            row[useKey] = total;
            return [row];
        }
    },
    MIN: {
        type:"aggregate",
        call: (rows: Array<StdObject<any>>, args: string[], useKey: string) => {
            let min = Number.MAX_VALUE;
            let useIndex = 0;
            let row = {};
            let key = _getKey(args, rows);
            if(key.length) {
                rows.forEach((row, i) => {
                    let minVal = parseInt(row[key]);
                    if(minVal < min) {
                        useIndex = i;
                        min = minVal;
                    }
                });
            }
            row = _assign(rows[useIndex]);
            row[useKey] = min;
            return [row];
        }
    },
    MAX: {
        type:"aggregate",
        call: (rows: Array<StdObject<any>>, args: string[], useKey: string) => {
            let max = Number.MIN_VALUE;
            let useIndex = 0;
            let row = {};
            let key = _getKey(args, rows);
            if(key.length) {
                rows.forEach((row, i) => {
                    let maxVal = parseInt(row[key]);
                    if(maxVal > max) {
                        useIndex = i;
                        max = maxVal;
                    }
                });
            }
            row = _assign(rows[useIndex]);
            row[useKey] = max;
            return [row];
        }
    },
    AVG: {
        type:"aggregate",
            call: (rows: Array<StdObject<any>>, args: string[], useKey: string) => {
            let average = 0;
            let row = {};
            if(rows.length) {
                average = _functions["SUM"].call(rows, args, useKey)[0][useKey] / rows.length;
                row = _assign(rows[0]);
            }
            row[useKey] = average;
            return [row];
        }
    },
    COUNT: {
        type:"aggregate",
        call: (rows: Array<StdObject<any>>, args: string[], useKey: string) => {
            let count = 0;
            let row = {};
            if(rows.length) {
                if(args[0] === "*") {
                    count = rows.length;
                } else {
                    count = rows.filter(r => r[args[0]]).length;
                }
                row = _assign(rows[0]);
                row[useKey] = count;
            }
            return [row];
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
    private _databaseID: number;

    /**
     * An array holding any queries that should be executed after the current one.
     *
     * @internal
     * @type {Array<DBExec>}
     * @memberOf _NanoSQLImmuDB
     */
    private _pendingQuerys: Array<DBExec>;

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
     * Utility data for each table, including holding the primary key, name, incriment number and primary keys
     *
     * @internal
     * @type {{
     *         [tableHash: number]: {
     *             _pk: string // Table primary key
     *             _name: string // Table name
     *             _incriment: number; // Table incriment counter
     *             _pkIndex: { // Primary key index, points to row IDs
     *                 [pk: number]: number;
     *             };
     *             _index: Array<number>; // The table index of row IDs in this table
     *         }
     *     }}
     * @memberOf _NanoSQLImmuDB
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
                [key: string]: (DBRow|null)[]
            },
            _historyPointers: {
                [key: string]: number;
            }
        }
    };

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
     * Contains an array of affected rows for each history point.
     * This lets clearing away history and performing updates as least expensive as possible.
     *
     * @internal
     * @type {Array<Array<number>>}
     * @memberOf _NanoSQLImmuDB
     */
    public _historyRecords: Array<{
        _tableID: number;
        _rowKeys: string[];
        _type: string;
    }>;

    /**
     * The pointer that indiciates where in history to pull from.
     *
     * @internal
     * @type {number}
     * @memberOf _NanoSQLImmuDB
     */
    public _historyPoint: number;

    /**
     * A variable to hold the state of the history pointer and history length
     *
     * @internal
     * @type {Array<number>}
     * @memberOf _NanoSQLImmuDB
     */
    public _historyArray: Array<number>;


    /**
     * Holds references to the indexed DB object.
     *
     * @type {IDBDatabase}
     * @memberOf _NanoSQLImmuDB
     */
    public _indexedDB: IDBDatabase;

    /**
     * Flag to disable history and caching to incrase performance for lage imports
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    public _disableHistoryAndCache: boolean;

    /**
     * Wether to store data to indexed DB or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    public _persistent: boolean;

    constructor() {
        let t = this;
        t._models = {};
        t._tables = {};
        t._pendingQuerys = [];
        t._historyRecords = [];
        t._historyPoint = 0;
        t._historyArray = [0, 0];
        t._queryCache = {};
        t._disableHistoryAndCache = false;
    }

    /**
     * Get a row object from the store based on the current history markers.
     *
     * @public
     * @param {number} rowID
     * @returns {(DBRow|null)}
     *
     * @memberOf _NanoSQLQuery
     */
    public _getRow(tableID: number, primaryKey: string): DBRow|null {
        return this._tables[tableID]._rows[primaryKey][this._tables[tableID]._historyPointers[primaryKey]];
    }

    public _getTable() {
        return this._tables[this._selectedTable];
    }

    public _newTable(tableName: string, dataModels:DataModel[]): string {
        let t = this;
        let ta = NanoSQLInstance._hash(tableName);

        t._models[ta] = dataModels;
        t._queryCache[ta] = {};

        t._tables[ta] = {
            _pk: "",
            _pkType: "",
            _keys:[],
            _defaults: [],
            _name: tableName,
            _incriment: 1,
            _index: [],
            _historyPointers:{},
            _rows:{}
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
     * Called once to init the database, prep all the needed variables and data models
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf _NanoSQLImmuDB
     */
    public _connect(connectArgs: DBConnect): void {
        let t = this;
        let i: number = 0;
        let p;
        let tables: string[] = [];
        let upgrading = false;
        let index = 0;

        t._parent = connectArgs._parent;

        t._persistent = connectArgs._config.length ? connectArgs._config[0].persistent || false : false;

        Object.keys(connectArgs._models).forEach((tableName) => {
            tables.push(t._newTable(tableName, connectArgs._models[tableName]));
        });
        
        t._databaseID = NanoSQLInstance._hash(JSON.stringify(connectArgs._models));

        Object.keys(connectArgs._functions || []).forEach((f) => {
            _functions[f] = connectArgs._functions[f];
        });

        if (t._persistent && typeof indexedDB !== "undefined") {

            let idb = indexedDB.open(String(t._databaseID), 1);

            // Called only when there is no existing DB, creates the tables and data store.
            idb.onupgradeneeded = (event: any) => {
                upgrading = true;
                let db: IDBDatabase = event.target.result;
                const next = () => {
                    if (index < tables.length) {
                        let ta = NanoSQLInstance._hash(tables[index]);
                        let config = t._tables[ta]._pk ? { keyPath: t._tables[ta]._pk } : {};
                        db.createObjectStore(tables[index], config);
                        index++;
                        next();
                    } else {
                        connectArgs._onSuccess();
                    }
                };

                next();
            };

            // Called once the database is connected and working
            idb.onsuccess = (event: any) => {
                t._indexedDB = event.target.result;

                // Called to import existing indexed DB data into the store.
                if (!upgrading) {
                    let next = () => {
                        if (index < tables.length) {
                            let ta = NanoSQLInstance._hash(tables[index]);
                            let transaction = t._indexedDB.transaction(tables[index], "readonly");
                            let store = transaction.objectStore(tables[index]);
                            let cursorRequest = store.openCursor();
                            let items: any[] = [];
                            transaction.oncomplete = () => {
                                t._parent.table(tables[index]).loadJS(items).then(() => {
                                    index++;
                                    next();
                                });
                            };

                            cursorRequest.onsuccess = (evt: any) => {
                                let cursor = evt.target.result;
                                if (cursor) {
                                    items.push(cursor.value);
                                    cursor.continue();
                                }
                            };

                        } else {
                            connectArgs._onSuccess();
                        }
                    };


                    next();
                };
            };
        } else {
            connectArgs._onSuccess();
        }

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
    public _invalidateCache(changedRows: DBRow[], type: string, action?: string): void {
        let t = this;

        t._queryCache[t._selectedTable] = {};

        if (changedRows.length && action) {    
            t._parent.triggerEvent({
                name: "change",
                actionOrView: "",
                table: t._getTable()._name,
                query: [],
                time: new Date().getTime(),
                result: [{msg:action + " was performed.",type:action}],
                changedRows: changedRows,
                changeType: type
            }, ["change"]);
        }
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
    public _extend(db: NanoSQLInstance, command: "<"|">"|"?"|"flush_db"|"disable"|"before_import"|"after_import"): Promise<any> {
        let t = this;
        let i;
        let h;
        let rowID;
        let rowData;
        let rowKey;
        let store: IDBObjectStore;

        if (t._indexedDB && t._getTable()) {
            store = t._indexedDB.transaction(t._getTable()._name, "readwrite").objectStore(t._getTable()._name);
        }

        const shiftRowIDs = (direction: number): DBRow[] => {
            let tableID: number = t._historyRecords[t._historyPoint]._tableID;
            i = t._historyRecords[t._historyPoint]._rowKeys.length;
            let rows:DBRow[] = [];
            while (i--) {
                rowID = t._historyRecords[t._historyPoint]._rowKeys[i];
                if(t._tables[tableID]._pkType === "int") rowID = parseInt(rowID);
                rowData = t._getRow(tableID, rowID) || {};
                if(direction > 0) rows.push(rowData);
                t._tables[tableID]._historyPointers[rowID] += direction;
                rowData = t._getRow(tableID, rowID);
                if(direction < 0) rows.push(t._getRow(tableID, rowID) as DBRow);
                if (store) {
                    if (rowData) {
                        store.put(rowData);
                    } else {
                        store.delete(rowID);
                    }
                }
                if (t._tables[tableID]._historyPointers[rowID] < 0) t._tables[tableID]._historyPointers[rowID] = 0;
            }
            return rows;
        };

        return new Promise((res, rej) => {

            switch (command) {
                case "<":
                    if (!t._historyRecords.length || t._historyPoint === t._historyRecords.length) { // end of history
                        res(false);
                    } else {
                        let rows = shiftRowIDs(1);
                        let description = t._historyRecords[t._historyPoint]._type;
                        t._historyPoint++;
                        switch(description) {
                            case "inserted":
                                description = "deleted";
                                break;
                            case "deleted":
                                description = "inserted";
                                break;
                        }
                        t._invalidateCache(rows, description, "undo");
                        res(true);
                    }
                break;
                case ">":
                    if (!t._historyRecords.length || t._historyPoint < 1) { // beginning of history
                        res(false);
                    } else {
                        t._historyPoint--;
                        let rows = shiftRowIDs(-1);
                        t._invalidateCache(rows, t._historyRecords[t._historyPoint]._type, "redo");
                        res(true);
                    }
                break;
                case "?":
                    h = [t._historyRecords.length, t._historyRecords.length - t._historyPoint];
                    if (t._historyArray.join("+") !== h.join("+")) {
                        t._historyArray = h;
                    }
                    res(t._historyArray);
                break;
                case "flush_db":
                    if (t._indexedDB) {
                        indexedDB.deleteDatabase(String(t._databaseID));
                    }
                break;
                case "before_import":
                    t._disableHistoryAndCache = true;
                    res(!!t._disableHistoryAndCache);
                break;
                case "after_import":
                    t._disableHistoryAndCache = false;
                    res(!!t._disableHistoryAndCache);
                break;
            }
        });
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
                if(q.type === "select") t._queryHash = NanoSQLInstance._hash(JSON.stringify(query._query));
            } else if (["show tables", "describe"].indexOf(q.type) >= 0) {
                simpleQuery.push(q);
            } else {
                t._mod.push(q); // Query Modifiers
            }
        });

        if(simpleQuery.length) {
            switch(simpleQuery[0].type) {
                case "show tables":
                    callBack();
                    query._onSuccess([{tables:Object.keys(this._db._tables).map((ta) => this._db._tables[ta]._name)}], "info", []);
                break;
                case "describe":
                    let getTable;
                    let tableName = this._db._selectedTable
                    let rows = {};
                    Object.keys(this._db._tables).forEach((ta) => {
                        if(parseInt(ta) === this._db._selectedTable) {
                            getTable = _assign(this._db._models[ta]);
                            tableName = this._db._tables[ta]._name;
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
     * Recursively freezes a js object, used to prevent the rows from being edited once they're added.
     * 
     * @internal
     * @param {*} obj 
     * @returns {*} 
     * 
     * @memberOf _NanoSQLQuery
     */
    private _deepFreeze(obj: any): any {
        this._db._models[this._db._selectedTable].forEach((model) => {
            let prop = obj[model.key];
            if (["map","array"].indexOf(typeof prop) >= 0) {
                obj[model.key] = this._deepFreeze(prop);
            }
        });
        return Object.freeze(obj);
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

        let queryIndex: string[] = [];

        if(!t._getMod("join") && t._act.type !== "drop") {
            if(t._getMod("where")) {
                // We can do the where filtering now if there's no join command and we're using a query that might have a where statement
                queryIndex = t._where(t._db._selectedTable, t._db._getTable()._index.slice(), (t._getMod("where") as QueryLine).args);
            } else {
                queryIndex = t._act.type !== "upsert" ? t._db._getTable()._index.slice() : [];
            }
        }

        switch (t._act.type) {
            case "upsert":
                this._upsert(queryIndex, callBack);
            break;
            case "select":
                this._select(queryIndex, callBack);
            break;
            case "drop":
            case "delete":
                this._remove(queryIndex, callBack);
            break;
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
    private _updateRow(rowPK: string): void {

        const t = this;
        let newRow;
        const oldRow = t._db._getRow(t._db._selectedTable, rowPK);
        const qArgs = (t._act as QueryLine).args;
        const updateType = ((): string => {
            if(t._act) {
                if(t._act.type === "delete" && !qArgs.length) {
                    return "drop";
                }
            }
            return t._act ? t._act.type : "";
        })();

        
        
        switch(updateType) {
            case "upsert":
                if(!t._db._disableHistoryAndCache) {
                    newRow = oldRow ? _assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                } else {
                    newRow = oldRow || {};
                }
                
                Object.keys(qArgs).forEach((k) => {
                    newRow[k] = qArgs[k];
                });

                // Add default values
                t._db._getTable()._keys.forEach((k, i) => {
                    let def = t._db._getTable()._defaults[i];
                    if(!newRow[k] && def) newRow[k] = def;
                });
            break;
            case "delete":
                newRow = oldRow ? _assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                qArgs.forEach((column) => {
                    newRow[column] = null;
                });
            break;
        }

        // Add the row to the history
        if(!t._db._disableHistoryAndCache) {
            t._db._getTable()._rows[rowPK].unshift(newRow ? t._deepFreeze(newRow) : null);
        } else {
            t._db._getTable()._rows[rowPK][t._db._getTable()._historyPointers[rowPK]] = t._deepFreeze(newRow);
        }

        // Apply changes to the indexed DB.
        if (t._db._indexedDB) {
            const tableName = t._db._getTable()._name;
            const transaction = t._db._indexedDB.transaction(tableName, "readwrite").objectStore(tableName);
            if(updateType === "upsert") {
                transaction.put(newRow);
            } else {
                transaction.delete(rowPK);
            }
            
        }
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
        let t = this, k;

        if (updatedRowPKs.length > 0) {

            // Remove history points ahead of the current one if the database has changed
            if (t._db._historyPoint > 0 && t._db._disableHistoryAndCache !== true) {
                t._db._historyRecords = t._db._historyRecords.filter((val, index) => {
                    if (index < t._db._historyPoint) {
                        k = val._rowKeys.length;
                        while(k--) {
                            t._db._tables[val._tableID]._historyPointers[val._rowKeys[k]] = 0; // Set this row history pointer to 0;
                            t._db._tables[val._tableID]._rows[val._rowKeys[k]].shift(); // Shift off the most recent update
                        }
                        return false;
                    }
                    return true;
                });
                t._db._historyPoint = 0;
            }

            // Add history records
            if (!t._db._disableHistoryAndCache) { // We don't want to add history points for imports
                t._db._historyRecords.unshift({
                    _tableID: t._db._selectedTable,
                    _rowKeys: updatedRowPKs,
                    _type: describe
                });
            }

            t._db._invalidateCache([], "");

            callBack([{msg: updatedRowPKs.length + " row(s) " + describe}], describe, updatedRowPKs.map((r) => this._db._getRow(this._db._selectedTable, r) || {}));
        } else {
            callBack([{msg: "0 rows " + describe}], describe, []);
        }
    };

    /**
     * Add/modify records to a specific table based on query parameters.
     * 
     * @internal
     * @param {string[]} queryIndex 
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack 
     * 
     * @memberOf _NanoSQLQuery
     */
    private _upsert(queryIndex: string[], callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void) {

        let scribe = "", i, changedPKs:string[] = []

        const qArgs = (this._act as QueryLine).args  || {},
        table = this._db._getTable(),
        pk = table._pk,
        whereMod = this._getMod("where")
        
        if (whereMod) { // Where statement exists or there's no PK, we're inserting data into existing rows
            scribe = "modified";
            changedPKs = queryIndex;
            i = queryIndex.length;
            while (i--) {
                this._updateRow(queryIndex[i]);
            }
        } else { // No where statment, perform upsert
            scribe = "inserted";
            
            if(!qArgs[pk]) {
                if(table._pkType === "int") {
                    qArgs[pk] = table._incriment++; 
                } else if(table._pkType === "uint") {
                    qArgs[pk] = NanoSQLInstance.uuid();
                }
            } else {
                if(table._pkType === "int") {
                    table._incriment = Math.max(qArgs[pk]+1, table._incriment);
                }
            }

            const objPK = qArgs[pk] ? String(qArgs[pk]) : String(table._index.length);
            changedPKs = [objPK];

            // Entirely new row, make a new index spot for it in the table.
            if(!table._rows[objPK]) {
                table._rows[objPK] = [null];
                table._historyPointers[objPK] = 0;
                table._index.push(objPK);
            }

            this._updateRow(objPK);
        }

        this._tableChanged(changedPKs, scribe, callBack);
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
     * @param {string[]} queryIndex 
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack 
     * @returns 
     * 
     * @memberOf _NanoSQLQuery
     */
    private _select(queryIndex: string[], callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void) {
        
        let t = this;
        // Memoization
        if (t._db._queryCache[t._db._selectedTable][t._queryHash]) {
            callBack(t._db._queryCache[t._db._selectedTable][t._queryHash], "none", []);
            return;
        }

        const mods = ["join", "groupby", "having", "orderby", "offset", "limit"];
        let curMod, column, i, k, rows, obj, rowData, groups = {};
        const sortObj = (objA:DBRow, objB:DBRow, columns: {[key: string]: string}) => {
            return Object.keys(columns).reduce((prev, cur) => {
                if(!prev) {
                    if(objA[cur] == objB[cur]) return 0;
                    return (objA[cur] > objB[cur] ? 1 : -1) * (columns[cur] === "desc" ? -1 : 1);
                } else {
                    return prev;
                }
            }, 0);
        };

        const modifyQuery = (tableIndex: any[], modIndex: number, next: (tableIndex: any[]) => void): void => {

            curMod = t._getMod(mods[modIndex]);

            // After JOIN command convert index to row data
            if(modIndex === 1) {
                tableIndex = tableIndex.map((index) => {
                    return t._db._getRow(t._getTableID(), index);
                }).filter(r => r);
            }

            // After GROUP BY command apply functions and AS statements
            if(modIndex === 2) {
                let functions:{call: string, args: string[], as: string, type: string}[] = [];
                if(qArgs.length) { // Select statement arguments
                    let funcs = Object.keys(_functions).map((f) => f + "(");
                    let keepColumns:any[] = [];
                    let hasBroken = false;
                    functions = qArgs.filter((q) => {
                        let hasFunc = funcs.reduce((prev, cur) => {
                            return (q.indexOf(cur) < 0 ? 0 : 1) + prev; 
                        }, 0) || 0;
                        if(hasFunc > 0) {
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

                        if(_functions[funcName].type === "simple" && columnName === funcName) {
                            columnName = args[0];
                        }

                        keepColumns.push(columnName);
                        return {
                            call: funcName,
                            args: args,
                            as: columnName.trim(),
                            type: _functions[funcName].type
                        };
                    });

                    let rows: DBRow[] = [];

                    if(functions.length) {

                        const doFunctions = (rows: DBRow[]): DBRow[] => {
                            return functions.sort((a, b) => {
                                return a.type > b.type ? 1 : -1;
                            }).reduce((prev, curr) => {
                                let newRows = [];
                                if(curr.type === "aggregate") {
                                    newRows = _functions[curr.call].call.apply(null, [rows.slice(), curr.args, curr.as]);
                                } else {
                                    newRows = _functions[curr.call].call.apply(null, [prev, curr.args, curr.as]);
                                }
                            
                                if(prev.length && curr.type === "aggregate") {
                                    prev = prev.filter((p, i) => i < 1);
                                    prev[0] = _assign(prev[0]);
                                    prev[0][curr.as] = newRows[0][curr.as];
                                    return prev;
                                } else {
                                    return newRows;
                                }
                            }, rows.slice());
                        }

                        let groupKeys:any = Object.keys(groups);
                        if(groupKeys.length) { // Groups Exist
                            rows = groupKeys
                            .map((k) => doFunctions(groups[k])) // Apply each function to each group (N^2)
                            .reduce((prev, curr) => { // Combine the results into a single table
                                return prev = prev.concat(curr), prev;
                            },[]);
                        } else { // No Groups, apply all functions to the rows
                            rows = doFunctions(tableIndex);
                        }
                    } else {
                        rows = tableIndex;
                    }

                    let convertKeys = keepColumns.map((n) => {
                        return n.match(/(.*)\sAS\s(.*)/) || n;
                    }).filter(n => n) || [];
        
                    if(convertKeys.length) {
                        rows = rows.map((r) => {
                            if(!hasBroken) r = _assign(r);
                            let newRow = {};
                            convertKeys.forEach((key) => {
                                if(typeof key === "string") {
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
                    if(curMod.args.type !== "cross") {
                        joinConditions = {
                            _left: curMod.args.where[0].split(".").pop(),
                            _check: curMod.args.where[1],
                            _right: curMod.args.where[2].split(".").pop()
                        };
                    }

                    let leftTableID = t._db._selectedTable;
                    
                    let rightTableID = NanoSQLInstance._hash(curMod.args.table);

                    let joinedIndex = t._join(curMod.args.type, leftTableID, t._db._tables[leftTableID]._index.slice(), rightTableID, t._db._tables[rightTableID]._index.slice(), joinConditions );

                    let where = t._getMod("where");
                    if(where) {
                        joinedIndex = t._where(t._getTableID(), joinedIndex, where.args as any[]);
                    }

                    next(joinedIndex);
                    break;
                case 1: // Group By
                    let columns = curMod.args as {[key: string]:"asc"|"desc"};
                    let sortGroups = {};
                    if(columns) {
                        groups = tableIndex.reduce((prev, curr: DBRow) => {
                            let key = Object.keys(columns).reduce((p, c) => p + "." + String(curr[c]), "").slice(1);
                            (prev[key] = prev[key] || []).push(curr);
                            sortGroups[key] = Object.keys(columns).reduce((pr, cu) => {
                                pr[cu] = curr[cu];
                                return pr;
                            },{});
                            return prev;
                        },{});
                    
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
                    // Put the records in a table
                    t._db._tables[t._queryHash] = {
                        _defaults:[],
                        _historyPointers:{},
                        _incriment:0,
                        _index:[],
                        _keys:[],
                        _name:t._queryHash.toString(),
                        _pk:"",
                        _pkType:"",
                        _rows: {}
                    };
                    t._joinTable = t._queryHash;
                    tableIndex.forEach((row: DBRow, i) => {
                        t._db._tables[t._queryHash]._historyPointers[i] = 0;
                        t._db._tables[t._queryHash]._rows[i] = [row];
                        t._db._tables[t._queryHash]._index.push(i.toString());
                    });

                    next(t._where(t._queryHash, t._db._tables[t._queryHash]._index, (t._getMod("having") as QueryLine).args).map((i) => {
                        return t._db._getRow(t._queryHash, i);
                    }).filter(r => r));
                    break;
                case 3: // Order By
                    next(tableIndex.sort((a:DBRow, b:DBRow) => {
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
                if(!t._getMod("join")) { // Join commands are not memoized.
                    t._db._queryCache[t._db._selectedTable][t._queryHash] = rowPKs;
                }   
                callBack(rowPKs, "none", []);
            }
        };

        stepQuery(queryIndex);

    }

    /**
     * Removes elements from the currently selected table based on query conditions.
     * 
     * @internal
     * @param {string[]} queryIndex 
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack 
     * 
     * @memberOf _NanoSQLQuery
     */
    private _remove(queryIndex: string[], callBack: (result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void) {
        let scribe = "deleted", i;
        let t = this;
        const qArgs = (t._act as QueryLine).args  || [];

        i = queryIndex.length;
        while(i--) t._updateRow(queryIndex[i]);
        if(qArgs.length) scribe = "modified";

        t._tableChanged(queryIndex, scribe, callBack);
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
    private _where(tableID: number, searchIndex: string[], conditions: any[]):string[] {
        let t = this;
        let commands = ["AND", "OR"];
        let doJoin: string;

        const whereJoin = (indexes: Array<Array<number>>, type: string): Array<number> => {
            return (indexes[0].concat(indexes[1]).sort().filter((item, pos, ary) => {
                const last = ary.lastIndexOf(item);
                return type === "OR" ? true : (pos !== last); // if AND, then filter out items that aren't duplicate.
            }));
        };

        const filterRows = (index: Array<string>, singleWhereStatement: Array<any>): Array<string> => {
            let r;
            return index.filter((v) => {
                r = t._db._getRow(tableID, v);
                return !r ? false : t._compare(singleWhereStatement[2], singleWhereStatement[1], r[singleWhereStatement[0]]) === 0 ? true : false;
            });
        };

        if (typeof conditions[0] === "string") {
            // Single where statement like ['name','=','billy']
            return filterRows(searchIndex, <any>conditions);
        } else {
            // nested where statement like [['name','=','billy'],'or',['name','=','bill']]
            return conditions.map((value) => {
                return commands.indexOf(value) >= 0 ? value : filterRows(searchIndex.slice(), <any>value);
            }).reduce((prev, cur, k) => {
                if (commands.indexOf(cur) < 0) {
                    return k === 0 ? cur : whereJoin([prev, cur], doJoin);
                } else {
                    doJoin = cur;
                    return prev;
                }
            });
        }
    }

    /**
     * Perform a join between two tables.  Generates a new table with the joined records.
     * 
     * Joined tables are not memoized or cached in any way, they are generated from scrach on every query.  
     * 
     * @internal
     * @param {("left"|"inner"|"right"|"cross"|"outer")} type 
     * @param {number} leftTableID 
     * @param {Array<string>} leftIndex 
     * @param {number} rightTableID 
     * @param {Array<string>} rightIndex 
     * @param {{left:string, check: string, right:string}} joinConditions 
     * @returns {Array<string>} 
     * 
     * @memberOf _NanoSQLQuery
     */
    private _join(type: "left"|"inner"|"right"|"cross"|"outer", leftTableID: number, leftIndex: Array<string>, rightTableID: number, rightIndex: Array<string>, joinConditions: null|{_left:string, _check: string, _right:string}): Array<string> {
        const newTableName = JSON.stringify(joinConditions);
        const L = "left";
        const R = "right";
        const O = "outer";
        let dataModel:DataModel[] = [];
        let incriment = 0;
        let joinHelper:{[tableID: number]:{_keys: string[],_name: string}} = {};
        let t = this;

        // Keep track of what right side rows have been added
        let rightIndexUsed = ([R,O].indexOf(type) >= 0) ? rightIndex.slice() : [];

        // Setup the join table model
        [leftTableID, rightTableID].forEach((id) => {
            let keys: string[] = [];
            t._db._models[id].forEach((m) => {
                keys.push(m.key);
                dataModel.push({
                    key: t._db._tables[id]._name + "." + m.key,
                    type:m.type,
                    default:m.default || null
                });
            });

            joinHelper[id] = {
                _keys: keys,
                _name: t._db._tables[id]._name
            };
        });

        // Make a new table for this join
        t._db._newTable(newTableName, dataModel);
        t._joinTable = NanoSQLInstance._hash(newTableName);
        
        // Performs a fast insert in the new table bypassing most of the typical checks
        const joinInsert = (leftRow: DBRow|null, rightRow: DBRow|null) => {
            let idx = String(incriment++);
            let newRow = {};
            let oldRows = [leftRow, rightRow];

            [leftTableID, rightTableID].forEach((id, tableIndex) => {
                let row = oldRows[tableIndex];
                joinHelper[id]._keys.forEach((key) => {
                    newRow[joinHelper[id]._name + "." + key] = row ? row[key] : null;
                });     
            });

            t._db._tables[t._joinTable]._index.push(idx);
            t._db._tables[t._joinTable]._historyPointers[idx] = 0;
            t._db._tables[t._joinTable]._rows[idx] = [newRow];
        }

        // Inserts multiple right side rows into the joined table
        const rightInserts = (leftRow: DBRow|null, idxs: string[]) => {
            idxs.forEach(i => {
                if(rightIndexUsed.length) {
                    let pos = rightIndexUsed.indexOf(i);
                    if(pos > 0) rightIndexUsed.splice(pos, 1);
                }
                joinInsert(leftRow, t._db._getRow(rightTableID, i));
            });
        }

        // Perform the N ^ 2 join on both tables, WEE!
        leftIndex.forEach((leftI, leftCounter) => {
            let leftRow = t._db._getRow(leftTableID, leftI) || {};
            let whereIndex = !joinConditions ? rightIndex.slice() : t._where(rightTableID, rightIndex.slice(), [joinConditions._right,joinConditions._check, leftRow[joinConditions._left]]);
 
            if(whereIndex.length) { // All joins bring together rows that succesfully compare.
                rightInserts(leftRow, whereIndex);
            } else if([L,O].indexOf(type) >= 0) { // If no comparison, left and outer joins should add an entry with a null right side.
                joinInsert(leftRow, null);
            } 
        });

        // If this is a RIGHT or OUTER join we're going to add the right side rows that haven't been used.
        if(rightIndexUsed.length) {
            rightInserts(null, rightIndexUsed.slice());
        }

        return t._db._tables[t._joinTable]._index.slice();
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