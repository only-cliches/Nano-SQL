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
// tslint:disable-next-line
var _nanoSQLQuery = /** @class */ (function () {
    function _nanoSQLQuery(nSQL, query, progress, complete, error) {
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
        this._indexesUsed = [];
        this._startTime = Date.now();
        var action = query.action.toLowerCase().trim();
        this._orderByRows = this._orderByRows.bind(this);
        this._onError = this._onError.bind(this);
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
            case "describe indexes":
                this._describe("idx");
                break;
            case "drop":
            case "drop table":
                this._dropTable(this.query.table, finishQuery, this.error);
                break;
            case "create table":
            case "create table if not exists":
                requireQueryOpts(true, function () {
                    _this._createTable(_this.query.actionArgs, false, finishQuery, _this.error);
                });
                break;
            case "alter table":
                requireQueryOpts(true, function () {
                    _this._createTable(_this.query.actionArgs, true, finishQuery, _this.error);
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
                this.nSQL.doFilter("customQuery", { res: undefined, query: this.query, onRow: progress, complete: complete, error: error }, function () {
                    _this.query.state = "error";
                    _this.error("Query type \"" + query.action + "\" not supported!");
                }, function (err) {
                    _this.query.state = "error";
                    _this.error(err);
                });
        }
    }
    _nanoSQLQuery.prototype._conform = function (progress, finished, error) {
        var _this = this;
        var conformTable = this.query.table;
        var conformFilter = this.query.actionArgs || function (r) { return r; };
        if (!this.nSQL._tables[conformTable]) {
            error(new Error("Table " + conformTable + " not found for conforming!"));
            return;
        }
        var count = 0;
        var conformQueue = new utilities_1._nanoSQLQueue(function (item, i, done, err) {
            var newRow = _this.nSQL.default(item, conformTable);
            _this.nSQL.doFilter("conformRow", { res: newRow, oldRow: item, query: _this.query }, function (setRow) {
                _this._diffUpdates(_this.query.table, item, setRow.res, function () {
                    var changeEvent = {
                        target: conformTable,
                        path: "*",
                        events: ["upsert", "change", "*"],
                        time: Date.now(),
                        performance: Date.now() - _this._startTime,
                        result: setRow.res,
                        oldRow: item,
                        query: _this.query,
                        indexes: _this._indexesUsed
                    };
                    if (_this.nSQL.state.hasAnyEvents) {
                        _this.nSQL.triggerEvent(changeEvent);
                        Object.keys(_this.nSQL.eventFNs[_this.query.table]).forEach(function (path) {
                            if (path !== "*") {
                                if (!utilities_1.objectsEqual(utilities_1.deepGet(path, item), utilities_1.deepGet(path, setRow.res))) {
                                    _this.nSQL.triggerEvent({
                                        target: _this.query.table,
                                        path: path,
                                        events: ["upsert", "change", "*"],
                                        time: Date.now(),
                                        performance: Date.now() - _this._startTime,
                                        result: setRow.res,
                                        oldRow: item,
                                        query: _this.query,
                                        indexes: _this._indexesUsed
                                    }, true);
                                }
                            }
                        });
                    }
                    progress(_this.query.returnEvent ? changeEvent : setRow.res, i);
                    count++;
                    done();
                }, err);
            }, error);
        }, error, function () {
            finished();
        });
        this._getRecords(function (row, i) {
            conformQueue.newItem(conformFilter(row));
        }, function () {
            conformQueue.finished();
        }, error);
    };
    _nanoSQLQuery.prototype._getTable = function (tableName, whereCond, table, callback) {
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
    _nanoSQLQuery.prototype._maybeJoin = function (joinData, leftRow, onRow, complete) {
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
            var joinBuffer = new utilities_1._nanoSQLQueue(function (rData, i, rDone, err) {
                if (!joinData[joinIdx + 1]) { // no more joins, send joined row
                    onRow(rData);
                    rDone();
                }
                else { // more joins, nest on!
                    doJoin(rData, joinIdx + 1, rDone);
                }
            }, _this.error, joinDone);
            var withPK = typeof join.with.table === "string" ? _this.nSQL._tables[join.with.table].pkCol : [];
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
                        rightHashes.push(withPK ? utilities_1.deepGet(withPK, row) : utilities_1.hash(JSON.stringify(row)));
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
                            _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, join.with.table, "select"), { skipQueue: true, cacheID: _this.query.cacheID, where: withPK ? [withPK, "NOT IN", rightHashes] : undefined }), function (row) {
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
                    _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, joinTable.rows, "select"), { tableAS: join.with.as, cacheID: _this.query.cacheID, where: join.on && join.type !== "cross" ? _this._buildCombineWhere(join.on, join.with.as || join.with.table, queryTable, rowData) : undefined, skipQueue: true }), eachRow, rowsDone, function (err) {
                        _this.query.state = "error";
                        _this.error(err);
                    });
                }
            });
        };
        doJoin((_a = {}, _a[String(this.query.tableAS || this.query.table)] = leftRow, _a), 0, complete);
    };
    _nanoSQLQuery.prototype._select = function (complete, onError) {
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
        var distinctKeys = {};
        var generateDistinctKey = function (row) {
            return (_this.query.distinct || []).reduce(function (prev, cur) {
                return prev + JSON.stringify(utilities_1.deepGet(cur, row) || {});
            }, "");
        };
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
                            var isDistinct = true;
                            if (_this.query.distinct) {
                                var key = generateDistinctKey(row);
                                if (!distinctKeys[key]) {
                                    distinctKeys[key] = true;
                                }
                                else {
                                    isDistinct = false;
                                }
                            }
                            var newRow = _this._streamAS(row);
                            var keep = _this.query.having ? _this._where(newRow, _this._havingArgs.slowWhere) : true;
                            return keep && isDistinct ? newRow : undefined;
                        }).filter(function (f) { return f; }));
                    }
                    else {
                        rows.forEach(function (row, i) {
                            var isDistinct = true;
                            if (_this.query.distinct) {
                                var key = generateDistinctKey(row);
                                if (!distinctKeys[key]) {
                                    distinctKeys[key] = true;
                                }
                                else {
                                    isDistinct = false;
                                }
                            }
                            if (!isDistinct) {
                                return;
                            }
                            var newRow = _this._streamAS(row);
                            var keep = _this.query.having ? _this._where(newRow, _this._havingArgs.slowWhere) : true;
                            if (!keep) {
                                return;
                            }
                            if (doRange) {
                                if (count_1 >= range[0] && count_1 < range[1]) {
                                    _this.progress(newRow, count_1);
                                }
                            }
                            else {
                                _this.progress(newRow, count_1);
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
        var rowCounter2 = 0;
        var graphBuffer = new utilities_1._nanoSQLQueue(function (gRow, ct, nextGraph, err) {
            if (_this.query.graph) {
                _this._graph(_this.query.graph || [], _this.query.tableAS || _this.query.table, gRow, rowCounter, function (graphRow, j) {
                    var isDistinct = true;
                    if (_this.query.distinct) {
                        var key = generateDistinctKey(graphRow);
                        if (!distinctKeys[key]) {
                            distinctKeys[key] = true;
                        }
                        else {
                            isDistinct = false;
                        }
                    }
                    if (!isDistinct) {
                        rowCounter2++;
                        nextGraph();
                        return;
                    }
                    var finalRow = _this._streamAS(graphRow);
                    if (_this.query.having) {
                        if (_this._where(_this._streamAS(gRow), _this._havingArgs.slowWhere)) {
                            _this.progress(finalRow, rowCounter2);
                        }
                    }
                    else {
                        _this.progress(finalRow, rowCounter2);
                    }
                    rowCounter2++;
                    nextGraph();
                });
            }
            else {
                var isDistinct = true;
                if (_this.query.distinct) {
                    var key = generateDistinctKey(gRow);
                    if (!distinctKeys[key]) {
                        distinctKeys[key] = true;
                    }
                    else {
                        isDistinct = false;
                    }
                }
                if (!isDistinct) {
                    rowCounter2++;
                    nextGraph();
                    return;
                }
                _this.progress(_this._streamAS(gRow), rowCounter2);
                rowCounter2++;
                nextGraph();
            }
        }, this._onError, function () {
            if (_this.query.cacheID && _this.query.cacheID === _this.query.queryID) {
                delete globalTableCache[_this.query.cacheID];
            }
            complete();
        });
        var rowCounter = 0;
        var selectBuffer = new utilities_1._nanoSQLQueue(function (row, ct, next, err) {
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
                if (_this.query.orderBy && !_this._hasOrdered) { // order by
                    _this._queryBuffer.sort(_this._orderByRows);
                }
                if (doRange) { // limit / offset
                    _this._queryBuffer = _this._queryBuffer.slice(range[0], range[1]);
                }
                _this._queryBuffer.forEach(function (row, i) {
                    var isDistinct = true;
                    if (_this.query.distinct) {
                        var key = generateDistinctKey(row);
                        if (!distinctKeys[key]) {
                            distinctKeys[key] = true;
                        }
                        else {
                            isDistinct = false;
                        }
                    }
                    if (isDistinct) {
                        _this.progress(row, i);
                    }
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
            var selectEvent = {
                target: _this.query.table,
                path: "_all_",
                events: ["select", "*"],
                time: Date.now(),
                performance: Date.now() - _this._startTime,
                result: row,
                query: _this.query,
                indexes: _this._indexesUsed
            };
            if (tableIsString) {
                _this.nSQL.triggerEvent(selectEvent);
            }
            if (_this.query.returnEvent) {
                _this.progress(selectEvent, i);
            }
            else {
                selectBuffer.newItem(row);
            }
        }, function () {
            if (_this.query.returnEvent) {
                complete();
            }
            else {
                selectBuffer.finished();
            }
        }, onError);
    };
    _nanoSQLQuery.prototype._groupByRows = function () {
        var _this = this;
        if (!this.query.groupBy && !this._hasAggrFn) {
            this._queryBuffer = this._queryBuffer.map(function (b) { return _this._streamAS(b); });
            return;
        }
        this._queryBuffer.sort(function (a, b) {
            return _this._sortObj(a, b, _this._groupBy);
        }).forEach(function (val, idx) {
            var groupByKey = _this._groupBy.sort.map(function (k) {
                return String(k.fn ? utilities_1.execFunction(_this.query, k.fn, val, { result: undefined }).result : utilities_1.deepGet(k.path, val));
            }).join(".");
            if (_this._sortGroupKeys[groupByKey] === undefined) {
                _this._sortGroupKeys[groupByKey] = _this._sortGroups.length;
            }
            var key = _this._sortGroupKeys[groupByKey];
            if (!_this._sortGroups[key]) {
                _this._sortGroups.push([]);
            }
            _this._sortGroups[key].push(val);
        });
        if (this.query.orderBy) {
            this._hasOrdered = true;
            this._sortGroups = this._sortGroups.map(function (groupArr) {
                return groupArr.sort(function (a, b) { return _this._sortObj(a, b, _this._orderBy); });
            });
        }
        this._queryBuffer = [];
        if (this._hasAggrFn) {
            // loop through the groups
            this._sortGroups.forEach(function (group) {
                // find aggregate functions
                var resultFns = _this._selectArgs.reduce(function (p, c, i) {
                    var fnName = c.value.split("(").shift();
                    if (c.isFn && _this.nSQL.functions[fnName] && _this.nSQL.functions[fnName].type === "A") {
                        p[i] = {
                            idx: i,
                            name: c.value,
                            aggr: utilities_1.assign(_this.nSQL.functions[fnName].aggregateStart),
                        };
                    }
                    return p;
                }, []);
                var firstFn = resultFns.filter(function (f) { return f; })[0];
                // calculate aggregate functions
                group.reverse().forEach(function (row, i) {
                    resultFns.forEach(function (fn, i) {
                        if (!fn)
                            return;
                        resultFns[i].aggr = utilities_1.execFunction(_this.query, resultFns[i].name, row, resultFns[i].aggr);
                    });
                });
                // calculate simple functions and AS back into buffer
                _this._queryBuffer.push(_this._selectArgs.reduce(function (prev, cur, i) {
                    var col = cur.value;
                    prev[cur.as || col] = cur.isFn && resultFns[i] ? resultFns[i].aggr.result : (cur.isFn ? utilities_1.execFunction(_this.query, cur.value, resultFns[firstFn.idx].aggr.row, { result: undefined }).result : utilities_1.deepGet(cur.value, resultFns[firstFn.idx].aggr.row));
                    return prev;
                }, {}));
            });
        }
        else {
            this._sortGroups.forEach(function (group) {
                _this._queryBuffer.push(_this._streamAS(group.shift()));
            });
        }
    };
    _nanoSQLQuery.prototype._buildCombineWhere = function (graphWhere, graphTable, rowTable, rowData) {
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
    _nanoSQLQuery.prototype._graph = function (gArgs, topTable, row, index, onRow) {
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
                    _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, graphTable.rows, "select"), { tableAS: graph.with.as, actionArgs: graph.select, where: whereCond, limit: graph.limit, offset: graph.offset, orderBy: graph.orderBy, groupBy: graph.groupBy, graph: graph.graph, skipQueue: true, cacheID: _this.query.cacheID }), function (graphRow) {
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
    _nanoSQLQuery.prototype._upsert = function (onRow, complete, error) {
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
        var table = this.nSQL._tables[this.query.table];
        if (this._whereArgs.type === interfaces_1.IWhereType.none) { // insert/update records directly
            utilities_1.allAsync(upsertRecords, function (row, i, next, error) {
                var pkVal = utilities_1.deepGet(table.pkCol, row);
                if (pkVal) {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).read(_this.query.table, pkVal, function (oldRow) {
                        if (oldRow) {
                            _this._updateRow(row, oldRow, function (newRow) {
                                onRow(newRow, i);
                                next(null);
                            }, error);
                        }
                        else {
                            _this._newRow(row, function (newRow) {
                                onRow(newRow, i);
                                next(null);
                            }, error);
                        }
                    }, error);
                }
                else {
                    _this._newRow(row, function (newRow) {
                        onRow(newRow, i);
                        next(null);
                    }, error);
                }
            }).then(function () {
                complete();
            }).catch(this._onError);
        }
        else { // find records and update them
            if (upsertRecords.length > 1) {
                this.query.state = "error";
                error("Cannot upsert multiple records with where condition!");
                return;
            }
            var updatedRecords_1 = 0;
            var upsertBuffer_1 = new utilities_1._nanoSQLQueue(function (row, i, done, err) {
                updatedRecords_1++;
                _this._updateRow(upsertRecords[0], row, function (evOrRow) {
                    onRow(evOrRow, i);
                    done();
                }, err);
            }, error, function () {
                complete();
            });
            this._getRecords(function (row, i) {
                upsertBuffer_1.newItem(row);
            }, function () {
                upsertBuffer_1.finished();
            }, error);
        }
    };
    _nanoSQLQuery.prototype._updateRow = function (newData, oldRow, complete, error) {
        var _this = this;
        this.nSQL.doFilter("updateRow", { res: newData, row: oldRow, query: this.query }, function (upsertData) {
            var finalRow = _this.nSQL.default(_this.upsertPath ? utilities_1.deepSet(_this.upsertPath, utilities_1.maybeAssign(oldRow), upsertData.res) : __assign({}, oldRow, upsertData.res), _this.query.table);
            _this._diffUpdates(_this.query.table, oldRow, finalRow, function () {
                var changeEvent = {
                    target: _this.query.table,
                    path: "*",
                    events: ["upsert", "change", "*"],
                    time: Date.now(),
                    performance: Date.now() - _this._startTime,
                    result: finalRow,
                    oldRow: oldRow,
                    query: _this.query,
                    indexes: _this._indexesUsed
                };
                _this.nSQL.doFilter("updateRowEvent", { res: changeEvent, query: _this.query }, function (event) {
                    if (typeof _this.query.table === "string") {
                        _this.nSQL.triggerEvent(event.res);
                        if (_this.nSQL.eventFNs[_this.query.table]) {
                            Object.keys(_this.nSQL.eventFNs[_this.query.table]).forEach(function (path) {
                                if (path !== "*") {
                                    if (!utilities_1.objectsEqual(utilities_1.deepGet(path, oldRow), utilities_1.deepGet(path, finalRow))) {
                                        _this.nSQL.triggerEvent({
                                            target: _this.query.table,
                                            path: path,
                                            events: ["upsert", "change", "*"],
                                            time: Date.now(),
                                            performance: Date.now() - _this._startTime,
                                            result: finalRow,
                                            oldRow: oldRow,
                                            query: _this.query,
                                            indexes: _this._indexesUsed
                                        }, true);
                                    }
                                }
                            });
                        }
                    }
                    complete(_this.query.returnEvent ? event.res : finalRow);
                }, error);
            }, error);
        }, error);
    };
    _nanoSQLQuery.prototype._checkUniqueIndexes = function (table, pk, oldRow, newIndexValues, done, error) {
        var _this = this;
        utilities_1.allAsync(Object.keys(newIndexValues), function (index, i, next, err) {
            var indexProps = _this.nSQL._tables[_this.query.table].indexes[index].props || {};
            if (indexProps && indexProps.unique) { // check for unique
                var indexPKs_1 = [];
                utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(table, index, newIndexValues[index], function (rowPK) {
                    if (rowPK !== pk)
                        indexPKs_1.push(rowPK);
                }, function () {
                    if (indexPKs_1.length > 0) {
                        err({ error: "Unique Index Collision!", row: oldRow, query: _this.query });
                    }
                    else {
                        next(null);
                    }
                }, err);
            }
            else { // no need to check for unique
                next(null);
            }
        }).then(done).catch(error);
    };
    _nanoSQLQuery.prototype._diffUpdates = function (queryTable, oldRow, finalRow, done, error) {
        var _this = this;
        var newIndexValues = this._getIndexValues(this.nSQL._tables[this.query.table].indexes, finalRow);
        var oldIndexValues = this._getIndexValues(this.nSQL._tables[this.query.table].indexes, oldRow);
        var table = this.nSQL._tables[queryTable];
        this._checkUniqueIndexes(queryTable, utilities_1.deepGet(table.pkCol, oldRow), oldRow, newIndexValues, function () {
            utilities_1.allAsync(Object.keys(oldIndexValues).concat(["__pk__"]), function (indexName, i, next, err) {
                if (indexName === "__pk__") { // main row
                    utilities_1.adapterFilters(_this.nSQL, _this.query).write(queryTable, utilities_1.deepGet(table.pkCol, finalRow), finalRow, function (pk) {
                        utilities_1.deepSet(table.pkCol, finalRow, pk);
                        next(null);
                    }, err);
                }
                else { // indexes
                    var tableName_1 = _this.query.table;
                    if (utilities_1.objectsEqual(newIndexValues[indexName], oldIndexValues[indexName]) === false) { // only update changed index values
                        if (table.indexes[indexName].isArray) {
                            var addValues = newIndexValues[indexName].filter(function (v, i, s) { return oldIndexValues[indexName].indexOf(v) === -1; });
                            var removeValues = oldIndexValues[indexName].filter(function (v, i, s) { return newIndexValues[indexName].indexOf(v) === -1; });
                            utilities_1.allAsync([addValues, removeValues], function (arrayOfValues, j, nextValues) {
                                if (!arrayOfValues.length) {
                                    nextValues(null);
                                    return;
                                }
                                utilities_1.allAsync(arrayOfValues, function (value, i, nextArr) {
                                    _this._updateIndex(tableName_1, indexName, value, utilities_1.deepGet(table.pkCol, finalRow), j === 0, function () {
                                        nextArr(null);
                                    }, err);
                                }).then(nextValues);
                            }).then(next);
                        }
                        else {
                            utilities_1.chainAsync(["rm", "add"], function (job, i, nextJob) {
                                switch (job) {
                                    case "add": // add new index value
                                        _this._updateIndex(tableName_1, indexName, newIndexValues[indexName], utilities_1.deepGet(table.pkCol, finalRow), true, function () {
                                            nextJob(null);
                                        }, err);
                                        break;
                                    case "rm": // remove old index value
                                        _this._updateIndex(tableName_1, indexName, oldIndexValues[indexName], utilities_1.deepGet(table.pkCol, finalRow), false, function () {
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
        }, error);
    };
    _nanoSQLQuery.prototype._updateIndex = function (table, indexName, value, pk, addToIndex, done, err) {
        var _this = this;
        var newItem = { table: table, indexName: indexName, value: value, pk: pk, addToIndex: addToIndex, done: done, err: err, query: this.query, nSQL: this.nSQL };
        this.nSQL.doFilter("updateIndex", { res: newItem, query: this.query }, function (update) {
            exports.secondaryIndexQueue[_this.nSQL.state.id + update.res.indexName].newItem(update.res, function (item, done, error) {
                var fn = item.addToIndex ? utilities_1.adapterFilters(item.nSQL, item.query).addIndexValue : utilities_1.adapterFilters(item.nSQL, item.query).deleteIndexValue;
                fn(item.table, item.indexName, item.pk, item.value, function () {
                    item.done();
                    done();
                }, function (err) {
                    item.err(err);
                    done();
                });
            });
        }, err);
    };
    _nanoSQLQuery.prototype._newRow = function (newRow, complete, error) {
        var _this = this;
        this.nSQL.doFilter("addRow", { res: newRow, query: this.query }, function (rowToAdd) {
            var table = _this.nSQL._tables[_this.query.table];
            rowToAdd.res = _this.nSQL.default(utilities_1.maybeAssign(_this.upsertPath ? utilities_1.deepSet(_this.upsertPath, {}, rowToAdd.res) : rowToAdd.res), _this.query.table);
            var indexValues = _this._getIndexValues(_this.nSQL._tables[_this.query.table].indexes, rowToAdd.res);
            _this._checkUniqueIndexes(_this.query.table, utilities_1.deepGet(table.pkCol, rowToAdd.res), rowToAdd.res, indexValues, function () {
                utilities_1.adapterFilters(_this.nSQL, _this.query).write(_this.query.table, utilities_1.deepGet(table.pkCol, rowToAdd.res), rowToAdd.res, function (pk) {
                    utilities_1.deepSet(table.pkCol, rowToAdd.res, pk);
                    utilities_1.allAsync(Object.keys(indexValues), function (indexName, i, next, err) {
                        // const idxTable = "_idx_" + this.nSQL.tableIds[this.query.table as string] + "_" + indexName;
                        if (table.indexes[indexName].isArray) {
                            var arrayOfValues = indexValues[indexName] || [];
                            utilities_1.allAsync(arrayOfValues, function (value, i, nextArr) {
                                _this._updateIndex(_this.query.table, indexName, value, utilities_1.deepGet(table.pkCol, rowToAdd.res), true, function () {
                                    nextArr(null);
                                }, err);
                            }).then(function () {
                                next(null);
                            }).catch(err);
                        }
                        else {
                            _this._updateIndex(_this.query.table, indexName, indexValues[indexName], utilities_1.deepGet(table.pkCol, rowToAdd.res), true, function () {
                                next(null);
                            }, err);
                        }
                    }).then(function () {
                        var changeEvent = {
                            target: _this.query.table,
                            path: "*",
                            events: ["upsert", "*"],
                            time: Date.now(),
                            performance: Date.now() - _this._startTime,
                            result: rowToAdd.res,
                            oldRow: undefined,
                            query: _this.query,
                            indexes: _this._indexesUsed
                        };
                        _this.nSQL.doFilter("addRowEvent", { res: changeEvent, query: _this.query }, function (event) {
                            if (typeof _this.query.table === "string") {
                                _this.nSQL.triggerEvent(event.res);
                            }
                            complete(_this.query.returnEvent ? event.res : rowToAdd.res);
                        }, error);
                    });
                }, error);
            }, error);
        }, error);
    };
    _nanoSQLQuery.prototype._delete = function (onRow, complete, error) {
        var _this = this;
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.state === "error")
            return;
        var tableConfig = this.nSQL._tables[this.query.table];
        var deleteBuffer = new utilities_1._nanoSQLQueue(function (row, i, done, err) {
            new Promise(function (res, rej) {
                var table = _this.query.table;
                if (_this.nSQL._fkRels[table] && _this.nSQL._fkRels[table].length) {
                    utilities_1.allAsync(_this.nSQL._fkRels[table], function (fkRestraint, i, next, err) {
                        var rowValue = utilities_1.deepGet(fkRestraint.selfPath, row);
                        var rowPKs = utilities_1.cast("any[]", fkRestraint.selfIsArray ? rowValue : [rowValue]);
                        utilities_1.allAsync(rowPKs, function (rowPK, iii, nextRow, rowErr) {
                            switch (fkRestraint.onDelete) {
                                case interfaces_1.InanoSQLFKActions.RESTRICT: // see if any rows are connected
                                    var count_2 = 0;
                                    utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, function (pk) {
                                        count_2++;
                                    }, function () {
                                        if (count_2 > 0) {
                                            rowErr("Foreign key restraint error, can't delete!");
                                        }
                                        else {
                                            nextRow();
                                        }
                                    }, err);
                                    break;
                                case interfaces_1.InanoSQLFKActions.CASCADE:
                                    var deleteIDs_1 = [];
                                    utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, function (key) {
                                        deleteIDs_1.push(key);
                                    }, function () {
                                        _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, fkRestraint.childTable, "delete"), { where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs_1] }), utilities_1.noop, nextRow, rowErr);
                                    }, err);
                                    break;
                                case interfaces_1.InanoSQLFKActions.SET_NULL:
                                    var setIDs_1 = [];
                                    utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, function (key) {
                                        setIDs_1.push(key);
                                    }, function () {
                                        var _a;
                                        _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, fkRestraint.childTable, "upsert"), { actionArgs: (_a = {},
                                                _a[fkRestraint.childPath.join(".")] = null,
                                                _a), where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs_1] }), utilities_1.noop, nextRow, rowErr);
                                    }, err);
                                    break;
                                default:
                                    next();
                            }
                        }).then(next).catch(err);
                    }).then(res).catch(rej);
                }
                else {
                    res();
                }
            }).then(function () {
                _this._removeRowAndIndexes(tableConfig, row, function (delRowOrEvent) {
                    onRow(delRowOrEvent, i);
                    done();
                }, err);
            }).catch(err);
        }, error, function () {
            complete();
        });
        this._getRecords(function (row, i) {
            deleteBuffer.newItem(row);
        }, function () {
            deleteBuffer.finished();
        }, error);
    };
    _nanoSQLQuery.prototype._removeRowAndIndexes = function (table, row, complete, error) {
        var _this = this;
        var indexValues = this._getIndexValues(table.indexes, row);
        this.nSQL.doFilter("deleteRow", { res: row, query: this.query }, function (delRow) {
            utilities_1.allAsync(Object.keys(indexValues).concat(["__del__"]), function (indexName, i, next) {
                if (indexName === "__del__") { // main row
                    utilities_1.adapterFilters(_this.nSQL, _this.query).delete(_this.query.table, utilities_1.deepGet(table.pkCol, delRow.res), function () {
                        next(null);
                    }, function (err) {
                        _this.query.state = "error";
                        error(err);
                    });
                }
                else { // secondary indexes
                    if (table.indexes[indexName].isArray) {
                        var arrayOfValues = indexValues[indexName] || [];
                        utilities_1.allAsync(arrayOfValues, function (value, i, nextArr) {
                            _this._updateIndex(_this.query.table, indexName, value, utilities_1.deepGet(table.pkCol, delRow.res), false, function () {
                                nextArr(null);
                            }, error);
                        }).then(next);
                    }
                    else {
                        _this._updateIndex(_this.query.table, indexName, indexValues[indexName], utilities_1.deepGet(table.pkCol, delRow.res), false, function () {
                            next(null);
                        }, _this._onError);
                    }
                }
            }).then(function () {
                var delEvent = {
                    target: _this.query.table,
                    path: "_all_",
                    events: ["change", "delete", "*"],
                    time: Date.now(),
                    performance: Date.now() - _this._startTime,
                    result: delRow.res,
                    query: _this.query,
                    indexes: _this._indexesUsed
                };
                _this.nSQL.doFilter("deleteRowEvent", { res: delEvent, query: _this.query }, function (event) {
                    if (typeof _this.query.table === "string") {
                        _this.nSQL.triggerEvent(event.res);
                    }
                    complete(_this.query.returnEvent ? event.res : delRow.res);
                }, error);
            }).catch(error);
        }, error);
    };
    _nanoSQLQuery.prototype._getIndexValues = function (indexes, row) {
        var _this = this;
        return Object.keys(indexes).reduce(function (prev, cur) {
            var value = utilities_1.deepGet(indexes[cur].path, row);
            var type = indexes[cur].type;
            prev[cur] = indexes[cur].isArray ? (Array.isArray(value) ? value : []).map(function (v) { return _this.nSQL.indexTypes[type](v); }) : _this.nSQL.indexTypes[type](value);
            return prev;
        }, {});
    };
    _nanoSQLQuery.prototype._showTables = function () {
        var _this = this;
        this.progress({
            tables: Object.keys(this.nSQL._tables)
        }, 0);
        Object.keys(this.nSQL._tables).forEach(function (table, i) {
            _this.progress({ table: table }, i);
        });
        this.complete();
    };
    _nanoSQLQuery.prototype._describe = function (type) {
        var _this = this;
        if (type === void 0) { type = "table"; }
        if (typeof this.query.table !== "string") {
            this.query.state = "error";
            this.error({ error: "Can't call describe on that!", query: this.query });
            return;
        }
        if (!this.nSQL._tables[this.query.table]) {
            this.query.state = "error";
            this.error({ error: "Table " + this.query.table + " not found!", query: this.query });
            return;
        }
        switch (type) {
            case "table":
                this.nSQL._tables[this.query.table].columns.forEach(function (col, i) {
                    _this.progress(utilities_1.assign(col), i);
                });
                break;
            case "idx":
                Object.keys(this.nSQL._tables[this.query.table].indexes).forEach(function (idx, i) {
                    var index = _this.nSQL._tables[_this.query.table].indexes[idx];
                    _this.progress(utilities_1.assign(index), i);
                });
                break;
        }
        this.complete();
    };
    _nanoSQLQuery.prototype._combineRows = function (rData) {
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
    _nanoSQLQuery.prototype._streamAS = function (row) {
        var _this = this;
        var distinctArgs = (this.query.distinct || []).map(function (s) { return ({ isFn: false, value: s }); });
        var selectArgs = (this._selectArgs || []).concat(distinctArgs);
        if (selectArgs.length) {
            var result_1 = {};
            selectArgs.forEach(function (arg) {
                if (arg.isFn) {
                    result_1[arg.as || arg.value] = utilities_1.execFunction(_this.query, arg.value, row, {}).result;
                }
                else {
                    result_1[arg.as || arg.value] = utilities_1.deepGet(arg.value, row);
                }
            });
            return this.query.join ? this._combineRows(result_1) : result_1;
        }
        return this.query.join ? this._combineRows(row) : row;
    };
    _nanoSQLQuery.prototype._orderByRows = function (a, b) {
        return this._sortObj(a, b, this._orderBy);
    };
    /**
     * Get the sort direction for two objects given the objects, columns and resolve paths.
     *
     * @internal
     * @param {*} objA
     * @param {*} objB
     * @param nanoSQLSortBy columns
     * @param {boolean} resolvePaths
     * @returns {number}
     * @memberof _MutateSelection
     */
    _nanoSQLQuery.prototype._sortObj = function (objA, objB, columns) {
        var _this = this;
        var id = typeof this.query.table === "string" ? this.nSQL._tables[this.query.table].pkCol : [];
        var A_id = id.length ? utilities_1.deepGet(id, objA) : false;
        var B_id = id.length ? utilities_1.deepGet(id, objB) : false;
        return columns.sort.reduce(function (prev, cur) {
            var A = cur.fn ? utilities_1.execFunction(_this.query, cur.fn, objA, { result: undefined }).result : utilities_1.deepGet(cur.path, objA);
            var B = cur.fn ? utilities_1.execFunction(_this.query, cur.fn, objB, { result: undefined }).result : utilities_1.deepGet(cur.path, objB);
            if (!prev) {
                if (A === B)
                    return A_id === B_id ? 0 : (A_id > B_id ? 1 : -1);
                return (A > B ? 1 : -1) * (cur.dir === "DESC" ? -1 : 1);
            }
            else {
                return prev;
            }
        }, 0);
    };
    _nanoSQLQuery.prototype._tableID = function () {
        return [0, 1].map(function () {
            var id = utilities_1.random16Bits().toString(16);
            while (id.length < 4) {
                id = "0" + id;
            }
            return id;
        }).join("-");
    };
    _nanoSQLQuery.prototype._createTable = function (table, alterTable, complete, error) {
        var _this = this;
        var tableID = this.nSQL._tableIds[this.query.table] || this._tableID();
        // table already exists, set to alter table query
        if (!alterTable && Object.keys(this.nSQL._tables).indexOf(table.name) !== -1) {
            alterTable = true;
        }
        new Promise(function (res, rej) {
            var hasError = false;
            var l = table.name;
            if (!table._internal && (l.indexOf("_") === 0 || l.match(/\s/g) !== null || l.match(/[\(\)\]\[\.]/g) !== null)) {
                rej({ error: "Invalid Table Name " + table.name + "! https://docs.nanosql.io/setup/data-models", query: _this.query });
                return;
            }
            Object.keys(table.model).forEach(function (col) {
                var modelData = col.replace(/\s+/g, "-").split(":"); // [key, type];
                if (modelData.length === 1) {
                    modelData.push("any");
                }
                if (!modelData[0] || modelData[0].match(/[\(\)\]\[\.]/g) !== null || modelData[0].indexOf("_") === 0) {
                    hasError = true;
                    rej({ error: "Invalid Data Model at " + (table.name + "." + col) + "! https://docs.nanosql.io/setup/data-models", query: _this.query });
                }
            });
            if (hasError)
                return;
            res();
        }).then(function () {
            return new Promise(function (res, rej) {
                _this.nSQL.doFilter("configTable", { res: table, query: _this.query }, res, rej);
            });
        }).then(function (table) {
            var setModels = function (dataModel, level) {
                var model = {};
                if (typeof dataModel === "string") {
                    var foundModel_1 = false;
                    var isArray = dataModel.indexOf("[]") !== -1;
                    var type_1 = dataModel.replace(/\[\]/gmi, "");
                    if (level === 0 && isArray) {
                        throw new Error("Can't use array types as table definition.");
                    }
                    model = Object.keys(_this.nSQL.config.types || {}).reduce(function (prev, cur) {
                        if (cur === type_1[1]) {
                            foundModel_1 = true;
                            return (_this.nSQL.config.types || {})[cur];
                        }
                        return prev;
                    }, {});
                    if (foundModel_1 === false) {
                        if (level === 0) {
                            throw new Error("Type " + dataModel + " not found!");
                        }
                        return undefined;
                    }
                }
                else {
                    model = dataModel;
                }
                return Object.keys(dataModel).reduce(function (p, d) {
                    var type = d.split(":")[1] || "any";
                    if (type.indexOf("geo") === 0) {
                        p[d] = {
                            default: { lat: 0, lon: 0 },
                            model: {
                                "lat:float": { max: 90, min: -90 },
                                "lon:float": { max: 180, min: -180 }
                            }
                        };
                    }
                    else if (dataModel[d].model) {
                        p[d] = __assign({}, dataModel[d], { model: setModels(dataModel[d].model, level + 1) });
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
                    max: dataModels[d].max,
                    min: dataModels[d].min,
                    model: dataModels[d].model ? generateColumns(dataModels[d].model) : undefined
                }); });
            };
            var error = "";
            var computedDataModel = setModels(table.res.model, 0);
            var pkType = function (model) {
                if (typeof model === "string")
                    return "";
                return Object.keys(model).reduce(function (p, c) {
                    if (model[c] && model[c].pk) {
                        return c.split(":")[1];
                    }
                    if (!p.length && model[c].model)
                        return pkType(model[c].model);
                    return p;
                }, "");
            };
            var indexes = table.res.indexes || {};
            var ai = false;
            var getPK = function (path, model) {
                if (typeof model === "string")
                    return [];
                var foundPK = false;
                return Object.keys(model).reduce(function (p, c) {
                    if (model[c] && model[c].pk) {
                        foundPK = true;
                        if (model[c].ai) {
                            ai = true;
                        }
                        p.push(c.split(":")[0]);
                        return p;
                    }
                    if (!foundPK && model[c].model)
                        return getPK(path.concat([c.split(":")[0]]), model[c].model);
                    return p;
                }, path);
            };
            var tablePKType = table.res.primaryKey ? table.res.primaryKey.split(":")[1] : pkType(table.res.model);
            var newConfig = {
                id: tableID,
                name: table.res.name,
                model: computedDataModel,
                columns: generateColumns(computedDataModel),
                filter: table.res.filter,
                actions: table.res.actions || [],
                views: table.res.views || [],
                queries: (table.res.queries || []).reduce(function (prev, query) {
                    prev[query.name] = query;
                    return prev;
                }, {}),
                indexes: Object.keys(indexes).map(function (i) { return ({
                    id: utilities_1.resolvePath(i.split(":")[0]).join("."),
                    type: (i.split(":")[1] || "string").replace(/\[\]/gmi, ""),
                    isArray: (i.split(":")[1] || "string").indexOf("[]") !== -1,
                    path: utilities_1.resolvePath(i.split(":")[0]),
                    props: indexes[i]
                }); }).reduce(function (p, c) {
                    var allowedTypes = Object.keys(_this.nSQL.indexTypes);
                    if (allowedTypes.indexOf(c.type) === -1) {
                        error = "Index \"" + c.id + "\" does not have a valid type!";
                        return p;
                    }
                    if (c.type.indexOf("geo") !== -1) {
                        p[c.id + ".lon"] = {
                            id: c.id + ".lon",
                            type: "float",
                            isArray: false,
                            path: c.path.concat(["lon"]),
                            props: { offset: 180 }
                        };
                        p[c.id + ".lat"] = {
                            id: c.id + ".lat",
                            type: "float",
                            isArray: false,
                            path: c.path.concat(["lat"]),
                            props: { offset: 90 }
                        };
                    }
                    else {
                        p[c.id] = c;
                    }
                    return p;
                }, {}),
                pkType: tablePKType,
                pkCol: table.res.primaryKey ? utilities_1.resolvePath(table.res.primaryKey.split(":")[0]) : getPK([], table.res.model),
                isPkNum: ["number", "int", "float"].indexOf(tablePKType) !== -1,
                ai: ai
            };
            // no primary key found, set one
            if (newConfig.pkCol.length === 0) {
                newConfig.pkCol = ["_id"];
                newConfig.pkType = "uuid";
                newConfig.model["_id:uuid"] = { pk: true };
                newConfig.columns = generateColumns(setModels(newConfig.model, 0));
            }
            if (error && error.length)
                return Promise.reject(error);
            return new Promise(function (res, rej) {
                _this.nSQL.doFilter("configTableSystem", { res: newConfig, query: _this.query }, function (result) {
                    res(result.res);
                }, rej);
            });
        }).then(function (newConfig) {
            var oldIndexes = alterTable ? Object.keys(_this.nSQL._tables[_this.query.table].indexes) : [];
            var newIndexes = Object.keys(newConfig.indexes);
            var addIndexes = newIndexes.filter(function (v) { return oldIndexes.indexOf(v) === -1; });
            var addTables = [newConfig.name].concat(addIndexes);
            return utilities_1.chainAsync(addTables, function (tableOrIndexName, i, next, err) {
                if (i === 0) { // table
                    var newTable_1 = { name: tableOrIndexName, conf: newConfig };
                    _this.nSQL._tableIds[newTable_1.name] = newConfig.id;
                    if (alterTable) {
                        delete _this.nSQL._tableIds[_this.query.table];
                        var removeIndexes = oldIndexes.filter(function (v) { return newIndexes.indexOf(v) === -1; });
                        utilities_1.allAsync(removeIndexes, function (indexName, i, nextIndex, indexError) {
                            utilities_1.adapterFilters(_this.nSQL, _this.query).deleteIndex(tableOrIndexName, indexName, function () {
                                nextIndex(null);
                            }, indexError);
                        }).then(function () {
                            _this.nSQL._tables[newTable_1.name] = newTable_1.conf;
                            next(null);
                        }).catch(err);
                    }
                    else {
                        utilities_1.adapterFilters(_this.nSQL, _this.query).createTable(newTable_1.name, newTable_1.conf, function () {
                            _this.nSQL._tables[newTable_1.name] = newTable_1.conf;
                            next(null);
                        }, err);
                    }
                }
                else { // indexes
                    var index = newConfig.indexes[tableOrIndexName];
                    exports.secondaryIndexQueue[_this.nSQL.state.id + index.id] = new utilities_1._nanoSQLQueue();
                    utilities_1.adapterFilters(_this.nSQL, _this.query).createIndex(newConfig.name, index.id, index.type, function () {
                        next(null);
                    }, err);
                }
            });
        }).then(function () {
            _this.nSQL._rebuildFKs();
            if (_this.query.table === "_util") {
                return Promise.resolve();
            }
            return _this.nSQL._saveTableIds();
        }).then(function () {
            complete();
        }).catch(error);
    };
    _nanoSQLQuery.prototype._dropTable = function (table, complete, error) {
        var _this = this;
        var tablesToDrop = [table];
        Object.keys(this.nSQL._tables[table].indexes).forEach(function (indexName) {
            tablesToDrop.push(indexName);
        });
        new Promise(function (res, rej) {
            if (_this.nSQL._fkRels[table] && _this.nSQL._fkRels[table].length) {
                utilities_1.allAsync(_this.nSQL._fkRels[table], function (fkRestraint, i, next, err) {
                    switch (fkRestraint.onDelete) {
                        case interfaces_1.InanoSQLFKActions.RESTRICT: // see if any rows are connected
                            var count_3 = 0;
                            utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "offset", 0, 1, false, function (key, id) {
                                count_3++;
                            }, function () {
                                if (count_3 > 0) {
                                    err("Foreign key restraint error, can't drop!");
                                }
                                else {
                                    next();
                                }
                            }, err);
                            break;
                        case interfaces_1.InanoSQLFKActions.CASCADE:
                            var deleteIDs_2 = [];
                            utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "all", 0, 0, false, function (key, id) {
                                deleteIDs_2.push(key);
                            }, function () {
                                _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, fkRestraint.childTable, "delete"), { where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs_2] }), utilities_1.noop, next, err);
                            }, err);
                            break;
                        case interfaces_1.InanoSQLFKActions.SET_NULL:
                            var setIDs_2 = [];
                            utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "all", 0, 0, false, function (key, id) {
                                setIDs_2.push(key);
                            }, function () {
                                var _a;
                                _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, fkRestraint.childTable, "upsert"), { actionArgs: (_a = {},
                                        _a[fkRestraint.childPath.join(".")] = null,
                                        _a), where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs_2] }), utilities_1.noop, next, err);
                            }, err);
                            break;
                        default:
                            next();
                    }
                }).then(res).catch(rej);
            }
            else {
                res();
            }
        }).then(function () {
            return utilities_1.allAsync(tablesToDrop, function (dropTable, i, next, err) {
                if (i === 0) {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).dropTable(dropTable, function () {
                        delete _this.nSQL._tables[dropTable];
                        delete _this.nSQL._tableIds[dropTable];
                        _this.nSQL._saveTableIds().then(function () {
                            next(dropTable);
                        }).catch(err);
                    }, err);
                }
                else {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).deleteIndex(table, dropTable, next, err);
                }
            }).then(function () {
                complete();
            });
        }).catch(error);
    };
    _nanoSQLQuery.prototype._onError = function (err) {
        this.query.state = "error";
        this.error(err);
    };
    _nanoSQLQuery.prototype._resolveFastWhere = function (onlyGetPKs, fastWhere, isReversed, onRow, complete) {
        var _this = this;
        // function
        if (fastWhere.index && fastWhere.parsedFn) {
            this.nSQL.functions[fastWhere.parsedFn.name].queryIndex(this.query, fastWhere, onlyGetPKs, onRow, complete, this._onError);
            return;
        }
        // primary key or secondary index
        var isPKquery = fastWhere.index === "_pk_";
        var pkCol = this.nSQL._tables[this.query.table].pkCol;
        // const indexTable = `_idx_${this.nSQL.tableIds[this.query.table as string]}_${fastWhere.index}`;
        var count = 0;
        var indexBuffer = new utilities_1._nanoSQLQueue(function (pkOrRow, i, finished, err) {
            if (!pkOrRow) {
                finished();
                return;
            }
            if (isPKquery) { // primary key select
                onRow(onlyGetPKs ? utilities_1.deepGet(pkCol, pkOrRow) : pkOrRow, 0);
                finished();
            }
            else { // secondary index
                if (onlyGetPKs) {
                    onRow(pkOrRow, count);
                    count++;
                    finished();
                }
                else {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).read(_this.query.table, pkOrRow, function (row) {
                        if (row) {
                            onRow(row, count);
                        }
                        count++;
                        finished();
                    }, _this.error);
                }
            }
        }, this._onError, complete);
        if (fastWhere.indexArray) {
            // Primary keys cannot be array indexes
            switch (fastWhere.comp) {
                case "INCLUDES":
                    var pks = [];
                    utilities_1.adapterFilters(this.nSQL, this.query).readIndexKey(this.query.table, fastWhere.index, fastWhere.value, function (pk) {
                        indexBuffer.newItem(pk);
                    }, function () {
                        indexBuffer.finished();
                    }, this.error);
                    break;
                case "INTERSECT ALL":
                case "INTERSECT":
                    var PKS_1 = {};
                    var maxI_1 = 0;
                    utilities_1.allAsync((fastWhere.value || []), function (pk, j, next) {
                        utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(_this.query.table, fastWhere.index, pk, function (rowPK) {
                            maxI_1 = j + 1;
                            if (rowPK) {
                                PKS_1[rowPK] = (PKS_1[rowPK] || 0) + 1;
                            }
                        }, function () {
                            next(null);
                        }, _this.error);
                    }).then(function () {
                        var getPKS = fastWhere.comp === "INTERSECT" ? Object.keys(PKS_1) : Object.keys(PKS_1).filter(function (k) { return PKS_1[k] === maxI_1; });
                        getPKS.forEach(function (pk) {
                            indexBuffer.newItem(pk);
                        });
                        indexBuffer.finished();
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
                        if (isPKquery) {
                            utilities_1.adapterFilters(this.nSQL, this.query).read(this.query.table, fastWhere.value, function (row) {
                                indexBuffer.newItem(row);
                                indexBuffer.finished();
                            }, this.error);
                        }
                        else {
                            utilities_1.adapterFilters(this.nSQL, this.query).readIndexKey(this.query.table, fastWhere.index, fastWhere.value, function (readPK) {
                                indexBuffer.newItem(readPK);
                            }, function () {
                                indexBuffer.finished();
                            }, this.error);
                        }
                    }
                    break;
                case "BETWEEN":
                    if (isPKquery) {
                        utilities_1.adapterFilters(this.nSQL, this.query).readMulti(this.query.table, "range", fastWhere.value[0], fastWhere.value[1], isReversed, function (row, i) {
                            indexBuffer.newItem(row);
                        }, function () {
                            indexBuffer.finished();
                        }, this._onError);
                    }
                    else {
                        utilities_1.adapterFilters(this.nSQL, this.query).readIndexKeys(this.query.table, fastWhere.index, "range", fastWhere.value[0], fastWhere.value[1], isReversed, function (row) {
                            indexBuffer.newItem(row);
                        }, function () {
                            indexBuffer.finished();
                        }, this._onError);
                    }
                    break;
                case "IN":
                    var PKS = (isReversed ? fastWhere.value.sort(function (a, b) { return a < b ? 1 : -1; }) : fastWhere.value.sort(function (a, b) { return a > b ? 1 : -1; }));
                    if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                        PKS.forEach(function (pk, i) { return onRow(pk, i); });
                        complete();
                    }
                    else {
                        utilities_1.allAsync(PKS, function (pkRead, ii, nextPK) {
                            if (isPKquery) {
                                utilities_1.adapterFilters(_this.nSQL, _this.query).read(_this.query.table, pkRead, function (row) {
                                    indexBuffer.newItem(row);
                                    nextPK();
                                }, _this.error);
                            }
                            else {
                                utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(_this.query.table, fastWhere.index, pkRead, function (readPK) {
                                    indexBuffer.newItem(readPK);
                                }, function () {
                                    nextPK();
                                }, _this.error);
                            }
                        }).then(function () {
                            indexBuffer.finished();
                        });
                    }
            }
        }
    };
    _nanoSQLQuery.prototype._fastQuery = function (onRow, complete) {
        var _this = this;
        if (this._whereArgs.fastWhere) {
            if (this._whereArgs.fastWhere.length === 1) { // single where
                var fastWhere = this._whereArgs.fastWhere[0];
                var isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";
                this._resolveFastWhere(false, fastWhere, isReversed, function (row, i) {
                    onRow(row, i);
                }, complete);
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
                        col: _this.nSQL._tables[_this.query.table].pkCol.join("."),
                        comp: "IN",
                        value: getPKs
                    }, false, onRow, complete);
                });
            }
        }
    };
    _nanoSQLQuery.prototype._getRecords = function (onRow, complete, error) {
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
                // primary key or secondary index query followed by slow query
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
                    }, function () {
                        complete();
                    }, this._onError);
                    break;
            }
        }
        else if (typeof this.query.table === "function") { // promise that returns array
            this._getTable(this.query.tableAS || utilities_1.uuid(), this.query.where, this.query.table, function (result) {
                scanRecords(result.rows);
            });
        }
        else if (Array.isArray(this.query.table)) { // array
            scanRecords(this.query.table);
        }
        else {
            error("Can't get selected table!");
        }
    };
    _nanoSQLQuery.prototype._rebuildIndexes = function (progress, complete, error) {
        var _this = this;
        var rebuildTables = this.query.table;
        if (!this.nSQL._tables[rebuildTables]) {
            error(new Error("Table " + rebuildTables + " not found for rebuilding indexes!"));
            return;
        }
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.where) { // rebuild only select rows (cant clean/remove index tables)
            var readQueue_1 = new utilities_1._nanoSQLQueue(function (item, i, complete, error) {
                _this._removeRowAndIndexes(_this.nSQL._tables[rebuildTables], item, function () {
                    _this._newRow(item, complete, error);
                    progress(item, i);
                }, error);
            }, error, function () {
                complete();
            });
            this._getRecords(function (row) {
                readQueue_1.newItem(row);
            }, function () {
                readQueue_1.finished();
            }, error);
        }
        else { // empty indexes and start from scratch
            var indexes = Object.keys(this.nSQL._tables[rebuildTables].indexes);
            utilities_1.allAsync(indexes, function (indexName, j, nextIndex, indexErr) {
                utilities_1.adapterFilters(_this.nSQL, _this.query).deleteIndex(rebuildTables, indexName, function () {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).createIndex(rebuildTables, indexName, _this.nSQL._tables[rebuildTables].indexes[indexName].type, function () {
                        nextIndex(null);
                    }, indexErr);
                }, indexErr);
            }).then(function () {
                // indexes are now empty
                var readQueue = new utilities_1._nanoSQLQueue(function (row, i, complete, err) {
                    var indexValues = _this._getIndexValues(_this.nSQL._tables[rebuildTables].indexes, row);
                    var rowPK = utilities_1.deepGet(_this.nSQL._tables[rebuildTables].pkCol, row);
                    utilities_1.allAsync(Object.keys(indexValues), function (indexName, jj, nextIdx, errIdx) {
                        var idxValue = indexValues[indexName];
                        _this._updateIndex(rebuildTables, indexName, idxValue, rowPK, true, function () {
                            progress(row, i);
                            nextIdx();
                        }, errIdx);
                    }).then(complete).catch(err);
                }, error, function () {
                    complete();
                });
                _this._getRecords(function (row) {
                    readQueue.newItem(row);
                }, function () {
                    readQueue.finished();
                }, error);
            }).catch(error);
        }
    };
    _nanoSQLQuery.prototype._where = function (singleRow, where) {
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
    _nanoSQLQuery.prototype._processLIKE = function (columnValue, givenValue) {
        if (!_nanoSQLQuery.likeCache[givenValue]) {
            var prevChar_1 = "";
            _nanoSQLQuery.likeCache[givenValue] = new RegExp(givenValue.split("").map(function (s) {
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
                return String(columnValue).match(_nanoSQLQuery.likeCache[givenValue]) !== null;
            }
            else {
                return JSON.stringify(columnValue).match(_nanoSQLQuery.likeCache[givenValue]) !== null;
            }
        }
        return columnValue.match(_nanoSQLQuery.likeCache[givenValue]) !== null;
    };
    _nanoSQLQuery.prototype._getColValue = function (where, wholeRow) {
        if (where.fnString) {
            return utilities_1.execFunction(this.query, where.fnString, wholeRow, { result: undefined }).result;
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
    _nanoSQLQuery.prototype._compare = function (where, wholeRow) {
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
            case "=": return utilities_1.objectsEqual(givenValue, columnValue);
            // if column not equal to given value. Supports arrays, objects and primitives
            case "!=": return !utilities_1.objectsEqual(givenValue, columnValue);
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
            // if the column value is not between two given numbers
            case "NOT BETWEEN": return givenValue[0] >= columnValue || givenValue[1] <= columnValue;
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
    _nanoSQLQuery.prototype._parseSort = function (sort, checkforIndexes) {
        var key = ((sort && sort.length ? utilities_1.hash(JSON.stringify(sort)) : "") + this.nSQL.state.cacheId) + this.nSQL.state.cacheId;
        if (!key)
            return { sort: [], index: "" };
        if (_nanoSQLQuery._sortMemoized[key])
            return _nanoSQLQuery._sortMemoized[key];
        var isThereFn = false;
        var result = sort.map(function (o) { return o.split(" ").map(function (s) { return s.trim(); }); }).reduce(function (p, c) {
            var hasFn = c[0].indexOf("(") !== -1;
            if (hasFn) {
                isThereFn = true;
            }
            /*
            const fnArgs: string[] = hasFn ? c[0].split("(")[1].replace(")", "").split(",").map(v => v.trim()).filter(a => a) : [];
            const fnName = hasFn ? c[0].split("(")[0].trim().toUpperCase() : undefined;
            if (fnName && !this.nSQL.functions[fnName]) {
                this.query.state = "error";
                this.error(`Function "${fnName}" not found!`);
            }*/
            p.push({
                path: hasFn ? [] : utilities_1.resolvePath(c[0]),
                fn: hasFn ? c[0] : undefined,
                dir: (c[1] || "asc").toUpperCase()
            });
            return p;
        }, []);
        var index = "";
        if (checkforIndexes && isThereFn === false && result.length === 1) {
            var pkKey = typeof this.query.table === "string" ? this.nSQL._tables[this.query.table].pkCol : [];
            if (result[0].path[0].length && utilities_1.objectsEqual(result[0].path, pkKey)) {
                index = "_pk_";
            }
            else {
                var indexKeys = Object.keys(this.nSQL._tables[this.query.table].indexes);
                var i = indexKeys.length;
                while (i-- && !index) {
                    if (utilities_1.objectsEqual(this.nSQL._tables[this.query.table].indexes[indexKeys[i]], result[0].path)) {
                        index = this.nSQL._tables[this.query.table].indexes[indexKeys[i]].id;
                    }
                }
            }
        }
        _nanoSQLQuery._sortMemoized[key] = {
            sort: result,
            index: index
        };
        return _nanoSQLQuery._sortMemoized[key];
    };
    _nanoSQLQuery.prototype._parseSelect = function () {
        var _this = this;
        var selectArgsKey = (this.query.actionArgs && this.query.actionArgs.length ? JSON.stringify(this.query.actionArgs) : "") + this.nSQL.state.cacheId;
        this._orderBy = this._parseSort(this.query.orderBy || [], typeof this.query.table === "string");
        this._groupBy = this._parseSort(this.query.groupBy || [], false);
        if (selectArgsKey) {
            if (_nanoSQLQuery._selectArgsMemoized[selectArgsKey]) {
                this._hasAggrFn = _nanoSQLQuery._selectArgsMemoized[selectArgsKey].hasAggrFn;
                this._selectArgs = _nanoSQLQuery._selectArgsMemoized[selectArgsKey].args;
            }
            else {
                (this.query.actionArgs || []).forEach(function (val) {
                    var splitVal = val.split(/\s+as\s+/i).map(function (s) { return s.trim(); });
                    if (splitVal[0].indexOf("(") !== -1) {
                        // const fnArgs = splitVal[0].split("(")[1].replace(")", "").split(",").map(v => v.trim());
                        var fnName = splitVal[0].split("(")[0].trim().toUpperCase();
                        _this._selectArgs.push({ isFn: true, value: splitVal[0], as: splitVal[1], args: undefined });
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
                    _nanoSQLQuery._selectArgsMemoized[selectArgsKey] = { hasAggrFn: this._hasAggrFn, args: this._selectArgs };
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
            canUseOrderByIndex = this._orderBy.index.length && this._whereArgs.fastWhere && utilities_1.objectsEqual(this._whereArgs.fastWhere[0].col, this._orderBy.sort[0].path) ? true : false;
            if (canUseOrderByIndex) {
                this._idxOrderBy = true;
            }
        }
        if ((this._orderBy.sort.length && !canUseOrderByIndex) || this._groupBy.sort.length || this._hasAggrFn) {
            this._stream = false;
        }
    };
    _nanoSQLQuery.prototype._parseWhere = function (qWhere, ignoreIndexes) {
        var _this = this;
        var where = qWhere || [];
        var key = (JSON.stringify(where, function (key, value) {
            return value && value.constructor && value.constructor.name === "RegExp" ? value.toString() : value;
        }) + (ignoreIndexes ? "0" : "1")) + this.nSQL.state.cacheId;
        if (_nanoSQLQuery._whereMemoized[key]) {
            return _nanoSQLQuery._whereMemoized[key];
        }
        if (typeof where === "function") {
            return { type: interfaces_1.IWhereType.fn, whereFn: where };
        }
        else if (!where.length) {
            _nanoSQLQuery._whereMemoized[key] = { type: interfaces_1.IWhereType.none };
            return _nanoSQLQuery._whereMemoized[key];
        }
        var indexes = typeof this.query.table === "string" ? Object.keys(this.nSQL._tables[this.query.table].indexes).map(function (k) { return _this.nSQL._tables[_this.query.table].indexes[k]; }) : [];
        var pkKey = typeof this.query.table === "string" ? this.nSQL._tables[this.query.table].pkCol : [];
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
                        if (doIndex && _this.nSQL.functions[fnName] && _this.nSQL.functions[fnName].checkIndex) {
                            var indexFn = _this.nSQL.functions[fnName].checkIndex(_this.query, fnArgs, w);
                            if (indexFn) {
                                _this._indexesUsed.push(utilities_1.assign(w));
                                hasIndex = true;
                                p.push(indexFn);
                            }
                        }
                        if (!hasIndex) {
                            p.push({
                                fnString: w[0],
                                parsedFn: { name: fnName, args: fnArgs },
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
                            if (utilities_1.objectsEqual(path_1, pkKey)) {
                                isIndexCol_1 = true;
                                _this._indexesUsed.push(utilities_1.assign(w));
                                p.push({
                                    index: "_pk_",
                                    col: w[0],
                                    comp: w[1],
                                    value: w[2]
                                });
                            }
                            else { // check if we can use any index
                                indexes.forEach(function (index) {
                                    if (isIndexCol_1 === false && utilities_1.objectsEqual(index.path, path_1) && index.isArray === false) {
                                        isIndexCol_1 = true;
                                        _this._indexesUsed.push(utilities_1.assign(w));
                                        p.push({
                                            index: index.id,
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
                                if (utilities_1.objectsEqual(index.path, path_1) && index.isArray === true) {
                                    isIndexCol_1 = true;
                                    _this._indexesUsed.push(utilities_1.assign(w));
                                    p.push({
                                        index: index.id,
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
                    }
                    return p;
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
            _nanoSQLQuery._whereMemoized[key] = {
                type: slowWhere.length ? interfaces_1.IWhereType.medium : interfaces_1.IWhereType.fast,
                slowWhere: slowWhere,
                fastWhere: parsedWhere.slice(0, lastFastIndx)
            };
        }
        else {
            _nanoSQLQuery._whereMemoized[key] = {
                type: interfaces_1.IWhereType.slow,
                slowWhere: parsedWhere
            };
        }
        return _nanoSQLQuery._whereMemoized[key];
    };
    _nanoSQLQuery.likeCache = {};
    _nanoSQLQuery._sortMemoized = {};
    _nanoSQLQuery._selectArgsMemoized = {};
    _nanoSQLQuery._whereMemoized = {};
    return _nanoSQLQuery;
}());
exports._nanoSQLQuery = _nanoSQLQuery;
//# sourceMappingURL=query.js.map