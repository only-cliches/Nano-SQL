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
    _NanoSQLDB.prototype._invalidateCache = function (changedTableID, changedRows, changedRowPKS, type, action) {
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
                changedRowPKS: changedRowPKS,
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
    _NanoSQLDB.prototype._transaction = function (type, transactionID) {
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            if (type === "start") {
                t._store._activeTransactions.push(transactionID);
                res();
            }
            if (type === "end") {
                t._store._execTransaction(transactionID).then(function (result) {
                    var tLoc = t._store._activeTransactions.indexOf(transactionID);
                    if (tLoc !== -1)
                        t._store._activeTransactions.splice(tLoc, 1);
                    t._parent._tableNames.forEach(function (tableName) {
                        t._invalidateCache(index_1.NanoSQLInstance._hash(tableName), [], [], "transaction");
                    });
                    res(result);
                });
            }
        });
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
                index_1.NanoSQLInstance.chain(hps.map(function (hp) {
                    return function (nextHP) {
                        var tableID = hp.tableID;
                        var table = t._store._tables[tableID];
                        var rows = [];
                        index_1.NanoSQLInstance.chain(hp.rowKeys.map(function (rowID) {
                            return function (nextRowKey) {
                                if (!results[tableID])
                                    results[tableID] = { type: hp.type, rows: [], affectedPKS: hp.rowKeys };
                                t._store._read("_" + table._name + "_hist__meta", rowID, function (row) {
                                    row = index_1._assign(row);
                                    row[0][exports._str(2)] = (row[0][exports._str(2)] || 0) + direction;
                                    var historyRowID = row[0][exports._str(3)][row[0][exports._str(2)]];
                                    t._store._upsert("_" + table._name + "_hist__meta", rowID, row[0], function () {
                                        t._store._read("_" + table._name + "_hist__data", historyRowID, function (setRow) {
                                            var newRow = {};
                                            if (setRow.length) {
                                                table._keys.forEach(function (k) {
                                                    newRow[k] = setRow[0][k];
                                                });
                                            }
                                            t._store._upsert(table._name, rowID, setRow.length ? newRow : null, function () {
                                                rows.push(newRow);
                                                results[tableID].rows = results[tableID].rows.concat(rows);
                                                i++;
                                                nextRowKey();
                                            });
                                        });
                                    });
                                });
                            };
                        }))(nextHP);
                    };
                }))(function () {
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
                                t._invalidateCache(parseInt(tableID), affectedTables[tableID].rows, affectedTables[tableID].affectedPKS, description, "undo");
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
                                t._invalidateCache(parseInt(tableID), affectedTables[tableID].rows, affectedTables[tableID].affectedPKS, affectedTables[tableID].type, "redo");
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
                        var pks;
                        if (t._store._tables[parseInt(tableID)]._name.indexOf("_") === 0) {
                            pks = [];
                        }
                        else {
                            pks = t._store._tables[parseInt(tableID)]._index;
                        }
                        t._invalidateCache(parseInt(tableID), pks.map(function (r) { return null; }), pks, "remove", "clear");
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
