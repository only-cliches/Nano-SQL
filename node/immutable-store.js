"use strict";
var index_1 = require("./index");
var lie_ts_1 = require("lie-ts");
/* NODE-START */
var levelup = require("levelup");
var fs = require("fs");
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
var minMax = function (type, row, args, ptr, prev) {
    var key = args[0];
    if (ptr[0] === 0)
        prev[key] = type === -1 ? Number.MAX_VALUE : Number.MIN_VALUE;
    var nextRow = {};
    if (type === -1 ? parseFloat(row[key]) < parseFloat(prev[key]) : parseFloat(row[key]) > parseFloat(prev[key])) {
        nextRow = row;
    }
    else {
        nextRow = prev;
    }
    if (ptr[0] === ptr[1]) {
        var r = index_1._assign(nextRow);
        r[type === -1 ? "MIN" : "MAX"] = nextRow[key];
        return r;
    }
    else {
        return nextRow;
    }
};
/**
 * @internal
 */
var _functions = {
    SUM: {
        type: "aggregate",
        call: function (row, args, ptr, prev) {
            if (ptr[0] === 0)
                prev = 0;
            prev += parseInt(row[args[0]]);
            if (ptr[0] === ptr[1]) {
                var r = index_1._assign(row);
                r.SUM = prev;
                return r;
            }
            else {
                return prev;
            }
        }
    },
    MIN: {
        type: "aggregate",
        call: function (row, args, ptr, prev) {
            return minMax(-1, row, args, ptr, prev);
        }
    },
    MAX: {
        type: "aggregate",
        call: function (row, args, ptr, prev) {
            return minMax(1, row, args, ptr, prev);
        }
    },
    AVG: {
        type: "aggregate",
        call: function (row, args, ptr, prev) {
            if (ptr[0] === 0)
                prev = 0;
            prev += parseInt(row[args[0]]);
            if (ptr[0] === ptr[1]) {
                var r = index_1._assign(row);
                r.AVG = (prev / (ptr[1] + 1)) || prev;
                return r;
            }
            else {
                return prev;
            }
        }
    },
    COUNT: {
        type: "aggregate",
        call: function (row, args, ptr, prev) {
            if (ptr[0] === 0)
                prev = 0;
            if (args[0] === "*") {
                prev++;
            }
            else {
                prev += row[args[0]] ? 1 : 0;
            }
            if (ptr[0] === ptr[1]) {
                var r = index_1._assign(row);
                r.COUNT = prev;
                return r;
            }
            else {
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
var _NanoSQLImmuDB = (function () {
    function _NanoSQLImmuDB() {
        var t = this;
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
    _NanoSQLImmuDB.prototype._connect = function (connectArgs) {
        var t = this;
        t._databaseID = index_1.NanoSQLInstance._hash(JSON.stringify(connectArgs._models));
        t._parent = connectArgs._parent;
        t._store = new _NanoSQL_Storage(t, connectArgs);
    };
    /**
     * Called by NanoSQL to execute queries on this database.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf _NanoSQLImmuDB
     */
    _NanoSQLImmuDB.prototype._exec = function (execArgs) {
        var t = this;
        if (t._pendingQuerys.length) {
            t._pendingQuerys.push(execArgs);
        }
        else {
            t._selectedTable = index_1.NanoSQLInstance._hash(execArgs._table);
            new _NanoSQLQuery(t)._doQuery(execArgs, function (query) {
                if (t._pendingQuerys.length) {
                    t._exec(t._pendingQuerys.pop());
                }
            });
        }
    };
    /**
     * Invalidate the query cache based on the rows being affected
     *
     * @internal
     * @param {boolean} triggerChange
     *
     * @memberOf _NanoSQLImmuDB
     */
    _NanoSQLImmuDB.prototype._invalidateCache = function (changedTableID, changedRows, type, action) {
        var t = this;
        t._queryCache[t._selectedTable] = {};
        if (changedRows.length && action) {
            t._parent.triggerEvent({
                name: "change",
                actionOrView: "",
                table: t._store._tables[changedTableID]._name,
                query: [],
                time: new Date().getTime(),
                result: [{ msg: action + " was performed.", type: action }],
                changedRows: changedRows,
                changeType: type
            }, ["change"]);
        }
    };
    /**
     * Recursively freezes a js object, used to prevent the rows from being edited once they're added.
     *
     * @internal
     * @param {*} obj
     * @returns {*}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLImmuDB.prototype._deepFreeze = function (obj) {
        if (!obj)
            return obj;
        var t = this;
        t._store._models[t._selectedTable].forEach(function (model) {
            var prop = obj[model.key];
            if (["map", "array"].indexOf(typeof prop) >= 0) {
                obj[model.key] = t._deepFreeze(prop);
            }
        });
        return Object.freeze(obj);
    };
    _NanoSQLImmuDB.prototype._transaction = function (type) {
        if (type === "start")
            this._store._doingTransaction = true;
        if (type === "end")
            this._store._doingTransaction = false;
        return !!this._store._doingTransaction;
    };
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
    _NanoSQLImmuDB.prototype._extend = function (db, command) {
        var t = this;
        var i;
        var h;
        var j;
        var rowID;
        var rowData;
        var rowKey;
        var store;
        var shiftRowIDs = function (direction, callBack) {
            var results = {};
            var check = (t._store._historyLength - t._store._historyPoint);
            t._store._read("_historyPoints", function (row) {
                return row.historyPoint === check;
            }, function (hps) {
                j = 0;
                var nextPoint = function () {
                    if (j < hps.length) {
                        i = 0;
                        var tableID_1 = hps[j].tableID;
                        var table_1 = t._store._tables[tableID_1];
                        var rows_1 = [];
                        var nextRow_1 = function () {
                            if (i < hps[j].rowKeys.length) {
                                rowID = hps[j].rowKeys[i];
                                if (table_1._pkType === "int")
                                    rowID = parseInt(rowID);
                                t._store._read(table_1._name, rowID, function (rowData) {
                                    if (direction > 0)
                                        rows_1.push(rowData[0]); // Get current row data befoe shifting to a different row
                                    // Shift the row pointer
                                    t._store._read("_" + table_1._name + "_hist__meta", rowID, function (row) {
                                        row = index_1._assign(row);
                                        row[0]._pointer += direction;
                                        var historyRowID = row[0]._historyDataRowIDs[row[0]._pointer];
                                        t._store._upsert("_" + table_1._name + "_hist__meta", rowID, row[0], function () {
                                            t._store._read("_" + table_1._name + "_hist__data", historyRowID, function (row) {
                                                var newRow = row[0] ? index_1._assign(row[0]) : null;
                                                t._store._upsert(table_1._name, rowID, newRow, function () {
                                                    if (direction < 0)
                                                        rows_1.push(newRow);
                                                    if (!results[tableID_1])
                                                        results[tableID_1] = { type: hps[j].type, rows: [] };
                                                    results[tableID_1].rows = results[tableID_1].rows.concat(rows_1);
                                                    i++;
                                                    nextRow_1();
                                                });
                                            });
                                        });
                                    });
                                });
                            }
                            else {
                                j++;
                                nextPoint();
                            }
                        };
                        nextRow_1();
                    }
                    else {
                        callBack(results);
                    }
                };
                nextPoint();
            });
        };
        return new lie_ts_1.Promise(function (res, rej) {
            switch (command) {
                case "<":
                    if (!t._store._historyLength || t._store._historyPoint === t._store._historyLength) {
                        res(false);
                    }
                    else {
                        shiftRowIDs(1, function (affectedTables) {
                            t._store._historyPoint++;
                            t._store._utility("w", "historyPoint", t._store._historyPoint);
                            Object.keys(affectedTables).forEach(function (tableID) {
                                var description = affectedTables[tableID].type;
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
                    if (!t._store._historyLength || t._store._historyPoint < 1) {
                        res(false);
                    }
                    else {
                        t._store._historyPoint--;
                        t._store._utility("w", "historyPoint", t._store._historyPoint);
                        shiftRowIDs(-1, function (affectedTables) {
                            Object.keys(affectedTables).forEach(function (tableID) {
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
                    Object.keys(t._store._tables).forEach(function (tableID) {
                        var rows = t._store._tables[parseInt(tableID)]._rows;
                        t._invalidateCache(parseInt(tableID), Object.keys(rows).map(function (r) { return rows[r]; }), "remove", "clear");
                    });
                    t._store._clearAll(res);
                    break;
                case "flush_history":
                    t._store._clearHistory(res);
                    break;
            }
        });
    };
    return _NanoSQLImmuDB;
}());
exports._NanoSQLImmuDB = _NanoSQLImmuDB;
// tslint:disable-next-line
var _NanoSQL_Storage = (function () {
    function _NanoSQL_Storage(database, args) {
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
    _NanoSQL_Storage.prototype.init = function (database, args) {
        var t = this;
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
        var size = 5;
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
        var upgrading = false;
        var index = 0;
        var isNewStore = true;
        Object.keys(args._models).forEach(function (t) {
            args._models["_" + t + "_hist__data"] = index_1._assign(args._models[t]);
            args._models["_" + t + "_hist__data"] = args._models["_" + t + "_hist__data"].map(function (m) {
                delete m.props;
                return m;
            });
            // args._models["_" + t + "_hist__data"].unshift({key: "__id", type: "int", props:["ai", "pk"]});
            args._models["_" + t + "_hist__meta"] = [
                { key: "id", type: "int", props: ["ai", "pk"] },
                { key: "_pointer", type: "int" },
                { key: "_historyDataRowIDs", type: "array" },
            ];
        });
        args._models["_utility"] = [
            { key: "key", type: "string", props: ["pk"] },
            { key: "value", type: "blob" },
        ];
        args._models["_historyPoints"] = [
            { key: "id", type: "int", props: ["ai", "pk"] },
            { key: "tableID", type: "int" },
            { key: "historyPoint", type: "int" },
            { key: "rowKeys", type: "array" },
            { key: "type", type: "string" }
        ];
        var tables = Object.keys(args._models);
        var beforeHist;
        var beforeSel = t._parent._selectedTable;
        var beforeMode;
        Object.keys(args._models).forEach(function (tableName) {
            t._newTable(tableName, args._models[tableName]);
        });
        Object.keys(args._functions || []).forEach(function (f) {
            _functions[f] = args._functions[f];
        });
        var completeSetup = function () {
            var tables = Object.keys(args._models);
            var i = 0;
            t._mode = beforeMode;
            if (beforeHist) {
                t._read("_utility", "all", function (rows) {
                    rows.forEach(function (d) {
                        t._utility("w", d.key, d.value);
                        if (d.key === "historyPoint")
                            t._historyPoint = d.value || 0;
                        if (d.key === "historyLength")
                            t._historyLength = d.value || 0;
                    });
                });
            }
            if (isNewStore) {
                var step_1 = function () {
                    if (i < tables.length) {
                        if (tables[i].indexOf("_hist__data") !== -1) {
                            t._parent._selectedTable = index_1.NanoSQLInstance._hash(tables[i]);
                            t._upsert(tables[i], 0, null, function () {
                                i++;
                                step_1();
                            });
                        }
                        else {
                            i++;
                            step_1();
                        }
                    }
                    else {
                        t._doHistory = beforeHist;
                        t._parent._selectedTable = beforeSel;
                        args._onSuccess();
                    }
                };
                step_1();
            }
            else {
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
            if (t._mode !== 0) {
                switch (t._mode) {
                    case 1:
                        if (typeof indexedDB === "undefined")
                            t._mode = 0;
                        break;
                    case 2:
                        if (typeof localStorage === "undefined")
                            t._mode = 0;
                        break;
                    // case 3: if (typeof window === "undefined" || typeof window.openDatabase === "undefined") t._mode = 0;
                    case 3:
                        t._mode = 0;
                        break;
                    case 4:
                        if (typeof window !== "undefined")
                            t._mode = 0;
                        break;
                }
            }
            else {
                if (typeof window !== "undefined") {
                    if (typeof localStorage !== "undefined")
                        t._mode = 2; // Local storage is the fail safe
                    if (typeof indexedDB !== "undefined")
                        t._mode = 1; // Use indexedDB instead if it's there
                }
                else {
                    t._mode = 4; // Use LevelUp in NodeJS if it's there.
                }
            }
        }
        else {
            t._mode = 0;
            completeSetup();
        }
        beforeHist = t._doHistory;
        beforeMode = t._mode;
        t._mode = 0;
        t._doHistory = false;
        switch (beforeMode) {
            case 1:
                var idb = indexedDB.open(String(t._parent._databaseID), 1);
                // Called only when there is no existing DB, creates the tables and data store.
                idb.onupgradeneeded = function (event) {
                    upgrading = true;
                    var db = event.target.result;
                    var transaction = event.target.transaction;
                    t._indexedDB = db;
                    var next = function () {
                        if (index < tables.length) {
                            var ta = index_1.NanoSQLInstance._hash(tables[index]);
                            var config = t._tables[ta]._pk ? { keyPath: t._tables[ta]._pk } : {};
                            db.createObjectStore(t._tables[ta]._name, config); // Standard Tables
                            index++;
                            next();
                        }
                        else {
                            transaction.oncomplete = function () {
                                completeSetup();
                            };
                        }
                    };
                    next();
                };
                // Called once the database is connected and working
                idb.onsuccess = function (event) {
                    t._indexedDB = event.target.result;
                    // Called to import existing indexed DB data into the memory store.
                    if (!upgrading) {
                        isNewStore = false;
                        var next_1 = function () {
                            if (index >= tables.length) {
                                completeSetup();
                                return;
                            }
                            // Do not import history tables if history is disabled.
                            if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                index++;
                                next_1();
                                return;
                            }
                            // Load data from indexed DB into memory store
                            if (index < tables.length) {
                                var ta_1 = index_1.NanoSQLInstance._hash(tables[index]);
                                var transaction = t._indexedDB.transaction(tables[index], "readonly");
                                var store = transaction.objectStore(tables[index]);
                                var cursorRequest = store.openCursor();
                                var items_1 = [];
                                transaction.oncomplete = function () {
                                    if (t._storeMemory) {
                                        if (tables[index].indexOf("_hist__data") !== -1) {
                                            t._tables[ta_1]._index.push("0");
                                            t._tables[ta_1]._rows["0"] = null;
                                            t._tables[ta_1]._incriment++;
                                            t._parent._parent.table(tables[index]).loadJS(items_1).then(function () {
                                                index++;
                                                next_1();
                                            });
                                        }
                                        else {
                                            t._parent._parent.table(tables[index]).loadJS(items_1).then(function () {
                                                index++;
                                                next_1();
                                            });
                                        }
                                    }
                                    else {
                                        t._tables[ta_1]._index = items_1;
                                        t._tables[ta_1]._incriment = items_1.reduce(function (prev, cur) {
                                            return Math.max(parseInt(cur), prev);
                                        }, 0) + 1;
                                        index++;
                                        next_1();
                                    }
                                };
                                cursorRequest.onsuccess = function (evt) {
                                    var cursor = evt.target.result;
                                    if (cursor) {
                                        items_1.push(t._storeMemory ? cursor.value : cursor.key);
                                        cursor.continue();
                                    }
                                };
                            }
                        };
                        next_1();
                    }
                    ;
                };
                break;
            case 2:
                if (localStorage.getItem("dbID") !== String(t._parent._databaseID)) {
                    localStorage.clear();
                    localStorage.setItem("dbID", String(t._parent._databaseID));
                    tables.forEach(function (table) {
                        var ta = index_1.NanoSQLInstance._hash(table);
                        localStorage.setItem(table, JSON.stringify([]));
                    });
                    completeSetup();
                }
                else {
                    isNewStore = false;
                    // import indexes no matter what
                    tables.forEach(function (tName) {
                        var ta = index_1.NanoSQLInstance._hash(tName);
                        var tableIndex = JSON.parse(localStorage.getItem(tName) || "[]");
                        t._tables[ta]._index = tableIndex;
                        if (!t._storeMemory) {
                            t._tables[ta]._incriment = tableIndex.reduce(function (prev, cur) {
                                return Math.max(parseInt(cur), prev);
                            }, 0) + 1;
                        }
                    });
                    // only import data if the memory store is enabled
                    if (t._storeMemory) {
                        var tIndex_1 = 0;
                        var step_2 = function () {
                            if (tIndex_1 < tables.length) {
                                var items_2 = [];
                                // Do not import history tables if history is disabled.
                                if (!beforeHist && (tables[tIndex_1].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                    tIndex_1++;
                                    step_2();
                                    return;
                                }
                                JSON.parse(localStorage.getItem(tables[tIndex_1]) || "[]").forEach(function (ptr) {
                                    items_2.push(JSON.parse(localStorage.getItem(tables[tIndex_1] + "-" + ptr) || ""));
                                });
                                t._parent._parent.table(tables[tIndex_1]).loadJS(items_2).then(function () {
                                    tIndex_1++;
                                    step_2();
                                });
                            }
                            else {
                                completeSetup();
                            }
                        };
                        step_2();
                    }
                    else {
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
            case 4:
                // Called to import existing  data into the memory store.
                var existingStore = function () {
                    isNewStore = false;
                    var next = function () {
                        if (index < tables.length) {
                            // Do not import history tables if history is disabled.
                            if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                index++;
                                next();
                                return;
                            }
                            // Load data from level up into memory store
                            if (index < tables.length) {
                                var ta_2 = index_1.NanoSQLInstance._hash(tables[index]);
                                var items_3 = [];
                                if (t._storeMemory) {
                                    t._levelDBs[tables[index]].createValueStream()
                                        .on("data", function (data) {
                                        items_3.push(JSON.parse(data));
                                    })
                                        .on("end", function () {
                                        if (tables[index].indexOf("_hist__data") !== -1) {
                                            t._tables[ta_2]._index.push("0");
                                            t._tables[ta_2]._rows["0"] = null;
                                            t._tables[ta_2]._incriment++;
                                            t._parent._parent.table(tables[index]).loadJS(items_3).then(function () {
                                                index++;
                                                next();
                                            });
                                        }
                                        else {
                                            t._parent._parent.table(tables[index]).loadJS(items_3).then(function () {
                                                index++;
                                                next();
                                            });
                                        }
                                    });
                                }
                                else {
                                    t._levelDBs[tables[index]].createKeyStream()
                                        .on("data", function (data) {
                                        items_3.push(data);
                                    })
                                        .on("end", function () {
                                        t._tables[ta_2]._index = items_3;
                                        t._tables[ta_2]._incriment = items_3.reduce(function (prev, cur) {
                                            return Math.max(parseInt(cur), prev);
                                        }, 0) + 1;
                                        index++;
                                        next();
                                    });
                                }
                            }
                        }
                        else {
                            completeSetup();
                            return;
                        }
                    };
                    next();
                };
                var dbFolder_1 = "./db_" + t._parent._databaseID;
                var existing = true;
                if (!fs.existsSync(dbFolder_1)) {
                    fs.mkdirSync(dbFolder_1);
                    existing = false;
                }
                tables.forEach(function (table) {
                    t._levelDBs[table] = levelup(dbFolder_1 + "/" + table);
                });
                if (existing) {
                    existingStore();
                }
                else {
                    completeSetup();
                }
                break;
        }
    };
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
    _NanoSQL_Storage.prototype._clearHistory = function (complete) {
        var t = this;
        var tables = Object.keys(t._tables);
        var index = 0;
        var step = function () {
            if (index < tables.length) {
                if (tables[index].indexOf("_hist__meta") !== -1) {
                }
                if (tables[index].indexOf("_hist__data") !== -1) {
                }
                if (tables[index] === "_historyPoints") {
                }
            }
            else {
                complete();
            }
        };
        step();
    };
    _NanoSQL_Storage.prototype._delete = function (tableName, rowID, callBack) {
        var t = this;
        var editingHistory = false;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        t._tables[ta]._index.splice(t._tables[ta]._index.indexOf(String(rowID)), 1); // Update Index
        if (t._storeMemory) {
            delete t._tables[ta]._rows[rowID];
            if (t._mode === 0 && callBack)
                return callBack(true);
        }
        switch (t._mode) {
            case 1:
                var transaction = t._indexedDB.transaction(tableName, "readwrite").objectStore(tableName);
                transaction.delete(rowID);
                if (callBack)
                    callBack(true);
                break;
            case 2:
                localStorage.removeItem(tableName + "-" + String(rowID));
                localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                if (callBack)
                    callBack(true);
                break;
            /*case 3: // WebSQL
                t._webSQL.transaction((tx) => {
                    let pk = t._tables[ta]._pk;
                    tx.executeSql("DELETE FROM " + tableName + " WHERE " + pk + " = ?", [rowID]);
                });
            break;*/
            /* NODE-START */
            case 4:
                t._levelDBs[tableName].del(rowID, function () {
                    if (callBack)
                        callBack(true);
                });
                break;
        }
    };
    _NanoSQL_Storage.prototype._upsert = function (tableName, rowID, value, callBack) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        if (rowID === undefined || rowID === null) {
            t._models[ta].forEach(function (m) {
                if (m.props && m.props.indexOf("pk") !== -1) {
                    if (m.type === "uuid") {
                        rowID = index_1.NanoSQLInstance.uuid();
                    }
                    else {
                        rowID = t._tables[ta]._incriment++;
                    }
                }
            });
            if (!rowID)
                rowID = parseInt(t._tables[ta]._index[t._tables[ta]._index.length - 1] || "0") + 1;
        }
        if (t._tables[ta]._pkType === "int")
            rowID = parseInt(rowID);
        var pk = t._tables[ta]._pk;
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
            if (t._mode === 0 && callBack)
                return callBack(rowID);
        }
        switch (t._mode) {
            case 1:
                var transaction = t._indexedDB.transaction(tableName, "readwrite");
                var store = transaction.objectStore(tableName);
                if (pk.length && value) {
                    store.put(value);
                }
                else {
                    if (tableName.indexOf("_hist__data") !== -1) {
                        store.put(value, rowID);
                    }
                    else {
                        if (value)
                            store.put(value);
                        if (!value)
                            store.delete(rowID);
                    }
                }
                transaction.oncomplete = function () {
                    if (callBack)
                        callBack(rowID);
                };
                break;
            case 2:
                localStorage.setItem(tableName + "-" + String(rowID), value ? JSON.stringify(value) : "");
                localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                if (callBack)
                    callBack(rowID);
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
            case 4:
                if (tableName.indexOf("_hist__data") !== -1) {
                    t._levelDBs[tableName].put(String(rowID), JSON.stringify(value), function () {
                        if (callBack)
                            callBack(rowID);
                    });
                }
                else {
                    if (value) {
                        t._levelDBs[tableName].put(String(rowID), JSON.stringify(value), function () {
                            if (callBack)
                                callBack(rowID);
                        });
                    }
                    else {
                        t._levelDBs[tableName].del(String(rowID), function () {
                            if (callBack)
                                callBack(rowID);
                        });
                    }
                }
                break;
        }
    };
    _NanoSQL_Storage.prototype._read = function (tableName, row, callBack) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        // Way faster to read directly from memory if we can.
        if (t._storeMemory && t._tables[ta]) {
            var rows_2 = t._tables[ta]._rows;
            if (row === "all" || typeof row === "function") {
                var allRows = Object.keys(rows_2).map(function (r) { return rows_2[r]; });
                if (row === "all") {
                    callBack(allRows.filter(function (r) { return r; }));
                }
                else {
                    callBack(allRows.filter(function (r) { return row(r); }));
                }
            }
            else {
                callBack([rows_2[row]].filter(function (r) { return r; }));
            }
            return;
        }
        switch (t._mode) {
            case 1:
                var transaction = t._indexedDB.transaction(tableName, "readonly");
                var store = transaction.objectStore(tableName);
                if (row === "all" || typeof row === "function") {
                    var cursorRequest = store.openCursor();
                    var rows_3 = [];
                    transaction.oncomplete = function () {
                        callBack(rows_3);
                    };
                    cursorRequest.onsuccess = function (evt) {
                        var cursor = evt.target.result;
                        if (cursor) {
                            if (row !== "all") {
                                if (row(cursor.value))
                                    rows_3.push(cursor.value);
                            }
                            else {
                                rows_3.push(cursor.value);
                            }
                            cursor.continue();
                        }
                    };
                }
                else {
                    var singleReq_1 = store.get(row);
                    singleReq_1.onsuccess = function (event) {
                        callBack([singleReq_1.result]);
                    };
                }
                break;
            case 2:
                if (row === "all" || typeof row === "function") {
                    var rows = t._tables[ta]._index.map(function (idx) {
                        var item = localStorage.getItem(tableName + "-" + idx);
                        return item && item.length ? JSON.parse(item) : null;
                    });
                    if (row !== "all") {
                        callBack(rows.filter(function (r) { return row(r); }));
                    }
                    else {
                        callBack(rows);
                    }
                }
                else {
                    var item = localStorage.getItem(tableName + "-" + row);
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
            case 4:
                if (row === "all" || typeof row === "function") {
                    var rows_4 = [];
                    t._levelDBs[tableName].createValueStream()
                        .on("data", function (data) {
                        rows_4.push(JSON.parse(data));
                    })
                        .on("end", function () {
                        if (row !== "all") {
                            callBack(rows_4.filter(function (r) { return row(r); }));
                        }
                        else {
                            callBack(rows_4);
                        }
                    });
                }
                else {
                    t._levelDBs[tableName].get(String(row), function (err, data) {
                        if (err) {
                            callBack([null]);
                        }
                        else {
                            callBack([JSON.parse(data)]);
                        }
                    });
                }
                break;
        }
    };
    _NanoSQL_Storage.prototype._clearAll = function (callBack) {
        var t = this;
        t._savedArgs._onSuccess = callBack;
        t._savedArgs._onFail = function () { };
        switch (t._mode) {
            case 0:
                t.init(t._parent, t._savedArgs);
                break;
            case 1:
                indexedDB.deleteDatabase(String(t._parent._databaseID)).onsuccess = function () {
                    t.init(t._parent, t._savedArgs);
                };
                break;
            case 2:
                localStorage.clear();
                t.init(t._parent, t._savedArgs);
                break;
            /*case 3: // WebSQL
                t._webSQLEmpty(() => {
                    t.init(t._parent, t._savedArgs);
                });
            break;*/
            /* NODE-START */
            case 4:
                break;
        }
        if (callBack)
            callBack(true);
    };
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
    _NanoSQL_Storage.prototype._utility = function (type, key, value) {
        if (type === "r") {
            if (this._utilityTable[key]) {
                return this._utilityTable[key].value;
            }
            else {
                return null;
            }
        }
        else {
            this._upsert("_utility", key, { key: key, value: value });
            this._utility[key] = {
                key: key,
                value: value
            };
            return value;
        }
    };
    /**
     * Get the current selected table
     *
     * @returns
     *
     * @memberOf _NanoSQL_Storage
     */
    _NanoSQL_Storage.prototype._getTable = function () {
        return this._tables[this._parent._selectedTable];
    };
    /**
     * Setup a new table.
     *
     * @param {string} tableName
     * @param {DataModel[]} dataModels
     * @returns {string}
     *
     * @memberOf _NanoSQL_Storage
     */
    _NanoSQL_Storage.prototype._newTable = function (tableName, dataModels) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
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
        var i = t._models[ta].length;
        var keys = [];
        var defaults = [];
        while (i--) {
            var p = t._models[ta][i];
            t._tables[ta]._keys.unshift(p.key);
            t._tables[ta]._defaults[i] = p.default;
            if (p.props && p.props.indexOf("pk") >= 0) {
                t._tables[ta]._pk = p.key;
                t._tables[ta]._pkType = p.type;
            }
        }
        return tableName;
    };
    /**
     * User agent sniffing to discover if we're running in Safari
     *
     * @returns
     *
     * @memberOf _NanoSQLImmuDB
     */
    _NanoSQL_Storage.prototype._safari = function () {
        return typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    };
    /**
     * User agent sniffing to discover if we're on an iOS device.
     *
     * @returns {boolean}
     *
     * @memberOf _NanoSQLImmuDB
     */
    _NanoSQL_Storage.prototype._iOS = function () {
        var iDevices = [
            "iPad",
            "iPhone",
            "iPod"
        ];
        if (typeof navigator !== "undefined" && !!navigator.platform) {
            while (iDevices.length) {
                if (navigator.platform.indexOf(iDevices.pop()) !== -1)
                    return true;
            }
        }
        return false;
    };
    return _NanoSQL_Storage;
}());
exports._NanoSQL_Storage = _NanoSQL_Storage;
/**
 * Query module called for each database execution to get the desired result on the data.
 *
 * @internal
 * @class _NanoSQLQuery
 */
