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
var queryObj = {
    select: function (self, next) {
        self._select(next);
    },
    upsert: function (self, next) {
        self._upsert(next);
    },
    delete: function (self, next) {
        self._delete(next);
    },
    drop: function (self, next) {
        self._drop(next);
    },
    "show tables": function (self, next) {
        self._query.result = Object.keys(self._store.tableInfo);
        next(self._query);
    },
    describe: function (self, next) {
        if (typeof self._query.table !== "string") {
            next(self._query);
            return;
        }
        self._query.result = utilities_1._assign(self._store.models[self._query.table]);
        next(self._query);
    },
};
/**
 * A new Storage Query class is inilitized for every query, performing the actions
 * against the storage class itself to get the desired outcome.
 *
 * @export
 * @class _NanoSQLStorageQuery
 */
// tslint:disable-next-line
var _NanoSQLStorageQuery = /** @class */ (function () {
    function _NanoSQLStorageQuery(_store) {
        this._store = _store;
    }
    /**
     * Execute the query against this class.
     *
     * @param {IdbQuery} query
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype.doQuery = function (query, next) {
        this._query = query;
        this._isInstanceTable = Array.isArray(query.table);
        queryObj[query.action](this, next);
    };
    /**
     * Retreive the selected rows for this query, works for instance tables and standard ones.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _NanoSQLStorageQuery
     */
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
    _NanoSQLStorageQuery.prototype._setCache = function (rows) {
        var _this = this;
        this._store._cache[this._query.table][this._hash] = rows;
        // store primary keys for this cache, used for cache invalidation
        this._store._cacheKeys[this._query.table][this._hash] = {};
        rows.forEach(function (r) {
            _this._store._cacheKeys[_this._query.table][_this._hash][r[_this._store.tableInfo[_this._query.table]._pk]] = true;
        });
    };
    /**
     * Initilze a SELECT query.
     *
     * @internal
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._select = function (next) {
        var _this = this;
        this._hash = utilities_1.hash(JSON.stringify(__assign({}, this._query, { queryID: null })));
        var canCache = !this._query.join && !this._query.orm && this._store._doCache && !Array.isArray(this._query.table);
        // Query cache for the win!
        /*if (canCache && this._store._cache[this._query.table as any][this._hash]) {
            this._query.result = this._store._cache[this._query.table as any][this._hash];
            next(this._query);
            return;
        }*/
        this._getRows(function (rows) {
            // No query arguments, we can skip the whole mutation selection class
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
            utilities_1.fastALL(rows, function (row, i, rowDone) {
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
                _this._store._nsql.query("upsert", newRow).comment("_orm_skip").manualExec({ table: relation._fromTable }).then(rowDone);
            }).then(complete);
        });
    };
    _NanoSQLStorageQuery.prototype._syncORM = function (type, oldRows, newRows, complete) {
        var _this = this;
        if (!this._store._hasORM) {
            complete();
            return;
        }
        var useRelations = this._store._relToTable[this._query.table];
        if (this._query.comments.indexOf("_orm_skip") !== -1) {
            complete();
            return;
        }
        if (!useRelations || !useRelations.length) {
            complete();
            return;
        }
        // go over every relation and every changed row to make the needed updates.
        var cnt = Math.max(oldRows.length, newRows.length);
        var arra = [];
        while (cnt--)
            arra.push(" ");
        utilities_1.fastCHAIN(arra, function (v, idx, rowDone) {
            utilities_1.fastALL(useRelations, function (relation, k, relationDone) {
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
                        // possibly update existing relation
                        // if adding oldRows[idx] is possibly undefined (if theres no previouse row record)
                        if (oldRows[idx]) {
                            // previouse record exists
                            if (equals(oldRows[idx][relation._thisColumn], newRows[idx][relation._thisColumn])) {
                                // no update needed
                                relationDone();
                            }
                            else {
                                if (relation._thisType === "array") {
                                    var addIds = (newRows[idx][relation._thisColumn] || []).filter(function (v) { return (oldRows[idx][relation._thisColumn] || []).indexOf(v) === -1; });
                                    var removeIds = (oldRows[idx][relation._thisColumn] || []).filter(function (v) { return (newRows[idx][relation._thisColumn] || []).indexOf(v) === -1; });
                                    utilities_1.fastALL([addIds, removeIds], function (list, i, done) {
                                        _this._updateORMRows(relation, list, i === 0, primaryKey_1, done);
                                    }).then(relationDone);
                                }
                                else {
                                    var addRelation = function () {
                                        // add new relation
                                        if (newRows[idx][relation._thisColumn] !== null && newRows[idx][relation._thisColumn] !== undefined) {
                                            _this._updateORMRows(relation, [newRows[idx][relation._thisColumn]], true, primaryKey_1, relationDone);
                                        }
                                        else {
                                            // no new relation
                                            relationDone();
                                        }
                                    };
                                    // remove old connection
                                    if (oldRows[idx][relation._thisColumn] !== null && oldRows[idx][relation._thisColumn] !== undefined) {
                                        _this._updateORMRows(relation, [oldRows[idx][relation._thisColumn]], false, primaryKey_1, addRelation);
                                    }
                                    else {
                                        // no old connection, just add the new one
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
            }).then(rowDone);
        }).then(complete);
    };
    /**
     * For each updated row, update view columns from remote records that are related.
     *
     * @private
     * @param {any[]} rows
     * @param {() => void} complete
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._updateRowViews = function (newRowData, existingRow, complete) {
        var _this = this;
        if (!this._store._hasViews) {
            complete(newRowData);
            return;
        }
        // nothing to update
        if (newRowData === null || newRowData === undefined) {
            complete(newRowData || {});
            return;
        }
        utilities_1.fastALL(Object.keys(this._store.tableInfo[this._query.table]._views), function (table, i, done) {
            var pk = _this._store.tableInfo[_this._query.table]._views[table].pkColumn;
            // reference/pk column isn't being updated.
            if (newRowData[pk] === undefined) {
                done();
                return;
            }
            // no changes in reference, skip query and upate
            if (newRowData[pk] === existingRow[pk]) {
                done();
                return;
            }
            // remove reference
            if (newRowData[pk] === null) {
                _this._store.tableInfo[_this._query.table]._views[table].columns.forEach(function (col) {
                    newRowData[col.thisColumn] = null;
                });
                done();
                return;
            }
            // get reference record and copy everything over
            _this._store._read(table, [newRowData[pk]], function (refRows) {
                // record doesn't exist
                if (!refRows.length && _this._store.tableInfo[_this._query.table]._views[table].mode === "LIVE") {
                    _this._store.tableInfo[_this._query.table]._views[table].columns.forEach(function (col) {
                        newRowData[col.thisColumn] = null;
                    });
                    done();
                    return;
                }
                // record exists, copy over data
                _this._store.tableInfo[_this._query.table]._views[table].columns.forEach(function (col) {
                    newRowData[col.thisColumn] = refRows[0][col.otherColumn];
                });
                done();
            });
        }).then(function () {
            complete(newRowData);
        });
    };
    /**
     * Go to tables that have views pointing to this one, and update their records.
     *
     * @private
     * @param {any[]} updatedRows
     * @param {() => void} complete
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._updateRemoteViews = function (updatedRows, doDel, complete) {
        var _this = this;
        var pk = this._store.tableInfo[this._query.table]._pk;
        // for every updated row
        utilities_1.fastALL(updatedRows, function (row, i, done) {
            // scan all related tables for records attached
            utilities_1.fastALL(_this._store.tableInfo[_this._query.table]._viewTables, function (view, i, rowDone) {
                // delete with echo mode, skip removing records
                if (doDel && _this._store.tableInfo[view.table]._views[_this._query.table].mode === "GHOST") {
                    rowDone();
                    return;
                }
                _this._store._secondaryIndexRead(view.table, view.column, row[pk], function (relatedRows) {
                    // nothing to update
                    if (!relatedRows.length) {
                        rowDone();
                        return;
                    }
                    var columns = _this._store.tableInfo[view.table]._views[_this._query.table].columns;
                    var relPK = _this._store.tableInfo[view.table]._views[_this._query.table].pkColumn;
                    // update the records
                    utilities_1.fastALL(relatedRows, function (rRow, j, rDone) {
                        var i = columns.length;
                        var doUpdate = false;
                        if (doDel) {
                            if (_this._store.tableInfo[view.table]._views[_this._query.table].mode === "LIVE") {
                                doUpdate = true;
                                rRow[relPK] = null;
                                while (i--) {
                                    rRow[columns[i].otherColumn] = null;
                                }
                            }
                        }
                        else {
                            while (i--) {
                                if (rRow[columns[i].otherColumn] !== row[columns[i].thisColumn]) {
                                    rRow[columns[i].otherColumn] = row[columns[i].thisColumn];
                                    doUpdate = true;
                                }
                            }
                        }
                        if (!doUpdate) {
                            rDone();
                            return;
                        }
                        var rPk = _this._store.tableInfo[view.table]._pk;
                        _this._store.adapterWrite(view.table, rRow[rPk], rRow, rDone);
                    }).then(rowDone);
                });
            }).then(done);
        }).then(complete);
    };
    _NanoSQLStorageQuery.prototype._doAfterQuery = function (newRows, doDel, next) {
        var _this = this;
        // no views at all OR this table doesn't have any views pointing to it.
        if (!this._store._hasViews || !this._store.tableInfo[this._query.table]._viewTables.length) {
            next(this._query);
            return;
        }
        this._updateRemoteViews(newRows, doDel, function () {
            next(_this._query);
        });
    };
    /**
     * Initilize an UPSERT query.
     *
     * @internal
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
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
                    utilities_1.fastCHAIN(rows, function (r, i, rowDone) {
                        _this._updateRowViews(_this._query.actionArgs || {}, r, function (updatedColumns) {
                            _this._store._write(_this._query.table, r[pk], r, updatedColumns, rowDone);
                        });
                    }).then(function (newRows) {
                        // any changes to this table invalidates the cache
                        var pks = newRows.map(function (r) { return r[pk]; });
                        _this._store._invalidateCache(_this._query.table, pks);
                        _this._query.result = [{ msg: newRows.length + " row(s) modfied.", affectedRowPKS: pks, affectedRows: newRows }];
                        _this._syncORM("add", rows, newRows, function () {
                            _this._doAfterQuery(newRows, false, next);
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
                _this._updateRowViews(row_1, oldRow, function (updatedColumns) {
                    _this._store._write(_this._query.table, row_1[pk], oldRow, updatedColumns, function (result) {
                        _this._query.result = [{ msg: "1 row inserted.", affectedRowPKS: [result[pk]], affectedRows: [result] }];
                        if (_this._store._hasORM) {
                            _this._syncORM("add", [oldRow].filter(function (r) { return r; }), [result], function () {
                                _this._doAfterQuery([result], false, next);
                            });
                        }
                        else {
                            _this._doAfterQuery([result], false, next);
                        }
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
    /**
     * Initilize a DELETE query.
     *
     * @internal
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
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
                    utilities_1.fastALL(rows, function (r, i, done) {
                        _this._store._delete(_this._query.table, r[_this._store.tableInfo[_this._query.table]._pk], done);
                    }).then(function (affectedRows) {
                        // any changes to this table invalidate the cache
                        _this._store._cache[_this._query.table] = {};
                        var pks = rows.map(function (r) { return r[_this._store.tableInfo[_this._query.table]._pk]; });
                        _this._store._invalidateCache(_this._query.table, pks);
                        _this._query.result = [{ msg: rows.length + " row(s) deleted.", affectedRowPKS: pks, affectedRows: rows }];
                        _this._syncORM("del", rows, [], function () {
                            _this._doAfterQuery(rows, true, next);
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
    /**
     * Initilize a DROP query.
     *
     * @internal
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._drop = function (next) {
        var _this = this;
        if (this._isInstanceTable) {
            this._query.result = [];
            next(this._query);
            return;
        }
        this._store._rangeRead(this._query.table, undefined, undefined, false, function (rows) {
            _this._store._cache[_this._query.table] = {};
            _this._store._cacheKeys[_this._query.table] = {};
            _this._store._drop(_this._query.table, function () {
                _this._query.result = [{ msg: "'" + _this._query.table + "' table dropped.", affectedRowPKS: rows.map(function (r) { return r[_this._store.tableInfo[_this._query.table]._pk]; }), affectedRows: rows }];
                _this._syncORM("del", rows, [], function () {
                    _this._doAfterQuery(rows, true, next);
                });
            });
        });
    };
    return _NanoSQLStorageQuery;
}());
exports._NanoSQLStorageQuery = _NanoSQLStorageQuery;
/**
 * Takes a selection of rows and applys modifiers like orderBy, join and others to the rows.
 * Returns the affected rows updated in the way the query specified.
 *
 * @export
 * @class MutateSelection
 */
// tslint:disable-next-line
var _MutateSelection = /** @class */ (function () {
    function _MutateSelection(q, s) {
        this.q = q;
        this.s = s;
        this._groupByColumns = [];
    }
    /**
     * Peform a join command.
     *
     * @internal
     * @param {DBRow[]} rows
     * @param {(rows: DBRow[]) => void} complete
     * @returns {void}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._join = function (rows, complete) {
        var _this = this;
        if (!this.q.join) {
            complete(rows);
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
    /**
     * Generate a unique group by key given a group by object and a row.
     *
     * @internal
     * @param {string[]} columns
     * @param {*} row
     * @returns {string}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._groupByKey = function (columns, row) {
        return columns.reduce(function (p, c) {
            // handle ".length"
            if (c.indexOf(".length") !== -1) {
                return p + "." + String((row[c.replace(".length", "")] || []).length);
            }
            else {
                return p + "." + String(row[c]);
            }
        }, "").slice(1);
    };
    /**
     * Perform the Group By mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
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
    /**
     * Perform HAVING mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._having = function (rows) {
        var _this = this;
        return rows.filter(function (row, idx) {
            return Array.isArray(_this.q.having) ? _where(row, _this.q.having || [], idx, true) : _this.q.having(row, idx);
        });
    };
    /**
     * Perform the orderBy mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._orderBy = function (rows) {
        var _this = this;
        return rows.sort(function (a, b) {
            return _this._sortObj(a, b, _this.q.orderBy || {}, false);
        });
    };
    /**
     * Perform the Offset mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._offset = function (rows) {
        var _this = this;
        return rows.filter(function (row, index) {
            return _this.q.offset ? index >= _this.q.offset : true;
        });
    };
    /**
     * Perform the limit mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._limit = function (rows) {
        var _this = this;
        return rows.filter(function (row, index) {
            return _this.q.limit ? index < _this.q.limit : true;
        });
    };
    /**
     * Add ORM values to rows based on query.
     *
     * @internal
     * @param {DBRow[]} rows
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _MutateSelection
     */
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
        utilities_1.fastALL(rows, function (row, i, rowResult) {
            row = Object.isFrozen(row) ? utilities_1._assign(row) : row;
            utilities_1.fastALL(ormQueries, function (orm, k, ormResult) {
                if (!row[orm.key] || !row[orm.key].length) {
                    ormResult();
                    return;
                }
                var relateData = _this.s._columnsAreTables[_this.q.table][orm.key];
                if (relateData) {
                    _this.s._nsql.query("select").where([_this.s.tableInfo[relateData._toTable]._pk, relateData._thisType === "array" ? "IN" : "=", row[orm.key]]).manualExec({ table: relateData._toTable }).then(function (rows) {
                        var q = index_1.nSQL().query("select", orm.select);
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
                        if (orm.groupBy) {
                            q.groupBy(orm.groupBy);
                        }
                        q.manualExec({ table: rows }).then(function (result) {
                            if (!rows.filter(function (r) { return r; }).length) {
                                row[orm.key] = relateData._thisType === "array" ? [] : undefined;
                            }
                            else {
                                row[orm.key] = relateData._thisType === "array" ? result : result[0];
                            }
                            ormResult();
                        });
                    });
                }
                else {
                    ormResult();
                }
            }).then(function () {
                rowResult(row);
            });
        }).then(complete);
    };
    /**
     * Performs the actual JOIN mutation, including the O^2 select query to check all rows against every other row.
     *
     * @internal
     * @param {("left" | "inner" | "right" | "cross" | "outer")} type
     * @param {string} leftTable
     * @param {string} rightTable
     * @param {(null | { _left: string, _check: string, _right: string })} joinConditions
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._doJoin = function (type, leftTable, rightTable, joinConditions, complete) {
        var L = "left";
        var R = "right";
        var O = "outer";
        var C = "cross";
        var t = this;
        var firstTableData = t.s.tableInfo[type === R ? rightTable : leftTable];
        var seconTableData = t.s.tableInfo[type === R ? leftTable : rightTable];
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
        var usedSecondTableRows = {};
        var secondRowCache = [];
        // O^2, YAY!
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
                            usedSecondTableRows[idx2] = true;
                        joinTable.push(doJoinRows(firstRow, secondRow));
                        hasOneRelation = true;
                    }
                    else {
                        if (type === O)
                            secondRowCache[idx2] = secondRow;
                    }
                }
                keep2(false);
                var _a;
            }, function () {
                // left, right or outer join will cause rows without a relation to be added anyway with null relation
                if (!hasOneRelation && [L, R, O].indexOf(type) > -1) {
                    joinTable.push(doJoinRows(firstRow, null));
                }
                keep(false);
            });
        }, function () {
            // full outer join, add the secondary rows that haven't been added yet
            if (type === O) {
                var addRows = secondRowCache.filter(function (val, i) { return !usedSecondTableRows[i]; });
                var i = 0;
                while (i < addRows.length) {
                    joinTable.push(doJoinRows(null, addRows[i]));
                    i++;
                }
                complete(joinTable);
            }
            else {
                complete(joinTable);
            }
        });
    };
    /**
     * Get the sort direction for two objects given the objects, columns and resolve paths.
     *
     * @internal
     * @param {*} objA
     * @param {*} objB
     * @param {{ [key: string]: string }} columns
     * @param {boolean} resolvePaths
     * @returns {number}
     * @memberof _MutateSelection
     */
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
    /**
     * Apply AS, functions and Group By
     *
     * @internal
     * @param {DBRow[]} rows
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._mutateRows = function (rows, complete) {
        var _this = this;
        var columnSelection = this.q.actionArgs;
        var functionResults = {};
        var fnGroupByResults = {};
        if (columnSelection && columnSelection.length) {
            // possibly has functions, AS statements
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
            utilities_1.fastALL(columnSelection, function (column, j, columnDone) {
                if (column.indexOf("(") > -1) {
                    var fnArgs_1 = (column.match(/\(.*\)/g) || [""])[0].replace(/\(|\)/g, "").split(",").map(function (v) { return v.trim(); });
                    if (_this._sortGroups && hasAggregateFun_1) {
                        utilities_1.fastALL(Object.keys(_this._sortGroups), function (k, l, fnDone) {
                            if (!fnGroupByResults[k]) {
                                fnGroupByResults[k] = {};
                            }
                            (_a = columnData_1[column].fn).call.apply(_a, [rows.filter(function (r, i) { return _this._sortGroups[k].indexOf(i) > -1; }), function (result) {
                                    fnGroupByResults[k][columnData_1[column].key] = result;
                                    fnDone();
                                }].concat(fnArgs_1));
                            var _a;
                        }).then(columnDone);
                    }
                    else {
                        (_a = columnData_1[column].fn).call.apply(_a, [rows, function (result) {
                                functionResults[columnData_1[column].key] = result;
                                columnDone();
                            }].concat(fnArgs_1));
                    }
                }
                else {
                    columnDone(); // no function
                }
                var _a;
            }).then(function () {
                // time to rebuild row results
                var doMuateRows = function (row, idx, fnResults) {
                    var newRow = {};
                    // remove unselected columns, apply AS and integrate function results
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
            // just pass through
            complete(rows);
        }
    };
    /**
     * Triggers the mutations in the order of operations.
     *
     * @param {DBRow[]} inputRows
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _MutateSelection
     */
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
/**
 * Selects the needed rows from the storage system.
 * Uses the fastes possible method to get the rows.
 *
 * @export
 * @class _RowSelection
 */
// tslint:disable-next-line
var _RowSelection = /** @class */ (function () {
    function _RowSelection(q, s) {
        this.q = q;
        this.s = s;
    }
    /**
     * Discovers the fastest possible SELECT method, then uses it.
     *
     * @param {(rows: DBRow[]) => void} callback
     * @returns
     * @memberof _RowSelection
     */
    _RowSelection.prototype.getRows = function (callback) {
        var _this = this;
        if (this.q.join && this.q.orm) {
            throw new Error("Cannot do a JOIN and ORM command at the same time!");
        }
        if ([this.q.where, this.q.range, this.q.trie].filter(function (i) { return i; }).length > 1) {
            throw new Error("Can only have ONE of Trie, Range or Where!");
        }
        // join command requires n^2 scan that gets taken care of in join logic.
        if (this.q.join) {
            callback([]);
            return;
        }
        // trie search, nice and fast.
        if (this.q.trie && this.q.trie.column && this.q.trie.search) {
            this._selectByTrie(callback);
            return;
        }
        // range select, very fast
        if (this.q.range && this.q.range.length) {
            this._selectByRange(callback);
            return;
        }
        // no where statement, read whole db :(
        // OR
        // where statement is function, still gotta read the whole db.
        if ((!this.q.where || !this.q.where.length) || !Array.isArray(this.q.where)) {
            this._fullTableScan(callback);
            return;
        }
        // where statement possibly contains only primary key and secondary key queries, do faster search if possible.
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
            this._selectByKeys(this.q.where, callback);
            return;
        }
        // if compound where statement includes primary key/secondary index queries followed by AND with other conditions.
        // grabs the section of data related to the optimized read, then full table scans the result.
        var whereSlice = this._isSubOptimizedWhere(this.q.where);
        if (whereSlice > 0) {
            var fastWhere = this.q.where.slice(0, whereSlice);
            var slowWhere_1 = this.q.where.slice(whereSlice + 1);
            this._selectByKeys(fastWhere, function (rows) {
                callback(rows.filter(function (r, i) { return _where(r, slowWhere_1, i); }));
            });
            return;
        }
        // Full table scan :(
        this._fullTableScan(callback);
    };
    /**
     * Does super fast primary key or secondary index select.
     * Handles compound WHERE statements, combining their results.
     * Works as long as every WHERE statement is selecting against a primary key or secondary index.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _RowSelection
     */
    _RowSelection.prototype._selectByKeys = function (where, callback) {
        var _this = this;
        if (where && typeof where[0] === "string") {
            this._selectRowsByIndex(where, callback);
        }
        else if (where) {
            var resultRows_1 = [];
            var lastCommand_1 = "";
            utilities_1.fastCHAIN(where, function (wArg, i, nextWArg) {
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
                        resultRows_1 = resultRows_1.concat(rows);
                    }
                    nextWArg();
                });
            }).then(function () {
                callback(resultRows_1);
            });
        }
    };
    /**
     * Much faster SELECT by primary key or secondary index.
     * Accepts a single WHERE statement, no compound statements allowed.
     *
     * @internal
     * @param {any[]} where
     * @param {(rows: DBRow[]) => void} callback
     * @returns
     * @memberof _RowSelection
     */
    _RowSelection.prototype._selectRowsByIndex = function (where, callback) {
        var _this = this;
        if (where[1] === "BETWEEN") {
            var secondaryIndexKey = where[0] === this.s.tableInfo[this.q.table]._pk ? "" : where[0];
            if (secondaryIndexKey) {
                var idxTable = "_" + this.q.table + "_idx_" + secondaryIndexKey;
                this.s._rangeRead(idxTable, where[2][0], where[2][1], true, function (rows) {
                    var keys = [];
                    var i = rows.length;
                    while (i--) {
                        keys = keys.concat(rows[i].rows);
                    }
                    _this.s._read(_this.q.table, keys, callback);
                });
            }
            else {
                this.s._rangeRead(this.q.table, where[2][0], where[2][1], true, function (rows) {
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
            utilities_1.fastALL(keys, function (idx, i, complete) {
                _this.s._secondaryIndexRead(_this.q.table, where[0], idx, complete);
            }).then(function (rows) {
                callback([].concat.apply([], rows));
            });
        }
    };
    /**
     * Select rows within a numerical range using limit and offset values.
     * Negative limit values will start the range from the bottom of the table.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _RowSelection
     */
    // [limit, offset]
    _RowSelection.prototype._selectByRange = function (callback) {
        var _this = this;
        if (this.q.range) {
            var r_1 = this.q.range;
            this.s.adapters[0].adapter.getIndex(this.q.table, true, function (count) {
                var fromIdx = r_1[0] > 0 ? r_1[1] : count + r_1[0] - r_1[1];
                var toIdx = fromIdx;
                var counter = Math.abs(r_1[0]) - 1;
                while (counter--) {
                    toIdx++;
                }
                _this.s._rangeRead(_this.q.table, fromIdx, toIdx, false, callback);
            });
        }
        else {
            callback([]);
        }
    };
    /**
     * Select rows based on a Trie Query.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _RowSelection
     */
    _RowSelection.prototype._selectByTrie = function (callback) {
        if (this.q.trie) {
            this.s._trieRead(this.q.table, this.q.trie.column, this.q.trie.search, callback);
        }
        else {
            callback([]);
        }
    };
    /**
     * Do a full table scan, checking every row against the WHERE statement.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _RowSelection
     */
    _RowSelection.prototype._fullTableScan = function (callback) {
        var _this = this;
        var hasWhere = this.q.where !== undefined;
        var fnWhere = hasWhere && !Array.isArray(this.q.where);
        var arrWhere = hasWhere && Array.isArray(this.q.where);
        this.s._read(this.q.table, function (row, i, keep) {
            if (!hasWhere) {
                keep(true);
                return;
            }
            if (fnWhere) {
                keep(_this.q.where(row, i));
                return;
            }
            if (arrWhere) {
                keep(_where(row, _this.q.where, i));
            }
        }, callback);
    };
    /**
     * Given a compound where statement like [[value, =, key], AND, [something, =, something]]
     * Check if first where conditions are primary key/ secondary index followed by unoptimized/unindexed conditions
     *
     * In this case we can grab the primary key/secondary index query from the database and do a faster query on the smaller result set.
     *
     * Returns 0 if this isn't a suboptimized where condition.
     * Returns the index of the where array where the AND splits between optimized and unoptimized conditions otherwise.
     *
     * @private
     * @param {any[]} wArgs
     * @returns {number}
     * @memberof _RowSelection
     */
    _RowSelection.prototype._isSubOptimizedWhere = function (wArgs) {
        var _this = this;
        if (typeof wArgs[0] === "string") {
            return 0;
        }
        if (this._isOptimizedWhere(wArgs[0]) === 0) {
            // last primary key/secondary index condition MUST be followed by AND
            var lastCheck_1 = 0;
            var includesSlowWhere = false;
            wArgs.forEach(function (wArg, i) {
                if (i % 2 === 0) {
                    if (_this._isOptimizedWhere(wArg) === 0 && wArgs[i + 1]) {
                        lastCheck_1 = i + 1;
                    }
                }
            });
            // AND must follow the last secondary index/primary key condition
            if (wArgs[lastCheck_1] !== "AND")
                return 0;
            return lastCheck_1;
        }
        return 0;
    };
    /**
     * Checks if a single WHERE statement ["row", "=", value] uses a primary key or secondary index as it's row.
     * If so, we can use a much faster SELECT method.
     *
     * @internal
     * @param {any[]} wArgs
     * @returns {number}
     * @memberof _RowSelection
     */
    _RowSelection.prototype._isOptimizedWhere = function (wArgs) {
        var tableData = this.s.tableInfo[this.q.table];
        if (["=", "IN", "BETWEEN"].indexOf(wArgs[1]) > -1) {
            // if (wArgs[0] === tableData._pk) {
            if (wArgs[0] === tableData._pk || tableData._secondaryIndexes.indexOf(wArgs[0]) > -1) {
                return 0;
            }
        }
        return 1;
    };
    return _RowSelection;
}());
exports._RowSelection = _RowSelection;
/**
 * Select rows from an instance table. Supports RANGE and WHERE statements.
 *
 * @export
 * @class InstanceSelection
 */
var InstanceSelection = /** @class */ (function () {
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
/**
 * Handles WHERE statements, combining multiple compared statements aginst AND/OR as needed to return a final boolean value.
 * The final boolean value is wether the row matches all WHERE conditions or not.
 *
 * @param {*} singleRow
 * @param {any[]} where
 * @param {number} rowIDX
 * @param {boolean} [ignoreFirstPath]
 * @returns {boolean}
 */
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
/**
 * Compare function used by WHERE to determine if a given value matches a given condition.
 *
 * @param {*} val1
 * @param {string} compare
 * @param {*} val2
 * @returns {number}
 */
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
        // if column equal to given value
        case "=": return columnValue === givenValue ? 0 : 1;
        // if column not equal to given value
        case "!=": return columnValue !== givenValue ? 0 : 1;
        // if column greather than given value
        case ">": return columnValue > givenValue ? 0 : 1;
        // if column less than given value
        case "<": return columnValue < givenValue ? 0 : 1;
        // if column less than or equal to given value
        case "<=": return columnValue <= givenValue ? 0 : 1;
        // if column greater than or equal to given value
        case ">=": return columnValue >= givenValue ? 0 : 1;
        // if column value exists in given array
        case "IN": return (givenValue || []).indexOf(columnValue) < 0 ? 1 : 0;
        // if column does not exist in given array
        case "NOT IN": return (givenValue || []).indexOf(columnValue) < 0 ? 0 : 1;
        // regexp search the column
        case "REGEX": return columnValue.match(givenValue) ? 0 : 1;
        // if given value exists in column value
        case "LIKE": return columnValue.indexOf(givenValue) < 0 ? 1 : 0;
        // if given value does not exist in column value
        case "NOT LIKE": return columnValue.indexOf(givenValue) > 0 ? 1 : 0;
        // if the column value is between two given numbers
        case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] >= columnValue ? 0 : 1;
        // if single value exists in array column
        case "HAVE": return (columnValue || []).indexOf(givenValue) < 0 ? 1 : 0;
        // if single value does not exist in array column
        case "NOT HAVE": return (columnValue || []).indexOf(givenValue) < 0 ? 0 : 1;
        // if array of values intersects with array column
        case "INTERSECT": return (columnValue || []).filter(function (l) { return (givenValue || []).indexOf(l) > -1; }).length > 0 ? 0 : 1;
        // if array of values does not intersect with array column
        case "NOT INTERSECT": return (columnValue || []).filter(function (l) { return (givenValue || []).indexOf(l) > -1; }).length === 0 ? 0 : 1;
        default: return 1;
    }
};
