var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var lie_ts_1 = require("lie-ts");
var std_query_1 = require("./query/std-query");
var transaction_1 = require("./query/transaction");
var really_small_events_1 = require("really-small-events");
var utilities_1 = require("./utilities");
var index_1 = require("./database/index");
var history_plugin_1 = require("./history-plugin");
var str = ["_util"];
var NanoSQLInstance = (function () {
    function NanoSQLInstance() {
        this.version = 1;
        var t = this;
        t._actions = {};
        t._views = {};
        t._models = {};
        t._events = ["*", "change", "delete", "upsert", "drop", "select", "error"];
        t._hasEvents = {};
        t._tableNames = [];
        t._plugins = [];
        t._callbacks = {};
        t._callbacks["*"] = new really_small_events_1.ReallySmallEvents();
        t._instanceBackend = new index_1.NanoSQLDefaultBackend();
        var instanceConnectArgs = {
            models: {},
            actions: {},
            views: {},
            config: {},
            parent: this
        };
        if (t._instanceBackend.willConnect) {
            t._instanceBackend.willConnect(instanceConnectArgs, function () {
                if (t._instanceBackend.didConnect) {
                    t._instanceBackend.didConnect(instanceConnectArgs, function () {
                    });
                }
            });
        }
    }
    NanoSQLInstance.prototype.table = function (table) {
        if (table)
            this.sTable = table;
        return this;
    };
    NanoSQLInstance.prototype.connect = function () {
        var _this = this;
        var t = this;
        return new utilities_1.Promise(function (res, rej) {
            var connectArgs = {
                models: t._models,
                actions: t._actions,
                views: t._views,
                config: t._config,
                parent: _this,
            };
            connectArgs.models[str[0]] = [
                { key: "key", type: "string", props: ["pk", "ai"] },
                { key: "value", type: "any" }
            ];
            if (t._config && t._config.history) {
                _this.use(new history_plugin_1._NanoSQLHistoryPlugin(t._config.historyMode));
            }
            if (!t._config || t._config.mode !== false) {
                _this.use(new index_1.NanoSQLDefaultBackend());
            }
            new utilities_1.CHAIN(_this._plugins.map(function (p) {
                return function (nextP) {
                    if (p.willConnect) {
                        p.willConnect(connectArgs, function (newArgs) {
                            connectArgs = newArgs;
                            nextP();
                        });
                    }
                    else {
                        nextP();
                    }
                };
            })).then(function () {
                _this._models = connectArgs.models;
                _this._actions = connectArgs.actions;
                _this._views = connectArgs.views;
                _this._config = connectArgs.config;
                _this._plugins.forEach(function (plugin) {
                    if (plugin.didExec) {
                        _this.pluginsDoHasExec = true;
                    }
                });
                t._tableNames = Object.keys(_this._models);
                var completeConnect = function () {
                    new utilities_1.ALL(_this._plugins.map(function (p) {
                        return function (nextP) {
                            if (p.didConnect) {
                                p.didConnect(connectArgs, function () {
                                    nextP();
                                });
                            }
                            else {
                                nextP();
                            }
                        };
                    })).then(function () {
                        res(t._tableNames);
                    });
                };
                _this.query("select").where(["key", "=", "version"]).manualExec({ table: "_util" }).then(function (rows) {
                    if (!rows.length) {
                        _this.query("upsert", { key: "version", value: _this.version }).manualExec({ table: "_util" }).then(function () {
                            _this.extend("rebuild_idx").then(function () {
                                completeConnect();
                            });
                        });
                    }
                    else {
                        completeConnect();
                    }
                });
            });
        });
    };
    NanoSQLInstance.prototype.getConfig = function () {
        return utilities_1._assign(this._config || {});
    };
    NanoSQLInstance.prototype.avFilter = function (filterFunc) {
        this._AVMod = filterFunc;
        return this;
    };
    NanoSQLInstance.prototype.use = function (plugin) {
        return this._plugins.push(plugin), this;
    };
    NanoSQLInstance.prototype.on = function (actions, callBack) {
        var t = this;
        var l = t.sTable;
        var i = t._events.length;
        var a = actions.split(" ");
        if (Array.isArray(l))
            return this;
        if (!t._callbacks[l]) {
            t._callbacks[l] = new really_small_events_1.ReallySmallEvents();
        }
        i = a.length;
        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l].on(a[i], callBack);
            }
        }
        return t._refreshEventChecker();
    };
    NanoSQLInstance.prototype.off = function (actions, callBack) {
        var t = this;
        var a = actions.split(" ");
        var i = a.length;
        var l = t.sTable;
        if (Array.isArray(l))
            return this;
        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l].off(a[i], callBack);
            }
        }
        return t._refreshEventChecker();
    };
    NanoSQLInstance.prototype._refreshEventChecker = function () {
        var _this = this;
        this._hasEvents = {};
        Object.keys(this._models).concat(["*"]).forEach(function (table) {
            _this._hasEvents[table] = _this._events.reduce(function (prev, cur) {
                return prev + (_this._callbacks[table] && _this._callbacks[table].eventListeners[cur] ? _this._callbacks[table].eventListeners[cur].length : 0);
            }, 0) > 0;
        });
        return this;
    };
    NanoSQLInstance.prototype.model = function (dataModel) {
        var t = this;
        var l = t.sTable;
        if (Array.isArray(l))
            return this;
        if (!t._callbacks[l]) {
            t._callbacks[l] = new really_small_events_1.ReallySmallEvents();
        }
        t._models[l] = dataModel;
        t._views[l] = [];
        t._actions[l] = [];
        return t;
    };
    NanoSQLInstance.prototype.views = function (viewArray) {
        if (Array.isArray(this.sTable))
            return this;
        return this._views[this.sTable] = viewArray, this;
    };
    NanoSQLInstance.prototype.getView = function (viewName, viewArgs) {
        if (viewArgs === void 0) { viewArgs = {}; }
        if (Array.isArray(this.sTable))
            return new utilities_1.Promise(function (res, rej) { return rej(); });
        return this._doAV("View", this._views[this.sTable], viewName, viewArgs);
    };
    NanoSQLInstance.prototype.actions = function (actionArray) {
        if (Array.isArray(this.sTable))
            return this;
        return this._actions[this.sTable] = actionArray, this;
    };
    NanoSQLInstance.prototype.doAction = function (actionName, actionArgs) {
        if (Array.isArray(this.sTable))
            return new utilities_1.Promise(function (res, rej) { return rej(); });
        return this._doAV("Action", this._actions[this.sTable], actionName, actionArgs);
    };
    NanoSQLInstance.prototype.queryFilter = function (callBack) {
        this._queryMod = callBack;
        return this;
    };
    NanoSQLInstance.prototype._avCleanArgs = function (args, argsObj) {
        var _this = this;
        var newObj = {};
        var castTable = function (rowData, argType) {
            if (argType.indexOf("[]") !== -1) {
                var arrayOf_1 = argType.slice(0, argType.lastIndexOf("[]"));
                return (rowData || []).map(function (v) {
                    return castTable(v, arrayOf_1);
                });
            }
            else {
                var newRow_1 = {};
                _this._models[argType].forEach(function (model) {
                    newRow_1[model.key] = utilities_1.cast(model.type, rowData[model.key]);
                });
                return newRow_1;
            }
        };
        (args || []).forEach(function (arg) {
            var argDetail = arg.split(":");
            if (argDetail.length === 1 && argsObj[arg] !== undefined) {
                newObj[arg] = argsObj[arg];
            }
            else {
                var argKey = argDetail[0];
                var argType = argDetail[1];
                if (Object.keys(_this._models).indexOf(argType.replace(/\[\]/g, "")) !== -1) {
                    var rowData = argsObj[argKey] || (argType.indexOf("[]") !== -1 ? [] : {});
                    newObj[argKey] = castTable(rowData, argType);
                }
                else {
                    newObj[argKey] = utilities_1.cast(argType, argsObj[argKey]);
                }
            }
        });
        return newObj;
    };
    NanoSQLInstance.prototype._doAV = function (AVType, AVList, AVName, AVargs) {
        var _this = this;
        var t = this;
        var selAV = AVList.reduce(function (prev, cur) {
            if (cur.name === AVName)
                return cur;
            return prev;
        }, null);
        if (!selAV) {
            return new utilities_1.Promise(function (res, rej) { return rej("Action/View Not Found!"); });
        }
        t._activeAV = AVName;
        if (t._AVMod) {
            return new utilities_1.Promise(function (res, rej) {
                t._AVMod(_this.sTable, AVType, t._activeAV || "", AVargs, function (args) {
                    selAV.call(selAV.args ? utilities_1.cleanArgs(selAV.args, args) : {}, t).then(res).catch(rej);
                }, function (err) {
                    rej(err);
                });
            });
        }
        else {
            return selAV.call(selAV.args ? utilities_1.cleanArgs(selAV.args, AVargs) : {}, t);
        }
    };
    NanoSQLInstance.prototype.query = function (action, args) {
        var t = this;
        var query = new std_query_1._NanoSQLQuery(t.sTable, t, action.toLowerCase(), args, t._activeAV);
        t._activeAV = undefined;
        return query;
    };
    NanoSQLInstance.prototype.triggerEvent = function (eventData) {
        var t = this;
        if (t._hasEvents["*"] || t._hasEvents[eventData.table]) {
            lie_ts_1.setFast(function () {
                var c;
                eventData.types.forEach(function (type) {
                    t._callbacks["*"].trigger(type, eventData, t);
                    t._callbacks["*"].trigger("*", eventData, t);
                    if (eventData.table && t._callbacks[eventData.table]) {
                        t._callbacks[eventData.table].trigger(type, eventData, t);
                    }
                });
            });
        }
        return t;
    };
    NanoSQLInstance.prototype.default = function (replaceObj) {
        var newObj = {};
        var t = this;
        if (Array.isArray(t.sTable))
            return {};
        t._models[t.sTable].forEach(function (m) {
            newObj[m.key] = (replaceObj && replaceObj[m.key]) ? replaceObj[m.key] : m.default;
            if (newObj[m.key] === undefined) {
                newObj[m.key] = utilities_1.cast(m.type, null);
            }
        });
        return newObj;
    };
    NanoSQLInstance.prototype.doTransaction = function (initTransaction) {
        var _this = this;
        var t = this;
        var queries = [];
        var transactionID = utilities_1.random16Bits().toString(16);
        return new utilities_1.Promise(function (resolve, reject) {
            if (!t._plugins.length) {
                reject("Nothing to do, no plugins!");
                return;
            }
            new utilities_1.CHAIN(t._plugins.map(function (p) {
                return function (nextP) {
                    if (p.transactionBegin) {
                        p.transactionBegin(transactionID, nextP);
                    }
                    else {
                        nextP();
                    }
                };
            })).then(function () {
                if (Array.isArray(t.sTable))
                    return;
                initTransaction(function (table) {
                    var ta = table || t.sTable;
                    return {
                        query: function (action, args) {
                            return new transaction_1._NanoSQLTransactionQuery(action, args, ta, queries, transactionID);
                        }
                    };
                }, function () {
                    var tables = [];
                    new utilities_1.CHAIN(queries.map(function (quer) {
                        return function (nextQuery) {
                            tables.push(quer.table);
                            t.query(quer.action, quer.actionArgs).manualExec(__assign({}, quer, { table: quer.table, transaction: true, queryID: transactionID })).then(nextQuery);
                        };
                    })).then(function (results) {
                        new utilities_1.CHAIN(_this._plugins.map(function (p) {
                            return function (nextP) {
                                if (p.transactionEnd) {
                                    p.transactionEnd(transactionID, nextP);
                                }
                                else {
                                    nextP();
                                }
                            };
                        })).then(function () {
                            tables.filter(function (val, idx, self) {
                                return self.indexOf(val) === idx;
                            }).forEach(function (table) {
                                if (table.indexOf("_") !== 0) {
                                    t.triggerEvent({
                                        query: queries[0],
                                        table: table,
                                        time: new Date().getTime(),
                                        result: results,
                                        types: ["transaction"],
                                        actionOrView: "",
                                        notes: [],
                                        transactionID: transactionID,
                                        affectedRowPKS: [],
                                        affectedRows: []
                                    });
                                }
                            });
                            resolve(results);
                        });
                    });
                });
            });
        });
    };
    NanoSQLInstance.prototype.config = function (args) {
        this._config = args;
        return this;
    };
    NanoSQLInstance.prototype.extend = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var t = this;
        return new utilities_1.Promise(function (res, rej) {
            if (t._plugins.length) {
                var newArgs_1 = utilities_1._assign(args);
                var result_1 = [];
                new utilities_1.CHAIN(t._plugins.map(function (p) {
                    return function (nextP) {
                        if (p.extend) {
                            p.extend(function (nArgs, newResult) {
                                newArgs_1 = nArgs;
                                result_1 = newResult;
                                nextP();
                            }, newArgs_1, result_1);
                        }
                        else {
                            nextP();
                        }
                    };
                })).then(function () {
                    res(result_1);
                });
            }
            else {
                rej("No plugins!");
            }
        });
    };
    NanoSQLInstance.prototype.loadJS = function (table, rows, useTransaction) {
        if (useTransaction === void 0) { useTransaction = true; }
        var t = this;
        if (useTransaction) {
            return t.doTransaction(function (db, complete) {
                rows.forEach(function (row) {
                    db(table).query("upsert", row).exec();
                });
                complete();
            });
        }
        else {
            return new utilities_1.Promise(function (res, rej) {
                new utilities_1.CHAIN(rows.map(function (row) {
                    return function (nextRow) {
                        exports.nSQL().query("upsert", row).manualExec({ table: table }).then(nextRow);
                    };
                })).then(function (rows) {
                    res(rows.map(function (r) { return r.shift(); }));
                });
            });
        }
    };
    NanoSQLInstance.prototype.loadCSV = function (table, csv, useTransaction) {
        if (useTransaction === void 0) { useTransaction = true; }
        var t = this;
        var fields = [];
        var rowData = csv.split("\n").map(function (v, k) {
            if (k === 0) {
                fields = v.split(",");
                return undefined;
            }
            else {
                var record = {};
                var row = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                var i = fields.length;
                while (i--) {
                    if (row[i].indexOf("{") === 1 || row[i].indexOf("[") === 1) {
                        row[i] = JSON.parse(row[i].slice(1, row[i].length - 1).replace(/'/gm, '\"'));
                    }
                    else if (row[i].indexOf('"') === 0) {
                        row[i] = row[i].slice(1, row[i].length - 1);
                    }
                    record[fields[i]] = row[i];
                }
                return record;
            }
        }).filter(function (r) { return r; });
        if (useTransaction) {
            return t.doTransaction(function (db, complete) {
                rowData.forEach(function (row) {
                    db(table).query("upsert", row).exec();
                });
                complete();
            });
        }
        else {
            return new utilities_1.Promise(function (res, rej) {
                new utilities_1.CHAIN(rowData.map(function (row) {
                    return function (nextRow) {
                        exports.nSQL().query("upsert", row).manualExec({ table: table }).then(nextRow);
                    };
                })).then(function (rows) {
                    res(rows.map(function (r) { return r.shift(); }));
                });
            });
        }
    };
    return NanoSQLInstance;
}());
exports.NanoSQLInstance = NanoSQLInstance;
NanoSQLInstance.functions = {
    COUNT: {
        type: "A",
        call: function (rows, complete, column) {
            if (column && column !== "*") {
                complete(rows.filter(function (r) { return utilities_1.objQuery(column, r); }).length);
            }
            else {
                complete(rows.length);
            }
        }
    },
    MAX: {
        type: "A",
        call: function (rows, complete, column) {
            if (rows.length) {
                var max_1 = utilities_1.objQuery(column, rows[0]) || 0;
                rows.forEach(function (r) {
                    var v = utilities_1.objQuery(column, r);
                    if (utilities_1.objQuery(column, r) > max_1) {
                        max_1 = utilities_1.objQuery(column, r);
                    }
                });
                complete(max_1);
            }
            else {
                complete(0);
            }
        }
    },
    MIN: {
        type: "A",
        call: function (rows, complete, column) {
            if (rows.length) {
                var min_1 = utilities_1.objQuery(column, rows[0]) || 0;
                rows.forEach(function (r) {
                    var v = utilities_1.objQuery(column, r);
                    if (v < min_1) {
                        min_1 = v;
                    }
                });
                complete(min_1);
            }
            else {
                complete(0);
            }
        }
    },
    AVG: {
        type: "A",
        call: function (rows, complete, column) {
            complete(rows.reduce(function (prev, cur) { return prev + (utilities_1.objQuery(column, cur) || 0); }, 0) / rows.length);
        }
    },
    SUM: {
        type: "A",
        call: function (rows, complete, column) {
            complete(rows.reduce(function (prev, cur) { return prev + (utilities_1.objQuery(column, cur) || 0); }, 0));
        }
    },
    LOWER: {
        type: "S",
        call: function (rows, complete, column) {
            complete(rows.map(function (r) {
                return String(utilities_1.objQuery(column, r)).toLowerCase();
            }));
        }
    },
    UPPER: {
        type: "S",
        call: function (rows, complete, column) {
            complete(rows.map(function (r) {
                return String(utilities_1.objQuery(column, r)).toUpperCase();
            }));
        }
    },
    CAST: {
        type: "S",
        call: function (rows, complete, column, type) {
            complete(rows.map(function (r) {
                return utilities_1.cast(type, utilities_1.objQuery(column, r));
            }));
        }
    },
    ABS: {
        type: "S",
        call: function (rows, complete, column) {
            complete(rows.map(function (r) {
                return Math.abs(utilities_1.objQuery(column, r));
            }));
        }
    },
    CEIL: {
        type: "S",
        call: function (rows, complete, column) {
            complete(rows.map(function (r) {
                return Math.ceil(utilities_1.objQuery(column, r));
            }));
        }
    },
    POW: {
        type: "S",
        call: function (rows, complete, column, power) {
            complete(rows.map(function (r) {
                return Math.pow(utilities_1.objQuery(column, r), parseInt(power));
            }));
        }
    },
    ROUND: {
        type: "S",
        call: function (rows, complete, column) {
            complete(rows.map(function (r) {
                return Math.round(utilities_1.objQuery(column, r));
            }));
        }
    },
    SQRT: {
        type: "S",
        call: function (rows, complete, column) {
            complete(rows.map(function (r) {
                return Math.sqrt(utilities_1.objQuery(column, r));
            }));
        }
    }
};
var _NanoSQLStatic = new NanoSQLInstance();
exports.nSQL = function (setTablePointer) {
    return _NanoSQLStatic.table(setTablePointer);
};
