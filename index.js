(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("typescript-map"), require("typescript-promise"));
	else if(typeof define === 'function' && define.amd)
		define(["typescript-map", "typescript-promise"], factory);
	else {
		var a = typeof exports === 'object' ? factory(require("typescript-map"), require("typescript-promise")) : factory(root["typescript-map"], root["typescript-promise"]);
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(this, function(__WEBPACK_EXTERNAL_MODULE_2__, __WEBPACK_EXTERNAL_MODULE_3__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var typescript_map_1 = __webpack_require__(2);
	var typescript_promise_1 = __webpack_require__(3);
	var memory_db_1 = __webpack_require__(4);
	var SomeSQLInstance = (function () {
	    function SomeSQLInstance() {
	        var t = this;
	        t._actions = new typescript_map_1.TSMap();
	        t._views = new typescript_map_1.TSMap();
	        t._models = new typescript_map_1.TSMap();
	        t._query = [];
	        t._preConnectExtend = [];
	        t._events = ["change", "delete", "upsert", "drop", "select", "error"];
	        t._callbacks = new typescript_map_1.TSMap();
	        t._callbacks.set("*", new typescript_map_1.TSMap());
	        t._events.forEach(function (e) {
	            t._callbacks.get("*").set(e, []);
	        });
	        t._filters = new typescript_map_1.TSMap();
	        t._permanentFilters = [];
	    }
	    SomeSQLInstance.prototype.table = function (table) {
	        if (table)
	            this._selectedTable = table;
	        return this;
	    };
	    SomeSQLInstance.prototype.connect = function (backend) {
	        var t = this;
	        t._backend = backend || new memory_db_1.SomeSQLMemDB();
	        return new typescript_promise_1.TSPromise(function (res, rej) {
	            t._backend.connect(t._models, t._actions, t._views, t._filters, t._preConnectExtend, res, rej);
	        }, t);
	    };
	    SomeSQLInstance.prototype.on = function (actions, callBack) {
	        var t = this;
	        var l = t._selectedTable;
	        if (!t._callbacks.get(l)) {
	            t._events.forEach(function (v) {
	                t._callbacks.get(l).set(v, []);
	            });
	        }
	        actions.split(" ").forEach(function (a) {
	            if (t._events.indexOf(a) !== -1) {
	                t._callbacks.get(l).get(a).push(callBack);
	            }
	        });
	        return t;
	    };
	    SomeSQLInstance.prototype.off = function (callBack) {
	        this._callbacks.forEach(function (tables) {
	            tables.forEach(function (actions) {
	                actions.filter(function (cBs) {
	                    return cBs !== callBack;
	                });
	            });
	        });
	        return this;
	    };
	    SomeSQLInstance.prototype.alwaysApplyFilter = function (filterName) {
	        if (this._permanentFilters.indexOf(filterName) === -1) {
	            this._permanentFilters.push(filterName);
	        }
	        return this;
	    };
	    SomeSQLInstance.prototype.model = function (dataModel) {
	        var t = this;
	        var l = t._selectedTable;
	        t._callbacks.set(l, new typescript_map_1.TSMap());
	        t._callbacks.get(l).set("*", []);
	        t._events.forEach(function (e) {
	            t._callbacks.get(l).set(e, []);
	        });
	        t._models.set(l, dataModel);
	        t._views.set(l, []);
	        t._actions.set(l, []);
	        return t;
	    };
	    SomeSQLInstance.prototype.views = function (viewArray) {
	        return this._views.set(this._selectedTable, viewArray), this;
	    };
	    SomeSQLInstance.prototype.getView = function (viewName, viewArgs) {
	        if (viewArgs === void 0) { viewArgs = {}; }
	        var t = this;
	        var l = t._selectedTable;
	        var selView;
	        t._views.get(l).forEach(function (view) {
	            if (view.name === viewName) {
	                selView = view;
	            }
	        });
	        if (!selView)
	            throw Error("View does not exist");
	        t._activeActionOrView = viewName;
	        return selView.call.apply(t, [t._cleanArgs(selView.args, viewArgs), t]);
	    };
	    SomeSQLInstance.prototype._cleanArgs = function (argDeclarations, args) {
	        var t = this;
	        var l = t._selectedTable;
	        var a = {};
	        if (argDeclarations) {
	            argDeclarations.forEach(function (k) {
	                var k2 = k.split(":");
	                if (k2.length > 1) {
	                    a[k2[0]] = t._cast(k2[1], args[k2[0]] || null);
	                }
	                else {
	                    a[k2[0]] = args[k2[0]] || null;
	                }
	            });
	        }
	        return a;
	    };
	    SomeSQLInstance.prototype._cast = function (type, val) {
	        switch (["string", "int", "float", "array", "map", "bool"].indexOf(type)) {
	            case 0: return String(val);
	            case 1: return parseInt(val);
	            case 2: return parseFloat(val);
	            case 3:
	            case 4: return JSON.parse(JSON.stringify(val));
	            case 5: return val === true;
	            default: return "";
	        }
	    };
	    SomeSQLInstance.prototype.actions = function (actionArray) {
	        return this._actions.set(this._selectedTable, actionArray), this;
	    };
	    SomeSQLInstance.prototype.doAction = function (actionName, actionArgs) {
	        if (actionArgs === void 0) { actionArgs = {}; }
	        var t = this;
	        var l = t._selectedTable;
	        var selAction = t._actions.get(l).reduce(function (prev, cur) {
	            if (prev !== undefined)
	                return prev;
	            return cur.name === actionName ? cur : undefined;
	        });
	        if (!selAction)
	            throw Error("Action does not exist");
	        t._activeActionOrView = actionName;
	        return selAction.call.apply(t, [t._cleanArgs(selAction.args, actionArgs), t]);
	    };
	    SomeSQLInstance.prototype.addFilter = function (filterName, filterFunction) {
	        return this._filters.set(filterName, filterFunction), this;
	    };
	    SomeSQLInstance.prototype.query = function (action, args) {
	        this._query = [];
	        var a = action.toLowerCase();
	        if (["select", "upsert", "delete", "drop"].indexOf(a) !== -1) {
	            this._query.push({ type: a, args: args });
	        }
	        else {
	            console.error("Invalid query '" + action + "'!");
	        }
	        return this;
	    };
	    SomeSQLInstance.prototype.where = function (args) {
	        return this._addCmd("where", args);
	    };
	    SomeSQLInstance.prototype.orderBy = function (args) {
	        return this._addCmd("orderby", args);
	    };
	    SomeSQLInstance.prototype.limit = function (args) {
	        return this._addCmd("limit", args);
	    };
	    SomeSQLInstance.prototype.offset = function (args) {
	        return this._addCmd("offset", args);
	    };
	    SomeSQLInstance.prototype.filter = function (name, args) {
	        return this._addCmd("filter-" + name, args);
	    };
	    SomeSQLInstance.prototype._addCmd = function (type, args) {
	        return this._query.push({ type: type, args: args }), this;
	    };
	    SomeSQLInstance.prototype.exec = function () {
	        var t = this;
	        var _t = t._selectedTable;
	        t._triggerEvents = t._query.map(function (q) {
	            switch (q.type) {
	                case "select": return [q.type];
	                case "delete":
	                case "upsert":
	                case "drop": return [q.type, "change"];
	                default: return [];
	            }
	        }).reduce(function (a, b) { return a.concat(b); });
	        var triggerEvents = function (eventData) {
	            t._triggerEvents.forEach(function (e) {
	                t._callbacks.get(_t).get(e).concat(t._callbacks.get(_t).get("*")).forEach(function (cb) {
	                    eventData["name"] = e;
	                    eventData["actionOrView"] = t._activeActionOrView;
	                    cb.apply(t, [eventData]);
	                });
	            });
	            t._activeActionOrView = undefined;
	        };
	        return new typescript_promise_1.TSPromise(function (res, rej) {
	            var _tEvent = function (data, callBack, isError) {
	                if (t._permanentFilters.length && isError !== true) {
	                    data = t._permanentFilters.reduce(function (prev, cur, i) {
	                        return t._filters.get(t._permanentFilters[i]).apply(t, [data]);
	                    }, data);
	                }
	                triggerEvents({
	                    table: _t,
	                    query: t._query,
	                    time: new Date().getTime(),
	                    result: data
	                });
	                callBack(data);
	            };
	            t._backend.exec(_t, t._query, t._activeActionOrView, function (rows) {
	                _tEvent(rows, res, false);
	            }, function (err) {
	                t._triggerEvents = ["error"];
	                _tEvent(err, rej, true);
	            });
	        }, t);
	    };
	    SomeSQLInstance.prototype.extend = function () {
	        var args = [];
	        for (var _i = 0; _i < arguments.length; _i++) {
	            args[_i] = arguments[_i];
	        }
	        var t = this;
	        if (t._backend) {
	            if (t._backend.extend) {
	                return t._backend.extend.apply(t, args);
	            }
	            else {
	                return undefined;
	            }
	        }
	        else {
	            return t._preConnectExtend.push(args), this;
	        }
	    };
	    SomeSQLInstance.prototype.loadJS = function (rows) {
	        var t = this;
	        return typescript_promise_1.TSPromise.all(rows.map(function (row) {
	            return t.table(t._selectedTable).query("upsert", row).exec();
	        }));
	    };
	    SomeSQLInstance.prototype.loadCSV = function (csv) {
	        var t = this;
	        var fields = [];
	        return new typescript_promise_1.TSPromise(function (res, rej) {
	            typescript_promise_1.TSPromise.all(csv.split("\n").map(function (v, k) {
	                return new typescript_promise_1.TSPromise(function (resolve, reject) {
	                    if (k === 0) {
	                        fields = v.split(",");
	                        resolve();
	                    }
	                    else {
	                        var record_1 = {};
	                        var row_1 = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g).map(function (str) { return str.replace(/^"(.+(?="$))"$/, "$1"); });
	                        fields.forEach(function (f, i) {
	                            if (row_1[i].indexOf("{") === 0 || row_1[i].indexOf("[") === 0) {
	                                row_1[i] = JSON.parse(row_1[i].replace(/'/g, ""));
	                            }
	                            record_1[f] = row_1[i];
	                        });
	                        t.table(t._selectedTable).query("upsert", row_1).exec().then(function () {
	                            resolve();
	                        });
	                    }
	                }, t);
	            })).then(function () {
	                res();
	            });
	        }, t);
	    };
	    SomeSQLInstance.prototype.toCSV = function (headers) {
	        var t = this;
	        return new typescript_promise_1.TSPromise(function (res, rej) {
	            t.exec().then(function (json) {
	                var header = t._query.filter(function (q) {
	                    return q.type === "select";
	                }).map(function (q) {
	                    return q.args ? q.args.map(function (m) {
	                        return t._models.get(t._selectedTable).filter(function (f) { return f["key"] === m; })[0];
	                    }) : t._models.get(t._selectedTable);
	                })[0];
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
	                        switch (column["type"]) {
	                            case "map": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
	                            case "array": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
	                            default: return JSON.stringify(row[column["key"]]);
	                        }
	                    }).join(",");
	                }).join("\n"));
	            });
	        }, t);
	    };
	    SomeSQLInstance.uuid = function (inputUUID) {
	        return inputUUID ? inputUUID : (function () {
	            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
	                var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
	                return v.toString(16);
	            });
	        })();
	    };
	    SomeSQLInstance.hash = function (str) {
	        var hash = 5381;
	        for (var i = 0; i < str.length; i++) {
	            var char = str.charCodeAt(i);
	            hash = ((hash << 5) + hash) + char;
	        }
	        return String(hash);
	    };
	    return SomeSQLInstance;
	}());
	exports.SomeSQLInstance = SomeSQLInstance;
	var _someSQLStatic = new SomeSQLInstance();
	function SomeSQL(setTablePointer) {
	    return _someSQLStatic.table(setTablePointer);
	}
	exports.SomeSQL = SomeSQL;


