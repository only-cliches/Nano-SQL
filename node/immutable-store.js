"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var index_1 = require("./index");
var typescript_promise_1 = require("typescript-promise");
var _filters = {
    sum: function (rows) {
        return [{ "sum": rows.map(function (r) {
                    for (var k in r) {
                        return r[k];
                    }
                }).reduce(function (a, b) { return a + b; }, 0) }];
    },
    min: function (rows) {
        return [{ min: rows.map(function (r) {
                    for (var k in r) {
                        return r[k];
                    }
                }).sort(function (a, b) { return a < b ? -1 : 1; })[0] }];
    },
    max: function (rows) {
        return [{ max: rows.map(function (r) {
                    for (var k in r) {
                        return r[k];
                    }
                }).sort(function (a, b) { return a > b ? -1 : 1; })[0] }];
    },
    average: function (rows) {
        return [{ average: _filters["sum"](rows)[0]["sum"] / rows.length }];
    },
    count: function (rows) {
        return [{ count: rows.length }];
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
var _SomeSQLImmuDB = (function () {
    function _SomeSQLImmuDB() {
        var t = this;
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
     * Get a row object from the store based on the current history markers.
     *
     * @public
     * @param {number} rowID
     * @returns {(DBRow|null)}
     *
     * @memberOf _SomeSQLQuery
     */
    _SomeSQLImmuDB.prototype._getRow = function (rowID) {
        return this._rows[rowID][this._historyIDs(rowID)];
    };
    /**
     * Get the IDs of the current history pointers for a given rowID.
     *
     * @public
     * @param {number} rowID
     * @returns
     *
     * @memberOf _SomeSQLQuery
     */
    _SomeSQLImmuDB.prototype._historyIDs = function (rowID) {
        return this._historyPointers[rowID];
    };
    /**
     * Called once to init the database, prep all the needed variables and data models
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf _SomeSQLImmuDB
     */
    _SomeSQLImmuDB.prototype._connect = function (connectArgs) {
        var t = this;
        var i = 0;
        var p;
        var tables = [];
        var upgrading = false;
        t._parent = connectArgs._parent;
        t._persistent = connectArgs._config.length ? connectArgs._config[0].persistent || false : false;
        for (var tableName in connectArgs._models) {
            var ta = index_1.SomeSQLInstance._hash(tableName);
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
        t._databaseID = index_1.SomeSQLInstance._hash(JSON.stringify(connectArgs._models));
        if (connectArgs._filters) {
            for (var f in connectArgs._filters) {
                _filters[f] = connectArgs._filters[f];
            }
        }
        var index = 0;
        if (t._persistent && window && window.indexedDB) {
            var idb = window.indexedDB.open(String(t._databaseID), 1);
            // Called only when there is no existing DB, creates the tables and data store.
            idb.onupgradeneeded = function (event) {
                upgrading = true;
                var db = event.target.result;
                var next = function () {
                    if (index < tables.length) {
                        var ta = index_1.SomeSQLInstance._hash(tables[index]);
                        var config = t._tableInfo[ta]._pk ? { keyPath: t._tableInfo[ta]._pk } : {};
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
                    t.isImporting = true;
                    var next_1 = function () {
                        if (index < tables.length) {
                            var ta = index_1.SomeSQLInstance._hash(tables[index]);
                            var transaction = t._indexedDB.transaction(tables[index], IDBTransaction.READ_ONLY);
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
                            t.isImporting = false;
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
     * Called by SomeSQL to execute queries on this database.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf _SomeSQLImmuDB
     */
    _SomeSQLImmuDB.prototype._exec = function (execArgs) {
        var t = this;
        if (t._pendingQuerys.length) {
            t._pendingQuerys.push(execArgs);
        }
        else {
            t._selectedTable = index_1.SomeSQLInstance._hash(execArgs._table);
            new _SomeSQLQuery(t)._doQuery(execArgs).then(function (query) {
                if (t._pendingQuerys.length) {
                    t._exec(t._pendingQuerys.pop());
                }
            });
        }
    };
    /**
     * Invalidate the query cache cased on the rows being affected
     *
     * @internal
     * @param {boolean} triggerChange
     *
     * @memberOf _SomeSQLImmuDB
     */
    _SomeSQLImmuDB.prototype._invalidateCache = function (triggerChange) {
        var t = this;
        var c = [t._selectedTable];
        var i = t._joinedRelations.length;
        while (i--) {
            if (t._joinedRelations[i].indexOf(t._selectedTable) !== -1) {
                c.concat(t._joinedRelations[i]);
            }
        }
        t._removeDupes(c.sort()).forEach(function (table) {
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
    };
    /**
     * Utility function to remove duplicates from an array.
     *
     * @internal
     * @param {Array<any>} sortedArray
     * @returns {Array<any>}
     *
     * @memberOf _SomeSQLImmuDB
     */
    _SomeSQLImmuDB.prototype._removeDupes = function (sortedArray) {
        return sortedArray.filter(function (item, pos, ary) {
            return !pos || (item !== ary[pos - 1]); // Remove all duplicates.
        });
    };
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
    _SomeSQLImmuDB.prototype._extend = function (db, command) {
        var t = this;
        var i;
        var h;
        var rowID;
        var rowData;
        var rowKey;
        var store = t._indexedDB.transaction(t._tableInfo[t._selectedTable]._name, "readwrite").objectStore(t._tableInfo[t._selectedTable]._name);
        var shiftRowIDs = function (direction) {
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
                    }
                    else {
                        store.delete(rowKey);
                    }
                }
                if (t._historyPointers[rowID] < 0)
                    t._historyPointers[rowID] = 0;
            }
        };
        return new typescript_promise_1.TSPromise(function (res, rej) {
            if (!t._historyRecords.length && (["<", ">"].indexOf(command) !== -1)) {
                res(false);
                return;
            }
            switch (command) {
                case "<":
                    if (t._historyPoint === t._historyRecords.length - 1) {
                        res(false);
                    }
                    else {
                        shiftRowIDs(1);
                        t._historyPoint++;
                        t._invalidateCache(true);
                        res(true);
                    }
                    break;
                case ">":
                    if (t._historyPoint < 1) {
                        res(false);
                    }
                    else {
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
            }
        });
    };
    return _SomeSQLImmuDB;
}());
exports._SomeSQLImmuDB = _SomeSQLImmuDB;
/**
 * Query module called for each database execution to get the desired result on the data.
 *
 * @internal
 * @class _SomeSQLQuery
 */
// tslint:disable-next-line
var _SomeSQLQuery = (function () {
    function _SomeSQLQuery(database) {
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
    _SomeSQLQuery.prototype._doQuery = function (query) {
        var t = this;
        return new typescript_promise_1.TSPromise(function (res, rej) {
            t._mod = [];
            t._act = undefined;
            // t._actionOrView = query._viewOrAction || "";
            t._db._selectedTable = index_1.SomeSQLInstance._hash(query._table);
            // t._viewHash = SomeSQLInstance._hash(query._table + t._actionOrView);
            t._queryHash = index_1.SomeSQLInstance._hash(JSON.stringify(query._query));
            typescript_promise_1.TSPromise.all(query._query.map(function (q) {
                return new typescript_promise_1.TSPromise(function (resolve, reject) {
                    if (["upsert", "select", "delete", "drop"].indexOf(q.type) !== -1) {
                        t._act = q; // Query Action
                    }
                    else {
                        t._mod.push(q); // Query Modifiers
                    }
                    resolve();
                });
            })).then(function () {
                t._execQuery(function (result) {
                    query._onSuccess(result);
                    res(t);
                });
            });
        });
    };
    /**
     * Create a new row and setup the histtory objects for it.
     *
     * @internal
     * @returns {number}
     *
     * @memberOf _SomeSQLQuery
     */
    _SomeSQLQuery.prototype._newRow = function () {
        var t = this;
        var rowID = t._db._rows.length;
        t._db._rows.push([null]);
        t._db._tableInfo[t._db._selectedTable]._index.push(rowID);
        t._db._historyPointers[rowID] = 0;
        return rowID;
    };
    /**
     * Execute queries an immutable storage object.
     *
     * @internal
     * @param {Function} callBack
     * @returns {void}
     *
     * @memberOf _SomeSQLQuery
     */
    _SomeSQLQuery.prototype._execQuery = function (callBack) {
        var t = this;
        if (!t._act)
            return;
        var scribe;
        var pk = t._db._tableInfo[t._db._selectedTable]._pk;
        var qArgs = t._act.args || [];
        var msg = 0;
        var i;
        var k;
        var whereRows = [];
        var changedRowIDs = [];
        var ta = t._db._tableInfo[t._db._selectedTable]._index.slice(); // Copy the table index.
        var rowID;
        var m;
        var mod;
        var mods;
        var curMod;
        var w;
        var keys;
        var column;
        var rowA;
        var rowB;
        var results = [];
        var rowData;
        var obj;
        var hasWhere = t._mod.filter(function (v) {
            return v.type === "where";
        });
        var getMod = function (name) {
            return t._mod.filter(function (v) { return v.type === name; }).pop();
        };
        var tableChanged = function (updateLength, describe) {
            if (updateLength > 0) {
                // Remove history points ahead of the current one if the database has changed
                if (t._db._historyPoint > 0) {
                    t._db._historyRecords = t._db._historyRecords.filter(function (val, index) {
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
                    if (!t._db._historyRecords[0])
                        t._db._historyRecords[0] = [];
                    t._db._historyRecords[0] = t._db._historyRecords[0].concat(changedRowIDs);
                }
                else {
                    t._db._historyRecords.unshift(changedRowIDs);
                }
                t._db._invalidateCache(false);
                callBack([{ msg: updateLength + " row(s) " + describe }]);
            }
            else {
                callBack([{ msg: "0 rows " + describe }]);
            }
        };
        var updateRow = function (rowID, cb) {
            changedRowIDs.push(rowID);
            var newRow = __assign({}, t._db._getRow(rowID) || {});
            // let newRow = JSON.parse(JSON.stringify(t._getRow(rowID) || {}));
            for (var key in qArgs) {
                newRow[key] = cb(key, newRow[key]);
            }
            t._db._rows[rowID].unshift(Object.freeze(newRow));
            if (t._db._indexedDB) {
                var tableName = t._db._tableInfo[t._db._selectedTable]._name;
                t._db._indexedDB.transaction(tableName, "readwrite").objectStore(tableName).put(newRow);
            }
        };
        // We can do the where filtering now if there's no join command and we're using a query that might have a where statement
        if (t._act.type !== "drop") {
            if (hasWhere.length && !getMod("join")) {
                whereRows = t._where(ta, hasWhere[0].args);
            }
            else {
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
                if (hasWhere.length) {
                    msg = i;
                    scribe = "modified";
                    while (i--) {
                        updateRow(whereRows[i], function (key, oldData) {
                            return key !== pk ? qArgs[key] : oldData;
                        });
                    }
                }
                else {
                    rowID = 0;
                    if (qArgs[pk]) {
                        if (t._db._tableInfo[t._db._selectedTable]._pkIndex[qArgs[pk]]) {
                            rowID = t._db._tableInfo[t._db._selectedTable]._pkIndex[qArgs[pk]];
                        }
                        else {
                            rowID = t._newRow();
                            scribe = "inserted";
                            t._db._tableInfo[t._db._selectedTable]._incriment = Math.max(qArgs[pk] + 1, t._db._tableInfo[t._db._selectedTable]._incriment);
                            t._db._tableInfo[t._db._selectedTable]._pkIndex[qArgs[pk]] = rowID;
                        }
                    }
                    else {
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
                                        qArgs[pk] = index_1.SomeSQLInstance.uuid();
                                        break;
                                }
                                rowID = t._newRow();
                                t._db._tableInfo[t._db._selectedTable]._pkIndex[qArgs[pk]] = rowID;
                            }
                        }
                    }
                    updateRow(rowID, function (key, oldData) {
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
                var modifyQuery_1 = function (rows, modIndex) {
                    return new typescript_promise_1.TSPromise(function (res, rej) {
                        curMod = getMod(mods[modIndex]);
                        if (!curMod)
                            return res(rows), false;
                        switch (modIndex) {
                            case 0:
                                t._db._parent.table(curMod.args.table).query("select").exec().then(function (rightRows, db) {
                                    if (!curMod)
                                        return;
                                    w = curMod.args.where.map(function (tableAndColumn, index1) {
                                        return tableAndColumn.split(".").map(function (e, index) {
                                            return index1 !== 1 ? (index === 0 ? index_1.SomeSQLInstance._hash(e) : e) : e;
                                        });
                                    });
                                    var rightTable = t._db._tableInfo[w[2][0]];
                                    rightRows = rightRows.map(function (obj) {
                                        return rightTable._pkIndex[obj[rightTable._pk]];
                                    }).filter(function (r) { return r; });
                                    rows = t._join(curMod.args.type, rows, rightRows, w);
                                    if (hasWhere.length)
                                        rows = t._where(rows, hasWhere[0].args);
                                    res(rows);
                                });
                                break;
                            case 1:
                                res(rows.sort(function (a, b) {
                                    if (!curMod)
                                        return;
                                    keys = [];
                                    for (var key in curMod.args) {
                                        keys.push(key);
                                    }
                                    return keys.reduce(function (prev, cur, i) {
                                        if (!curMod)
                                            return;
                                        column = keys[i];
                                        rowA = t._db._getRow(a) || {};
                                        rowB = t._db._getRow(b) || {};
                                        return ((rowA[column] > rowB[column] ? 1 : -1) * (curMod.args[column] === "asc" ? 1 : -1)) + prev;
                                    }, 0);
                                }));
                                break;
                            case 2:
                                res(rows.filter(function (row, index) {
                                    return curMod ? index >= curMod.args : true;
                                }));
                                break;
                            case 3:
                                res(rows.filter(function (row, index) {
                                    return curMod ? index < curMod.args : true;
                                }));
                                break;
                        }
                    });
                };
                i = mods.length;
                var stepQuery_1 = function (rows) {
                    if (i > -1) {
                        i--;
                        modifyQuery_1(rows, i).then(function (resultRows) {
                            stepQuery_1(resultRows);
                        });
                    }
                    else {
                        rows.forEach(function (row) {
                            if (qArgs.length) {
                                k = qArgs.length;
                                rowData = t._db._getRow(row);
                                if (rowData) {
                                    obj = {};
                                    while (k-- && obj && rowData) {
                                        obj[qArgs[k]] = rowData[qArgs[k]];
                                    }
                                    ;
                                }
                                else {
                                    obj = null;
                                }
                            }
                            else {
                                obj = t._db._getRow(row);
                            }
                            ;
                            if (obj)
                                results.push(obj);
                        });
                        results = t._runFilters(results);
                        t._db._queryCache[t._db._selectedTable][t._queryHash] = results;
                        callBack(t._db._queryCache[t._db._selectedTable][t._queryHash]);
                    }
                };
                stepQuery_1(whereRows);
                break;
            case "drop":
            case "delete":
                var delRows = [];
                if (whereRows.length && t._act.type === "delete") {
                    delRows = whereRows;
                }
                else {
                    delRows = ta;
                }
                scribe = "deleted";
                i = delRows.length;
                var tableName = t._db._tableInfo[t._db._selectedTable]._name;
                while (i--) {
                    if (qArgs.length) {
                        updateRow(delRows[i], function (key, oldData) {
                            return qArgs.indexOf(key) !== -1 ? null : oldData;
                        });
                        scribe = "modified";
                    }
                    else {
                        var rowKey = (t._db._getRow(delRows[i]) || {})[t._db._tableInfo[t._db._selectedTable]._pk];
                        if (t._db._indexedDB && rowKey) {
                            t._db._indexedDB.transaction(tableName, "readwrite").objectStore(tableName).delete(rowKey);
                        }
                        t._db._rows[delRows[i]].unshift(null); // Add "null" to history to show removal.
                        changedRowIDs.push(delRows[i]);
                    }
                }
                tableChanged(i, scribe);
                break;
        }
    };
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
    _SomeSQLQuery.prototype._filterRows = function (index, singleWhereStatement) {
        var t = this;
        var r;
        return index.filter(function (v) {
            r = t._db._getRow(v);
            return !r ? false : t._compare(singleWhereStatement[2], singleWhereStatement[1], r[singleWhereStatement[0]]) === 0 ? true : false;
        });
    };
    ;
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
    _SomeSQLQuery.prototype._where = function (index, combinedWhereStatement) {
        var t = this;
        var commands = ["and", "or"];
        var doJoin;
        var whereJoin = function (indexes, type) {
            return t._db._removeDupes(indexes[0].concat(indexes[1]).sort().filter(function (item, pos, ary) {
                return type === "and" ? (pos !== ary.lastIndexOf(item)) : true; // if AND, then filter out items that aren't duplicate.
            }));
        };
        if (typeof (combinedWhereStatement[0]) === "string") {
            // Single where statement like ['name','=','billy']
            return t._filterRows(index, combinedWhereStatement);
        }
        else {
            // nested where statement like [['name','=','billy'],'or',['name','=','bill']]
            return combinedWhereStatement.map(function (value) {
                return commands.indexOf(value) !== -1 ? value : t._filterRows(index, value);
            }).reduce(function (prev, cur, k) {
                if (commands.indexOf(cur) === -1) {
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
    _SomeSQLQuery.prototype._join = function (type, index1, index2, joinConditions) {
        var t = this;
        var rows = [];
        var joinedIndex = [];
        var tables = [joinConditions[0][0], joinConditions[2][0]];
        var tableNames = [t._db._tableInfo[joinConditions[0][0]]._name, t._db._tableInfo[joinConditions[2][0]]._name];
        var models = [t._db._models[joinConditions[0][0]], t._db._models[joinConditions[2][0]]];
        // [t._selectedTable, pk, "=", t._selectedTable, pk] join conditions
        var newRow = {};
        var joinKey;
        var isNewRow;
        var doNull;
        var matches = [];
        var rightIDs = [];
        var i = index1.length;
        var j;
        var l;
        var k;
        // This is a relationship cache to keep track of joins between tables
        i = t._db._joinedRelations.length;
        j = 0;
        while (i-- && !j) {
            if (t._db._joinedRelations[i].indexOf(tables[0]) !== -1 && t._db._joinedRelations[i].indexOf(tables[1]) !== -1)
                j = 1;
        }
        if (!j)
            t._db._joinedRelations.push(tables);
        var doJoin = function (rowIDs, mergeRows) {
            joinKey = rowIDs.join("+");
            isNewRow = false;
            k = rowIDs.map(function (r) {
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
                models.forEach(function (table, ti) {
                    doNull = rowIDs[ti] === -1 || mergeRows[ti] === false;
                    table.forEach(function (dm) {
                        newRow[tableNames[ti] + "." + dm.key] = doNull ? null : mergeRows[ti][dm.key];
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
            if (l) {
                while (l--) {
                    joinedIndex.push(doJoin([index1[i], matches[l][0]], [rows[0], matches[l][1]]));
                }
                ;
            }
            else if (type === "left") {
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
     * @memberOf _SomeSQLQuery
     */
    _SomeSQLQuery.prototype._compare = function (val1, compare, val2) {
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
    };
    /**
     * Exexcute active filters on a given set of database rows.
     *
     * @internal
     * @param {Array<Object>} dbRows
     * @returns {*}
     *
     * @memberOf _SomeSQLQuery
     */
    _SomeSQLQuery.prototype._runFilters = function (dbRows) {
        var t = this;
        var filters = t._mod.filter(function (m) { return m.type.indexOf("filter-") === 0; });
        return filters.length ? filters.reduce(function (prev, cur, i) {
            return _filters[filters[i].type.replace("filter-", "")].apply(t, [prev, filters[i].args]);
        }, dbRows) : dbRows;
    };
    return _SomeSQLQuery;
}());
