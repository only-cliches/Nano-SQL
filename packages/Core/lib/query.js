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
exports.secondaryIndexQueue = {};
var globalTableCache = {};
var MapReduceFilterFn = /** @class */ (function () {
    function MapReduceFilterFn() {
    }
    MapReduceFilterFn.prototype.init = function (nSQL, table, mr) {
        return function (event) {
            nSQL.doFilter("mapReduce", { result: true, table: table, mr: mr }, function (doMR) {
                if (doMR) {
                    nSQL.triggerEvent(event, true);
                    mr.call(event);
                }
            }, function (abort) {
                console.log("Map reduce aborted", abort);
            });
        };
    };
    return MapReduceFilterFn;
}());
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
        this.query.state = "processing";
        this._startTime = Date.now();
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
        var requireQueryOpts = function (requreiAction, cb) {
            if (typeof _this.query.table !== "string") {
                _this.query.state = "error";
                _this.error(_this.query.action + " query requires a string table argument!");
                return;
            }
            if (requreiAction && !_this.query.actionArgs) {
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
        if (!this.query.cacheID) {
            this.query.cacheID = this.query.queryID;
        }
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
                requireQueryOpts(true, function () {
                    _this._createTable(_this.query.actionArgs, finishQuery, _this.error);
                });
                break;
            case "alter table":
                requireQueryOpts(true, function () {
                    _this._alterTable(_this.query.actionArgs, finishQuery, _this.error);
                });
                break;
            case "rebuild indexes":
                requireQueryOpts(false, function () {
                    _this._rebuildIndexes(_this.progress, finishQuery, _this.error);
                });
                break;
            case "conform rows":
                requireQueryOpts(false, function () {
                    _this._conform(_this.progress, finishQuery, _this.error);
                });
                break;
            default:
                this.nSQL.doFilter("customQuery", { result: undefined, query: this, onRow: progress, complete: complete, error: error }, function () {
                    _this.query.state = "error";
                    _this.error("Query type \"" + query.action + "\" not supported!");
                }, function (err) {
                    _this.query.state = "error";
                    _this.error(err);
                });
        }
    }
    _NanoSQLQuery.prototype._conform = function (progress, finished, error) {
        var _this = this;
        var conformTable = this.query.table;
        if (!this.nSQL.tables[conformTable]) {
            error(new Error("Table " + conformTable + " not found for conforming!"));
            return;
        }
        var count = 0;
        var conformQueue = new utilities_1._NanoSQLQueue(function (item, i, done, err) {
            var newRow = _this.nSQL.default(item, conformTable);
            _this.nSQL.doFilter("conformRow", { result: newRow, oldRow: item }, function (setRow) {
                _this._diffUpdates(_this.query.table, item, setRow, function () {
                    if (_this.nSQL.state.hasAnyEvents) {
                        _this.nSQL.triggerEvent({
                            target: conformTable,
                            path: "*",
                            events: ["upsert", "change", "*"],
                            time: Date.now(),
                            performance: Date.now() - _this._startTime,
                            result: setRow,
                            oldRow: item,
                            query: _this.query
                        });
                        Object.keys(_this.nSQL.eventFNs[_this.query.table]).forEach(function (path) {
                            if (path !== "*") {
                                if (!utilities_1._objectsEqual(utilities_1.deepGet(path, item), utilities_1.deepGet(path, setRow))) {
                                    _this.nSQL.triggerEvent({
                                        target: _this.query.table,
                                        path: path,
                                        events: ["upsert", "change", "*"],
                                        time: Date.now(),
                                        performance: Date.now() - _this._startTime,
                                        result: setRow,
                                        oldRow: item,
                                        query: _this.query
                                    }, true);
                                }
                            }
                        });
                    }
                    progress(undefined, i);
                    count++;
                    done();
                }, err);
            }, error);
        }, error, function () {
            progress({ result: "Conformed " + count + " row(s)." }, count);
            finished();
        });
        this._getRecords(function (row, i) {
            conformQueue.newItem(row);
        }, function () {
            conformQueue.finished();
        });
    };
    _NanoSQLQuery.prototype._getTable = function (tableName, whereCond, table, callback) {
        var _this = this;
        var cacheID = this.query.cacheID;
        if (typeof table === "function") {
            if (!globalTableCache[cacheID]) {
                globalTableCache[cacheID] = {};
            }
            if (!globalTableCache[cacheID][tableName]) { // first load
                globalTableCache[cacheID][tableName] = { loading: true, rows: [], cache: true };
                table(whereCond).then(function (result) {
                    var doCache = (result.cache && !result.filtered) || false;
                    globalTableCache[cacheID][tableName] = { loading: false, rows: doCache ? result.rows : [], cache: doCache };
                    callback(result);
                }).catch(this._onError);
                return;
            }
            if (globalTableCache[cacheID][tableName].loading) {
                setTimeout(function () {
                    _this._getTable(tableName, whereCond, table, callback);
                }, 10);
                return;
            }
            if (globalTableCache[cacheID][tableName].cache) {
                callback({ filtered: false, rows: globalTableCache[cacheID][tableName].rows, cache: true });
                return;
            }
            table(whereCond).then(function (result) {
                callback(result);
            }).catch(this._onError);
        }
        else {
            callback({ rows: table, filtered: false, cache: false });
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
            var joinBuffer = new utilities_1._NanoSQLQueue(function (rData, i, rDone, err) {
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
            var queryTable = _this.query.tableAS || _this.query.table;
            var whereCond = join.on && join.type !== "cross" ? _this._buildCombineWhere(join.on, join.with.as || join.with.table, queryTable, rowData) : [];
            _this._getTable(queryTable, whereCond, join.with.table, function (joinTable) {
                var eachRow = function (row) {
                    var _a;
                    joinRowCount++;
                    if (join.type === "right" || join.type === "outer") {
                        // keep track of which right side rows have been joined
                        rightHashes.push(withPK ? row[withPK] : utilities_1.hash(JSON.stringify(row)));
                    }
                    joinBuffer.newItem(__assign({}, rowData, (_a = {}, _a[rightTable] = row, _a)));
                };
                var rowsDone = function () {
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
                            _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(join.with.table, "select"), { skipQueue: true, cacheID: _this.query.cacheID, where: withPK ? [withPK, "NOT IN", rightHashes] : undefined }), function (row) {
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
                };
                if (joinTable.filtered) {
                    joinTable.rows.forEach(eachRow);
                    rowsDone();
                }
                else {
                    _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(joinTable.rows, "select"), { tableAS: join.with.as, cacheID: _this.query.cacheID, where: join.on && join.type !== "cross" ? _this._buildCombineWhere(join.on, join.with.as || join.with.table, queryTable, rowData) : undefined, skipQueue: true }), eachRow, rowsDone, function (err) {
                        _this.query.state = "error";
                        _this.error(err);
                    });
                }
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
                if (_this.query.cacheID && _this.query.cacheID === _this.query.queryID) {
                    delete globalTableCache[_this.query.cacheID];
                }
                complete();
            });
            return;
        }
        var joinData = Array.isArray(this.query.join) ? this.query.join : [this.query.join];
        var joinedRows = 0;
        var graphBuffer = new utilities_1._NanoSQLQueue(function (gRow, ct, nextGraph, err) {
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
                    });
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
            if (_this.query.cacheID && _this.query.cacheID === _this.query.queryID) {
                delete globalTableCache[_this.query.cacheID];
            }
            complete();
        });
        var rowCounter = 0;
        var selectBuffer = new utilities_1._NanoSQLQueue(function (row, ct, next, err) {
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
                _this._graph(_this.query.graph || [], _this.query.tableAS || _this.query.table, row, i, next);
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
                if (_this.query.cacheID && _this.query.cacheID === _this.query.queryID) {
                    delete globalTableCache[_this.query.cacheID];
                }
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
                    performance: Date.now() - _this._startTime,
                    result: row,
                    query: _this.query
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
                return graphWhere(compareRow, rowData);
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
    _NanoSQLQuery.prototype._graph = function (gArgs, topTable, row, index, onRow) {
        var _this = this;
        var graphArgs = Array.isArray(gArgs) ? gArgs : [gArgs];
        if (!graphArgs || graphArgs.length === 0) {
            onRow(row, index);
            return;
        }
        utilities_1.allAsync(graphArgs, function (graph, i, next) {
            var _a;
            var noGraphAs = new Error("Must use 'AS' when graphing temporary tables!");
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
            row[graph.key] = [];
            var whereCond = _this._buildCombineWhere(graph.on, graph.with.as || graph.with.table, topTable, (_a = {}, _a[topTable] = row, _a));
            _this._getTable(graph.with.as || graph.with.table, whereCond, graph.with.table, function (graphTable) {
                if (graphTable.filtered) {
                    graphTable.rows.forEach(function (graphRow) {
                        if (graph.single) {
                            row[graph.key] = graphRow;
                        }
                        else {
                            row[graph.key].push(graphRow);
                        }
                    });
                    next(null);
                }
                else {
                    _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(graphTable.rows, "select"), { tableAS: graph.with.as, actionArgs: graph.select, where: whereCond, limit: graph.limit, offset: graph.offset, orderBy: graph.orderBy, groupBy: graph.groupBy, graph: graph.graph, skipQueue: true, cacheID: _this.query.cacheID }), function (graphRow) {
                        if (graph.single) {
                            row[graph.key] = graphRow;
                        }
                        else {
                            row[graph.key].push(graphRow);
                        }
                    }, function () {
                        next(null);
                    }, _this._onError);
                }
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
        if (this._whereArgs.type === interfaces_1.IWhereType.none) { // insert/update records directly
            utilities_1.allAsync(upsertRecords, function (row, i, next, error) {
                if (row[table.pkCol]) {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).read(_this.query.table, row[table.pkCol], function (oldRow) {
                        if (oldRow) {
                            _this._updateRow(row, oldRow, next, error);
                        }
                        else {
                            _this._newRow(row, next, error);
                        }
                    }, error);
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
            var upsertBuffer_1 = new utilities_1._NanoSQLQueue(function (row, i, done, err) {
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
        this.nSQL.doFilter("updateRow", { result: newData, row: oldRow, query: this.query }, function (upsertData) {
            var finalRow = _this.nSQL.default(_this.upsertPath ? utilities_1.deepSet(_this.upsertPath, utilities_1._maybeAssign(oldRow), upsertData) : __assign({}, oldRow, upsertData), _this.query.table);
            _this._diffUpdates(_this.query.table, oldRow, finalRow, function () {
                if (typeof _this.query.table === "string") {
                    _this.nSQL.triggerEvent({
                        target: _this.query.table,
                        path: "*",
                        events: ["upsert", "change", "*"],
                        time: Date.now(),
                        performance: Date.now() - _this._startTime,
                        result: finalRow,
                        oldRow: oldRow,
                        query: _this.query
                    });
                    if (_this.nSQL.eventFNs[_this.query.table]) {
                        Object.keys(_this.nSQL.eventFNs[_this.query.table]).forEach(function (path) {
                            if (path !== "*") {
                                if (!utilities_1._objectsEqual(utilities_1.deepGet(path, oldRow), utilities_1.deepGet(path, finalRow))) {
                                    _this.nSQL.triggerEvent({
                                        target: _this.query.table,
                                        path: path,
                                        events: ["upsert", "change", "*"],
                                        time: Date.now(),
                                        performance: Date.now() - _this._startTime,
                                        result: finalRow,
                                        oldRow: oldRow,
                                        query: _this.query
                                    }, true);
                                }
                            }
                        });
                    }
                }
                complete(finalRow);
            }, error);
        }, error);
    };
    _NanoSQLQuery.prototype._diffUpdates = function (queryTable, oldRow, finalRow, done, error) {
        var _this = this;
        var newIndexValues = this._getIndexValues(this.nSQL.tables[this.query.table].indexes, finalRow);
        var oldIndexValues = this._getIndexValues(this.nSQL.tables[this.query.table].indexes, oldRow);
        var table = this.nSQL.tables[queryTable];
        utilities_1.allAsync(Object.keys(oldIndexValues).concat(["__pk__"]), function (indexName, i, next, err) {
            if (indexName === "__pk__") { // main row
                utilities_1.adapterFilters(_this.nSQL, _this.query).write(queryTable, finalRow[table.pkCol], finalRow, function (pk) {
                    finalRow[table.pkCol] = pk;
                    next(null);
                }, err);
            }
            else { // indexes
                var idxTable_1 = "_idx_" + _this.query.table + "_" + indexName;
                if (utilities_1._objectsEqual(newIndexValues[indexName], oldIndexValues[indexName]) === false) { // only update changed index values
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
        }).then(done).catch(error);
    };
    _NanoSQLQuery.prototype._updateIndex = function (indexTable, value, pk, addToIndex, done, err) {
        exports.secondaryIndexQueue[this.nSQL.state.id + this.query.table].newItem({ indexTable: indexTable, value: value, pk: pk, addToIndex: addToIndex, done: done, err: err, query: this.query, nSQL: this.nSQL }, function (item, done, error) {
            var blankIndex = function (id) { return ({ id: id, pks: [] }); };
            utilities_1.adapterFilters(item.nSQL, item.query).read(item.indexTable, item.value, function (idxRow) {
                var idxRowSet = utilities_1._maybeAssign(idxRow || blankIndex(item.value));
                var position = idxRowSet.pks.indexOf(item.pk);
                if (item.addToIndex) {
                    if (position === -1) {
                        idxRowSet.pks.push(item.pk);
                    }
                }
                else {
                    if (position === -1) {
                        item.done();
                        return;
                    }
                    idxRowSet.pks.splice(position, 1);
                }
                utilities_1.adapterFilters(item.nSQL, item.query).write(item.indexTable, item.value, idxRowSet, function () {
                    item.done();
                    done();
                }, function (err) {
                    item.err();
                    if (error)
                        error(err);
                });
            }, item.err);
        });
    };
    _NanoSQLQuery.prototype._newRow = function (newRow, complete, error) {
        var _this = this;
        this.nSQL.doFilter("addRow", { result: newRow, query: this.query }, function (rowToAdd) {
            var table = _this.nSQL.tables[_this.query.table];
            rowToAdd = _this.nSQL.default(utilities_1._maybeAssign(_this.upsertPath ? utilities_1.deepSet(_this.upsertPath, {}, rowToAdd) : rowToAdd), _this.query.table);
            var indexValues = _this._getIndexValues(_this.nSQL.tables[_this.query.table].indexes, rowToAdd);
            utilities_1.adapterFilters(_this.nSQL, _this.query).write(_this.query.table, rowToAdd[table.pkCol], rowToAdd, function (pk) {
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
                    complete(rowToAdd);
                });
            }, error);
        }, error);
    };
    _NanoSQLQuery.prototype._delete = function (onRow, complete, error) {
        var _this = this;
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.state === "error")
            return;
        var delRows = 0;
        var table = this.nSQL.tables[this.query.table];
        var deleteBuffer = new utilities_1._NanoSQLQueue(function (row, i, done, err) {
            onRow(undefined, delRows);
            delRows++;
            _this._removeRowAndIndexes(table, row, done, err);
        }, error, function () {
            onRow({ result: delRows + " row(s) deleted" }, delRows);
            complete();
        });
        this._getRecords(function (row, i) {
            deleteBuffer.newItem(row);
        }, function () {
            deleteBuffer.finished();
        });
    };
    _NanoSQLQuery.prototype._removeRowAndIndexes = function (table, row, complete, error) {
        var _this = this;
        var indexValues = this._getIndexValues(table.indexes, row);
        this.nSQL.doFilter("deleteRow", { result: row, query: this.query }, function (delRow) {
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
                            _this._updateIndex(idxTable_2, value, delRow[table.pkCol], false, function () {
                                nextArr(null);
                            }, error);
                        }).then(next);
                    }
                    else {
                        _this._updateIndex(idxTable_2, indexValues[indexName], delRow[table.pkCol], false, function () {
                            next(null);
                        }, _this._onError);
                    }
                }
            }).then(function () {
                if (typeof _this.query.table === "string") {
                    _this.nSQL.triggerEvent({
                        target: _this.query.table,
                        path: "_all_",
                        events: ["change", "delete", "*"],
                        time: Date.now(),
                        performance: Date.now() - _this._startTime,
                        result: delRow,
                        query: _this.query
                    });
                }
                complete();
            }).catch(error);
        }, error);
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
            Object.keys(table.model).forEach(function (col) {
                var modelData = col.replace(/\s+/g, "-").split(":"); // [key, type];
                if (modelData.length === 1) {
                    modelData.push("any");
                }
                if (!modelData[0] || modelData[0].match(/[\(\)\]\[\.]/g) !== null || modelData[0].indexOf("_") === 0) {
                    hasError = true;
                    rej("nSQL: Invalid Data Model at " + (table.name + "." + col) + "! https://docs.nanosql.io/setup/data-models");
                }
            });
            if (hasError)
                return;
            res();
        }).then(function () {
            return new Promise(function (res, rej) {
                _this.nSQL.doFilter("configTable", { result: table, query: _this.query }, res, rej);
            });
        }).then(function (table) {
            var setModels = function (dataModel) {
                return Object.keys(dataModel).reduce(function (p, d) {
                    var type = d.split(":")[1] || "any";
                    if (type.indexOf("geo") === 0) {
                        p[d] = {
                            default: { lat: 0, lon: 0 },
                            model: {
                                "lat:float": [],
                                "lon:float": []
                            }
                        };
                    }
                    else if (dataModel[d].model) {
                        p[d] = __assign({}, dataModel[d], { model: setModels(dataModel[d].model) });
                    }
                    else {
                        p[d] = dataModel[d];
                    }
                    return p;
                }, {});
            };
            var generateColumns = function (dataModels) {
                return Object.keys(dataModels).filter(function (d) { return d !== "*"; }).map(function (d) { return ({
                    key: d.split(":")[0],
                    type: d.split(":")[1] || "any",
                    ai: dataModels[d].ai,
                    pk: dataModels[d].pk,
                    default: dataModels[d].default,
                    notNull: dataModels[d].notNull,
                    model: dataModels[d].model ? generateColumns(dataModels[d].model) : undefined
                }); });
            };
            var error = "";
            var computedDataModel = setModels(table.model);
            var newConfigs = {};
            var pkType = Object.keys(table.model).reduce(function (p, c) {
                if (table.model[c] && table.model[c].pk)
                    return c.split(":")[1];
                return p;
            }, "");
            var indexes = table.indexes || {};
            newConfigs[table.name] = {
                model: computedDataModel,
                columns: generateColumns(computedDataModel),
                filter: table.filter,
                mapReduce: table.mapReduce,
                actions: table.actions || [],
                views: table.views || [],
                indexes: Object.keys(indexes).map(function (i) { return ({
                    name: i.replace(/\W/g, "").replace(/\s+/g, "-").toLowerCase().split(":")[0],
                    type: (i.split(":")[1] || "string").replace(/\[\]/gmi, ""),
                    isArray: (i.split(":")[1] || "string").indexOf("[]") !== -1,
                    path: utilities_1.resolvePath(indexes[i])
                }); }).reduce(function (p, c) {
                    var allowedTypes = Object.keys(_this.nSQL.indexTypes);
                    if (allowedTypes.indexOf(c.type) === -1) {
                        error = "Index \"" + c.name + "\" does not have a valid type!";
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
                pkCol: Object.keys(table.model).reduce(function (p, c) {
                    if (table.model[c] && table.model[c].pk)
                        return c.split(":")[0];
                    return p;
                }, ""),
                isPkNum: ["number", "int", "float"].indexOf(pkType) !== -1,
                ai: Object.keys(table.model).reduce(function (p, c) {
                    if (table.model[c] && table.model[c].ai)
                        return true;
                    return p;
                }, false)
            };
            _this.setMapReduce(table);
            // no primary key found, set one
            if (newConfigs[table.name].pkCol === "") {
                newConfigs[table.name].pkCol = "_id";
                newConfigs[table.name].pkType = "uuid";
                newConfigs[table.name].model["_id:uuid"] = { pk: true };
                newConfigs[table.name].columns = generateColumns(newConfigs[table.name].model);
            }
            if (error && error.length)
                return Promise.reject(error);
            var addTables = [table.name];
            Object.keys(newConfigs[table.name].indexes).forEach(function (k, i) {
                var _a;
                var index = newConfigs[table.name].indexes[k];
                var indexName = "_idx_" + table.name + "_" + index.name;
                addTables.push(indexName);
                newConfigs[indexName] = {
                    model: (_a = {},
                        _a["id:" + (index.type || "string")] = { pk: true },
                        _a["pks:" + newConfigs[table.name].pkType + "[]"] = {},
                        _a),
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
            exports.secondaryIndexQueue[_this.nSQL.state.id + table.name] = new utilities_1._NanoSQLQueue();
            return utilities_1.allAsync(addTables, function (table, i, next, err) {
                _this.nSQL.doFilter("addTable", { result: { name: table, conf: newConfigs[table] }, query: _this.query }, function (newTable) {
                    if (!newTable) {
                        next(null);
                        return;
                    }
                    _this.nSQL.adapter.createAndInitTable(newTable.name, newTable.conf, function () {
                        _this.nSQL.tables[newTable.name] = newTable.conf;
                        next(null);
                    }, err);
                }, err);
            });
        }).then(function () {
            _this.updateMRTimer();
            complete();
        }).catch(error);
    };
    _NanoSQLQuery.prototype.setMapReduce = function (newTableConfig, oldConfig) {
        var _this = this;
        var table = this.query.table;
        if (typeof table !== "string")
            return;
        if (!this.nSQL.state.runMR[table]) {
            this.nSQL.state.runMR[table] = {};
        }
        if (oldConfig && oldConfig.mapReduce) {
            oldConfig.mapReduce.forEach(function (mr) {
                if (mr.onEvents) {
                    mr.onEvents.forEach(function (event) {
                        _this.nSQL.off(event, _this.nSQL.state.runMR[table][mr.name]);
                    });
                }
            });
        }
        if (newTableConfig && newTableConfig.mapReduce) {
            newTableConfig.mapReduce.forEach(function (mr) {
                if (!_this.nSQL.state.runMR[table][mr.name]) {
                    if (mr.throttle) {
                        _this.nSQL.state.runMR[table][mr.name] = utilities_1.throttle(_this, new MapReduceFilterFn().init(_this.nSQL, table, mr), mr.throttle);
                    }
                    else {
                        _this.nSQL.state.runMR[table][mr.name] = new MapReduceFilterFn().init(_this.nSQL, table, mr);
                    }
                }
                if (mr.onEvents) {
                    mr.onEvents.forEach(function (event) {
                        _this.nSQL.on(event, _this.nSQL.state.runMR[table][mr.name]);
                    });
                }
            });
        }
    };
    _NanoSQLQuery.prototype.updateMRTimer = function () {
        var _this = this;
        var hasTimer = false;
        Object.keys(this.nSQL.tables).forEach(function (table) {
            (_this.nSQL.tables[table].mapReduce || []).forEach(function (mr) {
                if (mr.onTimes) {
                    hasTimer = true;
                }
            });
        });
        if (hasTimer) {
            if (!this.nSQL.state.MRTimer) {
                this.nSQL.state.MRTimer = setInterval(this.nSQL.triggerMapReduce, 1000);
            }
        }
        else {
            clearInterval(this.nSQL.state.MRTimer);
            this.nSQL.state.MRTimer = undefined;
        }
    };
    _NanoSQLQuery.prototype._alterTable = function (table, complete, error) {
        var _this = this;
        this.nSQL.doFilter("alterTable", { result: table, query: this.query }, function (alteredTable) {
            if (!alteredTable) {
                complete();
                return;
            }
            var tablesToAlter = [alteredTable.name];
            Object.keys(_this.nSQL.tables[table.name].indexes).forEach(function (indexName) {
                tablesToAlter.push("_idx_" + alteredTable.name + "_" + indexName);
            });
            _this.setMapReduce(undefined, _this.nSQL.tables[_this.query.table]);
            utilities_1.allAsync(tablesToAlter, function (dropTable, i, next, err) {
                _this.nSQL.adapter.disconnectTable(alteredTable.name, next, err);
            }).then(function () {
                _this._createTable(alteredTable, complete, error);
            }).catch(error);
        }, error);
    };
    _NanoSQLQuery.prototype._dropTable = function (table, complete, error) {
        var _this = this;
        this.nSQL.doFilter("dropTable", { result: table, query: this.query }, function (destroyTable) {
            if (!destroyTable) {
                complete();
                return;
            }
            var tablesToDrop = [destroyTable];
            tablesToDrop.forEach(function (table) {
                Object.keys(_this.nSQL.tables[table].indexes).forEach(function (indexName) {
                    tablesToDrop.push("_idx_" + table + "_" + indexName);
                });
            });
            _this.setMapReduce(undefined, _this.nSQL.tables[_this.query.table]);
            utilities_1.allAsync(tablesToDrop, function (dropTable, i, next, err) {
                _this.nSQL.adapter.dropTable(dropTable, function () {
                    delete _this.nSQL.tables[dropTable];
                    next(dropTable);
                }, err);
            }).then(function () {
                complete();
                _this.updateMRTimer();
            }).catch(error);
        }, error);
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
            if (!row) {
                finished();
                return;
            }
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
                        utilities_1.adapterFilters(_this.nSQL, _this.query).read(_this.query.table, pk, function (row) {
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
                    utilities_1.adapterFilters(this.nSQL, this.query).read(indexTable, fastWhere.value, function (row) {
                        onIndexRow(row, complete);
                    }, this.error);
                    break;
                case "INTERSECT ALL":
                case "INTERSECT":
                    var PKS_1 = {};
                    var maxI_1 = 0;
                    utilities_1.allAsync((fastWhere.value || []), function (pk, j, next) {
                        utilities_1.adapterFilters(_this.nSQL, _this.query).read(indexTable, pk, function (row) {
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
                        utilities_1.adapterFilters(this.nSQL, this.query).read(isPKquery ? this.query.table : indexTable, fastWhere.value, function (row) {
                            onIndexRow(row, complete);
                        }, this.error);
                    }
                    break;
                case "BETWEEN":
                    utilities_1.adapterFilters(this.nSQL, this.query).readMulti(isPKquery ? this.query.table : indexTable, "range", fastWhere.value[0], fastWhere.value[1], isReversed, function (row, i) {
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
                            utilities_1.adapterFilters(_this.nSQL, _this.query).read(isPKquery ? _this.query.table : indexTable, pkRead, function (row) {
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
            while (i < rows.length) {
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
                    utilities_1.adapterFilters(this.nSQL, this.query).readMulti(this.query.table, "all", undefined, undefined, isReversed, function (row, i) {
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
            this._getTable(this.query.tableAS || this.query.table, this.query.where, this.query.table, function (result) {
                scanRecords(result.rows);
            });
        }
        else if (Array.isArray(this.query.table)) { // array
            scanRecords(this.query.table);
        }
    };
    _NanoSQLQuery.prototype._rebuildIndexes = function (progress, complete, error) {
        var _this = this;
        var rebuildTables = this.query.table;
        if (!this.nSQL.tables[rebuildTables]) {
            error(new Error("Table " + rebuildTables + " not found for rebuilding indexes!"));
            return;
        }
        var indexes = Object.keys(this.nSQL.tables[rebuildTables].indexes).map(function (r) { return "_idx_" + rebuildTables + "_" + r; });
        if (this.query.where) { // rebuild only select rows (cant clean/remove index tables)
            var count_2 = 0;
            var readQueue_1 = new utilities_1._NanoSQLQueue(function (item, i, complete, error) {
                _this._removeRowAndIndexes(_this.nSQL.tables[rebuildTables], item, function () {
                    _this._newRow(item, complete, error);
                    progress(undefined, count_2);
                    count_2++;
                }, error);
            }, error, function () {
                complete();
                progress({ result: "Rebuilt " + count_2 + " row indexes." }, count_2);
            });
            this._getRecords(function (row) {
                readQueue_1.newItem(row);
            }, function () {
                readQueue_1.finished();
            });
        }
        else { // empty indexes and start from scratch
            utilities_1.allAsync(indexes, function (indexTable, j, nextIndex, indexErr) {
                _this.nSQL.adapter.dropTable(indexTable, function () {
                    _this.nSQL.adapter.createAndInitTable(indexTable, _this.nSQL.tables[indexTable], function () {
                        nextIndex(null);
                    }, indexErr);
                }, indexErr);
            }).then(function () {
                // indexes are now empty
                var count = 0;
                exports.secondaryIndexQueue[_this.nSQL.state.id + rebuildTables].newItem(utilities_1.uuid(), function (item, buffComplete, buffErr) {
                    var readQueue = new utilities_1._NanoSQLQueue(function (row, i, complete, err) {
                        _this._newRow(row, function (finishedRow) {
                            count++;
                            progress(undefined, i);
                            complete();
                        }, err);
                    }, error, function () {
                        progress({ result: "Rebuilt " + count + " row indexes." }, count);
                        complete();
                        buffComplete();
                    });
                    _this._getRecords(function (row) {
                        readQueue.newItem(row);
                    }, function () {
                        readQueue.finished();
                    });
                });
            }).catch(error);
        }
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
            case "=": return utilities_1._objectsEqual(givenValue, columnValue);
            // if column not equal to given value. Supports arrays, objects and primitives
            case "!=": return !utilities_1._objectsEqual(givenValue, columnValue);
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
            case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] >= columnValue;
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
                    if (utilities_1._objectsEqual(this.nSQL.tables[this.query.table].indexes[indexKeys[i]], result[0].path)) {
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
            canUseOrderByIndex = this._orderBy.index.length && this._whereArgs.fastWhere && utilities_1._objectsEqual(this._whereArgs.fastWhere[0].col, this._orderBy.sort[0].path) ? true : false;
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
                                    if (isIndexCol_1 === false && utilities_1._objectsEqual(index.path, path_1) && index.isArray === false) {
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
                                if (utilities_1._objectsEqual(index.path, path_1) && index.isArray === true) {
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