// tslint:disable-next-line
var _NanoSQLQuery = (function () {
    function _NanoSQLQuery(database) {
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
    _NanoSQLQuery.prototype._doQuery = function (query, callBack) {
        var _this = this;
        var t = this;
        t._mod = [];
        t._act = undefined;
        var simpleQuery = [];
        query._query.forEach(function (q) {
            if (["upsert", "select", "delete", "drop"].indexOf(q.type) >= 0) {
                t._act = q; // Query Action
                if (q.type === "select")
                    t._queryHash = index_1.NanoSQLInstance._hash(JSON.stringify(query._query));
            }
            else if (["show tables", "describe"].indexOf(q.type) >= 0) {
                simpleQuery.push(q);
            }
            else {
                t._mod.push(q); // Query Modifiers
            }
        });
        if (simpleQuery.length) {
            switch (simpleQuery[0].type) {
                case "show tables":
                    callBack();
                    query._onSuccess([{ tables: Object.keys(this._db._store._tables).map(function (ta) { return _this._db._store._tables[ta]._name; }) }], "info", []);
                    break;
                case "describe":
                    var getTable_1;
                    var tableName_1 = this._db._selectedTable;
                    var rows = {};
                    Object.keys(this._db._store._tables).forEach(function (ta) {
                        if (parseInt(ta) === _this._db._selectedTable) {
                            getTable_1 = index_1._assign(_this._db._store._models[ta]);
                            tableName_1 = _this._db._store._tables[ta]._name;
                        }
                    });
                    rows[tableName_1] = getTable_1;
                    callBack();
                    query._onSuccess([rows], "info", []);
                    break;
            }
        }
        else {
            t._execQuery(function (result, changeType, affectedRows) {
                query._onSuccess(result, changeType, affectedRows);
                callBack(t);
            });
        }
    };
    /**
     * Get a query modifier (where/orderby/etc...)
     *
     * @internal
     * @param {string} name
     * @returns {(QueryLine|undefined)}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._getMod = function (name) {
        return this._mod.filter(function (v) { return v.type === name; }).pop();
    };
    ;
    /**
     * Starting query method, sets up initial environment for the query and sets it off.
     *
     * @internal
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     * @returns {void}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._execQuery = function (callBack) {
        var _this = this;
        var t = this;
        if (!t._act)
            return;
        var doQuery = function (rows) {
            if (!t._act)
                return;
            switch (t._act.type) {
                case "upsert":
                    _this._upsert(rows, callBack);
                    break;
                case "select":
                    _this._select(rows, callBack);
                    break;
                case "drop":
                case "delete":
                    _this._remove(rows, callBack);
                    break;
            }
        };
        var tableName = this._db._store._tables[t._db._selectedTable]._name;
        if (!t._getMod("join") && t._act.type !== "drop") {
            if (t._getMod("where")) {
                // We can do the where filtering now if there's no join command and we're using a query that might have a where statement
                t._db._store._read(tableName, function (row) {
                    return row && t._where(row, t._getMod("where").args);
                }, function (rows) {
                    doQuery(rows);
                });
            }
            else {
                if (t._act && t._act.type !== "upsert") {
                    t._db._store._read(tableName, "all", function (rows) {
                        doQuery(rows);
                    });
                }
                else {
                    doQuery([]);
                }
            }
        }
        else {
            doQuery([]);
        }
    };
    /**
     * Updates a given row with a specific value, also updates the history for that row as needed.
     *
     * @internal
     * @param {string} rowPK
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._updateRow = function (rowPK, callBack) {
        var t = this;
        var tableName = t._db._store._getTable()._name;
        t._db._store._read(tableName, rowPK, function (rows) {
            var newRow = {};
            var oldRow = rows[0] || {};
            var qArgs = t._act.args;
            var updateType = (function () {
                if (t._act) {
                    if (t._act.type === "delete" && !qArgs.length) {
                        return "drop";
                    }
                }
                return t._act ? t._act.type : "";
            })();
            var doRemove = false;
            switch (updateType) {
                case "upsert":
                    newRow = oldRow ? index_1._assign(oldRow) : {};
                    /*if(!t._db._doingTransaction) {
                        newRow = oldRow ? _assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                    } else {
                        newRow = oldRow || {};
                    }*/
                    Object.keys(qArgs).forEach(function (k) {
                        newRow[k] = qArgs[k];
                    });
                    // Add default values
                    t._db._store._getTable()._keys.forEach(function (k, i) {
                        var def = t._db._store._getTable()._defaults[i];
                        if (!newRow[k] && def)
                            newRow[k] = def;
                    });
                    break;
                case "delete":
                    newRow = oldRow ? index_1._assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                    if (qArgs && qArgs.length) {
                        qArgs.forEach(function (column) {
                            newRow[column] = null;
                        });
                    }
                    else {
                        doRemove = true;
                        newRow = {};
                    }
                    break;
            }
            var finishUpdate = function () {
                if (tableName.indexOf("_") !== 0 && t._db._store._doHistory) {
                    t._db._store._read("_" + tableName + "_hist__meta", parseInt(rowPK), function (rows) {
                        rows[0]._historyDataRowIDs.unshift(len);
                        t._db._store._upsert("_" + tableName + "_hist__meta", parseInt(rowPK), rows[0]);
                    });
                }
                // 3. Move new row data into place on the active table
                // Apply changes to the store
                if (updateType === "upsert") {
                    t._db._store._upsert(tableName, rowPK, newRow, function () {
                        callBack();
                    });
                }
                else {
                    t._db._store._delete(tableName, rowPK, function () {
                        callBack();
                    });
                }
            };
            // Add to history
            var len = 0; // 0 index contains a null reference used by all rows;
            if (!doRemove && tableName.indexOf("_") !== 0 && t._db._store._doHistory) {
                // 1. copy new row data into histoy data table
                t._db._store._upsert("_" + tableName + "_hist__data", null, newRow, function (rowID) {
                    len = parseInt(rowID);
                    finishUpdate();
                });
            }
            else {
                finishUpdate();
            }
        });
    };
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
    _NanoSQLQuery.prototype._tableChanged = function (updatedRowPKs, describe, callBack) {
        var _this = this;
        var t = this, k = 0, j = 0;
        if (updatedRowPKs.length > 0) {
            var completeChange_1 = function () {
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
                        rowKeys: updatedRowPKs.map(function (r) { return parseInt(r); }),
                        type: describe
                    }, function (rowID) {
                        var table = t._db._store._tables[_this._db._selectedTable];
                        t._db._invalidateCache(t._db._selectedTable, [], "");
                        t._db._store._read(table._name, function (row) {
                            return row && updatedRowPKs.indexOf(row[table._pk]) !== -1;
                        }, function (rows) {
                            callBack([{ msg: updatedRowPKs.length + " row(s) " + describe }], describe, rows);
                        });
                    });
                }
                else {
                    var table_2 = t._db._store._tables[_this._db._selectedTable];
                    t._db._invalidateCache(t._db._selectedTable, [], "");
                    t._db._store._read(table_2._name, function (row) {
                        return row && updatedRowPKs.indexOf(row[table_2._pk]) !== -1;
                    }, function (rows) {
                        callBack([{ msg: updatedRowPKs.length + " row(s) " + describe }], describe, rows);
                    });
                }
            };
            if (t._db._store._doHistory) {
                // Remove history points ahead of the current one if the database has changed
                if (t._db._store._historyPoint > 0 && t._db._store._doingTransaction !== true) {
                    t._db._store._read("_historyPoints", function (hp) {
                        if (hp.historyPoint > t._db._store._historyLength - t._db._store._historyPoint)
                            return true;
                        return false;
                    }, function (historyPoints) {
                        j = 0;
                        var nextPoint = function () {
                            if (j < historyPoints.length) {
                                var tableName_2 = t._db._store._tables[historyPoints[j].tableID]._name;
                                k = 0;
                                var nextRow_2 = function () {
                                    if (k < historyPoints[j].rowKeys.length) {
                                        // Set this row history pointer to 0;
                                        t._db._store._read("_" + tableName_2 + "_hist__meta", historyPoints[j].rowKeys[k], function (rows) {
                                            rows[0] = index_1._assign(rows[0]);
                                            rows[0]._pointer = 0;
                                            var del = rows[0]._historyDataRowIDs.shift(); // Shift off the most recent update
                                            t._db._store._upsert("_" + tableName_2 + "_hist__meta", historyPoints[j].rowKeys[k], rows[0], function () {
                                                if (del) {
                                                    t._db._store._delete("_" + tableName_2 + "_hist__data", del, function () {
                                                        k++;
                                                        nextRow_2();
                                                    });
                                                }
                                                else {
                                                    k++;
                                                    nextRow_2();
                                                }
                                            });
                                        });
                                    }
                                    else {
                                        j++;
                                        nextPoint();
                                    }
                                };
                                t._db._store._delete("_historyPoints", historyPoints[j].id, function () {
                                    nextRow_2();
                                });
                            }
                            else {
                                t._db._store._historyLength -= t._db._store._historyPoint;
                                t._db._store._historyPoint = 0;
                                completeChange_1();
                                return;
                            }
                        };
                        nextPoint();
                    });
                }
                else {
                    completeChange_1();
                }
            }
            else {
                completeChange_1();
            }
        }
        else {
            callBack([{ msg: "0 rows " + describe }], describe, []);
        }
    };
    ;
    /**
     * Add/modify records to a specific table based on query parameters.
     *
     * @internal
     * @param {DBRow[]} queryRows
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._upsert = function (queryRows, callBack) {
        var t = this;
        var scribe = "", i, changedPKs = [];
        var qArgs = t._act.args || {}, table = t._db._store._getTable(), pk = table._pk, whereMod = t._getMod("where");
        if (whereMod) {
            scribe = "modified";
            changedPKs = queryRows.map(function (r) { return r[table._pk]; });
            i = 0;
            var update_1 = function () {
                if (i < queryRows.length) {
                    t._updateRow(queryRows[i][pk], function () {
                        i++;
                        update_1();
                    });
                }
                else {
                    t._tableChanged(changedPKs, scribe, callBack);
                }
            };
            update_1();
        }
        else {
            scribe = "inserted";
            if (!qArgs[pk]) {
                if (table._pkType === "int") {
                    qArgs[pk] = table._incriment++;
                }
                else if (table._pkType === "uint") {
                    qArgs[pk] = index_1.NanoSQLInstance.uuid();
                }
            }
            else {
                if (table._pkType === "int") {
                    table._incriment = Math.max(qArgs[pk] + 1, table._incriment);
                }
            }
            var objPK = qArgs[pk] ? String(qArgs[pk]) : String(table._index.length);
            changedPKs = [objPK];
            // Entirely new row, setup all the needed stuff for it.
            if (table._index.indexOf(objPK) === -1) {
                // History
                var tableName = this._db._store._tables[t._db._selectedTable]._name;
                if (tableName.indexOf("_") !== 0) {
                    var histTable = "_" + tableName + "_hist__meta";
                    t._db._store._upsert(histTable, objPK, {
                        _pointer: 0,
                        _historyDataRowIDs: [0]
                    });
                }
                // Index
                table._index.push(objPK);
            }
            t._updateRow(objPK, function () {
                t._tableChanged(changedPKs, scribe, callBack);
            });
        }
    };
    /**
     * Get the table ID for query commands, used to intelligently switch between joined tables and the regular ones.
     *
     * @internal
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._getTableID = function () {
        return this._joinTable ? this._joinTable : this._db._selectedTable;
    };
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
    _NanoSQLQuery.prototype._select = function (queryRows, callBack) {
        var t = this;
        // Memoization
        if (t._db._queryCache[t._db._selectedTable][t._queryHash]) {
            callBack(t._db._queryCache[t._db._selectedTable][t._queryHash], "none", []);
            return;
        }
        var mods = ["join", "groupby", "having", "orderby", "offset", "limit"];
        var curMod, column, i, k, rows, obj, rowData, groups = {};
        var sortObj = function (objA, objB, columns) {
            return Object.keys(columns).reduce(function (prev, cur) {
                if (!prev) {
                    if (objA[cur] === objB[cur])
                        return 0;
                    return (objA[cur] > objB[cur] ? 1 : -1) * (columns[cur] === "desc" ? -1 : 1);
                }
                else {
                    return prev;
                }
            }, 0);
        };
        var modifyQuery = function (tableIndex, modIndex, next) {
            curMod = t._getMod(mods[modIndex]);
            // After GROUP BY command apply functions and AS statements
            if (modIndex === 2) {
                var functions_1 = [];
                if (qArgs.length) {
                    var funcs_1 = Object.keys(_functions).map(function (f) { return f + "("; });
                    var keepColumns_1 = [];
                    functions_1 = qArgs.filter(function (q) {
                        var hasFunc = funcs_1.reduce(function (prev, cur) {
                            return (q.indexOf(cur) < 0 ? 0 : 1) + prev;
                        }, 0) || 0;
                        if (hasFunc > 0) {
                            return true;
                        }
                        else {
                            keepColumns_1.push(q);
                            return false;
                        }
                    }).map(function (selectString) {
                        var regex = selectString.match(/(.*)\((.*)\)/);
                        var funcName = regex[1].trim();
                        var columnName = (selectString.match(/\sAS\s(.*)/) || []).pop() || funcName;
                        var args = regex[2].split(",").map(function (s) { return s.trim(); });
                        if (_functions[funcName].type === "simple" && columnName === funcName) {
                            columnName = args[0];
                        }
                        keepColumns_1.push(columnName);
                        return {
                            name: funcName,
                            args: args,
                            as: columnName.trim(),
                            type: _functions[funcName].type
                        };
                    });
                    var rows_5 = [];
                    if (functions_1.length) {
                        var prevFunc_1;
                        var doFunctions_1 = function (rows) {
                            return functions_1.sort(function (a, b) {
                                return a.type > b.type ? 1 : -1;
                            }).reduce(function (prev, curr) {
                                var len = prev.length - 1;
                                if (curr.type === "aggregate") {
                                    var newRows = rows.slice();
                                    len = newRows.length - 1;
                                    newRows = [newRows.reduce(function (p, v, i) {
                                            return _functions[curr.name].call(v, curr.args, [i, len], p);
                                        }, {})];
                                    if (prevFunc_1) {
                                        newRows[0][prevFunc_1] = prev[0][prevFunc_1];
                                    }
                                    prev = newRows;
                                    prevFunc_1 = curr.name;
                                }
                                else {
                                    prev = prev.map(function (v, i) {
                                        return _functions[curr.name].call(v, curr.args, [i, len]);
                                    });
                                }
                                if (curr.name !== curr.as) {
                                    keepColumns_1.push(curr.name + " AS " + curr.as);
                                }
                                else {
                                    keepColumns_1.push(curr.name);
                                }
                                return prev;
                            }, rows.slice());
                        };
                        var groupKeys = Object.keys(groups);
                        if (groupKeys.length) {
                            rows_5 = groupKeys
                                .map(function (k) { return doFunctions_1(groups[k]); }) // Apply each function to each group (N^2)
                                .reduce(function (prev, curr) {
                                return prev = prev.concat(curr), prev;
                            }, []);
                        }
                        else {
                            rows_5 = doFunctions_1(tableIndex);
                        }
                    }
                    else {
                        rows_5 = tableIndex;
                    }
                    var convertKeys_1 = keepColumns_1.map(function (n) {
                        return n.match(/(.*)\sAS\s(.*)/) || n;
                    }).filter(function (n) { return n; }) || [];
                    if (convertKeys_1.length) {
                        rows_5 = rows_5.map(function (r) {
                            r = index_1._assign(r);
                            var newRow = {};
                            convertKeys_1.forEach(function (key) {
                                if (typeof key === "string") {
                                    newRow[key] = r[key];
                                }
                                else {
                                    newRow[key[2]] = r[key[1]];
                                }
                            });
                            return newRow;
                        });
                    }
                    tableIndex = rows_5;
                }
            }
            if (!curMod)
                return next(tableIndex);
            switch (modIndex) {
                case 0:
                    var joinConditions = void 0;
                    if (curMod.args.type !== "cross") {
                        joinConditions = {
                            _left: curMod.args.where[0].split(".").pop(),
                            _check: curMod.args.where[1],
                            _right: curMod.args.where[2].split(".").pop()
                        };
                    }
                    var leftTableID = t._db._selectedTable;
                    var rightTableID = index_1.NanoSQLInstance._hash(curMod.args.table);
                    var where_1 = t._getMod("where");
                    t._join(curMod.args.type, leftTableID, rightTableID, joinConditions, function (joinedRows) {
                        if (where_1) {
                            next(joinedRows.filter(function (row) {
                                return t._where(row, where_1.args);
                            }));
                        }
                        else {
                            next(joinedRows);
                        }
                    });
                    break;
                case 1:
                    var columns_1 = curMod.args;
                    var sortGroups_1 = {};
                    if (columns_1) {
                        groups = tableIndex.reduce(function (prev, curr) {
                            var key = Object.keys(columns_1).reduce(function (p, c) { return p + "." + String(curr[c]); }, "").slice(1);
                            (prev[key] = prev[key] || []).push(curr);
                            sortGroups_1[key] = Object.keys(columns_1).reduce(function (pr, cu) {
                                pr[cu] = curr[cu];
                                return pr;
                            }, {});
                            return prev;
                        }, {});
                        next(Object.keys(groups).sort(function (a, b) {
                            return sortObj(sortGroups_1[a], sortGroups_1[b], columns_1);
                        }).reduce(function (prev, curr) {
                            return prev.concat(groups[curr]);
                        }, []));
                    }
                    else {
                        next(tableIndex);
                    }
                    break;
                case 2:
                    next(tableIndex.filter(function (row) {
                        return t._where(row, t._getMod("having").args);
                    }));
                    break;
                case 3:
                    next(tableIndex.sort(function (a, b) {
                        return sortObj(a, b, curMod.args);
                    }));
                    break;
                case 4:
                    next(tableIndex.filter(function (row, index) {
                        return curMod ? index >= curMod.args : true;
                    }));
                    break;
                case 5:
                    next(tableIndex.filter(function (row, index) {
                        return curMod ? index < curMod.args : true;
                    }));
                    break;
            }
        };
        i = -1;
        var qArgs = t._act.args || [];
        var stepQuery = function (rowPKs) {
            if (i < mods.length) {
                i++;
                modifyQuery(rowPKs, i, function (resultRows) {
                    stepQuery(resultRows);
                });
            }
            else {
                rowPKs = rowPKs.filter(function (r) { return r; });
                if (!t._getMod("join")) {
                    t._db._queryCache[t._db._selectedTable][t._queryHash] = rowPKs;
                }
                callBack(rowPKs, "none", []);
            }
        };
        stepQuery(queryRows);
    };
    /**
     * Removes elements from the currently selected table based on query conditions.
     *
     * @internal
     * @param {DBRow[]} queryRows
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._remove = function (queryRows, callBack) {
        var scribe = "deleted", i;
        var t = this;
        var qArgs = t._act.args || [];
        var pk = this._db._store._getTable()._pk;
        i = 0;
        var remove = function () {
            if (i < queryRows.length) {
                t._updateRow(queryRows[i][pk], function () {
                    i++;
                    remove();
                });
            }
            else {
                if (qArgs.length)
                    scribe = "modified";
                t._tableChanged(queryRows.map(function (r) { return r[pk]; }), scribe, callBack);
            }
        };
        remove();
    };
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
    _NanoSQLQuery.prototype._where = function (row, conditions) {
        var t = this;
        var commands = ["AND", "OR"];
        if (typeof conditions[0] !== "string") {
            var prevCmd_1;
            return conditions.reduce(function (prev, cur, i) {
                if (commands.indexOf(cur) !== -1) {
                    prevCmd_1 = cur;
                    return prev;
                }
                else {
                    var compare = t._compare(cur[2], cur[1], row[cur[0]]) === 0 ? true : false;
                    if (i === 0)
                        return compare;
                    if (prevCmd_1 === "AND") {
                        return prev && compare;
                    }
                    else {
                        return prev || compare;
                    }
                }
            }, true);
        }
        else {
            return t._compare(conditions[2], conditions[1], row[conditions[0]]) === 0 ? true : false;
        }
    };
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
    _NanoSQLQuery.prototype._join = function (type, leftTableID, rightTableID, joinConditions, complete) {
        var L = "left";
        var R = "right";
        var O = "outer";
        var joinHelper = {};
        var t = this;
        var leftTableData = t._db._store._tables[leftTableID];
        var rightTableData = t._db._store._tables[rightTableID];
        var doJoinRows = function (leftRow, rightRow) {
            return [leftTableData, rightTableData].reduce(function (prev, cur, i) {
                cur._keys.forEach(function (k) {
                    prev[cur._name + "." + k] = ((i === 0 ? leftRow : rightRow) || {})[k];
                });
                return prev;
            }, {});
        };
        var joinTable = [];
        var rightUsedPKs = [];
        t._db._store._read(leftTableData._name, "all", function (leftRows) {
            t._db._store._read(rightTableData._name, "all", function (rightRows) {
                leftRows.forEach(function (leftRow) {
                    var joinRows = rightRows.filter(function (rightRow) {
                        if (!joinConditions)
                            return true;
                        var joinedRow = doJoinRows(leftRow, rightRow);
                        var keep = t._where(joinedRow, [joinConditions._left, joinConditions._check, joinConditions._right]);
                        if (keep)
                            rightUsedPKs.push(rightRow[rightTableData._pk]);
                        return keep;
                    });
                    if (joinRows.length) {
                        joinTable = joinTable.concat(joinRows);
                    }
                    else if ([L, O].indexOf(type) >= 0) {
                        joinTable.push(doJoinRows(leftRow, null));
                    }
                });
                rightUsedPKs = rightUsedPKs.sort().filter(function (item, pos, ary) {
                    return !pos || item !== ary[pos - 1];
                });
                // If this is a RIGHT or OUTER join we're going to add the right side rows that haven't been used.
                if ([R, O].indexOf(type) >= 0) {
                    rightRows.filter(function (r) {
                        return rightUsedPKs.indexOf(r[rightTableData._pk]) === -1;
                    }).forEach(function (rightRow) {
                        joinTable.push(doJoinRows(null, rightRow));
                    });
                }
                complete(joinTable);
            });
        });
    };
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
    _NanoSQLQuery.prototype._compare = function (val1, compare, val2) {
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
    };
    return _NanoSQLQuery;
}());
