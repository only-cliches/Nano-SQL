var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("./utilities");
var equal = require("fast-deep-equal");
// tslint:disable-next-line
var _nanoSQLQueryBuilder = /** @class */ (function () {
    function _nanoSQLQueryBuilder(db, table, queryAction, queryArgs, actionOrView) {
        this._db = db;
        this._AV = actionOrView || "";
        if (typeof queryAction === "string") {
            this._query = __assign({}, utilities_1.buildQuery(db, table, queryAction), { comments: [], state: "pending", action: queryAction, actionArgs: queryArgs, result: [] });
        }
        else {
            this._query = __assign({}, queryAction(db), { state: "pending", result: [] });
        }
    }
    _nanoSQLQueryBuilder.prototype.where = function (args) {
        this._query.where = args;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.orderBy = function (columns) {
        if (Array.isArray(columns)) {
            this._query.orderBy = columns;
        }
        else {
            this._query.orderBy = Object.keys(columns).map(function (col) { return col + " " + String(columns[col]).toUpperCase(); });
        }
        return this;
    };
    _nanoSQLQueryBuilder.prototype.distinct = function (columns) {
        this._query.distinct = columns;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.groupBy = function (columns) {
        if (Array.isArray(columns)) {
            this._query.groupBy = columns;
        }
        else {
            this._query.groupBy = Object.keys(columns).map(function (col) { return col + " " + String(columns[col]).toUpperCase(); });
        }
        return this;
    };
    _nanoSQLQueryBuilder.prototype.having = function (args) {
        this._query.having = args;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.join = function (args) {
        var _this = this;
        var err = "Join commands requires table and type arguments!";
        if (Array.isArray(args)) {
            args.forEach(function (arg) {
                if (!arg.with.table || !arg.type) {
                    _this._error = err;
                }
            });
        }
        else {
            if (!args.with.table || !args.type) {
                this._error = err;
            }
        }
        this._query.join = args;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.limit = function (args) {
        this._query.limit = args;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.comment = function (comment) {
        this._query.comments.push(comment);
        return this;
    };
    _nanoSQLQueryBuilder.prototype.tag = function (tag) {
        this._query.tags.push(tag);
        return this;
    };
    _nanoSQLQueryBuilder.prototype.extend = function (scope) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        this._query.extend.push({ scope: scope, args: args });
        return this;
    };
    _nanoSQLQueryBuilder.prototype.union = function (queries, unionAll) {
        this._query.union = {
            queries: queries,
            type: unionAll ? "all" : "distinct"
        };
        return this;
    };
    _nanoSQLQueryBuilder.prototype.offset = function (args) {
        this._query.offset = args;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.emit = function () {
        return this._query;
    };
    _nanoSQLQueryBuilder.prototype.ttl = function (seconds, cols) {
        if (seconds === void 0) { seconds = 60; }
        if (this._query.action !== "upsert") {
            throw new Error("nSQL: Can only do ttl on upsert queries!");
        }
        this._query.ttl = seconds;
        this._query.ttlCols = cols || [];
        return this;
    };
    _nanoSQLQueryBuilder.prototype.graph = function (ormArgs) {
        this._query.graph = ormArgs;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.from = function (tableObj) {
        if (typeof tableObj === "string") {
            this._query.table = tableObj;
        }
        else {
            this._query.table = tableObj.table;
            this._query.tableAS = tableObj.as;
        }
        return this;
    };
    _nanoSQLQueryBuilder.prototype.into = function (table) {
        this._query.table = table;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.on = function (table) {
        this._query.table = table;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.toCSV = function (headers) {
        var t = this;
        return t.exec().then(function (json) { return Promise.resolve(t._db.JSONtoCSV(json, headers)); });
    };
    _nanoSQLQueryBuilder.prototype.exec = function (returnEvents) {
        var _this = this;
        return new Promise(function (res, rej) {
            var buffer = [];
            _this._query.returnEvent = returnEvents;
            _this.stream(function (row) {
                if (row) {
                    buffer.push(row);
                }
            }, function () {
                res(buffer);
            }, rej);
        });
    };
    _nanoSQLQueryBuilder.prototype.listen = function (args) {
        return new _nanoSQLObserverQuery(this._query, args && args.debounce, args && args.unique, args && args.compareFn);
    };
    _nanoSQLQueryBuilder.prototype.stream = function (onRow, complete, err, events) {
        this._query.returnEvent = events;
        if (this._db.state.exportQueryObj) {
            onRow(this._query);
            complete();
        }
        else {
            this._db.triggerQuery(this._query, onRow, complete, err);
        }
    };
    _nanoSQLQueryBuilder.prototype.cache = function (cacheReady, error, streamPages) {
        var _this = this;
        var id = utilities_1.uuid();
        var buffer = [];
        var didPage = false;
        var pageNum = 0;
        var streamObj = streamPages || { pageSize: 0, onPage: utilities_1.noop };
        this.stream(function (row) {
            buffer.push(row);
            if (streamObj.pageSize && streamObj.onPage && buffer.length % streamObj.pageSize === 0) {
                didPage = true;
                streamObj.onPage(pageNum, buffer.slice(buffer.length - streamObj.pageSize));
                pageNum++;
                if (streamObj.doNotCache) {
                    buffer = [];
                }
            }
        }, function () {
            if (streamObj.pageSize && streamObj.onPage) {
                if (!didPage || streamObj.doNotCache) { // didn't make it to the page size in total records
                    streamObj.onPage(0, buffer.slice());
                }
                else { // grab the remaining records
                    streamObj.onPage(pageNum, buffer.slice(pageNum * streamObj.pageSize));
                }
            }
            if (!streamObj.doNotCache) {
                _this._db._queryCache[id] = buffer;
                cacheReady(id, buffer.length);
            }
            else {
                buffer = [];
                cacheReady("", 0);
            }
        }, error);
    };
    return _nanoSQLQueryBuilder;
}());
exports._nanoSQLQueryBuilder = _nanoSQLQueryBuilder;
var observerType;
(function (observerType) {
    observerType[observerType["stream"] = 0] = "stream";
    observerType[observerType["exec"] = 1] = "exec";
})(observerType || (observerType = {}));
var _nanoSQLObserverQuery = /** @class */ (function () {
    function _nanoSQLObserverQuery(query, debounce, unique, compareFn) {
        if (debounce === void 0) { debounce = 500; }
        if (unique === void 0) { unique = false; }
        if (compareFn === void 0) { compareFn = equal; }
        var _this = this;
        this.query = query;
        this.debounce = debounce;
        this.unique = unique;
        this.compareFn = compareFn;
        this._listenTables = [];
        this._active = true;
        this.trigger = this.trigger.bind(this);
        this._doQuery = this._doQuery.bind(this);
        this._cbs = {
            stream: [utilities_1.noop, utilities_1.noop, utilities_1.noop, false],
            exec: [utilities_1.noop, false]
        };
        if (typeof query.table !== "string") {
            throw new Error("Can't listen on dynamic tables!");
        }
        if (query.action !== "select") {
            throw new Error("Can't listen to this kind of query!");
        }
        // detect tables to listen for
        this._listenTables.push(query.table);
        if (query.join) {
            var join = Array.isArray(query.join) ? query.join : [query.join];
            this._listenTables.concat(this._getTables(join));
        }
        if (query.graph) {
            var graph = Array.isArray(query.graph) ? query.graph : [query.graph];
            this._listenTables.concat(this._getTables(graph));
        }
        // remove duplicate tables
        this._listenTables = this._listenTables.filter(function (v, i, s) { return s.indexOf(v) === i; });
        this._listenTables.forEach(function (table) {
            query.parent.on("change", _this._throttleTrigger, table);
        });
        this._throttleTrigger = utilities_1.throttle(this, this._doQuery, debounce);
    }
    _nanoSQLObserverQuery.prototype._getTables = function (objects) {
        var _this = this;
        var tables = [];
        objects.forEach(function (j) {
            if (j.with && j.with.table && typeof j.with.table === "string") {
                tables.push(j.with.table);
            }
            var nestedGraph = j.graph;
            if (nestedGraph) {
                var graph = Array.isArray(nestedGraph) ? nestedGraph : [nestedGraph];
                tables.concat(_this._getTables(graph));
            }
        });
        return tables;
    };
    _nanoSQLObserverQuery.prototype._doQuery = function () {
        var _this = this;
        if (!this._active || typeof this._mode === "undefined")
            return;
        switch (this._mode) {
            case observerType.stream:
                this.query.returnEvent = this._cbs.stream[3];
                this.query.parent.triggerQuery(this.query, this._cbs.stream[0], this._cbs.stream[1], this._cbs.stream[2]);
                break;
            case observerType.exec:
                this.query.returnEvent = this._cbs.exec[1];
                var rows_1 = [];
                this.query.parent.triggerQuery(this.query, function (row) {
                    rows_1.push(row);
                }, function () {
                    if (_this.unique) {
                        var trigger = false;
                        if (!_this._oldValues) { // if no previous values, show results
                            trigger = true;
                        }
                        else {
                            if (_this._oldValues.length !== rows_1.length) { // if the query length is different, show results
                                trigger = true;
                            }
                            else {
                                trigger = !_this.compareFn(_this._oldValues, rows_1); // finally, deep equality check (slow af)
                            }
                        }
                        if (trigger) {
                            _this._oldValues = rows_1;
                            _this._cbs.exec[0](utilities_1.assign(rows_1));
                        }
                    }
                    else {
                        _this._cbs.exec[0](rows_1);
                    }
                }, function (err) {
                    _this._cbs.exec[0]([], err);
                });
                break;
        }
    };
    _nanoSQLObserverQuery.prototype._maybeError = function () {
        if (typeof this._mode !== "undefined") {
            throw new Error("Listen can't have multiple exports!");
        }
    };
    _nanoSQLObserverQuery.prototype.trigger = function () {
        this._throttleTrigger();
    };
    _nanoSQLObserverQuery.prototype.stream = function (onRow, complete, error, events) {
        if (this.unique) {
            throw new Error("Can't use unique with stream listener!");
        }
        this._maybeError();
        this._mode = observerType.stream;
        this._cbs.stream = [onRow, complete, error, events || false];
        this._doQuery();
    };
    _nanoSQLObserverQuery.prototype.exec = function (callback, events) {
        this._maybeError();
        this._mode = observerType.exec;
        this._cbs.exec = [callback, events || false];
        this._doQuery();
    };
    _nanoSQLObserverQuery.prototype.unsubscribe = function () {
        var _this = this;
        this._active = false;
        this._listenTables.forEach(function (table) {
            _this.query.parent.off("change", _this._throttleTrigger, table);
        });
    };
    return _nanoSQLObserverQuery;
}());
//# sourceMappingURL=query-builder.js.map