Object.defineProperty(exports, "__esModule", { value: true });
var db_index_1 = require("./db-index");
var lie_ts_1 = require("lie-ts");
var index_query_1 = require("./index-query");
var index_transaction_1 = require("./index-transaction");
exports._assign = function (obj) {
    return JSON.parse(JSON.stringify(obj));
};
var NanoSQLInstance = (function () {
    function NanoSQLInstance() {
        var t = this;
        t._actions = {};
        t._views = {};
        t._models = {};
        t._preConnectExtend = [];
        t._transactionTables = [];
        t._events = ["change", "delete", "upsert", "drop", "select", "error"];
        t._callbacks = {};
        t._ormFns = {};
        t._hasEvents = {};
        t._callbacks["*"] = {};
        t._tableNames = [];
        var i = t._events.length;
        while (i--) {
            t._callbacks["*"][t._events[i]] = [];
        }
        t._functions = {};
        t._rowFilters = {};
    }
    NanoSQLInstance.prototype.table = function (table) {
        if (table)
            this._selectedTable = table;
        return this;
    };
    NanoSQLInstance.prototype.connect = function (backend) {
        var _this = this;
        var t = this;
        if (t.backend) {
            return new lie_ts_1.Promise(function (res, rej) {
                rej();
                throw Error();
            });
        }
        t.backend = backend || new db_index_1._NanoSQLDB();
        return new lie_ts_1.Promise(function (res, rej) {
            t.backend._connect({
                _models: t._models,
                _actions: t._actions,
                _views: t._views,
                _functions: t._functions,
                _config: t._preConnectExtend,
                _parent: _this,
                _onSuccess: function (result) {
                    res(result, t);
                },
                _onFail: function (rejected) {
                    if (rej)
                        rej(rejected, t);
                }
            });
        });
    };
    NanoSQLInstance.prototype.on = function (actions, callBack) {
        var t = this;
        var l = t._selectedTable;
        var i = 0;
        var a = actions.split(" ");
        if (!t._callbacks[l]) {
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }
        i = a.length;
        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l][a[i]].push(callBack);
            }
        }
        t._refreshEventChecker();
        return t;
    };
    NanoSQLInstance.prototype.off = function (callBack) {
        var t = this;
        for (var key in t._callbacks) {
            for (var key2 in t._callbacks[key]) {
                t._callbacks[key][key2] = t._callbacks[key][key2].filter(function (cBs) {
                    return cBs !== callBack;
                });
            }
        }
        t._refreshEventChecker();
        return t;
    };
    NanoSQLInstance.prototype._refreshEventChecker = function () {
        var _this = this;
        this._hasEvents = {};
        Object.keys(this._models).concat(["*"]).forEach(function (table) {
            _this._hasEvents[table] = _this._events.reduce(function (prev, cur) {
                return prev + (_this._callbacks[table] ? _this._callbacks[table][cur].length : 0);
            }, 0) > 0;
        });
    };
    NanoSQLInstance.prototype.model = function (dataModel) {
        var t = this;
        var l = t._selectedTable;
        var i = t._events.length;
        if (!t._callbacks[l]) {
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }
        t._models[l] = dataModel;
        t._tableNames.push(l);
        t._views[l] = [];
        t._actions[l] = [];
        return t;
    };
    NanoSQLInstance.prototype.views = function (viewArray) {
        return this._views[this._selectedTable] = viewArray, this;
    };
    NanoSQLInstance.prototype.getView = function (viewName, viewArgs) {
        if (viewArgs === void 0) { viewArgs = {}; }
        return this._doAV("View", this._views[this._selectedTable], viewName, viewArgs);
    };
    NanoSQLInstance.prototype.cleanArgs = function (argDeclarations, args) {
        var t = this;
        var l = t._selectedTable;
        var a = {};
        var i = argDeclarations.length ? argDeclarations.length : -1;
        if (i > 0) {
            while (i--) {
                var k2 = argDeclarations[i].split(":");
                if (k2.length > 1) {
                    a[k2[0]] = t._cast(k2[1], args[k2[0]] || null);
                }
                else {
                    a[k2[0]] = args[k2[0]] || null;
                }
            }
        }
        return a;
    };
    NanoSQLInstance.prototype._cast = function (type, val) {
        var _this = this;
        var p = this;
        var entityMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;",
            "/": "&#x2F;",
            "`": "&#x60;",
            "=": "&#x3D;"
        };
        var t = typeof val;
        var types = function (type, val) {
            switch (type) {
                case "safestr": return types("string", val).replace(/[&<>"'`=\/]/g, function (s) { return entityMap[s]; });
                case "int": return (t !== "number" || val % 1 !== 0) ? parseInt(val || 0) : val;
                case "float": return t !== "number" ? parseFloat(val || 0) : val;
                case "any[]":
                case "array": return Array.isArray(val) ? exports._assign(val || []) : [];
                case "uuid":
                case "timeId":
                case "timeIdms":
                case "string": return val === null ? "" : t !== "string" ? String(val) : val;
                case "map": return t === "object" ? exports._assign(val || {}) : {};
                case "bool": return val === true;
            }
            return val;
        };
        var newVal = types(type, val);
        if (type.indexOf("[]") !== -1) {
            var arrayOf_1 = type.slice(0, type.lastIndexOf("[]"));
            return (val || []).map(function (v) {
                return _this._cast(arrayOf_1, v);
            });
        }
        else if (newVal !== undefined) {
            if (["int", "float"].indexOf(type) !== -1) {
                return isNaN(newVal) ? 0 : newVal;
            }
            else {
                return newVal;
            }
        }
        return undefined;
    };
    NanoSQLInstance.prototype.actions = function (actionArray) {
        return this._actions[this._selectedTable] = actionArray, this;
    };
    NanoSQLInstance.prototype.doAction = function (actionName, actionArgs) {
        return this._doAV("Action", this._actions[this._selectedTable], actionName, actionArgs);
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
            return new lie_ts_1.Promise(function (res, rej) { return rej("Action/View Not Found!"); });
        }
        t._activeAV = AVName;
        var cleanArgs = selAV.args ? t.cleanArgs(selAV.args, AVargs) : {};
        if (t._AVMod) {
            return new lie_ts_1.Promise(function (res, rej) {
                t._AVMod(_this._selectedTable, AVType, t._activeAV || "", cleanArgs, function (args) {
                    selAV ? selAV.call(args, t).then(function (result) {
                        res(result, t);
                    }) : false;
                }, function (err) {
                    rej(err);
                });
            });
        }
        else {
            return selAV.call(cleanArgs, t);
        }
    };
    NanoSQLInstance.prototype.newFunction = function (functionName, functionType, filterFunction) {
        return this._functions[functionName] = { type: functionType, call: filterFunction }, this;
    };
    NanoSQLInstance.prototype.query = function (action, args, bypassORMPurge) {
        var t = this;
        var query = new index_query_1._NanoSQLQuery(t._selectedTable, t, t._activeAV);
        t._activeAV = undefined;
        var a = action.toLowerCase();
        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) !== -1) {
            var newArgs_1 = args || (a === "select" || a === "delete" ? [] : {});
            if (["upsert", "delete", "drop"].indexOf(a) !== -1) {
                t._transactionTables.push(t._selectedTable);
            }
            if (action === "delete" && !bypassORMPurge) {
                var inputArgs = {};
                t._models[t._selectedTable].forEach(function (model) {
                    if (t._tableNames.indexOf(model.type.replace("[]", "")) !== -1) {
                        newArgs_1[model.key] = undefined;
                    }
                });
                newArgs_1 = inputArgs;
            }
            if (action === "upsert") {
                var inputArgs_1 = {};
                t._models[t._selectedTable].forEach(function (model) {
                    if (!bypassORMPurge) {
                        if (t._tableNames.indexOf(model.type.replace("[]", "")) !== -1) {
                            newArgs_1[model.key] = undefined;
                        }
                    }
                    if (newArgs_1[model.key] !== undefined) {
                        var cast = t._cast(model.type, newArgs_1[model.key]);
                        if (cast !== undefined)
                            inputArgs_1[model.key] = cast;
                    }
                });
                if (t._rowFilters[t._selectedTable]) {
                    inputArgs_1 = t._rowFilters[t._selectedTable](inputArgs_1);
                }
                newArgs_1 = inputArgs_1;
            }
            query._action = { type: a, args: newArgs_1 };
        }
        else {
            throw Error;
        }
        return query;
    };
    NanoSQLInstance.prototype.updateORM = function (action, column, relationIDs) {
        return new index_query_1._NanoSQLORMQuery(this, this._selectedTable, action, column, relationIDs);
    };
    NanoSQLInstance.prototype.defaultORM = function (callBack) {
        this._ormFns[this._selectedTable] = callBack;
        return this;
    };
    NanoSQLInstance.prototype.triggerEvent = function (eventData, triggerEvents) {
        var t = this;
        setTimeout(function () {
            var i = triggerEvents.length;
            var j = 0;
            var e;
            var c;
            while (i--) {
                e = triggerEvents[i];
                c = t._callbacks[eventData.table][e].concat(t._callbacks[eventData.table]["*"]);
                j = c.length;
                while (j--) {
                    eventData.name = e;
                    c[j](eventData, t);
                }
            }
        }, 0);
    };
    NanoSQLInstance.prototype.default = function (replaceObj) {
        var newObj = {};
        var t = this;
        t._models[t._selectedTable].forEach(function (m) {
            newObj[m.key] = (replaceObj && replaceObj[m.key]) ? replaceObj[m.key] : m.default;
            if (!newObj[m.key]) {
                newObj[m.key] = t._cast(m.type, null);
            }
        });
        return newObj;
    };
    NanoSQLInstance.prototype.doTransaction = function (initTransaction) {
        var t = this;
        var queries = [];
        var transactionID = NanoSQLInstance._random16Bits();
        return new lie_ts_1.Promise(function (resolve, reject) {
            t.backend._transaction("start", transactionID).then(function () {
                initTransaction(function (table) {
                    var ta = table || t._selectedTable;
                    return {
                        query: function (action, args) {
                            return new index_transaction_1._NanoSQLTransactionQuery(action, args, ta, queries);
                        },
                        updateORM: function (action, column, relationIDs) {
                            if (action === "rebuild") {
                                return undefined;
                            }
                            else {
                                return new index_transaction_1._NanoSQLTransactionORMQuery(queries, ta, action, column, relationIDs);
                            }
                        }
                    };
                }, function () {
                    lie_ts_1.Promise.all(queries.map(function (quer) {
                        if (quer.type === "std") {
                            return t.table(quer.table).query(quer.action, quer.actionArgs, true).tID(transactionID)._manualExec(quer.table, quer.query || []);
                        }
                        else {
                            var ormQuery = t.table(quer.table).updateORM(quer.action, quer.column, quer.relationIDs).tID(transactionID);
                            var where = quer.where;
                            if (where)
                                ormQuery.where(where);
                            return ormQuery.exec();
                        }
                    })).then(function () {
                        t.backend._transaction("end", transactionID).then(function (result) {
                            t._transactionTables.forEach(function (table) {
                                if (table.indexOf("_") !== 0) {
                                    t.triggerEvent({
                                        table: table,
                                        query: [],
                                        time: new Date().getTime(),
                                        result: [],
                                        name: "change",
                                        actionOrView: "",
                                        changeType: "transaction",
                                        changedRows: [],
                                        changedRowPKS: []
                                    }, ["change"]);
                                }
                            });
                            resolve(result);
                        });
                    });
                });
            });
        });
    };
    NanoSQLInstance.prototype.queryFilter = function (callBack) {
        this._queryMod = callBack;
        return this;
    };
    NanoSQLInstance.prototype.avFilter = function (filterFunc) {
        this._AVMod = filterFunc;
        return this;
    };
    NanoSQLInstance.prototype.config = function (args) {
        var t = this;
        if (!t.backend)
            t._preConnectExtend.push(args);
        return t;
    };
    NanoSQLInstance.prototype.extend = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var t = this;
        if (t.backend) {
            if (t.backend._extend) {
                args.unshift(t);
                return t.backend._extend.apply(t.backend, args);
            }
            else {
                return undefined;
            }
        }
    };
    NanoSQLInstance.prototype.loadJS = function (table, rows) {
        var t = this;
        return t.doTransaction(function (db, complete) {
            rows.forEach(function (row) {
                db(table).query("upsert", row).exec();
            });
            complete();
        });
    };
    NanoSQLInstance.prototype.rowFilter = function (callBack) {
        return this._rowFilters[this._selectedTable] = callBack, this;
    };
    NanoSQLInstance.prototype.loadCSV = function (table, csv) {
        var t = this;
        var fields = [];
        return t.doTransaction(function (db, complete) {
            csv.split("\n").forEach(function (v, k) {
                if (k === 0) {
                    fields = v.split(",");
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
                    db(table).query("upsert", record).exec();
                }
            });
            complete();
        });
    };
    NanoSQLInstance._random16Bits = function () {
        if (typeof crypto === "undefined") {
            return Math.round(Math.random() * Math.pow(2, 16));
        }
        else {
            if (crypto.getRandomValues) {
                var buf = new Uint16Array(1);
                crypto.getRandomValues(buf);
                return buf[0];
            }
            else if (global !== "undefined" && global._crypto.randomBytes) {
                return global._crypto.randomBytes(2).reduce(function (prev, cur) { return cur * prev; });
            }
            else {
                return Math.round(Math.random() * Math.pow(2, 16));
            }
        }
    };
    NanoSQLInstance.timeid = function (ms) {
        var t = this;
        if (!t._tzOffset) {
            t._tzOffset = new Date().getTimezoneOffset() * 60000;
        }
        var time = Math.round((new Date().getTime() + t._tzOffset) / (ms ? 1 : 1000)).toString();
        while (time.length < (ms ? 13 : 10)) {
            time = "0" + time;
        }
        return time + "-" + (t._random16Bits() + t._random16Bits()).toString(16);
    };
    NanoSQLInstance.uuid = function () {
        var _this = this;
        var r, s, b = "";
        return [b, b, b, b, b, b, b, b, b].reduce(function (prev, cur, i) {
            r = _this._random16Bits();
            s = (i === 4 ? i : (i === 5 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
            r = r.toString(16);
            while (r.length < 4)
                r = "0" + r;
            return prev + ([3, 4, 5, 6].indexOf(i) >= 0 ? "-" : b) + (s + r).slice(0, 4);
        }, b);
    };
    NanoSQLInstance._hash = function (key) {
        return Math.abs(key.split("").reduce(function (prev, next, i) {
            return ((prev << 5) + prev) + key.charCodeAt(i);
        }, 0));
    };
    return NanoSQLInstance;
}());
exports.NanoSQLInstance = NanoSQLInstance;
var _NanoSQLStatic = new NanoSQLInstance();
exports.nSQL = function (setTablePointer) {
    return _NanoSQLStatic.table(setTablePointer);
};
