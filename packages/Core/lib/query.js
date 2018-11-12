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
        this._queryBuffer = [];
        this._stream = true;
        this._selectArgs = [];
        this._pkOrderBy = false;
        this._idxOrderBy = false;
        this._sortGroups = [];
        this._sortGroupKeys = {};
        this._TableCache = {};
        this._TableCacheLoading = {};
        this._graphTableCache = {};
        this._graphTableCacheLoading = {};
        this.query.state = "processing";
        var action = query.action.toLowerCase().trim();
        this._orderByRows = this._orderByRows.bind(this);
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
                this._upsert(this.progress, this.complete, this.error);
                break;
            case "delete":
                this._delete(this.progress, this.complete, this.error);
                break;
            case "show tables":
                this._showTables();
                break;
            case "describe":
                this._describe();
                break;
            case "drop":
            case "drop table":
                this._dropTable(this.query.table, finishQuery, this.error);
                break;
            case "create table":
            case "create table if not exists":
                requireAction(function () {
                    _this._createTable(_this.query.actionArgs, finishQuery, _this.error);
                });
                break;
            case "alter table":
                requireAction(function () {
                    _this._alterTable(_this.query.actionArgs, finishQuery, _this.error);
                });
                break;
            case "rebuild indexes":
                requireAction(function () {
                    _this._rebuildIndexes(_this.progress, finishQuery, _this.error);
                });
                break;
            default:
                this.nSQL.doFilter("customQuery", { result: undefined, query: this, onRow: progress, complete: complete, error: error }).then(function () {
                    _this.query.state = "error";
                    _this.error("Query type \"" + query.action + "\" not supported!");
                }).catch(function (err) {
                    _this.query.state = "error";
                    _this.error(err);
                });
        }
    }
    _NanoSQLQuery.prototype._getTableCache = function (cacheKey, table, callback) {
        var _this = this;
        if (typeof table === "function") {
            if (this._TableCache[cacheKey]) {
                if (this._TableCacheLoading[cacheKey]) {
                    setTimeout(function () {
                        _this._getTableCache(cacheKey, table, callback);
                    }, 10);
                }
                else {
                    callback(this._TableCache[cacheKey]);
                }
                return;
            }
            this._TableCacheLoading[cacheKey] = true;
            this._TableCache[cacheKey] = [];
            table().then(function (rows) {
                _this._TableCache[cacheKey] = rows;
                _this._TableCacheLoading[cacheKey] = false;
                callback(rows);
            }).catch(function (err) {
                _this.query.state = "error";
                _this.error(err);
            });
        }
        else {
            callback(table);
        }
    };
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
            if (join.type !== "cross" && !join.on) {
                _this.query.state = "error";
                _this.error(new Error("Non 'cross' joins require an 'on' parameter!"));
                return;
            }
            var noJoinAS = new Error("Must use 'AS' when joining temporary tables!");
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
            var joinBuffer = new utilities_1.NanoSQLBuffer(function (rData, i, rDone, err) {
                if (!joinData[joinIdx + 1]) { // no more joins, send joined row
                    onRow(rData);
                    rDone();
                }
                else { // more joins, nest on!
                    doJoin(rData, joinIdx + 1, rDone);
                }
            }, _this.error, joinDone);
            var withPK = typeof join.with.table === "string" ? _this.nSQL.tables[join.with.table].pkCol : "";
            var rightTable = String(join.with.as || join.with.table);
            var leftTable = String(_this.query.tableAS || _this.query.table);
            _this._getTableCache(String("J-" + joinIdx), join.with.table, function (joinTable) {
                var queryTable = _this.query.tableAS || _this.query.table;
                _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(joinTable, "select"), { tableAS: join.with.as, where: join.on && join.type !== "cross" ? _this._buildCombineWhere(join.on, join.with.as || join.with.table, queryTable, rowData) : undefined, skipQueue: true }), function (row) {
                    var _a;
                    joinRowCount++;
                    if (join.type === "right" || join.type === "outer") {
                        // keep track of which right side rows have been joined
                        rightHashes.push(withPK ? row[withPK] : utilities_1.hash(JSON.stringify(row)));
                    }
                    joinBuffer.newItem(__assign({}, rowData, (_a = {}, _a[rightTable] = row, _a)));
                }, function () {
                    var _a, _b;
                    switch (join.type) {
                        case "left":
                            if (joinRowCount === 0) {
                                joinBuffer.newItem(__assign({}, rowData, (_a = {}, _a[rightTable] = undefined, _a)));
                            }
                            joinBuffer.finished();
                            break;
                        case "inner":
                        case "cross":
                            joinBuffer.finished();
                            break;
                        case "outer":
                        case "right":
                            if (joinRowCount === 0 && join.type === "outer") {
                                joinBuffer.newItem(__assign({}, rowData, (_b = {}, _b[rightTable] = undefined, _b)));
                            }
                            // full table scan on right table :(
                            _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(join.with.table, "select"), { skipQueue: true, where: withPK ? [withPK, "NOT IN", rightHashes] : undefined }), function (row) {
                                var _a;
                                if (withPK || rightHashes.indexOf(utilities_1.hash(JSON.stringify(row))) === -1) {
                                    joinBuffer.newItem(__assign({}, rowData, (_a = {}, _a[leftTable] = undefined, _a[rightTable] = row, _a)));
                                }
                            }, function () {
                                joinBuffer.finished();
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
                            return _this._where(r, _this._whereArgs.slowWhere);
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
                        _this._queryBuffer = _this._queryBuffer.concat(rows.map(function (row) {
                            var newRow = _this._streamAS(row);
                            var keep = _this.query.having ? _this._where(newRow, _this._havingArgs.slowWhere) : true;
                            return keep ? newRow : undefined;
                        }).filter(function (f) { return f; }));
                    }
                    else {
                        rows.forEach(function (row, i) {
                            var newRow = _this._streamAS(row);
                            var keep = _this.query.having ? _this._where(newRow, _this._havingArgs.slowWhere) : true;
                            if (!keep) {
                                return;
                            }
                            if (doRange) {
                                if (count_1 >= range[0] && count_1 < range[1]) {
                                    _this.progress(_this._streamAS(row), count_1);
                                }
                            }
                            else {
                                _this.progress(_this._streamAS(row), count_1);
                            }
                            count_1++;
                        });
                    }
                    next();
                });
            }).then(function () {
                if (_this.query.orderBy) {
                    var sorted = _this._queryBuffer.sort(_this._orderByRows);
                    (doRange ? sorted.slice(range[0], range[1]) : sorted).forEach(_this.progress);
                }
                complete();
            });
            return;
        }
        var joinData = Array.isArray(this.query.join) ? this.query.join : [this.query.join];
        var joinedRows = 0;
        var graphBuffer = new utilities_1.NanoSQLBuffer(function (gRow, ct, nextGraph, err) {
            var keepRow = true;
            if (_this.query.having) {
                keepRow = _this._where(_this._streamAS(gRow), _this._havingArgs.slowWhere);
            }
            if (keepRow) {
                if (_this.query.graph) {
                    _this._graph(_this.query.graph || [], _this.query.tableAS || _this.query.table, gRow, rowCounter, function (graphRow, j) {
                        _this.progress(_this._streamAS(graphRow), j);
                        rowCounter++;
                        nextGraph();
                    }, 0);
                }
                else {
                    _this.progress(_this._streamAS(gRow), rowCounter);
                    rowCounter++;
                    nextGraph();
                }
            }
            else {
                nextGraph();
            }
        }, this._onError, function () {
            complete();
        });
        var rowCounter = 0;
        var selectBuffer = new utilities_1.NanoSQLBuffer(function (row, ct, next, err) {
            row = utilities_1._maybeAssign(row);
            _this._maybeJoin(joinData, row, function (row2) {
                if (_this._stream) {
                    // continue streaming results
                    // skipping group by, order by and aggregate functions
                    if (doRange ? (rowCounter >= range[0] && rowCounter < range[1]) : true) {
                        graphBuffer.newItem(row2);
                    }
                    rowCounter++;
                }
                else {
                    _this._queryBuffer.push(row2);
                }
            }, next);
        }, this.error, function () {
            if (_this._stream) {
                graphBuffer.finished();
                return;
            }
            // use buffer
            utilities_1.allAsync(_this._queryBuffer, function (row, i, next) {
                _this._graph(_this.query.graph || [], _this.query.tableAS || _this.query.table, row, i, next, 0);
            }).then(function (newBuffer) {
                _this._queryBuffer = newBuffer;
                // Group by, functions and AS
                _this._groupByRows();
                if (_this.query.having) { // having
                    _this._queryBuffer = _this._queryBuffer.filter(function (row) {
                        return _this._where(row, _this._havingArgs.slowWhere);
                    });
                }
                if (_this.query.orderBy) { // order by
                    _this._queryBuffer.sort(_this._orderByRows);
                }
                if (doRange) { // limit / offset
                    _this._queryBuffer = _this._queryBuffer.slice(range[0], range[1]);
                }
                _this._queryBuffer.forEach(function (row, i) {
                    _this.progress(row, range[0] + i);
                });
                complete();
            });
        });
        var tableIsString = typeof this.query.table === "string";
        // query path start
        this._getRecords(function (row, i) {
            selectBuffer.newItem(row);
            if (tableIsString) {
                _this.nSQL.triggerEvent({
                    target: _this.query.table,
                    path: "_all_",
                    events: ["select", "*"],
                    time: Date.now(),
                    result: row,
                    actionOrView: _this.query.action || _this.query.view
                });
            }
        }, function () {
            selectBuffer.finished();
        });
    };
    _NanoSQLQuery.prototype._groupByRows = function () {
        var _this = this;
        if (!this.query.groupBy && !this._hasAggrFn) {
            this._queryBuffer = this._queryBuffer.map(function (b) { return _this._streamAS(b); });
            return;
        }
        this._queryBuffer.sort(function (a, b) {
            return _this._sortObj(a, b, _this._groupBy);
        }).forEach(function (val, idx) {
            var groupByKey = _this._groupBy.sort.map(function (k) { return String(utilities_1.deepGet(k.path, val)); }).join(".");
            if (_this._sortGroupKeys[groupByKey] === undefined) {
                _this._sortGroupKeys[groupByKey] = _this._sortGroups.length;
            }
            var key = _this._sortGroupKeys[groupByKey];
            if (!_this._sortGroups[key]) {
                _this._sortGroups.push([]);
            }
            _this._sortGroups[key].push(val);
        });
        this._queryBuffer = [];
        if (this._hasAggrFn) {
            // loop through the groups
            this._sortGroups.forEach(function (group) {
                // find aggregate functions
                var resultFns = _this._selectArgs.reduce(function (p, c, i) {
                    if (_this.nSQL.functions[c.value] && _this.nSQL.functions[c.value].type === "A") {
                        p[i] = {
                            idx: i,
                            name: c.value,
                            aggr: utilities_1._assign(_this.nSQL.functions[c.value].aggregateStart),
                            args: c.args
                        };
                    }
                    return p;
                }, []);
                var firstFn = resultFns.filter(function (f) { return f; })[0];
                // calculate aggregate functions
                group.forEach(function (row, i) {
                    resultFns.forEach(function (fn, i) {
                        var _a;
                        if (!fn)
                            return;
                        resultFns[i].aggr = (_a = _this.nSQL.functions[fn.name]).call.apply(_a, [_this.query, row, resultFns[i].aggr].concat(resultFns[i].args));
                    });
                });
                // calculate simple functions and AS back into buffer
                _this._queryBuffer.push(_this._selectArgs.reduce(function (prev, cur, i) {
                    var _a;
                    var col = cur.isFn ? cur.value + "(" + (cur.args || []).join(", ") + ")" : cur.value;
                    prev[cur.as || col] = cur.isFn && resultFns[i] ? resultFns[i].aggr.result : (cur.isFn ? (_a = _this.nSQL.functions[cur.value]).call.apply(_a, [_this.query, resultFns[firstFn.idx].aggr.row, {}].concat((cur.args || []))) : utilities_1.deepGet(cur.value, resultFns[firstFn.idx].aggr.row));
                    return prev;
                }, {}));
            });
        }
        else {
            this._sortGroups.forEach(function (group) {
                group.forEach(function (row) {
                    _this._queryBuffer.push(_this._streamAS(row));
                });
            });
        }
    };
    _NanoSQLQuery.prototype._buildCombineWhere = function (graphWhere, graphTable, rowTable, rowData) {
        var _this = this;
        if (typeof graphWhere === "function") {
            return function (compareRow) {
                var _a;
                return graphWhere(__assign((_a = {}, _a[graphTable] = compareRow, _a), rowData));
            };
        }
        return (typeof graphWhere[0] === "string" ? [graphWhere] : graphWhere).map(function (j) {
            if (Array.isArray(j[0]))
                return _this._buildCombineWhere(j, graphTable, rowTable, rowData); // nested where
            if (j === "AND" || j === "OR")
                return j;
            var leftWhere = utilities_1.resolvePath(j[0]);
            var rightWhere = utilities_1.resolvePath(j[2]);
            var swapWhere = leftWhere[0] === rowTable;
            // swapWhere = true [leftTable.column, =, rightTable.column] => [rightWhere, =, objQuery(leftWhere)]
            // swapWhere = false [rightTable.column, =, leftTable.column] => [leftWhere, =, objQuery(rightWhere)]
            return [
                swapWhere ? rightWhere.slice(1).join(".") : leftWhere.slice(1).join("."),
                swapWhere ? (j[1].indexOf(">") !== -1 ? j[1].replace(">", "<") : j[1].replace("<", ">")) : j[1],
                utilities_1.deepGet(swapWhere ? leftWhere : rightWhere, rowData)
            ];
        });
    };
    _NanoSQLQuery.prototype._graph = function (gArgs, topTable, row, index, onRow, level) {
        var _this = this;
        var graphArgs = Array.isArray(gArgs) ? gArgs : [gArgs];
        if (!graphArgs || graphArgs.length === 0) {
            onRow(row, index);
            return;
        }
        utilities_1.allAsync(graphArgs, function (graph, i, next) {
            var noGraphAs = new Error("Must use 'AS' when graphing temporary tables!");
            row[graph.key] = [];
            if (typeof graph.with.table !== "string" && !graph.with.as) {
                _this.query.state = "error";
                _this.error(noGraphAs);
                return;
            }
            if (typeof _this.query.table !== "string" && !_this.query.tableAS) {
                _this.query.state = "error";
                _this.error(noGraphAs);
                return;
            }
            var graphBuffer = new utilities_1.NanoSQLBuffer(function (graphRow, i, done, err) {
                if (graph.graph) { // nested graph
                    _this._graph(graph.graph, graph.with.as || graph.with.table, graphRow, i, function (finishedGraphRow) {
                        row[graph.key].push(finishedGraphRow);
                        done();
                    }, level + 1);
                }
                else { // not nested
                    row[graph.key].push(graphRow);
                    done();
                }
            }, _this._onError, function () {
                next(null);
            });
            var tableIdx = JSON.stringify([level, i]);
            _this._getTableCache(String("G-" + tableIdx), graph.with.table, function (graphTable) {
                var _a;
                _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(graphTable, "select"), { actionArgs: graph.select, where: _this._buildCombineWhere(graph.on, graph.with.as || graph.with.table, topTable, (_a = {}, _a[topTable] = row, _a)), limit: graph.limit, offset: graph.offset, orderBy: graph.orderBy, groupBy: graph.groupBy, skipQueue: true }), function (row) {
                    graphBuffer.newItem(row);
                }, function () {
                    graphBuffer.finished();
                }, _this._onError);
            });
        }).then(function () {
            onRow(row, index);
        });
    };
    _NanoSQLQuery.prototype._upsert = function (onRow, complete, error) {
        var _this = this;
        if (!this.query.actionArgs) {
            error("Can't upsert without records!");
            this.query.state = "error";
        }
        // nested upsert
        if (this.query.table.indexOf(".") !== -1 || this.query.table.indexOf("[") !== -1) {
            var path = utilities_1.resolvePath(this.query.table);
            this.query.table = path.shift();
            this.upsertPath = path;
        }
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.state === "error")
            return;
        var upsertRecords = Array.isArray(this.query.actionArgs) ? this.query.actionArgs : [this.query.actionArgs];
        var table = this.nSQL.tables[this.query.table];
        ;
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
                error("Cannot upsert multiple records with where condition!");
                return;
            }
            var updatedRecords_1 = 0;
            var upsertBuffer_1 = new utilities_1.NanoSQLBuffer(function (row, i, done, err) {
                updatedRecords_1++;
                _this._updateRow(upsertRecords[0], row, done, err);
            }, error, function () {
                onRow({ result: updatedRecords_1 + " row(s) upserted" }, 0);
                complete();
            });
            this._getRecords(function (row, i) {
                upsertBuffer_1.newItem(row);
            }, function () {
                upsertBuffer_1.finished();
            });
        }
    };
    _NanoSQLQuery.prototype._updateRow = function (newData, oldRow, complete, error) {
        var _this = this;
        this.nSQL.doFilter("updateRow", { result: newData, row: oldRow, query: this.query }).then(function (upsertData) {
            var finalRow = _this.nSQL.default(_this.upsertPath ? utilities_1.deepSet(_this.upsertPath, utilities_1._maybeAssign(oldRow), upsertData) : __assign({}, oldRow, upsertData), _this.query.table);
            if (typeof _this.query.table === "string") {
                _this.nSQL.triggerEvent({
                    target: _this.query.table,
                    path: "*",
                    events: ["upsert", "change", "*"],
                    time: Date.now(),
                    result: finalRow,
                    oldRow: oldRow,
                    actionOrView: _this.query.action || _this.query.view
                });
                Object.keys(_this.nSQL._eventCBs[_this.query.table]).forEach(function (path) {
                    if (path !== "*") {
                        if (!utilities_1.doObjectsEqual(utilities_1.deepGet(path, oldRow), utilities_1.deepGet(path, finalRow))) {
                            _this.nSQL.triggerEvent({
                                target: _this.query.table,
                                path: path,
                                events: ["upsert", "change", "*"],
                                time: Date.now(),
                                result: finalRow,
                                oldRow: oldRow,
                                actionOrView: _this.query.action || _this.query.view
                            });
                        }
                    }
                });
            }
            var newIndexValues = _this._getIndexValues(_this.nSQL.tables[_this.query.table].indexes, finalRow);
            var oldIndexValues = _this._getIndexValues(_this.nSQL.tables[_this.query.table].indexes, oldRow);
            var table = _this.nSQL.tables[_this.query.table];
            utilities_1.allAsync(Object.keys(oldIndexValues).concat(["__pk__"]), function (indexName, i, next, err) {
                if (indexName === "__pk__") { // main row
                    _this.nSQL.adapter.write(_this.query.table, finalRow[table.pkCol], finalRow, function (pk) {
                        finalRow[table.pkCol] = pk;
                        next(null);
                    }, err);
                }
                else { // indexes
                    var idxTable_1 = "_idx_" + _this.query.table + "_" + indexName;
                    if (utilities_1.doObjectsEqual(newIndexValues[indexName], oldIndexValues[indexName]) === false) { // only update changed index values
                        if (table.indexes[indexName].isArray) {
                            var addValues = newIndexValues[indexName].filter(function (v, i, s) { return oldIndexValues[indexName].indexOf(v) === -1; });
                            var removeValues = oldIndexValues[indexName].filter(function (v, i, s) { return newIndexValues[indexName].indexOf(v) === -1; });
                            utilities_1.allAsync([addValues, removeValues], function (arrayOfValues, j, nextValues) {
                                if (!arrayOfValues.length) {
                                    nextValues(null);
                                    return;
                                }
                                utilities_1.allAsync(arrayOfValues, function (value, i, nextArr) {
                                    _this._updateIndex(idxTable_1, value, finalRow[table.pkCol], j === 0, function () {
                                        nextArr(null);
                                    }, err);
                                }).then(nextValues);
                            }).then(next);
                        }
                        else {
                            utilities_1.allAsync(["rm", "add"], function (job, i, nextJob) {
                                switch (job) {
                                    case "add": // add new index value
                                        _this._updateIndex(idxTable_1, newIndexValues[indexName], finalRow[table.pkCol], true, function () {
                                            nextJob(null);
                                        }, err);
                                        break;
                                    case "rm": // remove old index value
                                        _this._updateIndex(idxTable_1, oldIndexValues[indexName], finalRow[table.pkCol], false, function () {
                                            nextJob(null);
                                        }, err);
                                        break;
                                }
                            }).then(next);
                        }
                    }
                    else {
                        next(null);
                    }
                }
            }).then(function () {
                _this.nSQL.doFilter("updatedRow", { newRow: finalRow, oldRow: oldRow, query: _this.query }).then(function () {
                    complete(finalRow);
                });
            });
        }).catch(error);
    };
    _NanoSQLQuery.prototype._updateIndex = function (indexTable, value, pk, addToIndex, done, err) {
        var _this = this;
        var blankIndex = function (id) { return ({ id: id, pks: [] }); };
        this.nSQL.adapter.read(indexTable, value, function (idxRow) {
            var idxRowSet = utilities_1._maybeAssign(idxRow || blankIndex(value));
            var position = idxRowSet.pks.indexOf(pk);
            if (addToIndex) {
                if (position === -1) {
                    idxRowSet.pks.push(pk);
                }
            }
            else {
                if (position === -1) {
                    done();
                    return;
                }
                idxRowSet.pks.splice(position, 1);
            }
            _this.nSQL.adapter.write(indexTable, value, idxRowSet, done, err);
        }, err);
    };
    _NanoSQLQuery.prototype._newRow = function (newRow, complete, error) {
        var _this = this;
        this.nSQL.doFilter("addRow", { result: newRow, query: this.query }).then(function (rowToAdd) {
            var table = _this.nSQL.tables[_this.query.table];
            rowToAdd = _this.nSQL.default(utilities_1._maybeAssign(_this.upsertPath ? utilities_1.deepSet(_this.upsertPath, {}, rowToAdd) : rowToAdd), _this.query.table);
            var indexValues = _this._getIndexValues(_this.nSQL.tables[_this.query.table].indexes, rowToAdd);
            _this.nSQL.adapter.write(_this.query.table, rowToAdd[table.pkCol], rowToAdd, function (pk) {
                rowToAdd[table.pkCol] = pk;
                utilities_1.allAsync(Object.keys(indexValues), function (indexName, i, next, err) {
                    var idxTable = "_idx_" + _this.query.table + "_" + indexName;
                    if (table.indexes[indexName].isArray) {
                        var arrayOfValues = indexValues[indexName] || [];
                        utilities_1.allAsync(arrayOfValues, function (value, i, nextArr) {
                            _this._updateIndex(idxTable, value, rowToAdd[table.pkCol], true, function () {
                                next(null);
                            }, err);
                        }).then(next);
                    }
                    else {
                        _this._updateIndex(idxTable, indexValues[indexName], rowToAdd[table.pkCol], true, function () {
                            next(null);
                        }, err);
                    }
                }).then(function () {
                    _this.nSQL.doFilter("updatedRow", { newRow: rowToAdd, query: _this.query }).then(function () {
                        complete(rowToAdd);
                    });
                });
            }, error);
        }).catch(error);
    };
    _NanoSQLQuery.prototype._delete = function (onRow, complete, error) {
        var _this = this;
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.state === "error")
            return;
        var delRows = 0;
        var table = this.nSQL.tables[this.query.table];
        var deleteBuffer = new utilities_1.NanoSQLBuffer(function (row, i, done, err) {
            delRows++;
            _this.nSQL.doFilter("deleteRow", { result: row, query: _this.query }).then(function (delRow) {
                var indexValues = _this._getIndexValues(table.indexes, row);
                if (typeof _this.query.table === "string") {
                    _this.nSQL.triggerEvent({
                        target: _this.query.table,
                        path: "_all_",
                        events: ["change", "delete", "*"],
                        time: Date.now(),
                        result: row,
                        actionOrView: _this.query.action || _this.query.view
                    });
                }
                utilities_1.allAsync(Object.keys(indexValues).concat(["__del__"]), function (indexName, i, next) {
                    if (indexName === "__del__") { // main row
                        _this.nSQL.adapter.delete(_this.query.table, delRow[table.pkCol], function () {
                            next(null);
                        }, function (err) {
                            _this.query.state = "error";
                            error(err);
                        });
                    }
                    else { // secondary indexes
                        var idxTable_2 = "_idx_" + _this.query.table + "_" + indexName;
                        if (table.indexes[indexName].isArray) {
                            var arrayOfValues = indexValues[indexName] || [];
                            utilities_1.allAsync(arrayOfValues, function (value, i, nextArr) {
                                _this._updateIndex(idxTable_2, value, row[table.pkCol], false, function () {
                                    nextArr(null);
                                }, error);
                            }).then(next);
                        }
                        else {
                            _this._updateIndex(idxTable_2, indexValues[indexName], row[table.pkCol], false, function () {
                                next(null);
                            }, function (err) {
                                _this.query.state = "error";
                                error(err);
                            });
                        }
                    }
                }).then(done).catch(err);
            }).catch(err);
        }, error, function () {
            onRow({ result: delRows + " row(s) deleted" }, 0);
            complete();
        });
        this._getRecords(function (row, i) {
            deleteBuffer.newItem(row);
        }, function () {
            deleteBuffer.finished();
        });
    };
    _NanoSQLQuery.prototype._getIndexValues = function (indexes, row) {
        var _this = this;
        return Object.keys(indexes).reduce(function (prev, cur) {
            var value = utilities_1.deepGet(indexes[cur].path, row);
            var type = indexes[cur].type;
            prev[cur] = indexes[cur].isArray ? (Array.isArray(value) ? value : []).map(function (v) { return _this.nSQL.indexTypes[type](v); }) : _this.nSQL.indexTypes[type](value);
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
    _NanoSQLQuery.prototype._combineRows = function (rData) {
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
    ;
    _NanoSQLQuery.prototype._streamAS = function (row) {
        var _this = this;
        if (this._selectArgs.length) {
            var result_1 = {};
            this._selectArgs.forEach(function (arg) {
                var _a;
                if (arg.isFn) {
                    if (!_this.nSQL.functions[arg.value]) {
                        _this.query.state = "error";
                        _this.error("Function " + arg.value + " not found!");
                        return;
                    }
                    result_1[arg.as || arg.value] = (_a = _this.nSQL.functions[arg.value]).call.apply(_a, [_this.query, row, {}].concat((arg.args || []))).result;
                }
                else {
                    result_1[arg.as || arg.value] = utilities_1.deepGet(arg.value, row);
                }
            });
            return this.query.join ? this._combineRows(result_1) : result_1;
        }
        return this.query.join ? this._combineRows(row) : row;
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
            var A = utilities_1.deepGet(cur.path, objA);
            var B = utilities_1.deepGet(cur.path, objB);
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
    _NanoSQLQuery.prototype._createTable = function (table, complete, error) {
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
            table.model = table.model.map(function (k) { return (__assign({}, k, { key: k.key.replace(/\s+/g, "-") })); });
            if (hasError)
                return;
            res();
        }).then(function () {
            return _this.nSQL.doFilter("createTable", { result: table, query: _this.query });
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
                var newConfigs = {};
                var pkType = table.model.reduce(function (p, c) {
                    if (c.props && c.props.indexOf("pk()") !== -1)
                        return c.key.split(":")[1];
                    return p;
                }, "");
                newConfigs[table.name] = {
                    model: computedDataModel,
                    columns: generateColumns(computedDataModel),
                    actions: table.actions || [],
                    views: table.views || [],
                    indexes: (table.indexes || []).map(function (i) { return ({
                        name: i.name.replace(/\W/g, '').replace(/\s+/g, "-").toLowerCase(),
                        type: (i.key.split(":")[1] || "string").replace(/\[\]/gmi, ""),
                        isArray: (i.key.split(":")[1] || "string").indexOf("[]") !== -1,
                        path: utilities_1.resolvePath(i.key.split(":")[0])
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
                            p[c.name] = c;
                        }
                        return p;
                    }, {}),
                    pkType: pkType,
                    pkCol: table.model.reduce(function (p, c) {
                        if (c.props && c.props.indexOf("pk()") !== -1)
                            return c.key.split(":")[0];
                        return p;
                    }, ""),
                    isPkNum: ["number", "int", "float"].indexOf(pkType) !== -1,
                    ai: table.model.reduce(function (p, c) {
                        if (c.props && c.props.indexOf("pk()") !== -1 && c.props.indexOf("ai()") !== -1)
                            return true;
                        return p;
                    }, false)
                };
                // no primary key found, set one
                if (newConfigs[table.name].pkCol === "") {
                    newConfigs[table.name].pkCol = "_id_";
                    newConfigs[table.name].pkType = "uuid";
                    newConfigs[table.name].model.unshift({ key: "_id_:uuid", props: ["pk()"] });
                    newConfigs[table.name].columns = generateColumns(newConfigs[table.name].model);
                }
                if (hasError)
                    return;
                var addTables = [table.name];
                Object.keys(newConfigs[table.name].indexes).forEach(function (k, i) {
                    var index = newConfigs[table.name].indexes[k];
                    var indexName = "_idx_" + table.name + "_" + index.name;
                    addTables.push(indexName);
                    newConfigs[indexName] = {
                        model: [
                            { key: "id:" + (index.type || "string"), props: ["pk()"] },
                            { key: "pks:" + newConfigs[table.name].pkType + "[]" }
                        ],
                        columns: [
                            { key: "id", type: index.type || "string" },
                            { key: "pks", type: newConfigs[table.name].pkType + "[]" }
                        ],
                        actions: [],
                        views: [],
                        indexes: {},
                        isPkNum: ["number", "int", "float"].indexOf(index.type || "string") !== -1,
                        pkType: index.type,
                        pkCol: "id",
                        ai: false
                    };
                });
                utilities_1.allAsync(addTables, function (table, i, next, err) {
                    _this.nSQL.adapter.createAndInitTable(table, _this.nSQL.tables[table], next, err);
                }).then(function () {
                    Object.keys(newConfigs).forEach(function (tableName) {
                        _this.nSQL.tables[tableName] = newConfigs[tableName];
                    });
                    res();
                }).catch(rej);
            }).then(complete).catch(error);
        });
    };
    _NanoSQLQuery.prototype._alterTable = function (table, complete, error) {
        var _this = this;
        this.nSQL.doFilter("alterTable", { result: table, query: this.query }).then(function (alteredTable) {
            var tablesToAlter = [alteredTable.name];
            Object.keys(_this.nSQL.tables[table.name].indexes).forEach(function (indexName) {
                tablesToAlter.push("_idx_" + alteredTable.name + "_" + indexName);
            });
            utilities_1.allAsync(tablesToAlter, function (dropTable, i, next, err) {
                _this.nSQL.adapter.disconnectTable(alteredTable.name, next, err);
            }).then(function () {
                _this._createTable(alteredTable, complete, error);
            }).catch(error);
        }).catch(error);
    };
    _NanoSQLQuery.prototype._dropTable = function (table, complete, error) {
        var _this = this;
        this.nSQL.doFilter("destroyTable", { result: table, query: this.query }).then(function (destroyTable) {
            var tablesToDrop = [destroyTable];
            tablesToDrop.forEach(function (table) {
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
    _NanoSQLQuery.prototype._resolveFastWhere = function (onlyGetPKs, fastWhere, isReversed, onRow, complete) {
        var _this = this;
        // function
        if (fastWhere.index && fastWhere.fnName) {
            this.nSQL.functions[fastWhere.fnName].queryIndex(this.nSQL, this, fastWhere, onlyGetPKs, onRow, complete, this._onError);
            return;
        }
        // primary key or secondary index
        var isPKquery = fastWhere.index === "_pk_";
        var pkCol = this.nSQL.tables[this.query.table].pkCol;
        var indexTable = "_idx_" + this.query.table + "_" + fastWhere.index;
        var results = 0;
        var count = 0;
        var isComplete = false;
        var maybeComplete = function () {
            if (isComplete && results === 0) {
                complete();
            }
        };
        var onIndexRow = function (row, finished) {
            if (isPKquery) { // primary key select
                onRow(onlyGetPKs ? row[pkCol] : row, 0);
                finished();
            }
            else { // secondary index
                if (onlyGetPKs) {
                    (row.pks || []).forEach(function (pk, i) {
                        onRow(pk, count);
                        count++;
                    });
                    finished();
                }
                else {
                    utilities_1.allAsync(row.pks, function (pk, j, next) {
                        _this.nSQL.adapter.read(_this.query.table, pk, function (row) {
                            if (row) {
                                onRow(row, count);
                                count++;
                            }
                            next(null);
                        }, _this.error);
                    }).then(finished);
                }
            }
        };
        if (fastWhere.indexArray) {
            // Primary keys cannot be array indexes
            switch (fastWhere.comp) {
                case "INCLUDES":
                    this.nSQL.adapter.read(indexTable, fastWhere.value, function (row) {
                        onIndexRow(row, complete);
                    }, this.error);
                    break;
                case "INTERSECT ALL":
                case "INTERSECT":
                    var PKS_1 = {};
                    var maxI_1 = 0;
                    utilities_1.allAsync((fastWhere.value || []), function (pk, j, next) {
                        _this.nSQL.adapter.read(indexTable, pk, function (row) {
                            maxI_1 = j + 1;
                            if (row) {
                                (row.pks || []).forEach(function (rowPK) {
                                    PKS_1[rowPK] = (PKS_1[rowPK] || 0) + 1;
                                });
                            }
                            next(null);
                        }, _this.error);
                    }).then(function () {
                        onIndexRow({
                            pks: fastWhere.comp === "INTERSECT" ? Object.keys(PKS_1) : Object.keys(PKS_1).filter(function (k) { return PKS_1[k] === maxI_1; })
                        }, complete);
                    });
                    break;
            }
        }
        else {
            switch (fastWhere.comp) {
                case "=":
                    if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                        onRow(fastWhere.value, 0);
                        complete();
                    }
                    else {
                        this.nSQL.adapter.read(isPKquery ? this.query.table : indexTable, fastWhere.value, function (row) {
                            onIndexRow(row, complete);
                        }, this.error);
                    }
                    break;
                case "BETWEEN":
                    this.nSQL.adapter.readMulti(isPKquery ? this.query.table : indexTable, "range", fastWhere.value[0], fastWhere.value[1], isReversed, function (row, i) {
                        results++;
                        onIndexRow(row, function () {
                            results--;
                            maybeComplete();
                        });
                    }, function () {
                        isComplete = true;
                        maybeComplete();
                    }, this._onError);
                    break;
                case "IN":
                    var PKS = (isReversed ? fastWhere.value.sort(function (a, b) { return a < b ? 1 : -1; }) : fastWhere.value.sort(function (a, b) { return a > b ? 1 : -1; }));
                    if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                        PKS.forEach(function (pk, i) { return onRow(pk, i); });
                        complete();
                    }
                    else {
                        utilities_1.allAsync(PKS, function (pkRead, ii, nextPK) {
                            _this.nSQL.adapter.read(isPKquery ? _this.query.table : indexTable, pkRead, function (row) {
                                results++;
                                onIndexRow(row, function () {
                                    results--;
                                    maybeComplete();
                                    nextPK(null);
                                });
                            }, _this.error);
                        }).then(function () {
                            isComplete = true;
                            maybeComplete();
                        });
                    }
            }
        }
    };
    _NanoSQLQuery.prototype._fastQuery = function (onRow, complete) {
        var _this = this;
        if (this._whereArgs.fastWhere) {
            if (this._whereArgs.fastWhere.length === 1) { // single where
                var fastWhere = this._whereArgs.fastWhere[0];
                var isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";
                this._resolveFastWhere(false, fastWhere, isReversed, onRow, complete);
            }
            else { // multiple conditions
                var indexBuffer_1 = {};
                var maxI_2 = 0;
                utilities_1.chainAsync(this._whereArgs.fastWhere, function (fastWhere, i, next) {
                    if (i % 2 === 1) { // should be AND
                        next();
                        return;
                    }
                    maxI_2 = i;
                    var addIndexBuffer = function (pk) {
                        indexBuffer_1[pk] = (indexBuffer_1[pk] || 0) + 1;
                    };
                    _this._resolveFastWhere(true, fastWhere, false, addIndexBuffer, next);
                }).then(function () {
                    var getPKs = [];
                    Object.keys(indexBuffer_1).forEach(function (PK) {
                        if (indexBuffer_1[PK] === maxI_2) {
                            getPKs.push(PK);
                        }
                    });
                    _this._resolveFastWhere(false, {
                        index: "_pk_",
                        col: _this.nSQL.tables[_this.query.table].pkCol,
                        comp: "IN",
                        value: getPKs
                    }, false, onRow, complete);
                });
            }
        }
    };
    _NanoSQLQuery.prototype._getRecords = function (onRow, complete) {
        var _this = this;
        var scanRecords = function (rows) {
            var i = 0;
            while (i < rows.length - 1) {
                if (_this._whereArgs.type !== interfaces_1.IWhereType.none) {
                    if (_this._whereArgs.whereFn) {
                        if (_this._whereArgs.whereFn(rows[i], i)) {
                            onRow(rows[i], i);
                        }
                    }
                    else {
                        if (_this._where(rows[i], _this._whereArgs.slowWhere)) {
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
                        if (_this._where(row, _this._whereArgs.slowWhere)) {
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
                            if (_this._where(row, _this._whereArgs.slowWhere)) {
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
    _NanoSQLQuery.prototype._rebuildIndexes = function (progress, complete, error) {
        var _this = this;
        var rebuildTables = this.query.actionArgs ? (Array.isArray(this.query.actionArgs) ? this.query.actionArgs : [this.query.actionArgs]) : [this.query.table];
        if (rebuildTables.filter(function (s) { return typeof s !== "string"; }).length > 0) {
            this.query.state = "error";
            error("No valid table found to rebuild indexes!");
            return;
        }
        utilities_1.allAsync(rebuildTables, function (table, i, nextTable, err) {
            if (!_this.nSQL.tables[table]) {
                err(new Error("Table " + table + " not found for rebuilding indexes!"));
                return;
            }
            var indexes = Object.keys(_this.nSQL.tables[table].indexes).map(function (r) { return "_idx_" + table + "_" + r; });
            utilities_1.allAsync(indexes, function (indexTable, j, nextIndex, indexErr) {
                _this.nSQL.adapter.dropTable(indexTable, function () {
                    _this.nSQL.adapter.createAndInitTable(indexTable, _this.nSQL.tables[indexTable], function () {
                        nextIndex(null);
                    }, indexErr);
                }, indexErr);
            }).then(function () {
                // indexes are now empty
                var readBuffer = new utilities_1.NanoSQLBuffer(function (row, i, complete, err) {
                    _this._newRow(row, function (finishedRow) {
                        progress({ table: table, row: finishedRow }, i);
                        complete();
                    }, err);
                }, error, function () {
                    nextTable(null);
                });
                _this.nSQL.adapter.readMulti(table, "all", undefined, undefined, false, function (row, i) {
                    readBuffer.newItem(row);
                }, function () {
                    readBuffer.finished();
                }, err);
            }).catch(err);
        }).then(complete).catch(error);
    };
    _NanoSQLQuery.prototype._where = function (singleRow, where) {
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
                        compareResult = this._where(singleRow, wArg);
                    }
                    else {
                        compareResult = this._compare(wArg, singleRow);
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
                idx++;
            }
            return matches;
        }
        else { // single where statement
            return this._compare(where[0], singleRow);
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
    _NanoSQLQuery.prototype._getColValue = function (where, wholeRow) {
        var _a;
        if (where.fnName) {
            return (_a = this.nSQL.functions[where.fnName]).call.apply(_a, [this.query, wholeRow, this.nSQL.functions[where.fnName].aggregateStart || { result: undefined }].concat((where.fnArgs || [])));
        }
        else {
            return utilities_1.deepGet(where.col, wholeRow);
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
    _NanoSQLQuery.prototype._compare = function (where, wholeRow) {
        var columnValue = this._getColValue(where, wholeRow);
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
            case "=": return utilities_1.doObjectsEqual(givenValue, columnValue);
            // if column not equal to given value. Supports arrays, objects and primitives
            case "!=": return !utilities_1.doObjectsEqual(givenValue, columnValue);
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
        var result = sort.map(function (o) { return o.split(" ").map(function (s) { return s.trim(); }); }).reduce(function (p, c) { return p.push({ path: utilities_1.resolvePath(c[0]), dir: (c[1] || "asc").toUpperCase() }), p; }, []);
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
                    if (utilities_1.doObjectsEqual(this.nSQL.tables[this.query.table].indexes[indexKeys[i]], result[0].path)) {
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
            canUseOrderByIndex = this._orderBy.index.length && this._whereArgs.fastWhere && utilities_1.doObjectsEqual(this._whereArgs.fastWhere[0].col, this._orderBy.sort[0].path) ? true : false;
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
                        var path_1 = doIndex ? utilities_1.resolvePath(w[0]) : [];
                        if (["=", "BETWEEN", "IN"].indexOf(w[1]) !== -1 && doIndex) {
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
                                indexes.forEach(function (index) {
                                    if (isIndexCol_1 === false && utilities_1.doObjectsEqual(index.path, path_1) && index.isArray === false) {
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
                        if (doIndex && !isIndexCol_1 && ["INCLUDES", "INTERSECT", "INTERSECT ALL"].indexOf(w[1]) !== -1) {
                            indexes.forEach(function (index) {
                                if (utilities_1.doObjectsEqual(index.path, path_1) && index.isArray === true) {
                                    isIndexCol_1 = true;
                                    p.push({
                                        index: index.name,
                                        indexArray: true,
                                        col: w[0],
                                        comp: w[1],
                                        value: w[2]
                                    });
                                }
                            });
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
                }
                else {
                    lastFastIndx = count;
                }
            }
            else {
                if (Array.isArray(parsedWhere[count]) || !parsedWhere[count].index) {
                    isIndex = false;
                }
                else {
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
    _NanoSQLQuery._sortMemoized = {};
    _NanoSQLQuery._selectArgsMemoized = {};
    _NanoSQLQuery._whereMemoized = {};
    return _NanoSQLQuery;
}());
exports._NanoSQLQuery = _NanoSQLQuery;
//# sourceMappingURL=query.js.map