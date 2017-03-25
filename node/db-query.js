"use strict";
var index_1 = require("./index");
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
                    var table_1 = t._db._store._tables[_this._db._selectedTable];
                    t._db._invalidateCache(t._db._selectedTable, [], "");
                    t._db._store._read(table_1._name, function (row) {
                        return row && updatedRowPKs.indexOf(row[table_1._pk]) !== -1;
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
                                var nextRow_1 = function () {
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
                                                        nextRow_1();
                                                    });
                                                }
                                                else {
                                                    k++;
                                                    nextRow_1();
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
                                    nextRow_1();
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
exports._NanoSQLQuery = _NanoSQLQuery;
