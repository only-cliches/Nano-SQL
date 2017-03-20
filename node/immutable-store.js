"use strict";
var index_1 = require("./index");
var lie_ts_1 = require("lie-ts");
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
    if (ptr[0] == 0)
        prev[key] = type == -1 ? Number.MAX_VALUE : Number.MIN_VALUE;
    var nextRow = {};
    if (type == -1 ? parseFloat(row[key]) < parseFloat(prev[key]) : parseFloat(row[key]) > parseFloat(prev[key])) {
        nextRow = row;
    }
    else {
        nextRow = prev;
    }
    if (ptr[0] === ptr[1]) {
        var r = index_1._assign(nextRow);
        r[type == -1 ? "MIN" : "MAX"] = nextRow[key];
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
            if (ptr[0] == 0)
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
            if (ptr[0] == 0)
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
            if (ptr[0] == 0)
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
    _NanoSQLImmuDB.prototype._getRow = function (tableID, primaryKey) {
        return this._tables[tableID]._rows[primaryKey][this._tables[tableID]._historyPointers[primaryKey]];
    };
    _NanoSQLImmuDB.prototype._getTable = function () {
        return this._tables[this._selectedTable];
    };
    _NanoSQLImmuDB.prototype._newTable = function (tableName, dataModels) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        t._models[ta] = dataModels;
        t._queryCache[ta] = {};
        t._tables[ta] = {
            _pk: "",
            _pkType: "",
            _keys: [],
            _defaults: [],
            _name: tableName,
            _incriment: 1,
            _index: [],
            _historyPointers: {},
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
     * Called once to init the database, prep all the needed variables and data models
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf _NanoSQLImmuDB
     */
    _NanoSQLImmuDB.prototype._connect = function (connectArgs) {
        var t = this;
        var i = 0;
        var p;
        var tables = [];
        var upgrading = false;
        var index = 0;
        t._parent = connectArgs._parent;
        t._persistent = connectArgs._config.length ? connectArgs._config[0].persistent || false : false;
        Object.keys(connectArgs._models).forEach(function (tableName) {
            tables.push(t._newTable(tableName, connectArgs._models[tableName]));
        });
        t._databaseID = index_1.NanoSQLInstance._hash(JSON.stringify(connectArgs._models));
        Object.keys(connectArgs._functions || []).forEach(function (f) {
            _functions[f] = connectArgs._functions[f];
        });
        if (t._persistent && typeof indexedDB !== "undefined") {
            var idb = indexedDB.open(String(t._databaseID), 1);
            // Called only when there is no existing DB, creates the tables and data store.
            idb.onupgradeneeded = function (event) {
                upgrading = true;
                var db = event.target.result;
                var next = function () {
                    if (index < tables.length) {
                        var ta = index_1.NanoSQLInstance._hash(tables[index]);
                        var config = t._tables[ta]._pk ? { keyPath: t._tables[ta]._pk } : {};
                        db.createObjectStore(tables[index], config);
                        index++;
                        next();
                    }
                    else {
                        connectArgs._onSuccess();
                    }
                };
                next();
            };
            // Called once the database is connected and working
            idb.onsuccess = function (event) {
                t._indexedDB = event.target.result;
                // Called to import existing indexed DB data into the store.
                if (!upgrading) {
                    var next_1 = function () {
                        if (index < tables.length) {
                            var ta = index_1.NanoSQLInstance._hash(tables[index]);
                            var transaction = t._indexedDB.transaction(tables[index], "readonly");
                            var store = transaction.objectStore(tables[index]);
                            var cursorRequest = store.openCursor();
                            var items_1 = [];
                            transaction.oncomplete = function () {
                                t._parent.table(tables[index]).loadJS(items_1).then(function () {
                                    index++;
                                    next_1();
                                });
                            };
                            cursorRequest.onsuccess = function (evt) {
                                var cursor = evt.target.result;
                                if (cursor) {
                                    items_1.push(cursor.value);
                                    cursor.continue();
                                }
                            };
                        }
                        else {
                            connectArgs._onSuccess();
                        }
                    };
                    next_1();
                }
                ;
            };
        }
        else {
            connectArgs._onSuccess();
        }
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
    _NanoSQLImmuDB.prototype._invalidateCache = function (changedRows, type, action) {
        var t = this;
        t._queryCache[t._selectedTable] = {};
        if (changedRows.length && action) {
            t._parent.triggerEvent({
                name: "change",
                actionOrView: "",
                table: t._getTable()._name,
                query: [],
                time: new Date().getTime(),
                result: [{ msg: action + " was performed.", type: action }],
                changedRows: changedRows,
                changeType: type
            }, ["change"]);
        }
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
        var rowID;
        var rowData;
        var rowKey;
        var store;
        if (t._indexedDB && t._getTable()) {
            store = t._indexedDB.transaction(t._getTable()._name, "readwrite").objectStore(t._getTable()._name);
        }
        var shiftRowIDs = function (direction) {
            var tableID = t._historyRecords[t._historyPoint]._tableID;
            i = t._historyRecords[t._historyPoint]._rowKeys.length;
            var rows = [];
            while (i--) {
                rowID = t._historyRecords[t._historyPoint]._rowKeys[i];
                if (t._tables[tableID]._pkType === "int")
                    rowID = parseInt(rowID);
                rowData = t._getRow(tableID, rowID) || {};
                if (direction > 0)
                    rows.push(rowData);
                t._tables[tableID]._historyPointers[rowID] += direction;
                rowData = t._getRow(tableID, rowID);
                if (direction < 0)
                    rows.push(t._getRow(tableID, rowID));
                if (store) {
                    if (rowData) {
                        store.put(rowData);
                    }
                    else {
                        store.delete(rowID);
                    }
                }
                if (t._tables[tableID]._historyPointers[rowID] < 0)
                    t._tables[tableID]._historyPointers[rowID] = 0;
            }
            return rows;
        };
        return new lie_ts_1.Promise(function (res, rej) {
            switch (command) {
                case "<":
                    if (!t._historyRecords.length || t._historyPoint === t._historyRecords.length) {
                        res(false);
                    }
                    else {
                        var rows = shiftRowIDs(1);
                        var description = t._historyRecords[t._historyPoint]._type;
                        t._historyPoint++;
                        switch (description) {
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
                    if (!t._historyRecords.length || t._historyPoint < 1) {
                        res(false);
                    }
                    else {
                        t._historyPoint--;
                        var rows = shiftRowIDs(-1);
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
    };
    return _NanoSQLImmuDB;
}());
exports._NanoSQLImmuDB = _NanoSQLImmuDB;
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
                    query._onSuccess([{ tables: Object.keys(this._db._tables).map(function (ta) { return _this._db._tables[ta]._name; }) }], "info", []);
                    break;
                case "describe":
                    var getTable_1;
                    var tableName_1 = this._db._selectedTable;
                    var rows = {};
                    Object.keys(this._db._tables).forEach(function (ta) {
                        if (parseInt(ta) === _this._db._selectedTable) {
                            getTable_1 = index_1._assign(_this._db._models[ta]);
                            tableName_1 = _this._db._tables[ta]._name;
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
     * Recursively freezes a js object, used to prevent the rows from being edited once they're added.
     *
     * @internal
     * @param {*} obj
     * @returns {*}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._deepFreeze = function (obj) {
        var _this = this;
        this._db._models[this._db._selectedTable].forEach(function (model) {
            var prop = obj[model.key];
            if (["map", "array"].indexOf(typeof prop) >= 0) {
                obj[model.key] = _this._deepFreeze(prop);
            }
        });
        return Object.freeze(obj);
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
     * Handle transactions
     *
     * @param {string} type
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._transaction = function (type) {
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
    _NanoSQLQuery.prototype._execQuery = function (callBack) {
        var t = this;
        if (!t._act)
            return;
        var queryIndex = [];
        if (!t._getMod("join") && t._act.type !== "drop") {
            if (t._getMod("where")) {
                // We can do the where filtering now if there's no join command and we're using a query that might have a where statement
                queryIndex = t._where(t._db._selectedTable, t._db._getTable()._index.slice(), t._getMod("where").args);
            }
            else {
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
    };
    /**
     * Updates a given row with a specific value, also updates the history for that row as needed.
     *
     * @internal
     * @param {string} rowPK
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._updateRow = function (rowPK) {
        var t = this;
        var newRow;
        var oldRow = t._db._getRow(t._db._selectedTable, rowPK);
        var qArgs = t._act.args;
        var updateType = (function () {
            if (t._act) {
                if (t._act.type === "delete" && !qArgs.length) {
                    return "drop";
                }
            }
            return t._act ? t._act.type : "";
        })();
        switch (updateType) {
            case "upsert":
                if (!t._db._disableHistoryAndCache) {
                    newRow = oldRow ? index_1._assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                }
                else {
                    newRow = oldRow || {};
                }
                Object.keys(qArgs).forEach(function (k) {
                    newRow[k] = qArgs[k];
                });
                // Add default values
                t._db._getTable()._keys.forEach(function (k, i) {
                    var def = t._db._getTable()._defaults[i];
                    if (!newRow[k] && def)
                        newRow[k] = def;
                });
                break;
            case "delete":
                newRow = oldRow ? index_1._assign(oldRow) : {}; // Perform a deep copy of the existing row so we can modify it.
                qArgs.forEach(function (column) {
                    newRow[column] = null;
                });
                break;
        }
        // Add the row to the history
        if (!t._db._disableHistoryAndCache) {
            t._db._getTable()._rows[rowPK].unshift(newRow ? t._deepFreeze(newRow) : null);
        }
        else {
            t._db._getTable()._rows[rowPK][t._db._getTable()._historyPointers[rowPK]] = t._deepFreeze(newRow);
        }
        // Apply changes to the indexed DB.
        if (t._db._indexedDB) {
            var tableName = t._db._getTable()._name;
            var transaction = t._db._indexedDB.transaction(tableName, "readwrite").objectStore(tableName);
            if (updateType === "upsert") {
                transaction.put(newRow);
            }
            else {
                transaction.delete(rowPK);
            }
        }
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
        var t = this, k;
        if (updatedRowPKs.length > 0) {
            // Remove history points ahead of the current one if the database has changed
            if (t._db._historyPoint > 0 && t._db._disableHistoryAndCache !== true) {
                t._db._historyRecords = t._db._historyRecords.filter(function (val, index) {
                    if (index < t._db._historyPoint) {
                        k = val._rowKeys.length;
                        while (k--) {
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
            if (!t._db._disableHistoryAndCache) {
                t._db._historyRecords.unshift({
                    _tableID: t._db._selectedTable,
                    _rowKeys: updatedRowPKs,
                    _type: describe
                });
            }
            t._db._invalidateCache([], "");
            callBack([{ msg: updatedRowPKs.length + " row(s) " + describe }], describe, updatedRowPKs.map(function (r) { return _this._db._getRow(_this._db._selectedTable, r) || {}; }));
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
     * @param {string[]} queryIndex
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._upsert = function (queryIndex, callBack) {
        var scribe = "", i, changedPKs = [];
        var qArgs = this._act.args || {}, table = this._db._getTable(), pk = table._pk, whereMod = this._getMod("where");
        if (whereMod) {
            scribe = "modified";
            changedPKs = queryIndex;
            i = queryIndex.length;
            while (i--) {
                this._updateRow(queryIndex[i]);
            }
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
            // Entirely new row, make a new index spot for it in the table.
            if (!table._rows[objPK]) {
                table._rows[objPK] = [null];
                table._historyPointers[objPK] = 0;
                table._index.push(objPK);
            }
            this._updateRow(objPK);
        }
        this._tableChanged(changedPKs, scribe, callBack);
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
     * @param {string[]} queryIndex
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._select = function (queryIndex, callBack) {
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
                    if (objA[cur] == objB[cur])
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
            // After JOIN command convert index to row data
            if (modIndex === 1) {
                tableIndex = tableIndex.map(function (index) {
                    return t._db._getRow(t._getTableID(), index);
                }).filter(function (r) { return r; });
            }
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
                    var rows_1 = [];
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
                            rows_1 = groupKeys
                                .map(function (k) { return doFunctions_1(groups[k]); }) // Apply each function to each group (N^2)
                                .reduce(function (prev, curr) {
                                return prev = prev.concat(curr), prev;
                            }, []);
                        }
                        else {
                            rows_1 = doFunctions_1(tableIndex);
                        }
                    }
                    else {
                        rows_1 = tableIndex;
                    }
                    var convertKeys_1 = keepColumns_1.map(function (n) {
                        return n.match(/(.*)\sAS\s(.*)/) || n;
                    }).filter(function (n) { return n; }) || [];
                    if (convertKeys_1.length) {
                        rows_1 = rows_1.map(function (r) {
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
                    tableIndex = rows_1;
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
                    var joinedIndex = t._join(curMod.args.type, leftTableID, t._db._tables[leftTableID]._index.slice(), rightTableID, t._db._tables[rightTableID]._index.slice(), joinConditions);
                    var where = t._getMod("where");
                    if (where) {
                        joinedIndex = t._where(t._getTableID(), joinedIndex, where.args);
                    }
                    next(joinedIndex);
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
                    // Put the records in a table
                    t._db._tables[t._queryHash] = {
                        _defaults: [],
                        _historyPointers: {},
                        _incriment: 0,
                        _index: [],
                        _keys: [],
                        _name: t._queryHash.toString(),
                        _pk: "",
                        _pkType: "",
                        _rows: {}
                    };
                    t._joinTable = t._queryHash;
                    tableIndex.forEach(function (row, i) {
                        t._db._tables[t._queryHash]._historyPointers[i] = 0;
                        t._db._tables[t._queryHash]._rows[i] = [row];
                        t._db._tables[t._queryHash]._index.push(i.toString());
                    });
                    next(t._where(t._queryHash, t._db._tables[t._queryHash]._index, t._getMod("having").args).map(function (i) {
                        return t._db._getRow(t._queryHash, i);
                    }).filter(function (r) { return r; }));
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
                if (!t._getMod("join")) {
                    t._db._queryCache[t._db._selectedTable][t._queryHash] = rowPKs;
                }
                callBack(rowPKs, "none", []);
            }
        };
        stepQuery(queryIndex);
    };
    /**
     * Removes elements from the currently selected table based on query conditions.
     *
     * @internal
     * @param {string[]} queryIndex
     * @param {(result: Array<Object>, changeType: string, affectedRows: DBRow[]) => void} callBack
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype._remove = function (queryIndex, callBack) {
        var scribe = "deleted", i;
        var t = this;
        var qArgs = t._act.args || [];
        i = queryIndex.length;
        while (i--)
            t._updateRow(queryIndex[i]);
        if (qArgs.length)
            scribe = "modified";
        t._tableChanged(queryIndex, scribe, callBack);
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
    _NanoSQLQuery.prototype._where = function (tableID, searchIndex, conditions) {
        var t = this;
        var commands = ["AND", "OR"];
        var doJoin;
        var whereJoin = function (indexes, type) {
            return (indexes[0].concat(indexes[1]).sort().filter(function (item, pos, ary) {
                var last = ary.lastIndexOf(item);
                return type === "OR" ? true : (pos !== last); // if AND, then filter out items that aren't duplicate.
            }));
        };
        var filterRows = function (index, singleWhereStatement) {
            var r;
            return index.filter(function (v) {
                r = t._db._getRow(tableID, v);
                return !r ? false : t._compare(singleWhereStatement[2], singleWhereStatement[1], r[singleWhereStatement[0]]) === 0 ? true : false;
            });
        };
        if (typeof conditions[0] === "string") {
            // Single where statement like ['name','=','billy']
            return filterRows(searchIndex, conditions);
        }
        else {
            // nested where statement like [['name','=','billy'],'or',['name','=','bill']]
            return conditions.map(function (value) {
                return commands.indexOf(value) >= 0 ? value : filterRows(searchIndex.slice(), value);
            }).reduce(function (prev, cur, k) {
                if (commands.indexOf(cur) < 0) {
                    return k === 0 ? cur : whereJoin([prev, cur], doJoin);
                }
                else {
                    doJoin = cur;
                    return prev;
                }
            });
        }
    };
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
    _NanoSQLQuery.prototype._join = function (type, leftTableID, leftIndex, rightTableID, rightIndex, joinConditions) {
        var newTableName = JSON.stringify(joinConditions) || String(leftTableID) + String(rightTableID);
        var L = "left";
        var R = "right";
        var O = "outer";
        var dataModel = [];
        var incriment = 0;
        var joinHelper = {};
        var t = this;
        // Keep track of what right side rows have been added
        var rightIndexUsed = ([R, O].indexOf(type) >= 0) ? rightIndex.slice() : [];
        // Setup the join table model
        [leftTableID, rightTableID].forEach(function (id) {
            var keys = [];
            t._db._models[id].forEach(function (m) {
                keys.push(m.key);
                dataModel.push({
                    key: t._db._tables[id]._name + "." + m.key,
                    type: m.type,
                    default: m.default || null
                });
            });
            joinHelper[id] = {
                _keys: keys,
                _name: t._db._tables[id]._name
            };
        });
        // Make a new table for this join
        t._db._newTable(newTableName, dataModel);
        t._joinTable = index_1.NanoSQLInstance._hash(newTableName);
        // Performs a fast insert in the new table bypassing most of the typical checks
        var joinInsert = function (leftRow, rightRow) {
            var idx = String(incriment++);
            var newRow = {};
            var oldRows = [leftRow, rightRow];
            [leftTableID, rightTableID].forEach(function (id, tableIndex) {
                var row = oldRows[tableIndex];
                joinHelper[id]._keys.forEach(function (key) {
                    newRow[joinHelper[id]._name + "." + key] = row ? row[key] : null;
                });
            });
            t._db._tables[t._joinTable]._index.push(idx);
            t._db._tables[t._joinTable]._historyPointers[idx] = 0;
            t._db._tables[t._joinTable]._rows[idx] = [newRow];
        };
        // Inserts multiple right side rows into the joined table
        var rightInserts = function (leftRow, idxs) {
            idxs.forEach(function (i) {
                if (rightIndexUsed.length) {
                    var pos = rightIndexUsed.indexOf(i);
                    if (pos > 0)
                        rightIndexUsed.splice(pos, 1);
                }
                joinInsert(leftRow, t._db._getRow(rightTableID, i));
            });
        };
        // Perform the N ^ 2 join on both tables, WEE!
        leftIndex.forEach(function (leftI, leftCounter) {
            var leftRow = t._db._getRow(leftTableID, leftI) || {};
            var whereIndex = !joinConditions ? rightIndex.slice() : t._where(rightTableID, rightIndex.slice(), [joinConditions._right, joinConditions._check, leftRow[joinConditions._left]]);
            if (whereIndex.length) {
                rightInserts(leftRow, whereIndex);
            }
            else if ([L, O].indexOf(type) >= 0) {
                joinInsert(leftRow, null);
            }
        });
        // If this is a RIGHT or OUTER join we're going to add the right side rows that haven't been used.
        if (rightIndexUsed.length) {
            rightInserts(null, rightIndexUsed.slice());
        }
        return t._db._tables[t._joinTable]._index.slice();
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
