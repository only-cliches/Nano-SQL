Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./index");
var db_index_1 = require("./db-index");
var lie_ts_1 = require("lie-ts");
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
exports._functions = {
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
var _NanoSQLQuery = (function () {
    function _NanoSQLQuery(database) {
        this._db = database;
    }
    _NanoSQLQuery.prototype._doQuery = function (query) {
        var t = this;
        t._tableID = index_1.NanoSQLInstance._hash(query.table);
        t._mod = [];
        t._act = undefined;
        t._query = query;
        var simpleQuery = [];
        query.query.forEach(function (q) {
            if (["upsert", "select", "delete", "drop"].indexOf(q.type) >= 0) {
                t._act = q;
                if (q.type === "select")
                    t._queryHash = index_1.NanoSQLInstance._hash(JSON.stringify(query.query));
            }
            else if (["show tables", "describe", "count"].indexOf(q.type) >= 0) {
                simpleQuery.push(q);
            }
            else {
                t._mod.push(q);
            }
        });
        if (simpleQuery.length) {
            switch (simpleQuery[0].type) {
                case "show tables":
                    query.onSuccess([{ tables: Object.keys(t._db._store._tables).map(function (ta) { return t._db._store._tables[ta]._name; }) }], "info", [], []);
                    break;
                case "describe":
                    query.onSuccess([
                        {
                            name: t._db._store._tables[t._tableID]._name,
                            models: index_1._assign(t._db._store._models[t._tableID]),
                            primaryKey: t._db._store._tables[t._tableID]._pk,
                            count: t._db._store._tables[t._tableID]._index.length
                        }
                    ], "info", [], []);
                    break;
            }
        }
        else {
            t._execQuery(function (result, changeType, affectedRows, affectedPKs) {
                query.onSuccess(result, changeType, affectedRows, affectedPKs);
            });
        }
    };
    _NanoSQLQuery.prototype._getMod = function (name) {
        return this._mod.filter(function (v) { return v.type === name; }).pop();
    };
    _NanoSQLQuery.prototype._execQuery = function (callBack) {
        var t = this;
        if (!t._act)
            return;
        var doQuery = function (rows) {
            if (!t._act)
                return;
            switch (t._act.type) {
                case "upsert":
                    t._upsert(rows, callBack);
                    break;
                case "select":
                    t._select(rows, callBack);
                    break;
                case "drop":
                    var ptr_1 = 0;
                    var idx_1 = tableData._index.slice();
                    var nextRow_1 = function () {
                        if (ptr_1 < idx_1.length) {
                            t._db._store._read(tableData._name, idx_1[ptr_1], function (row) {
                                t._remove(row, function () {
                                    ptr_1++;
                                    nextRow_1();
                                });
                            });
                        }
                        else {
                            callBack([], "drop", idx_1.map(function (i) { return {}; }), idx_1);
                        }
                    };
                    nextRow_1();
                    break;
                case "delete":
                    t._remove(rows, callBack);
                    break;
            }
        };
        var tableData = t._db._store._tables[t._tableID];
        if (!t._getMod("join") && t._act.type !== "drop") {
            if (t._getMod("where")) {
                var whereArgs_1 = t._getMod("where").args;
                var isOptimizedWhere_1 = function (wArgs) {
                    if (["=", "IN", "BETWEEN"].indexOf(wArgs[1]) !== -1) {
                        if (wArgs[0] === tableData._pk || tableData._secondaryIndexes.indexOf(wArgs[0]) !== -1) {
                            return 0;
                        }
                    }
                    return 1;
                };
                var doFastWhere_1 = function (wArgs, callBack) {
                    var tableName = wArgs[0] === tableData._pk ? tableData._name : "_" + tableData._name + "_idx_" + wArgs[0];
                    var isSecondaryIdx = wArgs[0] !== tableData._pk;
                    switch (wArgs[1]) {
                        case "=":
                            t._db._store._read(tableName, isSecondaryIdx ? String(wArgs[2]).toLowerCase() : wArgs[2], function (rows) {
                                callBack(rows);
                            });
                            break;
                        case "IN":
                            var ptr = 0;
                            var resultRows = [];
                            t._db._store._readArray(tableName, isSecondaryIdx ? String(wArgs[2]).toLowerCase() : wArgs[2], function (rows) {
                                callBack(rows);
                            });
                            break;
                        case "BETWEEN":
                            if (isSecondaryIdx)
                                wArgs[2].map(function (a) { return String(a).toLowerCase(); });
                            t._db._store._readRange(tableName, wArgs[0], wArgs[2], callBack);
                            break;
                    }
                };
                var doFastRead = false;
                if (typeof whereArgs_1[0] === "string") {
                    doFastRead = isOptimizedWhere_1(whereArgs_1) === 0;
                }
                else {
                    doFastRead = whereArgs_1.reduce(function (prev, cur, i) {
                        if (i % 2 === 1)
                            return prev;
                        return prev + isOptimizedWhere_1(cur);
                    }, 0) === 0;
                }
                if (doFastRead) {
                    if (typeof whereArgs_1[0] === "string") {
                        doFastWhere_1(whereArgs_1, doQuery);
                    }
                    else {
                        var resultRows_1 = [];
                        var lastCommand_1 = "";
                        index_1.NanoSQLInstance.chain(whereArgs_1.map(function (wArg) {
                            return function (nextWArg) {
                                if (wArg === "OR" || wArg === "AND") {
                                    lastCommand_1 = wArg;
                                    nextWArg();
                                    return;
                                }
                                doFastWhere_1(wArg, function (rows) {
                                    if (lastCommand_1 === "AND") {
                                        var idx_2 = rows.map(function (r) { return r[tableData._pk]; });
                                        resultRows_1 = resultRows_1.filter(function (row) {
                                            return idx_2.indexOf(row[tableData._pk]) !== -1;
                                        });
                                    }
                                    else {
                                        resultRows_1 = resultRows_1.concat(rows);
                                    }
                                    nextWArg();
                                });
                            };
                        }))(function () {
                            doQuery(resultRows_1);
                        });
                    }
                }
                else {
                    t._db._store._read(tableData._name, function (row) {
                        return row && t._where(row, whereArgs_1);
                    }, doQuery);
                }
            }
            else if (t._getMod("range")) {
                var rangeArgs = t._getMod("range").args;
                t._getRange(rangeArgs[0], rangeArgs[1], doQuery);
            }
            else if (t._getMod("trie")) {
                var trieArgs = t._getMod("trie").args;
                var words = tableData._trieObjects[trieArgs[0]].getPrefix(trieArgs[1]);
                var indexTable = "_" + tableData._name + "_idx_" + trieArgs[0];
                t._db._store._readArray(indexTable, words, function (rows) {
                    doQuery(rows);
                });
            }
            else {
                if (t._act.type !== "upsert") {
                    t._db._store._read(tableData._name, "all", function (rows) {
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
    _NanoSQLQuery.prototype._getRange = function (limit, offset, callBack) {
        var t = this;
        var table = t._db._store._tables[t._tableID];
        var startIndex = table._index[offset];
        var endIndex = table._index[offset + (limit - 1)];
        if (!startIndex) {
            callBack([]);
        }
        else {
            t._db._store._readRange(table._name, table._pk, [startIndex, endIndex], function (rows) {
                callBack(rows);
            });
        }
    };
    _NanoSQLQuery.prototype._updateRow = function (rowPK, callBack) {
        var t = this;
        var table = t._db._store._tables[t._tableID];
        var qArgs = t._act.args;
        var oldRow = {};
        var updateType = (function () {
            return t._act ? t._act.type : "";
        })();
        var writeChanges = function (newRow) {
            if (updateType === "upsert") {
                t._db._store._upsert(table._name, rowPK, newRow, function () {
                    callBack();
                }, t._query.transactionID);
            }
            else {
                t._db._store._delete(table._name, rowPK, function () {
                    callBack();
                }, t._query.transactionID);
            }
        };
        if (t._query.transactionID) {
            if (updateType === "upsert") {
                t._db._store._tables[t._tableID]._keys.forEach(function (k, i) {
                    var def = table._defaults[i];
                    if (qArgs[k] === undefined && def !== undefined)
                        qArgs[k] = def;
                });
                writeChanges(qArgs);
            }
            else {
                writeChanges({});
            }
            return;
        }
        t._db._store._read(table._name, rowPK, function (rows) {
            oldRow = rows[0] || {};
            var newRow = index_1._assign(rows[0] || {});
            var doRemove = false;
            var finishUpdate = function (histDataID) {
                if (table._name.indexOf("_") !== 0 && t._db._store._doHistory && table._pk.length) {
                    t._db._store._read("_" + table._name + "_hist__meta", rowPK, function (rows) {
                        rows = index_1._assign(rows);
                        rows[0][db_index_1._str(3)].unshift(histDataID);
                        t._db._store._upsert("_" + table._name + "_hist__meta", rowPK, rows[0], function () { });
                    });
                }
                t._db._store._updateSecondaryIndex(updateType === "upsert" ? newRow : {}, t._tableID, function () {
                    writeChanges(newRow);
                });
            };
            var doHistory = function () {
                if (!doRemove && table._name.indexOf("_") !== 0 && t._db._store._doHistory) {
                    t._db._store._addHistoryRow(t._tableID, newRow, t._query.transactionID, finishUpdate);
                }
                else {
                    finishUpdate(0);
                }
            };
            switch (updateType) {
                case "upsert":
                    Object.getOwnPropertyNames(qArgs).forEach(function (k) {
                        newRow[k] = qArgs[k];
                    });
                    var table_1 = t._db._store._tables[t._tableID];
                    table_1._keys.forEach(function (k, i) {
                        var def = table_1._defaults[i];
                        if (newRow[k] === undefined && def !== undefined)
                            newRow[k] = def;
                    });
                    doHistory();
                    break;
                case "delete":
                case "drop":
                    if (qArgs && qArgs.length && updateType !== "drop") {
                        qArgs.forEach(function (column) {
                            newRow[column] = null;
                        });
                        doHistory();
                    }
                    else {
                        doRemove = true;
                        newRow = {};
                        if (t._db._store._tables[t._tableID]._relations.length) {
                            index_1.NanoSQLInstance.chain(t._db._store._tables[t._tableID]._relations.map(function (rel) {
                                return function (nextRelation) {
                                    if (rel._mapTo.length) {
                                        var relatedPK = t._db._store._tables[index_1.NanoSQLInstance._hash(rel._table)]._pk;
                                        var related = oldRow[rel._key] || [];
                                        if (!Array.isArray(related))
                                            related = [related];
                                        t._db._parent.table(rel._table).query("select").where([relatedPK, "IN", related]).exec().then(function (rows) {
                                            index_1.NanoSQLInstance.chain(rows.map(function (row) {
                                                return function (nextRow) {
                                                    var setRow = index_1._assign(row);
                                                    if (setRow[rel._mapTo]) {
                                                        if (Array.isArray(setRow[rel._mapTo])) {
                                                            var idx = setRow[rel._mapTo].indexOf(rowPK);
                                                            if (idx === -1) {
                                                                nextRow();
                                                                return;
                                                            }
                                                            else {
                                                                setRow[rel._mapTo].splice(idx, 1);
                                                            }
                                                        }
                                                        else {
                                                            setRow[rel._mapTo] = "";
                                                        }
                                                    }
                                                    t._db._parent.table(rel._table).query("upsert", setRow, true).exec().then(nextRow);
                                                };
                                            }))(nextRelation);
                                        });
                                    }
                                    else {
                                        nextRelation();
                                    }
                                };
                            }))(doHistory);
                        }
                        else {
                            doHistory();
                        }
                    }
                    break;
            }
        });
    };
    _NanoSQLQuery.prototype._tableChanged = function (updatedRowPKs, describe, callBack) {
        var t = this, k = 0, j = 0;
        if (t._query.transactionID) {
            callBack([], "trans", [], []);
            return;
        }
        if (updatedRowPKs.length > 0) {
            t._db._store._addHistoryPoint(t._tableID, updatedRowPKs, describe, function () {
                var table = t._db._store._tables[t._tableID];
                t._db._invalidateCache(t._tableID, [], [], "");
                t._db._store._readArray(table._name, updatedRowPKs, function (rows) {
                    callBack([{ msg: updatedRowPKs.length + " row(s) " + describe }], describe, rows, updatedRowPKs);
                });
            });
        }
        else {
            callBack([{ msg: "0 rows " + describe }], describe, [], []);
        }
    };
    _NanoSQLQuery.prototype._upsert = function (queryRows, callBack) {
        var t = this;
        var scribe = "", i, changedPKs = [];
        var qArgs = t._act.args || {}, table = t._db._store._tables[t._tableID], pk = table._pk, whereMod = t._getMod("where");
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
                qArgs[pk] = t._db._store._generateID(table._pkType, t._tableID);
            }
            else {
                if (table._pkType === "int") {
                    table._incriment = Math.max(qArgs[pk] + 1, table._incriment);
                }
            }
            var objPK = qArgs[pk] ? qArgs[pk] : table._index.length;
            changedPKs = [objPK];
            if (!table._trieIndex.getPrefix(String(objPK)).length) {
                var tableName = t._db._store._tables[t._tableID]._name;
                if (tableName.indexOf("_") !== 0 && t._db._store._doHistory) {
                    var histTable = "_" + tableName + "_hist__meta";
                    var histRow = {};
                    histRow[db_index_1._str(2)] = 0;
                    histRow[db_index_1._str(3)] = [0];
                    t._db._store._upsert(histTable, objPK, histRow, function () { }, t._query.transactionID);
                }
            }
            t._updateRow(objPK, function () {
                t._tableChanged(changedPKs, scribe, callBack);
            });
        }
    };
    _NanoSQLQuery.prototype._getTableID = function () {
        return this._joinTable ? this._joinTable : this._tableID;
    };
    _NanoSQLQuery.prototype._select = function (queryRows, callBack) {
        var t = this;
        if (t._db._queryCache[t._tableID][t._queryHash]) {
            callBack(t._db._queryCache[t._tableID][t._queryHash], "none", [], []);
            return;
        }
        var mods = ["join", "groupby", "having", "orderby", "offset", "limit", "orm"];
        var curMod, column, i, k, rows, obj, rowData, groups = {};
        var sortObj = function (objA, objB, columns) {
            return Object.keys(columns).reduce(function (prev, cur) {
                var A = objA[cur];
                var B = objB[cur];
                if (cur.split(".").pop() === "length") {
                    A = objA[cur.replace(".length", "")].length;
                    B = objB[cur.replace(".length", "")].length;
                }
                if (!prev) {
                    if (A === B)
                        return 0;
                    return (A > B ? 1 : -1) * (columns[cur] === "desc" ? -1 : 1);
                }
                else {
                    return prev;
                }
            }, 0);
        };
        var modifyQuery = function (tableResult, modIndex, next) {
            curMod = t._getMod(mods[modIndex]);
            if (modIndex === 2) {
                var functions_1 = [];
                if (qArgs.length) {
                    var funcs_1 = Object.keys(exports._functions).map(function (f) { return f + "("; });
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
                        if (exports._functions[funcName].type === "simple" && columnName === funcName) {
                            columnName = args[0];
                        }
                        keepColumns_1.push(columnName);
                        return {
                            name: funcName,
                            args: args,
                            as: columnName.trim(),
                            type: exports._functions[funcName].type
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
                                            return exports._functions[curr.name].call(v, curr.args, [i, len], p);
                                        }, {})];
                                    if (prevFunc_1) {
                                        newRows[0][prevFunc_1] = prev[0][prevFunc_1];
                                    }
                                    prev = newRows;
                                    prevFunc_1 = curr.name;
                                }
                                else {
                                    prev = prev.map(function (v, i) {
                                        return exports._functions[curr.name].call(v, curr.args, [i, len]);
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
                                .map(function (k) { return prevFunc_1 = null, doFunctions_1(groups[k]); })
                                .reduce(function (prev, curr) {
                                return prev = prev.concat(curr), prev;
                            }, []);
                        }
                        else {
                            rows_1 = doFunctions_1(tableResult);
                        }
                    }
                    else {
                        rows_1 = tableResult;
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
                                    if (key.indexOf(".length") !== -1) {
                                        var newKey = key.replace(".length", "");
                                        newRow[key] = (r[newKey] || []).length;
                                    }
                                    else {
                                        newRow[key] = r[key];
                                    }
                                }
                                else {
                                    if (key[1].indexOf(".length") !== -1) {
                                        var newKey = key[1].replace(".length", "");
                                        newRow[key[2]] = (r[newKey] || []).length;
                                    }
                                    else {
                                        newRow[key[2]] = r[key[1]];
                                    }
                                }
                            });
                            return newRow;
                        });
                    }
                    tableResult = rows_1;
                }
            }
            if (!curMod)
                return next(tableResult);
            switch (modIndex) {
                case 0:
                    var joinConditions = void 0;
                    if (curMod.args.type !== "cross") {
                        joinConditions = {
                            _left: curMod.args.where[0],
                            _check: curMod.args.where[1],
                            _right: curMod.args.where[2]
                        };
                    }
                    var leftTableID = t._tableID;
                    var rightTableID = index_1.NanoSQLInstance._hash(curMod.args.table);
                    var where_1 = t._getMod("where");
                    var range_1 = t._getMod("range");
                    t._join(curMod.args.type, leftTableID, rightTableID, joinConditions, function (joinedRows) {
                        if (where_1) {
                            next(joinedRows.filter(function (row) {
                                return t._where(row, where_1.args);
                            }));
                        }
                        else if (range_1) {
                            t._getRange(range_1.args[0], range_1.args[1], next);
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
                        groups = tableResult.reduce(function (prev, curr) {
                            var key = Object.keys(columns_1).reduce(function (p, c) {
                                if (c.indexOf(".length") !== -1) {
                                    return p + "." + String((curr[c.replace(".length", "")] || []).length);
                                }
                                else {
                                    return p + "." + String(curr[c]);
                                }
                            }, "").slice(1);
                            (prev[key] = prev[key] || []).push(curr);
                            sortGroups_1[key] = Object.keys(columns_1).reduce(function (pr, cu) {
                                if (cu.indexOf(".length") !== -1) {
                                    var newCu = cu.replace(".length", "");
                                    pr[newCu] = (curr[newCu] || []).length;
                                }
                                else {
                                    pr[cu] = curr[cu];
                                }
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
                        next(tableResult);
                    }
                    break;
                case 2:
                    next(tableResult.filter(function (row) {
                        return t._where(row, t._getMod("having").args);
                    }));
                    break;
                case 3:
                    next(tableResult.sort(function (a, b) {
                        return sortObj(a, b, curMod.args);
                    }));
                    break;
                case 4:
                    next(tableResult.filter(function (row, index) {
                        return curMod ? index >= curMod.args : true;
                    }));
                    break;
                case 5:
                    next(tableResult.filter(function (row, index) {
                        return curMod ? index < curMod.args : true;
                    }));
                    break;
                case 6:
                    var modifiers_1 = [];
                    if (curMod.args)
                        modifiers_1 = curMod.args;
                    var defaultModifier_1 = t._db._store._parent._parent._ormFns[t._db._store._tables[t._tableID]._name];
                    if (!t._getMod("join")) {
                        lie_ts_1.Promise.all(tableResult.map(function (row, k) {
                            tableResult[k] = index_1._assign(row);
                            return lie_ts_1.Promise.all(t._db._store._tables[t._tableID]._relations.map(function (rel) {
                                var useKey = rel._key;
                                if (qArgs && qArgs.length) {
                                    qArgs.forEach(function (q) {
                                        var column = q.split(" ");
                                        if (column[0] === rel._key && column[1] === "AS") {
                                            useKey = column[2];
                                        }
                                    });
                                }
                                if (row[useKey] === undefined) {
                                    return new lie_ts_1.Promise(function (res) { return res(); });
                                }
                                var tablePK = t._db._store._tables[index_1.NanoSQLInstance._hash(rel._table)]._pk;
                                return new lie_ts_1.Promise(function (res, rej) {
                                    var modifier = undefined;
                                    if (defaultModifier_1) {
                                        modifier = defaultModifier_1(rel._key, tableResult[k]);
                                    }
                                    if (modifiers_1.length) {
                                        modifiers_1.forEach(function (mod) {
                                            if (typeof mod !== "string") {
                                                if (mod.key === rel._key || !mod.key || mod.key === "*") {
                                                    modifier = mod;
                                                }
                                            }
                                        });
                                    }
                                    if (!modifier && modifiers_1.indexOf(rel._key) === -1) {
                                        res();
                                        return;
                                    }
                                    var Ids = row[useKey];
                                    if (Ids === undefined) {
                                        tableResult[k][useKey] = rel._type === "single" ? undefined : [];
                                        res();
                                        return;
                                    }
                                    if (rel._type === "single")
                                        Ids = [Ids];
                                    var query = t._db._parent.table(rel._table).query("select");
                                    if (modifier) {
                                        if (!modifier.where && !modifier.orderBy) {
                                            var offset_1 = modifier.offset || 0;
                                            var limit_1 = modifier.limit || 0;
                                            query.where([tablePK, "IN", Ids.filter(function (v, i) {
                                                    return i >= offset_1 && i < offset_1 + limit_1;
                                                })]);
                                        }
                                        else {
                                            if (modifier.where) {
                                                if (typeof modifier.where[0] === "string") {
                                                    query.where([[tablePK, "IN", Ids], "AND", modifier.where]);
                                                }
                                                else {
                                                    modifier.where.push("AND");
                                                    modifier.where.push([tablePK, "IN", Ids]);
                                                    query.where(modifier.where);
                                                }
                                            }
                                            else {
                                                query.where([tablePK, "IN", Ids]);
                                            }
                                            if (modifier.orderBy)
                                                query.orderBy(modifier.orderBy);
                                            query.limit(modifier.limit || 5).offset(modifier.offset || 0);
                                        }
                                    }
                                    else {
                                        query.where([tablePK, "IN", Ids.filter(function (v, i) { return i < 5; })]);
                                    }
                                    query.exec().then(function (relations) {
                                        tableResult[k][useKey] = rel._type === "single" ? relations[0] : relations;
                                        res();
                                    });
                                });
                            }));
                        })).then(function () {
                            next(tableResult);
                        });
                    }
                    else {
                        next(tableResult);
                    }
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
                if (!t._getMod("join") && !t._getMod("orm")) {
                    t._db._queryCache[t._tableID][t._queryHash] = rowPKs;
                }
                callBack(rowPKs, "none", [], []);
            }
        };
        stepQuery(queryRows);
    };
    _NanoSQLQuery.prototype._remove = function (queryRows, callBack) {
        var scribe = "deleted", i;
        var t = this;
        var qArgs = t._act.args || [];
        var pk = t._db._store._tables[t._tableID]._pk;
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
    _NanoSQLQuery.prototype._where = function (row, conditions) {
        var t = this;
        var commands = ["AND", "OR"];
        var maybeGetLength = function (key) {
            if (key.indexOf(".length") !== -1) {
                var value = row[key.replace(".length", "")];
                return Array.isArray(value) ? value.length : 0;
            }
            else {
                return row[key];
            }
        };
        if (typeof conditions[0] !== "string") {
            var hasAnd_1 = false;
            var checkWhere_1 = conditions.map(function (cur, idx) {
                if (commands.indexOf(cur) !== -1) {
                    if (cur === "AND")
                        hasAnd_1 = true;
                    return cur;
                }
                else {
                    return t._compare(cur[2], cur[1], maybeGetLength(cur[0])) === 0 ? true : false;
                }
            });
            checkWhere_1.forEach(function (cur, idx) {
                if (cur === "OR") {
                    checkWhere_1[idx] = checkWhere_1[idx - 1] || checkWhere_1[idx + 1];
                    checkWhere_1[idx - 1] = undefined;
                    checkWhere_1[idx + 1] = undefined;
                }
            });
            checkWhere_1 = checkWhere_1.filter(function (val) { return val !== undefined; });
            if (!hasAnd_1) {
                return checkWhere_1.indexOf(true) !== -1;
            }
            else {
                var reducing_1;
                var prevAnd_1 = false;
                return checkWhere_1.reduce(function (prev, cur, idx) {
                    if (idx === 0) {
                        prev.push(cur);
                        reducing_1 = prev.length - 1;
                        return prev;
                    }
                    if (cur === "AND") {
                        prevAnd_1 = true;
                        prev.push(cur);
                        return prev;
                    }
                    if (prevAnd_1) {
                        prev.push(cur);
                        reducing_1 = prev.length - 1;
                        prevAnd_1 = false;
                        return prev;
                    }
                    if (reducing_1 !== undefined) {
                        prev[reducing_1] = cur || prev[reducing_1];
                    }
                    return prev;
                }, []).filter(function (val) { return val !== undefined; }).indexOf(false) === -1;
            }
        }
        else {
            return t._compare(conditions[2], conditions[1], maybeGetLength(conditions[0])) === 0 ? true : false;
        }
    };
    _NanoSQLQuery.prototype._join = function (type, leftTableID, rightTableID, joinConditions, complete) {
        var L = "left";
        var R = "right";
        var O = "outer";
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
                    var joinRows = rightRows.map(function (rightRow) {
                        var joinedRow = doJoinRows(leftRow, rightRow);
                        if (!joinConditions)
                            return joinedRow;
                        var keep = t._where(joinedRow, [joinConditions._left, joinConditions._check, joinedRow[joinConditions._right]]);
                        if (keep)
                            rightUsedPKs.push(rightRow[rightTableData._pk]);
                        return keep ? joinedRow : null;
                    }).filter(function (r) { return r; });
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
    _NanoSQLQuery.prototype._compare = function (val1, compare, val2) {
        if (val1 === undefined || val2 === undefined || val1 === null || val2 === null) {
            return ["=", ">=", "<="].indexOf(compare) !== -1 ? (val1 === val2 ? 0 : 1) : 1;
        }
        var setValue = function (val) {
            return (compare === "LIKE") ? String(val || "").toLowerCase() : val;
        };
        var left = setValue(val2);
        var right = setValue(val1);
        switch (compare) {
            case "=": return left === right ? 0 : 1;
            case ">": return left > right ? 0 : 1;
            case "<": return left < right ? 0 : 1;
            case "<=": return left <= right ? 0 : 1;
            case ">=": return left >= right ? 0 : 1;
            case "IN": return right.indexOf(left) < 0 ? 1 : 0;
            case "NOT IN": return right.indexOf(left) < 0 ? 0 : 1;
            case "REGEX": return left.search(right) < 0 ? 1 : 0;
            case "LIKE": return left.indexOf(right) < 0 ? 1 : 0;
            case "BETWEEN": return right[0] <= left && right[1] >= left ? 0 : 1;
            case "HAVE": return (left || []).indexOf(right) < 0 ? 1 : 0;
            case "NOT HAVE": return (left || []).indexOf(right) < 0 ? 0 : 1;
            default: return 1;
        }
    };
    return _NanoSQLQuery;
}());
exports._NanoSQLQuery = _NanoSQLQuery;
