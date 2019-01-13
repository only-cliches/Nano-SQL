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
    _nanoSQLQueryBuilder.prototype.streamEvent = function (onRow, complete, err) {
        this._query.returnEvent = true;
        this._db.triggerQuery(this._query, onRow, complete, err);
    };
    _nanoSQLQueryBuilder.prototype.stream = function (onRow, complete, err) {
        this._db.triggerQuery(this._query, onRow, complete, err);
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
//# sourceMappingURL=query-builder.js.map