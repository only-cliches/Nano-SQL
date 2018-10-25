var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = require("./interfaces");
var utilities_1 = require("./utilities");
// tslint:disable-next-line
var _NanoSQLQuery = /** @class */ (function () {
    function _NanoSQLQuery(nSQL, query, progress, complete, error) {
        var _this = this;
        this.nSQL = nSQL;
        this.query = query;
        this.progress = progress;
        this.complete = complete;
        this.error = error;
        this._buffer = [];
        this._stream = true;
        this._selectArgs = [];
        this._pkOrderBy = false;
        this._idxOrderBy = false;
        this._sortGroups = {};
        this.query.state = "processing";
        var action = query.action.toLowerCase().trim();
        if (action !== "select" && typeof query.table !== "string") {
            this.query.state = "error";
            this.error("Only \"select\" queries are available for this resource!");
            return;
        }
        if (typeof query.table === "string" && !this.nSQL.state.connected) {
            this.query.state = "error";
            this.error("Can't execute query before the database has connected!");
            return;
        }
        var requireAction = function (cb) {
            if (typeof _this.query.table !== "string") {
                _this.query.state = "error";
                _this.error(_this.query.action + " query requires a string table argument!");
                return;
            }
            if (!_this.query.actionArgs) {
                _this.query.state = "error";
                _this.error(_this.query.action + " query requires an additional argument!");
                return;
            }
            cb();
        };
        var finishQuery = function () {
            if (_this.query.state !== "error") {
                _this.query.state = "complete";
                _this.complete();
            }
        };
        switch (action) {
            case "select":
                this._select(finishQuery, this.error);
                break;
            case "upsert":
                this._upsert(this.progress, this.complete);
                break;
            case "delete":
                this._delete(this.progress, this.complete);
                break;
            case "show tables":
                this._showTables();
                break;
            case "describe":
                this._describe();
                break;
            case "drop":
            case "drop table":
                this.dropTable(this.query.table, finishQuery, this.error);
                break;
            case "create table":
            case "create table if not exists":
                requireAction(function () {
                    _this.createTable(_this.query.actionArgs, finishQuery, _this.error);
                });
                break;
            case "alter table":
                requireAction(function () {
                    _this.alterTable(_this.query.actionArgs, finishQuery, _this.error);
                });
                break;
            case "create relation":
                requireAction(function () {
                    _this._registerRelation(_this.query.table, _this.query.actionArgs, finishQuery, _this.error);
                });
                break;
            case "drop relation":
                this._destroyRelation(this.query.table, finishQuery, this.error);
                break;
            case "rebuild index":
                this._rebuildIndexes(this.query.table, finishQuery, this.error);
                break;
            default:
                this.query.state = "error";
                this.error("Query type \"" + query.action + "\" not supported!");
        }
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
    _NanoSQLQuery.prototype._maybeJoin = function (joinData, leftRow, onRow, complete) {
        var _this = this;
        var _a;
        if (!joinData[0]) { // no join to perform, NEXT!
            onRow(leftRow);
            complete();
            return;
        }
        var doJoin = function (rowData, joinIdx, joinDone) {
            var join = joinData[joinIdx];
            var joinRowCount = 0;
            var rightHashes = [];
            var pendingNestedJoins = 0;
            if (join.type !== "cross" && !join.on) {
                _this.query.state = "error";
                _this.error("Non 'cross' joins require an 'on' parameter!");
                return;
            }
            var noJoinAS = "Must use 'AS' when joining temporary tables!";
            if (typeof join.with.table !== "string" && !join.with.as) {
                _this.query.state = "error";
                _this.error(noJoinAS);
                return;
            }
            if (typeof _this.query.table !== "string" && !_this.query.tableAS) {
                _this.query.state = "error";
                _this.error(noJoinAS);
                return;
            }
            // combine the joined data into a row record
            var combineRows = function (rData) {
                return Object.keys(rData).reduce(function (prev, cur) {
                    var row = rData[cur];
                    if (!row)
                        return prev;
                    Object.keys(row).forEach(function (k) {
                        prev[cur + "." + k] = row[k];
                    });
                    return prev;
                }, {});
            };
            // turn the "on" clause into a where statement we can pass into
            // a where query on the right side table
            var getWhere = function (joinWhere) {
                return (typeof joinWhere[0] === "string" ? [joinWhere] : joinWhere).map(function (j) {
                    if (Array.isArray(j[0]))
                        return getWhere(j); // nested where
                    if (j === "AND" || j === "OR")
                        return j;
                    var leftWhere = utilities_1.resolveObjPath(j[0]);
                    var rightWhere = utilities_1.resolveObjPath(j[2]);
                    var swapWhere = leftWhere[0] === (_this.query.tableAS || _this.query.table);
                    // swapWhere = true [leftTable.column, =, rightTable.column] => [rightWhere, =, objQuery(leftWhere)]
                    // swapWhere = false [rightTable.column, =, leftTable.column] => [leftWhere, =, objQuery(rightWhere)]
                    return [
                        swapWhere ? rightWhere.slice(1).join(".") : leftWhere.slice(1).join("."),
                        swapWhere ? (j[1].indexOf(">") !== -1 ? j[1].replace(">", "<") : j[1].replace("<", ">")) : j[1],
                        utilities_1.objQuery(swapWhere ? leftWhere : rightWhere, rowData)
                    ];
                });
            };
            // found row to join, perform additional joins for this row or respond with the final joined row if no futher joins are needed.
            var maybeJoinRow = function (rData) {
                if (!joinData[joinIdx + 1]) { // no more joins, send joined row
                    onRow(combineRows(rData));
                }
                else { // more joins, nest on!
                    pendingNestedJoins++;
                    doJoin(rData, joinIdx + 1, function () {
                        pendingNestedJoins--;
                        maybeDone();
                    });
                }
            };
            var maybeDone = function () {
                if (!pendingNestedJoins) {
                    joinDone();
                }
            };
            var withPK = typeof join.with.table === "string" ? _this.nSQL.tables[join.with.table].pkCol : "";
            var rightTable = String(join.with.as || join.with.table);
            var leftTable = String(_this.query.tableAS || _this.query.table);
            _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(join.with.table, "select"), { tableAS: join.with.as, where: join.on && join.type !== "cross" ? getWhere(join.on) : undefined, skipQueue: true }), function (row) {
                var _a;
                joinRowCount++;
                if (join.type === "right" || join.type === "outer") {
                    // keep track of which right side rows have been joined
                    rightHashes.push(withPK ? row[withPK] : utilities_1.hash(JSON.stringify(row)));
                }
                maybeJoinRow(__assign({}, rowData, (_a = {}, _a[rightTable] = row, _a)));
            }, function () {
                var _a, _b;
                switch (join.type) {
                    case "left":
                        if (joinRowCount === 0) {
                            maybeJoinRow(__assign({}, rowData, (_a = {}, _a[rightTable] = undefined, _a)));
                        }
                        maybeDone();
                        break;
                    case "inner":
                    case "cross":
                        maybeDone();
                        break;
                    case "outer":
                    case "right":
                        if (joinRowCount === 0 && join.type === "outer") {
                            maybeJoinRow(__assign({}, rowData, (_b = {}, _b[rightTable] = undefined, _b)));
                        }
                        // full table scan on right table :(
                        _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(join.with.table, "select"), { skipQueue: true, where: withPK ? [withPK, "NOT IN", rightHashes] : undefined }), function (row) {
                            var _a;
                            if (withPK || rightHashes.indexOf(utilities_1.hash(JSON.stringify(row))) === -1) {
                                maybeJoinRow(__assign({}, rowData, (_a = {}, _a[leftTable] = undefined, _a[rightTable] = row, _a)));
                            }
                        }, function () {
                            maybeDone();
                        }, function (err) {
                            _this.query.state = "error";
                            _this.error(err);
                        });
                        break;
                }
            }, function (err) {
                _this.query.state = "error";
                _this.error(err);
            });
        };
        doJoin((_a = {}, _a[String(this.query.tableAS || this.query.table)] = leftRow, _a), 0, complete);
    };
    _NanoSQLQuery.prototype._select = function (complete, onError) {
        // Query order:
        // 1. Join / Index / Where Select
        // 2. Group By & Functions
        // 3. Apply AS
        // 4. Having
        // 5. OrderBy
        // 6. Offset
        // 7. Limit
        var _this = this;
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where, typeof this.query.table !== "string" || typeof this.query.union !== "undefined") : { type: interfaces_1.IWhereType.none };
        this._havingArgs = this.query.having ? this._parseWhere(this.query.having, true) : { type: interfaces_1.IWhereType.none };
        this._parseSelect();
        if (this.query.state === "error")
            return;
        if ([this.query.orm, this.query.join, this.query.union].filter(function (l) { return l; }).length > 1) {
            this.query.state = "error";
            onError("Can only have one of orm, join or union!");
            return;
        }
        var range = [(this.query.offset || 0), (this.query.offset || 0) + (this.query.limit || 0)];
        var doRange = range[0] + range[1] > 0;
        // UNION query
        if (this.query.union) {
            var hashes_1 = [];
            var columns_1 = [];
            var count_1 = 0;
            utilities_1.chainAsync(this.query.union.queries, function (query, k, next) {
                query().then(function (rows) {
                    if (!columns_1.length) {
                        columns_1 = Object.keys(rows[0]);
                    }
                    if (_this.query.where) {
                        rows = rows.filter(function (r, i) {
                            return _this._where(r, _this._whereArgs.slowWhere, false);
                        });
                    }
                    rows = rows.map(function (r) {
                        if (_this.query.union && _this.query.union.type === "distinct") {
                            var rowHash = utilities_1.hash(JSON.stringify(r));
                            if (k === 0) {
                                hashes_1.push(rowHash);
                            }
                            else {
                                if (hashes_1.indexOf(rowHash) !== -1) {
                                    return undefined;
                                }
                                else {
                                    hashes_1.push(rowHash);
                                }
                            }
                        }
                        return Object.keys(r).reduce(function (p, c, i) {
                            if (i < columns_1.length) {
                                p[columns_1[i]] = r[c];
                            }
                            return p;
                        }, {});
                    }).filter(function (f) { return f; });
                    if (_this.query.orderBy) {
                        _this._buffer = _this._buffer.concat(rows.map(function (row) {
                            var newRow = _this._streamAS(row, false);
                            var keep = _this.query.having ? _this._where(newRow, _this._havingArgs.slowWhere, false) : true;
                            return keep ? newRow : undefined;
                        }).filter(function (f) { return f; }));
                    }
                    else {
                        rows.forEach(function (row, i) {
                            var newRow = _this._streamAS(row, false);
                            var keep = _this.query.having ? _this._where(newRow, _this._havingArgs.slowWhere, false) : true;
                            if (!keep) {
                                return;
                            }
                            if (doRange) {
                                if (count_1 >= range[0] && count_1 < range[1]) {
                                    _this.progress(_this._streamAS(row, false), count_1);
                                }
                            }
                            else {
                                _this.progress(_this._streamAS(row, false), count_1);
                            }
                            count_1++;
                        });
                    }
                    next();
                });
            }).then(function () {
                if (_this.query.orderBy) {
                    var sorted = _this._buffer.sort(_this._orderByRows);
                    (doRange ? sorted.slice(range[0], range[1]) : sorted).forEach(_this.progress);
                }
                complete();
            });
            return;
        }
        var joinData = Array.isArray(this.query.join) ? this.query.join : [this.query.join];
        var fastQuery = false;
        var joinedRows = 0;
        if (this._stream && !this.query.join && !this.query.orderBy && !this.query.having && !this.query.groupBy) {
            fastQuery = true;
        }
        var maybeScanComplete = function () {
            if (joinedRows === 0) {
                if (fastQuery || _this._stream) {
                    complete();
                    return;
                }
                // use buffer
                // Group by, functions and AS
                _this._groupByRows();
                if (_this.query.having) { // having
                    _this._buffer = _this._buffer.filter(function (row) {
                        return _this._where(row, _this._havingArgs.slowWhere, _this.query.join !== undefined);
                    });
                }
                if (_this.query.orderBy) { // order by
                    _this._buffer.sort(_this._orderByRows);
                }
                if (doRange) { // limit / offset
                    _this._buffer = _this._buffer.slice(range[0], range[1]);
                }
                _this._buffer.forEach(function (row, i) {
                    _this.progress(row, range[0] + i);
                });
                complete();
            }
        };
        // standard query path
        this._getRecords(function (row, i) {
            if (fastQuery) { // nothing fancy to do, just feed the rows to the client
                if (doRange) {
                    if (i >= range[0] && i < range[1]) {
                        _this.progress(_this._selectArgs.length ? _this._streamAS(row, false) : row, i);
                    }
                }
                else {
                    _this.progress(_this._selectArgs.length ? _this._streamAS(row, false) : row, i);
                }
                return;
            }
            row = utilities_1._maybeAssign(row);
            var count = 0;
            joinedRows++;
            _this._maybeJoin(joinData, row, function (row2) {
                if (_this._stream) {
                    // continue streaming results
                    // skipping group by, order by and aggregate functions
                    var keepRow = true;
                    row2 = _this._selectArgs.length ? _this._streamAS(row2, _this.query.join !== undefined) : row2;
                    if (_this.query.having) {
                        keepRow = _this._where(row2, _this._havingArgs.slowWhere, _this.query.join !== undefined);
                    }
                    if (keepRow && doRange) {
                        keepRow = count >= range[0] && count < range[1];
                    }
                    if (keepRow) {
                        _this.progress(row2, count);
                    }
                    count++;
                }
                else {
                    _this._buffer.push(row2);
                }
            }, function () {
                joinedRows--;
                maybeScanComplete();
            });
        }, maybeScanComplete);
    };
    _NanoSQLQuery.prototype._groupByRows = function () {
        var _this = this;
        if (!this.query.groupBy) {
            this._buffer = this._buffer.map(function (b) { return _this._streamAS(b, _this.query.join !== undefined); });
            return;
        }
        this._buffer.sort(function (a, b) {
            return _this._sortObj(a, b, _this._groupBy);
        }).forEach(function (val, idx) {
            var groupByKey = _this._groupBy.sort.map(function (k) { return String(utilities_1.objQuery(k.path, val, _this.query.join !== undefined)); }).join(".");
            if (!_this._sortGroups[groupByKey]) {
                _this._sortGroups[groupByKey] = [];
            }
            _this._sortGroups[groupByKey].push(val);
        });
        this._buffer = [];
        if (this._hasAggrFn) {
            // loop through the groups
            Object.keys(this._sortGroups).forEach(function (groupKey) {
                // find aggregate functions
                var resultFns = _this._selectArgs.reduce(function (p, c) {
                    if (_this.nSQL.functions[c.value].type === "A") {
                        p[c.value] = {
                            aggr: _this.nSQL.functions[c.value].aggregateStart,
                            args: c.args
                        };
                    }
                    return p;
                }, {});
                var firstFn = Object.keys(resultFns)[0];
                // calculate aggregate functions
                _this._sortGroups[groupKey].forEach(function (row, i) {
                    Object.keys(resultFns).forEach(function (fn) {
                        var _a;
                        resultFns[fn].aggr = (_a = _this.nSQL.functions[fn]).call.apply(_a, [_this.query, row, _this.query.join !== undefined, resultFns[fn].aggr].concat(resultFns[fn].args));
                    });
                });
                // calculate simple functions and AS back into buffer
                _this._buffer.push(_this._selectArgs.reduce(function (prev, cur) {
                    var _a;
                    prev[cur.as || cur.value] = cur.isFn && resultFns[cur.value] ? resultFns[cur.value].aggr.result : (cur.isFn ? (_a = _this.nSQL.functions[cur.value]).call.apply(_a, [_this.query, resultFns[firstFn].aggr.row, _this.query.join !== undefined, {}].concat((cur.args || []))) : utilities_1.objQuery(cur.value, resultFns[firstFn].aggr.row));
                    return prev;
                }, {}));
            });
        }
        else {
            Object.keys(this._sortGroups).forEach(function (groupKey) {
                _this._sortGroups[groupKey].forEach(function (row) {
                    _this._buffer.push(_this._streamAS(row, _this.query.join !== undefined));
                });
            });
        }
    };
    _NanoSQLQuery.prototype._upsert = function (onRow, complete) {
        var _this = this;
        if (!this.query.actionArgs) {
            this.error("Can't upsert without records!");
            this.query.state = "error";
        }
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.state === "error")
            return;
        var upsertRecords = Array.isArray(this.query.actionArgs) ? this.query.actionArgs : [this.query.actionArgs];
        var table = this.nSQL.tables[this.query.table];
        upsertRecords = upsertRecords.map(function (r) { return _this.nSQL.default(r, _this.query.table); });
        if (this._whereArgs.type === interfaces_1.IWhereType.none) { // insert/update records directly
            utilities_1.allAsync(upsertRecords, function (row, i, next, error) {
                if (row[table.pkCol]) {
                    _this.nSQL.adapter.read(_this.query.table, row[table.pkCol], function (oldRow) {
                        if (oldRow) {
                            _this._updateRow(row, oldRow, next, error);
                        }
                        else {
                            _this._newRow(row, next, error);
                        }
                    }, function (err) {
                        _this._newRow(row, next, error);
                    });
                }
                else {
                    _this._newRow(row, next, error);
                }
            }).then(function () {
                onRow({ result: upsertRecords.length + " row(s) upserted" }, 0);
                complete();
            });
        }
        else { // find records and update them
            if (upsertRecords.length > 1) {
                this.query.state = "error";
                this.error("Cannot upsert multiple records with where condition!");
                return;
            }
            var maybeDone_1 = function () {
                if (completed_1 && updatingRecords_1 === 0) {
                    onRow({ result: updatedRecords_1 + " row(s) upserted" }, 0);
                    complete();
                }
            };
            var updatingRecords_1 = 0;
            var updatedRecords_1 = 0;
            var completed_1 = false;
            this._getRecords(function (row, i) {
                updatingRecords_1++;
                updatedRecords_1++;
                _this._updateRow(upsertRecords[0], row, function () {
                    updatingRecords_1--;
                    maybeDone_1();
                }, function (err) {
                    _this.query.state = "error";
                    _this.error(err);
                });
            }, function () {
                completed_1 = true;
                maybeDone_1();
            });
        }
    };
    _NanoSQLQuery.prototype._updateRow = function (newData, oldRow, complete, error) {
        var _this = this;
        this.nSQL.doFilter("updateRow", { result: newData, row: oldRow, query: this.query }).then(function (upsertData) {
            var finalRow = __assign({}, oldRow, upsertData);
            var newIndexes = _this._getIndexValues(_this.nSQL.tables[_this.query.string].indexes, finalRow);
            var oldIndexes = _this._getIndexValues(_this.nSQL.tables[_this.query.string].indexes, oldRow);
            var table = _this.nSQL.tables[_this.query.table];
            var blankIndex = function (id) { return ({ id: id, pks: [] }); };
            utilities_1.allAsync(Object.keys(oldIndexes).concat(["__pk__"]), function (indexName, i, next, err) {
                if (indexName === "__pk__") { // main row
                    _this.nSQL.adapter.write(_this.query.table, finalRow[table.pkCol], finalRow, function (pk) {
                        finalRow[table.pkCol] = pk;
                        next(null);
                    }, err);
                }
                else { // indexes
                    var idxTable_1 = "_idx_" + _this.query.table + "_" + indexName;
                    if (newIndexes[indexName] !== oldIndexes[indexName]) { // only update changed index values
                        utilities_1.allAsync(["rm", "add"], function (job, i, nextJob) {
                            switch (job) {
                                case "add": // add new index value
                                    _this.nSQL.adapter.read(idxTable_1, newIndexes[indexName], function (idxRow) {
                                        idxRow = utilities_1._maybeAssign(idxRow || blankIndex(newIndexes[indexName]));
                                        idxRow.pks.push(finalRow[table.pkCol]);
                                        _this.nSQL.adapter.write(idxTable_1, newIndexes[indexName], idxRow, function () {
                                            nextJob(null);
                                        }, function () {
                                            nextJob(null);
                                        });
                                    }, function (err) {
                                        nextJob(null);
                                    });
                                    break;
                                case "rm": // remove old index value
                                    _this.nSQL.adapter.read(idxTable_1, oldIndexes[indexName], function (idxRow) {
                                        idxRow = utilities_1._maybeAssign(idxRow);
                                        var idxOf = idxRow.pks.indexOf(finalRow[table.pkCol]);
                                        if (idxOf !== -1) {
                                            (idxRow.pks || []).splice(idxOf, 1);
                                            _this.nSQL.adapter.write(idxTable_1, oldIndexes[indexName], idxRow, function () {
                                                nextJob(null);
                                            }, function () {
                                                nextJob(null);
                                            });
                                        }
                                        else {
                                            nextJob(null);
                                        }
                                    }, function (err) {
                                        nextJob(null);
                                    });
                                    break;
                            }
                        }).then(next);
                    }
                    else {
                        next(null);
                    }
                }
            }).then(function () {
                _this.nSQL.doFilter("updatedRow", { result: finalRow, new: false });
                complete(finalRow);
            });
        }).catch(error);
    };
    _NanoSQLQuery.prototype._newRow = function (newRow, complete, error) {
        var _this = this;
        this.nSQL.doFilter("addRow", { result: newRow, query: this.query }).then(function (rowToAdd) {
            var indexes = _this._getIndexValues(_this.nSQL.tables[_this.query.string].indexes, rowToAdd);
            var table = _this.nSQL.tables[_this.query.table];
            var blankIndex = function (id) { return ({ id: id, pks: [] }); };
            utilities_1.allAsync(Object.keys(indexes).concat(["__pk__"]), function (indexName, i, next, err) {
                if (indexName === "__pk__") { // main row
                    _this.nSQL.adapter.write(_this.query.table, rowToAdd[table.pkCol], rowToAdd, function (pk) {
                        rowToAdd[table.pkCol] = pk;
                        next(null);
                    }, err);
                }
                else { // indexes
                    var idxTable_2 = "_idx_" + _this.query.table + "_" + indexName;
                    _this.nSQL.adapter.read(idxTable_2, indexes[indexName], function (idxRow) {
                        idxRow = utilities_1._maybeAssign(idxRow || blankIndex(indexes[indexName]));
                        idxRow.pks.push(rowToAdd[table.pkCol]);
                        _this.nSQL.adapter.write(idxTable_2, indexes[indexName], idxRow, function () {
                            next(null);
                        }, function () {
                            next(null);
                        });
                    }, function (err) {
                        next(null);
                    });
                }
            }).then(function () {
                _this.nSQL.doFilter("updatedRow", { result: rowToAdd, new: true });
                complete(rowToAdd);
            });
        }).catch(error);
    };
    _NanoSQLQuery.prototype._delete = function (onRow, complete) {
        var _this = this;
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.state === "error")
            return;
        if (this._whereArgs.type === interfaces_1.IWhereType.none) { // no records selected, nothing to delete!
            this.query.state = "error";
            this.error("Can't do delete query without where condition!");
        }
        else { // find records and delete them
            var pendingRows_1 = 0;
            var delRows_1 = 0;
            var completed_2 = false;
            var table_1 = this.nSQL.tables[this.query.table];
            var maybeDone_2 = function () {
                if (completed_2 && pendingRows_1 === 0) {
                    onRow({ result: delRows_1 + " row(s) deleted" }, 0);
                    complete();
                }
            };
            this._getRecords(function (row, i) {
                pendingRows_1++;
                _this.nSQL.doFilter("deleteRow", { result: row, query: _this.query }).then(function (delRow) {
                    var indexes = _this._getIndexValues(table_1.indexes, row);
                    utilities_1.allAsync(Object.keys(indexes).concat(["__del__"]), function (indexName, i, next) {
                        if (indexName === "__del__") { // main row
                            _this.nSQL.adapter.delete(_this.query.table, delRow[table_1.pkCol], function () {
                                next(null);
                            }, function (err) {
                                _this.query.state = "error";
                                _this.error(err);
                            });
                        }
                        else { // secondary indexes
                            var idxTable_3 = "_idx_" + _this.query.table + "_" + indexName;
                            _this.nSQL.adapter.read(idxTable_3, indexes[indexName], function (idxRow) {
                                idxRow = utilities_1._maybeAssign(idxRow);
                                var idxOf = idxRow.pks.indexOf(row[table_1.pkCol]);
                                if (idxOf !== -1) {
                                    idxRow.pks.splice(idxOf, 1);
                                    _this.nSQL.adapter.write(idxTable_3, indexes[indexName], idxRow, function () {
                                        next(null);
                                    }, function () {
                                        next(null);
                                    });
                                }
                                else {
                                    next(null);
                                }
                            }, function (err) {
                                next(null);
                            });
                        }
                    }).then(function () {
                        pendingRows_1--;
                        delRows_1++;
                        maybeDone_2();
                    }).catch(function (err) {
                        _this.query.state = "error";
                        _this.error(err);
                    });
                }).catch(function () {
                    pendingRows_1--;
                    maybeDone_2();
                });
            }, function () {
                completed_2 = true;
                maybeDone_2();
            });
        }
    };
    _NanoSQLQuery.prototype._getIndexValues = function (indexes, row) {
        return Object.keys(indexes).reduce(function (prev, cur) {
            prev[cur] = utilities_1.cast(indexes[cur].type, utilities_1.objQuery(indexes[cur].path, row));
            return prev;
        }, {});
    };
    _NanoSQLQuery.prototype._showTables = function () {
        this.progress({
            tables: Object.keys(this.nSQL.tables)
        }, 0);
        this.complete();
    };
    _NanoSQLQuery.prototype._describe = function () {
        if (typeof this.query.table !== "string") {
            this.query.state = "error";
            this.error("Can't call describe on that!");
            return;
        }
        if (!this.nSQL.tables[this.query.table]) {
            this.query.state = "error";
            this.error("Table " + this.query.table + " not found!");
            return;
        }
        this.progress({
            describe: utilities_1._assign(this.nSQL.tables[this.query.table].columns)
        }, 0);
        this.complete();
    };
    _NanoSQLQuery.prototype._registerRelation = function (name, relation, complete, error) {
        var _this = this;
        new Promise(function (res, rej) {
            return _this.nSQL.doFilter("registerRelation", { result: { name: name, rel: relation } });
        }).then(function (result) {
            return new Promise(function (res, rej) {
                var relation = {
                    left: utilities_1.resolveObjPath(result.rel[0]),
                    sync: result.rel[1],
                    right: utilities_1.resolveObjPath(result.rel[2])
                };
                if (["<=", "<=>", "=>"].indexOf(relation.sync) === -1 || relation.left.length < 2 || relation.right.length < 2) {
                    rej("Invalid relation!");
                    return;
                }
                var tables = Object.keys(_this.nSQL.tables);
                if (tables.indexOf(relation.left[0]) === -1) {
                    rej("Relation error, can't find table " + relation.left[0] + "!");
                    return;
                }
                if (tables.indexOf(relation.right[0]) === -1) {
                    rej("Relation error, can't find table " + relation.right[0] + "!");
                    return;
                }
                _this.nSQL.relations[result.name] = relation;
                res(_this.nSQL.relations[result.name]);
            });
        }).then(complete).catch(error);
    };
    _NanoSQLQuery.prototype._destroyRelation = function (name, complete, error) {
        var _this = this;
        new Promise(function (res, rej) {
            return _this.nSQL.doFilter("destroyRelation", { result: name });
        }).then(function (result) {
            return new Promise(function (res, rej) {
                if (!_this.nSQL.relations[result]) {
                    rej("Relation " + result + " not found!");
                    return;
                }
                delete _this.nSQL.relations[result];
                res(result);
            });
        }).then(complete).catch(error);
    };
    _NanoSQLQuery.prototype._streamAS = function (row, isJoin) {
        var _this = this;
        if (this._selectArgs.length) {
            var result_1 = {};
            this._selectArgs.forEach(function (arg) {
                var _a;
                if (!_this.nSQL.functions[arg.value]) {
                    _this.query.state = "error";
                    _this.error("Function " + arg.value + " not found!");
                }
                if (arg.isFn) {
                    result_1[arg.as || arg.value] = (_a = _this.nSQL.functions[arg.value]).call.apply(_a, [_this.query, row, isJoin, {}].concat((arg.args || [])));
                }
                else {
                    result_1[arg.as || arg.value] = utilities_1.objQuery(arg.value, row, isJoin);
                }
            });
            return result_1;
        }
        return row;
    };
    _NanoSQLQuery.prototype._orderByRows = function (a, b) {
        return this._sortObj(a, b, this._orderBy);
    };
    /**
     * Get the sort direction for two objects given the objects, columns and resolve paths.
     *
     * @internal
     * @param {*} objA
     * @param {*} objB
     * @param NanoSQLSortBy columns
     * @param {boolean} resolvePaths
     * @returns {number}
     * @memberof _MutateSelection
     */
    _NanoSQLQuery.prototype._sortObj = function (objA, objB, columns) {
        return columns.sort.reduce(function (prev, cur) {
            var A = utilities_1.objQuery(cur.path, objA);
            var B = utilities_1.objQuery(cur.path, objB);
            if (!prev) {
                if (A === B)
                    return 0;
                return (A > B ? 1 : -1) * (cur.dir === "DESC" ? -1 : 1);
            }
            else {
                return prev;
            }
        }, 0);
    };
    _NanoSQLQuery.prototype.createTable = function (table, complete, error) {
        var _this = this;
        new Promise(function (res, rej) {
            var hasError = false;
            var l = table.name;
            if (!table._internal && (l.indexOf("_") === 0 || l.match(/\s/g) !== null || l.match(/[\(\)\]\[\.]/g) !== null)) {
                rej("nSQL: Invalid Table Name " + table.name + "! https://docs.nanosql.io/setup/data-models");
                return;
            }
            table.model.forEach(function (model) {
                var modelData = model.key.split(":"); // [key, type];
                if (modelData.length === 1) {
                    modelData.push("any");
                }
                if (!modelData[0] || modelData[0].match(/[\(\)\]\[\.]/g) !== null || modelData[0].indexOf("_") === 0) {
                    hasError = true;
                    rej("nSQL: Invalid Data Model at " + table.name + ", " + JSON.stringify(model) + "! https://docs.nanosql.io/setup/data-models");
                }
            });
            // replace white space in column names with dashes
            table.model = table.model.map(function (k) { return (__assign({}, k, { name: k.key.replace(/\s+/g, "-") })); });
            if (hasError)
                return;
            res();
        }).then(function () {
            return _this.nSQL.doFilter("createTable", { result: table });
        }).then(function (table) {
            return new Promise(function (res, rej) {
                var setModels = function (dataModels) {
                    return dataModels.map(function (d) {
                        var type = d.key.split(":")[1] || "any";
                        if (type.indexOf("geo") === 0) {
                            d.model = [
                                { key: "lat:float", default: 0 },
                                { key: "lon:float", default: 0 }
                            ];
                        }
                        if (d.model) {
                            d.model = setModels(d.model);
                        }
                        return d;
                    });
                };
                var generateColumns = function (dataModels) {
                    return dataModels.filter(function (d) { return d.key !== "*"; }).map(function (d) { return ({
                        key: d.key.split(":")[0],
                        type: d.key.split(":")[1] || "any",
                        default: d.default || null,
                        notNull: d.props && d.props.indexOf("not_null()") !== -1 ? true : false,
                        model: d.model ? generateColumns(d.model) : undefined
                    }); });
                };
                var hasError = false;
                var computedDataModel = setModels(table.model);
                _this.nSQL.tables[table.name] = {
                    model: computedDataModel,
                    columns: generateColumns(computedDataModel),
                    actions: table.actions || [],
                    views: table.views || [],
                    indexes: (table.indexes || []).map(function (i) { return ({
                        name: i.name.split(":")[0],
                        type: i.name.split(":")[1] || "string",
                        path: utilities_1.resolveObjPath(i.path)
                    }); }).reduce(function (p, c) {
                        var allowedTypes = Object.keys(_this.nSQL.indexTypes);
                        if (allowedTypes.indexOf(c.type) === -1) {
                            hasError = true;
                            rej("Index \"" + c.name + "\" does not have a valid type!");
                            return p;
                        }
                        if (c.type.indexOf("geo") !== -1) {
                            p[c.name + "-lat"] = { name: c.name + "-lat", type: "float", path: c.path.concat(["lat"]) };
                            p[c.name + "-lon"] = { name: c.name + "-lon", type: "float", path: c.path.concat(["lon"]) };
                        }
                        else {
                            p[c.name] = p;
                        }
                        return p;
                    }, {}),
                    pkType: table.model.reduce(function (p, c) {
                        if (c.props && c.props.indexOf("pk()") !== -1)
                            return c.key.split(":")[1];
                        return p;
                    }, ""),
                    pkCol: table.model.reduce(function (p, c) {
                        if (c.props && c.props.indexOf("pk()") !== -1)
                            return c.key.split(":")[0];
                        return p;
                    }, ""),
                    ai: table.model.reduce(function (p, c) {
                        if (c.props && c.props.indexOf("pk()") !== -1 && c.props.indexOf("ai()") !== -1)
                            return true;
                        return p;
                    }, false)
                };
                // no primary key found, set one
                if (_this.nSQL.tables[table.name].pkCol === "") {
                    _this.nSQL.tables[table.name].pkCol = "_id_";
                    _this.nSQL.tables[table.name].pkType = "uuid";
                    _this.nSQL.tables[table.name].model.unshift({ key: "_id_:uuid", props: ["pk()"] });
                    _this.nSQL.tables[table.name].columns = generateColumns(_this.nSQL.tables[table.name].model);
                }
                if (hasError)
                    return;
                var addTables = [table.name];
                Object.keys(_this.nSQL.tables[table.name].indexes).forEach(function (k, i) {
                    var index = _this.nSQL.tables[table.name].indexes[k];
                    var indexName = "_idx_" + table.name + "_" + index.name;
                    addTables.push(indexName);
                    _this.nSQL.tables[indexName] = {
                        model: [
                            { key: "id:" + (index.type || "uuid"), props: ["pk()"] },
                            { key: "pks:" + _this.nSQL.tables[table.name].pkType + "[]" }
                        ],
                        columns: [
                            { key: "id", type: index.type || "uuid" },
                            { key: "pks", type: _this.nSQL.tables[table.name].pkType + "[]" }
                        ],
                        actions: [],
                        views: [],
                        indexes: {},
                        pkType: index.type,
                        pkCol: "id",
                        ai: false
                    };
                });
                utilities_1.allAsync(addTables, function (table, i, next, err) {
                    _this.nSQL.adapter.createTable(table, _this.nSQL.tables[table], next, err);
                }).then(res).catch(rej);
            }).then(complete).catch(error);
        });
    };
    _NanoSQLQuery.prototype.alterTable = function (table, complete, error) {
        var _this = this;
        this.nSQL.doFilter("alterTable", { result: table }).then(function (alteredTable) {
            var tablesToAlter = [alteredTable.name];
            Object.keys(_this.nSQL.tables[table.name].indexes).forEach(function (indexName) {
                tablesToAlter.push("_idx_" + alteredTable.name + "_" + indexName);
            });
            utilities_1.allAsync(tablesToAlter, function (dropTable, i, next, err) {
                _this.nSQL.adapter.disconnectTable(alteredTable.name, next, err);
            }).then(function () {
                _this.createTable(alteredTable, complete, error);
            }).catch(error);
        }).catch(error);
    };
    _NanoSQLQuery.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        this.nSQL.doFilter("destroyTable", { result: [table] }).then(function (destroyTables) {
            var tablesToDrop = destroyTables;
            destroyTables.forEach(function (table) {
                Object.keys(_this.nSQL.tables[table].indexes).forEach(function (indexName) {
                    tablesToDrop.push("_idx_" + table + "_" + indexName);
                });
            });
            utilities_1.allAsync(tablesToDrop, function (dropTable, i, next, err) {
                _this.nSQL.adapter.dropTable(dropTable, function () {
                    delete _this.nSQL.tables[dropTable];
                    next(dropTable);
                }, err);
            }).then(complete).catch(error);
        });
    };
    _NanoSQLQuery.prototype._onError = function (err) {
        this.query.state = "error";
        this.error(err);
    };
    _NanoSQLQuery.prototype._getByPKs = function (onlyPKs, table, fastWhere, isReversed, orderByPK, onRow, complete) {
        var _this = this;
        switch (fastWhere.comp) {
            case "=":
                if (onlyPKs) {
                    onRow(fastWhere.value, 0);
                    complete();
                }
                else {
                    this.nSQL.adapter.read(table, fastWhere.value, function (row) {
                        onRow(row, 0);
                        complete();
                    }, this._onError);
                }
                break;
            case "BETWEEN":
                (onlyPKs ? this.nSQL.adapter.readMultiPK : this.nSQL.adapter.readMulti)(table, "range", fastWhere.value[0], fastWhere.value[1], isReversed, function (row, i) {
                    onRow(row, i);
                }, complete, this._onError);
                break;
            case "IN":
                var PKS = orderByPK ? (isReversed ? fastWhere.value.sort(function (a, b) { return a < b ? 1 : -1; }) : fastWhere.value.sort(function (a, b) { return a > b ? 1 : -1; })) : fastWhere.value;
                if (onlyPKs) {
                    PKS.forEach(function (pk, i) {
                        onRow(pk, i);
                    });
                    complete();
                }
                else {
                    utilities_1.chainAsync(PKS, function (pk, i, next) {
                        _this.nSQL.adapter.read(table, pk, function (row) {
                            onRow(row, i);
                            next();
                        }, _this._onError);
                    }).then(complete);
                }
                break;
        }
    };
    _NanoSQLQuery.prototype._fastQuery = function (onRow, complete) {
        var _this = this;
        if (this._whereArgs.fastWhere) {
            if (this._whereArgs.fastWhere.length === 1) { // single where
                var fastWhere = this._whereArgs.fastWhere[0];
                var isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";
                // function
                if (fastWhere.index && fastWhere.fnName) {
                    this.nSQL.functions[fastWhere.fnName].queryIndex(this.nSQL, this, fastWhere, false, onRow, complete);
                    // primary key
                }
                else if (fastWhere.col === this.nSQL.tables[this.query.table].pkCol) {
                    this._getByPKs(false, this.query.table, fastWhere, isReversed, this._pkOrderBy, onRow, complete);
                    // index
                }
                else {
                    this._readIndex(false, fastWhere, onRow, complete);
                }
            }
            else { // multiple conditions
                var indexBuffer_1 = {};
                var maxI_1 = 0;
                utilities_1.chainAsync(this._whereArgs.fastWhere, function (fastWhere, i, next) {
                    if (i % 2 === 1) { // should be AND
                        next();
                        return;
                    }
                    maxI_1 = i;
                    var addIndexBuffer = function (pk) {
                        indexBuffer_1[pk] = i;
                    };
                    // function
                    if (fastWhere.index && fastWhere.fnName) {
                        _this.nSQL.functions[fastWhere.fnName].queryIndex(_this.nSQL, _this, fastWhere, true, addIndexBuffer, next);
                        // primary key
                    }
                    else if (fastWhere.col === _this.nSQL.tables[_this.query.table].pkCol) {
                        _this._getByPKs(true, _this.query.table, fastWhere, false, false, addIndexBuffer, next);
                        // index
                    }
                    else {
                        _this._readIndex(true, fastWhere, addIndexBuffer, next);
                    }
                }).then(function () {
                    var getPKs = [];
                    Object.keys(indexBuffer_1).forEach(function (PK) {
                        if (indexBuffer_1[PK] === maxI_1) {
                            getPKs.push(PK);
                        }
                    });
                    _this._getByPKs(false, _this.query.table, {
                        index: "_pk_",
                        col: _this.nSQL.tables[_this.query.table].pkCol,
                        comp: "IN",
                        value: getPKs
                    }, false, false, function (row, i) {
                        onRow(row, i);
                    }, complete);
                });
            }
        }
    };
    _NanoSQLQuery.prototype._readIndex = function (onlyPKs, fastWhere, onRow, complete) {
        var _this = this;
        var useIndex = this.nSQL.tables[this.query.table].indexes[fastWhere.index];
        if (!useIndex) {
            this._onError("Index not found!");
            return;
        }
        var queryComplete = false;
        var bufferStarted = false;
        var counter = 0;
        var processing = 0;
        var processBuffer = function () {
            if (!indexBuffer.length) {
                if (queryComplete) { // buffer is empty and query is done, we're finshed
                    complete();
                }
                else { // wait for next row to come into the buffer
                    utilities_1.setFast(function () {
                        processing++;
                        if (processing > 1000) {
                            // waiting literally forever for the next row
                            setTimeout(processBuffer, Math.min(processing / 10, 1000));
                        }
                        else {
                            processBuffer();
                        }
                    });
                }
                return;
            }
            // execute rows in the buffer
            _this._getByPKs(false, _this.query.table, {
                index: "_pk_",
                col: _this.nSQL.tables[_this.query.table].pkCol,
                comp: "IN",
                value: indexBuffer.shift().pks
            }, false, false, function (row) {
                onRow(row, counter);
                counter++;
            }, function () {
                counter % 100 === 0 ? utilities_1.setFast(processBuffer) : processBuffer();
            });
        };
        var table = "_idx_" + this.query.table + "_" + fastWhere.index;
        var indexBuffer = [];
        var indexPKs = [];
        var isReversed = this._idxOrderBy && this._orderBy.sort[0].dir === "DESC";
        this._getByPKs(false, table, fastWhere, isReversed, this._idxOrderBy, function (row) {
            if (onlyPKs) {
                indexPKs = indexPKs.concat(row.pks || []);
            }
            else {
                indexBuffer.push(row);
                if (!bufferStarted) {
                    bufferStarted = true;
                    processBuffer();
                }
            }
        }, function () {
            queryComplete = true;
            if (onlyPKs) {
                var i = 0;
                while (i < indexPKs.length) {
                    onRow(indexPKs[i], i);
                    i++;
                }
                complete();
            }
        });
    };
    _NanoSQLQuery.prototype._getRecords = function (onRow, complete) {
        var _this = this;
        var scanRecords = function (rows) {
            var i = 0;
            while (i < rows.length) {
                if (_this._whereArgs.type !== interfaces_1.IWhereType.none) {
                    if (_this._whereArgs.whereFn) {
                        if (_this._whereArgs.whereFn(rows[i], i)) {
                            onRow(rows[i], i);
                        }
                    }
                    else {
                        if (_this._where(rows[i], _this._whereArgs.slowWhere, _this.query.join !== undefined)) {
                            onRow(rows[i], i);
                        }
                    }
                }
                else {
                    onRow(rows[i], i);
                }
                i++;
            }
            complete();
        };
        if (typeof this.query.table === "string") { // pull from local table, possibly use indexes
            switch (this._whereArgs.type) {
                // primary key or secondary index select
                case interfaces_1.IWhereType.fast:
                    this._fastQuery(onRow, complete);
                    break;
                // primary key or secondary index followed by slow query
                case interfaces_1.IWhereType.medium:
                    this._fastQuery(function (row, i) {
                        if (_this._where(row, _this._whereArgs.slowWhere, false)) {
                            onRow(row, i);
                        }
                    }, complete);
                    break;
                // full table scan
                case interfaces_1.IWhereType.slow:
                case interfaces_1.IWhereType.none:
                case interfaces_1.IWhereType.fn:
                    var isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";
                    this.nSQL.adapter.readMulti(this.query.table, "all", undefined, undefined, isReversed, function (row, i) {
                        if (_this._whereArgs.type === interfaces_1.IWhereType.slow) {
                            if (_this._where(row, _this._whereArgs.slowWhere, false)) {
                                onRow(row, i);
                            }
                        }
                        else if (_this._whereArgs.type === interfaces_1.IWhereType.fn && _this._whereArgs.whereFn) {
                            if (_this._whereArgs.whereFn(row, i)) {
                                onRow(row, i);
                            }
                        }
                        else {
                            onRow(row, i);
                        }
                    }, complete, function (err) {
                        _this.query.state = "error";
                        _this.error(err);
                    });
                    break;
            }
        }
        else if (typeof this.query.table === "function") { // promise that returns array
            this.query.table().then(scanRecords).catch(function (err) {
                _this.error(err);
            });
        }
        else if (Array.isArray(this.query.table)) { // array
            scanRecords(this.query.table);
        }
    };
    _NanoSQLQuery.prototype._rebuildIndexes = function (table, complete, error) {
    };
    /**
     * Handles WHERE statements, combining multiple compared statements aginst AND/OR as needed to return a final boolean value.
     * The final boolean value is wether the row matches the WHERE conditions or not.
     *
     * @param {*} singleRow
     * @param {any[]} where
     * @param {number} rowIDX
     * @param {boolean} [ignoreFirstPath]
     * @returns {boolean}
     */
    _NanoSQLQuery.prototype._where = function (singleRow, where, ignoreFirstPath) {
        if (where.length > 1) { // compound where statements
            var prevCondition = "AND";
            var matches = true;
            var idx = 0;
            while (idx < where.length) {
                var wArg = where[idx];
                if (idx % 2 === 1) {
                    prevCondition = wArg;
                }
                else {
                    var compareResult = false;
                    if (Array.isArray(wArg[0])) { // nested where
                        compareResult = this._where(singleRow, wArg, ignoreFirstPath || false);
                    }
                    else {
                        compareResult = this._compare(wArg, singleRow, ignoreFirstPath || false);
                    }
                    if (idx === 0) {
                        matches = compareResult;
                    }
                    else {
                        if (prevCondition === "AND") {
                            matches = matches && compareResult;
                        }
                        else {
                            matches = matches || compareResult;
                        }
                    }
                }
            }
            return matches;
        }
        else { // single where statement
            return this._compare(where[0], singleRow, ignoreFirstPath || false);
        }
    };
    _NanoSQLQuery.prototype._processLIKE = function (columnValue, givenValue) {
        if (!_NanoSQLQuery.likeCache[givenValue]) {
            var prevChar_1 = "";
            _NanoSQLQuery.likeCache[givenValue] = new RegExp(givenValue.split("").map(function (s) {
                if (prevChar_1 === "\\") {
                    prevChar_1 = s;
                    return s;
                }
                prevChar_1 = s;
                if (s === "%")
                    return ".*";
                if (s === "_")
                    return ".";
                return s;
            }).join(""), "gmi");
        }
        if (typeof columnValue !== "string") {
            if (typeof columnValue === "number") {
                return String(columnValue).match(_NanoSQLQuery.likeCache[givenValue]) !== null;
            }
            else {
                return JSON.stringify(columnValue).match(_NanoSQLQuery.likeCache[givenValue]) !== null;
            }
        }
        return columnValue.match(_NanoSQLQuery.likeCache[givenValue]) !== null;
    };
    _NanoSQLQuery.prototype._getColValue = function (where, wholeRow, isJoin) {
        var _a;
        if (where.fnName) {
            return (_a = this.nSQL.functions[where.fnName]).call.apply(_a, [this.query, wholeRow, isJoin, this.nSQL.functions[where.fnName].aggregateStart || { result: undefined }].concat((where.fnArgs || [])));
        }
        else {
            return utilities_1.objQuery(where.col, wholeRow, isJoin);
        }
    };
    /**
     * Compare function used by WHERE to determine if a given value matches a given condition.
     *
     * Accepts single where arguments (compound arguments not allowed).
     *
     *
     * @param {*} val1
     * @param {string} compare
     * @param {*} val2
     * @returns {boolean}
     */
    _NanoSQLQuery.prototype._compare = function (where, wholeRow, isJoin) {
        var columnValue = this._getColValue(where, wholeRow, isJoin);
        var givenValue = where.value;
        var compare = where.comp;
        if (givenValue === "NULL" || givenValue === "NOT NULL") {
            var isNull = [undefined, null, ""].indexOf(columnValue) !== -1;
            var isEqual = compare === "=" || compare === "LIKE";
            switch (givenValue) {
                case "NULL": return isEqual ? isNull : !isNull;
                case "NOT NULL": return isEqual ? !isNull : isNull;
            }
        }
        if (["IN", "NOT IN", "BETWEEN", "INTERSECT", "INTERSECT ALL", "NOT INTERSECT"].indexOf(compare) !== -1) {
            if (!Array.isArray(givenValue)) {
                this.query.state = "error";
                this.query.error("WHERE \"" + compare + "\" comparison requires an array value!");
                return false;
            }
        }
        switch (compare) {
            // if column equal to given value. Supports arrays, objects and primitives
            case "=": return utilities_1.compareObjects(givenValue, columnValue);
            // if column not equal to given value. Supports arrays, objects and primitives
            case "!=": return !utilities_1.compareObjects(givenValue, columnValue);
            // if column greather than given value
            case ">": return columnValue > givenValue;
            // if column less than given value
            case "<": return columnValue < givenValue;
            // if column less than or equal to given value
            case "<=": return columnValue <= givenValue;
            // if column greater than or equal to given value
            case ">=": return columnValue >= givenValue;
            // if column value exists in given array
            case "IN": return givenValue.indexOf(columnValue) !== -1;
            // if column does not exist in given array
            case "NOT IN": return givenValue.indexOf(columnValue) === -1;
            // regexp search the column
            case "REGEXP":
            case "REGEX": return (columnValue || "").match(givenValue) !== null;
            // if given value exists in column value
            case "LIKE": return this._processLIKE((columnValue || ""), givenValue);
            // if given value does not exist in column value
            case "NOT LIKE": return !this._processLIKE((columnValue || ""), givenValue);
            // if the column value is between two given numbers
            case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] > columnValue;
            // if single value exists in array column
            case "INCLUDES": return (columnValue || []).indexOf(givenValue) !== -1;
            // if single value does not exist in array column
            case "NOT INCLUDES": return (columnValue || []).indexOf(givenValue) === -1;
            // if array of values intersects with array column
            case "INTERSECT": return (columnValue || []).filter(function (l) { return givenValue.indexOf(l) > -1; }).length > 0;
            // if every value in the provided array exists in the array column
            case "INTERSECT ALL": return (columnValue || []).filter(function (l) { return givenValue.indexOf(l) > -1; }).length === givenValue.length;
            // if array of values does not intersect with array column
            case "NOT INTERSECT": return (columnValue || []).filter(function (l) { return givenValue.indexOf(l) > -1; }).length === 0;
            default: return false;
        }
    };
    _NanoSQLQuery.prototype._parseSort = function (sort, checkforIndexes) {
        var key = sort && sort.length ? utilities_1.hash(JSON.stringify(sort)) : "";
        if (!key)
            return { sort: [], index: "" };
        if (_NanoSQLQuery._sortMemoized[key])
            return _NanoSQLQuery._sortMemoized[key];
        var result = sort.map(function (o) { return o.split(" ").map(function (s) { return s.trim(); }); }).reduce(function (p, c) { return p.push({ path: utilities_1.resolveObjPath(c[0]), dir: (c[1] || "asc").toUpperCase() }), p; }, []);
        var index = "";
        if (checkforIndexes && result.length === 1) {
            var pkKey = typeof this.query.table === "string" ? this.nSQL.tables[this.query.table].pkCol : "";
            if (result[0].path[0].length && result[0].path[0] === pkKey) {
                index = "_pk_";
            }
            else {
                var indexKeys = Object.keys(this.nSQL.tables[this.query.table].indexes);
                var i = indexKeys.length;
                while (i-- && !index) {
                    if (utilities_1.compareObjects(this.nSQL.tables[this.query.table].indexes[indexKeys[i]], result[0].path)) {
                        index = this.nSQL.tables[this.query.table].indexes[indexKeys[i]].name;
                    }
                }
            }
        }
        _NanoSQLQuery._sortMemoized[key] = {
            sort: result,
            index: index
        };
        return _NanoSQLQuery._sortMemoized[key];
    };
    _NanoSQLQuery.prototype._parseSelect = function () {
        var _this = this;
        var selectArgsKey = this.query.actionArgs && this.query.actionArgs.length ? JSON.stringify(this.query.actionArgs) : "";
        this._orderBy = this._parseSort(this.query.orderBy || [], typeof this.query.table === "string");
        this._groupBy = this._parseSort(this.query.groupBy || [], false);
        if (selectArgsKey) {
            if (_NanoSQLQuery._selectArgsMemoized[selectArgsKey]) {
                this._hasAggrFn = _NanoSQLQuery._selectArgsMemoized[selectArgsKey].hasAggrFn;
                this._selectArgs = _NanoSQLQuery._selectArgsMemoized[selectArgsKey].args;
            }
            else {
                (this.query.actionArgs || []).forEach(function (val) {
                    var splitVal = val.split(/\s+as\s+/i).map(function (s) { return s.trim(); });
                    if (splitVal[0].indexOf("(") !== -1) {
                        var fnArgs = splitVal[0].split("(")[1].replace(")", "").split(",").map(function (v) { return v.trim(); });
                        var fnName = splitVal[0].split("(")[0].trim().toUpperCase();
                        _this._selectArgs.push({ isFn: true, value: fnName, as: splitVal[1], args: fnArgs });
                        if (!_this.nSQL.functions[fnName]) {
                            _this.query.state = "error";
                            _this.error("Function \"" + fnName + "\" not found!");
                        }
                        else {
                            if (_this.nSQL.functions[fnName].type === "A") {
                                _this._hasAggrFn = true;
                            }
                        }
                    }
                    else {
                        _this._selectArgs.push({ isFn: false, value: splitVal[0], as: splitVal[1] });
                    }
                });
                if (this.query.state !== "error") {
                    _NanoSQLQuery._selectArgsMemoized[selectArgsKey] = { hasAggrFn: this._hasAggrFn, args: this._selectArgs };
                }
            }
        }
        else {
            this._selectArgs = [];
        }
        var canUseOrderByIndex = false;
        if (this._whereArgs.type === interfaces_1.IWhereType.none) {
            canUseOrderByIndex = this._orderBy.index === "_pk_";
            if (canUseOrderByIndex) {
                this._pkOrderBy = true;
            }
        }
        else {
            canUseOrderByIndex = this._orderBy.index.length && this._whereArgs.fastWhere && utilities_1.compareObjects(this._whereArgs.fastWhere[0].col, this._orderBy.sort[0].path) ? true : false;
            if (canUseOrderByIndex) {
                this._idxOrderBy = true;
            }
        }
        if ((this._orderBy.sort.length && !canUseOrderByIndex) || this._groupBy.sort.length || this._hasAggrFn) {
            this._stream = false;
        }
    };
    _NanoSQLQuery.prototype._parseWhere = function (qWhere, ignoreIndexes) {
        var _this = this;
        var where = qWhere || [];
        var key = JSON.stringify(where) + (ignoreIndexes ? "0" : "1");
        if (_NanoSQLQuery._whereMemoized[key]) {
            return _NanoSQLQuery._whereMemoized[key];
        }
        if (typeof where === "function") {
            return { type: interfaces_1.IWhereType.fn, whereFn: where };
        }
        else if (!where.length) {
            _NanoSQLQuery._whereMemoized[key] = { type: interfaces_1.IWhereType.none };
            return _NanoSQLQuery._whereMemoized[key];
        }
        var indexes = typeof this.query.table === "string" ? Object.keys(this.nSQL.tables[this.query.table].indexes).map(function (k) { return _this.nSQL.tables[_this.query.table].indexes[k]; }) : [];
        var pkKey = typeof this.query.table === "string" ? this.nSQL.tables[this.query.table].pkCol : "";
        // find indexes and functions
        var recursiveParse = function (ww, level) {
            var doIndex = !ignoreIndexes && level === 0;
            return ww.reduce(function (p, w, i) {
                if (i % 2 === 1) { // AND or OR
                    if (typeof w !== "string") {
                        _this.query.state = "error";
                        _this.error("Malformed WHERE statement!");
                        return p;
                    }
                    p.push(w);
                    return p;
                }
                else { // where conditions
                    if (!Array.isArray(w)) {
                        _this.query.state = "error";
                        _this.error("Malformed WHERE statement!");
                        return p;
                    }
                    if (Array.isArray(w[0])) { // nested array
                        p.push(recursiveParse(w, level + 1));
                    }
                    else if (w[0].indexOf("(") !== -1) { // function
                        var fnArgs = w[0].split("(")[1].replace(")", "").split(",").map(function (v) { return v.trim(); }).filter(function (a) { return a; });
                        var fnName = w[0].split("(")[0].trim().toUpperCase();
                        var hasIndex = false;
                        if (!_this.nSQL.functions[fnName]) {
                            _this.query.state = "error";
                            _this.error("Function \"" + fnName + "\" not found!");
                            return p;
                        }
                        if (doIndex && _this.nSQL.functions[fnName] && _this.nSQL.functions[fnName].whereIndex) {
                            var indexFn = _this.nSQL.functions[fnName].whereIndex(_this.nSQL, _this.query, fnArgs, w);
                            if (indexFn) {
                                hasIndex = true;
                                p.push(indexFn);
                            }
                        }
                        if (!hasIndex) {
                            p.push({
                                fnName: fnName,
                                fnArgs: fnArgs,
                                comp: w[1],
                                value: w[2]
                            });
                        }
                    }
                    else { // column select
                        var isIndexCol_1 = false;
                        if (["=", "BETWEEN", "IN"].indexOf(w[1]) && doIndex) {
                            // primary key select
                            if (w[0] === pkKey) {
                                isIndexCol_1 = true;
                                p.push({
                                    index: "_pk_",
                                    col: w[0],
                                    comp: w[1],
                                    value: w[2]
                                });
                            }
                            else { // check if we can use any index
                                var path_1 = utilities_1.resolveObjPath(w[0]);
                                indexes.forEach(function (index) {
                                    if (utilities_1.compareObjects(index.path, path_1)) {
                                        isIndexCol_1 = true;
                                        p.push({
                                            index: index.name,
                                            col: w[0],
                                            comp: w[1],
                                            value: w[2]
                                        });
                                    }
                                });
                            }
                        }
                        if (!isIndexCol_1) {
                            p.push({
                                col: w[0],
                                comp: w[1],
                                value: w[2]
                            });
                        }
                        return p;
                    }
                }
            }, []);
        };
        var parsedWhere = recursiveParse(typeof where[0] === "string" ? [where] : where, 0);
        // discover where we have indexes we can use
        // the rest is a full table scan OR a scan of the index results
        // fastWhere = index query, slowWhere = row by row/full table scan
        var isIndex = true;
        var count = 0;
        var lastFastIndx = -1;
        while (count < parsedWhere.length && isIndex) {
            if (count % 2 === 1) {
                if (parsedWhere[count] !== "AND") {
                    isIndex = false;
                    lastFastIndx = count;
                }
            }
            else {
                if (Array.isArray(parsedWhere[count]) || !parsedWhere[count].index) {
                    isIndex = false;
                    lastFastIndx = count;
                }
            }
            count++;
        }
        // make sure lastFastIndx lands on an AND, OR or gets pushed off the end.
        if (lastFastIndx % 2 === 0) {
            lastFastIndx++;
        }
        // has at least some index values
        // "AND" or the end of the WHERE should follow the last index to use the indexes
        if (lastFastIndx !== -1 && (parsedWhere[lastFastIndx] === "AND" || !parsedWhere[lastFastIndx])) {
            var slowWhere = parsedWhere.slice(lastFastIndx + 1);
            _NanoSQLQuery._whereMemoized[key] = {
                type: slowWhere.length ? interfaces_1.IWhereType.medium : interfaces_1.IWhereType.fast,
                slowWhere: slowWhere,
                fastWhere: parsedWhere.slice(0, lastFastIndx)
            };
        }
        else {
            _NanoSQLQuery._whereMemoized[key] = {
                type: interfaces_1.IWhereType.slow,
                slowWhere: parsedWhere
            };
        }
        return _NanoSQLQuery._whereMemoized[key];
    };
    _NanoSQLQuery.likeCache = {};
    _NanoSQLQuery._selectArgsMemoized = {};
    return _NanoSQLQuery;
}());
exports._NanoSQLQuery = _NanoSQLQuery;
//# sourceMappingURL=query.js.map