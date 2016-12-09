module.exports =
/******/ (function(modules) { // webpackBootstrap
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

	"use strict";
	var __extends = (this && this.__extends) || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};
	var typescript_promise_1 = __webpack_require__(1);
	var someSQL_Instance = (function () {
	    function someSQL_Instance() {
	        var t = this;
	        t._callbacks = { "*": {} };
	        t._actions = {};
	        t._views = {};
	        t._models = {};
	        t._query = [];
	        t._events = ['change', 'delete', 'upsert', 'drop', 'select'];
	        t._events.forEach(function (e) {
	            t._callbacks['*'][e] = [];
	        });
	    }
	    someSQL_Instance.prototype.init = function (table) {
	        this._selectedTable = table || '';
	        return this;
	    };
	    someSQL_Instance.prototype.connect = function (backend) {
	        this._backend = backend;
	        return new someSQL_Promise(this, function (res, rej) {
	            backend.connect(res, rej);
	        });
	    };
	    someSQL_Instance.prototype.on = function (actions, callBack) {
	        var _this = this;
	        actions.split(' ').forEach(function (a) {
	            if (_this._events.indexOf(a) == -1) {
	                throw new Error(a + "ins't a valid attachable event!");
	            }
	            _this._callbacks[_this._selectedTable][a].push(callBack);
	        });
	        return this;
	    };
	    someSQL_Instance.prototype.model = function (dataModel) {
	        var t = this;
	        var l = t._selectedTable;
	        t._callbacks[l] = {};
	        t._events.forEach(function (v) {
	            t._callbacks[l][v] = [];
	        });
	        t._models[l] = dataModel;
	        t._views[l] = {};
	        t._actions[l] = {};
	        return new someSQL_Promise(this, function (res, rej) {
	            t._backend.newModel(l, dataModel, res, rej);
	        });
	    };
	    someSQL_Instance.prototype.views = function (viewMap) {
	        this._views[this._selectedTable] = viewMap;
	        return this;
	    };
	    someSQL_Instance.prototype.getView = function (viewName, viewArgs) {
	        var t = this;
	        var l = t._selectedTable;
	        var v = t._views[l][viewName];
	        return v[1](t.init(l), t._cleanArgs(v, viewArgs));
	    };
	    someSQL_Instance.prototype._cleanArgs = function (funcArray, args) {
	        var t = this;
	        var l = t._selectedTable;
	        var a = {};
	        var v = funcArray;
	        v[0].forEach(function (k) {
	            var k2 = k.split(':');
	            if (k2.length > 1) {
	                a[k2[0]] = t._cast(k2[1], args[k2[0]]);
	            }
	            else {
	                a[k2[0]] = args[k2[0]];
	            }
	        });
	        return a;
	    };
	    someSQL_Instance.prototype._cast = function (type, val) {
	        switch (['string', 'int', 'float', 'array', 'map'].indexOf(type)) {
	            case 0: return String(val);
	            case 1: return parseInt(val);
	            case 2: return parseFloat(val);
	            case 3:
	            case 4: return JSON.parse(JSON.stringify(val));
	            default: return val;
	        }
	    };
	    someSQL_Instance.prototype.actions = function (actionMap) {
	        this._actions[this._selectedTable] = actionMap;
	        return this;
	    };
	    someSQL_Instance.prototype.doAction = function (actionName, actionArgs) {
	        var t = this;
	        var l = t._selectedTable;
	        var a = t._actions[l][actionName];
	        return a[1](t.init(l), t._cleanArgs(a, actionArgs));
	    };
	    someSQL_Instance.prototype.query = function (action, args) {
	        this._query = [];
	        var a = action.toLowerCase();
	        if (['select', 'upsert', 'delete', 'drop'].indexOf(a) != -1) {
	            this._query.push({ type: a, args: args });
	        }
	        return this;
	    };
	    someSQL_Instance.prototype.where = function (args) {
	        this._query.push({ type: 'where', args: args });
	        return this;
	    };
	    someSQL_Instance.prototype.andWhere = function (args) {
	        this._query.push({ type: 'andWhere', args: args });
	        return this;
	    };
	    someSQL_Instance.prototype.orWhere = function (args) {
	        this._query.push({ type: 'orWhere', args: args });
	        return this;
	    };
	    someSQL_Instance.prototype.orderBy = function (args) {
	        this._query.push({ type: 'orderby', args: args });
	        return this;
	    };
	    someSQL_Instance.prototype.limit = function (args) {
	        this._query.push({ type: 'limit', args: args });
	        return this;
	    };
	    someSQL_Instance.prototype.offset = function (args) {
	        this._query.push({ type: 'offset', args: args });
	        return this;
	    };
	    someSQL_Instance.prototype.exec = function () {
	        var t = this;
	        var _t = t._selectedTable;
	        t._triggerEvents = [];
	        this._query.map(function (q) {
	            switch (q.type) {
	                case "select": return [q.type];
	                case "delete":
	                case "upsert":
	                case "drop": return [q.type, 'change'];
	                default: return [];
	            }
	        }).forEach(function (events) {
	            events.forEach(function (event) {
	                t._triggerEvents.push(event);
	            });
	        });
	        return new someSQL_Promise(this, function (res, rej) {
	            t._backend.exec(_t, t._query, function (rows) {
	                t._triggerEvents.forEach(function (e) {
	                    t._callbacks[_t][e].concat(t._callbacks['*'][e]).forEach(function (cb) {
	                        cb({
	                            type: e,
	                            table: _t,
	                            query: t._query,
	                            time: new Date().getTime(),
	                            result: rows
	                        });
	                    });
	                });
	                res(rows);
	            });
	        });
	    };
	    someSQL_Instance.prototype.custom = function (argType, args) {
	        var t = this;
	        return new someSQL_Promise(t, function (res, rej) {
	            if (t._backend.custom) {
	                t._backend.custom(argType, args, res);
	            }
	            else {
	                res();
	            }
	        });
	    };
	    someSQL_Instance.prototype.loadJS = function (rows) {
	        var t = this;
	        return typescript_promise_1.tsPromise.all(rows.map(function (row) {
	            return t.init(t._selectedTable).query('upsert', row).exec();
	        }));
	    };
	    someSQL_Instance.prototype.loadCSV = function (csv) {
	        var t = this;
	        var fields = [];
	        return new someSQL_Promise(t, function (res, rej) {
	            typescript_promise_1.tsPromise.all(csv.split('\n').map(function (v, k) {
	                return new someSQL_Promise(t, function (resolve, reject) {
	                    if (k == 0) {
	                        fields = v.split(',');
	                        resolve();
	                    }
	                    else {
	                        var record_1 = {};
	                        var row_1 = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g).map(function (str) { return str.replace(/^"(.+(?="$))"$/, '$1'); });
	                        fields.forEach(function (f, i) {
	                            if (row_1[i].indexOf('{') == 0 || row_1[i].indexOf('[') == 0) {
	                                row_1[i] = JSON.parse(row_1[i].replace(/'/g, '"'));
	                            }
	                            record_1[f] = row_1[i];
	                        });
	                        t.init(t._selectedTable).query('upsert', row_1).exec().then(function () {
	                            resolve();
	                        });
	                    }
	                });
	            })).then(function () {
	                res();
	            });
	        });
	    };
	    someSQL_Instance.prototype.toCSV = function (headers) {
	        var t = this;
	        return new someSQL_Promise(t, function (res, rej) {
	            t.exec().then(function (json) {
	                var header = t._query.filter(function (q) {
	                    return q.type == 'select';
	                }).map(function (q) {
	                    return q.args ? q.args.map(function (m) {
	                        return t._models[t._selectedTable].filter(function (f) { return f.key == m; })[0];
	                    }) : t._models[t._selectedTable];
	                })[0];
	                if (headers) {
	                    json.unshift(header.map(function (h) {
	                        return h.key;
	                    }));
	                }
	                res(json.map(function (row, i) {
	                    if (headers && i == 0)
	                        return row;
	                    return header.filter(function (column) {
	                        return row[column.key] ? true : false;
	                    }).map(function (column) {
	                        switch (column.type) {
	                            case "map": return '"' + JSON.stringify(row[column.key]).replace(/"/g, "'") + '"';
	                            case "array": return '"' + JSON.stringify(row[column.key]).replace(/"/g, "'") + '"';
	                            default: return JSON.stringify(row[column.key]);
	                        }
	                    }).join(',');
	                }).join('\n'));
	            });
	        });
	    };
	    someSQL_Instance.uuid = function (inputUUID) {
	        return inputUUID ? inputUUID : (function () {
	            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
	                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
	                return v.toString(16);
	            });
	        })();
	    };
	    return someSQL_Instance;
	}());
	exports.someSQL_Instance = someSQL_Instance;
	var someSQL_Promise = (function (_super) {
	    __extends(someSQL_Promise, _super);
	    function someSQL_Promise(scope, callBackFunc) {
	        var _this = _super.call(this, callBackFunc) || this;
	        _this.scope = scope;
	        return _this;
	    }
	    someSQL_Promise.prototype.then = function (onSuccess, onFail) {
	        var parent = this;
	        return new someSQL_Promise(parent.scope, function (resolve, reject) {
	            parent.done(function (value) {
	                if (typeof onSuccess === 'function') {
	                    try {
	                        value = onSuccess.apply(parent.scope, [value]);
	                    }
	                    catch (e) {
	                        reject(e);
	                        return;
	                    }
	                }
	                resolve(value);
	            }, function (value) {
	                if (typeof onFail === 'function') {
	                    try {
	                        value = onFail.apply(parent.scope, [value]);
	                    }
	                    catch (e) {
	                        reject(e);
	                        return;
	                    }
	                    resolve(value);
	                }
	                else {
	                    reject(value);
	                }
	            });
	        });
	    };
	    return someSQL_Promise;
	}(typescript_promise_1.tsPromise));
	var someSQL_Selectedtableatic = new someSQL_Instance();
	function someSQL(table) {
	    return someSQL_Selectedtableatic.init(table);
	}
	exports.someSQL = someSQL;


/***/ },
/* 1 */
/***/ function(module, exports) {

	module.exports =
	/******/ (function(modules) { // webpackBootstrap
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
	/***/ function(module, exports) {

		"use strict";
		var tsPromise = (function () {
		    function tsPromise(callFunc) {
		        this._callbacks = [];
		        this._failed = false;
		        this._resolved = false;
		        this._settled = false;
		        callFunc(this._resolve.bind(this), this._reject.bind(this));
		    }
		    tsPromise.resolve = function (value) {
		        return new tsPromise(function (resolve) { resolve(value); });
		    };
		    tsPromise.reject = function (error) {
		        return new tsPromise(function (resolve, reject) { reject(error); });
		    };
		    tsPromise.race = function (promises) {
		        var complete = false;
		        return new tsPromise(function (resolve, reject) {
		            promises.forEach(function (p) {
		                p.then(function (res) {
		                    if (!complete)
		                        resolve(res), complete = true;
		                }).catch(function (error) {
		                    reject(error);
		                    complete = true;
		                });
		            });
		        });
		    };
		    tsPromise.all = function (promises) {
		        return new tsPromise(function (resolve, reject) {
		            var count = promises.length;
		            var results = [];
		            var complete = false;
		            promises.forEach(function (p, i) {
		                p.then(function (res) {
		                    if (!complete) {
		                        count--;
		                        results[i] = res;
		                        if (count == 0)
		                            resolve(results);
		                    }
		                }).catch(function (error) {
		                    reject(error);
		                    complete = true;
		                });
		            });
		        });
		    };
		    tsPromise.prototype.done = function (onSuccess, onFail) {
		        if (this._settled) {
		            setTimeout(this._release.bind(this, onSuccess, onFail), 0);
		        }
		        else {
		            this._callbacks.push({ onSuccess: onSuccess, onFail: onFail });
		        }
		    };
		    tsPromise.prototype.then = function (onSuccess, onFail) {
		        var parent = this;
		        return new tsPromise(function (resolve, reject) {
		            parent.done(function (value) {
		                if (typeof onSuccess === 'function') {
		                    try {
		                        value = onSuccess(value);
		                    }
		                    catch (e) {
		                        reject(e);
		                        return;
		                    }
		                }
		                resolve(value);
		            }, function (value) {
		                if (typeof onFail === 'function') {
		                    try {
		                        value = onFail(value);
		                    }
		                    catch (e) {
		                        reject(e);
		                        return;
		                    }
		                    resolve(value);
		                }
		                else {
		                    reject(value);
		                }
		            });
		        });
		    };
		    tsPromise.prototype.catch = function (onFail) {
		        return this.then(null, onFail);
		    };
		    tsPromise.prototype._release = function (onSuccess, onFail) {
		        if (this._failed) {
		            if (typeof onFail === 'function')
		                onFail(this._value);
		            else
		                throw this._value;
		        }
		        else {
		            if (typeof onSuccess === 'function')
		                onSuccess(this._value);
		        }
		    };
		    tsPromise.prototype._resolve = function (value) {
		        if (this._resolved)
		            return;
		        this._resolved = true;
		        if (value instanceof tsPromise) {
		            value.done(this._settle.bind(this), function (error) {
		                this._failed = true;
		                this._settle(error);
		            }.bind(this));
		        }
		        else {
		            this._settle(value);
		        }
		    };
		    tsPromise.prototype._reject = function (value) {
		        if (this._resolved)
		            return;
		        this._resolved = true;
		        this._failed = true;
		        this._settle(value);
		    };
		    tsPromise.prototype._settle = function (value) {
		        this._settled = true;
		        this._value = value;
		        setTimeout(this._callbacks.forEach.bind(this._callbacks, function (data) {
		            this._release(data.onSuccess, data.onFail);
		        }, this), 0);
		    };
		    return tsPromise;
		}());
		exports.tsPromise = tsPromise;


	/***/ }
	/******/ ]);

/***/ }
/******/ ]);