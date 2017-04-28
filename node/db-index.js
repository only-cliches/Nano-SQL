Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./index");
var lie_ts_1 = require("lie-ts");
var db_storage_1 = require("./db-storage");
var db_query_1 = require("./db-query");
exports._str = function (index) {
    return ["_utility", "_historyPoints", "_pointer", "_historyDataRowIDs", "_id"][index];
};
var _NanoSQLDB = (function () {
    function _NanoSQLDB() {
        var t = this;
        t._pendingQuerys = [];
        t._queryCache = {};
    }
    _NanoSQLDB.prototype._connect = function (connectArgs) {
        var t = this;
        t._databaseID = index_1.NanoSQLInstance._hash(JSON.stringify(connectArgs._models)).toString();
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
        if (tableID) {
            t._store._models[tableID].forEach(function (model) {
                var prop = obj[model.key];
                if (["map", "array"].indexOf(model.type) >= 0 || model.type.indexOf("[]") >= 0) {
                    obj[model.key] = t._deepFreeze(prop);
                }
            });
        }
        return Object.freeze(obj);
    };
    _NanoSQLDB.prototype._transaction = function (type) {
        var t = this;
        if (type === "start") {
            t._store._transactionData = {};
            t._store._doingTransaction = true;
        }
        if (type === "end") {
            t._store._doingTransaction = false;
            t._store._execTransaction();
        }
        return !!t._store._doingTransaction;
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
            t._store._readArray(exports._str(1), t._store._historyPointIndex[check], function (hps) {
                new _fnForEach().loop(hps, function (hp, nextPoint) {
                    var tableID = hp.tableID;
                    var table = t._store._tables[tableID];
                    var rows = [];
                    new _fnForEach().loop(hp.rowKeys, function (rowID, nextRow) {
                        if (table._pkType === "int")
                            rowID = parseInt(rowID);
                        t._store._read(table._name, rowID, function (rowData) {
                            if (direction > 0)
                                rows.push(rowData[0]);
                            t._store._read("_" + table._name + "_hist__meta", rowID, function (row) {
                                row = index_1._assign(row);
                                row[0][exports._str(2)] = (row[0][exports._str(2)] || 0) + direction;
                                var historyRowID = row[0][exports._str(3)][row[0][exports._str(2)]];
                                t._store._upsert("_" + table._name + "_hist__meta", rowID, row[0], function () {
                                    t._store._read("_" + table._name + "_hist__data", historyRowID, function (setRow) {
                                        var newRow = setRow[0] ? index_1._assign(setRow[0]) : null;
                                        if (newRow)
                                            delete newRow[exports._str(4)];
                                        t._store._upsert(table._name, rowID, newRow, function () {
                                            if (direction < 0)
                                                rows.push(newRow);
                                            if (!results[tableID])
                                                results[tableID] = { type: hp.type, rows: [] };
                                            results[tableID].rows = results[tableID].rows.concat(rows);
                                            i++;
                                            nextRow();
                                        });
                                    });
                                });
                            });
                        });
                    }).then(nextPoint);
                }).then(function () {
                    callBack(results);
                });
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
                case "flush_history":
                case "flush_db":
                    t._store._utility("w", "historyPoint", 0);
                    t._store._utility("w", "historyLength", 0);
                    t._store._historyPoint = 0;
                    t._store._historyLength = 0;
                    Object.keys(t._store._tables).forEach(function (tableID) {
                        var rows;
                        if (t._store._tables[parseInt(tableID)]._name.indexOf("_") === 0) {
                            rows = [];
                        }
                        else {
                            rows = t._store._tables[parseInt(tableID)]._rows;
                            rows = Object.keys(rows).map(function (r) { return rows[r]; });
                        }
                        t._invalidateCache(parseInt(tableID), rows, "remove", "clear");
                    });
                    if (command === "flush_db") {
                        t._store._clear("all", res);
                    }
                    else {
                        t._store._clear("hist", res);
                    }
                    break;
            }
        });
    };
    return _NanoSQLDB;
}());
exports._NanoSQLDB = _NanoSQLDB;
var _fnForEach = (function () {
    function _fnForEach() {
    }
    _fnForEach.prototype.loop = function (items, callBack) {
        return new lie_ts_1.Promise(function (res, rej) {
            var ptr = 0;
            var results = [];
            var next = function () {
                if (ptr < items.length) {
                    callBack(items[ptr], function (result) {
                        results.push(result);
                        ptr++;
                        next();
                    });
                }
                else {
                    res(results);
                }
            };
            next();
        });
    };
    return _fnForEach;
}());
exports._fnForEach = _fnForEach;
