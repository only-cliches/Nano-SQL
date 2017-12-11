var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var storage_1 = require("./storage");
var query_1 = require("./query");
var utilities_1 = require("../utilities");
var NanoSQLDefaultBackend = (function () {
    function NanoSQLDefaultBackend() {
    }
    NanoSQLDefaultBackend.prototype.willConnect = function (connectArgs, next) {
        this.parent = connectArgs.parent;
        this._store = new storage_1._NanoSQLStorage(connectArgs.parent, __assign({}, connectArgs.config));
        this._store.init(connectArgs.models, function (newModels) {
            connectArgs.models = __assign({}, connectArgs.models, newModels);
            next(connectArgs);
        });
    };
    NanoSQLDefaultBackend.prototype.doExec = function (execArgs, next) {
        execArgs.state = "complete";
        new query_1._NanoSQLStorageQuery(this._store).doQuery(execArgs, next);
    };
    NanoSQLDefaultBackend.prototype.extend = function (next, args, result) {
        var _this = this;
        switch (args[0]) {
            case "idx.length":
            case "idx":
                var table = args[1];
                if (Object.keys(this._store.tableInfo).indexOf(table) > -1) {
                    this._store._adapter.getIndex(table, args[0] !== "idx", function (idx) {
                        next(args, idx);
                    });
                }
                else {
                    next(args, []);
                }
                break;
            case "rebuild_idx":
                if (args[1]) {
                    this._store.rebuildIndexes(args[1], function (time) {
                        next(args, [time]);
                    });
                }
                else {
                    new utilities_1.ALL(Object.keys(this._store.tableInfo).map(function (table) {
                        return function (done) {
                            _this._store.rebuildIndexes(table, done);
                        };
                    })).then(function (times) {
                        next(args, times);
                    });
                }
                break;
            case "clear_cache":
                if (args[1]) {
                    this._store._cache[args[1]] = {};
                }
                else {
                    Object.keys(this._store.tableInfo).forEach(function (table) {
                        _this._store._cache[table] = {};
                    });
                }
                next(args, args[1] || Object.keys(this._store.tableInfo));
                break;
            default:
                next(args, result);
        }
    };
    return NanoSQLDefaultBackend;
}());
exports.NanoSQLDefaultBackend = NanoSQLDefaultBackend;
