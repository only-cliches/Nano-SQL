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
var lie_ts_1 = require("lie-ts");
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
    NanoSQLDefaultBackend.prototype.getId = function () {
        return this._store._id;
    };
    NanoSQLDefaultBackend.prototype.doExec = function (execArgs, next, error) {
        execArgs.state = "complete";
        /*this._queryPtr++;
        if (this._queryPtr > this._queryPool.length - 1) {
            this._queryPtr = 0;
        }*/
        new query_1._NanoSQLStorageQuery(this._store).doQuery(execArgs, next, error);
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
    NanoSQLDefaultBackend.prototype.importTables = function (tables, onProgress) {
        var _this = this;
        return new utilities_1.Promise(function (res, rej) {
            var totalLength = 0;
            var totalProgress = 0;
            Object.keys(tables).forEach(function (table) {
                totalLength += (tables[table] || []).length || 0;
            });
            utilities_1.fastALL(Object.keys(tables), function (tableName, i, done, err) {
                var pkKey = _this._store.tableInfo[tableName]._pk;
                var length = (tables[tableName] || []).length || 0;
                var k = 0;
                var next = function () {
                    if (k < length) {
                        var row = tables[tableName][k];
                        k++;
                        totalProgress++;
                        if (row[pkKey]) {
                            _this._store.adapterWrite(tableName, row[pkKey], row, function () {
                                onProgress(Math.round(((totalProgress + 1) / totalLength) * 10000) / 100);
                                k % 500 === 0 ? lie_ts_1.setFast(next) : next();
                            }, err);
                        }
                        else {
                            onProgress(Math.round(((totalProgress + 1) / totalLength) * 10000) / 100);
                            k % 500 === 0 ? lie_ts_1.setFast(next) : next();
                        }
                    }
                    else {
                        done();
                    }
                };
                next();
            }).then(function () {
                res();
            });
        });
    };
    NanoSQLDefaultBackend.prototype.willDisconnect = function (next) {
        utilities_1.fastALL(this._store.adapters || [], function (adapter, i, done) {
            if (adapter.disconnect) {
                adapter.disconnect(done);
            }
            else {
                done();
            }
        }).then(next);
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
            case "flush":
                var tables_1 = [];
                if (!args[1]) {
                    tables_1 = this.parent.tableNames;
                }
                else {
                    tables_1 = [args[1]];
                }
                utilities_1.fastCHAIN(tables_1, function (table, i, next) {
                    _this._store._drop(table, next);
                }).then(function () {
                    next(args, tables_1);
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
            case "rebuild_search":
                var rebuildTables_1 = (function () {
                    if (args[1])
                        return [args[1]];
                    return Object.keys(_this._store.tableInfo);
                })();
                var progress_1 = args[2];
                utilities_1.fastALL(rebuildTables_1, function (table, i, done) {
                    var totalProgress = 0;
                    var currentProgress = 0;
                    utilities_1.fastALL(rebuildTables_1, function (t, kk, lengthDone) {
                        _this._store.adapters[0].adapter.getIndex(t, true, function (len) {
                            totalProgress += len;
                            lengthDone();
                        });
                    }).then(function () {
                        var tablesToDrop = Object.keys(_this._store.tableInfo[table]._searchColumns).map(function (t) { return "_" + table + "_search_tokens_" + t; });
                        tablesToDrop = tablesToDrop.concat(Object.keys(_this._store.tableInfo[table]._searchColumns).map(function (t) { return "_" + table + "_search_" + t; }));
                        tablesToDrop = tablesToDrop.concat(Object.keys(_this._store.tableInfo[table]._searchColumns).map(function (t) { return "_" + table + "_search_fuzzy_" + t; }));
                        utilities_1.fastALL(tablesToDrop, function (dropTable, i, dropDone) {
                            _this._store.adapterDrop(dropTable, dropDone);
                        }).then(function () {
                            _this._store.adapters[0].adapter.rangeRead(table, function (row, idx, next) {
                                _this.parent.query("upsert", row)
                                    .comment("_rebuild_search_index_")
                                    .manualExec({ table: table }).then(function () {
                                    if (progress_1)
                                        progress_1(Math.round(((currentProgress + 1) / totalProgress) * 10000) / 100);
                                    currentProgress++;
                                    next();
                                });
                            }, done);
                        });
                    });
                }).then(function () {
                    next(args, []);
                });
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
            default:
                next(args, result);
        }
    };
    return NanoSQLDefaultBackend;
}());
exports.NanoSQLDefaultBackend = NanoSQLDefaultBackend;
//# sourceMappingURL=index.js.map