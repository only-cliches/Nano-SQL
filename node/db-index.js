var index_1 = require("./index");
var lie_ts_1 = require("lie-ts");
var db_storage_1 = require("./db-storage");
var db_query_1 = require("./db-query");
var _NanoSQLDB = (function () {
    function _NanoSQLDB() {
        var t = this;
        t._pendingQuerys = [];
        t._queryCache = {};
    }
    _NanoSQLDB.prototype._connect = function (connectArgs) {
        var t = this;
        t._databaseID = index_1.NanoSQLInstance._hash(JSON.stringify(connectArgs._models));
        t._parent = connectArgs._parent;
        t._store = new db_storage_1._NanoSQL_Storage(t, connectArgs);
    };
    _NanoSQLDB.prototype._exec = function (execArgs) {
        var t = this;
        new db_query_1._NanoSQLQuery(t)._doQuery(execArgs);
    };
    _NanoSQLDB.prototype._invalidateCache = function (changedTableID, changedRows, type, action) {
        var t = this;
        t._queryCache[changedTableID] = {};
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
    _NanoSQLDB.prototype._deepFreeze = function (obj, tableID) {
        if (!obj)
            return obj;
        var t = this;
        t._store._models[tableID].forEach(function (model) {
            var prop = obj[model.key];
            if (["map", "array"].indexOf(typeof prop) >= 0) {
                obj[model.key] = t._deepFreeze(prop, tableID);
            }
        });
        return Object.freeze(obj);
    };
    _NanoSQLDB.prototype._transaction = function (type) {
        if (type === "start")
            this._store._doingTransaction = true;
        if (type === "end")
            this._store._doingTransaction = false;
        return !!this._store._doingTransaction;
    };
    _NanoSQLDB.prototype._extend = function (db, command) {
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
                                        rows_1.push(rowData[0]);
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
    return _NanoSQLDB;
}());
exports._NanoSQLDB = _NanoSQLDB;
