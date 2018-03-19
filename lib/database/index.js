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
var query_1 = require("./query");
var utilities_1 = require("../utilities");
var storage_1 = require("./storage");
var NanoSQLDefaultBackend = /** @class */ (function () {
    function NanoSQLDefaultBackend() {
        this._queryPool = [];
        this._queryPtr = 0;
    }
    NanoSQLDefaultBackend.prototype.willConnect = function (connectArgs, next) {
        this.parent = connectArgs.parent;
        this._store = new storage_1._NanoSQLStorage(connectArgs.parent, __assign({}, connectArgs.config));
        /*for (let i = 0; i < 100; i++) {
            this._queryPool.push(new _NanoSQLStorageQuery(this._store));
        }*/
        this._store.init(connectArgs.models, function (newModels) {
            connectArgs.models = __assign({}, connectArgs.models, newModels);
            next(connectArgs);
        });
    };
    NanoSQLDefaultBackend.prototype.doExec = function (execArgs, next) {
        execArgs.state = "complete";
        /*this._queryPtr++;
        if (this._queryPtr > this._queryPool.length - 1) {
            this._queryPtr = 0;
        }*/
        new query_1._NanoSQLStorageQuery(this._store).doQuery(execArgs, next);
    };
    /*public transactionBegin(id: string, next: () => void): void {
        next();
    }

    public transactionEnd(id: string, next: () => void): void {
        next();
    }
    */
    NanoSQLDefaultBackend.prototype.dumpTables = function (tables) {
        var _this = this;
        return new utilities_1.Promise(function (res, rej) {
            var dump = {};
            var exportTables = tables && tables.length ? tables : Object.keys(_this._store.tableInfo);
            utilities_1.fastALL(exportTables, function (table, i, done) {
                dump[table] = [];
                _this._store.adapters[0].adapter.rangeRead(table, function (r, idx, rowDone) {
                    dump[table].push(r);
                    rowDone();
                }, done);
            }).then(function () {
                res(dump);
            });
        });
    };
    NanoSQLDefaultBackend.prototype.importTables = function (tables) {
        var _this = this;
        return new utilities_1.Promise(function (res, rej) {
            utilities_1.fastALL(Object.keys(tables), function (tableName, i, done) {
                var pkKey = _this._store.tableInfo[tableName]._pk;
                utilities_1.fastALL(tables[tableName], function (row, i, done) {
                    if (row[pkKey]) {
                        _this._store.adapters[0].adapter.write(tableName, row[pkKey], row, done);
                    }
                    else {
                        done();
                    }
                }).then(done);
            }).then(function () {
                res();
            });
        });
    };
    NanoSQLDefaultBackend.prototype.extend = function (next, args, result) {
        var _this = this;
        switch (args[0]) {
            case "clone":
                var nSQLi_1 = new index_1.NanoSQLInstance();
                Object.keys(this.parent.dataModels).forEach(function (table) {
                    nSQLi_1.table(table).model(_this.parent.dataModels[table], [], true);
                });
                nSQLi_1
                    .config({
                    id: this._store._id,
                    mode: args[1]
                })
                    .connect().then(function () {
                    var i = 0;
                    utilities_1.fastCHAIN(Object.keys(_this.parent.dataModels), function (table, i, done) {
                        console.log("Importing " + table + "...");
                        _this.parent.rawDump([table])
                            .then(function (data) {
                            return nSQLi_1.rawImport(data);
                        })
                            .then(done);
                    }).then(function () {
                        next(args, []);
                    });
                });
                break;
            case "get_adapter":
                if (!args[1]) {
                    next(args, [this._store.adapters[0].adapter]);
                }
                else {
                    next(args, [this._store.adapters[args[1]].adapter]);
                }
                break;
            case "idx.length":
            case "idx":
                var table = args[1];
                if (Object.keys(this._store.tableInfo).indexOf(table) > -1) {
                    this._store.adapters[0].adapter.getIndex(table, args[0] !== "idx", function (idx) {
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
                    utilities_1.fastALL(Object.keys(this._store.tableInfo), function (table, i, done) {
                        _this._store.rebuildIndexes(table, done);
                    }).then(function (times) {
                        next(args, times);
                    });
                }
                break;
            case "clear_cache":
                if (args[1] && args[2]) {
                    this._store._invalidateCache(args[1], args[2]);
                }
                else if (args[1]) {
                    this._store._cache[args[1]] = {};
                    this._store._cacheKeys[args[1]] = {};
                }
                else {
                    Object.keys(this._store.tableInfo).forEach(function (table) {
                        _this._store._cache[table] = {};
                        _this._store._cacheKeys[table] = {};
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
