Object.defineProperty(exports, "__esModule", { value: true });
var db_index_1 = require("./db-index");
var lie_ts_1 = require("lie-ts");
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
        var query = new _NanoSQLQuery(t._selectedTable, t, t._activeAV);
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
        return new _NanoSQLORMQuery(this, this._selectedTable, action, column, relationIDs);
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
    NanoSQLInstance.prototype.beginTransaction = function () {
        this.doingTransaction = true;
        this._transactionTables = [];
        if (this.backend._transaction)
            return this.backend._transaction("start");
    };
    NanoSQLInstance.prototype.endTransaction = function () {
        var _this = this;
        this.doingTransaction = false;
        this._transactionTables.forEach(function (table) {
            if (table.indexOf("_") !== 0) {
                _this.triggerEvent({
                    table: table,
                    query: [],
                    time: new Date().getTime(),
                    result: [],
                    name: "change",
                    actionOrView: "",
                    changeType: "transaction",
                    changedRows: []
                }, ["change"]);
            }
        });
        if (this.backend._transaction)
            return this.backend._transaction("end");
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
        t.beginTransaction();
        return new lie_ts_1.Promise(function (res, rej) {
            var pointer = 0;
            var rowData = [];
            var next = function () {
                if (pointer < rows.length) {
                    if (rows[pointer]) {
                        t.table(table).query("upsert", rows[pointer], true).exec().then(function (res) {
                            rowData.push(res);
                            pointer++;
                            next();
                        });
                    }
                    else {
                        pointer++;
                        next();
                    }
                }
                else {
                    t.endTransaction();
                    res(rowData, t);
                }
            };
            next();
        });
    };
    NanoSQLInstance.prototype.rowFilter = function (callBack) {
        return this._rowFilters[this._selectedTable] = callBack, this;
    };
    NanoSQLInstance.prototype.loadCSV = function (table, csv) {
        var t = this;
        var fields = [];
        return new lie_ts_1.Promise(function (res, rej) {
            t.beginTransaction();
            lie_ts_1.Promise.all(csv.split("\n").map(function (v, k) {
                return new lie_ts_1.Promise(function (resolve, reject) {
                    if (k === 0) {
                        fields = v.split(",");
                        resolve();
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
                        t.table(table).query("upsert", record, true).exec().then(function () {
                            resolve();
                        });
                    }
                });
            })).then(function () {
                t.endTransaction();
                res([], t);
            });
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
var _NanoSQLORMQuery = (function () {
    function _NanoSQLORMQuery(db, table, action, column, relationIDs) {
        this._db = db;
        this._tableName = table;
        this._action = action;
        this._column = column || "";
        this._relationIDs = relationIDs || [];
    }
    _NanoSQLORMQuery.prototype.where = function (args) {
        this._whereArgs = args;
        return this;
    };
    _NanoSQLORMQuery.prototype.rebuild = function (callBack) {
        var t = this;
        t._db.beginTransaction();
        var relations = t._db._models[t._tableName].filter(function (m) {
            return t._db._tableNames.indexOf(m.type.replace("[]", "")) !== -1;
        }).map(function (m) {
            var tableName = m.type.replace("[]", "");
            return {
                key: m.key,
                tablePK: t._db._models[tableName].reduce(function (prev, cur) {
                    if (cur.props && cur.props.indexOf("pk") !== -1)
                        return cur.key;
                    return prev;
                }, ""),
                table: tableName,
                type: m.type.indexOf("[]") === -1 ? "single" : "array"
            };
        });
        var tablePK = t._db._models[t._tableName].reduce(function (prev, cur) {
            if (cur.props && cur.props.indexOf("pk") !== -1)
                return cur.key;
            return prev;
        }, "");
        var ptr = 0;
        var nextRow = function () {
            t._db.table(t._tableName).query("select").range(1, ptr).exec().then(function (rows) {
                if (rows.length) {
                    lie_ts_1.Promise.all(relations.map(function (r) {
                        return new lie_ts_1.Promise(function (res, rej) {
                            var ids;
                            if (rows[0][r.key] === undefined) {
                                ids = r.type === "single" ? "" : [];
                            }
                            else {
                                ids = exports._assign(rows[0][r.key]);
                            }
                            if (r.type === "single")
                                ids = [ids];
                            ids = ids.filter(function (v, i, s) {
                                return s.indexOf(v) === i;
                            });
                            t._db.table(r.table).query("select").where([r.tablePK, "IN", ids]).exec().then(function (childRows) {
                                var activeIDs = childRows.length ? childRows.map(function (row) { return row[r.tablePK]; }) : [];
                                return t._db.table(t._tableName).updateORM("set", r.key, activeIDs).where([tablePK, "=", rows[0][tablePK]]).exec();
                            }).then(function () {
                                res();
                            });
                        });
                    })).then(function () {
                        ptr++;
                        nextRow();
                    });
                }
                else {
                    t._db.endTransaction();
                    callBack(ptr);
                }
            });
        };
        nextRow();
    };
    _NanoSQLORMQuery.prototype.exec = function () {
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            if (t._action === "rebuild") {
                return t.rebuild(res);
            }
            var pk = t._db._models[t._tableName].filter(function (m) {
                return m.props && m.props.indexOf("pk") !== -1;
            })[0].key;
            var rowModel = t._db._models[t._tableName].filter(function (m) { return m.key === t._column; })[0];
            var relationTable = rowModel.type.replace("[]", "");
            var relationPK = t._db._models[relationTable].filter(function (m) {
                return m.props && m.props.indexOf("pk") !== -1;
            })[0].key;
            var isArrayRelation = rowModel.type.indexOf("[]") !== -1;
            var mapTo = rowModel.props && rowModel.props.filter(function (p) { return p.indexOf("orm::") !== -1; })[0];
            var mapToIsArray = "single";
            if (mapTo) {
                mapTo = mapTo.replace("orm::", "");
                mapToIsArray = t._db._models[relationTable].filter(function (m) { return m.key === mapTo; })[0].type.indexOf("[]") === -1 ? "single" : "array";
            }
            if (!pk || !pk.length || !relationPK || !relationPK.length) {
                rej("Relation models require a primary key!");
            }
            var query = t._db.table(t._tableName).query("select");
            if (t._whereArgs)
                query.where(t._whereArgs);
            query.exec().then(function (rows) {
                var ptr = 0;
                var nextRow = function () {
                    if (ptr < rows.length) {
                        var newRow = exports._assign(rows[ptr]);
                        var oldRelations_1 = [];
                        if (newRow[t._column] !== undefined)
                            oldRelations_1 = newRow[t._column];
                        if (!Array.isArray(oldRelations_1))
                            oldRelations_1 = [oldRelations_1];
                        switch (t._action) {
                            case "set":
                            case "add":
                                if (isArrayRelation) {
                                    if (newRow[t._column] === undefined)
                                        newRow[t._column] = [];
                                    if (!Array.isArray(newRow[t._column]))
                                        newRow[t._column] = [];
                                    if (t._action === "set") {
                                        newRow[t._column] = t._relationIDs;
                                    }
                                    else {
                                        newRow[t._column] = newRow[t._column].concat(t._relationIDs);
                                        newRow[t._column] = newRow[t._column].filter(function (v, i, s) {
                                            return s.indexOf(v) === i;
                                        });
                                    }
                                }
                                else {
                                    newRow[t._column] = t._relationIDs[0];
                                }
                                break;
                            case "delete":
                                if (isArrayRelation) {
                                    var loc = newRow[t._column].indexOf(rows[ptr][pk]);
                                    if (loc !== -1)
                                        newRow[t._column] = newRow[t._column].splice(loc, 1);
                                }
                                else {
                                    newRow[t._column] = "";
                                }
                                break;
                            case "drop":
                                newRow[t._column] = isArrayRelation ? [] : undefined;
                                break;
                        }
                        var updateRow_1 = function (newRow, callBack) {
                            t._db.table(relationTable).query("upsert", newRow, true).exec().then(callBack);
                        };
                        var removeOldRelations_1 = function () {
                            return lie_ts_1.Promise.all(oldRelations_1.map(function (id) {
                                return new lie_ts_1.Promise(function (resolve, reject) {
                                    t._db.table(relationTable).query("select").where([relationPK, "=", id]).exec().then(function (relateRows) {
                                        if (!relateRows.length) {
                                            resolve();
                                            return;
                                        }
                                        var modifyRow = exports._assign(relateRows[0]);
                                        if (Array.isArray(modifyRow[mapTo])) {
                                            var idx = modifyRow[mapTo].indexOf(rows[ptr][pk]);
                                            if (idx !== -1) {
                                                modifyRow[mapTo] = modifyRow[mapTo].splice(idx, 1);
                                            }
                                        }
                                        else {
                                            modifyRow[mapTo] = "";
                                        }
                                        updateRow_1(modifyRow, resolve);
                                    });
                                });
                            }));
                        };
                        t._db.table(t._tableName).query("upsert", newRow, true).exec().then(function () {
                            if (mapTo) {
                                switch (t._action) {
                                    case "set":
                                    case "add":
                                        var ptr2_1 = 0;
                                        var appendRelations_1 = function () {
                                            if (ptr2_1 < t._relationIDs.length) {
                                                t._db.table(relationTable).query("select").where([relationPK, "=", t._relationIDs[ptr2_1]]).exec().then(function (relateRows) {
                                                    if (!relateRows.length) {
                                                        ptr2_1++;
                                                        appendRelations_1();
                                                        return;
                                                    }
                                                    var modifyRow = exports._assign(relateRows[0]);
                                                    if (modifyRow[mapTo] === undefined)
                                                        modifyRow[mapTo] = mapToIsArray === "array" ? [] : "";
                                                    if (mapToIsArray === "array") {
                                                        if (!Array.isArray(modifyRow[mapTo]))
                                                            modifyRow[mapTo] = [];
                                                        modifyRow[mapTo].push(rows[ptr][pk]);
                                                        modifyRow[mapTo] = modifyRow[mapTo].filter(function (v, i, s) {
                                                            return s.indexOf(v) === i;
                                                        });
                                                        updateRow_1(modifyRow, function () {
                                                            ptr2_1++;
                                                            appendRelations_1();
                                                        });
                                                    }
                                                    else {
                                                        if (modifyRow[mapTo] && modifyRow[mapTo].length) {
                                                            t._db.table(t._tableName).query("select").where([pk, "=", modifyRow[mapTo]]).exec().then(function (relateRows2) {
                                                                var modifyRow2 = exports._assign(relateRows2[0]);
                                                                if (Array.isArray(modifyRow2[t._column])) {
                                                                    var idx = modifyRow2[t._column].indexOf(modifyRow[mapTo]);
                                                                    if (idx === -1) {
                                                                        modifyRow2[t._column] = modifyRow2[t._column].splice(modifyRow2[t._column].indexOf(modifyRow[mapTo]), 1);
                                                                    }
                                                                }
                                                                else {
                                                                    modifyRow2[t._column] = "";
                                                                }
                                                                t._db.table(t._tableName).query("upsert", modifyRow2, true).where([pk, "=", modifyRow[mapTo]]).exec().then(function () {
                                                                    modifyRow[mapTo] = rows[ptr][pk];
                                                                    updateRow_1(modifyRow, function () {
                                                                        ptr2_1++;
                                                                        appendRelations_1();
                                                                    });
                                                                });
                                                            });
                                                        }
                                                        else {
                                                            modifyRow[mapTo] = rows[ptr][pk];
                                                            updateRow_1(modifyRow, function () {
                                                                ptr2_1++;
                                                                appendRelations_1();
                                                            });
                                                        }
                                                    }
                                                });
                                            }
                                            else {
                                                ptr++;
                                                nextRow();
                                            }
                                        };
                                        appendRelations_1();
                                        break;
                                    case "delete":
                                    case "drop":
                                        removeOldRelations_1().then(function () {
                                            ptr++;
                                            nextRow();
                                        });
                                        break;
                                }
                            }
                            else {
                                ptr++;
                                nextRow();
                            }
                        });
                    }
                    else {
                        res(ptr);
                    }
                };
                nextRow();
            });
        });
    };
    return _NanoSQLORMQuery;
}());
exports._NanoSQLORMQuery = _NanoSQLORMQuery;
var _NanoSQLQuery = (function () {
    function _NanoSQLQuery(table, db, actionOrView) {
        this._db = db;
        this._modifiers = [];
        this._table = table;
        this._AV = actionOrView || "";
    }
    _NanoSQLQuery.prototype.where = function (args) {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Where condition requires an array!";
        }
        return this._addCmd("where", args);
    };
    _NanoSQLQuery.prototype.range = function (limit, offset) {
        return this._addCmd("range", [limit, offset]);
    };
    _NanoSQLQuery.prototype.orm = function (ormArgs) {
        return this._addCmd("orm", ormArgs);
    };
    _NanoSQLQuery.prototype.orderBy = function (args) {
        return this._addCmd("orderby", args);
    };
    _NanoSQLQuery.prototype.groupBy = function (columns) {
        return this._addCmd("groupby", columns);
    };
    _NanoSQLQuery.prototype.having = function (args) {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Having condition requires an array!";
        }
        return this._addCmd("having", args);
    };
    _NanoSQLQuery.prototype.join = function (args) {
        if (!args.table || !args.type) {
            this._error = "Join command requires table and type arguments!";
        }
        return this._addCmd("join", args);
    };
    _NanoSQLQuery.prototype.limit = function (args) {
        return this._addCmd("limit", args);
    };
    _NanoSQLQuery.prototype.trieSearch = function (column, stringToSearch) {
        return this._addCmd("trie", [column, stringToSearch]);
    };
    _NanoSQLQuery.prototype.offset = function (args) {
        return this._addCmd("offset", args);
    };
    _NanoSQLQuery.prototype._addCmd = function (type, args) {
        return this._modifiers.push({ type: type, args: args }), this;
    };
    _NanoSQLQuery.prototype.toCSV = function (headers) {
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            t.exec().then(function (json) {
                json = exports._assign(json);
                var header = t._action.args.length ? t._action.args.map(function (m) {
                    return t._db._models[t._table].filter(function (f) { return f["key"] === m; })[0];
                }) : t._db._models[t._table];
                if (headers) {
                    json.unshift(header.map(function (h) {
                        return h["key"];
                    }));
                }
                res(json.map(function (row, i) {
                    if (headers && i === 0)
                        return row;
                    return header.filter(function (column) {
                        return row[column["key"]] ? true : false;
                    }).map(function (column) {
                        var columnType = column["type"];
                        if (columnType.indexOf("[]") !== -1)
                            columnType = "any[]";
                        switch (columnType) {
                            case "map":
                            case "any[]":
                            case "array": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
                            case "string":
                            case "safestr": return '"' + row[column["key"]].replace(/"/g, '\"') + '"';
                            default: return row[column["key"]];
                        }
                    }).join(",");
                }).join("\n"), t);
            });
        });
    };
    _NanoSQLQuery.prototype.exec = function () {
        var t = this;
        var _t = t._table;
        if (t._db._hasEvents[_t]) {
            t._db._triggerEvents = (function () {
                switch (t._action.type) {
                    case "select": return [t._action.type];
                    case "delete":
                    case "upsert":
                    case "drop": return [t._action.type, "change"];
                    default: return [];
                }
            })();
        }
        return new lie_ts_1.Promise(function (res, rej) {
            if (t._error) {
                rej(t._error);
                throw Error;
            }
            if (!t._db.backend) {
                rej();
                throw Error;
            }
            var _tEvent = function (data, callBack, type, changedRows, isError) {
                if (t._db._hasEvents[_t]) {
                    t._db.triggerEvent({
                        name: "error",
                        actionOrView: t._AV,
                        table: _t,
                        query: [t._action].concat(t._modifiers),
                        time: new Date().getTime(),
                        result: data,
                        changeType: type,
                        changedRows: changedRows
                    }, t._db._triggerEvents);
                }
                callBack(data, t._db);
            };
            var execArgs = {
                table: _t,
                query: [t._action].concat(t._modifiers),
                viewOrAction: t._AV,
                onSuccess: function (rows, type, affectedRows) {
                    if (t._db.doingTransaction) {
                        res(rows, t._db);
                    }
                    else {
                        _tEvent(rows, res, type, affectedRows, false);
                    }
                },
                onFail: function (err) {
                    if (t._db.doingTransaction) {
                        res(err, t._db);
                    }
                    else {
                        t._db._triggerEvents = ["error"];
                        if (rej)
                            _tEvent(err, rej, "error", [], true);
                    }
                }
            };
            if (t._db._queryMod) {
                t._db._queryMod(execArgs, function (newArgs) {
                    t._db.backend._exec(newArgs);
                });
            }
            else {
                t._db.backend._exec(execArgs);
            }
        });
    };
    return _NanoSQLQuery;
}());
exports._NanoSQLQuery = _NanoSQLQuery;
var _NanoSQLStatic = new NanoSQLInstance();
exports.nSQL = function (setTablePointer) {
    return _NanoSQLStatic.table(setTablePointer);
};
