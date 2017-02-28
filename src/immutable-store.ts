import { SomeSQLInstance, SomeSQLBackend, ActionOrView, QueryLine, DBRow, DataModel, StdObject, DBConnect, DBExec, JoinArgs } from "./index";
import { TSPromise } from "typescript-promise";

let _filters: {
    [key: string]: (rows: Array<DBRow>, Options?: any) => Array<DBRow>
} = {
    sum: (rows: Array<StdObject<any>>) => {
        return [{"sum": rows.map((r: StdObject<any>) => {
                for (let k in r) {
                    return r[k];
                }
            }).reduce((a, b) => a + b, 0)}];
    },
    min: (rows: Array<StdObject<any>>) => {
        return [{min: rows.map((r: StdObject<any>) => {
                for (let k in r) {
                    return r[k];
                }
            }).sort((a, b) => a < b ? -1 : 1)[0]}];
    },
    max: (rows: Array<StdObject<any>>) => {
        return [{max: rows.map((r: StdObject<any>) => {
                for (let k in r) {
                    return r[k];
                }
            }).sort((a, b) => a > b ? -1 : 1)[0]}];
    },
    average: (rows: Array<StdObject<any>>) => {
        return [{average: _filters["sum"](rows)[0]["sum"] / rows.length}];
    },
    count: (rows: Array<StdObject<any>>) => {
        return [{count: rows.length}];
    }
};

/**
 * The main class for the immutable database, holds the indexes, data and primary methods.
 *
 * A majority of data moving around for select statements and the like is indexes, not the actual data.
 *
 * @export
 * @class _SomeSQLImmuDB
 * @implements {SomeSQLBackend}
 */
// tslint:disable-next-line
export class _SomeSQLImmuDB implements SomeSQLBackend {

    /**
     * Unique database hash ID based on the data model.
     *
     * @internal
     * @type {number}
     * @memberOf _SomeSQLImmuDB
     */
    private _databaseID: number;

    /**
     * An array holding any queries that should be executed after the current one.
     *
     * @internal
     * @type {Array<DBExec>}
     * @memberOf _SomeSQLImmuDB
     */
    private _pendingQuerys: Array<DBExec>;

    /**
     * Stores a row index for each table.
     *
     * @internal
     * @type {{
     *         [tableHash: number]: Array<DataModel>;
     *     }}
     * @memberOf _SomeSQLImmuDB
     */
    public _models: {
        [tableHash: number]: Array<DataModel>;
    };

    /**
     * The SomeSQL instance this database is attached to.
     *
     * @internal
     * @type {SomeSQLInstance}
     * @memberOf _SomeSQLImmuDB
     */
    public _parent: SomeSQLInstance;

    /**
     * A hash of the current table name.
     *
     * @internal
     * @type {number}
     * @memberOf _SomeSQLImmuDB
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
     * @memberOf _SomeSQLImmuDB
     */
    public _tableInfo: {
        [tableHash: number]: {
            _pk: string
            _name: string
            _incriment: number;
            _pkIndex: {
                [pk: number]: number;
            };
            _index: Array<number>;
        }
    };

    /**
     * Stores all the source data of every table.
     * Each rowID contains an array, the first entry of every array is "null", every following entry is an immutable object
     * representing that row's data in time.  Changes to the row add an entry to the rowID array.
     *
     * @internal
     * @type {(Array<Array<DBRow|null>>)}
     * @memberOf _SomeSQLImmuDB
     */
    public _rows: Array<Array<DBRow|null>>;

    /**
     * A query hash split up by tables.
     *
     * @internal
     * @type {{
     *         [tableID: number]: {
     *             [queryHash: number]: Array<DBRow>
     *         }
     *     }}
     * @memberOf _SomeSQLImmuDB
     */
    public _queryCache: {
        [tableID: number]: {
            [queryHash: number]: Array<DBRow>
        }
    };

    /**
     * An index/cache of joins that let us speed up join commands.
     *
     * @internal
     * @type {{
     *         [CombinedRowIDs: string]: {
     *             _joinedHistoryIndex: Array<number>;
     *             _rowID: number;
     *         }
     *     }}
     * @memberOf _SomeSQLImmuDB
     */
    public _joinIndex: {
        [CombinedRowIDs: string]: {
            _joinedHistoryIndex: Array<number>;
            _rowID: number;
        }
    };