/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_2__;

/***/ },
/* 3 */
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_3__;

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	var index_1 = __webpack_require__(1);
	var typescript_promise_1 = __webpack_require__(3);
	var typescript_map_1 = __webpack_require__(2);
	var SomeSQLMemDB = (function () {
	    function SomeSQLMemDB() {
	        var t = this;
	        t._filters = new typescript_map_1.TSMap();
	        t._tables = new typescript_map_1.TSMap();
	        t._cacheIndex = new typescript_map_1.TSMap();
	        t._cache = new typescript_map_1.TSMap();
	        t._cacheQueryIndex = new typescript_map_1.TSMap();
	        t._pendingQuerys = [];
	        t._initFilters();
	    }
	    SomeSQLMemDB.prototype.connect = function (models, actions, views, filters, preCustom, callback) {
	        var t = this;
	        models.forEach(function (model, table) {
	            t._newModel(table, model);
	        });
	        filters.forEach(function (func, name) {
	            t._filters.set(name, func);
	        });
	        callback();
	    };
	    SomeSQLMemDB.prototype._newModel = function (table, args) {
	        this._cache.set(table, new typescript_map_1.TSMap());
	        this._cacheIndex.set(table, new typescript_map_1.TSMap());
	        this._tables.set(table, new _memDB_Table(args));
	    };
	    SomeSQLMemDB.prototype.exec = function (table, query, viewOrAction, onSuccess, onFail) {
	        var t = this;
	        if (t._act != null) {
	            t._pendingQuerys.push([table, query, viewOrAction, onSuccess, onFail]);
	            return;
	        }
	        t._selectedTable = table;
	        t._mod = [];
	        t._act = null;
	        t._cacheKey = index_1.SomeSQLInstance.hash(JSON.stringify(query));
	        t._cacheQueryIndex.set(t._cacheKey, query);
	        typescript_promise_1.TSPromise.all(query.map(function (q) {
	            return new typescript_promise_1.TSPromise(function (resolve, reject) {
	                t._query(q, resolve);
	            });
	        })).then(function () {
	            t._exec(function (args) {
	                onSuccess(args);
	                t._act = null;
	                if (t._pendingQuerys.length) {
	                    t.exec.apply(t, t._pendingQuerys.pop());
	                }
	            });
	        });
	    };
	    SomeSQLMemDB.prototype._query = function (queryArg, resolve) {
	        if (["upsert", "select", "delete", "drop"].indexOf(queryArg.type) !== -1) {
	            this._act = queryArg;
	        }
	        else {
	            this._mod.push(queryArg);
	        }
	        resolve();
	    };
	    SomeSQLMemDB.prototype._initFilters = function () {
	        var t = this;
	        var f = t._filters;
	        f.set("sum", function (rows) {
	            return [{ "sum": rows.map(function (r) { return r[t._act.args[0]]; }).reduce(function (a, b) { return a + b; }, 0) }];
	        });
	        f.set("first", function (rows) {
	            return [rows[0]];
	        });
	        f.set("last", function (rows) {
	            return [rows.pop()];
	        });
	        f.set("min", function (rows) {
	            return [{ "min": rows.map(function (r) { return r[t._act.args[0]]; }).sort(function (a, b) { return a < b ? -1 : 1; })[0] }];
	        });
	        f.set("max", function (rows) {
	            return [{ "max": rows.map(function (r) { return r[t._act.args[0]]; }).sort(function (a, b) { return a > b ? -1 : 1; })[0] }];
	        });
	        f.set("average", function (rows) {
	            return [{ "average": t._doFilter("sum", rows)[0].sum / rows.length }];
	        });
	        f.set("count", function (rows) {
	            return [{ "length": rows.length }];
	        });
	    };
	    SomeSQLMemDB.prototype._doFilter = function (filterName, rows, filterArgs) {
	        return this._filters.get(filterName).apply(this, [rows, filterArgs]);
	    };
	    SomeSQLMemDB.prototype._runFilters = function (dbRows) {
	        var t = this;
	        var filters = t._mod.filter(function (m) { return m.type.indexOf("filter-") === 0; });
	        return filters.length ? filters.reduce(function (prev, cur, i) {
	            return t._doFilter(filters[i].type.replace("filter-", ""), prev, filters[i].args);
	        }, dbRows) : dbRows;
	    };
	    SomeSQLMemDB.prototype._removeCacheFromKeys = function (affectedKeys) {
	        var t = this;
	        affectedKeys.forEach(function (key) {
	            t._cacheIndex.get(t._selectedTable).forEach(function (queryIndex, key) {
	                if (queryIndex.indexOf(key) !== -1) {
	                    t._cacheIndex.get(t._selectedTable).delete(key);
	                    t._cache.get(t._selectedTable).delete(key);
	                }
	            });
	        });
	    };
	    SomeSQLMemDB.prototype._exec = function (callBack) {
	        var t = this;
	        var _hasWhere = t._mod.filter(function (v) {
	            return v.type === "where";
	        });
	        var _whereStatement = _hasWhere.length ? _hasWhere[0].args : undefined;
	        var qArgs = t._act.args;
	        var ta = t._tables.get(t._selectedTable);
	        var msg = 0;
	        var whereTable;
	        switch (t._act.type) {
	            case "upsert":
	                if (_whereStatement) {
	                    whereTable = t._newWhere(ta, _whereStatement);
	                    var affectedKeys_1 = [];
	                    whereTable._forEach(function (v, k) {
	                        for (var key in qArgs) {
	                            ta._get(k)[key] = qArgs[key];
	                        }
	                        affectedKeys_1.push(k);
	                        msg++;
	                    });
	                    t._removeCacheFromKeys(affectedKeys_1);
	                }
	                else {
	                    ta._add(qArgs);
	                    msg++;
	                    t._cache.set(t._selectedTable, new typescript_map_1.TSMap());
	                    t._cacheIndex.set(t._selectedTable, new typescript_map_1.TSMap());
	                }
	                callBack([{ result: msg + " row(s) upserted" }]);
	                break;
	            case "select":
	                if (t._cache.get(t._selectedTable).has(t._cacheKey)) {
	                    callBack(t._cache.get(t._selectedTable).get(t._cacheKey));
	                    return;
	                }
	                if (_whereStatement) {
	                    whereTable = t._newWhere(ta, _whereStatement);
	                }
	                else {
	                    whereTable = ta._clone();
	                }
	                var mods_1 = ["ordr", "ofs", "lmt", "clms"];
	                var getMod_1 = function (name) {
	                    return t._mod.filter(function (v) { return v.type === name; }).pop();
	                };
	                var result = mods_1.reduce(function (prev, cur, i) {
	                    switch (mods_1[i]) {
	                        case "ordr":
	                            if (getMod_1("orderby")) {
	                                var orderBy_1 = new typescript_map_1.TSMap();
	                                orderBy_1.fromJSON(getMod_1("orderby").args);
	                                return prev.sort(function (a, b) {
	                                    return orderBy_1.keys().reduce(function (prev, cur, i) {
	                                        var column = orderBy_1.keys()[i];
	                                        if (a[column] === b[column]) {
	                                            return 0 + prev;
	                                        }
	                                        else {
	                                            return ((a[column] > b[column] ? 1 : -1) * (orderBy_1.get(column) === "asc" ? 1 : -1)) + prev;
	                                        }
	                                    }, 0);
	                                });
	                            }
	                        case "ofs":
	                            if (getMod_1("offset")) {
	                                var offset_1 = getMod_1("offset").args;
	                                return prev.filter(function (row, index) {
	                                    return index >= offset_1;
	                                });
	                            }
	                        case "lmt":
	                            if (getMod_1("limit")) {
	                                var limit_1 = getMod_1("limit").args;
	                                return prev.filter(function (row, index) {
	                                    return index < limit_1;
	                                });
	                            }
	                        case "clms":
	                            if (qArgs) {
	                                var columns_1 = ta._model.map(function (model) {
	                                    return model["key"];
	                                }).filter(function (col) {
	                                    return qArgs.indexOf(col) === -1;
	                                });
	                                return prev.map(function (row) {
	                                    columns_1.forEach(function (col) { return delete row[col]; });
	                                    return row;
	                                });
	                            }
	                        default: return prev;
	                    }
	                }, whereTable._table);
	                var filterEffect = t._runFilters(result);
	                t._cache.get(t._selectedTable).set(t._cacheKey, filterEffect);
	                t._cacheIndex.get(t._selectedTable).set(t._cacheKey, result.map(function (row) {
	                    return row[whereTable._primaryKey];
	                }));
	                callBack(filterEffect);
	                break;
	            case "delete":
	                if (_whereStatement) {
	                    var affectedKeys_2 = [];
	                    var whereTable_1 = t._newWhere(ta, _whereStatement);
	                    whereTable_1._forEach(function (value, index) {
	                        ta._remove(index);
	                        affectedKeys_2.push(index);
	                    });
	                    t._removeCacheFromKeys(affectedKeys_2);
	                    callBack([{ result: whereTable_1.length + " row(s) deleted" }]);
	                }
	                else {
	                    t._newModel(t._selectedTable, t._tables.get(t._selectedTable)._model);
	                    callBack([{ result: "Table Dropped" }]);
	                }
	                break;
	            case "drop":
	                t._newModel(t._selectedTable, t._tables.get(t._selectedTable)._model);
	                callBack([{ result: "Table Dropped" }]);
	                break;
	        }
	    };
	    SomeSQLMemDB.prototype._newWhere = function (table, whereStatement) {
	        var t = this;
	        if (whereStatement && whereStatement.length) {
	            if (typeof (whereStatement[0]) === "string") {
	                return t._singleWhereResolve(table._clone(), whereStatement);
	            }
	            else {
	                var ptr_1 = 0;
	                var compare_1 = null;
	                return whereStatement.map(function (statement) {
	                    return t._singleWhereResolve(table._clone(), statement);
	                }).reduce(function (prev, cur, i) {
	                    if (i === 0)
	                        return cur;
	                    if (ptr_1 === 0)
	                        return compare_1 = whereStatement[i], ptr_1 = 1, prev;
	                    if (ptr_1 === 1) {
	                        ptr_1 = 0;
	                        switch (compare_1) {
	                            case "and": return prev._join("inner", cur);
	                            case "or": return prev._join("outer", cur);
	                            default: return prev;
	                        }
	                    }
	                });
	            }
	        }
	        else {
	            return table._clone();
	        }
	    };
	    SomeSQLMemDB.prototype._singleWhereResolve = function (table, whereStatement) {
	        var t = this;
	        var left = whereStatement[0];
	        var operator = whereStatement[1];
	        var right = whereStatement[2];
	        return table._filter(function (row) {
	            return t._compare(right, operator, row[left]) === 0;
	        });
	    };
	    SomeSQLMemDB.prototype._compare = function (val1, compare, val2) {
	        switch (compare) {
	            case "=": return val2 === val1 ? 0 : 1;
	            case ">": return val2 > val1 ? 0 : 1;
	            case "<": return val2 < val1 ? 0 : 1;
	            case "<=": return val2 <= val1 ? 0 : 1;
	            case ">=": return val2 >= val1 ? 0 : 1;
	            case "IN": return val1.indexOf(val2) === -1 ? 1 : 0;
	            case "NOT IN": return val1.indexOf(val2) === -1 ? 0 : 1;
	            case "REGEX":
	            case "LIKE": return val2.search(val1) === -1 ? 1 : 0;
	            default: return 0;
	        }
	    };
	    return SomeSQLMemDB;
	}());
	exports.SomeSQLMemDB = SomeSQLMemDB;
	var _memDB_Table = (function () {
	    function _memDB_Table(model, index, table) {
	        var t = this;
	        t._model = model;
	        t._index = index || [];
	        t._table = table || [];
	        t._incriment = 1;
	        t.length = 0;
	        t._primaryKey = t._model.reduce(function (prev, cur) {
	            if (cur["props"] && cur["props"].indexOf("pk") !== -1) {
	                t._pkType = cur["type"];
	                return cur["key"];
	            }
	            else {
	                return prev;
	            }
	        }, "");
	    }
	    _memDB_Table._detach = function (input) {
	        return JSON.parse(JSON.stringify(input));
	    };
	    _memDB_Table.prototype._get = function (index) {
	        return this._table[this._index.indexOf(index)];
	    };
	    _memDB_Table.prototype._set = function (index, value) {
	        this._table[this._index.indexOf(index)] = value;
	    };
	    _memDB_Table.prototype._add = function (data) {
	        var t = this;
	        data = JSON.parse(JSON.stringify(data));
	        t._model.forEach(function (model) {
	            data[model.key] = data[model.key] || model.default;
	        });
	        if (!data[t._primaryKey]) {
	            switch (t._pkType) {
	                case "int":
	                    data[t._primaryKey] = t._incriment;
	                    t._incriment++;
	                    break;
	                case "uuid":
	                    data[t._primaryKey] = index_1.SomeSQLInstance.uuid();
	                    break;
	            }
	            t._index.push(data[t._primaryKey]);
	            t._table.push(data);
	            t.length = t._index.length;
	        }
	        else {
	            t._set(data[t._primaryKey], data);
	        }
	    };
	    _memDB_Table.prototype._filter = function (func) {
	        var t = this;
	        t._index.forEach(function (idx) {
	            if (!func.apply(t, [t._get(idx), idx]))
	                t._remove(idx);
	        });
	        t.length = t._index.length;
	        return this;
	    };
	    _memDB_Table.prototype._forEach = function (func) {
	        var t = this;
	        t._index.forEach(function (idx) {
	            func.apply(t, [t._get(idx), idx]);
	        });
	        return t;
	    };
	    _memDB_Table.prototype._sort = function (func) {
	        var t = this;
	        var r = [];
	        var i = -1;
	        t._index.sort(function (a, b) {
	            var result = func.apply(t, [t._get(a), t._get(b)]);
	            r.push(result);
	            return result;
	        });
	        t._table.sort(function (a, b) {
	            i++;
	            return r[i];
	        });
	        return t;
	    };
	    _memDB_Table.prototype._join = function (type, table, joinKeys, mergeRowData) {
	        var t = this;
	        var joinKs = [];
	        if (!joinKeys) {
	            joinKs = [t._primaryKey, table._primaryKey];
	        }
	        else {
	            joinKs = joinKeys;
	        }
	        var tables = [this, table];
	        if (type === "inner") {
	            tables.sort(function (a, b) {
	                return a.length > b.length ? -1 : 1;
	            });
	        }
	        tables[0]._forEach(function (row, idx) {
	            var found;
	            tables[1]._forEach(function (row2, idx2) {
	                if (found === undefined) {
	                    if (row[joinKs[0]] === row2[joinKs[1]])
	                        found = row2;
	                }
	            });
	            if (found === undefined) {
	                switch (type) {
	                    case "inner":
	                        tables[0]._remove(idx);
	                        break;
	                    case "outer":
	                        tables[1]._add(found);
	                        break;
	                }
	            }
	        });
	        if (type === "outer") {
	            tables[0]._sort(function (a, b) {
	                return a[tables[0]._primaryKey] > b[tables[0]._primaryKey] ? 1 : -1;
	            });
	        }
	        return tables[0];
	    };
	    _memDB_Table.prototype._remove = function (index) {
	        var t = this;
	        var f = t._index.indexOf(index);
	        t._index.splice(f, 1);
	        t._table.splice(f, 1);
	        t.length = t._index.length;
	    };
	    _memDB_Table.prototype._clone = function () {
	        var ta = new _memDB_Table(this._model, _memDB_Table._detach(this._index), _memDB_Table._detach(this._table));
	        ta._incriment = this._incriment;
	        ta.length = this.length;
	        return ta;
	    };
	    return _memDB_Table;
	}());


/***/ }
/******/ ])
});
;