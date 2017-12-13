var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("../index");
var utilities_1 = require("../utilities");
var _NanoSQLStorageQuery = (function () {
    function _NanoSQLStorageQuery(_store) {
        this._store = _store;
    }
    _NanoSQLStorageQuery.prototype.doQuery = function (query, next) {
        this._query = query;
        this._isInstanceTable = Array.isArray(query.table);
        switch (query.action) {
            case "select":
                this._select(next);
                break;
            case "upsert":
                this._upsert(next);
                break;
            case "delete":
                this._delete(next);
                break;
            case "drop":
                this._drop(next);
                break;
            case "show tables":
                this._query.result = Object.keys(this._store.tableInfo);
                next(this._query);
                break;
            case "describe":
                if (typeof this._query.table !== "string") {
                    next(this._query);
                    return;
                }
                this._query.result = utilities_1._assign(this._store.models[this._query.table]);
                next(this._query);
                break;
        }
    };
    _NanoSQLStorageQuery.prototype._getRows = function (complete) {
        if (this._isInstanceTable) {
            new InstanceSelection(this._query).getRows(complete);
        }
        else {
            new _RowSelection(this._query, this._store).getRows(function (rows) {
                complete(rows.filter(function (r) { return r; }));
            });
        }
    };
    _NanoSQLStorageQuery.prototype._invalidateCache = function (pks) {
        var _this = this;
        if (!this._store._doCache) {
            return;
        }
        Object.keys(this._store._cacheKeys[this._query.table]).forEach(function (hash) {
            var i = pks.length;
            var valid = true;
            while (i-- && valid) {
                if (_this._store._cacheKeys[_this._query.table][hash][pks[i]]) {
                    delete _this._store._cache[_this._query.table][hash];
                    delete _this._store._cacheKeys[_this._query.table][hash];
                    valid = false;
                }
            }
        });
    };
    _NanoSQLStorageQuery.prototype._setCache = function (rows) {
        var _this = this;
        this._store._cache[this._query.table][this._hash] = rows;
        this._store._cacheKeys[this._query.table][this._hash] = {};
        rows.forEach(function (r) {
            _this._store._cacheKeys[_this._query.table][_this._hash][r[_this._store.tableInfo[_this._query.table]._pk]] = true;
        });
    };
    _NanoSQLStorageQuery.prototype._select = function (next) {
        var _this = this;
        this._hash = utilities_1.hash(JSON.stringify(__assign({}, this._query, { queryID: null })));
        var canCache = !this._query.join && !this._query.orm && this._store._doCache && !Array.isArray(this._query.table);
        if (canCache && this._store._cache[this._query.table][this._hash]) {
            this._query.result = this._store._cache[this._query.table][this._hash];
            next(this._query);
            return;
        }
        this._getRows(function (rows) {
            if (!["having", "orderBy", "offset", "limit", "actionArgs", "groupBy", "orm", "join"].filter(function (k) { return _this._query[k]; }).length) {
                if (canCache)
                    _this._setCache(rows);
                _this._query.result = rows;
                next(_this._query);
            }
            else {
                new _MutateSelection(_this._query, _this._store)._executeQueryArguments(rows, function (resultRows) {
                    if (canCache)
                        _this._setCache(rows);
                    _this._query.result = resultRows;
                    next(_this._query);
                });
            }
        });
    };
    _NanoSQLStorageQuery.prototype._updateORMRows = function (relation, fromPKs, add, primaryKey, complete) {
        var _this = this;
        var fromPk = this._store.tableInfo[relation._fromTable]._pk;
        this._store._read(relation._fromTable, fromPKs, function (rows) {
            new utilities_1.ALL(rows.map(function (row) {
                return function (rowDone) {
                    var newRow = Object.isFrozen(row) ? utilities_1._assign(row) : row;
                    if (relation._fromType === "array") {
                        newRow[relation._fromColumn] = newRow[relation._fromColumn] || [];
                        var idxOf = newRow[relation._fromColumn].indexOf(primaryKey);
                        if (add) {
                            if (idxOf === -1) {
                                newRow[relation._fromColumn].push(primaryKey);
                            }
                            else {
                                rowDone();
                            }
                        }
                        else {
                            if (idxOf !== -1) {
                                newRow[relation._fromColumn].splice(idxOf, 1);
                            }
                            else {
                                rowDone();
                            }
                        }
                        newRow[relation._fromColumn].sort();
                    }
                    else {
                        if (add) {
                            newRow[relation._fromColumn] = primaryKey;
                        }
                        else {
                            newRow[relation._fromColumn] = null;
                        }
                    }
                    _this._store._nsql.table(relation._fromTable).query("upsert", newRow).comment("ORM Update").exec().then(rowDone);
                };
            })).then(complete);
        });
    };
    _NanoSQLStorageQuery.prototype._syncORM = function (type, oldRows, newRows, complete) {
        var _this = this;
        var useRelations = this._store._relToTable[this._query.table];
        if (this._query.comments.indexOf("ORM Update") !== -1) {
            complete();
            return;
        }
        if (!useRelations || !useRelations.length) {
            complete();
            return;
        }
        var cnt = Math.max(oldRows.length, newRows.length);
        var arra = [];
        while (cnt--)
            arra.push(" ");
        new utilities_1.CHAIN(arra.map(function (v, idx) {
            return function (rowDone) {
                new utilities_1.ALL(useRelations.map(function (relation) {
                    return function (relationDone) {
                        var equals = function (val1, val2) {
                            if (Array.isArray(val1) && Array.isArray(val2)) {
                                if (val1.length !== val2.length) {
                                    return false;
                                }
                                return val1.filter(function (v, i) { return v !== val2[i]; }).length > 0;
                            }
                            else {
                                return val1 === val2;
                            }
                        };
                        switch (type) {
                            case "del":
                                var delPrimarykey = oldRows[idx][_this._store.tableInfo[_this._query.table]._pk];
                                var updateIDs = relation._thisType === "array" ? (oldRows[idx][relation._thisColumn] || []) : ([oldRows[idx][relation._thisColumn]].filter(function (v) { return v; }));
                                _this._updateORMRows(relation, updateIDs, false, delPrimarykey, relationDone);
                                break;
                            case "add":
                                var primaryKey_1 = newRows[idx][_this._store.tableInfo[_this._query.table]._pk];
                                if (oldRows[idx]) {
                                    if (equals(oldRows[idx][relation._thisColumn], newRows[idx][relation._thisColumn])) {
                                        relationDone();
                                    }
                                    else {
                                        if (relation._thisType === "array") {
                                            var addIds = (newRows[idx][relation._thisColumn] || []).filter(function (v) { return (oldRows[idx][relation._thisColumn] || []).indexOf(v) === -1; });
                                            var removeIds = (oldRows[idx][relation._thisColumn] || []).filter(function (v) { return (newRows[idx][relation._thisColumn] || []).indexOf(v) === -1; });
                                            new utilities_1.ALL([addIds, removeIds].map(function (list, i) {
                                                return function (done) {
                                                    _this._updateORMRows(relation, list, i === 0, primaryKey_1, done);
                                                };
                                            })).then(relationDone);
                                        }
                                        else {
                                            var addRelation = function () {
                                                if (newRows[idx][relation._thisColumn] !== null && newRows[idx][relation._thisColumn] !== undefined) {
                                                    _this._updateORMRows(relation, [newRows[idx][relation._thisColumn]], true, primaryKey_1, relationDone);
                                                }
                                                else {
                                                    relationDone();
                                                }
                                            };
                                            if (oldRows[idx][relation._thisColumn] !== null && oldRows[idx][relation._thisColumn] !== undefined) {
                                                _this._updateORMRows(relation, [oldRows[idx][relation._thisColumn]], false, primaryKey_1, addRelation);
                                            }
                                            else {
                                                addRelation();
                                            }
                                        }
                                    }
                                }
                                else {
                                    var valuesToAdd = relation._thisType === "array" ? (newRows[idx][relation._thisColumn] || []) : ([newRows[idx][relation._thisColumn]].filter(function (v) { return v; }));
                                    if (valuesToAdd && valuesToAdd.length) {
                                        _this._updateORMRows(relation, valuesToAdd, true, primaryKey_1, relationDone);
                                    }
                                    else {
                                        relationDone();
                                    }
                                }
                                break;
                        }
                    };
                })).then(rowDone);
            };
        })).then(complete);
    };
    _NanoSQLStorageQuery.prototype._upsert = function (next) {
        var _this = this;
        var pk = this._store.tableInfo[this._query.table]._pk;
        if (this._isInstanceTable) {
            this._getRows(function (rows) {
                _this._query.result = _this._query.table.map(function (r) {
                    if (rows.indexOf(r) === -1) {
                        return r;
                    }
                    return __assign({}, _this._query.actionArgs, r);
                });
                next(_this._query);
            });
            return;
        }
        if (this._query.where) {
            this._getRows(function (rows) {
                if (rows.length) {
                    new utilities_1.CHAIN(rows.map(function (r) {
                        return function (rowDone) {
                            _this._store._write(_this._query.table, r[pk], r, _this._query.actionArgs || {}, rowDone);
                        };
                    })).then(function (newRows) {
                        var pks = newRows.map(function (r) { return r[pk]; });
                        _this._invalidateCache(pks);
                        _this._query.result = [{ msg: newRows.length + " row(s) modfied.", affectedRowPKS: pks, affectedRows: newRows }];
                        _this._syncORM("add", rows, newRows, function () {
                            next(_this._query);
                        });
                    });
                }
                else {
                    _this._query.result = [{ msg: "0 row(s) modfied.", affectedRowPKS: [], affectedRows: [] }];
                    next(_this._query);
                }
            });
        }
        else {
            var row_1 = this._query.actionArgs || {};
            this._store._cache[this._query.table] = {};
            var write_1 = function (oldRow) {
                _this._store._write(_this._query.table, row_1[pk], oldRow, row_1, function (result) {
                    _this._invalidateCache([result[pk]]);
                    _this._query.result = [{ msg: "1 row inserted.", affectedRowPKS: [result[pk]], affectedRows: [result] }];
                    _this._syncORM("add", [oldRow].filter(function (r) { return r; }), [result], function () {
                        next(_this._query);
                    });
                });
            };
            if (row_1[pk] !== undefined) {
                this._store._read(this._query.table, [row_1[pk]], function (rows) {
                    if (rows.length) {
                        write_1(rows[0]);
                    }
                    else {
                        write_1(null);
                    }
                });
            }
            else {
                write_1(null);
            }
        }
    };
    _NanoSQLStorageQuery.prototype._delete = function (next) {
        var _this = this;
        if (this._isInstanceTable) {
            if (this._query.where) {
                this._getRows(function (rows) {
                    _this._query.result = _this._query.table.filter(function (row) {
                        return rows.indexOf(row) === -1;
                    });
                    next(_this._query);
                });
            }
            else {
                this._query.result = [];
                next(this._query);
            }
            return;
        }
        if (this._query.where) {
            this._getRows(function (rows) {
                rows = rows.filter(function (r) { return r; });
                if (rows.length) {
                    new utilities_1.ALL(rows.map(function (r) {
                        return function (done) {
                            _this._store._delete(_this._query.table, r[_this._store.tableInfo[_this._query.table]._pk], done);
                        };
                    })).then(function (affectedRows) {
                        _this._store._cache[_this._query.table] = {};
                        var pks = rows.map(function (r) { return r[_this._store.tableInfo[_this._query.table]._pk]; });
                        _this._invalidateCache(pks);
                        _this._query.result = [{ msg: rows.length + " row(s) deleted.", affectedRowPKS: pks, affectedRows: rows }];
                        _this._syncORM("del", rows, [], function () {
                            next(_this._query);
                        });
                    });
                }
                else {
                    _this._query.result = [{ msg: "0 row(s) deleted.", affectedRowPKS: [], affectedRows: [] }];
                    next(_this._query);
                }
            });
        }
        else {
            this._drop(next);
        }
    };
    _NanoSQLStorageQuery.prototype._drop = function (next) {
        var _this = this;
        if (this._isInstanceTable) {
            this._query.result = [];
            next(this._query);
            return;
        }
        this._store._rangeReadIDX(this._query.table, undefined, undefined, function (rows) {
            _this._store._cache[_this._query.table] = {};
            _this._store._cacheKeys[_this._query.table] = {};
            _this._store._drop(_this._query.table, function () {
                _this._query.result = [{ msg: "'" + _this._query.table + "' table dropped.", affectedRowPKS: rows.map(function (r) { return r[_this._store.tableInfo[_this._query.table]._pk]; }), affectedRows: rows }];
                _this._syncORM("del", rows, [], function () {
                    next(_this._query);
                });
            });
        });
    };
    return _NanoSQLStorageQuery;
}());
exports._NanoSQLStorageQuery = _NanoSQLStorageQuery;
var _MutateSelection = (function () {
    function _MutateSelection(q, s) {
        this.q = q;
        this.s = s;
        this._groupByColumns = [];
    }
    _MutateSelection.prototype._join = function (rows, complete) {
        var _this = this;
        if (!this.q.join) {
            return;
        }
        var joinConditions = {};
        if (this.q.join.type !== "cross" && this.q.join.where) {
            joinConditions = {
                _left: this.q.join.where[0],
                _check: this.q.join.where[1],
                _right: this.q.join.where[2]
            };
        }
        var leftTable = this.q.table;
        var rightTable = this.q.join.table;
        this._doJoin(this.q.join.type, leftTable, rightTable, joinConditions, function (joinedRows) {
            if (_this.q.where) {
                complete(joinedRows.filter(function (row, idx) {
                    return Array.isArray(_this.q.where) ? _where(row, _this.q.where || [], idx, true) : _this.q.where(row, idx);
                }));
            }
            else if (_this.q.range) {
                complete(joinedRows.filter(function (row, idx) {
                    return _this.q.range && _this.q.range[0] >= idx && _this.q.range[1] <= idx;
                }));
            }
            else {
                complete(joinedRows);
            }
        });
    };
    _MutateSelection.prototype._groupByKey = function (columns, row) {
        return columns.reduce(function (p, c) {
            if (c.indexOf(".length") !== -1) {
                return p + "." + String((row[c.replace(".length", "")] || []).length);
            }
            else {
                return p + "." + String(row[c]);
            }
        }, "").slice(1);
    };
    _MutateSelection.prototype._groupBy = function (rows) {
        var _this = this;
        var columns = this.q.groupBy || {};
        var sortedRows = rows.sort(function (a, b) {
            return _this._sortObj(a, b, columns, true);
        });
        sortedRows.forEach(function (val, idx) {
            var groupByKey = Object.keys(columns).map(function (k) { return String(val[k]) || ""; }).join(".");
            if (!_this._sortGroups) {
                _this._sortGroups = {};
            }
            if (!_this._sortGroups[groupByKey]) {
                _this._sortGroups[groupByKey] = [];
            }
            _this._sortGroups[groupByKey].push(idx);
        });
        return sortedRows;
    };
    _MutateSelection.prototype._having = function (rows) {
        var _this = this;
        return rows.filter(function (row, idx) {
            return Array.isArray(_this.q.having) ? _where(row, _this.q.having || [], idx, true) : _this.q.having(row, idx);
        });
    };
    _MutateSelection.prototype._orderBy = function (rows) {
        var _this = this;
        return rows.sort(function (a, b) {
            return _this._sortObj(a, b, _this.q.orderBy || {}, false);
        });
    };
    _MutateSelection.prototype._offset = function (rows) {
        var _this = this;
        return rows.filter(function (row, index) {
            return _this.q.offset ? index >= _this.q.offset : true;
        });
    };
    _MutateSelection.prototype._limit = function (rows) {
        var _this = this;
        return rows.filter(function (row, index) {
            return _this.q.limit ? index < _this.q.limit : true;
        });
    };
    _MutateSelection.prototype._orm = function (rows, complete) {
        var _this = this;
        var ormQueries = this.q.orm ? this.q.orm.map(function (o) {
            if (typeof o === "string") {
                return {
                    key: o,
                    limit: 5
                };
            }
            return o;
        }) : [];
        new utilities_1.ALL(rows.map(function (row) {
            row = Object.isFrozen(row) ? utilities_1._assign(row) : row;
            return function (rowResult) {
                new utilities_1.ALL(ormQueries.map(function (orm) {
                    return function (ormResult) {
                        if (!row[orm.key] || !row[orm.key].length) {
                            ormResult();
                            return;
                        }
                        var relateData = _this.s._columnsAreTables[_this.q.table][orm.key];
                        if (relateData) {
                            _this.s._nsql.table(relateData._toTable).query("select").where([_this.s.tableInfo[relateData._toTable]._pk, relateData._thisType === "array" ? "IN" : "=", row[orm.key]]).exec().then(function (rows) {
                                var q = _this.s._nsql.table(rows).query("select", orm.select);
                                if (orm.where) {
                                    q.where(orm.where);
                                }
                                if (orm.limit !== undefined) {
                                    q.limit(orm.limit);
                                }
                                if (orm.offset !== undefined) {
                                    q.offset(orm.offset);
                                }
                                if (orm.orderBy) {
                                    q.orderBy(orm.orderBy);
                                }
                                q.exec().then(function (result) {
                                    if (!rows.filter(function (r) { return r; }).length) {
                                        row[orm.key] = relateData._thisType === "array" ? [] : undefined;
                                    }
                                    else {
                                        row[orm.key] = relateData._thisType === "array" ? rows : rows[0];
                                    }
                                    ormResult();
                                });
                            });
                        }
                        else {
                            ormResult();
                        }
                    };
                })).then(function () {
                    rowResult(row);
                });
            };
        })).then(complete);
    };
    _MutateSelection.prototype._doJoin = function (type, leftTable, rightTable, joinConditions, complete) {
        var L = "left";
        var R = "right";
        var O = "outer";
        var C = "cross";
        var t = this;
        var firstTableData = t.s.tableInfo[type === R ? rightTable : leftTable];
        var seconTableData = t.s.tableInfo[type === R ? leftTable : rightTable];
        var pad = function (num, size) {
            var s = num + "";
            while (s.length < size)
                s = "0" + s;
            return s;
        };
        var doJoinRows = function (leftRow, rightRow) {
            return [firstTableData, seconTableData].reduce(function (prev, cur, i) {
                cur._keys.forEach(function (k) {
                    prev[cur._name + "." + k] = ((i === 0 ? leftRow : rightRow) || {})[k];
                });
                return prev;
            }, {});
        };
        var joinTable = [];
        var rightKey = joinConditions && joinConditions._right ? joinConditions._right.split(".").pop() || "" : "";
        var usedSecondTableRows = [];
        t.s._read(firstTableData._name, function (firstRow, idx, keep) {
            var hasOneRelation = false;
            t.s._read(seconTableData._name, function (secondRow, idx2, keep2) {
                if (!joinConditions || type === C) {
                    joinTable.push(doJoinRows(firstRow, secondRow));
                    hasOneRelation = true;
                }
                else {
                    var willJoinRows = _where((_a = {},
                        _a[firstTableData._name] = firstRow,
                        _a[seconTableData._name] = secondRow,
                        _a), [joinConditions._left, joinConditions._check, type === R ? firstRow[rightKey] : secondRow[rightKey]], 0);
                    if (willJoinRows) {
                        if (type === O)
                            usedSecondTableRows.push(idx2);
                        joinTable.push(doJoinRows(firstRow, secondRow));
                        hasOneRelation = true;
                    }
                }
                keep2(false);
                var _a;
            }, function () {
                if (!hasOneRelation && [L, R, O].indexOf(type) > -1) {
                    joinTable.push(doJoinRows(firstRow, null));
                }
                keep(false);
            });
        }, function () {
            if (type === O) {
                t.s._read(seconTableData._name, function (secondRow, idx, keep) {
                    if (usedSecondTableRows.indexOf(idx) === -1) {
                        joinTable.push(doJoinRows(null, secondRow));
                    }
                    keep(false);
                }, function () {
                    complete(joinTable);
                });
            }
            else {
                complete(joinTable);
            }
        });
    };
    _MutateSelection.prototype._sortObj = function (objA, objB, columns, resolvePaths) {
        return Object.keys(columns).reduce(function (prev, cur) {
            var A = resolvePaths ? utilities_1.objQuery(cur, objA) : objA[cur];
            var B = resolvePaths ? utilities_1.objQuery(cur, objB) : objB[cur];
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
    _MutateSelection.prototype._mutateRows = function (rows, complete) {
        var _this = this;
        var columnSelection = this.q.actionArgs;
        var functionResults = {};
        var fnGroupByResults = {};
        if (columnSelection && columnSelection.length) {
            var hasAggregateFun_1 = false;
            var columnData_1 = {};
            columnSelection.forEach(function (column) {
                if (column.indexOf("(") === -1) {
                    return;
                }
                var fnName = (column.match(/^.*\(/g) || [""])[0].replace(/\(|\)/g, "").toUpperCase();
                var fn = index_1.NanoSQLInstance.functions[fnName];
                var key = column.split(" AS ").length === 1 ? fnName : (column.split(" AS ").pop() || "").trim();
                if (!fn) {
                    throw new Error("'" + fnName + "' is not a valid function!");
                }
                if (fn.type === "A") {
                    hasAggregateFun_1 = true;
                }
                columnData_1[column] = {
                    fn: fn,
                    key: key
                };
            });
            new utilities_1.ALL(columnSelection.map(function (column) {
                return function (columnDone) {
                    if (column.indexOf("(") > -1) {
                        var fnArgs_1 = (column.match(/\(.*\)/g) || [""])[0].replace(/\(|\)/g, "").split(",").map(function (v) { return v.trim(); });
                        if (_this._sortGroups && hasAggregateFun_1) {
                            new utilities_1.ALL(Object.keys(_this._sortGroups).map(function (k) {
                                if (!fnGroupByResults[k]) {
                                    fnGroupByResults[k] = {};
                                }
                                return function (fnDone) {
                                    (_a = columnData_1[column].fn).call.apply(_a, [rows.filter(function (r, i) { return _this._sortGroups[k].indexOf(i) > -1; }), function (result) {
                                            fnGroupByResults[k][columnData_1[column].key] = result;
                                            fnDone();
                                        }].concat(fnArgs_1));
                                    var _a;
                                };
                            })).then(columnDone);
                        }
                        else {
                            (_a = columnData_1[column].fn).call.apply(_a, [rows, function (result) {
                                    functionResults[columnData_1[column].key] = result;
                                    columnDone();
                                }].concat(fnArgs_1));
                        }
                    }
                    else {
                        columnDone();
                    }
                    var _a;
                };
            })).then(function () {
                var doMuateRows = function (row, idx, fnResults) {
                    var newRow = {};
                    columnSelection.forEach(function (column) {
                        var hasFunc = column.indexOf("(") > -1;
                        var type = hasFunc ? columnData_1[column].fn.type : "";
                        if (column.indexOf(" AS ") > -1) {
                            var alias = column.split(" AS ");
                            var key = hasFunc ? columnData_1[column].key : alias[0].trim();
                            newRow[alias[1]] = hasFunc ? (type === "A" ? fnResults[key] : fnResults[key][idx]) : utilities_1.objQuery(key, row, _this.q.join !== undefined);
                        }
                        else {
                            var key = hasFunc ? columnData_1[column].key : column;
                            newRow[column] = hasFunc ? (type === "A" ? fnResults[key] : fnResults[key][idx]) : utilities_1.objQuery(key, row, _this.q.join !== undefined);
                        }
                    });
                    return newRow;
                };
                if (_this._sortGroups && hasAggregateFun_1) {
                    var newRows_1 = [];
                    Object.keys(_this._sortGroups).forEach(function (k) {
                        var thisRow = rows.filter(function (r, i) { return _this._sortGroups[k].indexOf(i) > -1; }).filter(function (v, i) { return i < 1; });
                        if (thisRow && thisRow.length) {
                            newRows_1.push(doMuateRows(thisRow[0], 0, fnGroupByResults[k]));
                        }
                    });
                    complete(newRows_1);
                }
                else if (hasAggregateFun_1) {
                    complete(rows.filter(function (v, i) { return i < 1; }).map(function (v, i) { return doMuateRows(v, i, functionResults); }));
                }
                else {
                    complete(rows.map(function (v, i) { return doMuateRows(v, i, functionResults); }));
                }
            });
        }
        else {
            complete(rows);
        }
    };
    _MutateSelection.prototype._executeQueryArguments = function (inputRows, callback) {
        var _this = this;
        var afterMutate = function () {
            if (_this.q.having) {
                inputRows = _this._having(inputRows);
            }
            if (_this.q.orderBy) {
                inputRows = _this._orderBy(inputRows);
            }
            if (_this.q.offset) {
                inputRows = _this._offset(inputRows);
            }
            if (_this.q.limit) {
                inputRows = _this._limit(inputRows);
            }
            callback(inputRows);
        };
        var afterORM = function () {
            if (_this.q.actionArgs && _this.q.actionArgs.length) {
                _this._mutateRows(inputRows, function (newRows) {
                    inputRows = newRows;
                    afterMutate();
                });
            }
            else {
                afterMutate();
            }
        };
        var afterJoin = function () {
            if (_this.q.groupBy) {
                inputRows = _this._groupBy(inputRows);
            }
            if (_this.q.orm) {
                _this._orm(inputRows, function (newRows) {
                    inputRows = newRows;
                    afterORM();
                });
            }
            else {
                afterORM();
            }
        };
        if (this.q.join) {
            this._join(inputRows, function (rows) {
                inputRows = rows;
                afterJoin();
            });
        }
        else {
            afterJoin();
        }
    };
    return _MutateSelection;
}());
exports._MutateSelection = _MutateSelection;
var _RowSelection = (function () {
    function _RowSelection(q, s) {
        this.q = q;
        this.s = s;
    }
    _RowSelection.prototype.getRows = function (callback) {
        var _this = this;
        if (this.q.join) {
            callback([]);
            return;
        }
        if (this.q.join && this.q.orm) {
            throw new Error("Cannot do a JOIN and ORM command at the same time!");
        }
        if ([this.q.where, this.q.range, this.q.trie].filter(function (i) { return i; }).length > 1) {
            throw new Error("Can only have ONE of Trie, Range or Where!");
        }
        if (this.q.trie && this.q.trie.column && this.q.trie.search) {
            this._selectByTrie(callback);
            return;
        }
        if (this.q.range && this.q.range.length) {
            this._selectByRange(callback);
            return;
        }
        if (!this.q.where || !this.q.where.length) {
            this._fullTableScan(callback);
            return;
        }
        if (!Array.isArray(this.q.where)) {
            this._fullTableScan(function (rows) {
                callback(rows.filter(_this.q.where));
            });
            return;
        }
        var doFastRead = false;
        if (typeof this.q.where[0] === "string") {
            doFastRead = this._isOptimizedWhere(this.q.where) === 0;
        }
        else {
            doFastRead = (this.q.where || []).reduce(function (prev, cur, i) {
                if (i % 2 === 1)
                    return prev;
                return prev + _this._isOptimizedWhere(cur);
            }, 0) === 0;
        }
        if (doFastRead) {
            this._selectByKeys(callback);
            return;
        }
        this._fullTableScan(callback);
    };
    _RowSelection.prototype._selectByKeys = function (callback) {
        var _this = this;
        if (this.q.where && typeof this.q.where[0] === "string") {
            this._selectRowsByIndex(this.q.where, callback);
        }
        else if (this.q.where) {
            var resultRows_1 = [];
            var lastCommand_1 = "";
            new utilities_1.CHAIN(this.q.where.map(function (wArg) {
                return function (nextWArg) {
                    if (wArg === "OR" || wArg === "AND") {
                        lastCommand_1 = wArg;
                        nextWArg();
                        return;
                    }
                    _this._selectRowsByIndex(wArg, function (rows) {
                        if (lastCommand_1 === "AND") {
                            var idx_1 = rows.map(function (r) { return r[_this.s.tableInfo[_this.q.table]._pk]; });
                            resultRows_1 = resultRows_1.filter(function (row) {
                                return idx_1.indexOf(row[_this.s.tableInfo[_this.q.table]._pk]) !== -1;
                            });
                        }
                        else {
                            resultRows_1.concat(rows);
                        }
                        nextWArg();
                    });
                };
            })).then(function () {
                callback(resultRows_1);
            });
        }
    };
    _RowSelection.prototype._selectRowsByIndex = function (where, callback) {
        var _this = this;
        if (where[1] === "BETWEEN") {
            var secondaryIndexKey = where[0] === this.s.tableInfo[this.q.table]._pk ? "" : where[0];
            if (secondaryIndexKey) {
                var idxTable = "_" + this.q.table + "_idx_" + secondaryIndexKey;
                this.s._rangeReadPKs(idxTable, where[2][0], where[2][1], function (rows) {
                    var keys = [].concat.apply([], rows);
                    _this.s._read(_this.q.table, keys, callback);
                });
            }
            else {
                this.s._rangeReadPKs(this.q.table, where[2][0], where[2][1], function (rows) {
                    callback(rows);
                });
            }
            return;
        }
        var keys = [];
        switch (where[1]) {
            case "IN":
                keys = where[2];
                break;
            case "=":
                keys = [where[2]];
                break;
        }
        if (where[0] === this.s.tableInfo[this.q.table]._pk) {
            this.s._read(this.q.table, keys, callback);
        }
        else {
            new utilities_1.ALL(keys.map(function (idx) {
                return function (complete) {
                    _this.s._secondaryIndexRead(_this.q.table, where[0], idx, complete);
                };
            })).then(function (rows) {
                callback([].concat.apply([], rows));
            });
        }
    };
    _RowSelection.prototype._selectByRange = function (callback) {
        var _this = this;
        if (this.q.range) {
            var r_1 = this.q.range;
            this.s._adapter.getIndex(this.q.table, true, function (count) {
                var fromIdx = r_1[0] > 0 ? r_1[1] : count + r_1[0] - r_1[1];
                var toIdx = fromIdx;
                var counter = Math.abs(r_1[0]) - 1;
                while (counter--) {
                    toIdx++;
                }
                _this.s._rangeReadIDX(_this.q.table, fromIdx, toIdx, callback);
            });
        }
        else {
            callback([]);
        }
    };
    _RowSelection.prototype._selectByTrie = function (callback) {
        if (this.q.trie) {
            this.s._trieRead(this.q.table, this.q.trie.column, this.q.trie.search, callback);
        }
        else {
            callback([]);
        }
    };
    _RowSelection.prototype._fullTableScan = function (callback) {
        var _this = this;
        this.s._read(this.q.table, function (row, i, keep) {
            keep(_this.q.where ? Array.isArray(_this.q.where) ? _where(row, _this.q.where || [], i || 0) : _this.q.where(row, i) : true);
        }, callback);
    };
    _RowSelection.prototype._isOptimizedWhere = function (wArgs) {
        var tableData = this.s.tableInfo[this.q.table];
        if (["=", "IN", "BETWEEN"].indexOf(wArgs[1]) > -1) {
            if (wArgs[0] === tableData._pk || tableData._secondaryIndexes.indexOf(wArgs[0]) > -1) {
                return 0;
            }
        }
        return 1;
    };
    return _RowSelection;
}());
exports._RowSelection = _RowSelection;
var InstanceSelection = (function () {
    function InstanceSelection(q) {
        this.q = q;
    }
    InstanceSelection.prototype.getRows = function (callback) {
        var _this = this;
        if (this.q.join || this.q.orm || this.q.trie) {
            throw new Error("Cannot do a JOIN, ORM or TRIE command with instance table!");
        }
        if (this.q.range && this.q.range.length) {
            var range = this.q.range, from_1, to_1;
            if (range[0] < 0) {
                from_1 = (this.q.table.length) + range[0] - range[1];
            }
            else {
                from_1 = range[1];
            }
            var cnt = Math.abs(range[0]) - 1;
            to_1 = from_1;
            while (cnt--) {
                to_1++;
            }
            callback(this.q.table.filter(function (val, idx) {
                return idx >= from_1 && idx <= to_1;
            }));
            return;
        }
        callback(this.q.table.filter(function (row, i) {
            if (_this.q.where) {
                return Array.isArray(_this.q.where) ? _where(row, _this.q.where || [], i) : _this.q.where(row, i);
            }
            return true;
        }));
    };
    return InstanceSelection;
}());
exports.InstanceSelection = InstanceSelection;
var _where = function (singleRow, where, rowIDX, ignoreFirstPath) {
    var commands = ["AND", "OR"];
    if (typeof where[0] !== "string") {
        var hasAnd_1 = false;
        var checkWhere_1 = where.map(function (cur, idx) {
            if (commands.indexOf(cur) !== -1) {
                if (cur === "AND")
                    hasAnd_1 = true;
                return cur;
            }
            else {
                return _compare(cur[2], cur[1], cur[0] === "_IDX_" ? rowIDX : utilities_1.objQuery(cur[0], singleRow, ignoreFirstPath)) === 0 ? true : false;
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
        return _compare(where[2], where[1], where[0] === "_IDX_" ? rowIDX : utilities_1.objQuery(where[0], singleRow, ignoreFirstPath)) === 0 ? true : false;
    }
};
var _compare = function (val1, compare, val2) {
    var setValue = function (val) {
        return ["LIKE", "NOT LIKE"].indexOf(compare) > -1 ? String(val || "").toLowerCase() : val;
    };
    var columnValue = setValue(val2);
    var givenValue = setValue(val1);
    if (val1 === "NULL" || val1 === "NOT NULL") {
        var pos = compare === "=" || compare === "LIKE";
        return (val1 === "NULL" ?
            (val2 === null || val2 === undefined) :
            (val2 !== null && val2 !== undefined)) ?
            (pos ? 0 : 1) : (pos ? 1 : 0);
    }
    switch (compare) {
        case "=": return columnValue === givenValue ? 0 : 1;
        case "!=": return columnValue !== givenValue ? 0 : 1;
        case ">": return columnValue > givenValue ? 0 : 1;
        case "<": return columnValue < givenValue ? 0 : 1;
        case "<=": return columnValue <= givenValue ? 0 : 1;
        case ">=": return columnValue >= givenValue ? 0 : 1;
        case "IN": return (givenValue || []).indexOf(columnValue) < 0 ? 1 : 0;
        case "NOT IN": return (givenValue || []).indexOf(columnValue) < 0 ? 0 : 1;
        case "REGEX": return columnValue.match(givenValue) ? 0 : 1;
        case "LIKE": return columnValue.indexOf(givenValue) < 0 ? 1 : 0;
        case "NOT LIKE": return columnValue.indexOf(givenValue) > 0 ? 1 : 0;
        case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] >= columnValue ? 0 : 1;
        case "HAVE": return (columnValue || []).indexOf(givenValue) < 0 ? 1 : 0;
        case "NOT HAVE": return (columnValue || []).indexOf(givenValue) < 0 ? 0 : 1;
        case "INTERSECT": return (columnValue || []).filter(function (l) { return (givenValue || []).indexOf(l) > -1; }).length > 0 ? 0 : 1;
        case "NOT INTERSECT": return (columnValue || []).filter(function (l) { return (givenValue || []).indexOf(l) > -1; }).length === 0 ? 0 : 1;
        default: return 1;
    }
};
