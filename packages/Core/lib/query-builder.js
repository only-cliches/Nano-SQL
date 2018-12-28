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
var _NanoSQLQueryBuilder = /** @class */ (function () {
    function _NanoSQLQueryBuilder(db, table, queryAction, queryArgs, actionOrView) {
        this._db = db;
        this._AV = actionOrView || "";
        if (typeof queryAction === "string") {
            this._query = __assign({}, utilities_1.buildQuery(db, table, queryAction), { comments: [], state: "pending", action: queryAction, actionArgs: queryArgs, result: [] });
        }
        else {
            this._query = __assign({}, utilities_1.buildQuery(db, table, ""), queryAction(db), { state: "pending" });
        }
    }
    _NanoSQLQueryBuilder.prototype.where = function (args) {
        this._query.where = args;
        return this;
    };
    _NanoSQLQueryBuilder.prototype.orderBy = function (args) {
        this._query.orderBy = args;
        return this;
    };
    _NanoSQLQueryBuilder.prototype.groupBy = function (columns) {
        this._query.groupBy = columns;
        return this;
    };
    _NanoSQLQueryBuilder.prototype.having = function (args) {
        this._query.having = args;
        return this;
    };
    _NanoSQLQueryBuilder.prototype.join = function (args) {
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
    _NanoSQLQueryBuilder.prototype.limit = function (args) {
        this._query.limit = args;
        return this;
    };
    _NanoSQLQueryBuilder.prototype.comment = function (comment) {
        this._query.comments.push(comment);
        return this;
    };
    _NanoSQLQueryBuilder.prototype.tag = function (tag) {
        this._query.tags.push(tag);
        return this;
    };
    _NanoSQLQueryBuilder.prototype.extend = function (scope) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        this._query.extend.push({ scope: scope, args: args });
        return this;
    };
    _NanoSQLQueryBuilder.prototype.union = function (queries, unionAll) {
        this._query.union = {
            queries: queries,
            type: unionAll ? "all" : "distinct"
        };
        return this;
    };
    _NanoSQLQueryBuilder.prototype.offset = function (args) {
        this._query.offset = args;
        return this;
    };
    _NanoSQLQueryBuilder.prototype.emit = function () {
        return this._query;
    };
    _NanoSQLQueryBuilder.prototype.ttl = function (seconds, cols) {
        if (seconds === void 0) { seconds = 60; }
        if (this._query.action !== "upsert") {
            throw new Error("nSQL: Can only do ttl on upsert queries!");
        }
        this._query.ttl = seconds;
        this._query.ttlCols = cols || [];
        return this;
    };
    _NanoSQLQueryBuilder.prototype.graph = function (ormArgs) {
        this._query.graph = ormArgs;
        return this;
    };
    _NanoSQLQueryBuilder.prototype.from = function (tableObj) {
        if (typeof tableObj === "string") {
            this._query.table = tableObj;
        }
        else {
            this._query.table = tableObj.table;
            this._query.tableAS = tableObj.as;
        }
        return this;
    };
    _NanoSQLQueryBuilder.prototype.into = function (table) {
        this._query.table = table;
        return this;
    };
    _NanoSQLQueryBuilder.prototype.on = function (table) {
        this._query.table = table;
        return this;
    };
    _NanoSQLQueryBuilder.prototype.toCSV = function (headers) {
        var t = this;
        return t.exec().then(function (json) { return Promise.resolve(t._db.JSONtoCSV(json, headers)); });
    };
    _NanoSQLQueryBuilder.prototype.exec = function (returnEvents) {
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
    _NanoSQLQueryBuilder.prototype.streamEvent = function (onRow, complete, err) {
        this._query.returnEvent = true;
        this._db.triggerQuery(this._query, onRow, complete, err);
    };
    _NanoSQLQueryBuilder.prototype.stream = function (onRow, complete, err) {
        this._db.triggerQuery(this._query, onRow, complete, err);
    };
    _NanoSQLQueryBuilder.prototype.cache = function () {
        var _this = this;
        return new Promise(function (res, rej) {
            var id = utilities_1.uuid();
            _this.exec().then(function (rows) {
                _this._db._queryCache[id] = rows;
                res({
                    id: id,
                    total: rows.length
                });
            }).catch(rej);
        });
    };
    return _NanoSQLQueryBuilder;
}());
exports._NanoSQLQueryBuilder = _NanoSQLQueryBuilder;
//# sourceMappingURL=query-builder.js.map