    /**
     * A record of join relationships between tables
     *
     * @internal
     * @type {Array<Array<number>>}
     * @memberOf _SomeSQLImmuDB
     */
    public _joinedRelations: Array<Array<number>>;

    /**
     * Contains an array of affected rows for each history point.
     * This lets clearing away history and performing updates as least expensive as possible.
     *
     * @internal
     * @type {Array<Array<number>>}
     * @memberOf _SomeSQLImmuDB
     */
    public _historyRecords: Array<Array<number>>;

    /**
     * Contains a pointer for each row that indicates which history point in the row to use.
     *
     * @internal
     * @type {{
     *         [rowID: number]: number;
     *     }}
     * @memberOf _SomeSQLImmuDB
     */
    public _historyPointers: {
        [rowID: number]: number;
    };

    /**
     * The pointer that indiciates where in history to pull from.
     *
     * @internal
     * @type {number}
     * @memberOf _SomeSQLImmuDB
     */
    public _historyPoint: number;

    /**
     * A variable to hold the state of the history pointer and history length
     *
     * @internal
     * @type {Array<number>}
     * @memberOf _SomeSQLImmuDB
     */
    public _historyArray: Array<number>;



    /**
     * Holds references to the indexed DB object.
     *
     * @type {IDBDatabase}
     * @memberOf _SomeSQLImmuDB
     */
    public _indexedDB: IDBDatabase;

    /**
     * Flag to keep track of when importing IndexeDB.
     *
     * @type {boolean}
     * @memberOf _SomeSQLImmuDB
     */
    public isImporting: boolean;

    constructor() {
        let t = this;
        t._models = {};
        t._tableInfo = {};
        t._pendingQuerys = [];
        t._historyRecords = [[]];
        t._historyPoint = 0;
        t._historyPointers = {};
        t._historyArray = [0, 0];
        t._joinIndex = {};
        t._rows = [];
        t._queryCache = {};
        t._joinedRelations = [];
    }

    /**
     * Wether to store data to indexed DB or not.
     *
     * @type {boolean}
     * @memberOf _SomeSQLImmuDB
     */
    public _persistent: boolean;

    /**
     * Get a row object from the store based on the current history markers.
     *
     * @public
     * @param {number} rowID
     * @returns {(DBRow|null)}
     *
     * @memberOf _SomeSQLQuery
     */
    public _getRow(rowID: number): DBRow|null {
        return this._rows[rowID][this._historyIDs(rowID)];
    }

    /**
     * Get the IDs of the current history pointers for a given rowID.
     *
     * @public
     * @param {number} rowID
     * @returns
     *
     * @memberOf _SomeSQLQuery
     */
    public _historyIDs(rowID: number) {
        return this._historyPointers[rowID];
    }

