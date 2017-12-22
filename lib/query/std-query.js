var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("../utilities");
var _NanoSQLQuery = (function () {
    function _NanoSQLQuery(table, db, queryAction, queryArgs, actionOrView) {
        this._db = db;
        this._AV = actionOrView || "";
        this._query = {
            table: table,
            comments: [],
            state: "pending",
            queryID: new Date().getTime() + "-" + Math.round(Math.random() * 100),
            action: queryAction,
            actionArgs: queryArgs,
            result: []
        };
    }
    _NanoSQLQuery.prototype.where = function (args) {
        this._query.where = args;
        return this;
    };
    _NanoSQLQuery.prototype.range = function (limit, offset) {
        this._query.range = [limit, offset];
        return this;
    };
    _NanoSQLQuery.prototype.orm = function (ormArgs) {
        this._query.orm = ormArgs;
        return this;
    };
    _NanoSQLQuery.prototype.orderBy = function (args) {
        this._query.orderBy = args;
        return this;
    };
    _NanoSQLQuery.prototype.groupBy = function (columns) {
        this._query.groupBy = columns;
        return this;
    };
    _NanoSQLQuery.prototype.having = function (args) {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Having condition requires an array!";
        }
        this._query.having = args;
        return this;
    };
    _NanoSQLQuery.prototype.join = function (args) {
        if (Array.isArray(this._query.table)) {
            throw Error("Can't JOIN with instance table!");
        }
        if (!args.table || !args.type) {
            this._error = "Join command requires table and type arguments!";
        }
        this._query.join = args;
        return this;
    };
    _NanoSQLQuery.prototype.limit = function (args) {
        this._query.limit = args;
        return this;
    };
    _NanoSQLQuery.prototype.trieSearch = function (column, stringToSearch) {
        this._query.trie = { column: column, search: stringToSearch };
        return this;
    };
    _NanoSQLQuery.prototype.comment = function (comment) {
        this._query.comments.push(comment);
        return this;
    };
    _NanoSQLQuery.prototype.extend = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this._query.extend = args;
        return this;
    };
    _NanoSQLQuery.prototype.offset = function (args) {
        this._query.offset = args;
        return this;
    };
    _NanoSQLQuery.prototype.toCSV = function (headers) {
        var t = this;
        return new utilities_1.Promise(function (res, rej) {
            t.exec().then(function (json) {
                var csv = [];
                if (!json.length) {
                    res("", t);
                }
                if (headers) {
                    csv.push(Object.keys(json[0]).join(","));
                }
                json.forEach(function (row) {
                    csv.push(Object.keys(row).map(function (k) {
                        if (row[k] === null || row[k] === undefined) {
                            return "";
                        }
                        return typeof row[k] === "object" ? '"' + JSON.stringify(row[k]).replace(/\"/g, '\'') + '"' : row[k];
                    }).join(","));
                });
                res(csv.join("\n"), t);
            });
        });
    };
    _NanoSQLQuery.prototype.manualExec = function (query) {
        this._query = __assign({}, this._query, query);
        return this.exec();
    };
    _NanoSQLQuery.prototype.exec = function () {
        var _this = this;
        var t = this;
        var a = this._query.action.toLowerCase();
        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) > -1) {
            var newArgs_1 = this._query.actionArgs || (a === "select" || a === "delete" ? [] : {});
            if (a === "upsert") {
                var inputArgs_1 = {};
                this._db._models[this._query.table].forEach(function (model) {
                    if (newArgs_1[model.key] !== undefined) {
                        inputArgs_1[model.key] = utilities_1.cast(model.type, newArgs_1[model.key]);
                    }
                });
                newArgs_1 = inputArgs_1;
            }
            this._query.action = a;
            this._query.actionArgs = this._query.actionArgs ? newArgs_1 : undefined;
        }
        else {
            throw Error("No valid database action!");
        }
        return new utilities_1.Promise(function (res, rej) {
            if (Array.isArray(_this._query.table)) {
                if (_this._db._instanceBackend.doExec) {
                    _this._db._instanceBackend.doExec(_this._query, function (q) {
                        res(q.result, _this._db);
                    });
                }
                return;
            }
            if (!t._db._plugins.length) {
                t._error = "No plugins, nothing to do!";
            }
            if (t._error) {
                rej(t._error, _this._db);
                return;
            }
            var rows = [];
            var runQuery = function () {
                new utilities_1.CHAIN(t._db._plugins.map(function (p, i) {
                    return function (nextP) {
                        if (p.doExec) {
                            p.doExec(_this._query, function (newQ) {
                                _this._query = newQ || _this._query;
                                nextP();
                            });
                        }
                        else {
                            nextP();
                        }
                    };
                })).then(function () {
                    var eventTypes = (function () {
                        switch (t._query.action) {
                            case "select": return [t._query.action];
                            case "delete":
                            case "upsert":
                            case "drop": return [t._query.action, "change"];
                            default: return [];
                        }
                    })();
                    var hasLength = _this._query.result && _this._query.result.length;
                    var row = { affectedRowPKS: [], affectedRows: [] };
                    res(_this._query.result);
                    if ((_this._db._hasEvents["*"] || _this._db._hasEvents[_this._query.table]) && _this._db.pluginsDoHasExec) {
                        var event_1 = {
                            table: t._query.table,
                            query: t._query,
                            time: new Date().getTime(),
                            result: rows,
                            notes: [],
                            types: eventTypes,
                            actionOrView: t._AV,
                            transactionID: t._query.transaction ? t._query.queryID : undefined,
                            affectedRowPKS: hasLength ? (_this._query.result[0] || row).affectedRowPKS : [],
                            affectedRows: hasLength ? (_this._query.result[0] || row).affectedRows : [],
                        };
                        new utilities_1.CHAIN(t._db._plugins.map(function (p) {
                            return function (nextP) {
                                if (p.didExec) {
                                    p.didExec(event_1, function (newE) {
                                        event_1 = newE;
                                        nextP();
                                    });
                                }
                                else {
                                    nextP();
                                }
                            };
                        })).then(function () {
                            t._db.triggerEvent(event_1);
                        });
                    }
                });
            };
            if (_this._db._queryMod) {
                _this._db._queryMod(_this._query, function (newQ) {
                    _this._query = newQ;
                    runQuery();
                });
            }
            else {
                runQuery();
            }
        });
    };
    return _NanoSQLQuery;
}());
exports._NanoSQLQuery = _NanoSQLQuery;