    /**
     * Called once to init the database, prep all the needed variables and data models
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf _SomeSQLImmuDB
     */
    public _connect(connectArgs: DBConnect): void {
        let t = this;
        let i: number = 0;
        let p;
        let tables: string[] = [];
        let upgrading = false;

        t._parent = connectArgs._parent;

        t._persistent = connectArgs._config.length ? connectArgs._config[0].persistent || false : false;

        for (let tableName in connectArgs._models) {
            let ta = SomeSQLInstance._hash(tableName);

            tables.push(tableName);

            t._models[ta] = connectArgs._models[tableName];
            t._queryCache[ta] = {};
            t._tableInfo[ta] = {
                _pk: "",
                _name: tableName,
                _incriment: 1,
                _index: [],
                _pkIndex: {}
            };

            // Discover primary keys for each table
            i = t._models[ta].length;
            while (i--) {
                p = t._models[ta][i];
                if (p.props && p.props.indexOf("pk") !== -1) {
                    t._tableInfo[ta]._pk = p.key;
                }
            }
        }

        t._databaseID = SomeSQLInstance._hash(JSON.stringify(connectArgs._models));

        if (connectArgs._filters) {
            for (let f in connectArgs._filters) {
                _filters[f] = connectArgs._filters[f];
            }
        }

        let index = 0;

        if (t._persistent && window && window.indexedDB) {

            let idb = window.indexedDB.open(String(t._databaseID), 1);

            // Called only when there is no existing DB, creates the tables and data store.
            idb.onupgradeneeded = (event: any) => {
                upgrading = true;
                let db: IDBDatabase = event.target.result;
                let next = () => {
                    if (index < tables.length) {
                        let ta = SomeSQLInstance._hash(tables[index]);
                        let config = t._tableInfo[ta]._pk ? { keyPath: t._tableInfo[ta]._pk } : {};
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
                    t.isImporting = true;
                    let next = () => {
                        if (index < tables.length) {
                            let ta = SomeSQLInstance._hash(tables[index]);
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
                            t.isImporting = false;
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
     * Called by SomeSQL to execute queries on this database.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf _SomeSQLImmuDB
     */
    public _exec(execArgs: DBExec): void {
        let t = this;

        if (t._pendingQuerys.length) {
            t._pendingQuerys.push(execArgs);
        } else {
            t._selectedTable = SomeSQLInstance._hash(execArgs._table);
            new _SomeSQLQuery(t)._doQuery(execArgs).then((query) => {
                if (t._pendingQuerys.length) {
                    t._exec(<any> t._pendingQuerys.pop());
                }
            });
        }
    }

    /**
     * Invalidate the query cache cased on the rows being affected
     *
     * @internal
     * @param {boolean} triggerChange
     *
     * @memberOf _SomeSQLImmuDB
     */
    public _invalidateCache(triggerChange: boolean): void {
        let t = this;
        let c = [t._selectedTable];
        let i = t._joinedRelations.length;
        while (i--) {
            if (t._joinedRelations[i].indexOf(t._selectedTable) !== -1) {
                c.concat(t._joinedRelations[i]);
            }
        }

        t._removeDupes(c.sort()).forEach((table) => {
            t._queryCache[table] = {};
            if (triggerChange) {
                t._parent.triggerEvent({
                    name: "change",
                    actionOrView: "",
                    table: t._tableInfo[table]._name,
                    query: [],
                    time: new Date().getTime(),
                    result: []
                }, ["change"]);
            }
        });
    }

    /**
     * Utility function to remove duplicates from an array.
     *
     * @internal
     * @param {Array<any>} sortedArray
     * @returns {Array<any>}
     *
     * @memberOf _SomeSQLImmuDB
     */
    public _removeDupes(sortedArray: Array<any>): Array<any> {
        return sortedArray.filter((item, pos,  ary) => {
            return !pos || (item !== ary[pos - 1]); // Remove all duplicates.
        });
    }

    /**
     * Undo & Redo logic.
     *
     * ### Undo
     * Reverse the state of the database by one step into the past.
     * Usage: `SomeSQL().extend("<")`;
     *
     * ### Redo
     * Step the database state forward by one.
     * Usage: `SomeSQL().extend(">")`;
     *
     * ### Query
     * Discover the state of the history system
     * ```ts
     * SomeSQL().extend("?").then(function(state) {
     *  console.log(state[0]) // <= length of history records
     *  console.log(state[1]) // <= current history pointer position
     * });
     * ```
     *
     * The history point is zero by default, perforing undo shifts the pointer backward while redo shifts it forward.
     *
     * @param {SomeSQLInstance} db
     * @param {("<"|">"|"?")} command
     * @returns {TSPromise<any>}
     *
     * @memberOf _SomeSQLImmuDB
     */
    public _extend(db: SomeSQLInstance, command: "<"|">"|"?"|"flush_db"): TSPromise<any> {
        let t = this;
        let i;
        let h;
        let rowID;
        let rowData;
        let rowKey;
        let store = t._indexedDB.transaction(t._tableInfo[t._selectedTable]._name, "readwrite").objectStore(t._tableInfo[t._selectedTable]._name);
        let shiftRowIDs = (direction: number) => {
            i = t._historyRecords[t._historyPoint].length;
            while (i--) {
                rowID = t._historyRecords[t._historyPoint][i];
                rowData = t._getRow(rowID) || {};
                rowKey = rowData[t._tableInfo[t._selectedTable]._pk];
                t._historyPointers[rowID] += direction;
                rowData = t._getRow(rowID);
                if (t._indexedDB) {
                    if (rowData) {
                        store.put(rowData);
                    } else {
                        store.delete(rowKey);
                    }
                }
                if (t._historyPointers[rowID] < 0) t._historyPointers[rowID] = 0;
            }
        };

        return new TSPromise((res, rej) => {
            if (!t._historyRecords.length && (["<", ">"].indexOf(command) !== -1)) {
                res(false);
                return;
            }

            switch (command) {
                case "<":
                    if (t._historyPoint === t._historyRecords.length - 1) { // end of history
                        res(false);
                    } else {
                        shiftRowIDs(1);
                        t._historyPoint++;
                        t._invalidateCache(true);
                        res(true);
                    }
                break;
                case ">":
                    if (t._historyPoint < 1) { // beginning of history
                        res(false);
                    } else {
                        t._historyPoint--;
                        shiftRowIDs(-1);
                        t._invalidateCache(true);
                        res(true);
                    }
                break;
                case "?":
                    h = [t._historyRecords.length - 1, t._historyPoint];
                    if (t._historyArray.join("+") !== h.join("+")) {
                        t._historyArray = h;
                    }
                    res(t._historyArray);
                break;
                case "flush_db":
                    if (t._indexedDB) {
                        window.indexedDB.deleteDatabase(String(t._databaseID));
                    }
                break;
            }
        });
    }
}


/**
 * Query module called for each database execution to get the desired result on the data.
 *
 * @internal
 * @class _SomeSQLQuery
 */
// tslint:disable-next-line
class _SomeSQLQuery {

    /**
     * The current action being called by the query. Select, Upsert, etc.
     *
     * @internal
     * @type {(QueryLine|undefined)}
     * @memberOf _SomeSQLQuery
     */
    private _act: QueryLine|undefined;

    /**
     * Query modifiers like where, orderby, etc.
     *
     * @internal
     * @type {Array<QueryLine>}
     * @memberOf _SomeSQLQuery
     */
    private _mod: Array<QueryLine>;

    /**
     * A hash of the current query arguments.
     *
     * @internal
     * @type {number}
     * @memberOf _SomeSQLQuery
     */
    private _queryHash: number;

    /**
     * A reference to the parent immutable storage object.
     *
     * @internal
     * @type {_SomeSQLImmuDB}
     * @memberOf _SomeSQLQuery
     */
    private _db: _SomeSQLImmuDB;

    constructor(database: _SomeSQLImmuDB) {
        this._db = database;
    }

    /**
     * Setup the query then call the execution command.
     *
     * @internal
     * @param {DBExec} query
     * @returns {TSPromise<any>}
     *
     * @memberOf _SomeSQLQuery
     */
    public _doQuery(query: DBExec): TSPromise<any> {
        let t = this;

        return new TSPromise((res, rej) => {

            t._mod = [];
            t._act = undefined;
            // t._actionOrView = query._viewOrAction || "";
            t._db._selectedTable = SomeSQLInstance._hash(query._table);
            // t._viewHash = SomeSQLInstance._hash(query._table + t._actionOrView);
            t._queryHash = SomeSQLInstance._hash(JSON.stringify(query._query));

            TSPromise.all(query._query.map((q) => {
                return new TSPromise((resolve, reject) => {
                    if (["upsert", "select", "delete", "drop"].indexOf(<string>q.type) !== -1) {
                        t._act = q; // Query Action
                    } else {
                        t._mod.push(q); // Query Modifiers
                    }
                    resolve();
                });
            })).then(() => {
                t._execQuery((result: Array<Object>) => {
                    query._onSuccess(result);
                    res(t);
                });
            });
        });
    }

    /**
     * Create a new row and setup the histtory objects for it.
     *
     * @internal
     * @returns {number}
     *
     * @memberOf _SomeSQLQuery
     */
    private _newRow(): number {
        let t = this;
        let rowID = t._db._rows.length;
        t._db._rows.push([null]);
        t._db._tableInfo[t._db._selectedTable]._index.push(rowID);
        t._db._historyPointers[rowID] = 0;
        return rowID;
    }

    /**
     * Execute queries an immutable storage object.
     *
     * @internal
     * @param {Function} callBack
     * @returns {void}
     *
     * @memberOf _SomeSQLQuery
     */
    private _execQuery(callBack: Function): void {
        let t = this;

        if (!t._act) return;

        let scribe;
        let pk = t._db._tableInfo[t._db._selectedTable]._pk;
        let qArgs: any = t._act.args || [];

        let msg: number = 0;
        let i: number;
        let k: number;

        let whereRows: Array<any> = [];

        let changedRowIDs: Array<any> = [];

        let ta = t._db._tableInfo[t._db._selectedTable]._index.slice(); // Copy the table index.

        let rowID;
        let m;
        let mod;
        let mods: Array<any>;
        let curMod: any|undefined;
        let w;
        let keys: Array<any>;
        let column;
        let rowA;
        let rowB;
        let results: Array<DBRow> = [];
        let rowData: DBRow|null;
        let obj: DBRow|null;

        let hasWhere = t._mod.filter((v) => {
            return v.type === "where";
        });

        let getMod = (name: string): QueryLine|undefined => {
            return t._mod.filter((v) => v.type === name).pop();
        };

        let tableChanged = (updateLength: number, describe: string): void => {

            if (updateLength > 0) {

                // Remove history points ahead of the current one if the database has changed
                if (t._db._historyPoint > 0) {
                    t._db._historyRecords = t._db._historyRecords.filter((val, index) => {
                        if (index < t._db._historyPoint) {
                            k = val.length;
                            while (k--) {
                                t._db._historyPointers[val[k]] = 0; // Set this row history pointer to 0;
                                t._db._rows[val[k]].shift(); // Shift off the most recent update
                            }
                            return false;
                        }
                        return true;
                    });
                    t._db._historyPoint = 0;
                }

                if (t._db.isImporting) {
                    if (!t._db._historyRecords[0]) t._db._historyRecords[0] = [];
                    t._db._historyRecords[0] = t._db._historyRecords[0].concat(changedRowIDs);
                } else {
                    t._db._historyRecords.unshift(changedRowIDs);
                }

                t._db._invalidateCache(false);

                callBack([{msg: updateLength + " row(s) " + describe}]);

            } else {

                callBack([{msg: "0 rows " + describe}]);
            }
        };

        let updateRow = (rowID: number, cb: Function): void => {
            changedRowIDs.push(rowID);
            let newRow = {...t._db._getRow(rowID) || {}};
            // let newRow = JSON.parse(JSON.stringify(t._getRow(rowID) || {}));
            for (let key in qArgs) {
                newRow[key] = cb(key, newRow[key]);
            }
            t._db._rows[rowID].unshift(Object.freeze(newRow));

            if (t._db._indexedDB) {
                let tableName = t._db._tableInfo[t._db._selectedTable]._name;
                t._db._indexedDB.transaction(tableName, "readwrite").objectStore(tableName).put(newRow);
            }
        };

        // We can do the where filtering now if there's no join command and we're using a query that might have a where statement
        if (t._act.type !== "drop") {
            if (hasWhere.length && !getMod("join")) {
                whereRows = t._where(ta, hasWhere[0].args);
            } else {
                whereRows = ta;
            }
        }

        switch (t._act.type) {
            case "upsert":

                scribe = "updated";
                i = whereRows.length;

                if (hasWhere.length && qArgs[pk]) {
                    throw new Error("Can't use a where statement if you have a non null primary key value!");
                }

                if (hasWhere.length) { // Where statement exists, we're inserting data into existing rows
                    msg = i;
                    scribe = "modified";
                    while (i--) {
                        updateRow(whereRows[i], (key: string, oldData: any) => {
                            return key !== pk ? qArgs[key] : oldData;
                        });
                    }
                } else { // Insert row
                    rowID = 0;

                    if (qArgs[pk]) { // Primary key is set in arguments, attempt to update existing row
                        if (t._db._tableInfo[t._db._selectedTable]._pkIndex[qArgs[pk]]) { // Does this primary key already exist?
                            rowID = t._db._tableInfo[t._db._selectedTable]._pkIndex[qArgs[pk]];
                        } else { // Turns out this primary key isn't in the database yet, make a new row.
                            rowID = t._newRow();
                            scribe = "inserted";
                            t._db._tableInfo[t._db._selectedTable]._incriment = Math.max(qArgs[pk] + 1, t._db._tableInfo[t._db._selectedTable]._incriment);
                            t._db._tableInfo[t._db._selectedTable]._pkIndex[qArgs[pk]] = rowID;
                        }
                    } else { // Add new row
                        scribe = "inserted";
                        m = t._db._models[t._db._selectedTable].length;
                        while (m--) {
                            mod = t._db._models[t._db._selectedTable][m];
                            if (mod.props && mod.props.indexOf("pk") !== -1) {
                                switch (mod.type) {
                                    case "int":
                                        qArgs[pk] = t._db._tableInfo[t._db._selectedTable]._incriment++;
                                    break;
                                    case "uuid":
                                        qArgs[pk] = SomeSQLInstance.uuid();
                                    break;
                                }
                                rowID = t._newRow();
                                t._db._tableInfo[t._db._selectedTable]._pkIndex[qArgs[pk]] = rowID;
                            }
                        }
                    }

                    updateRow(rowID, (key: string, oldData: any) => {
                        return qArgs[key] || oldData;
                    });

                    msg = 1;
                }

                tableChanged(msg, scribe);
                break;
            case "select":

                if (t._db._queryCache[t._db._selectedTable][t._queryHash]) {
                    callBack(t._db._queryCache[t._db._selectedTable][t._queryHash]);
                    break;
                }

                mods = ["join", "orderby", "offset", "limit"];

                let modifyQuery = (rows: Array<number>, modIndex: number): TSPromise<any> => {
                    return new TSPromise((res, rej): any => {
                        curMod = getMod(mods[modIndex]);
                        if (!curMod) return res(rows), false;

                        switch (modIndex) {
                            case 0: // Join

                                t._db._parent.table(curMod.args.table).query("select").exec().then((rightRows: Array<any>, db: SomeSQLInstance) => {
                                    if (!curMod) return;

                                    w = curMod.args.where.map((tableAndColumn: string, index1: number) => {
                                        return tableAndColumn.split(".").map((e: string, index: number) => {
                                            return index1 !== 1 ? (index === 0 ? SomeSQLInstance._hash(e) : e) : e;
                                        });
                                    });

                                    let rightTable = t._db._tableInfo[w[2][0]];
                                    rightRows = rightRows.map((obj) => {
                                        return rightTable._pkIndex[obj[rightTable._pk]];
                                    }).filter((r) => r);

                                    rows = t._join(curMod.args.type, rows, rightRows, w);
                                    if (hasWhere.length) rows = t._where(rows, hasWhere[0].args);
                                    res(rows);
                                });
                                break;
                            case 1: // Order By
                                res(rows.sort((a: number, b: number) => {
                                    if (!curMod) return;
                                    keys = [];
                                    for (let key in curMod.args) {
                                        keys.push(key);
                                    }

                                    return keys.reduce((prev, cur, i) => {
                                        if (!curMod) return;
                                        column = keys[i];
                                        rowA = t._db._getRow(a) || {};
                                        rowB = t._db._getRow(b) || {};
                                        return ((rowA[column] > rowB[column] ? 1 : -1) * (curMod.args[column] === "asc" ? 1 : -1)) + prev;
                                    }, 0);
                                }));
                                break;
                            case 2: // Offset
                                res(rows.filter((row: number, index: number) => {
                                    return curMod ? index >= curMod.args : true;
                                }));
                                break;
                            case 3: // Limit
                                res(rows.filter((row: number, index: number) => {
                                    return curMod ?  index < curMod.args : true;
                                }));
                                break;
                        }
                    });
                };

                i = mods.length;

                let stepQuery = (rows: Array<number>) => {
                    if (i > -1) {
                        i--;
                        modifyQuery(rows, i).then((resultRows: Array<any>) => {
                            stepQuery(resultRows);
                        });
                    } else {

                        rows.forEach((row) => {
                            if (qArgs.length) { // Likely the largest suck of performance, an actual shallow copy of each row must be made.

                                k = qArgs.length;
                                rowData = t._db._getRow(row);
                                if (rowData) {
                                    obj = {};
                                    while (k-- && obj && rowData) {
                                        obj[qArgs[k]] = rowData[qArgs[k]];
                                    };
                                } else {
                                    obj = null;
                                }
                            } else {
                                obj = t._db._getRow(row);
                            };

                            if (obj) results.push(obj);
                        });

                        results = t._runFilters(results);

                        t._db._queryCache[t._db._selectedTable][t._queryHash] = results;

                        callBack(t._db._queryCache[t._db._selectedTable][t._queryHash]);
                    }
                };

                stepQuery(whereRows);

                break;
            case "drop":
            case "delete":
                let delRows = [];
                if (whereRows.length && t._act.type === "delete") {
                    delRows = whereRows;
                } else {
                    delRows = ta;
                }
                scribe = "deleted";

                i = delRows.length;

                let tableName = t._db._tableInfo[t._db._selectedTable]._name;

                while (i--) {
                    if (qArgs.length) { // Modify existing row, make a copy and modify the copy.

                        updateRow(delRows[i], (key: string, oldData: any) => {
                            return qArgs.indexOf(key) !== -1 ? null : oldData;
                        });

                        scribe = "modified";
                    } else { // Just delete the entire row

                        let rowKey = (t._db._getRow(delRows[i]) || {})[t._db._tableInfo[t._db._selectedTable]._pk];
                        if (t._db._indexedDB && rowKey) {
                            t._db._indexedDB.transaction(tableName, "readwrite").objectStore(tableName).delete(rowKey);
                        }

                        t._db._rows[delRows[i]].unshift(null); // Add "null" to history to show removal.
                        changedRowIDs.push(delRows[i]);
                    }
                }

                tableChanged(delRows.length, scribe);
                break;
        }
    }



    /**
     * Filter rows based on a where statement and inex of rows.
     *
     * @internal
     * @param {Array<number>} index
     * @param {Array<any>} singleWhereStatement
     * @returns {Array<number>}
     *
     * @memberOf _SomeSQLQuery
     */
    private _filterRows(index: Array<number>, singleWhereStatement: Array<any>): Array<number> {
        let t = this;
        let r;
        return index.filter((v) => {
            r = t._db._getRow(v);
            return !r ? false : t._compare(singleWhereStatement[2], singleWhereStatement[1], r[singleWhereStatement[0]]) === 0 ? true : false;
        });
    };

    /**
     * Filter down an index of rows based on a where statement from the query.
     *
     * @internal
     * @param {Array<number>} index
     * @param {Array<any>} combinedWhereStatement
     * @returns {Array<number>}
     *
     * @memberOf _SomeSQLQuery
     */
    private _where(index: Array<number>, combinedWhereStatement: Array<any>): Array<number> {
        let t = this;
        let commands = ["and", "or"];
        let doJoin: string;

        let whereJoin = (indexes: Array<Array<number>>, type: string): Array<number> => {
            return t._db._removeDupes(indexes[0].concat(indexes[1]).sort().filter((item, pos, ary) => {
                return type === "and" ? (pos !== ary.lastIndexOf(item)) : true; // if AND, then filter out items that aren't duplicate.
            }));
        };

        if (typeof (combinedWhereStatement[0]) === "string") {
            // Single where statement like ['name','=','billy']
            return t._filterRows(index, <any>combinedWhereStatement);
        } else {
            // nested where statement like [['name','=','billy'],'or',['name','=','bill']]
            return combinedWhereStatement.map((value) => {
                return commands.indexOf(value) !== -1 ? value : t._filterRows(index, <any>value);
            }).reduce((prev, cur, k) => {
                if (commands.indexOf(cur) === -1) {
                    return k === 0 ? cur : whereJoin([prev, cur], doJoin);
                } else {
                    doJoin = cur;
                    return prev;
                }
            });
        }
    }

    /**
     * Join two tables together given specific conditions.
     *
     * @internal
     * @param {("left"|"inner"|"right"|"cross")} type
     * @param {Array<number>} index1
     * @param {Array<number>} index2
     * @param {Array<any>} joinConditions
     * @returns {Array<number>}
     *
     * @memberOf _SomeSQLQuery
     */
    private _join(type: "left"|"inner"|"right"|"cross", index1: Array<number>, index2: Array<number>, joinConditions: Array<any>): Array<number> {
        let t = this;

        let rows: Array<DBRow> = [];
        let joinedIndex: Array<number> = [];
        let tables: Array<number> = [joinConditions[0][0], joinConditions[2][0]];
        let tableNames = [t._db._tableInfo[joinConditions[0][0]]._name, t._db._tableInfo[joinConditions[2][0]]._name];
        let models = [t._db._models[joinConditions[0][0]], t._db._models[joinConditions[2][0]]];

        // [t._selectedTable, pk, "=", t._selectedTable, pk] join conditions

        let newRow: DBRow = {};
        let joinKey: string;
        let isNewRow: boolean;
        let doNull: boolean;
        let matches: Array<any> = [];
        let rightIDs: Array<number> = [];
        let i = index1.length;
        let j;
        let l;
        let k;

        // This is a relationship cache to keep track of joins between tables
        i = t._db._joinedRelations.length;
        j = 0;
        while (i-- && !j) {
            if (t._db._joinedRelations[i].indexOf(tables[0]) !== -1 && t._db._joinedRelations[i].indexOf(tables[1]) !== -1) j = 1;
        }
        if (!j) t._db._joinedRelations.push(tables);

        let doJoin = (rowIDs: Array<number>, mergeRows: Array<DBRow|boolean> ): number => {

            joinKey = rowIDs.join("+");
            isNewRow = false;
            k = rowIDs.map((r) => {
                return t._db._historyIDs(r);
            });


            // Check if brand new join row
            if (!t._db._joinIndex[joinKey]) {
                isNewRow = true;
                t._db._joinIndex[joinKey] = {
                    _rowID: 0,
                    _joinedHistoryIndex: k
                };
            }

            // Basically, we check to see if either row this join was pulled from has changed since the last join command.
            // If it's changed we create a new point in the joined row history with the updated information.
            // Otherwise we leave it alone and don't perform the expensive join action.
            if (isNewRow || k.join("+") !== t._db._joinIndex[joinKey]._joinedHistoryIndex.join("+")) {
                newRow = {};
                models.forEach((table, ti) => {
                    doNull = rowIDs[ti] === -1 || mergeRows[ti] === false;
                    table.forEach((dm) => {
                        newRow[tableNames[ti] + "." + dm.key] = doNull ? null : (<DBRow> mergeRows[ti])[dm.key];
                    });
                });

                if (isNewRow) {
                    t._db._joinIndex[joinKey]._rowID = t._newRow();
                }
                t._db._rows[t._db._joinIndex[joinKey]._rowID].unshift(newRow);
            }

            return t._db._joinIndex[joinKey]._rowID;
        };

        i = index1.length;

        while (i--) {
            j = index2.length;
            rows[0] = t._db._getRow(index1[i]) || {};
            matches = [];
            while (j--) {

                rows[1] = t._db._getRow(index2[j]) || {};
                if (!t._compare(rows[0][joinConditions[0][1]], joinConditions[1][0], rows[1][joinConditions[2][1]]) || type === "cross") {
                    matches.push([index2[j], rows[1]]); // [rowID, rowData]
                    rightIDs.push(index2[j]);
                }
            }
            l = matches.length;
            if (l) { // Inner && Cross
                while (l--) {
                    joinedIndex.push(doJoin([index1[i], matches[l][0]], [rows[0], matches[l][1]]));
                };
            } else if (type === "left") { // Left Outer
                joinedIndex.push(doJoin([index1[i], -1], [rows[0], false]));
            }
        }

        // Take care of right outer joins
        if (type === "right") {
            i = index2.length;
            while (i--) {
                if (rightIDs.indexOf(index2[i]) === -1) {
                    joinedIndex.push(doJoin([-1, index2[i]], [false, t._db._getRow(index2[i]) || {}]));
                }
            }
        }

        return joinedIndex.reverse();
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
     * @memberOf _SomeSQLQuery
     */
    private _compare(val1: any, compare: string, val2: any): number {
        switch (compare) {
            case "=": return val2 === val1 ? 0 : 1;
            case ">": return val2 > val1 ? 0 : 1;
            case "<": return val2 < val1 ? 0 : 1;
            case "<=": return val2 <= val1 ? 0 : 1;
            case ">=": return val2 >= val1 ? 0 : 1;
            case "IN": return val1.indexOf(val2) === -1 ? 1 : 0;
            case "NOT IN": return val1.indexOf(val2) === -1 ? 0 : 1;
            case "REGEX":
            case "LIKE": return val2.search(val1) === -1 ? 1 : 0;
            default: return 0;
        }
    }

    /**
     * Exexcute active filters on a given set of database rows.
     *
     * @internal
     * @param {Array<Object>} dbRows
     * @returns {*}
     *
     * @memberOf _SomeSQLQuery
     */
    private _runFilters(dbRows: Array<Object>): any {
        let t = this;
        let filters = t._mod.filter((m) => (<string>m.type).indexOf("filter-") === 0);
        return filters.length ? filters.reduce((prev, cur, i) => {
            return _filters[filters[i].type.replace("filter-", "")].apply(t, [prev, filters[i].args]);
        }, dbRows) : dbRows;
    }
}