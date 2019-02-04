(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else {
		var a = factory();
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(window, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 6);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

Object.defineProperty(exports, "__esModule", { value: true });
var leven = __webpack_require__(3);
var equal = __webpack_require__(4);
exports.blankTableDefinition = {
    id: "",
    name: "",
    model: {},
    columns: [],
    indexes: {},
    actions: [],
    queries: {},
    views: [],
    pkType: "string",
    pkCol: [],
    isPkNum: false,
    ai: false
};
/**
 * Searches a sorted array for a given value.
 *
 * @param {any[]} arr
 * @param {*} value
 * @param {boolean} indexOf
 * @param {number} [startVal]
 * @param {number} [endVal]
 * @returns {number}
 */
exports.binarySearch = function (arr, value, indexOf, startVal, endVal) {
    var start = startVal || 0;
    var end = endVal || arr.length;
    if (arr[start] >= value)
        return indexOf ? -1 : start;
    if (arr[end] <= value)
        return indexOf ? -1 : end + 1;
    var m = Math.floor((start + end) / 2);
    if (value == arr[m])
        return m;
    if (end - 1 == start)
        return indexOf ? -1 : end;
    if (value > arr[m])
        return exports.binarySearch(arr, value, indexOf, m, end);
    if (value < arr[m])
        return exports.binarySearch(arr, value, indexOf, start, m);
    return indexOf ? -1 : end;
};
/**
 * Converts a word to title case.
 *
 * @param {string} str
 * @returns
 */
exports.titleCase = function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
exports.slugify = function (str) {
    return String(str).replace(/\s+/g, "-").replace(/[^0-9a-z\-]/gi, "").toLowerCase();
};
exports.buildQuery = function (nSQL, table, action) {
    return {
        table: table || nSQL.state.selectedTable,
        parent: nSQL,
        action: action,
        state: "pending",
        result: [],
        time: Date.now(),
        queryID: exports.uuid(),
        extend: [],
        comments: [],
        tags: []
    };
};
exports.adapterFilters = function (nSQL, query) {
    return {
        write: function (table, pk, row, complete, error) {
            nSQL.doFilter("adapterWrite", { res: { table: table, pk: pk, row: row, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.write(nSQL._tableIds[result.res.table], result.res.pk, result.res.row, function (pk) {
                    result.res.complete(pk);
                }, result.res.error);
            }, error);
        },
        read: function (table, pk, complete, error) {
            nSQL.doFilter("adapterRead", { res: { table: table, pk: pk, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.read(nSQL._tableIds[result.res.table], result.res.pk, function (row) {
                    if (!row) {
                        result.res.complete(undefined);
                        return;
                    }
                    result.res.complete(row);
                }, result.res.error);
            }, error);
        },
        readMulti: function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
            nSQL.doFilter("adapterReadMulti", { res: { table: table, type: type, offsetOrLow: offsetOrLow, limitOrHigh: limitOrHigh, reverse: reverse, onRow: onRow, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.readMulti(nSQL._tableIds[result.res.table], result.res.type, result.res.offsetOrLow, result.res.limitOrHigh, result.res.reverse, function (row, i) {
                    result.res.onRow(row, i);
                }, function () {
                    result.res.complete();
                }, result.res.error);
            }, error);
        },
        connect: function (id, complete, error) {
            nSQL.doFilter("adapterConnect", { res: { id: id, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.connect(result.res.id, result.res.complete, result.res.error);
            }, error);
        },
        disconnect: function (complete, error) {
            nSQL.doFilter("adapterDisconnect", { res: { complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.disconnect(result.res.complete, result.res.error);
            }, error);
        },
        createTable: function (tableName, tableData, complete, error) {
            nSQL.doFilter("adapterCreateTable", { res: { tableName: tableName, tableData: tableData, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.createTable(nSQL._tableIds[result.res.tableName], result.res.tableData, result.res.complete, result.res.error);
            }, error);
        },
        dropTable: function (table, complete, error) {
            nSQL.doFilter("adapterDropTable", { res: { table: nSQL._tableIds[table], complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.dropTable(result.res.table, result.res.complete, result.res.error);
            }, error);
        },
        delete: function (table, pk, complete, error) {
            nSQL.doFilter("adapterDelete", { res: { table: nSQL._tableIds[table], pk: pk, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.delete(result.res.table, result.res.pk, result.res.complete, result.res.error);
            }, error);
        },
        getTableIndex: function (table, complete, error) {
            nSQL.doFilter("adapterGetTableIndex", { res: { table: nSQL._tableIds[table], complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.getTableIndex(result.res.table, result.res.complete, result.res.error);
            }, error);
        },
        getTableIndexLength: function (table, complete, error) {
            nSQL.doFilter("adapterGetTableIndexLength", { res: { table: nSQL._tableIds[table], complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.getTableIndexLength(result.res.table, result.res.complete, result.res.error);
            }, error);
        },
        createIndex: function (table, indexName, type, complete, error) {
            nSQL.doFilter("adapterCreateIndex", { res: { table: nSQL._tableIds[table], indexName: indexName, type: type, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.createIndex(result.res.table, result.res.indexName, result.res.type, result.res.complete, result.res.error);
            }, error);
        },
        deleteIndex: function (table, indexName, complete, error) {
            if (!nSQL._tables[table].indexes[indexName]) {
                error({ error: "Index " + indexName + " not found!" });
                return;
            }
            nSQL.doFilter("adapterDeleteIndex", { res: { table: nSQL._tableIds[table], indexName: indexName, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.deleteIndex(result.res.table, result.res.indexName, result.res.complete, result.res.error);
            }, error);
        },
        addIndexValue: function (table, indexName, key, value, complete, error) {
            if (!nSQL._tables[table].indexes[indexName]) {
                error({ error: "Index " + indexName + " not found!" });
                return;
            }
            var value2 = value;
            // shift primary key query by offset
            if (typeof value2 === "number" && nSQL._tables[table].indexes[indexName].props && nSQL._tables[table].indexes[indexName].props.offset) {
                value2 += nSQL._tables[table].indexes[indexName].props.offset || 0;
            }
            nSQL.doFilter("adapterAddIndexValue", { res: { table: nSQL._tableIds[table], indexName: indexName, key: key, value: value2, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.addIndexValue(result.res.table, result.res.indexName, result.res.key, result.res.value, result.res.complete, result.res.error);
            }, error);
        },
        deleteIndexValue: function (table, indexName, key, value, complete, error) {
            if (!nSQL._tables[table].indexes[indexName]) {
                error({ error: "Index " + indexName + " not found!" });
                return;
            }
            var key2 = value;
            // shift primary key query by offset
            if (typeof key2 === "number" && nSQL._tables[table].indexes[indexName].props && nSQL._tables[table].indexes[indexName].props.offset) {
                key2 += nSQL._tables[table].indexes[indexName].props.offset || 0;
            }
            nSQL.doFilter("adapterDeleteIndexValue", { res: { table: nSQL._tableIds[table], indexName: indexName, key: key, value: key2, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.deleteIndexValue(result.res.table, result.res.indexName, result.res.key, result.res.value, result.res.complete, result.res.error);
            }, error);
        },
        readIndexKey: function (table, indexName, pk, onRowPK, complete, error) {
            if (!nSQL._tables[table].indexes[indexName]) {
                error({ error: "Index " + indexName + " not found!" });
                return;
            }
            var key = pk;
            // shift primary key query by offset
            if (typeof key === "number" && nSQL._tables[table].indexes[indexName].props && nSQL._tables[table].indexes[indexName].props.offset) {
                key += nSQL._tables[table].indexes[indexName].props.offset || 0;
            }
            nSQL.doFilter("adapterReadIndexKey", { res: { table: nSQL._tableIds[table], indexName: indexName, pk: key, onRowPK: onRowPK, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.readIndexKey(result.res.table, result.res.indexName, result.res.pk, result.res.onRowPK, result.res.complete, result.res.error);
            }, error);
        },
        readIndexKeys: function (table, indexName, type, offsetOrLow, limitOrHigh, reverse, onRowPK, complete, error) {
            var lower = offsetOrLow;
            var higher = limitOrHigh;
            if (!nSQL._tables[table].indexes[indexName]) {
                error({ error: "Index " + indexName + " not found!" });
                return;
            }
            // shift range query by offset
            if (typeof lower === "number" && typeof higher === "number" && type === "range") {
                if (nSQL._tables[table].indexes[indexName] && nSQL._tables[table].indexes[indexName].props.offset) {
                    lower += nSQL._tables[table].indexes[indexName].props.offset || 0;
                    higher += nSQL._tables[table].indexes[indexName].props.offset || 0;
                }
            }
            nSQL.doFilter("adapterReadIndexKeys", { res: { table: nSQL._tableIds[table], indexName: indexName, type: type, offsetOrLow: lower, limitOrHigh: higher, reverse: reverse, onRowPK: onRowPK, complete: complete, error: error }, query: query }, function (result) {
                if (!result)
                    return; // filter took over
                nSQL.adapter.readIndexKeys(result.res.table, result.res.indexName, result.res.type, result.res.offsetOrLow, result.res.limitOrHigh, result.res.reverse, result.res.onRowPK, result.res.complete, result.res.error);
            }, error);
        }
    };
};
exports.noop = function () { };
exports.throwErr = function (err) {
    throw new Error(err);
};
exports.nan = function (input) {
    return isNaN(input) || input === null ? 0 : parseFloat(input);
};
/**
 * Object.assign, but faster.
 *
 * @param {*} obj
 * @returns
 */
exports.assign = function (obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
};
/**
 * Compare two javascript variables for equality.
 * Works with primitives, arrays and objects recursively.
 *
 * @param {*} obj1
 * @param {*} obj2
 * @returns {boolean}
 */
exports.objectsEqual = function (obj1, obj2) {
    if (obj1 === obj2)
        return true;
    if (typeof obj1 !== "object")
        return false; // primitives will always pass === when they're equal, so we have primitives that don't match.
    if (!obj1 || !obj2)
        return false; // if either object is undefined they don't match
    return equal(obj1, obj2);
};
// tslint:disable-next-line
var _nanoSQLQueue = /** @class */ (function () {
    function _nanoSQLQueue(processItem, onError, onComplete) {
        this.processItem = processItem;
        this.onError = onError;
        this.onComplete = onComplete;
        this._items = [];
        this._going = false;
        this._done = false;
        this._count = 0;
        this._triggeredComplete = false;
        this._progressBuffer = this._progressBuffer.bind(this);
    }
    _nanoSQLQueue.prototype._progressBuffer = function () {
        var _this = this;
        if (this._triggeredComplete) {
            return;
        }
        // quueue as finished
        if (this._done && !this._items.length) {
            this._triggeredComplete = true;
            if (this.onComplete)
                this.onComplete();
            return;
        }
        // queue has paused
        if (!this._items.length) {
            this._going = false;
            return;
        }
        var next = function () {
            _this._count++;
            _this._count % 100 === 0 ? exports.setFast(_this._progressBuffer) : _this._progressBuffer();
        };
        // process queue
        var item = this._items.shift() || [];
        if (item[1]) {
            item[1](item[0], next, this.onError ? this.onError : exports.noop);
        }
        else if (this.processItem) {
            this.processItem(item[0], this._count, next, this.onError ? this.onError : exports.noop);
        }
    };
    _nanoSQLQueue.prototype.finished = function () {
        this._done = true;
        if (this._triggeredComplete) {
            return;
        }
        if (!this._going && !this._items.length) {
            this._triggeredComplete = true;
            if (this.onComplete)
                this.onComplete();
        }
    };
    _nanoSQLQueue.prototype.newItem = function (item, processFn) {
        this._items.push([item, processFn]);
        if (!this._going) {
            this._going = true;
            this._progressBuffer();
        }
    };
    return _nanoSQLQueue;
}());
exports._nanoSQLQueue = _nanoSQLQueue;
/**
 * Quickly and efficiently fire asynchronous operations in sequence, returns once all operations complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
exports.chainAsync = function (items, callback) {
    return new Promise(function (res, rej) {
        if (!items || !items.length) {
            res([]);
            return;
        }
        var results = [];
        var i = 0;
        var step = function () {
            if (i < items.length) {
                callback(items[i], i, function (result) {
                    if (result) {
                        results.push(result || 0);
                    }
                    i++;
                    i % 500 === 0 ? exports.setFast(step) : step();
                }, function (err) {
                    rej(err);
                });
            }
            else {
                res(results.length ? results : undefined);
            }
        };
        step();
    });
};
/**
 * Quickly and efficiently fire asynchronous operations in parallel, returns once all operations are complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, done: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
exports.allAsync = function (items, callback) {
    return Promise.all((items || []).map(function (item, i) {
        return new Promise(function (res, rej) {
            callback(item, i, res, rej);
        });
    }));
};
var ua = typeof window === "undefined" ? "" : (navigator.userAgent || "");
// Detects iOS device OR Safari running on desktop
exports.isSafari = ua.length === 0 ? false : (/^((?!chrome|android).)*safari/i.test(ua)) || (/iPad|iPhone|iPod/.test(ua) && !window["MSStream"]);
// Detect Edge or Internet Explorer
exports.isMSBrowser = ua.length === 0 ? false : ua.indexOf("MSIE ") > 0 || ua.indexOf("Trident/") > 0 || ua.indexOf("Edge/") > 0;
// Detect Android Device
exports.isAndroid = /Android/.test(ua);
/**
 * Generate a random 16 bit number using strongest entropy/crypto available.
 *
 * @returns {number}
 */
exports.random16Bits = function () {
    if (typeof crypto === "undefined") {
        return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
    }
    else {
        if (crypto.getRandomValues) { // Browser crypto
            var buf = new Uint16Array(1);
            crypto.getRandomValues(buf);
            return buf[0];
        }
        else if (typeof global !== "undefined" && global._crypto.randomBytes) { // NodeJS crypto
            return global._crypto.randomBytes(2).reduce(function (prev, cur) { return cur * prev; });
        }
        else {
            return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
        }
    }
};
exports.throttle = function (scope, func, limit) {
    var waiting = false;
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (waiting)
            return;
        waiting = true;
        setTimeout(function () {
            func.apply(scope, args);
            waiting = false;
        }, limit);
    };
};
/**
 * Generate a TimeID for use in the database.
 *
 * @param {boolean} [ms]
 * @returns {string}
 */
exports.timeid = function (ms) {
    var time = Math.round((new Date().getTime()) / (ms ? 1 : 1000)).toString();
    while (time.length < (ms ? 13 : 10)) {
        time = "0" + time;
    }
    var seed = (exports.random16Bits() + exports.random16Bits()).toString(16);
    while (seed.length < 5) {
        seed = "0" + seed;
    }
    return time + "-" + seed;
};
/**
 * See if two arrays intersect.
 *
 * @param {any[]} arr1
 * @param {any[]} arr2
 * @returns {boolean}
 */
exports.intersect = function (arr1, arr2) {
    if (!arr1 || !arr2)
        return false;
    if (!arr1.length || !arr2.length)
        return false;
    return (arr1 || []).filter(function (item) { return (arr2 || []).indexOf(item) !== -1; }).length > 0;
};
/**
 * Generates a valid V4 UUID using the strongest crypto available.
 *
 * @returns {string}
 */
exports.uuid = function () {
    var r, s, b = "";
    return [b, b, b, b, b, b, b, b].reduce(function (prev, cur, i) {
        r = exports.random16Bits();
        s = (i === 3 ? 4 : (i === 4 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
        r = r.toString(16);
        while (r.length < 4)
            r = "0" + r;
        return prev + ([2, 3, 4, 5].indexOf(i) > -1 ? "-" : b) + (s + r).slice(0, 4);
    }, b);
};
/**
 * A quick and dirty hashing function, turns a string into a md5 style hash.
 * Stolen from https://github.com/darkskyapp/string-hash
 *
 * @param {string} str
 * @returns {string}
 */
exports.hash = function (str) {
    var hash = 5381, i = str.length;
    while (i) {
        hash = (hash * 33) ^ str.charCodeAt(--i);
    }
    return (hash >>> 0).toString(16);
};
/**
 * Generate a row ID given the primary key type.
 *
 * @param {string} primaryKeyType
 * @param {number} [incrimentValue]
 * @returns {*}
 */
exports.generateID = function (primaryKeyType, incrimentValue) {
    var idTypes = {
        "int": function (value) { return value; },
        "float": function (value) { return value; },
        "uuid": exports.uuid,
        "timeId": function () { return exports.timeid(); },
        "timeIdms": function () { return exports.timeid(true); }
    };
    return idTypes[primaryKeyType] ? idTypes[primaryKeyType](incrimentValue || 1) : undefined;
};
exports.cleanArgs2 = function (args, dataModel, nSQL) {
    var returnObj = {};
    var conformType = function (strType, obj, dModel) {
        if (strType.indexOf("[]") !== -1) {
            var arrayOf_1 = strType.slice(0, strType.lastIndexOf("[]"));
            // value should be array but isn't, cast it to one
            if (!Array.isArray(obj))
                return [];
            // we have an array, cast array of types
            return obj.map(function (v) { return conformType(arrayOf_1, v, dModel); });
        }
        if (typeof dModel === "string") {
            var findModel_1 = dModel.replace(/\[\]/gmi, "");
            var typeModel = Object.keys(nSQL.config.types || {}).reduce(function (prev, cur) {
                if (cur === findModel_1)
                    return (nSQL.config.types || {})[cur];
                return prev;
            }, undefined);
            if (!typeModel) {
                throw new Error("Can't find type " + findModel_1 + "!");
            }
            return conformType(dModel, args, typeModel);
        }
        else {
            var returnObj_1 = {};
            var getOtherCols_1 = false;
            var definedCols_1 = [];
            Object.keys(dModel).forEach(function (colAndType) {
                var split = colAndType.split(":");
                if (split[0] === "*") {
                    getOtherCols_1 = true;
                }
                else {
                    definedCols_1.push(split[0]);
                    returnObj_1[split[0]] = exports.cast(split[1], obj[split[0]], false, nSQL);
                }
            });
            if (getOtherCols_1 && exports.isObject(obj)) {
                Object.keys(obj).filter(function (k) { return definedCols_1.indexOf(k) === -1; }).forEach(function (key) {
                    returnObj_1[key] = obj[key];
                });
            }
            return returnObj_1;
        }
    };
    return conformType(typeof dataModel === "string" ? dataModel : "", args, dataModel);
};
/**
 * Clean the arguments from an object given an array of arguments and their types.
 *
 * @param {string[]} argDeclarations
 * @param {StdObject<any>} args
 * @returns {StdObject<any>}
 */
exports.cleanArgs = function (argDeclarations, args, nSQL) {
    var a = {};
    var i = argDeclarations.length;
    var customTypes = Object.keys(nSQL.config.types || {});
    while (i--) {
        var k2 = argDeclarations[i].split(":");
        if (k2.length > 1) {
            a[k2[0]] = exports.cast(k2[1], args[k2[0]] || undefined, true, nSQL);
        }
        else {
            a[k2[0]] = args[k2[0]] || undefined;
        }
    }
    return a;
};
/**
 * Determine if a given value is a javascript object or not. Exludes Arrays, Functions, Null, Undefined, etc.
 *
 * @param {*} val
 * @returns {boolean}
 */
exports.isObject = function (val) {
    return Object.prototype.toString.call(val) === "[object Object]";
};
exports.objSort = function (path, rev) {
    return function (a, b) {
        var result = path ? (exports.deepGet(path, a) > exports.deepGet(path, b) ? -1 : 1) : (a > b ? -1 : 1);
        return rev ? result * -1 : result;
    };
};
/**
 * Recursively resolve function values provided a string and row
 *
 *
 * @param {string} fnString // TRIM(UPPER(column))
 * @param {*} row // {column: " value "}
 * @param {*} prev // aggregate previous value for aggregate functions
 * @returns {InanoSQLFunctionResult}
 * @memberof _nanoSQLQuery
 */
exports.execFunction = function (query, fnString, row, prev) {
    var _a;
    var fnArgs = fnString.match(/\((.*)\)/gmi);
    if (!fnArgs[0])
        return { result: undefined };
    var args = fnArgs[0].substr(1, fnArgs[0].length - 2).split(/\,\s?(?![^\(]*\))/).map(function (s) { return s.trim(); });
    var fnName = fnString.split("(").shift();
    var calcArgs = args.map(function (s) { return s.indexOf("(") !== -1 ? exports.execFunction(query, s, row, prev).result : s; });
    if (!query.parent.functions[fnName]) {
        return { result: undefined };
    }
    return (_a = query.parent.functions[fnName]).call.apply(_a, [query, row, prev].concat(calcArgs));
};
/**
 * Cast a javascript variable to a given type. Supports typescript primitives and more specific types.
 *
 * @param {string} type
 * @param {*} [val]
 * @returns {*}
 */
exports.cast = function (type, val, allowUknownTypes, nSQL) {
    if (type === "any" || type === "blob" || type === "*")
        return val;
    // recursively cast arrays
    if (type.indexOf("[]") !== -1) {
        var arrayOf_2 = type.slice(0, type.lastIndexOf("[]"));
        // value should be array but isn't, cast it to one
        if (!Array.isArray(val))
            return [];
        // we have an array, cast array of types
        return val.map(function (v) { return exports.cast(arrayOf_2, v, allowUknownTypes); });
    }
    var t = typeof val;
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
    var types = nSQL ? nSQL.config.types || {} : {};
    // custom type found
    if (Object.keys(types).indexOf(type) !== -1) {
        if (exports.isObject(val)) {
            var keys = [];
            var customType = "";
            var typeObj = types[type];
            var returnObj = Object.keys(typeObj).reduce(function (prev, cur) {
                var key = cur.split(":");
                prev[key[0]] = exports.cast(key[1], val[key[0]], allowUknownTypes, nSQL);
                return prev;
            }, {});
            return returnObj;
        }
        return {};
    }
    var doCast = function (castType, castVal) {
        switch (castType) {
            case "safestr": return doCast("string", castVal).replace(/[&<>"'`=\/]/gmi, function (s) { return entityMap[s]; });
            case "int": return (t !== "number" || castVal % 1 !== 0) ? Math.round(exports.nan(castVal)) : castVal;
            case "number":
            case "float": return t !== "number" ? exports.nan(castVal) : castVal;
            case "array": return Array.isArray(castVal) ? castVal : [];
            case "uuid":
            case "timeId":
            case "timeIdms":
            case "string": return t !== "string" ? String(castVal) : castVal;
            case "object":
            case "obj":
            case "map": return exports.isObject(castVal) ? castVal : {};
            case "boolean":
            case "bool": return castVal === true || castVal === 1 ? true : false;
        }
        // doesn't match known types, return null;
        return allowUknownTypes ? val : null;
    };
    if (typeof val === "undefined" || val === null)
        return null;
    var newVal = doCast(String(type || "").toLowerCase(), val);
    // force numerical values to be a number and not NaN.
    if (newVal !== undefined && ["int", "float", "number"].indexOf(type) > -1) {
        return isNaN(newVal) ? 0 : newVal;
    }
    return newVal;
};
exports.rad2deg = function (rad) {
    return rad * 180 / Math.PI;
};
exports.deg2rad = function (deg) {
    return deg * (Math.PI / 180);
};
/**
 * "As the crow flies" or Haversine formula, used to calculate the distance between two points on a sphere.
 *
 * The unit used for the radius will determine the unit of the answer.  If the radius is in km, distance provided will be in km.
 *
 * The radius is in km by default.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @param {number} radius
 * @returns {number}
 */
exports.crowDistance = function (lat1, lon1, lat2, lon2, radius) {
    if (radius === void 0) { radius = 6371; }
    var dLat = exports.deg2rad(lat2 - lat1);
    var dLon = exports.deg2rad(lon2 - lon1);
    var a = Math.pow(Math.sin(dLat / 2), 2) +
        Math.cos(exports.deg2rad(lat1)) * Math.cos(exports.deg2rad(lat2)) *
            Math.pow(Math.sin(dLon / 2), 2);
    return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};
exports.levenshtein = function (word1, word2) {
    return leven(word1, word2);
};
var objectPathCache = {};
// turn path into array of strings, ie value[hey][there].length => [value, hey, there, length];
exports.resolvePath = function (pathQuery) {
    if (!pathQuery)
        return [];
    if (objectPathCache[pathQuery]) {
        return objectPathCache[pathQuery].slice();
    }
    var path = pathQuery.indexOf("[") !== -1 ?
        // handle complex mix of dots and brackets like "users.value[meta][value].length"
        pathQuery.split(/\.|\[/gmi).map(function (v) { return v.replace(/\]/gmi, ""); }) :
        // handle simple dot paths like "users.meta.value.length"
        pathQuery.split(".");
    objectPathCache[pathQuery] = path;
    return objectPathCache[pathQuery].slice();
};
exports.getFnValue = function (row, valueOrPath) {
    return valueOrPath.match(/\".*\"|\'.*\'/gmi) ? valueOrPath.replace(/\"|\'/gmi, "") : exports.deepGet(valueOrPath, row);
};
/**
 * Recursively freeze a javascript object to prevent it from being modified.
 *
 * @param {*} obj
 * @returns
 */
exports.deepFreeze = function (obj) {
    Object.getOwnPropertyNames(obj || {}).forEach(function (name) {
        var prop = obj[name];
        if (typeof prop === "object" && prop !== null) {
            obj[name] = exports.deepFreeze(prop);
        }
    });
    // Freeze self (no-op if already frozen)
    return Object.freeze(obj);
};
exports.deepSet = function (pathQuery, object, value) {
    var safeSet = function (getPath, pathIdx, setObj) {
        if (!getPath[pathIdx + 1]) { // end of path
            setObj[getPath[pathIdx]] = value;
            return;
        }
        else if (!setObj[getPath[pathIdx]] || (!Array.isArray(setObj[getPath[pathIdx]]) && !exports.isObject(setObj[getPath[pathIdx]]))) { // nested value doesn't exist yet
            if (isNaN(getPath[pathIdx + 1])) { // assume number queries are for arrays, otherwise an object
                setObj[getPath[pathIdx]] = {};
            }
            else {
                setObj[getPath[pathIdx]] = [];
            }
        }
        safeSet(getPath, pathIdx + 1, setObj[getPath[pathIdx]]);
    };
    safeSet(Array.isArray(pathQuery) ? pathQuery : exports.resolvePath(pathQuery), 0, object);
    return object;
};
/**
 * Take an object and a string describing a path like "value.length" or "val[length]" and safely get that value in the object.
 *
 * objQuery("hello", {hello: 2}) => 2
 * objQuery("hello.length", {hello: [0]}) => 1
 * objQuery("hello[0]", {hello: ["there"]}) => "there"
 * objQuery("hello[0].length", {hello: ["there"]}) => 5
 * objQuery("hello.color.length", {"hello.color": "blue"}) => 4
 *
 * @param {string} pathQuery
 * @param {*} object
 * @param {boolean} [ignoreFirstPath]
 * @returns {*}
 */
exports.deepGet = function (pathQuery, object) {
    var safeGet = function (getPath, pathIdx, object) {
        if (!getPath[pathIdx] || !object)
            return object;
        return safeGet(getPath, pathIdx + 1, object[getPath[pathIdx]]);
    };
    return safeGet(Array.isArray(pathQuery) ? pathQuery : exports.resolvePath(pathQuery), 0, object);
};
exports.maybeAssign = function (obj) {
    return Object.isFrozen(obj) ? exports.assign(obj) : obj;
};
var uid = 0;
var storage = {};
var slice = Array.prototype.slice;
var message = "setMsg";
var canPost = typeof window !== "undefined" && window.postMessage && window.addEventListener;
var fastApply = function (args) {
    return args[0].apply(null, slice.call(args, 1));
};
var callback = function (event) {
    var key = event.data;
    var data;
    if (typeof key === "string" && key.indexOf(message) === 0) {
        data = storage[key];
        if (data) {
            delete storage[key];
            fastApply(data);
        }
    }
};
if (canPost) {
    window.addEventListener("message", callback);
}
var setImmediatePolyfill = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var id = uid++;
    var key = message + id;
    storage[key] = args;
    window.postMessage(key, "*");
    return id;
};
exports.setFast = (function () {
    return canPost ? setImmediatePolyfill : // built in window messaging (pretty fast, not bad)
        function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (typeof global !== "undefined") {
                global["setImmediate"](function () {
                    fastApply(args);
                });
            }
            else {
                setTimeout(function () {
                    fastApply(args);
                }, 0);
            }
        };
})();
//# sourceMappingURL=utilities.js.map

/***/ }),
/* 1 */
/***/ (function(module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = 2.14;
;
var InanoSQLFKActions;
(function (InanoSQLFKActions) {
    InanoSQLFKActions[InanoSQLFKActions["NONE"] = 0] = "NONE";
    InanoSQLFKActions[InanoSQLFKActions["CASCADE"] = 1] = "CASCADE";
    InanoSQLFKActions[InanoSQLFKActions["RESTRICT"] = 2] = "RESTRICT";
    InanoSQLFKActions[InanoSQLFKActions["SET_NULL"] = 3] = "SET_NULL";
})(InanoSQLFKActions = exports.InanoSQLFKActions || (exports.InanoSQLFKActions = {}));
var IWhereType;
(function (IWhereType) {
    IWhereType[IWhereType["fast"] = 0] = "fast";
    IWhereType[IWhereType["medium"] = 1] = "medium";
    IWhereType[IWhereType["slow"] = 2] = "slow";
    IWhereType[IWhereType["fn"] = 3] = "fn";
    IWhereType[IWhereType["none"] = 4] = "none"; // no where, return all rows
})(IWhereType = exports.IWhereType || (exports.IWhereType = {}));
//# sourceMappingURL=interfaces.js.map

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = __webpack_require__(0);
exports.err = new Error("Memory index doesn't support this action!");
var nanoSQLMemoryIndex = /** @class */ (function () {
    function nanoSQLMemoryIndex(assign, useCache) {
        this.assign = assign;
        this.useCache = useCache;
        this.indexes = {};
        this.indexLoaded = {};
        this.useCacheIndexes = {};
    }
    nanoSQLMemoryIndex.prototype.connect = function (id, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.disconnect = function (complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.createTable = function (tableName, tableData, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.dropTable = function (table, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.write = function (table, pk, row, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.read = function (table, pk, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.delete = function (table, pk, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.getTableIndex = function (table, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.getTableIndexLength = function (table, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.createIndex = function (tableId, index, type, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        this.createTable(indexName, __assign({}, utilities_1.blankTableDefinition, { pkType: type, pkCol: ["id"], isPkNum: ["float", "int", "number"].indexOf(type) !== -1 }), function () {
            if (_this.indexes[indexName]) {
                complete();
                return;
            }
            _this.indexes[indexName] = {};
            _this.indexLoaded[indexName] = false;
            _this.useCacheIndexes[indexName] = _this.useCache || false;
            complete();
            _this.nSQL.doFilter("loadIndexCache", { res: { load: _this.useCache || false }, index: indexName }, function (result) {
                _this.useCacheIndexes[indexName] = result.res.load;
                if (result.res.load) {
                    _this.readMulti(indexName, "all", undefined, undefined, false, function (row) {
                        if (!_this.indexes[indexName][row.id]) {
                            _this.indexes[indexName][row.id] = row.pks || [];
                        }
                    }, function () {
                        _this.indexLoaded[indexName] = true;
                    }, error);
                }
            }, error);
        }, error);
    };
    nanoSQLMemoryIndex.prototype.deleteIndex = function (tableId, index, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        delete this.indexes[indexName];
        delete this.indexLoaded[indexName];
        delete this.useCacheIndexes[indexName];
        this.dropTable(indexName, complete, error);
    };
    nanoSQLMemoryIndex.prototype.addIndexValue = function (tableId, index, key, value, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        if (!this.indexLoaded[indexName]) {
            this.read(indexName, value, function (row) {
                var pks = row ? row.pks : [];
                pks = _this.assign ? utilities_1.assign(pks) : pks;
                if (pks.length === 0) {
                    pks.push(key);
                }
                else {
                    var idx = utilities_1.binarySearch(pks, key, false);
                    pks.splice(idx, 0, key);
                }
                if (_this.useCacheIndexes[indexName]) {
                    _this.indexes[indexName][value] = pks;
                }
                _this.write(indexName, value, {
                    id: key,
                    pks: _this.assign ? utilities_1.assign(pks) : pks
                }, complete, error);
            }, error);
            return;
        }
        if (!this.indexes[indexName][value]) {
            this.indexes[indexName][value] = [];
            this.indexes[indexName][value].push(key);
        }
        else {
            var idx = utilities_1.binarySearch(this.indexes[indexName][value], key, false);
            this.indexes[indexName][value].splice(idx, 0, key);
        }
        this.write(indexName, value, {
            id: key,
            pks: this.assign ? utilities_1.assign(this.indexes[indexName][value]) : this.indexes[indexName][value]
        }, complete, error);
    };
    nanoSQLMemoryIndex.prototype.deleteIndexValue = function (tableId, index, key, value, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        if (!this.indexLoaded[indexName]) {
            this.read(indexName, value, function (row) {
                var pks = row ? row.pks : [];
                pks = _this.assign ? utilities_1.assign(pks) : pks;
                if (pks.length === 0) {
                    complete();
                    return;
                }
                else {
                    var idx = pks.length < 100 ? pks.indexOf(key) : utilities_1.binarySearch(pks, key, true);
                    if (idx !== -1) {
                        pks.splice(idx, 1);
                    }
                }
                if (_this.useCacheIndexes[indexName]) {
                    _this.indexes[indexName][value] = pks;
                }
                if (pks.length) {
                    _this.write(indexName, value, {
                        id: key,
                        pks: _this.assign ? utilities_1.assign(pks) : pks
                    }, complete, error);
                }
                else {
                    _this.delete(indexName, value, complete, error);
                }
            }, error);
        }
        else {
            var idx = this.indexes[indexName][value].length < 100 ? this.indexes[indexName][value].indexOf(key) : utilities_1.binarySearch(this.indexes[indexName][value], key, true);
            if (idx !== -1) {
                this.indexes[indexName][value].splice(idx, 1);
                var pks = this.indexes[indexName][value];
                if (pks.length) {
                    this.write(indexName, value, {
                        id: key,
                        pks: this.assign ? utilities_1.assign(pks) : pks
                    }, complete, error);
                }
                else {
                    this.delete(indexName, value, complete, error);
                }
            }
            else {
                complete();
            }
        }
    };
    nanoSQLMemoryIndex.prototype.readIndexKey = function (tableId, index, pk, onRowPK, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.read(indexName, pk, function (row) {
            if (!row) {
                complete();
                return;
            }
            row.pks.forEach(onRowPK);
            complete();
        }, error);
    };
    nanoSQLMemoryIndex.prototype.readIndexKeys = function (tableId, index, type, offsetOrLow, limitOrHigh, reverse, onRowPK, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.readMulti(indexName, type, offsetOrLow, limitOrHigh, reverse, function (index) {
            if (!index)
                return;
            index.pks.forEach(function (pk) {
                onRowPK(pk, index.id);
            });
        }, complete, error);
    };
    return nanoSQLMemoryIndex;
}());
exports.nanoSQLMemoryIndex = nanoSQLMemoryIndex;
//# sourceMappingURL=memoryIndex.js.map

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = levenshtein

var cache = []
var codes = []

function levenshtein(value, other, insensitive) {
  var length
  var lengthOther
  var code
  var result
  var distance
  var distanceOther
  var index
  var indexOther

  if (value === other) {
    return 0
  }

  length = value.length
  lengthOther = other.length

  if (length === 0) {
    return lengthOther
  }

  if (lengthOther === 0) {
    return length
  }

  if (insensitive) {
    value = value.toLowerCase()
    other = other.toLowerCase()
  }

  index = 0

  while (index < length) {
    codes[index] = value.charCodeAt(index)
    cache[index] = ++index
  }

  indexOther = 0

  while (indexOther < lengthOther) {
    code = other.charCodeAt(indexOther)
    result = distance = indexOther++
    index = -1

    while (++index < length) {
      distanceOther = code === codes[index] ? distance : distance + 1
      distance = cache[index]
      cache[index] = result =
        distance > result
          ? distanceOther > result
            ? result + 1
            : distanceOther
          : distanceOther > distance
            ? distance + 1
            : distanceOther
    }
  }

  return result
}


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var isArray = Array.isArray;
var keyList = Object.keys;
var hasProp = Object.prototype.hasOwnProperty;

module.exports = function equal(a, b) {
  if (a === b) return true;

  if (a && b && typeof a == 'object' && typeof b == 'object') {
    var arrA = isArray(a)
      , arrB = isArray(b)
      , i
      , length
      , key;

    if (arrA && arrB) {
      length = a.length;
      if (length != b.length) return false;
      for (i = length; i-- !== 0;)
        if (!equal(a[i], b[i])) return false;
      return true;
    }

    if (arrA != arrB) return false;

    var dateA = a instanceof Date
      , dateB = b instanceof Date;
    if (dateA != dateB) return false;
    if (dateA && dateB) return a.getTime() == b.getTime();

    var regexpA = a instanceof RegExp
      , regexpB = b instanceof RegExp;
    if (regexpA != regexpB) return false;
    if (regexpA && regexpB) return a.toString() == b.toString();

    var keys = keyList(a);
    length = keys.length;

    if (length !== keyList(b).length)
      return false;

    for (i = length; i-- !== 0;)
      if (!hasProp.call(b, keys[i])) return false;

    for (i = length; i-- !== 0;) {
      key = keys[i];
      if (!equal(a[key], b[key])) return false;
    }

    return true;
  }

  return a!==a && b!==b;
};


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = __webpack_require__(1);
var utilities_1 = __webpack_require__(0);
var memoryIndex_1 = __webpack_require__(2);
exports.SQLiteAbstract = function (_query, _batchSize) {
    var tables = [];
    var tableConfigs = {};
    var checkTable = function (table) {
        if (tables.indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        }
        else {
            return "\"" + table + "\"";
        }
    };
    return {
        createAI: function (complete, error) {
            _query(true, "CREATE TABLE IF NOT EXISTS \"_ai\" (id TEXT PRIMARY KEY UNIQUE, inc BIGINT)", [], utilities_1.noop, complete, error);
        },
        createTable: function (table, tableData, ai, complete, error) {
            tables.push(table);
            tableConfigs[table] = tableData;
            _query(true, "CREATE TABLE IF NOT EXISTS \"" + table + "\" (id " + (tableData.isPkNum ? "REAL" : "TEXT") + " PRIMARY KEY UNIQUE, data TEXT)", [], utilities_1.noop, function () {
                if (tableData.ai) {
                    var rows_1 = [];
                    _query(false, "SELECT \"inc\" FROM \"_ai\" WHERE id = ?", [table], function (result) {
                        rows_1.push(result);
                    }, function () {
                        if (!rows_1.length) {
                            ai[table] = 0;
                            _query(true, "INSERT into \"_ai\" (id, inc) VALUES (?, ?)", [table, 0], utilities_1.noop, complete, error);
                        }
                        else {
                            ai[table] = parseInt(rows_1[0].inc);
                            complete();
                        }
                    }, error);
                }
                else {
                    complete();
                }
            }, error);
        },
        dropTable: function (table, complete, error) {
            _query(true, "DROP TABLE IF EXISTS " + checkTable(table), [], utilities_1.noop, function () {
                _query(true, "UPDATE \"_ai\" SET inc = ? WHERE id = ?", [0, table], utilities_1.noop, function () {
                    tables.splice(tables.indexOf(table), 1);
                    complete();
                }, error);
            }, error);
        },
        write: function (pkType, pkCol, table, pk, row, doAI, ai, complete, error) {
            pk = pk || utilities_1.generateID(pkType, ai[table] + 1);
            if (typeof pk === "undefined") {
                error(new Error("Can't add a row without a primary key!"));
                return;
            }
            if (doAI)
                ai[table] = Math.max(pk, ai[table]);
            utilities_1.deepSet(pkCol, row, pk);
            var rowStr = JSON.stringify(row);
            var afterWrite = function () {
                if (doAI && pk >= ai[table]) {
                    _query(true, "UPDATE \"_ai\" SET inc = ? WHERE id = ?", [ai[table], table], utilities_1.noop, function () {
                        complete(pk);
                    }, error);
                }
                else {
                    complete(pk);
                }
            };
            var rows = [];
            _query(false, "SELECT id FROM " + checkTable(table) + " WHERE id = ?", [pk], function (result) {
                rows.push(result);
            }, function () {
                if (rows.length) {
                    _query(true, "UPDATE " + checkTable(table) + " SET data = ? WHERE id = ?", [rowStr, pk], utilities_1.noop, afterWrite, error);
                }
                else {
                    _query(true, "INSERT INTO " + checkTable(table) + " (id, data) VALUES (?, ?)", [pk, rowStr], utilities_1.noop, afterWrite, error);
                }
            }, error);
        },
        read: function (table, pk, complete, error) {
            var rows = [];
            _query(false, "SELECT data FROM " + checkTable(table) + " WHERE id = ?", [pk], function (result) {
                rows.push(result);
            }, function () {
                if (rows.length) {
                    complete(JSON.parse(rows[0].data));
                }
                else {
                    complete(undefined);
                }
            }, error);
        },
        remove: function (table, pk, complete, error) {
            _query(true, "DELETE FROM " + checkTable(table) + " WHERE id = ?", [pk], utilities_1.noop, function () {
                complete();
            }, error);
        },
        getIndex: function (table, complete, error) {
            var idx = [];
            _query(false, "SELECT id FROM " + checkTable(table) + " ORDER BY id", [], function (row) {
                idx.push(row.id);
            }, function () {
                complete(idx);
            }, error);
        },
        getNumberOfRecords: function (table, complete, error) {
            var rows = [];
            _query(false, "SELECT COUNT(*) FROM " + checkTable(table), [], function (result) {
                rows.push(result);
            }, function () {
                complete(rows[0]["COUNT(*)"]);
            }, error);
        },
        readMulti: function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
            var stmnt = "SELECT data FROM " + checkTable(table);
            if (type === "range") {
                stmnt += " WHERE id BETWEEN ? AND ?";
            }
            if (reverse) {
                stmnt += " ORDER BY id DESC";
            }
            else {
                stmnt += " ORDER BY id";
            }
            var query = stmnt;
            if (type === "offset") {
                var lower = reverse ? offsetOrLow + 1 : offsetOrLow;
                var higher = limitOrHigh;
                query += " LIMIT " + higher + " OFFSET " + lower;
            }
            _query(false, query, type === "range" ? [offsetOrLow, limitOrHigh] : [], function (row, i) {
                onRow(JSON.parse(row.data), i);
            }, function () {
                complete();
            }, error);
        }
    };
};
var WebSQL = /** @class */ (function (_super) {
    __extends(WebSQL, _super);
    function WebSQL(size, batchSize) {
        var _this = _super.call(this, false, false) || this;
        _this.plugin = {
            name: "WebSQL Adapter",
            version: interfaces_1.VERSION
        };
        _this._size = (size || 0) * 1000 * 1000;
        _this._ai = {};
        _this._query = _this._query.bind(_this);
        _this._tableConfigs = {};
        _this._sqlite = exports.SQLiteAbstract(_this._query, batchSize || 500);
        return _this;
    }
    WebSQL.prototype.connect = function (id, complete, error) {
        var _this = this;
        this._id = id;
        this._db = window.openDatabase(this._id, String(this.nSQL.config.version) || "1.0", this._id, (utilities_1.isAndroid ? 5000000 : this._size));
        utilities_1.setFast(function () {
            _this._sqlite.createAI(complete, error);
        });
    };
    WebSQL.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    };
    WebSQL.prototype._query = function (allowWrite, sql, args, onRow, complete, error) {
        var doTransaction = function (tx) {
            tx.executeSql(sql, args, function (tx2, result) {
                for (var i = 0; i < result.rows.length; i++) {
                    onRow(result.rows.item(i), i);
                }
                complete();
            }, function (tx, err) {
                error(err);
                return false;
            });
        };
        if (allowWrite) {
            this._db.transaction(doTransaction);
        }
        else {
            this._db.readTransaction(doTransaction);
        }
    };
    WebSQL.prototype.dropTable = function (table, complete, error) {
        this._sqlite.dropTable(table, complete, error);
    };
    WebSQL.prototype.disconnect = function (complete, error) {
        complete();
    };
    WebSQL.prototype.write = function (table, pk, row, complete, error) {
        this._sqlite.write(this._tableConfigs[table].pkType, this._tableConfigs[table].pkCol, table, pk, row, this._tableConfigs[table].ai, this._ai, complete, error);
    };
    WebSQL.prototype.read = function (table, pk, complete, error) {
        this._sqlite.read(table, pk, complete, error);
    };
    WebSQL.prototype.delete = function (table, pk, complete, error) {
        this._sqlite.remove(table, pk, complete, error);
    };
    WebSQL.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        this._sqlite.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error);
    };
    WebSQL.prototype.getTableIndex = function (table, complete, error) {
        this._sqlite.getIndex(table, complete, error);
    };
    WebSQL.prototype.getTableIndexLength = function (table, complete, error) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    };
    return WebSQL;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.WebSQL = WebSQL;
//# sourceMappingURL=webSQL.js.map

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(7);


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

Object.defineProperty(exports, "__esModule", { value: true });
var sqliteCordova = __webpack_require__(8);
var core_1 = __webpack_require__(9);
exports.nSQL = core_1.nSQL;
exports.nanoSQL = core_1.nanoSQL;
exports.nSQLv1Config = core_1.nSQLv1Config;
var getMode = sqliteCordova.getMode;
exports.getMode = getMode;
if (typeof window !== "undefined") {
    window["nSQL"] = core_1.nSQL;
    window["nanoSQL"] = core_1.nanoSQL;
    window["nSQLv1Config"] = core_1.nSQLv1Config;
}


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var memoryIndex_1 = __webpack_require__(2);
var webSQL_1 = __webpack_require__(5);
exports.getMode = function () {
    if (typeof cordova !== "undefined" && window["sqlitePlugin"]) {
        if (window["device"] && window["device"].platform && window["device"].platform !== "browser") {
            return new SQLiteCordova();
        }
        else {
            return "PERM";
        }
    }
    else {
        return "PERM";
    }
};
var SQLiteCordova = /** @class */ (function (_super) {
    __extends(SQLiteCordova, _super);
    function SQLiteCordova() {
        var _this = _super.call(this, false, false) || this;
        _this.plugin = {
            name: "SQLite Cordova Adapter",
            version: 2.07
        };
        if (!window["sqlitePlugin"]) {
            throw Error("SQLite plugin not installed or nanoSQL plugin called before device ready!");
        }
        _this._ai = {};
        _this._query = _this._query.bind(_this);
        _this._tableConfigs = {};
        _this._sqlite = webSQL_1.SQLiteAbstract(_this._query, 500);
        return _this;
    }
    SQLiteCordova.prototype.connect = function (id, complete, error) {
        console.log("nanoSQL \"" + id + "\" using SQLite.");
        try {
            this._db = window["sqlitePlugin"].openDatabase({ name: id, location: "default" });
            complete();
        }
        catch (e) {
            error(e);
        }
    };
    SQLiteCordova.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    };
    SQLiteCordova.prototype._query = function (allowWrite, sql, args, onRow, complete, error) {
        this._db.executeSql(sql, args, function (result) {
            var rows = [];
            for (var i = 0; i < result.rows.length; i++) {
                onRow(result.rows.item(i), i);
            }
            complete();
        }, function (err) {
            error(err);
        });
    };
    SQLiteCordova.prototype.dropTable = function (table, complete, error) {
        this._sqlite.dropTable(table, complete, error);
    };
    SQLiteCordova.prototype.disconnect = function (complete, error) {
        complete();
    };
    SQLiteCordova.prototype.write = function (table, pk, row, complete, error) {
        this._sqlite.write(this._tableConfigs[table].pkType, this._tableConfigs[table].pkCol, table, pk, row, this._tableConfigs[table].ai, this._ai, complete, error);
    };
    SQLiteCordova.prototype.read = function (table, pk, complete, error) {
        this._sqlite.read(table, pk, complete, error);
    };
    SQLiteCordova.prototype.delete = function (table, pk, complete, error) {
        this._sqlite.remove(table, pk, complete, error);
    };
    SQLiteCordova.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        this._sqlite.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error);
    };
    SQLiteCordova.prototype.getTableIndex = function (table, complete, error) {
        this._sqlite.getIndex(table, complete, error);
    };
    SQLiteCordova.prototype.getTableIndexLength = function (table, complete, error) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    };
    return SQLiteCordova;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.SQLiteCordova = SQLiteCordova;


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var really_small_events_1 = __webpack_require__(10);
var utilities_1 = __webpack_require__(0);
var interfaces_1 = __webpack_require__(1);
exports.InanoSQLInstance = interfaces_1.InanoSQLInstance;
var functions_1 = __webpack_require__(11);
var query_1 = __webpack_require__(12);
var syncStorage_1 = __webpack_require__(13);
var webSQL_1 = __webpack_require__(5);
var indexedDB_1 = __webpack_require__(14);
var query_builder_1 = __webpack_require__(15);
var utils = __webpack_require__(0);
var RocksDB;
if (typeof global !== "undefined") {
    RocksDB = global._rocksAdapter;
}
// tslint:disable-next-line
var nanoSQL = /** @class */ (function () {
    function nanoSQL() {
        this.version = interfaces_1.VERSION;
        this.planetRadius = 6371;
        this._Q = new utilities_1._nanoSQLQueue();
        this.state = {
            activeAV: "",
            hasAnyEvents: false,
            peers: [],
            pid: utilities_1.uuid(),
            id: utilities_1.uuid(),
            cacheId: utilities_1.uuid(),
            peerEvents: [],
            focused: true,
            peerMode: false,
            connected: false,
            ready: false,
            // MRTimer: undefined,
            // runMR: {},
            selectedTable: "",
            exportQueryObj: false
        };
        this.config = {
            id: "temp",
            queue: false
        };
        this._tables = {};
        this._fkRels = {};
        this._tableIds = { "_util": "_util", "_ttl": "_ttl" };
        this._queryCache = {};
        this.filters = {};
        var str = function (value) {
            return typeof value === "object" ? JSON.stringify(value) : String(value);
        };
        this.indexTypes = {
            string: str,
            geo: function (value) {
                return undefined;
            },
            float: function (value) {
                var float = parseFloat(value);
                return isNaN(float) ? 0 : float;
            },
            int: function (value) {
                var int = parseInt(value);
                return isNaN(int) ? 0 : int;
            },
            number: function (value) {
                var float = parseFloat(value);
                return isNaN(float) ? 0 : float;
            },
            uuid: str,
            timeId: str,
            timeIdms: str
        };
        this.eventFNs = {
            Core: {
                "*": new really_small_events_1.ReallySmallEvents()
            },
            "*": { "*": new really_small_events_1.ReallySmallEvents() }
        };
        this._checkTTL = this._checkTTL.bind(this);
        functions_1.attachDefaultFns(this);
    }
    nanoSQL.prototype._rebuildFKs = function () {
        var _this = this;
        // bust memoized caches
        this.state.cacheId = utilities_1.uuid();
        this._fkRels = {};
        Object.keys(this._tables).forEach(function (tableName) {
            var table = _this._tables[tableName];
            Object.keys(table.indexes).forEach(function (indexName) {
                var index = table.indexes[indexName];
                if (index.props && index.props.foreignKey) {
                    var path = utilities_1.resolvePath(index.props.foreignKey.target);
                    var remoteTable = path.shift();
                    if (!_this._fkRels[remoteTable]) {
                        _this._fkRels[remoteTable] = [];
                    }
                    _this._fkRels[remoteTable].push({
                        selfPath: path.map(function (s) { return s.replace(/\[\]/gmi, ""); }),
                        selfIsArray: index.props.foreignKey.target.indexOf("[]") !== -1,
                        childTable: tableName,
                        childPath: index.path,
                        childIsArray: index.isArray,
                        childIndex: indexName,
                        onDelete: index.props.foreignKey.onDelete || interfaces_1.InanoSQLFKActions.NONE
                    });
                }
            });
        });
    };
    nanoSQL.prototype.doFilter = function (filterName, args, complete, cancelled) {
        var _this = this;
        if (this.filters[filterName]) {
            utilities_1.chainAsync(this.filters[filterName], function (item, i, nextFilter) {
                _this.filters[filterName][i](args, function (newArgs) {
                    args = newArgs;
                    nextFilter();
                }, cancelled);
            }).then(function () {
                complete(args);
            });
        }
        else {
            complete(args);
        }
    };
    nanoSQL.prototype.getCache = function (id, args) {
        if (!this._queryCache[id]) {
            throw new Error("Cache \"" + id + "\" not found!");
        }
        if (args) {
            return this._queryCache[id].slice(args.offset, args.offset + args.limit);
        }
        else {
            return this._queryCache[id].slice();
        }
    };
    nanoSQL.prototype.clearCache = function (id) {
        var exists = this._queryCache[id] !== undefined;
        delete this._queryCache[id];
        return exists;
    };
    nanoSQL.prototype.clearTTL = function (primaryKey) {
        var _this = this;
        var k = this.state.selectedTable + "." + primaryKey;
        return new Promise(function (res, rej) {
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "delete"), { where: ["key", "=", k] }), utilities_1.noop, res, rej);
        });
    };
    nanoSQL.prototype.expires = function (primaryKey) {
        var _this = this;
        return new Promise(function (res, rej) {
            var k = _this.state.selectedTable + "." + primaryKey;
            var rows = [];
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "select"), { where: ["key", "=", k] }), function (row) {
                rows.push(row);
            }, function () {
                if (!rows.length) {
                    res({ time: -1, cols: [] });
                }
                else {
                    res({ time: (rows[0].date - Date.now()) / 1000, cols: rows[0].cols });
                }
            }, rej);
        });
    };
    nanoSQL.prototype._checkTTL = function () {
        var _this = this;
        if (this.config.disableTTL)
            return;
        if (this._ttlTimer) {
            clearTimeout(this._ttlTimer);
        }
        var page = 0;
        var nextTTL = 0;
        var getPage = function () {
            var rows = [];
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "select"), { limit: 20, offset: 20 * page }), function (row) {
                rows.push(row);
            }, function () {
                if (!rows.length) {
                    if (nextTTL) {
                        _this._ttlTimer = setTimeout(_this._checkTTL, nextTTL - Date.now());
                    }
                    return;
                }
                utilities_1.chainAsync(rows, function (row, i, next) {
                    if (row.date < Date.now()) {
                        var clearTTL = function () {
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "delete"), { where: ["key", "=", row.key] }), utilities_1.noop, next, utilities_1.throwErr);
                        };
                        var rowData = row.key.split(".");
                        var table = rowData[0];
                        var key = ["float", "int", "number"].indexOf(_this._tables[table].pkType) === -1 ? rowData[1] : parseFloat(rowData[1]);
                        if (row.cols.length) {
                            var upsertObj_1 = {};
                            row.cols.forEach(function (col) {
                                upsertObj_1[col] = null;
                            });
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, table, "upsert"), { actionArgs: upsertObj_1, where: [_this._tables[table].pkCol, "=", key] }), utilities_1.noop, clearTTL, utilities_1.throwErr);
                        }
                        else {
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, table, "delete"), { where: [_this._tables[table].pkCol, "=", key] }), utilities_1.noop, clearTTL, utilities_1.throwErr);
                        }
                    }
                    else {
                        nextTTL = Math.max(nextTTL, row.date);
                        next();
                    }
                }).then(function () {
                    page++;
                    getPage();
                });
            }, utilities_1.throwErr);
        };
        getPage();
    };
    nanoSQL.prototype.selectTable = function (table) {
        if (table)
            this.state.selectedTable = table;
        return this;
    };
    nanoSQL.prototype.getPeers = function () {
        return JSON.parse(localStorage.getItem("nsql-peers-" + this.state.id) || "[]");
    };
    nanoSQL.prototype._detectStorageMethod = function () {
        // NodeJS
        if (typeof window === "undefined") {
            return "RKS";
        }
        // Browser
        // Safari / iOS always gets WebSQL (mobile and desktop)
        // newer versions of safari drop WebSQL, so also do feature detection
        if (utilities_1.isSafari && typeof window.openDatabase !== "undefined") {
            return "WSQL";
        }
        // everyone else (FF + Chrome + Edge + IE)
        // check for support for indexed db
        if (typeof indexedDB !== "undefined") { // fall back to indexed db if we can
            return "IDB";
        }
        // Use WebSQL if it's there.
        if (typeof window !== "undefined" && typeof window.openDatabase !== "undefined") {
            return "WSQL";
        }
        // nothing else works, we gotta do local storage. :(
        return "LS";
    };
    nanoSQL.prototype._initPlugins = function (config) {
        var _this = this;
        return new Promise(function (res, rej) {
            // Build plugin filters
            var filterObj = {};
            (config.plugins || []).forEach(function (plugin) {
                (plugin.filters || []).forEach(function (filter) {
                    if (!filterObj[filter.name]) {
                        filterObj[filter.name] = [];
                    }
                    // prevent priority conflicts
                    var priority = filter.priority;
                    while (filterObj[filter.name][priority]) {
                        priority++;
                    }
                    // set callback
                    filterObj[filter.name][priority] = filter.call;
                });
            });
            Object.keys(filterObj).forEach(function (filterName) {
                _this.filters[filterName] = [];
                filterObj[filterName].forEach(function (callback) {
                    if (callback) {
                        _this.filters[filterName].unshift(callback);
                    }
                });
            });
            var checkVersionRange = function (version, range) {
                if (!range || !range.length)
                    return true;
                if (range.length === 1) {
                    return version >= range[0];
                }
                else {
                    return version >= range[0] && version < range[1];
                }
            };
            var hasError = false;
            // check that dependencies are satisfied
            (config.plugins || []).forEach(function (plugin) {
                if (plugin.dependencies) {
                    var dependencies_1 = plugin.dependencies || {};
                    Object.keys(plugin.dependencies).forEach(function (pluginName, i, next) {
                        if (pluginName === "core") {
                            if (!checkVersionRange(interfaces_1.VERSION, dependencies_1[pluginName])) {
                                hasError = true;
                                rej("Plugin \"" + plugin.name + "\" requires a different core version of nano-sql!");
                            }
                        }
                        else {
                            var dependency = (config.plugins || []).reduce(function (p, c) { return c.name === pluginName ? c : p; });
                            if (!dependency) {
                                hasError = true;
                                rej("Plugin \"" + plugin.name + "\" requires plugin \"" + pluginName + "\" but it isn't installed!");
                            }
                            if (!checkVersionRange(dependency.version, dependencies_1[pluginName])) {
                                hasError = true;
                                rej("Plugin \"" + plugin.name + "\" requires a different version of \"" + pluginName + "\"!");
                            }
                        }
                    });
                }
            });
            if (!hasError) {
                res();
            }
        });
    };
    nanoSQL.prototype._saveTableIds = function () {
        var _this = this;
        return new Promise(function (res, rej) {
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "upsert"), { actionArgs: utilities_1.assign({
                    key: "tableIds",
                    value: _this._tableIds
                }) }), utilities_1.noop, res, rej);
        });
    };
    nanoSQL.prototype.presetQuery = function (fn) {
        var _this = this;
        if (typeof this.state.selectedTable !== "string") {
            throw new Error("Can't get table queries without selecting a table!");
        }
        var found = Object.keys(this._tables[this.state.selectedTable].queries).indexOf(fn) !== -1;
        if (!found) {
            throw new Error("Can't find preset query " + fn + "!");
        }
        var queryRunning = false;
        return {
            promise: function (args) {
                return new Promise(function (res, rej) {
                    if (queryRunning) {
                        rej("Query already streaming!");
                        return;
                    }
                    queryRunning = true;
                    var fnArgs = _this._tables[_this.state.selectedTable].queries[fn].args;
                    var filteredArgs = {};
                    if (fnArgs) {
                        filteredArgs = utilities_1.cleanArgs2(args, fnArgs, _this);
                    }
                    var buffer = [];
                    _this._tables[_this.state.selectedTable].queries[fn].call(_this, filteredArgs, function (row) {
                        buffer.push(row);
                    }, function () {
                        res(buffer);
                    }, rej);
                });
            },
            stream: function (args, onRow, complete, error) {
                if (queryRunning) {
                    error("Query already using promise!");
                    return;
                }
                queryRunning = true;
                var fnArgs = _this._tables[_this.state.selectedTable].queries[fn].args;
                var filteredArgs = {};
                if (fnArgs) {
                    filteredArgs = utilities_1.cleanArgs2(args, fnArgs, _this);
                }
                _this._tables[_this.state.selectedTable].queries[fn].call(_this, filteredArgs, onRow, complete, error);
            }
        };
    };
    nanoSQL.prototype.connect = function (config) {
        var _this = this;
        var t = this;
        return this._initPlugins(config).then(function () {
            return new Promise(function (res, rej) {
                _this.doFilter("config", { res: config }, function (r) {
                    res(r.res);
                }, rej);
            });
        }).then(function (conf) {
            _this.state.id = conf.id || "nSQL_DB";
            _this.config = __assign({ plugins: [] }, conf);
            if (typeof window !== "undefined" && conf && conf.peer) {
                _this.state.peerMode = true;
            }
            return new Promise(function (res, rej) {
                _this.doFilter("willConnect", { res: _this }, function () { res(); }, rej);
            });
        }).then(function () {
            // setup and connect adapter
            return new Promise(function (res, rej) {
                var dbMode = typeof _this.config.mode !== "undefined" ? _this.config.mode : "TEMP";
                if (typeof dbMode === "string") {
                    if (dbMode === "PERM") {
                        dbMode = _this._detectStorageMethod();
                    }
                    switch (dbMode) {
                        case "TEMP":
                            _this.adapter = new syncStorage_1.SyncStorage(false);
                            break;
                        case "LS":
                            _this.adapter = new syncStorage_1.SyncStorage(true);
                            break;
                        case "WSQL":
                            _this.adapter = new webSQL_1.WebSQL(_this.config.size);
                            break;
                        case "IDB":
                            _this.adapter = new indexedDB_1.IndexedDB(_this.config.version);
                            break;
                        case "RKS":
                        case "LVL":
                            _this.adapter = new RocksDB(_this.config.path);
                            break;
                        default:
                            rej("Cannot find mode " + dbMode + "!");
                    }
                }
                else {
                    _this.adapter = dbMode;
                }
                if (_this.adapter.plugin) {
                    (_this.config.plugins || []).push(_this.adapter.plugin);
                }
                _this._initPlugins(_this.config).then(function () {
                    _this.adapter.nSQL = _this;
                    utilities_1.adapterFilters(_this).connect(_this.state.id, function () {
                        _this.doFilter("postConnect", { res: _this.config }, function (config) {
                            _this.config = config.res;
                            res();
                        }, rej);
                    }, rej);
                }).catch(rej);
                if (_this.config.planetRadius) {
                    _this.planetRadius = _this.config.planetRadius;
                }
            });
        }).then(function () {
            _this.triggerEvent({
                target: "Core",
                targetId: _this.state.id,
                path: "*",
                events: ["connect"],
                time: Date.now()
            });
            _this.state.connected = true;
            // this.triggerMapReduce = this.triggerMapReduce.bind(this);
            var tables = ["_util", "_ttl"].concat((_this.config.tables || []).map(function (t) { return t.name; }));
            return utilities_1.chainAsync(tables, function (j, i, next, err) {
                switch (j) {
                    case "_util":
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "create table"), { actionArgs: {
                                name: "_util",
                                model: {
                                    "key:string": { pk: true },
                                    "value:any": {}
                                },
                                _internal: true
                            } }), utilities_1.noop, function () {
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "select"), { where: ["key", "=", "tableIds"] }), function (row) {
                                _this._tableIds = __assign({}, _this._tableIds, row.value);
                            }, function () {
                                next();
                            }, err);
                        }, err);
                        break;
                    case "_ttl":
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "create table"), { actionArgs: {
                                name: "_ttl",
                                model: {
                                    "key:string": { pk: true },
                                    "table:string": {},
                                    "cols:string[]": {},
                                    "date:number": {}
                                },
                                _internal: true
                            } }), utilities_1.noop, next, err);
                        break;
                    default:
                        var model = (_this.config.tables || []).filter(function (t) { return t.name === j; })[0];
                        if (!model) {
                            err("Table not found!");
                            return;
                        }
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, j, "create table"), { actionArgs: model }), utilities_1.noop, next, err);
                }
            });
        }).then(function () {
            // migrate nanosql version as needed
            return new Promise(function (res, rej) {
                var currentVersion;
                _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "select"), { where: ["key", "=", "version"] }), function (row) {
                    if (row)
                        currentVersion = row.value;
                }, function () {
                    if (!currentVersion || currentVersion < 2.0) {
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "upsert"), { actionArgs: { key: "version", value: interfaces_1.VERSION } }), utilities_1.noop, res, rej);
                    }
                    else {
                        // no migration code right now
                        res();
                    }
                }, rej);
            });
        }).then(function () {
            // migrate user database version as needed
            return new Promise(function (res, rej) {
                if (!_this.config.version) {
                    res();
                    return;
                }
                var currentVersion;
                _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "select"), { where: ["key", "=", "db-version"] }), function (row) {
                    if (row)
                        currentVersion = row.value;
                }, function () {
                    var saveVersion = function (version, complete, err) {
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "upsert"), { actionArgs: { key: "db-version", value: version } }), utilities_1.noop, complete, err);
                    };
                    // nothing to migrate, just set version
                    if (!currentVersion) {
                        saveVersion(_this.config.version || 0, res, rej);
                    }
                    else {
                        var upgrade_1 = function () {
                            if (currentVersion === _this.config.version) {
                                saveVersion(_this.config.version || 0, res, rej);
                            }
                            else {
                                if (!_this.config.onVersionUpdate) {
                                    saveVersion(_this.config.version || 0, res, rej);
                                    return;
                                }
                                _this.config.onVersionUpdate(currentVersion).then(function (newVersion) {
                                    currentVersion = newVersion;
                                    saveVersion(currentVersion, function () {
                                        utilities_1.setFast(upgrade_1);
                                    }, rej);
                                }).catch(rej);
                            }
                        };
                        upgrade_1();
                    }
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                var event = {
                    target: "Core",
                    path: "*",
                    targetId: _this.state.id,
                    events: ["ready"],
                    time: Date.now()
                };
                _this.doFilter("ready", { res: event }, function (evnt) {
                    _this.triggerEvent(evnt.res);
                    _this.state.ready = true;
                    if (!_this.config.disableTTL) {
                        _this._checkTTL();
                    }
                    if (_this.config.peer) {
                        _this._initPeers();
                    }
                    res();
                }, rej);
            });
        });
    };
    nanoSQL.prototype._initPeers = function () {
        var _this = this;
        var counter = 0;
        this.state.pid = utilities_1.uuid();
        // Append this peer to the network
        this.state.peers = this.getPeers();
        this.state.peers.unshift(this.state.pid);
        localStorage.setItem("nsql-peers-" + this.state.id, JSON.stringify(this.state.peers));
        // When localstorage changes we may need to possibly update the peer list
        // or possibly respond to an event from another peer
        window.addEventListener("storage", function (e) {
            // peer list updated
            if (e.key === "nsql-peers-" + _this.state.id) {
                _this.state.peers = _this.getPeers();
            }
            // recieved event from another peer
            if (e.key && e.key.indexOf(_this.state.pid + ".") === 0) {
                localStorage.removeItem(e.key);
                var ev_1 = JSON.parse(e.newValue || "{}");
                _this.state.peerEvents.push(ev_1.query.queryID || "");
                _this.triggerEvent(__assign({}, ev_1, { types: ["peer change"] }));
                utilities_1.setFast(function () {
                    _this.triggerEvent(ev_1);
                });
            }
            // the "master" peer checks to make sure all peers have been
            // cleaning up their mess every 50 requests, if they aren't they
            // are removed. Keeps localStorage from filling up accidentally.
            counter++;
            if (counter > 50 && _this.state.peers[0] === _this.state.pid) {
                counter = 0;
                var len = localStorage.length;
                var peerKeys_1 = {};
                while (len--) {
                    var key = localStorage.key(len);
                    // only grab events
                    var keyMatch = key ? key.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{8}/gmi) : null;
                    if (key && keyMatch) {
                        var peerID = (keyMatch || [""])[0];
                        if (!peerKeys_1[peerID]) {
                            peerKeys_1[peerID] = [];
                        }
                        peerKeys_1[peerID].push(key);
                    }
                }
                Object.keys(peerKeys_1).forEach(function (peerID) {
                    // purge peers that aren't cleaning up their mess (and thus probably gone)
                    if (peerKeys_1[peerID].length > 10) {
                        _this.state.peers = _this.state.peers.filter(function (p) { return p !== peerID; });
                        peerKeys_1[peerID].forEach(function (key) {
                            localStorage.removeItem(key);
                        });
                        localStorage.setItem("nsql-peers-" + _this.state.id, JSON.stringify(_this.state.peers));
                    }
                });
            }
        });
        window.onblur = function () {
            _this.state.focused = false;
        };
        // on focus we set this nsql to focused and move it's peer position
        // to the front
        window.onfocus = function () {
            // set this peer to master on focus
            _this.state.peers = _this.state.peers.filter(function (p) { return p !== _this.state.pid; });
            _this.state.peers.unshift(_this.state.pid);
            localStorage.setItem("nsql-peers-" + _this.state.id, JSON.stringify(_this.state.peers));
            _this.state.focused = true;
        };
        // send events to the peer network
        exports.nSQL("*").on("change", function (ev) {
            var idxOf = _this.state.peerEvents.indexOf(ev.query.queryID || "");
            if (idxOf !== -1) {
                _this.state.peerEvents.splice(idxOf, 1);
                return;
            }
            _this.state.peers.filter(function (p) { return p !== _this.state.pid; }).forEach(function (p) {
                localStorage.setItem(p + "." + ev.query.queryID, JSON.stringify(ev));
            });
        });
        // Remove self from peer network
        window.addEventListener("beforeunload", function () {
            _this.state.peers = _this.state.peers.filter(function (p) { return p !== _this.state.pid; });
            localStorage.setItem("nsql-peers-" + _this.state.id, JSON.stringify(_this.state.peers));
            return false;
        });
    };
    nanoSQL.prototype.every = function (args) {
        var i = 0;
        var arr = [];
        while (i <= args.length) {
            if (args.every) {
                if (i % args.every === 0) {
                    arr.push(i + (args.offset || 0));
                }
            }
            else {
                arr.push(i + (args.offset || 0));
            }
            i++;
        }
        return arr;
    };
    nanoSQL.prototype.on = function (action, callBack, selectTable) {
        var _this = this;
        var t = this;
        var l = selectTable || (typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable);
        this.doFilter("onEvent", { res: { action: action, callback: callBack } }, function (newEvent) {
            switch (newEvent.res.action) {
                case "connect":
                case "ready":
                case "disconnect":
                case "peer change":
                case "slow query":
                    _this.eventFNs.Core["*"].on(newEvent.res.action, newEvent.res.callback);
                    break;
                case "select":
                case "change":
                case "delete":
                case "upsert":
                case "*":
                    var table = utilities_1.resolvePath(l);
                    if (!_this.eventFNs[table[0]]) {
                        _this.eventFNs[table[0]] = {
                            "*": new really_small_events_1.ReallySmallEvents()
                        };
                    }
                    var nestedPath = table.filter(function (v, i) { return i > 0; }).join(".") || "*";
                    if (!_this.eventFNs[table[0]][nestedPath]) {
                        _this.eventFNs[table[0]][nestedPath] = new really_small_events_1.ReallySmallEvents();
                    }
                    _this.eventFNs[table[0]][nestedPath].on(newEvent.res.action, newEvent.res.callback);
                    break;
                default:
                    new Promise(function (res, rej) {
                        _this.doFilter("customEvent", { res: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, res, rej);
                    }).then(function (evData) {
                        if (evData.res.nameSpace) {
                            if (!_this.eventFNs[evData.res.nameSpace]) {
                                _this.eventFNs[evData.res.nameSpace] = {
                                    "*": new really_small_events_1.ReallySmallEvents()
                                };
                            }
                            if (!_this.eventFNs[evData.res.nameSpace][evData.res.path]) {
                                _this.eventFNs[evData.res.nameSpace][evData.res.path] = new really_small_events_1.ReallySmallEvents();
                            }
                            _this.eventFNs[evData.res.nameSpace][evData.res.path].on(newEvent.res.action, newEvent.res.callback);
                        }
                        else {
                            throw new Error("Invalid event \"" + action + "\"!");
                        }
                        t._refreshEventChecker();
                    });
            }
            t._refreshEventChecker();
        }, utilities_1.noop);
    };
    nanoSQL.prototype.off = function (action, callBack, selectTable) {
        var _this = this;
        var t = this;
        var l = selectTable || typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable;
        this.doFilter("onEvent", { res: { action: action, callback: callBack } }, function (newEvent) {
            switch (newEvent.res.action) {
                case "connect":
                case "ready":
                case "disconnect":
                case "peer change":
                case "slow query":
                    _this.eventFNs.Core["*"].off(newEvent.res.action, newEvent.res.callback);
                    break;
                case "select":
                case "change":
                case "delete":
                case "upsert":
                case "*":
                    var table = utilities_1.resolvePath(l);
                    if (!_this.eventFNs[table[0]]) {
                        _this.eventFNs[table[0]] = {
                            "*": new really_small_events_1.ReallySmallEvents()
                        };
                    }
                    var nestedPath = table.filter(function (v, i) { return i > 0; }).join(".") || "*";
                    if (!_this.eventFNs[table[0]][nestedPath]) {
                        _this.eventFNs[table[0]][nestedPath] = new really_small_events_1.ReallySmallEvents();
                    }
                    _this.eventFNs[table[0]][nestedPath].off(newEvent.res.action, newEvent.res.callback);
                    break;
                default:
                    new Promise(function (res, rej) {
                        _this.doFilter("customEvent", { res: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, res, rej);
                    }).then(function (evData) {
                        if (evData.res.nameSpace) {
                            if (!_this.eventFNs[evData.res.nameSpace]) {
                                _this.eventFNs[evData.res.nameSpace] = {
                                    "*": new really_small_events_1.ReallySmallEvents()
                                };
                            }
                            if (!_this.eventFNs[evData.res.nameSpace][evData.res.path]) {
                                _this.eventFNs[evData.res.nameSpace][evData.res.path] = new really_small_events_1.ReallySmallEvents();
                            }
                            _this.eventFNs[evData.res.nameSpace][evData.res.path].off(newEvent.res.action, newEvent.res.callback);
                        }
                        else {
                            throw new Error("Invalid event \"" + action + "\"!");
                        }
                        t._refreshEventChecker();
                    });
            }
            t._refreshEventChecker();
        }, utilities_1.noop);
    };
    nanoSQL.prototype._refreshEventChecker = function () {
        var _this = this;
        this.state.hasAnyEvents = Object.keys(this.eventFNs).reduce(function (prev, cur) {
            if (prev === true)
                return true;
            var length = Object.keys(_this.eventFNs[cur]).reduce(function (p, key) {
                return Object.keys(_this.eventFNs[cur][key].eventListeners).length + p;
            }, 0);
            return length > 0 ? true : prev;
        }, false);
        return this;
    };
    nanoSQL.prototype.getView = function (viewName, viewArgs) {
        return this._doAV("v", this.state.selectedTable, viewName, viewArgs);
    };
    nanoSQL.prototype.doAction = function (actionName, actionArgs) {
        return this._doAV("a", this.state.selectedTable, actionName, actionArgs);
    };
    nanoSQL.prototype._doAV = function (AVType, table, AVName, AVArgs) {
        var _this = this;
        if (typeof this.state.selectedTable !== "string")
            return Promise.reject("Can't do Action/View with selected table!");
        return new Promise(function (res, rej) {
            _this.doFilter("actionView", {
                res: {
                    AVType: AVType,
                    table: table,
                    AVName: AVName,
                    AVArgs: AVArgs
                }
            }, res, rej);
        }).then(function (actionOrView) {
            var key = actionOrView.res.AVType === "a" ? "actions" : "views";
            var selAV = _this._tables[actionOrView.res.table][key].reduce(function (prev, cur) {
                if (cur.name === actionOrView.res.AVName)
                    return cur;
                return prev;
            }, null);
            if (!selAV) {
                return new Promise(function (res, rej) { return rej(actionOrView.res.AVType + " \"" + actionOrView.res.AVName + "\" Not Found!"); });
            }
            return selAV.call(selAV.args ? utilities_1.cleanArgs(selAV.args, actionOrView.res.AVArgs, _this) : {}, _this);
        });
    };
    nanoSQL.prototype.query = function (action, args) {
        var av = this.state.activeAV;
        this.state.activeAV = "";
        return new query_builder_1._nanoSQLQueryBuilder(this, this.state.selectedTable, action, args, av);
    };
    nanoSQL.prototype.triggerQuery = function (query, onRow, complete, error) {
        var _this = this;
        if (!this.state.connected && typeof query.table === "string") {
            error("nSQL: Can't do a query before the database is connected!");
            return;
        }
        this.doFilter("query", { res: query }, function (setQuery) {
            if (_this.config.queue && !setQuery.res.skipQueue) {
                _this._Q.newItem({
                    query: setQuery.res,
                    onRow: onRow,
                    complete: complete,
                    error: error
                }, function (item, done, err) {
                    new query_1._nanoSQLQuery(_this, item.query, item.onRow, function () {
                        done();
                        item.complete();
                    }, function (err) {
                        done();
                        item.error(err);
                    });
                });
            }
            else {
                new query_1._nanoSQLQuery(_this, setQuery.res, function (row) {
                    onRow(row);
                }, complete, error);
            }
        }, error);
    };
    nanoSQL.prototype.triggerEvent = function (eventData, ignoreStarTable) {
        var _this = this;
        this.doFilter("event", { res: eventData }, function (event) {
            if (_this.state.hasAnyEvents) {
                utilities_1.setFast(function () {
                    event.res.events.forEach(function (evnt) {
                        if (!ignoreStarTable) {
                            Object.keys(_this.eventFNs["*"]).forEach(function (path) {
                                _this.eventFNs["*"][path].trigger(evnt, event.res);
                            });
                        }
                        if (!_this.eventFNs[event.res.target])
                            return;
                        if (event.res.path === "_all_") {
                            Object.keys(_this.eventFNs[event.res.target]).forEach(function (path) {
                                _this.eventFNs[event.res.target][path].trigger(evnt, event.res);
                            });
                        }
                        else {
                            if (!_this.eventFNs[event.res.target][event.res.path])
                                return;
                            _this.eventFNs[event.res.target][event.res.path].trigger(evnt, event.res);
                        }
                    });
                });
            }
        }, function (err) {
            console.log("Event suppressed", err);
        });
        return this;
    };
    nanoSQL.prototype.default = function (replaceObj, table) {
        var _this = this;
        replaceObj = replaceObj || {};
        if (!table && typeof this.state.selectedTable !== "string") {
            throw new Error("Must select table to generate defualts!");
        }
        table = (table || this.state.selectedTable);
        if (!this._tables[table]) {
            throw new Error("nSQL: Table \"" + table + "\" not found for generating default object!");
        }
        var error = "";
        var resolveModel = function (cols, useObj, nestedModel) {
            var newObj = {};
            useObj = useObj || {};
            if (nestedModel && nestedModel.length) {
                if (nestedModel.indexOf("[]") !== -1) {
                    if (Array.isArray(useObj)) {
                        return useObj.map(function (a) { return resolveModel(cols, a, nestedModel.slice(0, nestedModel.lastIndexOf("[]"))); });
                    }
                    else {
                        return [];
                    }
                }
            }
            var hasWildCard = false;
            cols.forEach(function (m) {
                if (m.key === "*") {
                    hasWildCard = true;
                    return;
                }
                if (m.model) {
                    if (m.type.indexOf("[]") !== -1) {
                        var arr = typeof useObj !== "undefined" ? useObj[m.key] : [];
                        if (!Array.isArray(arr)) {
                            newObj[m.key] = [];
                        }
                        else {
                            newObj[m.key] = arr.map(function (a) { return resolveModel(m.model, a, m.type.slice(0, m.type.lastIndexOf("[]"))); });
                        }
                    }
                    else {
                        newObj[m.key] = resolveModel(m.model, typeof useObj !== "undefined" ? useObj[m.key] : undefined);
                    }
                }
                else {
                    var value = typeof useObj[m.key] !== "undefined" ? utilities_1.cast(m.type, useObj[m.key], false, _this) : m.default;
                    if (typeof m.max !== "undefined" && value > m.max) {
                        error = "Data error, column " + m.key + " can't be greater than " + m.max + "!";
                    }
                    if (typeof m.min !== "undefined" && value < m.min) {
                        error = "Data error, column " + m.key + " can't be less than " + m.min + "!";
                    }
                    newObj[m.key] = value;
                }
                if (m.notNull && (newObj[m.key] === null || newObj[m.key] === undefined)) {
                    error = "Data error, " + m.key + " cannot be null!";
                }
            });
            if (error.length)
                return new Error(error);
            if (hasWildCard && useObj) {
                var keys_1 = cols.map(function (c) { return c.key; });
                Object.keys(useObj).filter(function (c) { return keys_1.indexOf(c) === -1; }).forEach(function (key) {
                    newObj[key] = useObj[key];
                });
            }
            return newObj;
        };
        return resolveModel(this._tables[table].columns, replaceObj);
    };
    nanoSQL.prototype.rawDump = function (tables, indexes, onRow) {
        var _this = this;
        var exportTables = indexes ? tables : Object.keys(this._tables).filter(function (t) { return tables.length ? tables.indexOf(t) !== -1 : true; });
        return utilities_1.chainAsync(exportTables, function (table, i, nextTable, err) {
            if (indexes) {
                var tableName_1 = table.indexOf(":") !== -1 ? table.split(":")[0] : table;
                var tableIndexes = table.indexOf(":") !== -1 ? [table.split(":")[1]] : Object.keys(_this._tables[table].indexes);
                utilities_1.chainAsync(tableIndexes, function (index, i, nextIdx, errIdx) {
                    utilities_1.adapterFilters(_this).readIndexKeys(tableName_1, index, "all", undefined, undefined, false, function (key, id) {
                        onRow(tableName_1 + "." + index, { indexId: id, rowId: key });
                    }, nextIdx, errIdx);
                }).then(nextTable).catch(err);
            }
            else {
                utilities_1.adapterFilters(_this).readMulti(table, "all", undefined, undefined, false, function (row) {
                    onRow(table, row);
                }, nextTable, err || utilities_1.noop);
            }
        });
    };
    nanoSQL.prototype.rawImport = function (tables, indexes, onProgress) {
        var _this = this;
        var progress = 0;
        var totalLength = Object.keys(tables).reduce(function (p, c) {
            return p += tables[c].length, p;
        }, 0);
        var usableTables = Object.keys(this._tables);
        var importTables = indexes ? Object.keys(tables) : Object.keys(tables).filter(function (t) { return usableTables.indexOf(t) !== -1; });
        return utilities_1.chainAsync(importTables, function (table, i, next, err) {
            if (indexes) {
                // tableName:IndexName
                var tableName_2 = table.split(".")[0];
                var indexName_1 = table.split(".")[1];
                utilities_1.chainAsync(tables[table], function (indexRow, ii, nextIdx, errIdx) {
                    utilities_1.adapterFilters(_this).addIndexValue(tableName_2, indexName_1, indexRow.rowId, indexRow.indexId, nextIdx, errIdx);
                }).then(next).catch(err);
            }
            else {
                var pk_1 = _this._tables[table].pkCol;
                utilities_1.chainAsync(tables[table], function (row, ii, nextRow, rowErr) {
                    if (!utilities_1.deepGet(pk_1, row) && rowErr) {
                        rowErr("No primary key found, can't import: " + JSON.stringify(row));
                        return;
                    }
                    utilities_1.adapterFilters(_this).write(table, utilities_1.deepGet(pk_1, row), row, function (newRow) {
                        nextRow();
                        progress++;
                        if (onProgress)
                            onProgress(Math.round((progress / totalLength) * 10000) / 100);
                    }, rowErr || utilities_1.noop);
                }).then(next).catch(err);
            }
        });
    };
    nanoSQL.prototype.disconnect = function () {
        var _this = this;
        return new Promise(function (res, rej) {
            _this.doFilter("disconnect", {}, function () {
                utilities_1.adapterFilters(_this).disconnect(res, rej);
            }, rej);
        });
    };
    nanoSQL.prototype.extend = function (scope) {
        var _this = this;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return new Promise(function (res, rej) {
            _this.doFilter("extend", { scope: scope, args: args, res: null }, res, rej);
        });
    };
    nanoSQL.prototype.loadJS = function (rows, onProgress, parallel) {
        var _this = this;
        var table = this.state.selectedTable;
        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load JS into temporary table!");
        }
        var total = rows.length;
        var count = 0;
        var async = parallel ? utilities_1.allAsync : utilities_1.chainAsync;
        return async(rows, function (row, i, next, err) {
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, table, "upsert"), { actionArgs: row }), function (r) {
            }, function () {
                count++;
                if (onProgress)
                    onProgress(((count / total) * 10000) / 100);
                next();
            }, err);
        });
    };
    nanoSQL.prototype.JSONtoCSV = function (json, printHeaders, useHeaders) {
        var csv = [];
        if (!json.length) {
            return "";
        }
        var columnHeaders = [];
        if (useHeaders) {
            // use provided headers (much faster)
            columnHeaders = useHeaders;
        }
        else {
            // auto detect headers
            json.forEach(function (json) {
                columnHeaders = Object.keys(json).concat(columnHeaders);
            });
            columnHeaders = columnHeaders.filter(function (v, i, s) { return s.indexOf(v) === i; });
        }
        if (printHeaders) {
            csv.push(columnHeaders.map(function (c) { return "\"" + c + "\""; }).join(","));
        }
        json.forEach(function (row) {
            csv.push(columnHeaders.map(function (k) {
                if (row[k] === null || row[k] === undefined) {
                    return "";
                }
                if (typeof row[k] === "string") {
                    // tslint:disable-next-line
                    return "\"" + (row[k]).replace(/\"/g, '\"\"') + "\"";
                }
                if (typeof row[k] === "boolean") {
                    return row[k] === true ? "true" : "false";
                }
                // tslint:disable-next-line
                return typeof row[k] === "object" ? "\"" + JSON.stringify(row[k]).replace(/\"/g, '\"\"') + "\"" : row[k];
            }).join(","));
        });
        return csv.join("\n");
    };
    nanoSQL.prototype.csvToArray = function (text) {
        // tslint:disable-next-line
        var p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
        for (var _i = 0, text_1 = text; _i < text_1.length; _i++) {
            l = text_1[_i];
            // tslint:disable-next-line
            if ('"' === l) {
                if (s && l === p)
                    row[i] += l;
                s = !s;
                // tslint:disable-next-line
            }
            else if (',' === l && s)
                l = row[++i] = '';
            // tslint:disable-next-line
            else if ('\n' === l && s) {
                // tslint:disable-next-line
                if ('\r' === p)
                    row[i] = row[i].slice(0, -1);
                // tslint:disable-next-line
                row = ret[++r] = [l = ''];
                i = 0;
            }
            else
                row[i] += l;
            p = l;
        }
        return ret[0];
    };
    nanoSQL.prototype.CSVtoJSON = function (csv, rowMap) {
        var _this = this;
        var t = this;
        var fields = [];
        return csv.split(/\r?\n|\r|\t/gm).map(function (v, k) {
            if (k === 0) {
                fields = v.split(",").map(function (s) { return s.substring(1, s.length - 1); });
                return undefined;
            }
            else {
                var row = _this.csvToArray(v);
                if (!row)
                    return undefined;
                row = row.map(function (r) { return r.trim(); });
                var i = fields.length;
                var record = {};
                while (i--) {
                    if (row[i]) {
                        if (row[i] === "true" || row[i] === "false") {
                            record[fields[i]] = row[i] === "true";
                        }
                        else if (row[i].indexOf("{") === 0 || row[i].indexOf("[") === 0) {
                            // tslint:disable-next-line
                            try {
                                record[fields[i]] = JSON.parse(row[i]);
                            }
                            catch (e) {
                                record[fields[i]] = row[i];
                            }
                            // tslint:disable-next-line
                        }
                        else if (row[i].indexOf('"') === 0) {
                            record[fields[i]] = row[i].slice(1, row[i].length - 1).replace(/\"\"/gmi, "\"");
                        }
                        else {
                            record[fields[i]] = row[i];
                        }
                    }
                }
                if (rowMap) {
                    return rowMap(record);
                }
                return record;
            }
        }).filter(function (r) { return r; });
    };
    nanoSQL.prototype.loadCSV = function (csv, rowMap, onProgress, parallel) {
        var _this = this;
        var table = this.state.selectedTable;
        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load CSV into temporary table!");
        }
        var rowData = this.CSVtoJSON(csv, rowMap);
        var async = parallel ? utilities_1.allAsync : utilities_1.chainAsync;
        var count = 0;
        return async(rowData, function (row, i, nextRow, err) {
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, table, "upsert"), { actionArgs: row }), utilities_1.noop, function () {
                count++;
                if (onProgress)
                    onProgress(Math.round((count / rowData.length) * 10000) / 100);
                nextRow();
            }, err || utilities_1.noop);
        });
    };
    return nanoSQL;
}());
exports.nanoSQL = nanoSQL;
exports.nSQLv1Config = function (doConfig) {
    var tables = {};
    var conf = {};
    var selTable = "";
    var nSQLv1 = function (table) {
        selTable = table || selTable;
        if (selTable && !tables[selTable]) {
            tables[selTable] = {
                name: selTable,
                model: {},
                indexes: {},
                actions: [],
                views: []
            };
        }
        return {
            model: function (dataModels) {
                var indexes = {};
                tables[selTable].model = dataModels.reduce(function (prev, cur) {
                    var key = cur.key + ":" + cur.type;
                    prev[key] = {};
                    if (cur.props) {
                        if (cur.props.indexOf("pk") !== -1) {
                            prev[key].pk = true;
                        }
                        if (cur.props.indexOf("ai") !== -1) {
                            prev[key].ai = true;
                        }
                        if (indexes && cur.props.indexOf("idx") !== -1) {
                            indexes[key] = {};
                        }
                    }
                    return prev;
                }, {});
                tables[selTable].indexes = indexes;
                return nSQLv1(table);
            },
            actions: function (actions) {
                tables[selTable].actions = actions;
                return nSQLv1(table);
            },
            views: function (views) {
                tables[selTable].views = views;
                return nSQLv1(table);
            },
            config: function (obj) {
                conf = obj;
                return nSQLv1(table);
            },
            table: function (ta) {
                return nSQLv1(ta);
            },
            rowFilter: function (callback) {
                tables[selTable].filter = callback;
                return nSQLv1(table);
            }
        };
    };
    doConfig(nSQLv1);
    return __assign({}, conf, { tables: Object.keys(tables).map(function (t) { return tables[t]; }) });
};
/**
 * @internal
 */
var _nanoSQLStatic = new nanoSQL();
exports.nSQL = function (table) {
    return _nanoSQLStatic.selectTable(table);
};
if (typeof window !== "undefined") {
    if (!window["@nano-sql"]) {
        window["@nano-sql"] = {};
    }
    window["@nano-sql"].core = {
        nSQL: exports.nSQL,
        nanoSQL: nanoSQL,
        utilities: utils,
        nSQLv1Config: exports.nSQLv1Config
    };
}
/*
// used to test browser adapters with live reload
let errors = 0;
console.log("Testing IndexedDB");
new nanoSQLAdapterTest(IndexedDB, []).test().then(() => {
    console.log("Testing WebSQL");
    new nanoSQLAdapterTest(WebSQL, []).test().then(() => {
        console.log("Tests Complete");
    }).catch((err) => {
        console.error(err);
        errors++;
    });
}).catch((err) => {
    console.error(err);
    errors++;
});*/
//# sourceMappingURL=index.js.map

/***/ }),
/* 10 */
/***/ (function(module, exports) {

Object.defineProperty(exports, "__esModule", { value: true });
var ReallySmallEvents = (function () {
    function ReallySmallEvents() {
        this.eventListeners = {};
    }
    ReallySmallEvents.prototype.on = function (event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    };
    ReallySmallEvents.prototype.off = function (event, callback) {
        var _this = this;
        if (this.eventListeners[event] && this.eventListeners[event].length) {
            this.eventListeners[event].forEach(function (cb, idx) {
                if (cb === callback) {
                    _this.eventListeners[event].splice(idx, 1);
                }
            });
        }
    };
    ReallySmallEvents.prototype.trigger = function (event) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(function (cb) { return cb.apply(void 0, args); });
        }
    };
    return ReallySmallEvents;
}());
exports.ReallySmallEvents = ReallySmallEvents;
exports.RSE = new ReallySmallEvents();


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = __webpack_require__(0);
var levenshtein = __webpack_require__(3);
var wordLevenshtienCache = {};
var numVals = function (row) {
    var subjects = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        subjects[_i - 1] = arguments[_i];
    }
    return subjects.map(function (s) { return parseFloat(isNaN(s) ? utilities_1.getFnValue(row, s) : s); });
};
exports.attachDefaultFns = function (nSQL) {
    nSQL.functions = {
        COUNT: {
            type: "A",
            aggregateStart: { result: 0, row: {} },
            call: function (query, row, prev, column) {
                if (column && column !== "*") {
                    if (utilities_1.getFnValue(row, column)) {
                        prev.result++;
                    }
                }
                else {
                    prev.result++;
                }
                prev.row = row;
                return prev;
            }
        },
        MAX: {
            type: "A",
            aggregateStart: { result: undefined, row: {} },
            call: function (query, row, prev, column) {
                var max = utilities_1.getFnValue(row, column) || 0;
                if (typeof prev.result === "undefined") {
                    prev.result = max;
                    prev.row = row;
                }
                else {
                    if (max > prev.result) {
                        prev.result = max;
                        prev.row = row;
                    }
                }
                return prev;
            }
        },
        MIN: {
            type: "A",
            aggregateStart: { result: undefined, row: {} },
            call: function (query, row, prev, column) {
                var min = utilities_1.getFnValue(row, column) || 0;
                if (typeof prev.result === "undefined") {
                    prev.result = min;
                    prev.row = row;
                }
                else {
                    if (min < prev.result) {
                        prev.result = min;
                        prev.row = row;
                    }
                }
                return prev;
            }
        },
        GREATEST: {
            type: "S",
            call: function (query, row, prev) {
                var values = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    values[_i - 3] = arguments[_i];
                }
                var args = values.map(function (s) { return isNaN(s) ? utilities_1.getFnValue(row, s) : parseFloat(s); }).sort(function (a, b) { return a < b ? 1 : -1; });
                return { result: args[0] };
            }
        },
        LEAST: {
            type: "S",
            call: function (query, row, prev) {
                var values = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    values[_i - 3] = arguments[_i];
                }
                var args = values.map(function (s) { return isNaN(s) ? utilities_1.getFnValue(row, s) : parseFloat(s); }).sort(function (a, b) { return a > b ? 1 : -1; });
                return { result: args[0] };
            }
        },
        AVG: {
            type: "A",
            aggregateStart: { result: 0, row: {}, total: 0, records: 0 },
            call: function (query, row, prev, column) {
                var value = parseFloat(utilities_1.getFnValue(row, column) || 0) || 0;
                prev.total += isNaN(value) ? 0 : value;
                prev.records++;
                prev.result = prev.total / prev.records;
                prev.row = row;
                return prev;
            }
        },
        SUM: {
            type: "A",
            aggregateStart: { result: 0, row: {} },
            call: function (query, row, prev, column) {
                var value = parseFloat(utilities_1.getFnValue(row, column) || 0) || 0;
                prev.result += isNaN(value) ? 0 : value;
                prev.row = row;
                return prev;
            }
        },
        ADD: {
            type: "S",
            call: function (query, row, prev) {
                var subjects = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    subjects[_i - 3] = arguments[_i];
                }
                return { result: numVals(row, subjects).reduce(function (prev, cur, i) {
                        if (i === 0)
                            return cur;
                        return prev + cur;
                    }) };
            }
        },
        SUB: {
            type: "S",
            call: function (query, row, prev) {
                var subjects = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    subjects[_i - 3] = arguments[_i];
                }
                return { result: numVals(row, subjects).reduce(function (prev, cur, i) {
                        if (i === 0)
                            return cur;
                        return prev - cur;
                    }) };
            }
        },
        DIV: {
            type: "S",
            call: function (query, row, prev, subject1) {
                var subjects = [];
                for (var _i = 4; _i < arguments.length; _i++) {
                    subjects[_i - 4] = arguments[_i];
                }
                return { result: numVals(row, subjects).reduce(function (prev, cur, i) {
                        if (i === 0)
                            return cur;
                        return prev / cur;
                    }) };
            }
        },
        MULT: {
            type: "S",
            call: function (query, row, prev) {
                var subjects = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    subjects[_i - 3] = arguments[_i];
                }
                return { result: numVals(row, subjects).reduce(function (prev, cur, i) {
                        if (i === 0)
                            return cur;
                        return prev * cur;
                    }) };
            }
        },
        MOD: {
            type: "S",
            call: function (query, row, prev, subject1, subject2) {
                var _a = numVals(row, subject1, subject2), subjVal1 = _a[0], subjVal2 = _a[1];
                return { result: subjVal1 % subjVal2 };
            }
        },
        PI: {
            type: "S",
            call: function (query, row, prev) {
                return { result: Math.PI };
            }
        },
        TRUNCATE: {
            type: "S",
            call: function (query, row, prev, subject1, subject2) {
                var _a = numVals(row, subject1, subject2), subjVal1 = _a[0], subjVal2 = _a[1];
                return { result: parseFloat(subjVal1.toFixed(subjVal2)) };
            }
        },
        LOWER: {
            type: "S",
            call: function (query, row, prev, column) {
                return { result: String(utilities_1.getFnValue(row, column)).toLowerCase() };
            }
        },
        TRIM: {
            type: "S",
            call: function (query, row, prev, column) {
                return { result: String(utilities_1.getFnValue(row, column)).trim() };
            }
        },
        UPPER: {
            type: "S",
            call: function (query, row, prev, column) {
                return { result: String(utilities_1.getFnValue(row, column)).toUpperCase() };
            }
        },
        CAST: {
            type: "S",
            call: function (query, row, prev, column, type) {
                return { result: utilities_1.cast(utilities_1.getFnValue(row, type), utilities_1.getFnValue(row, column), false, query.parent) };
            }
        },
        CONCAT: {
            type: "S",
            call: function (query, row, prev) {
                var values = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    values[_i - 3] = arguments[_i];
                }
                return { result: values.map(function (v) {
                        return utilities_1.getFnValue(row, v);
                    }).join("") };
            }
        },
        CONCAT_WS: {
            type: "S",
            call: function (query, row, prev, sep) {
                var values = [];
                for (var _i = 4; _i < arguments.length; _i++) {
                    values[_i - 4] = arguments[_i];
                }
                return { result: values.map(function (v) {
                        return utilities_1.getFnValue(row, v);
                    }).join(utilities_1.getFnValue(row, sep)) };
            }
        },
        REPLACE: {
            type: "S",
            call: function (query, row, prev, subject, find, replace) {
                var subjVal = String(utilities_1.getFnValue(row, subject));
                var findVal = String(utilities_1.getFnValue(row, find));
                var repVal = String(utilities_1.getFnValue(row, replace));
                return { result: subjVal.replace(findVal, repVal) };
            }
        },
        STRCMP: {
            type: "S",
            call: function (query, row, prev, subject1, subject2) {
                var subjVal1 = String(utilities_1.getFnValue(row, subject1));
                var subjVal2 = String(utilities_1.getFnValue(row, subject2));
                if (subjVal1 < subjVal2)
                    return { result: -1 };
                if (subjVal1 > subjVal2)
                    return { result: 1 };
                return { result: 0 };
            }
        },
        LEVENSHTEIN: {
            type: "S",
            call: function (query, row, prev, word1, word2) {
                var w1 = utilities_1.getFnValue(row, word1);
                var w2 = utilities_1.getFnValue(row, word2);
                var key = w1 + "::" + w2;
                if (!wordLevenshtienCache[key]) {
                    wordLevenshtienCache[key] = levenshtein(w1, w2);
                }
                return { result: wordLevenshtienCache[key] };
            }
        },
        IF: {
            type: "S",
            call: function (query, row, prev, expression, isTrue, isFalse) {
                var exp = expression.split(/<|=|>|<=|>=/gmi).map(function (s) {
                    if (isNaN(s)) {
                        return utilities_1.getFnValue(row, s);
                    }
                    else {
                        return parseFloat(s);
                    }
                });
                var comp = expression.match(/<|=|>|<=|>=/gmi)[0];
                if (!comp)
                    return { result: utilities_1.getFnValue(row, isFalse) };
                switch (comp) {
                    case "=": return exp[0] == exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    case ">": return exp[0] > exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    case "<": return exp[0] < exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    case "<=": return exp[0] <= exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    case ">=": return exp[0] < exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    default: return { result: utilities_1.getFnValue(row, isFalse) };
                }
            }
        },
        CROW: {
            type: "S",
            call: function (query, row, prev, gpsCol, lat, lon) {
                var latVal = utilities_1.getFnValue(row, gpsCol + ".lat");
                var lonVal = utilities_1.getFnValue(row, gpsCol + ".lon");
                return {
                    result: utilities_1.crowDistance(latVal, lonVal, parseFloat(lat), parseFloat(lon), nSQL.planetRadius)
                };
            },
            checkIndex: function (query, fnArgs, where) {
                if (where[1] === "<" || where[1] === "<=") {
                    var indexes_1 = typeof query.table === "string" ? nSQL._tables[query.table].indexes : {};
                    var crowColumn_1 = utilities_1.resolvePath(fnArgs[0]);
                    var crowCols_1 = [];
                    // find the lat/lon indexes for the crow calculation
                    Object.keys(indexes_1).forEach(function (k) {
                        var index = indexes_1[k];
                        if (index.type === "float" && utilities_1.objectsEqual(index.path.slice(0, index.path.length - 1), crowColumn_1)) {
                            crowCols_1.push(k.replace(".lat", "").replace(".lon", ""));
                        }
                    });
                    if (crowCols_1.length === 2) {
                        return {
                            index: crowCols_1[0],
                            parsedFn: { name: "CROW", args: fnArgs },
                            comp: where[1],
                            value: where[2]
                        };
                    }
                }
                return false;
            },
            queryIndex: function (query, where, onlyPKs, onRow, complete, error) {
                var table = query.table;
                var latIndex = where.index + ".lat";
                var lonIndex = where.index + ".lon";
                var condition = where.comp;
                var distance = parseFloat(where.value || "0");
                var centerLat = parseFloat(where.parsedFn ? where.parsedFn.args[1] : "0");
                var centerLon = parseFloat(where.parsedFn ? where.parsedFn.args[2] : "0");
                // get distance radius in degrees
                var distanceDegrees = (distance / (nSQL.planetRadius * 2 * Math.PI)) * 360;
                // get degrees north and south of search point
                var latRange = [-1, 1].map(function (s) { return centerLat + (distanceDegrees * s); });
                var lonRange = [];
                var extraLonRange = [];
                // check if latitude range is above/below the distance query
                // that means we're querying near a pole
                // if so, grab all longitudes
                var poleQuery = false;
                var poleRange = Math.max(90 - distanceDegrees, 0);
                if (Math.abs(latRange[0]) > poleRange || Math.abs(latRange[1]) > poleRange) {
                    poleQuery = true;
                    if (latRange[0] < poleRange * -1) {
                        latRange = [-90, latRange[1]];
                    }
                    if (latRange[1] > poleRange) {
                        latRange = [latRange[0], 90];
                    }
                }
                else {
                    var largestLat_1 = Math.max(Math.abs(latRange[0]), Math.abs(latRange[1]));
                    // get degrees east and west of search point
                    lonRange = [-1, 1].map(function (s) {
                        var equatorDegrees = distanceDegrees * s;
                        return centerLon + (equatorDegrees / Math.cos(utilities_1.deg2rad(largestLat_1)));
                    });
                    // if range query happens to cross antimeridian
                    // no need to check this for pole queries
                    if (Math.abs(lonRange[0]) > 180) {
                        // lonRange [-185, -170]
                        // extraLonRange [175, 180]
                        var diff = Math.abs(lonRange[0]) - 180;
                        extraLonRange = [180 - diff, 180];
                    }
                    if (Math.abs(lonRange[1]) > 180) {
                        // lonRange [175, 185]
                        // extraLonRange [-180, -175]
                        var diff = Math.abs(lonRange[1]) - 180;
                        extraLonRange = [-180, -180 + diff];
                    }
                }
                var pks = {};
                utilities_1.allAsync([latIndex, lonIndex, lonIndex], function (index, i, next, error) {
                    var ranges = [latRange, lonRange, extraLonRange][i];
                    if (!ranges.length) {
                        next(null);
                        return;
                    }
                    // read values from seconday index
                    utilities_1.adapterFilters(nSQL, query).readIndexKeys(table, index, "range", ranges[0], ranges[1], false, function (pk, id) {
                        if (!pks[pk]) {
                            pks[pk] = {
                                key: pk,
                                lat: 0,
                                lon: 0,
                                num: 0
                            };
                        }
                        else {
                            pks[pk].num++;
                        }
                        if (i === 0) {
                            pks[pk].lat = id - 90;
                        }
                        else {
                            pks[pk].lon = id - 180;
                        }
                    }, function () {
                        next(null);
                    }, error);
                }).then(function () {
                    // step 2: get the square shaped selection of items
                    var counter = 0;
                    var rowsToRead = (poleQuery ? Object.keys(pks) : Object.keys(pks).filter(function (p) {
                        if (pks[p].num < 1) { // doesn't have both lat and lon values, ignore
                            return false;
                        }
                        // confirm within distance for remaining rows
                        var crowDist = utilities_1.crowDistance(pks[p].lat, pks[p].lon, centerLat, centerLon, nSQL.planetRadius);
                        return condition === "<" ? crowDist < distance : crowDist <= distance;
                    })).map(function (p) { return pks[p]; });
                    if (!poleQuery && onlyPKs) {
                        rowsToRead.forEach(function (rowData, k) {
                            onRow(rowData.key, k);
                        });
                        return;
                    }
                    utilities_1.allAsync(rowsToRead, function (rowData, i, next, err) {
                        utilities_1.adapterFilters(query.parent, query).read(query.table, rowData.key, function (row) {
                            if (!row) {
                                next(null);
                                return;
                            }
                            if (!poleQuery) {
                                onRow(row, i);
                                next(null);
                                return;
                            }
                            // perform crow distance calculation on pole locations
                            var rowLat = utilities_1.deepGet((where.parsedFn ? where.parsedFn.args[0] : "") + ".lat", row);
                            var rowLon = utilities_1.deepGet((where.parsedFn ? where.parsedFn.args[0] : "") + ".lon", row);
                            var crowDist = utilities_1.crowDistance(rowLat, rowLon, centerLat, centerLon, nSQL.planetRadius);
                            var doRow = condition === "<" ? crowDist < distance : crowDist <= distance;
                            if (doRow) {
                                onRow(onlyPKs ? utilities_1.deepGet(nSQL._tables[query.table].pkCol, row) : row, counter);
                                counter++;
                            }
                            next(null);
                        }, err);
                    }).catch(error).then(function () {
                        complete();
                    });
                }).catch(error);
            }
        }
    };
    var MathFns = Object.getOwnPropertyNames ? Object.getOwnPropertyNames(Math) : ["abs", "acos", "asin", "atan", "atan2", "ceil", "cos", "exp", "floor", "log", "max", "min", "pow", "random", "round", "sin", "sqrt", "tan"];
    MathFns.forEach(function (key) {
        nSQL.functions[key.toUpperCase()] = {
            type: "S",
            call: function (query, row, prev) {
                var args = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    args[_i - 3] = arguments[_i];
                }
                return { result: Math[key].apply(null, numVals(row, args)) };
            }
        };
    });
};
//# sourceMappingURL=functions.js.map

/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = __webpack_require__(1);
var utilities_1 = __webpack_require__(0);
exports.secondaryIndexQueue = {};
var globalTableCache = {};
// tslint:disable-next-line
var _nanoSQLQuery = /** @class */ (function () {
    function _nanoSQLQuery(nSQL, query, progress, complete, error) {
        var _this = this;
        this.nSQL = nSQL;
        this.query = query;
        this.progress = progress;
        this.complete = complete;
        this.error = error;
        this._queryBuffer = [];
        this._stream = true;
        this._selectArgs = [];
        this._pkOrderBy = false;
        this._idxOrderBy = false;
        this._sortGroups = [];
        this._sortGroupKeys = {};
        this.query.state = "processing";
        this._indexesUsed = [];
        this._startTime = Date.now();
        var action = query.action.toLowerCase().trim();
        this._orderByRows = this._orderByRows.bind(this);
        this._onError = this._onError.bind(this);
        if (action !== "select" && typeof query.table !== "string") {
            this.query.state = "error";
            this.error("Only \"select\" queries are available for this resource!");
            return;
        }
        if (typeof query.table === "string" && !this.nSQL.state.connected) {
            this.query.state = "error";
            this.error("Can't execute query before the database has connected!");
            return;
        }
        var requireQueryOpts = function (requreiAction, cb) {
            if (typeof _this.query.table !== "string") {
                _this.query.state = "error";
                _this.error(_this.query.action + " query requires a string table argument!");
                return;
            }
            if (requreiAction && !_this.query.actionArgs) {
                _this.query.state = "error";
                _this.error(_this.query.action + " query requires an additional argument!");
                return;
            }
            cb();
        };
        var finishQuery = function () {
            if (_this.query.state !== "error") {
                _this.query.state = "complete";
                _this.complete();
            }
        };
        if (!this.query.cacheID) {
            this.query.cacheID = this.query.queryID;
        }
        switch (action) {
            case "select":
                this._select(finishQuery, this.error);
                break;
            case "upsert":
                this._upsert(this.progress, this.complete, this.error);
                break;
            case "delete":
                this._delete(this.progress, this.complete, this.error);
                break;
            case "show tables":
                this._showTables();
                break;
            case "describe":
                this._describe();
                break;
            case "describe indexes":
                this._describe("idx");
                break;
            case "drop":
            case "drop table":
                this._dropTable(this.query.table, finishQuery, this.error);
                break;
            case "create table":
            case "create table if not exists":
                requireQueryOpts(true, function () {
                    _this._createTable(_this.query.actionArgs, false, finishQuery, _this.error);
                });
                break;
            case "alter table":
                requireQueryOpts(true, function () {
                    _this._createTable(_this.query.actionArgs, true, finishQuery, _this.error);
                });
                break;
            case "rebuild indexes":
                requireQueryOpts(false, function () {
                    _this._rebuildIndexes(_this.progress, finishQuery, _this.error);
                });
                break;
            case "conform rows":
                requireQueryOpts(false, function () {
                    _this._conform(_this.progress, finishQuery, _this.error);
                });
                break;
            default:
                this.nSQL.doFilter("customQuery", { res: undefined, query: this.query, onRow: progress, complete: complete, error: error }, function () {
                    _this.query.state = "error";
                    _this.error("Query type \"" + query.action + "\" not supported!");
                }, function (err) {
                    _this.query.state = "error";
                    _this.error(err);
                });
        }
    }
    _nanoSQLQuery.prototype._conform = function (progress, finished, error) {
        var _this = this;
        var conformTable = this.query.table;
        var conformFilter = this.query.actionArgs || function (r) { return r; };
        if (!this.nSQL._tables[conformTable]) {
            error(new Error("Table " + conformTable + " not found for conforming!"));
            return;
        }
        var count = 0;
        var conformQueue = new utilities_1._nanoSQLQueue(function (item, i, done, err) {
            var newRow = _this.nSQL.default(item, conformTable);
            _this.nSQL.doFilter("conformRow", { res: newRow, oldRow: item, query: _this.query }, function (setRow) {
                _this._diffUpdates(_this.query.table, item, setRow.res, function () {
                    var changeEvent = {
                        target: conformTable,
                        path: "*",
                        events: ["upsert", "change", "*"],
                        time: Date.now(),
                        performance: Date.now() - _this._startTime,
                        result: setRow.res,
                        oldRow: item,
                        query: _this.query,
                        indexes: _this._indexesUsed
                    };
                    if (_this.nSQL.state.hasAnyEvents) {
                        _this.nSQL.triggerEvent(changeEvent);
                        Object.keys(_this.nSQL.eventFNs[_this.query.table]).forEach(function (path) {
                            if (path !== "*") {
                                if (!utilities_1.objectsEqual(utilities_1.deepGet(path, item), utilities_1.deepGet(path, setRow.res))) {
                                    _this.nSQL.triggerEvent({
                                        target: _this.query.table,
                                        path: path,
                                        events: ["upsert", "change", "*"],
                                        time: Date.now(),
                                        performance: Date.now() - _this._startTime,
                                        result: setRow.res,
                                        oldRow: item,
                                        query: _this.query,
                                        indexes: _this._indexesUsed
                                    }, true);
                                }
                            }
                        });
                    }
                    progress(_this.query.returnEvent ? changeEvent : setRow.res, i);
                    count++;
                    done();
                }, err);
            }, error);
        }, error, function () {
            finished();
        });
        this._getRecords(function (row, i) {
            conformQueue.newItem(conformFilter(row));
        }, function () {
            conformQueue.finished();
        }, error);
    };
    _nanoSQLQuery.prototype._getTable = function (tableName, whereCond, table, callback) {
        var _this = this;
        var cacheID = this.query.cacheID;
        if (typeof table === "function") {
            if (!globalTableCache[cacheID]) {
                globalTableCache[cacheID] = {};
            }
            if (!globalTableCache[cacheID][tableName]) { // first load
                globalTableCache[cacheID][tableName] = { loading: true, rows: [], cache: true };
                table(whereCond).then(function (result) {
                    var doCache = (result.cache && !result.filtered) || false;
                    globalTableCache[cacheID][tableName] = { loading: false, rows: doCache ? result.rows : [], cache: doCache };
                    callback(result);
                }).catch(this._onError);
                return;
            }
            if (globalTableCache[cacheID][tableName].loading) {
                setTimeout(function () {
                    _this._getTable(tableName, whereCond, table, callback);
                }, 10);
                return;
            }
            if (globalTableCache[cacheID][tableName].cache) {
                callback({ filtered: false, rows: globalTableCache[cacheID][tableName].rows, cache: true });
                return;
            }
            table(whereCond).then(function (result) {
                callback(result);
            }).catch(this._onError);
        }
        else {
            callback({ rows: table, filtered: false, cache: false });
        }
    };
    /**
     * Peform a join command.
     *
     * @internal
     * @param {DBRow[]} rows
     * @param {(rows: DBRow[]) => void} complete
     * @returns {void}
     * @memberof _MutateSelection
     */
    _nanoSQLQuery.prototype._maybeJoin = function (joinData, leftRow, onRow, complete) {
        var _this = this;
        var _a;
        if (!joinData[0]) { // no join to perform, NEXT!
            onRow(leftRow);
            complete();
            return;
        }
        var doJoin = function (rowData, joinIdx, joinDone) {
            var join = joinData[joinIdx];
            var joinRowCount = 0;
            var rightHashes = [];
            if (join.type !== "cross" && !join.on) {
                _this.query.state = "error";
                _this.error(new Error("Non 'cross' joins require an 'on' parameter!"));
                return;
            }
            var noJoinAS = new Error("Must use 'AS' when joining temporary tables!");
            if (typeof join.with.table !== "string" && !join.with.as) {
                _this.query.state = "error";
                _this.error(noJoinAS);
                return;
            }
            if (typeof _this.query.table !== "string" && !_this.query.tableAS) {
                _this.query.state = "error";
                _this.error(noJoinAS);
                return;
            }
            var joinBuffer = new utilities_1._nanoSQLQueue(function (rData, i, rDone, err) {
                if (!joinData[joinIdx + 1]) { // no more joins, send joined row
                    onRow(rData);
                    rDone();
                }
                else { // more joins, nest on!
                    doJoin(rData, joinIdx + 1, rDone);
                }
            }, _this.error, joinDone);
            var withPK = typeof join.with.table === "string" ? _this.nSQL._tables[join.with.table].pkCol : [];
            var rightTable = String(join.with.as || join.with.table);
            var leftTable = String(_this.query.tableAS || _this.query.table);
            var queryTable = _this.query.tableAS || _this.query.table;
            var whereCond = join.on && join.type !== "cross" ? _this._buildCombineWhere(join.on, join.with.as || join.with.table, queryTable, rowData) : [];
            _this._getTable(queryTable, whereCond, join.with.table, function (joinTable) {
                var eachRow = function (row) {
                    var _a;
                    joinRowCount++;
                    if (join.type === "right" || join.type === "outer") {
                        // keep track of which right side rows have been joined
                        rightHashes.push(withPK ? utilities_1.deepGet(withPK, row) : utilities_1.hash(JSON.stringify(row)));
                    }
                    joinBuffer.newItem(__assign({}, rowData, (_a = {}, _a[rightTable] = row, _a)));
                };
                var rowsDone = function () {
                    var _a, _b;
                    switch (join.type) {
                        case "left":
                            if (joinRowCount === 0) {
                                joinBuffer.newItem(__assign({}, rowData, (_a = {}, _a[rightTable] = undefined, _a)));
                            }
                            joinBuffer.finished();
                            break;
                        case "inner":
                        case "cross":
                            joinBuffer.finished();
                            break;
                        case "outer":
                        case "right":
                            if (joinRowCount === 0 && join.type === "outer") {
                                joinBuffer.newItem(__assign({}, rowData, (_b = {}, _b[rightTable] = undefined, _b)));
                            }
                            // full table scan on right table :(
                            _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, join.with.table, "select"), { skipQueue: true, cacheID: _this.query.cacheID, where: withPK ? [withPK, "NOT IN", rightHashes] : undefined }), function (row) {
                                var _a;
                                if (withPK || rightHashes.indexOf(utilities_1.hash(JSON.stringify(row))) === -1) {
                                    joinBuffer.newItem(__assign({}, rowData, (_a = {}, _a[leftTable] = undefined, _a[rightTable] = row, _a)));
                                }
                            }, function () {
                                joinBuffer.finished();
                            }, function (err) {
                                _this.query.state = "error";
                                _this.error(err);
                            });
                            break;
                    }
                };
                if (joinTable.filtered) {
                    joinTable.rows.forEach(eachRow);
                    rowsDone();
                }
                else {
                    _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, joinTable.rows, "select"), { tableAS: join.with.as, cacheID: _this.query.cacheID, where: join.on && join.type !== "cross" ? _this._buildCombineWhere(join.on, join.with.as || join.with.table, queryTable, rowData) : undefined, skipQueue: true }), eachRow, rowsDone, function (err) {
                        _this.query.state = "error";
                        _this.error(err);
                    });
                }
            });
        };
        doJoin((_a = {}, _a[String(this.query.tableAS || this.query.table)] = leftRow, _a), 0, complete);
    };
    _nanoSQLQuery.prototype._select = function (complete, onError) {
        // Query order:
        // 1. Join / Index / Where Select
        // 2. Group By & Functions
        // 3. Apply AS
        // 4. Having
        // 5. OrderBy
        // 6. Offset
        // 7. Limit
        var _this = this;
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where, typeof this.query.table !== "string" || typeof this.query.union !== "undefined") : { type: interfaces_1.IWhereType.none };
        this._havingArgs = this.query.having ? this._parseWhere(this.query.having, true) : { type: interfaces_1.IWhereType.none };
        this._parseSelect();
        if (this.query.state === "error")
            return;
        var range = [(this.query.offset || 0), (this.query.offset || 0) + (this.query.limit || 0)];
        var doRange = range[0] + range[1] > 0;
        var distinctKeys = {};
        var generateDistinctKey = function (row) {
            return (_this.query.distinct || []).reduce(function (prev, cur) {
                return prev + JSON.stringify(utilities_1.deepGet(cur, row) || {});
            }, "");
        };
        // UNION query
        if (this.query.union) {
            var hashes_1 = [];
            var columns_1 = [];
            var count_1 = 0;
            utilities_1.chainAsync(this.query.union.queries, function (query, k, next) {
                query().then(function (rows) {
                    if (!columns_1.length) {
                        columns_1 = Object.keys(rows[0]);
                    }
                    if (_this.query.where) {
                        rows = rows.filter(function (r, i) {
                            return _this._where(r, _this._whereArgs.slowWhere);
                        });
                    }
                    rows = rows.map(function (r) {
                        if (_this.query.union && _this.query.union.type === "distinct") {
                            var rowHash = utilities_1.hash(JSON.stringify(r));
                            if (k === 0) {
                                hashes_1.push(rowHash);
                            }
                            else {
                                if (hashes_1.indexOf(rowHash) !== -1) {
                                    return undefined;
                                }
                                else {
                                    hashes_1.push(rowHash);
                                }
                            }
                        }
                        return Object.keys(r).reduce(function (p, c, i) {
                            if (i < columns_1.length) {
                                p[columns_1[i]] = r[c];
                            }
                            return p;
                        }, {});
                    }).filter(function (f) { return f; });
                    if (_this.query.orderBy) {
                        _this._queryBuffer = _this._queryBuffer.concat(rows.map(function (row) {
                            var isDistinct = true;
                            if (_this.query.distinct) {
                                var key = generateDistinctKey(row);
                                if (!distinctKeys[key]) {
                                    distinctKeys[key] = true;
                                }
                                else {
                                    isDistinct = false;
                                }
                            }
                            var newRow = _this._streamAS(row);
                            var keep = _this.query.having ? _this._where(newRow, _this._havingArgs.slowWhere) : true;
                            return keep && isDistinct ? newRow : undefined;
                        }).filter(function (f) { return f; }));
                    }
                    else {
                        rows.forEach(function (row, i) {
                            var isDistinct = true;
                            if (_this.query.distinct) {
                                var key = generateDistinctKey(row);
                                if (!distinctKeys[key]) {
                                    distinctKeys[key] = true;
                                }
                                else {
                                    isDistinct = false;
                                }
                            }
                            if (!isDistinct) {
                                return;
                            }
                            var newRow = _this._streamAS(row);
                            var keep = _this.query.having ? _this._where(newRow, _this._havingArgs.slowWhere) : true;
                            if (!keep) {
                                return;
                            }
                            if (doRange) {
                                if (count_1 >= range[0] && count_1 < range[1]) {
                                    _this.progress(newRow, count_1);
                                }
                            }
                            else {
                                _this.progress(newRow, count_1);
                            }
                            count_1++;
                        });
                    }
                    next();
                });
            }).then(function () {
                if (_this.query.orderBy) {
                    var sorted = _this._queryBuffer.sort(_this._orderByRows);
                    (doRange ? sorted.slice(range[0], range[1]) : sorted).forEach(_this.progress);
                }
                if (_this.query.cacheID && _this.query.cacheID === _this.query.queryID) {
                    delete globalTableCache[_this.query.cacheID];
                }
                complete();
            });
            return;
        }
        var joinData = Array.isArray(this.query.join) ? this.query.join : [this.query.join];
        var joinedRows = 0;
        var rowCounter2 = 0;
        var graphBuffer = new utilities_1._nanoSQLQueue(function (gRow, ct, nextGraph, err) {
            if (_this.query.graph) {
                _this._graph(_this.query.graph || [], _this.query.tableAS || _this.query.table, gRow, rowCounter, function (graphRow, j) {
                    var isDistinct = true;
                    if (_this.query.distinct) {
                        var key = generateDistinctKey(graphRow);
                        if (!distinctKeys[key]) {
                            distinctKeys[key] = true;
                        }
                        else {
                            isDistinct = false;
                        }
                    }
                    if (!isDistinct) {
                        rowCounter2++;
                        nextGraph();
                        return;
                    }
                    var finalRow = _this._streamAS(graphRow);
                    if (_this.query.having) {
                        if (_this._where(_this._streamAS(gRow), _this._havingArgs.slowWhere)) {
                            _this.progress(finalRow, rowCounter2);
                        }
                    }
                    else {
                        _this.progress(finalRow, rowCounter2);
                    }
                    rowCounter2++;
                    nextGraph();
                });
            }
            else {
                var isDistinct = true;
                if (_this.query.distinct) {
                    var key = generateDistinctKey(gRow);
                    if (!distinctKeys[key]) {
                        distinctKeys[key] = true;
                    }
                    else {
                        isDistinct = false;
                    }
                }
                if (!isDistinct) {
                    rowCounter2++;
                    nextGraph();
                    return;
                }
                _this.progress(_this._streamAS(gRow), rowCounter2);
                rowCounter2++;
                nextGraph();
            }
        }, this._onError, function () {
            if (_this.query.cacheID && _this.query.cacheID === _this.query.queryID) {
                delete globalTableCache[_this.query.cacheID];
            }
            complete();
        });
        var rowCounter = 0;
        var selectBuffer = new utilities_1._nanoSQLQueue(function (row, ct, next, err) {
            _this._maybeJoin(joinData, row, function (row2) {
                if (_this._stream) {
                    // continue streaming results
                    // skipping group by, order by and aggregate functions
                    if (doRange ? (rowCounter >= range[0] && rowCounter < range[1]) : true) {
                        graphBuffer.newItem(row2);
                    }
                    rowCounter++;
                }
                else {
                    _this._queryBuffer.push(row2);
                }
            }, next);
        }, this.error, function () {
            if (_this._stream) {
                graphBuffer.finished();
                return;
            }
            // use buffer
            utilities_1.allAsync(_this._queryBuffer, function (row, i, next) {
                _this._graph(_this.query.graph || [], _this.query.tableAS || _this.query.table, row, i, next);
            }).then(function (newBuffer) {
                _this._queryBuffer = newBuffer;
                // Group by, functions and AS
                _this._groupByRows();
                if (_this.query.having) { // having
                    _this._queryBuffer = _this._queryBuffer.filter(function (row) {
                        return _this._where(row, _this._havingArgs.slowWhere);
                    });
                }
                if (_this.query.orderBy && !_this._hasOrdered) { // order by
                    _this._queryBuffer.sort(_this._orderByRows);
                }
                if (doRange) { // limit / offset
                    _this._queryBuffer = _this._queryBuffer.slice(range[0], range[1]);
                }
                _this._queryBuffer.forEach(function (row, i) {
                    var isDistinct = true;
                    if (_this.query.distinct) {
                        var key = generateDistinctKey(row);
                        if (!distinctKeys[key]) {
                            distinctKeys[key] = true;
                        }
                        else {
                            isDistinct = false;
                        }
                    }
                    if (isDistinct) {
                        _this.progress(row, i);
                    }
                });
                if (_this.query.cacheID && _this.query.cacheID === _this.query.queryID) {
                    delete globalTableCache[_this.query.cacheID];
                }
                complete();
            });
        });
        var tableIsString = typeof this.query.table === "string";
        // query path start
        this._getRecords(function (row, i) {
            var selectEvent = {
                target: _this.query.table,
                path: "_all_",
                events: ["select", "*"],
                time: Date.now(),
                performance: Date.now() - _this._startTime,
                result: row,
                query: _this.query,
                indexes: _this._indexesUsed
            };
            if (tableIsString) {
                _this.nSQL.triggerEvent(selectEvent);
            }
            if (_this.query.returnEvent) {
                _this.progress(selectEvent, i);
            }
            else {
                selectBuffer.newItem(row);
            }
        }, function () {
            if (_this.query.returnEvent) {
                complete();
            }
            else {
                selectBuffer.finished();
            }
        }, onError);
    };
    _nanoSQLQuery.prototype._groupByRows = function () {
        var _this = this;
        if (!this.query.groupBy && !this._hasAggrFn) {
            this._queryBuffer = this._queryBuffer.map(function (b) { return _this._streamAS(b); });
            return;
        }
        this._queryBuffer.sort(function (a, b) {
            return _this._sortObj(a, b, _this._groupBy);
        }).forEach(function (val, idx) {
            var groupByKey = _this._groupBy.sort.map(function (k) {
                return String(k.fn ? utilities_1.execFunction(_this.query, k.fn, val, { result: undefined }).result : utilities_1.deepGet(k.path, val));
            }).join(".");
            if (_this._sortGroupKeys[groupByKey] === undefined) {
                _this._sortGroupKeys[groupByKey] = _this._sortGroups.length;
            }
            var key = _this._sortGroupKeys[groupByKey];
            if (!_this._sortGroups[key]) {
                _this._sortGroups.push([]);
            }
            _this._sortGroups[key].push(val);
        });
        if (this.query.orderBy) {
            this._hasOrdered = true;
            this._sortGroups = this._sortGroups.map(function (groupArr) {
                return groupArr.sort(function (a, b) { return _this._sortObj(a, b, _this._orderBy); });
            });
        }
        this._queryBuffer = [];
        if (this._hasAggrFn) {
            // loop through the groups
            this._sortGroups.forEach(function (group) {
                // find aggregate functions
                var resultFns = _this._selectArgs.reduce(function (p, c, i) {
                    var fnName = c.value.split("(").shift();
                    if (c.isFn && _this.nSQL.functions[fnName] && _this.nSQL.functions[fnName].type === "A") {
                        p[i] = {
                            idx: i,
                            name: c.value,
                            aggr: utilities_1.assign(_this.nSQL.functions[fnName].aggregateStart),
                        };
                    }
                    return p;
                }, []);
                var firstFn = resultFns.filter(function (f) { return f; })[0];
                // calculate aggregate functions
                group.reverse().forEach(function (row, i) {
                    resultFns.forEach(function (fn, i) {
                        if (!fn)
                            return;
                        resultFns[i].aggr = utilities_1.execFunction(_this.query, resultFns[i].name, row, resultFns[i].aggr);
                    });
                });
                // calculate simple functions and AS back into buffer
                _this._queryBuffer.push(_this._selectArgs.reduce(function (prev, cur, i) {
                    var col = cur.value;
                    prev[cur.as || col] = cur.isFn && resultFns[i] ? resultFns[i].aggr.result : (cur.isFn ? utilities_1.execFunction(_this.query, cur.value, resultFns[firstFn.idx].aggr.row, { result: undefined }).result : utilities_1.deepGet(cur.value, resultFns[firstFn.idx].aggr.row));
                    return prev;
                }, {}));
            });
        }
        else {
            this._sortGroups.forEach(function (group) {
                _this._queryBuffer.push(_this._streamAS(group.shift()));
            });
        }
    };
    _nanoSQLQuery.prototype._buildCombineWhere = function (graphWhere, graphTable, rowTable, rowData) {
        var _this = this;
        if (typeof graphWhere === "function") {
            return function (compareRow) {
                return graphWhere(compareRow, rowData);
            };
        }
        return (typeof graphWhere[0] === "string" ? [graphWhere] : graphWhere).map(function (j) {
            if (Array.isArray(j[0]))
                return _this._buildCombineWhere(j, graphTable, rowTable, rowData); // nested where
            if (j === "AND" || j === "OR")
                return j;
            var leftWhere = utilities_1.resolvePath(j[0]);
            var rightWhere = utilities_1.resolvePath(j[2]);
            var swapWhere = leftWhere[0] === rowTable;
            // swapWhere = true [leftTable.column, =, rightTable.column] => [rightWhere, =, objQuery(leftWhere)]
            // swapWhere = false [rightTable.column, =, leftTable.column] => [leftWhere, =, objQuery(rightWhere)]
            return [
                swapWhere ? rightWhere.slice(1).join(".") : leftWhere.slice(1).join("."),
                swapWhere ? (j[1].indexOf(">") !== -1 ? j[1].replace(">", "<") : j[1].replace("<", ">")) : j[1],
                utilities_1.deepGet(swapWhere ? leftWhere : rightWhere, rowData)
            ];
        });
    };
    _nanoSQLQuery.prototype._graph = function (gArgs, topTable, row, index, onRow) {
        var _this = this;
        var graphArgs = Array.isArray(gArgs) ? gArgs : [gArgs];
        if (!graphArgs || graphArgs.length === 0) {
            onRow(row, index);
            return;
        }
        utilities_1.allAsync(graphArgs, function (graph, i, next) {
            var _a;
            var noGraphAs = new Error("Must use 'AS' when graphing temporary tables!");
            if (typeof graph.with.table !== "string" && !graph.with.as) {
                _this.query.state = "error";
                _this.error(noGraphAs);
                return;
            }
            if (typeof _this.query.table !== "string" && !_this.query.tableAS) {
                _this.query.state = "error";
                _this.error(noGraphAs);
                return;
            }
            row[graph.key] = [];
            var whereCond = _this._buildCombineWhere(graph.on, graph.with.as || graph.with.table, topTable, (_a = {}, _a[topTable] = row, _a));
            _this._getTable(graph.with.as || graph.with.table, whereCond, graph.with.table, function (graphTable) {
                if (graphTable.filtered) {
                    graphTable.rows.forEach(function (graphRow) {
                        if (graph.single) {
                            row[graph.key] = graphRow;
                        }
                        else {
                            row[graph.key].push(graphRow);
                        }
                    });
                    next(null);
                }
                else {
                    _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, graphTable.rows, "select"), { tableAS: graph.with.as, actionArgs: graph.select, where: whereCond, limit: graph.limit, offset: graph.offset, orderBy: graph.orderBy, groupBy: graph.groupBy, graph: graph.graph, skipQueue: true, cacheID: _this.query.cacheID }), function (graphRow) {
                        if (graph.single) {
                            row[graph.key] = graphRow;
                        }
                        else {
                            row[graph.key].push(graphRow);
                        }
                    }, function () {
                        next(null);
                    }, _this._onError);
                }
            });
        }).then(function () {
            onRow(row, index);
        });
    };
    _nanoSQLQuery.prototype._upsert = function (onRow, complete, error) {
        var _this = this;
        if (!this.query.actionArgs) {
            error("Can't upsert without records!");
            this.query.state = "error";
        }
        // nested upsert
        if (this.query.table.indexOf(".") !== -1 || this.query.table.indexOf("[") !== -1) {
            var path = utilities_1.resolvePath(this.query.table);
            this.query.table = path.shift();
            this.upsertPath = path;
        }
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.state === "error")
            return;
        var upsertRecords = Array.isArray(this.query.actionArgs) ? this.query.actionArgs : [this.query.actionArgs];
        var table = this.nSQL._tables[this.query.table];
        if (this._whereArgs.type === interfaces_1.IWhereType.none) { // insert/update records directly
            utilities_1.allAsync(upsertRecords, function (row, i, next, error) {
                var pkVal = utilities_1.deepGet(table.pkCol, row);
                if (pkVal) {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).read(_this.query.table, pkVal, function (oldRow) {
                        if (oldRow) {
                            _this._updateRow(row, oldRow, function (newRow) {
                                onRow(newRow, i);
                                next(null);
                            }, error);
                        }
                        else {
                            _this._newRow(row, function (newRow) {
                                onRow(newRow, i);
                                next(null);
                            }, error);
                        }
                    }, error);
                }
                else {
                    _this._newRow(row, function (newRow) {
                        onRow(newRow, i);
                        next(null);
                    }, error);
                }
            }).then(function () {
                complete();
            }).catch(this._onError);
        }
        else { // find records and update them
            if (upsertRecords.length > 1) {
                this.query.state = "error";
                error("Cannot upsert multiple records with where condition!");
                return;
            }
            var updatedRecords_1 = 0;
            var upsertBuffer_1 = new utilities_1._nanoSQLQueue(function (row, i, done, err) {
                updatedRecords_1++;
                _this._updateRow(upsertRecords[0], row, function (evOrRow) {
                    onRow(evOrRow, i);
                    done();
                }, err);
            }, error, function () {
                complete();
            });
            this._getRecords(function (row, i) {
                upsertBuffer_1.newItem(row);
            }, function () {
                upsertBuffer_1.finished();
            }, error);
        }
    };
    _nanoSQLQuery.prototype._updateRow = function (newData, oldRow, complete, error) {
        var _this = this;
        this.nSQL.doFilter("updateRow", { res: newData, row: oldRow, query: this.query }, function (upsertData) {
            var finalRow = _this.nSQL.default(_this.upsertPath ? utilities_1.deepSet(_this.upsertPath, utilities_1.maybeAssign(oldRow), upsertData.res) : __assign({}, oldRow, upsertData.res), _this.query.table);
            _this._diffUpdates(_this.query.table, oldRow, finalRow, function () {
                var changeEvent = {
                    target: _this.query.table,
                    path: "*",
                    events: ["upsert", "change", "*"],
                    time: Date.now(),
                    performance: Date.now() - _this._startTime,
                    result: finalRow,
                    oldRow: oldRow,
                    query: _this.query,
                    indexes: _this._indexesUsed
                };
                _this.nSQL.doFilter("updateRowEvent", { res: changeEvent, query: _this.query }, function (event) {
                    if (typeof _this.query.table === "string") {
                        _this.nSQL.triggerEvent(event.res);
                        if (_this.nSQL.eventFNs[_this.query.table]) {
                            Object.keys(_this.nSQL.eventFNs[_this.query.table]).forEach(function (path) {
                                if (path !== "*") {
                                    if (!utilities_1.objectsEqual(utilities_1.deepGet(path, oldRow), utilities_1.deepGet(path, finalRow))) {
                                        _this.nSQL.triggerEvent({
                                            target: _this.query.table,
                                            path: path,
                                            events: ["upsert", "change", "*"],
                                            time: Date.now(),
                                            performance: Date.now() - _this._startTime,
                                            result: finalRow,
                                            oldRow: oldRow,
                                            query: _this.query,
                                            indexes: _this._indexesUsed
                                        }, true);
                                    }
                                }
                            });
                        }
                    }
                    complete(_this.query.returnEvent ? event.res : finalRow);
                }, error);
            }, error);
        }, error);
    };
    _nanoSQLQuery.prototype._checkUniqueIndexes = function (table, pk, oldRow, newIndexValues, done, error) {
        var _this = this;
        utilities_1.allAsync(Object.keys(newIndexValues), function (index, i, next, err) {
            var indexProps = _this.nSQL._tables[_this.query.table].indexes[index].props || {};
            if (indexProps && indexProps.unique) { // check for unique
                var indexPKs_1 = [];
                utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(table, index, newIndexValues[index], function (rowPK) {
                    if (rowPK !== pk)
                        indexPKs_1.push(rowPK);
                }, function () {
                    if (indexPKs_1.length > 0) {
                        err({ error: "Unique Index Collision!", row: oldRow, query: _this.query });
                    }
                    else {
                        next(null);
                    }
                }, err);
            }
            else { // no need to check for unique
                next(null);
            }
        }).then(done).catch(error);
    };
    _nanoSQLQuery.prototype._diffUpdates = function (queryTable, oldRow, finalRow, done, error) {
        var _this = this;
        var newIndexValues = this._getIndexValues(this.nSQL._tables[this.query.table].indexes, finalRow);
        var oldIndexValues = this._getIndexValues(this.nSQL._tables[this.query.table].indexes, oldRow);
        var table = this.nSQL._tables[queryTable];
        this._checkUniqueIndexes(queryTable, utilities_1.deepGet(table.pkCol, oldRow), oldRow, newIndexValues, function () {
            utilities_1.allAsync(Object.keys(oldIndexValues).concat(["__pk__"]), function (indexName, i, next, err) {
                if (indexName === "__pk__") { // main row
                    utilities_1.adapterFilters(_this.nSQL, _this.query).write(queryTable, utilities_1.deepGet(table.pkCol, finalRow), finalRow, function (pk) {
                        utilities_1.deepSet(table.pkCol, finalRow, pk);
                        next(null);
                    }, err);
                }
                else { // indexes
                    var tableName_1 = _this.query.table;
                    if (utilities_1.objectsEqual(newIndexValues[indexName], oldIndexValues[indexName]) === false) { // only update changed index values
                        if (table.indexes[indexName].isArray) {
                            var addValues = newIndexValues[indexName].filter(function (v, i, s) { return oldIndexValues[indexName].indexOf(v) === -1; });
                            var removeValues = oldIndexValues[indexName].filter(function (v, i, s) { return newIndexValues[indexName].indexOf(v) === -1; });
                            utilities_1.allAsync([addValues, removeValues], function (arrayOfValues, j, nextValues) {
                                if (!arrayOfValues.length) {
                                    nextValues(null);
                                    return;
                                }
                                utilities_1.allAsync(arrayOfValues, function (value, i, nextArr) {
                                    _this._updateIndex(tableName_1, indexName, value, utilities_1.deepGet(table.pkCol, finalRow), j === 0, function () {
                                        nextArr(null);
                                    }, err);
                                }).then(nextValues);
                            }).then(next);
                        }
                        else {
                            utilities_1.chainAsync(["rm", "add"], function (job, i, nextJob) {
                                switch (job) {
                                    case "add": // add new index value
                                        _this._updateIndex(tableName_1, indexName, newIndexValues[indexName], utilities_1.deepGet(table.pkCol, finalRow), true, function () {
                                            nextJob(null);
                                        }, err);
                                        break;
                                    case "rm": // remove old index value
                                        _this._updateIndex(tableName_1, indexName, oldIndexValues[indexName], utilities_1.deepGet(table.pkCol, finalRow), false, function () {
                                            nextJob(null);
                                        }, err);
                                        break;
                                }
                            }).then(next);
                        }
                    }
                    else {
                        next(null);
                    }
                }
            }).then(done).catch(error);
        }, error);
    };
    _nanoSQLQuery.prototype._updateIndex = function (table, indexName, value, pk, addToIndex, done, err) {
        var _this = this;
        var newItem = { table: table, indexName: indexName, value: value, pk: pk, addToIndex: addToIndex, done: done, err: err, query: this.query, nSQL: this.nSQL };
        this.nSQL.doFilter("updateIndex", { res: newItem, query: this.query }, function (update) {
            exports.secondaryIndexQueue[_this.nSQL.state.id + update.res.indexName].newItem(update.res, function (item, done, error) {
                var fn = item.addToIndex ? utilities_1.adapterFilters(item.nSQL, item.query).addIndexValue : utilities_1.adapterFilters(item.nSQL, item.query).deleteIndexValue;
                fn(item.table, item.indexName, item.pk, item.value, function () {
                    item.done();
                    done();
                }, function (err) {
                    item.err(err);
                    done();
                });
            });
        }, err);
    };
    _nanoSQLQuery.prototype._newRow = function (newRow, complete, error) {
        var _this = this;
        this.nSQL.doFilter("addRow", { res: newRow, query: this.query }, function (rowToAdd) {
            var table = _this.nSQL._tables[_this.query.table];
            rowToAdd.res = _this.nSQL.default(utilities_1.maybeAssign(_this.upsertPath ? utilities_1.deepSet(_this.upsertPath, {}, rowToAdd.res) : rowToAdd.res), _this.query.table);
            var indexValues = _this._getIndexValues(_this.nSQL._tables[_this.query.table].indexes, rowToAdd.res);
            _this._checkUniqueIndexes(_this.query.table, utilities_1.deepGet(table.pkCol, rowToAdd.res), rowToAdd.res, indexValues, function () {
                utilities_1.adapterFilters(_this.nSQL, _this.query).write(_this.query.table, utilities_1.deepGet(table.pkCol, rowToAdd.res), rowToAdd.res, function (pk) {
                    utilities_1.deepSet(table.pkCol, rowToAdd.res, pk);
                    utilities_1.allAsync(Object.keys(indexValues), function (indexName, i, next, err) {
                        // const idxTable = "_idx_" + this.nSQL.tableIds[this.query.table as string] + "_" + indexName;
                        if (table.indexes[indexName].isArray) {
                            var arrayOfValues = indexValues[indexName] || [];
                            utilities_1.allAsync(arrayOfValues, function (value, i, nextArr) {
                                _this._updateIndex(_this.query.table, indexName, value, utilities_1.deepGet(table.pkCol, rowToAdd.res), true, function () {
                                    nextArr(null);
                                }, err);
                            }).then(function () {
                                next(null);
                            }).catch(err);
                        }
                        else {
                            _this._updateIndex(_this.query.table, indexName, indexValues[indexName], utilities_1.deepGet(table.pkCol, rowToAdd.res), true, function () {
                                next(null);
                            }, err);
                        }
                    }).then(function () {
                        var changeEvent = {
                            target: _this.query.table,
                            path: "*",
                            events: ["upsert", "change", "*"],
                            time: Date.now(),
                            performance: Date.now() - _this._startTime,
                            result: rowToAdd.res,
                            oldRow: undefined,
                            query: _this.query,
                            indexes: _this._indexesUsed
                        };
                        _this.nSQL.doFilter("addRowEvent", { res: changeEvent, query: _this.query }, function (event) {
                            if (typeof _this.query.table === "string") {
                                _this.nSQL.triggerEvent(event.res);
                            }
                            complete(_this.query.returnEvent ? event.res : rowToAdd.res);
                        }, error);
                    });
                }, error);
            }, error);
        }, error);
    };
    _nanoSQLQuery.prototype._delete = function (onRow, complete, error) {
        var _this = this;
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.state === "error")
            return;
        var tableConfig = this.nSQL._tables[this.query.table];
        var deleteBuffer = new utilities_1._nanoSQLQueue(function (row, i, done, err) {
            new Promise(function (res, rej) {
                var table = _this.query.table;
                if (_this.nSQL._fkRels[table] && _this.nSQL._fkRels[table].length) {
                    utilities_1.allAsync(_this.nSQL._fkRels[table], function (fkRestraint, i, next, err) {
                        var rowValue = utilities_1.deepGet(fkRestraint.selfPath, row);
                        var rowPKs = utilities_1.cast("any[]", fkRestraint.selfIsArray ? rowValue : [rowValue]);
                        utilities_1.allAsync(rowPKs, function (rowPK, iii, nextRow, rowErr) {
                            switch (fkRestraint.onDelete) {
                                case interfaces_1.InanoSQLFKActions.RESTRICT: // see if any rows are connected
                                    var count_2 = 0;
                                    utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, function (pk) {
                                        count_2++;
                                    }, function () {
                                        if (count_2 > 0) {
                                            rowErr("Foreign key restraint error, can't delete!");
                                        }
                                        else {
                                            nextRow();
                                        }
                                    }, err);
                                    break;
                                case interfaces_1.InanoSQLFKActions.CASCADE:
                                    var deleteIDs_1 = [];
                                    utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, function (key) {
                                        deleteIDs_1.push(key);
                                    }, function () {
                                        _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, fkRestraint.childTable, "delete"), { where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs_1] }), utilities_1.noop, nextRow, rowErr);
                                    }, err);
                                    break;
                                case interfaces_1.InanoSQLFKActions.SET_NULL:
                                    var setIDs_1 = [];
                                    utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, function (key) {
                                        setIDs_1.push(key);
                                    }, function () {
                                        var _a;
                                        _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, fkRestraint.childTable, "upsert"), { actionArgs: (_a = {},
                                                _a[fkRestraint.childPath.join(".")] = null,
                                                _a), where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs_1] }), utilities_1.noop, nextRow, rowErr);
                                    }, err);
                                    break;
                                default:
                                    next();
                            }
                        }).then(next).catch(err);
                    }).then(res).catch(rej);
                }
                else {
                    res();
                }
            }).then(function () {
                _this._removeRowAndIndexes(tableConfig, row, function (delRowOrEvent) {
                    onRow(delRowOrEvent, i);
                    done();
                }, err);
            }).catch(err);
        }, error, function () {
            complete();
        });
        this._getRecords(function (row, i) {
            deleteBuffer.newItem(row);
        }, function () {
            deleteBuffer.finished();
        }, error);
    };
    _nanoSQLQuery.prototype._removeRowAndIndexes = function (table, row, complete, error) {
        var _this = this;
        var indexValues = this._getIndexValues(table.indexes, row);
        this.nSQL.doFilter("deleteRow", { res: row, query: this.query }, function (delRow) {
            utilities_1.allAsync(Object.keys(indexValues).concat(["__del__"]), function (indexName, i, next) {
                if (indexName === "__del__") { // main row
                    utilities_1.adapterFilters(_this.nSQL, _this.query).delete(_this.query.table, utilities_1.deepGet(table.pkCol, delRow.res), function () {
                        next(null);
                    }, function (err) {
                        _this.query.state = "error";
                        error(err);
                    });
                }
                else { // secondary indexes
                    if (table.indexes[indexName].isArray) {
                        var arrayOfValues = indexValues[indexName] || [];
                        utilities_1.allAsync(arrayOfValues, function (value, i, nextArr) {
                            _this._updateIndex(_this.query.table, indexName, value, utilities_1.deepGet(table.pkCol, delRow.res), false, function () {
                                nextArr(null);
                            }, error);
                        }).then(next);
                    }
                    else {
                        _this._updateIndex(_this.query.table, indexName, indexValues[indexName], utilities_1.deepGet(table.pkCol, delRow.res), false, function () {
                            next(null);
                        }, _this._onError);
                    }
                }
            }).then(function () {
                var delEvent = {
                    target: _this.query.table,
                    path: "_all_",
                    events: ["change", "delete", "*"],
                    time: Date.now(),
                    performance: Date.now() - _this._startTime,
                    result: delRow.res,
                    query: _this.query,
                    indexes: _this._indexesUsed
                };
                _this.nSQL.doFilter("deleteRowEvent", { res: delEvent, query: _this.query }, function (event) {
                    if (typeof _this.query.table === "string") {
                        _this.nSQL.triggerEvent(event.res);
                    }
                    complete(_this.query.returnEvent ? event.res : delRow.res);
                }, error);
            }).catch(error);
        }, error);
    };
    _nanoSQLQuery.prototype._getIndexValues = function (indexes, row) {
        var _this = this;
        return Object.keys(indexes).reduce(function (prev, cur) {
            var value = utilities_1.deepGet(indexes[cur].path, row);
            var type = indexes[cur].type;
            prev[cur] = indexes[cur].isArray ? (Array.isArray(value) ? value : []).map(function (v) { return _this.nSQL.indexTypes[type](v); }) : _this.nSQL.indexTypes[type](value);
            return prev;
        }, {});
    };
    _nanoSQLQuery.prototype._showTables = function () {
        var _this = this;
        this.progress({
            tables: Object.keys(this.nSQL._tables)
        }, 0);
        Object.keys(this.nSQL._tables).forEach(function (table, i) {
            _this.progress({ table: table }, i);
        });
        this.complete();
    };
    _nanoSQLQuery.prototype._describe = function (type) {
        var _this = this;
        if (type === void 0) { type = "table"; }
        if (typeof this.query.table !== "string") {
            this.query.state = "error";
            this.error({ error: "Can't call describe on that!", query: this.query });
            return;
        }
        if (!this.nSQL._tables[this.query.table]) {
            this.query.state = "error";
            this.error({ error: "Table " + this.query.table + " not found!", query: this.query });
            return;
        }
        switch (type) {
            case "table":
                this.nSQL._tables[this.query.table].columns.forEach(function (col, i) {
                    _this.progress(utilities_1.assign(col), i);
                });
                break;
            case "idx":
                Object.keys(this.nSQL._tables[this.query.table].indexes).forEach(function (idx, i) {
                    var index = _this.nSQL._tables[_this.query.table].indexes[idx];
                    _this.progress(utilities_1.assign(index), i);
                });
                break;
        }
        this.complete();
    };
    _nanoSQLQuery.prototype._combineRows = function (rData) {
        return Object.keys(rData).reduce(function (prev, cur) {
            var row = rData[cur];
            if (!row)
                return prev;
            Object.keys(row).forEach(function (k) {
                prev[cur + "." + k] = row[k];
            });
            return prev;
        }, {});
    };
    _nanoSQLQuery.prototype._streamAS = function (row) {
        var _this = this;
        var distinctArgs = (this.query.distinct || []).map(function (s) { return ({ isFn: false, value: s }); });
        var selectArgs = (this._selectArgs || []).concat(distinctArgs);
        if (selectArgs.length) {
            var result_1 = {};
            selectArgs.forEach(function (arg) {
                if (arg.isFn) {
                    result_1[arg.as || arg.value] = utilities_1.execFunction(_this.query, arg.value, row, {}).result;
                }
                else {
                    result_1[arg.as || arg.value] = utilities_1.deepGet(arg.value, row);
                }
            });
            return this.query.join ? this._combineRows(result_1) : result_1;
        }
        return this.query.join ? this._combineRows(row) : row;
    };
    _nanoSQLQuery.prototype._orderByRows = function (a, b) {
        return this._sortObj(a, b, this._orderBy);
    };
    /**
     * Get the sort direction for two objects given the objects, columns and resolve paths.
     *
     * @internal
     * @param {*} objA
     * @param {*} objB
     * @param nanoSQLSortBy columns
     * @param {boolean} resolvePaths
     * @returns {number}
     * @memberof _MutateSelection
     */
    _nanoSQLQuery.prototype._sortObj = function (objA, objB, columns) {
        var _this = this;
        var id = typeof this.query.table === "string" ? this.nSQL._tables[this.query.table].pkCol : [];
        var A_id = id.length ? utilities_1.deepGet(id, objA) : false;
        var B_id = id.length ? utilities_1.deepGet(id, objB) : false;
        return columns.sort.reduce(function (prev, cur) {
            var A = cur.fn ? utilities_1.execFunction(_this.query, cur.fn, objA, { result: undefined }).result : utilities_1.deepGet(cur.path, objA);
            var B = cur.fn ? utilities_1.execFunction(_this.query, cur.fn, objB, { result: undefined }).result : utilities_1.deepGet(cur.path, objB);
            if (!prev) {
                if (A === B)
                    return A_id === B_id ? 0 : (A_id > B_id ? 1 : -1);
                return (A > B ? 1 : -1) * (cur.dir === "DESC" ? -1 : 1);
            }
            else {
                return prev;
            }
        }, 0);
    };
    _nanoSQLQuery.prototype._tableID = function () {
        return [0, 1].map(function () {
            var id = utilities_1.random16Bits().toString(16);
            while (id.length < 4) {
                id = "0" + id;
            }
            return id;
        }).join("-");
    };
    _nanoSQLQuery.prototype._createTable = function (table, alterTable, complete, error) {
        var _this = this;
        var tableID = this.nSQL._tableIds[this.query.table] || this._tableID();
        // table already exists, set to alter table query
        if (!alterTable && Object.keys(this.nSQL._tables).indexOf(table.name) !== -1) {
            alterTable = true;
        }
        new Promise(function (res, rej) {
            var hasError = false;
            var l = table.name;
            if (!table._internal && (l.indexOf("_") === 0 || l.match(/\s/g) !== null || l.match(/[\(\)\]\[\.]/g) !== null)) {
                rej({ error: "Invalid Table Name " + table.name + "! https://docs.nanosql.io/setup/data-models", query: _this.query });
                return;
            }
            Object.keys(table.model).forEach(function (col) {
                var modelData = col.replace(/\s+/g, "-").split(":"); // [key, type];
                if (modelData.length === 1) {
                    modelData.push("any");
                }
                if (!modelData[0] || modelData[0].match(/[\(\)\]\[\.]/g) !== null || modelData[0].indexOf("_") === 0) {
                    hasError = true;
                    rej({ error: "Invalid Data Model at " + (table.name + "." + col) + "! https://docs.nanosql.io/setup/data-models", query: _this.query });
                }
            });
            if (hasError)
                return;
            res();
        }).then(function () {
            return new Promise(function (res, rej) {
                _this.nSQL.doFilter("configTable", { res: table, query: _this.query }, res, rej);
            });
        }).then(function (table) {
            var setModels = function (dataModel, level) {
                var model = {};
                if (typeof dataModel === "string") {
                    var foundModel_1 = false;
                    var isArray = dataModel.indexOf("[]") !== -1;
                    var type_1 = dataModel.replace(/\[\]/gmi, "");
                    if (level === 0 && isArray) {
                        throw new Error("Can't use array types as table definition.");
                    }
                    model = Object.keys(_this.nSQL.config.types || {}).reduce(function (prev, cur) {
                        if (cur === type_1[1]) {
                            foundModel_1 = true;
                            return (_this.nSQL.config.types || {})[cur];
                        }
                        return prev;
                    }, {});
                    if (foundModel_1 === false) {
                        if (level === 0) {
                            throw new Error("Type " + dataModel + " not found!");
                        }
                        return undefined;
                    }
                }
                else {
                    model = dataModel;
                }
                return Object.keys(dataModel).reduce(function (p, d) {
                    var type = d.split(":")[1] || "any";
                    if (type.indexOf("geo") === 0) {
                        p[d] = {
                            default: { lat: 0, lon: 0 },
                            model: {
                                "lat:float": { max: 90, min: -90 },
                                "lon:float": { max: 180, min: -180 }
                            }
                        };
                    }
                    else if (dataModel[d].model) {
                        p[d] = __assign({}, dataModel[d], { model: setModels(dataModel[d].model, level + 1) });
                    }
                    else {
                        p[d] = dataModel[d];
                    }
                    return p;
                }, {});
            };
            var generateColumns = function (dataModels) {
                return Object.keys(dataModels).filter(function (d) { return d !== "*"; }).map(function (d) { return ({
                    key: d.split(":")[0],
                    type: d.split(":")[1] || "any",
                    ai: dataModels[d].ai,
                    pk: dataModels[d].pk,
                    default: dataModels[d].default,
                    notNull: dataModels[d].notNull,
                    max: dataModels[d].max,
                    min: dataModels[d].min,
                    model: dataModels[d].model ? generateColumns(dataModels[d].model) : undefined
                }); });
            };
            var error = "";
            var computedDataModel = setModels(table.res.model, 0);
            var pkType = function (model) {
                if (typeof model === "string")
                    return "";
                return Object.keys(model).reduce(function (p, c) {
                    if (model[c] && model[c].pk) {
                        return c.split(":")[1];
                    }
                    if (!p.length && model[c].model)
                        return pkType(model[c].model);
                    return p;
                }, "");
            };
            var indexes = table.res.indexes || {};
            var ai = false;
            var getPK = function (path, model) {
                if (typeof model === "string")
                    return [];
                var foundPK = false;
                return Object.keys(model).reduce(function (p, c) {
                    if (model[c] && model[c].pk) {
                        foundPK = true;
                        if (model[c].ai) {
                            ai = true;
                        }
                        p.push(c.split(":")[0]);
                        return p;
                    }
                    if (!foundPK && model[c].model)
                        return getPK(path.concat([c.split(":")[0]]), model[c].model);
                    return p;
                }, path);
            };
            var tablePKType = table.res.primaryKey ? table.res.primaryKey.split(":")[1] : pkType(table.res.model);
            var newConfig = {
                id: tableID,
                name: table.res.name,
                model: computedDataModel,
                columns: generateColumns(computedDataModel),
                filter: table.res.filter,
                actions: table.res.actions || [],
                views: table.res.views || [],
                queries: (table.res.queries || []).reduce(function (prev, query) {
                    prev[query.name] = query;
                    return prev;
                }, {}),
                indexes: Object.keys(indexes).map(function (i) { return ({
                    id: utilities_1.resolvePath(i.split(":")[0]).join("."),
                    type: (i.split(":")[1] || "string").replace(/\[\]/gmi, ""),
                    isArray: (i.split(":")[1] || "string").indexOf("[]") !== -1,
                    path: utilities_1.resolvePath(i.split(":")[0]),
                    props: indexes[i]
                }); }).reduce(function (p, c) {
                    var allowedTypes = Object.keys(_this.nSQL.indexTypes);
                    if (allowedTypes.indexOf(c.type) === -1) {
                        error = "Index \"" + c.id + "\" does not have a valid type!";
                        return p;
                    }
                    if (c.type.indexOf("geo") !== -1) {
                        p[c.id + ".lon"] = {
                            id: c.id + ".lon",
                            type: "float",
                            isArray: false,
                            path: c.path.concat(["lon"]),
                            props: { offset: 180 }
                        };
                        p[c.id + ".lat"] = {
                            id: c.id + ".lat",
                            type: "float",
                            isArray: false,
                            path: c.path.concat(["lat"]),
                            props: { offset: 90 }
                        };
                    }
                    else {
                        p[c.id] = c;
                    }
                    return p;
                }, {}),
                pkType: tablePKType,
                pkCol: table.res.primaryKey ? utilities_1.resolvePath(table.res.primaryKey.split(":")[0]) : getPK([], table.res.model),
                isPkNum: ["number", "int", "float"].indexOf(tablePKType) !== -1,
                ai: ai
            };
            // no primary key found, set one
            if (newConfig.pkCol.length === 0) {
                newConfig.pkCol = ["_id"];
                newConfig.pkType = "uuid";
                newConfig.model["_id:uuid"] = { pk: true };
                newConfig.columns = generateColumns(setModels(newConfig.model, 0));
            }
            if (error && error.length)
                return Promise.reject(error);
            return new Promise(function (res, rej) {
                _this.nSQL.doFilter("configTableSystem", { res: newConfig, query: _this.query }, function (result) {
                    res(result.res);
                }, rej);
            });
        }).then(function (newConfig) {
            var oldIndexes = alterTable ? Object.keys(_this.nSQL._tables[_this.query.table].indexes) : [];
            var newIndexes = Object.keys(newConfig.indexes);
            var addIndexes = newIndexes.filter(function (v) { return oldIndexes.indexOf(v) === -1; });
            var addTables = [newConfig.name].concat(addIndexes);
            return utilities_1.chainAsync(addTables, function (tableOrIndexName, i, next, err) {
                if (i === 0) { // table
                    var newTable_1 = { name: tableOrIndexName, conf: newConfig };
                    _this.nSQL._tableIds[newTable_1.name] = newConfig.id;
                    if (alterTable) {
                        delete _this.nSQL._tableIds[_this.query.table];
                        var removeIndexes = oldIndexes.filter(function (v) { return newIndexes.indexOf(v) === -1; });
                        utilities_1.allAsync(removeIndexes, function (indexName, i, nextIndex, indexError) {
                            utilities_1.adapterFilters(_this.nSQL, _this.query).deleteIndex(tableOrIndexName, indexName, function () {
                                nextIndex(null);
                            }, indexError);
                        }).then(function () {
                            _this.nSQL._tables[newTable_1.name] = newTable_1.conf;
                            next(null);
                        }).catch(err);
                    }
                    else {
                        utilities_1.adapterFilters(_this.nSQL, _this.query).createTable(newTable_1.name, newTable_1.conf, function () {
                            _this.nSQL._tables[newTable_1.name] = newTable_1.conf;
                            next(null);
                        }, err);
                    }
                }
                else { // indexes
                    var index = newConfig.indexes[tableOrIndexName];
                    exports.secondaryIndexQueue[_this.nSQL.state.id + index.id] = new utilities_1._nanoSQLQueue();
                    utilities_1.adapterFilters(_this.nSQL, _this.query).createIndex(newConfig.name, index.id, index.type, function () {
                        next(null);
                    }, err);
                }
            });
        }).then(function () {
            _this.nSQL._rebuildFKs();
            if (_this.query.table === "_util") {
                return Promise.resolve();
            }
            return _this.nSQL._saveTableIds();
        }).then(function () {
            complete();
        }).catch(error);
    };
    _nanoSQLQuery.prototype._dropTable = function (table, complete, error) {
        var _this = this;
        var tablesToDrop = [table];
        Object.keys(this.nSQL._tables[table].indexes).forEach(function (indexName) {
            tablesToDrop.push(indexName);
        });
        new Promise(function (res, rej) {
            if (_this.nSQL._fkRels[table] && _this.nSQL._fkRels[table].length) {
                utilities_1.allAsync(_this.nSQL._fkRels[table], function (fkRestraint, i, next, err) {
                    switch (fkRestraint.onDelete) {
                        case interfaces_1.InanoSQLFKActions.RESTRICT: // see if any rows are connected
                            var count_3 = 0;
                            utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "offset", 0, 1, false, function (key, id) {
                                count_3++;
                            }, function () {
                                if (count_3 > 0) {
                                    err("Foreign key restraint error, can't drop!");
                                }
                                else {
                                    next();
                                }
                            }, err);
                            break;
                        case interfaces_1.InanoSQLFKActions.CASCADE:
                            var deleteIDs_2 = [];
                            utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "all", 0, 0, false, function (key, id) {
                                deleteIDs_2.push(key);
                            }, function () {
                                _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, fkRestraint.childTable, "delete"), { where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs_2] }), utilities_1.noop, next, err);
                            }, err);
                            break;
                        case interfaces_1.InanoSQLFKActions.SET_NULL:
                            var setIDs_2 = [];
                            utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "all", 0, 0, false, function (key, id) {
                                setIDs_2.push(key);
                            }, function () {
                                var _a;
                                _this.nSQL.triggerQuery(__assign({}, utilities_1.buildQuery(_this.nSQL, fkRestraint.childTable, "upsert"), { actionArgs: (_a = {},
                                        _a[fkRestraint.childPath.join(".")] = null,
                                        _a), where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs_2] }), utilities_1.noop, next, err);
                            }, err);
                            break;
                        default:
                            next();
                    }
                }).then(res).catch(rej);
            }
            else {
                res();
            }
        }).then(function () {
            return utilities_1.allAsync(tablesToDrop, function (dropTable, i, next, err) {
                if (i === 0) {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).dropTable(dropTable, function () {
                        delete _this.nSQL._tables[dropTable];
                        delete _this.nSQL._tableIds[dropTable];
                        _this.nSQL._saveTableIds().then(function () {
                            next(dropTable);
                        }).catch(err);
                    }, err);
                }
                else {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).deleteIndex(table, dropTable, next, err);
                }
            }).then(function () {
                complete();
            });
        }).catch(error);
    };
    _nanoSQLQuery.prototype._onError = function (err) {
        this.query.state = "error";
        this.error(err);
    };
    _nanoSQLQuery.prototype._resolveFastWhere = function (onlyGetPKs, fastWhere, isReversed, onRow, complete) {
        var _this = this;
        // function
        if (fastWhere.index && fastWhere.parsedFn) {
            this.nSQL.functions[fastWhere.parsedFn.name].queryIndex(this.query, fastWhere, onlyGetPKs, onRow, complete, this._onError);
            return;
        }
        // primary key or secondary index
        var isPKquery = fastWhere.index === "_pk_";
        var pkCol = this.nSQL._tables[this.query.table].pkCol;
        // const indexTable = `_idx_${this.nSQL.tableIds[this.query.table as string]}_${fastWhere.index}`;
        var count = 0;
        var indexBuffer = new utilities_1._nanoSQLQueue(function (pkOrRow, i, finished, err) {
            if (!pkOrRow) {
                finished();
                return;
            }
            if (isPKquery) { // primary key select
                onRow(onlyGetPKs ? utilities_1.deepGet(pkCol, pkOrRow) : pkOrRow, 0);
                finished();
            }
            else { // secondary index
                if (onlyGetPKs) {
                    onRow(pkOrRow, count);
                    count++;
                    finished();
                }
                else {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).read(_this.query.table, pkOrRow, function (row) {
                        if (row) {
                            onRow(row, count);
                        }
                        count++;
                        finished();
                    }, _this.error);
                }
            }
        }, this._onError, complete);
        if (fastWhere.indexArray) {
            // Primary keys cannot be array indexes
            switch (fastWhere.comp) {
                case "INCLUDES":
                    var pks = [];
                    utilities_1.adapterFilters(this.nSQL, this.query).readIndexKey(this.query.table, fastWhere.index, fastWhere.value, function (pk) {
                        indexBuffer.newItem(pk);
                    }, function () {
                        indexBuffer.finished();
                    }, this.error);
                    break;
                case "INTERSECT ALL":
                case "INTERSECT":
                    var PKS_1 = {};
                    var maxI_1 = 0;
                    utilities_1.allAsync((fastWhere.value || []), function (pk, j, next) {
                        utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(_this.query.table, fastWhere.index, pk, function (rowPK) {
                            maxI_1 = j + 1;
                            if (rowPK) {
                                PKS_1[rowPK] = (PKS_1[rowPK] || 0) + 1;
                            }
                        }, function () {
                            next(null);
                        }, _this.error);
                    }).then(function () {
                        var getPKS = fastWhere.comp === "INTERSECT" ? Object.keys(PKS_1) : Object.keys(PKS_1).filter(function (k) { return PKS_1[k] === maxI_1; });
                        getPKS.forEach(function (pk) {
                            indexBuffer.newItem(pk);
                        });
                        indexBuffer.finished();
                    });
                    break;
            }
        }
        else {
            switch (fastWhere.comp) {
                case "=":
                    if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                        onRow(fastWhere.value, 0);
                        complete();
                    }
                    else {
                        if (isPKquery) {
                            utilities_1.adapterFilters(this.nSQL, this.query).read(this.query.table, fastWhere.value, function (row) {
                                indexBuffer.newItem(row);
                                indexBuffer.finished();
                            }, this.error);
                        }
                        else {
                            utilities_1.adapterFilters(this.nSQL, this.query).readIndexKey(this.query.table, fastWhere.index, fastWhere.value, function (readPK) {
                                indexBuffer.newItem(readPK);
                            }, function () {
                                indexBuffer.finished();
                            }, this.error);
                        }
                    }
                    break;
                case "BETWEEN":
                    if (isPKquery) {
                        utilities_1.adapterFilters(this.nSQL, this.query).readMulti(this.query.table, "range", fastWhere.value[0], fastWhere.value[1], isReversed, function (row, i) {
                            indexBuffer.newItem(row);
                        }, function () {
                            indexBuffer.finished();
                        }, this._onError);
                    }
                    else {
                        utilities_1.adapterFilters(this.nSQL, this.query).readIndexKeys(this.query.table, fastWhere.index, "range", fastWhere.value[0], fastWhere.value[1], isReversed, function (row) {
                            indexBuffer.newItem(row);
                        }, function () {
                            indexBuffer.finished();
                        }, this._onError);
                    }
                    break;
                case "IN":
                    var PKS = (isReversed ? fastWhere.value.sort(function (a, b) { return a < b ? 1 : -1; }) : fastWhere.value.sort(function (a, b) { return a > b ? 1 : -1; }));
                    if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                        PKS.forEach(function (pk, i) { return onRow(pk, i); });
                        complete();
                    }
                    else {
                        utilities_1.allAsync(PKS, function (pkRead, ii, nextPK) {
                            if (isPKquery) {
                                utilities_1.adapterFilters(_this.nSQL, _this.query).read(_this.query.table, pkRead, function (row) {
                                    indexBuffer.newItem(row);
                                    nextPK();
                                }, _this.error);
                            }
                            else {
                                utilities_1.adapterFilters(_this.nSQL, _this.query).readIndexKey(_this.query.table, fastWhere.index, pkRead, function (readPK) {
                                    indexBuffer.newItem(readPK);
                                }, function () {
                                    nextPK();
                                }, _this.error);
                            }
                        }).then(function () {
                            indexBuffer.finished();
                        });
                    }
            }
        }
    };
    _nanoSQLQuery.prototype._fastQuery = function (onRow, complete) {
        var _this = this;
        if (this._whereArgs.fastWhere) {
            if (this._whereArgs.fastWhere.length === 1) { // single where
                var fastWhere = this._whereArgs.fastWhere[0];
                var isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";
                this._resolveFastWhere(false, fastWhere, isReversed, function (row, i) {
                    onRow(row, i);
                }, complete);
            }
            else { // multiple conditions
                var indexBuffer_1 = {};
                var maxI_2 = 0;
                utilities_1.chainAsync(this._whereArgs.fastWhere, function (fastWhere, i, next) {
                    if (i % 2 === 1) { // should be AND
                        next();
                        return;
                    }
                    maxI_2 = i;
                    var addIndexBuffer = function (pk) {
                        indexBuffer_1[pk] = (indexBuffer_1[pk] || 0) + 1;
                    };
                    _this._resolveFastWhere(true, fastWhere, false, addIndexBuffer, next);
                }).then(function () {
                    var getPKs = [];
                    Object.keys(indexBuffer_1).forEach(function (PK) {
                        if (indexBuffer_1[PK] === maxI_2) {
                            getPKs.push(PK);
                        }
                    });
                    _this._resolveFastWhere(false, {
                        index: "_pk_",
                        col: _this.nSQL._tables[_this.query.table].pkCol.join("."),
                        comp: "IN",
                        value: getPKs
                    }, false, onRow, complete);
                });
            }
        }
    };
    _nanoSQLQuery.prototype._getRecords = function (onRow, complete, error) {
        var _this = this;
        var scanRecords = function (rows) {
            var i = 0;
            while (i < rows.length) {
                if (_this._whereArgs.type !== interfaces_1.IWhereType.none) {
                    if (_this._whereArgs.whereFn) {
                        if (_this._whereArgs.whereFn(rows[i], i)) {
                            onRow(rows[i], i);
                        }
                    }
                    else {
                        if (_this._where(rows[i], _this._whereArgs.slowWhere)) {
                            onRow(rows[i], i);
                        }
                    }
                }
                else {
                    onRow(rows[i], i);
                }
                i++;
            }
            complete();
        };
        if (typeof this.query.table === "string") { // pull from local table, possibly use indexes
            switch (this._whereArgs.type) {
                // primary key or secondary index select
                case interfaces_1.IWhereType.fast:
                    this._fastQuery(onRow, complete);
                    break;
                // primary key or secondary index query followed by slow query
                case interfaces_1.IWhereType.medium:
                    this._fastQuery(function (row, i) {
                        if (_this._where(row, _this._whereArgs.slowWhere)) {
                            onRow(row, i);
                        }
                    }, complete);
                    break;
                // full table scan
                case interfaces_1.IWhereType.slow:
                case interfaces_1.IWhereType.none:
                case interfaces_1.IWhereType.fn:
                    var isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";
                    utilities_1.adapterFilters(this.nSQL, this.query).readMulti(this.query.table, "all", undefined, undefined, isReversed, function (row, i) {
                        if (_this._whereArgs.type === interfaces_1.IWhereType.slow) {
                            if (_this._where(row, _this._whereArgs.slowWhere)) {
                                onRow(row, i);
                            }
                        }
                        else if (_this._whereArgs.type === interfaces_1.IWhereType.fn && _this._whereArgs.whereFn) {
                            if (_this._whereArgs.whereFn(row, i)) {
                                onRow(row, i);
                            }
                        }
                        else {
                            onRow(row, i);
                        }
                    }, function () {
                        complete();
                    }, this._onError);
                    break;
            }
        }
        else if (typeof this.query.table === "function") { // promise that returns array
            this._getTable(this.query.tableAS || utilities_1.uuid(), this.query.where, this.query.table, function (result) {
                scanRecords(result.rows);
            });
        }
        else if (Array.isArray(this.query.table)) { // array
            scanRecords(this.query.table);
        }
        else {
            error("Can't get selected table!");
        }
    };
    _nanoSQLQuery.prototype._rebuildIndexes = function (progress, complete, error) {
        var _this = this;
        var rebuildTables = this.query.table;
        if (!this.nSQL._tables[rebuildTables]) {
            error(new Error("Table " + rebuildTables + " not found for rebuilding indexes!"));
            return;
        }
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: interfaces_1.IWhereType.none };
        if (this.query.where) { // rebuild only select rows (cant clean/remove index tables)
            var readQueue_1 = new utilities_1._nanoSQLQueue(function (item, i, complete, error) {
                _this._removeRowAndIndexes(_this.nSQL._tables[rebuildTables], item, function () {
                    _this._newRow(item, complete, error);
                    progress(item, i);
                }, error);
            }, error, function () {
                complete();
            });
            this._getRecords(function (row) {
                readQueue_1.newItem(row);
            }, function () {
                readQueue_1.finished();
            }, error);
        }
        else { // empty indexes and start from scratch
            var indexes = Object.keys(this.nSQL._tables[rebuildTables].indexes);
            utilities_1.allAsync(indexes, function (indexName, j, nextIndex, indexErr) {
                utilities_1.adapterFilters(_this.nSQL, _this.query).deleteIndex(rebuildTables, indexName, function () {
                    utilities_1.adapterFilters(_this.nSQL, _this.query).createIndex(rebuildTables, indexName, _this.nSQL._tables[rebuildTables].indexes[indexName].type, function () {
                        nextIndex(null);
                    }, indexErr);
                }, indexErr);
            }).then(function () {
                // indexes are now empty
                var readQueue = new utilities_1._nanoSQLQueue(function (row, i, complete, err) {
                    var indexValues = _this._getIndexValues(_this.nSQL._tables[rebuildTables].indexes, row);
                    var rowPK = utilities_1.deepGet(_this.nSQL._tables[rebuildTables].pkCol, row);
                    utilities_1.allAsync(Object.keys(indexValues), function (indexName, jj, nextIdx, errIdx) {
                        var idxValue = indexValues[indexName];
                        _this._updateIndex(rebuildTables, indexName, idxValue, rowPK, true, function () {
                            progress(row, i);
                            nextIdx();
                        }, errIdx);
                    }).then(complete).catch(err);
                }, error, function () {
                    complete();
                });
                _this._getRecords(function (row) {
                    readQueue.newItem(row);
                }, function () {
                    readQueue.finished();
                }, error);
            }).catch(error);
        }
    };
    _nanoSQLQuery.prototype._where = function (singleRow, where) {
        if (where.length > 1) { // compound where statements
            var prevCondition = "AND";
            var matches = true;
            var idx = 0;
            while (idx < where.length) {
                var wArg = where[idx];
                if (idx % 2 === 1) {
                    prevCondition = wArg;
                }
                else {
                    var compareResult = false;
                    if (Array.isArray(wArg[0])) { // nested where
                        compareResult = this._where(singleRow, wArg);
                    }
                    else {
                        compareResult = this._compare(wArg, singleRow);
                    }
                    if (idx === 0) {
                        matches = compareResult;
                    }
                    else {
                        if (prevCondition === "AND") {
                            matches = matches && compareResult;
                        }
                        else {
                            matches = matches || compareResult;
                        }
                    }
                }
                idx++;
            }
            return matches;
        }
        else { // single where statement
            return this._compare(where[0], singleRow);
        }
    };
    _nanoSQLQuery.prototype._processLIKE = function (columnValue, givenValue) {
        if (!_nanoSQLQuery.likeCache[givenValue]) {
            var prevChar_1 = "";
            _nanoSQLQuery.likeCache[givenValue] = new RegExp(givenValue.split("").map(function (s) {
                if (prevChar_1 === "\\") {
                    prevChar_1 = s;
                    return s;
                }
                prevChar_1 = s;
                if (s === "%")
                    return ".*";
                if (s === "_")
                    return ".";
                return s;
            }).join(""), "gmi");
        }
        if (typeof columnValue !== "string") {
            if (typeof columnValue === "number") {
                return String(columnValue).match(_nanoSQLQuery.likeCache[givenValue]) !== null;
            }
            else {
                return JSON.stringify(columnValue).match(_nanoSQLQuery.likeCache[givenValue]) !== null;
            }
        }
        return columnValue.match(_nanoSQLQuery.likeCache[givenValue]) !== null;
    };
    _nanoSQLQuery.prototype._getColValue = function (where, wholeRow) {
        if (where.fnString) {
            return utilities_1.execFunction(this.query, where.fnString, wholeRow, { result: undefined }).result;
        }
        else {
            return utilities_1.deepGet(where.col, wholeRow);
        }
    };
    /**
     * Compare function used by WHERE to determine if a given value matches a given condition.
     *
     * Accepts single where arguments (compound arguments not allowed).
     *
     *
     * @param {*} val1
     * @param {string} compare
     * @param {*} val2
     * @returns {boolean}
     */
    _nanoSQLQuery.prototype._compare = function (where, wholeRow) {
        var columnValue = this._getColValue(where, wholeRow);
        var givenValue = where.value;
        var compare = where.comp;
        if (givenValue === "NULL" || givenValue === "NOT NULL") {
            var isNull = [undefined, null, ""].indexOf(columnValue) !== -1;
            var isEqual = compare === "=" || compare === "LIKE";
            switch (givenValue) {
                case "NULL": return isEqual ? isNull : !isNull;
                case "NOT NULL": return isEqual ? !isNull : isNull;
            }
        }
        if (["IN", "NOT IN", "BETWEEN", "INTERSECT", "INTERSECT ALL", "NOT INTERSECT"].indexOf(compare) !== -1) {
            if (!Array.isArray(givenValue)) {
                this.query.state = "error";
                this.query.error("WHERE \"" + compare + "\" comparison requires an array value!");
                return false;
            }
        }
        switch (compare) {
            // if column equal to given value. Supports arrays, objects and primitives
            case "=": return utilities_1.objectsEqual(givenValue, columnValue);
            // if column not equal to given value. Supports arrays, objects and primitives
            case "!=": return !utilities_1.objectsEqual(givenValue, columnValue);
            // if column greather than given value
            case ">": return columnValue > givenValue;
            // if column less than given value
            case "<": return columnValue < givenValue;
            // if column less than or equal to given value
            case "<=": return columnValue <= givenValue;
            // if column greater than or equal to given value
            case ">=": return columnValue >= givenValue;
            // if column value exists in given array
            case "IN": return givenValue.indexOf(columnValue) !== -1;
            // if column does not exist in given array
            case "NOT IN": return givenValue.indexOf(columnValue) === -1;
            // regexp search the column
            case "REGEXP":
            case "REGEX": return (columnValue || "").match(givenValue) !== null;
            // if given value exists in column value
            case "LIKE": return this._processLIKE((columnValue || ""), givenValue);
            // if given value does not exist in column value
            case "NOT LIKE": return !this._processLIKE((columnValue || ""), givenValue);
            // if the column value is between two given numbers
            case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] >= columnValue;
            // if the column value is not between two given numbers
            case "NOT BETWEEN": return givenValue[0] >= columnValue || givenValue[1] <= columnValue;
            // if single value exists in array column
            case "INCLUDES": return (columnValue || []).indexOf(givenValue) !== -1;
            // if single value does not exist in array column
            case "NOT INCLUDES": return (columnValue || []).indexOf(givenValue) === -1;
            // if array of values intersects with array column
            case "INTERSECT": return (columnValue || []).filter(function (l) { return givenValue.indexOf(l) > -1; }).length > 0;
            // if every value in the provided array exists in the array column
            case "INTERSECT ALL": return (columnValue || []).filter(function (l) { return givenValue.indexOf(l) > -1; }).length === givenValue.length;
            // if array of values does not intersect with array column
            case "NOT INTERSECT": return (columnValue || []).filter(function (l) { return givenValue.indexOf(l) > -1; }).length === 0;
            default: return false;
        }
    };
    _nanoSQLQuery.prototype._parseSort = function (sort, checkforIndexes) {
        var key = ((sort && sort.length ? utilities_1.hash(JSON.stringify(sort)) : "") + this.nSQL.state.cacheId) + this.nSQL.state.cacheId;
        if (!key)
            return { sort: [], index: "" };
        if (_nanoSQLQuery._sortMemoized[key])
            return _nanoSQLQuery._sortMemoized[key];
        var isThereFn = false;
        var result = sort.map(function (o) { return o.split(" ").map(function (s) { return s.trim(); }); }).reduce(function (p, c) {
            var hasFn = c[0].indexOf("(") !== -1;
            if (hasFn) {
                isThereFn = true;
            }
            /*
            const fnArgs: string[] = hasFn ? c[0].split("(")[1].replace(")", "").split(",").map(v => v.trim()).filter(a => a) : [];
            const fnName = hasFn ? c[0].split("(")[0].trim().toUpperCase() : undefined;
            if (fnName && !this.nSQL.functions[fnName]) {
                this.query.state = "error";
                this.error(`Function "${fnName}" not found!`);
            }*/
            p.push({
                path: hasFn ? [] : utilities_1.resolvePath(c[0]),
                fn: hasFn ? c[0] : undefined,
                dir: (c[1] || "asc").toUpperCase()
            });
            return p;
        }, []);
        var index = "";
        if (checkforIndexes && isThereFn === false && result.length === 1) {
            var pkKey = typeof this.query.table === "string" ? this.nSQL._tables[this.query.table].pkCol : [];
            if (result[0].path[0].length && utilities_1.objectsEqual(result[0].path, pkKey)) {
                index = "_pk_";
            }
            else {
                var indexKeys = Object.keys(this.nSQL._tables[this.query.table].indexes);
                var i = indexKeys.length;
                while (i-- && !index) {
                    if (utilities_1.objectsEqual(this.nSQL._tables[this.query.table].indexes[indexKeys[i]], result[0].path)) {
                        index = this.nSQL._tables[this.query.table].indexes[indexKeys[i]].id;
                    }
                }
            }
        }
        _nanoSQLQuery._sortMemoized[key] = {
            sort: result,
            index: index
        };
        return _nanoSQLQuery._sortMemoized[key];
    };
    _nanoSQLQuery.prototype._parseSelect = function () {
        var _this = this;
        var selectArgsKey = (this.query.actionArgs && this.query.actionArgs.length ? JSON.stringify(this.query.actionArgs) : "") + this.nSQL.state.cacheId;
        this._orderBy = this._parseSort(this.query.orderBy || [], typeof this.query.table === "string");
        this._groupBy = this._parseSort(this.query.groupBy || [], false);
        if (selectArgsKey) {
            if (_nanoSQLQuery._selectArgsMemoized[selectArgsKey]) {
                this._hasAggrFn = _nanoSQLQuery._selectArgsMemoized[selectArgsKey].hasAggrFn;
                this._selectArgs = _nanoSQLQuery._selectArgsMemoized[selectArgsKey].args;
            }
            else {
                (this.query.actionArgs || []).forEach(function (val) {
                    var splitVal = val.split(/\s+as\s+/i).map(function (s) { return s.trim(); });
                    if (splitVal[0].indexOf("(") !== -1) {
                        // const fnArgs = splitVal[0].split("(")[1].replace(")", "").split(",").map(v => v.trim());
                        var fnName = splitVal[0].split("(")[0].trim().toUpperCase();
                        _this._selectArgs.push({ isFn: true, value: splitVal[0], as: splitVal[1], args: undefined });
                        if (!_this.nSQL.functions[fnName]) {
                            _this.query.state = "error";
                            _this.error("Function \"" + fnName + "\" not found!");
                        }
                        else {
                            if (_this.nSQL.functions[fnName].type === "A") {
                                _this._hasAggrFn = true;
                            }
                        }
                    }
                    else {
                        _this._selectArgs.push({ isFn: false, value: splitVal[0], as: splitVal[1] });
                    }
                });
                if (this.query.state !== "error") {
                    _nanoSQLQuery._selectArgsMemoized[selectArgsKey] = { hasAggrFn: this._hasAggrFn, args: this._selectArgs };
                }
            }
        }
        else {
            this._selectArgs = [];
        }
        var canUseOrderByIndex = false;
        if (this._whereArgs.type === interfaces_1.IWhereType.none) {
            canUseOrderByIndex = this._orderBy.index === "_pk_";
            if (canUseOrderByIndex) {
                this._pkOrderBy = true;
            }
        }
        else {
            canUseOrderByIndex = this._orderBy.index.length && this._whereArgs.fastWhere && utilities_1.objectsEqual(this._whereArgs.fastWhere[0].col, this._orderBy.sort[0].path) ? true : false;
            if (canUseOrderByIndex) {
                this._idxOrderBy = true;
            }
        }
        if ((this._orderBy.sort.length && !canUseOrderByIndex) || this._groupBy.sort.length || this._hasAggrFn) {
            this._stream = false;
        }
    };
    _nanoSQLQuery.prototype._parseWhere = function (qWhere, ignoreIndexes) {
        var _this = this;
        var where = qWhere || [];
        var key = (JSON.stringify(where, function (key, value) {
            return value && value.constructor && value.constructor.name === "RegExp" ? value.toString() : value;
        }) + (ignoreIndexes ? "0" : "1")) + this.nSQL.state.cacheId;
        if (_nanoSQLQuery._whereMemoized[key]) {
            return _nanoSQLQuery._whereMemoized[key];
        }
        if (typeof where === "function") {
            return { type: interfaces_1.IWhereType.fn, whereFn: where };
        }
        else if (!where.length) {
            _nanoSQLQuery._whereMemoized[key] = { type: interfaces_1.IWhereType.none };
            return _nanoSQLQuery._whereMemoized[key];
        }
        var indexes = typeof this.query.table === "string" ? Object.keys(this.nSQL._tables[this.query.table].indexes).map(function (k) { return _this.nSQL._tables[_this.query.table].indexes[k]; }) : [];
        var pkKey = typeof this.query.table === "string" ? this.nSQL._tables[this.query.table].pkCol : [];
        // find indexes and functions
        var recursiveParse = function (ww, level) {
            var doIndex = !ignoreIndexes && level === 0;
            return ww.reduce(function (p, w, i) {
                if (i % 2 === 1) { // AND or OR
                    if (typeof w !== "string") {
                        _this.query.state = "error";
                        _this.error("Malformed WHERE statement!");
                        return p;
                    }
                    p.push(w);
                    return p;
                }
                else { // where conditions
                    if (!Array.isArray(w)) {
                        _this.query.state = "error";
                        _this.error("Malformed WHERE statement!");
                        return p;
                    }
                    if (Array.isArray(w[0])) { // nested array
                        p.push(recursiveParse(w, level + 1));
                    }
                    else if (w[0].indexOf("(") !== -1) { // function
                        var fnArgs = w[0].split("(")[1].replace(")", "").split(",").map(function (v) { return v.trim(); }).filter(function (a) { return a; });
                        var fnName = w[0].split("(")[0].trim().toUpperCase();
                        var hasIndex = false;
                        if (!_this.nSQL.functions[fnName]) {
                            _this.query.state = "error";
                            _this.error("Function \"" + fnName + "\" not found!");
                            return p;
                        }
                        if (doIndex && _this.nSQL.functions[fnName] && _this.nSQL.functions[fnName].checkIndex) {
                            var indexFn = _this.nSQL.functions[fnName].checkIndex(_this.query, fnArgs, w);
                            if (indexFn) {
                                _this._indexesUsed.push(utilities_1.assign(w));
                                hasIndex = true;
                                p.push(indexFn);
                            }
                        }
                        if (!hasIndex) {
                            p.push({
                                fnString: w[0],
                                parsedFn: { name: fnName, args: fnArgs },
                                comp: w[1],
                                value: w[2]
                            });
                        }
                    }
                    else { // column select
                        var isIndexCol_1 = false;
                        var path_1 = doIndex ? utilities_1.resolvePath(w[0]) : [];
                        if (["=", "BETWEEN", "IN"].indexOf(w[1]) !== -1 && doIndex) {
                            // primary key select
                            if (utilities_1.objectsEqual(path_1, pkKey)) {
                                isIndexCol_1 = true;
                                _this._indexesUsed.push(utilities_1.assign(w));
                                p.push({
                                    index: "_pk_",
                                    col: w[0],
                                    comp: w[1],
                                    value: w[2]
                                });
                            }
                            else { // check if we can use any index
                                indexes.forEach(function (index) {
                                    if (isIndexCol_1 === false && utilities_1.objectsEqual(index.path, path_1) && index.isArray === false) {
                                        isIndexCol_1 = true;
                                        _this._indexesUsed.push(utilities_1.assign(w));
                                        p.push({
                                            index: index.id,
                                            col: w[0],
                                            comp: w[1],
                                            value: w[2]
                                        });
                                    }
                                });
                            }
                        }
                        if (doIndex && !isIndexCol_1 && ["INCLUDES", "INTERSECT", "INTERSECT ALL"].indexOf(w[1]) !== -1) {
                            indexes.forEach(function (index) {
                                if (utilities_1.objectsEqual(index.path, path_1) && index.isArray === true) {
                                    isIndexCol_1 = true;
                                    _this._indexesUsed.push(utilities_1.assign(w));
                                    p.push({
                                        index: index.id,
                                        indexArray: true,
                                        col: w[0],
                                        comp: w[1],
                                        value: w[2]
                                    });
                                }
                            });
                        }
                        if (!isIndexCol_1) {
                            p.push({
                                col: w[0],
                                comp: w[1],
                                value: w[2]
                            });
                        }
                    }
                    return p;
                }
            }, []);
        };
        var parsedWhere = recursiveParse(typeof where[0] === "string" ? [where] : where, 0);
        // discover where we have indexes we can use
        // the rest is a full table scan OR a scan of the index results
        // fastWhere = index query, slowWhere = row by row/full table scan
        var isIndex = true;
        var count = 0;
        var lastFastIndx = -1;
        while (count < parsedWhere.length && isIndex) {
            if (count % 2 === 1) {
                if (parsedWhere[count] !== "AND") {
                    isIndex = false;
                }
                else {
                    lastFastIndx = count;
                }
            }
            else {
                if (Array.isArray(parsedWhere[count]) || !parsedWhere[count].index) {
                    isIndex = false;
                }
                else {
                    lastFastIndx = count;
                }
            }
            count++;
        }
        // make sure lastFastIndx lands on an AND, OR or gets pushed off the end.
        if (lastFastIndx % 2 === 0) {
            lastFastIndx++;
        }
        // has at least some index values
        // "AND" or the end of the WHERE should follow the last index to use the indexes
        if (lastFastIndx !== -1 && (parsedWhere[lastFastIndx] === "AND" || !parsedWhere[lastFastIndx])) {
            var slowWhere = parsedWhere.slice(lastFastIndx + 1);
            _nanoSQLQuery._whereMemoized[key] = {
                type: slowWhere.length ? interfaces_1.IWhereType.medium : interfaces_1.IWhereType.fast,
                slowWhere: slowWhere,
                fastWhere: parsedWhere.slice(0, lastFastIndx)
            };
        }
        else {
            _nanoSQLQuery._whereMemoized[key] = {
                type: interfaces_1.IWhereType.slow,
                slowWhere: parsedWhere
            };
        }
        return _nanoSQLQuery._whereMemoized[key];
    };
    _nanoSQLQuery.likeCache = {};
    _nanoSQLQuery._sortMemoized = {};
    _nanoSQLQuery._selectArgsMemoized = {};
    _nanoSQLQuery._whereMemoized = {};
    return _nanoSQLQuery;
}());
exports._nanoSQLQuery = _nanoSQLQuery;
//# sourceMappingURL=query.js.map

/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = __webpack_require__(1);
var utilities_1 = __webpack_require__(0);
var memoryIndex_1 = __webpack_require__(2);
var SyncStorage = /** @class */ (function (_super) {
    __extends(SyncStorage, _super);
    function SyncStorage(useLS) {
        var _this = _super.call(this, true, false) || this;
        _this.useLS = useLS;
        _this.plugin = {
            name: "Sync Storage Adapter",
            version: interfaces_1.VERSION
        };
        _this._index = {};
        _this._rows = {};
        _this._ai = {};
        _this._tableConfigs = {};
        return _this;
    }
    SyncStorage.prototype.connect = function (id, complete, error) {
        this._id = id;
        complete();
    };
    SyncStorage.prototype.createTable = function (tableName, tableData, complete, error) {
        this._index[tableName] = [];
        this._rows[tableName] = {};
        this._tableConfigs[tableName] = tableData;
        if (this.useLS) {
            var index = localStorage.getItem(this._id + "->" + tableName + "_idx");
            if (index) {
                this._index[tableName] = JSON.parse(index);
                this._ai[tableName] = parseFloat(localStorage.getItem(this._id + "->" + tableName + "_ai") || "0");
            }
        }
        complete();
    };
    SyncStorage.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        this._index[table].forEach(function (pk) {
            if (_this.useLS) {
                localStorage.removeItem(_this._id + "->" + table + "__" + pk);
            }
            else {
                delete _this._rows[table][pk];
            }
        });
        if (this.useLS) {
            localStorage.removeItem(this._id + "->" + table + "_idx");
        }
        delete this._index[table];
        delete this._rows[table];
        complete();
    };
    SyncStorage.prototype.disconnect = function (complete, error) {
        complete();
    };
    SyncStorage.prototype.write = function (table, pk, row, complete, error) {
        pk = pk || utilities_1.generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);
        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }
        if (this._tableConfigs[table].ai) {
            this._ai[table] = Math.max(this._ai[table] || 0, pk);
        }
        if (this._index[table].indexOf(pk) === -1) {
            var loc = utilities_1.binarySearch(this._index[table], pk, false);
            this._index[table].splice(loc, 0, pk);
            if (this.useLS) {
                localStorage.setItem(this._id + "->" + table + "_idx", JSON.stringify(this._index[table]));
                localStorage.setItem(this._id + "->" + table + "_ai", String(this._ai[table]));
            }
        }
        utilities_1.deepSet(this._tableConfigs[table].pkCol, row, pk);
        if (this.useLS) {
            localStorage.setItem(this._id + "->" + table + "__" + pk, JSON.stringify(row));
            complete(pk);
        }
        else {
            this._rows[table][pk] = utilities_1.deepFreeze(row);
            complete(pk);
        }
    };
    SyncStorage.prototype.read = function (table, pk, complete, error) {
        if (this.useLS) {
            var item = localStorage.getItem(this._id + "->" + table + "__" + pk);
            complete(item ? JSON.parse(item) : undefined);
        }
        else {
            complete(this._rows[table][pk]);
        }
    };
    SyncStorage.prototype.delete = function (table, pk, complete, error) {
        var idx = this._index[table].indexOf(pk);
        if (idx !== -1) {
            this._index[table].splice(idx, 1);
            if (this.useLS) {
                localStorage.setItem(this._id + "->" + table + "_idx", JSON.stringify(this._index[table].keys()));
            }
        }
        if (this.useLS) {
            localStorage.removeItem(this._id + "->" + table + "__" + pk);
        }
        else {
            delete this._rows[table][pk];
        }
        complete();
    };
    SyncStorage.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var _this = this;
        var range = {
            "range": [offsetOrLow, limitOrHigh],
            "offset": [offsetOrLow, offsetOrLow + limitOrHigh],
            "all": []
        }[type];
        var idxArr = (function () {
            switch (type) {
                case "all":
                    return _this._index[table].slice();
                case "offset":
                    var l = _this._index[table].length - 1;
                    return reverse ? _this._index[table].slice(l - range[1], l - range[0]) : _this._index[table].slice(range[0], range[1]);
                case "range":
                    var lowIdx = utilities_1.binarySearch(_this._index[table], range[0], false);
                    var highIdx = utilities_1.binarySearch(_this._index[table], range[1], false);
                    while (_this._index[table][highIdx] > range[1]) {
                        highIdx--;
                    }
                    while (_this._index[table][lowIdx] < range[0]) {
                        lowIdx++;
                    }
                    return _this._index[table].slice(lowIdx, highIdx + 1);
            }
            return [];
        })();
        if (reverse) {
            idxArr.reverse();
        }
        idxArr.forEach(function (pk, i) {
            if (_this.useLS) {
                onRow(JSON.parse(localStorage.getItem(_this._id + "->" + table + "__" + pk) || "{}"), i);
            }
            else {
                onRow(_this._rows[table][pk], i);
            }
        });
        complete();
    };
    SyncStorage.prototype.getTableIndex = function (table, complete, error) {
        complete(this._index[table].slice());
    };
    SyncStorage.prototype.getTableIndexLength = function (table, complete, error) {
        complete(this._index[table].length);
    };
    return SyncStorage;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.SyncStorage = SyncStorage;
//# sourceMappingURL=syncStorage.js.map

/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = __webpack_require__(1);
var utilities_1 = __webpack_require__(0);
var memoryIndex_1 = __webpack_require__(2);
var IndexedDB = /** @class */ (function (_super) {
    __extends(IndexedDB, _super);
    function IndexedDB(version) {
        var _this = _super.call(this, false, false) || this;
        _this.version = version;
        _this.plugin = {
            name: "IndexedDB Adapter",
            version: interfaces_1.VERSION
        };
        _this._db = {};
        _this._ai = {};
        _this._tableConfigs = {};
        return _this;
    }
    IndexedDB.prototype.connect = function (id, complete, error) {
        this._id = id;
        complete();
    };
    IndexedDB.prototype.createTable = function (tableName, tableData, complete, error) {
        var _this = this;
        var version = 1;
        this._tableConfigs[tableName] = tableData;
        var dataModelHash = utilities_1.hash(JSON.stringify(tableData.columns));
        if (this.version) { // manually handled by developer
            version = this.version;
        }
        else { // automatically handled by nanoSQL
            version = parseInt(localStorage.getItem(this._id + "_" + tableName + "_idb_version") || "1");
            var modelHash = localStorage.getItem(this._id + "_" + tableName + "_idb_hash") || dataModelHash;
            if (modelHash !== dataModelHash) {
                version++;
            }
            localStorage.setItem(this._id + "_" + tableName + "_idb_version", String(version));
            localStorage.setItem(this._id + "_" + tableName + "_idb_hash", dataModelHash);
        }
        var idb = indexedDB.open(this._id + "_" + tableName, version);
        this._ai[tableName] = parseInt(localStorage.getItem(this._id + "_" + tableName + "_idb_ai") || "0");
        idb.onerror = error;
        var isUpgrading = false;
        // Called only when there is no existing DB, creates the tables and data store.
        idb.onupgradeneeded = function (event) {
            _this._db[tableName] = event.target.result;
            if (!_this._db[tableName].objectStoreNames.contains(tableName)) {
                _this._db[tableName].createObjectStore(tableName, { keyPath: tableData.pkCol.join(".") });
            }
        };
        // Called once the database is connected
        idb.onsuccess = function (event) {
            _this._db[tableName] = event.target.result;
            complete();
        };
    };
    IndexedDB.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        // open a read/write db transaction, ready for clearing the data
        var tx = this._db[table].transaction(table, "readwrite");
        tx.onerror = error;
        var objectStoreRequest = tx.objectStore(table).clear();
        objectStoreRequest.onerror = error;
        objectStoreRequest.onsuccess = function () {
            _this._db[table].close();
            delete _this._db[table];
            localStorage.removeItem(_this._id + "_" + table + "_idb_version");
            localStorage.removeItem(_this._id + "_" + table + "_idb_hash");
            localStorage.removeItem(_this._id + "_" + table + "_idb_ai");
            complete();
        };
    };
    IndexedDB.prototype.disconnect = function (complete, error) {
        var _this = this;
        utilities_1.allAsync(Object.keys(this._db), function (table, i, next, error) {
            _this._db[table].close();
            utilities_1.setFast(function () {
                next();
            });
        }).then(complete).catch(error);
    };
    IndexedDB.prototype.store = function (table, type, open, error) {
        var transaction = this._db[table].transaction(table, type);
        transaction.onabort = error;
        transaction.onerror = error;
        open(transaction, transaction.objectStore(table));
    };
    IndexedDB.prototype.write = function (table, pk, row, complete, error) {
        pk = pk || utilities_1.generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);
        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }
        this._ai[table] = Math.max(pk, this._ai[table]);
        if (this._tableConfigs[table].ai) {
            this._ai[table] = utilities_1.cast("int", Math.max(this._ai[table] || 0, pk));
            localStorage.setItem(this._id + "_" + table + "_idb_ai", String(this._ai[table]));
        }
        utilities_1.deepSet(this._tableConfigs[table].pkCol, row, pk);
        this.store(table, "readwrite", function (transaction, store) {
            try {
                store.put(row).onsuccess = function () {
                    complete(pk);
                };
            }
            catch (e) {
                error(e);
            }
        }, error);
    };
    IndexedDB.prototype.read = function (table, pk, complete, error) {
        this.store(table, "readonly", function (transaction, store) {
            var singleReq = store.get(pk);
            singleReq.onerror = function (err) {
                complete(undefined);
            };
            singleReq.onsuccess = function () {
                complete(singleReq.result);
            };
        }, error);
    };
    IndexedDB.prototype.delete = function (table, pk, complete, error) {
        this.store(table, "readwrite", function (transaction, store) {
            var req = store.delete(pk);
            req.onerror = error;
            req.onsuccess = function (e) {
                complete();
            };
        }, error);
    };
    IndexedDB.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var doOffset = type === "offset";
        var count = 0;
        var lowerLimit = doOffset ? offsetOrLow : 0;
        var upperLimit = lowerLimit + limitOrHigh;
        var advancing = true;
        this.store(table, "readonly", function (tr, store) {
            if (store.getAll) {
                var request = store.getAll(type !== "range" ? undefined : IDBKeyRange.bound(offsetOrLow, limitOrHigh, false, false), type === "offset" && !reverse ? limitOrHigh + offsetOrLow : undefined);
                request.onsuccess = function (event) {
                    var result = reverse ? event.target.result.reverse() : event.target.result;
                    if (type === "offset") {
                        var add = reverse ? 1 : 0;
                        result.slice(offsetOrLow + add, offsetOrLow + limitOrHigh + add).forEach(onRow);
                    }
                    else {
                        result.forEach(onRow);
                    }
                    complete();
                };
                request.onerror = error;
            }
            else {
                store.openCursor(type !== "range" ? undefined : IDBKeyRange.bound(offsetOrLow, limitOrHigh, false, false), reverse ? "prev" : "next").onsuccess = function (event) {
                    var cursor = event.target.result;
                    if (!cursor) {
                        complete();
                        return;
                    }
                    if (type === "offset") {
                        if (advancing) {
                            var lower = reverse ? lowerLimit + 1 : lowerLimit;
                            cursor.advance(lower);
                            count = lower;
                            advancing = false;
                            return;
                        }
                        if (reverse ? upperLimit >= count : upperLimit > count) {
                            onRow(cursor.value, count - offsetOrLow);
                        }
                    }
                    else {
                        onRow(cursor.value, count);
                    }
                    count++;
                    cursor.continue();
                };
            }
        }, error);
    };
    IndexedDB.prototype.getTableIndex = function (table, complete, error) {
        var _this = this;
        var index = [];
        this.store(table, "readonly", function (tr, store) {
            store.openCursor().onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    index.push(utilities_1.deepGet(_this._tableConfigs[table].pkCol, cursor.value));
                    cursor.continue();
                }
                else {
                    complete(index);
                }
            };
        }, error);
    };
    IndexedDB.prototype.getTableIndexLength = function (table, complete, error) {
        var count = 0;
        this.store(table, "readonly", function (tr, store) {
            var ctRequest = tr.objectStore(table).count();
            ctRequest.onsuccess = function () {
                complete(ctRequest.result);
            };
            ctRequest.onerror = error;
        }, error);
    };
    return IndexedDB;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.IndexedDB = IndexedDB;
//# sourceMappingURL=indexedDB.js.map

/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = __webpack_require__(0);
var equal = __webpack_require__(4);
// tslint:disable-next-line
var _nanoSQLQueryBuilder = /** @class */ (function () {
    function _nanoSQLQueryBuilder(db, table, queryAction, queryArgs, actionOrView) {
        this._db = db;
        this._AV = actionOrView || "";
        if (typeof queryAction === "string") {
            this._query = __assign({}, utilities_1.buildQuery(db, table, queryAction), { comments: [], state: "pending", action: queryAction, actionArgs: queryArgs, result: [] });
        }
        else {
            this._query = __assign({}, queryAction(db), { state: "pending", result: [] });
        }
    }
    _nanoSQLQueryBuilder.prototype.where = function (args) {
        this._query.where = args;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.orderBy = function (columns) {
        if (Array.isArray(columns)) {
            this._query.orderBy = columns;
        }
        else {
            this._query.orderBy = Object.keys(columns).map(function (col) { return col + " " + String(columns[col]).toUpperCase(); });
        }
        return this;
    };
    _nanoSQLQueryBuilder.prototype.distinct = function (columns) {
        this._query.distinct = columns;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.groupBy = function (columns) {
        if (Array.isArray(columns)) {
            this._query.groupBy = columns;
        }
        else {
            this._query.groupBy = Object.keys(columns).map(function (col) { return col + " " + String(columns[col]).toUpperCase(); });
        }
        return this;
    };
    _nanoSQLQueryBuilder.prototype.having = function (args) {
        this._query.having = args;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.join = function (args) {
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
    _nanoSQLQueryBuilder.prototype.limit = function (args) {
        this._query.limit = args;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.comment = function (comment) {
        this._query.comments.push(comment);
        return this;
    };
    _nanoSQLQueryBuilder.prototype.tag = function (tag) {
        this._query.tags.push(tag);
        return this;
    };
    _nanoSQLQueryBuilder.prototype.extend = function (scope) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        this._query.extend.push({ scope: scope, args: args });
        return this;
    };
    _nanoSQLQueryBuilder.prototype.union = function (queries, unionAll) {
        this._query.union = {
            queries: queries,
            type: unionAll ? "all" : "distinct"
        };
        return this;
    };
    _nanoSQLQueryBuilder.prototype.offset = function (args) {
        this._query.offset = args;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.emit = function () {
        return this._query;
    };
    _nanoSQLQueryBuilder.prototype.ttl = function (seconds, cols) {
        if (seconds === void 0) { seconds = 60; }
        if (this._query.action !== "upsert") {
            throw new Error("nSQL: Can only do ttl on upsert queries!");
        }
        this._query.ttl = seconds;
        this._query.ttlCols = cols || [];
        return this;
    };
    _nanoSQLQueryBuilder.prototype.graph = function (ormArgs) {
        this._query.graph = ormArgs;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.from = function (tableObj) {
        if (typeof tableObj === "string") {
            this._query.table = tableObj;
        }
        else {
            this._query.table = tableObj.table;
            this._query.tableAS = tableObj.as;
        }
        return this;
    };
    _nanoSQLQueryBuilder.prototype.into = function (table) {
        this._query.table = table;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.on = function (table) {
        this._query.table = table;
        return this;
    };
    _nanoSQLQueryBuilder.prototype.toCSV = function (headers) {
        var t = this;
        return t.exec().then(function (json) { return Promise.resolve(t._db.JSONtoCSV(json, headers)); });
    };
    _nanoSQLQueryBuilder.prototype.exec = function (returnEvents) {
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
    _nanoSQLQueryBuilder.prototype.listen = function (args) {
        return new _nanoSQLObserverQuery(this._query, args && args.debounce, args && args.unique, args && args.compareFn);
    };
    _nanoSQLQueryBuilder.prototype.stream = function (onRow, complete, err, events) {
        this._query.returnEvent = events;
        if (this._db.state.exportQueryObj) {
            onRow(this._query);
            complete();
        }
        else {
            this._db.triggerQuery(this._query, onRow, complete, err);
        }
    };
    _nanoSQLQueryBuilder.prototype.cache = function (cacheReady, error, streamPages) {
        var _this = this;
        var id = utilities_1.uuid();
        var buffer = [];
        var didPage = false;
        var pageNum = 0;
        var streamObj = streamPages || { pageSize: 0, onPage: utilities_1.noop };
        this.stream(function (row) {
            buffer.push(row);
            if (streamObj.pageSize && streamObj.onPage && buffer.length % streamObj.pageSize === 0) {
                didPage = true;
                streamObj.onPage(pageNum, buffer.slice(buffer.length - streamObj.pageSize));
                pageNum++;
                if (streamObj.doNotCache) {
                    buffer = [];
                }
            }
        }, function () {
            if (streamObj.pageSize && streamObj.onPage) {
                if (!didPage || streamObj.doNotCache) { // didn't make it to the page size in total records
                    streamObj.onPage(0, buffer.slice());
                }
                else { // grab the remaining records
                    streamObj.onPage(pageNum, buffer.slice(pageNum * streamObj.pageSize));
                }
            }
            if (!streamObj.doNotCache) {
                _this._db._queryCache[id] = buffer;
                cacheReady(id, buffer.length);
            }
            else {
                buffer = [];
                cacheReady("", 0);
            }
        }, error);
    };
    return _nanoSQLQueryBuilder;
}());
exports._nanoSQLQueryBuilder = _nanoSQLQueryBuilder;
var observerType;
(function (observerType) {
    observerType[observerType["stream"] = 0] = "stream";
    observerType[observerType["exec"] = 1] = "exec";
})(observerType || (observerType = {}));
var _nanoSQLObserverQuery = /** @class */ (function () {
    function _nanoSQLObserverQuery(query, debounce, unique, compareFn) {
        if (debounce === void 0) { debounce = 500; }
        if (unique === void 0) { unique = false; }
        if (compareFn === void 0) { compareFn = equal; }
        var _this = this;
        this.query = query;
        this.debounce = debounce;
        this.unique = unique;
        this.compareFn = compareFn;
        this._listenTables = [];
        this._active = true;
        this.trigger = this.trigger.bind(this);
        this._doQuery = this._doQuery.bind(this);
        this._throttleTrigger = this._doQuery.bind(this);
        this._cbs = {
            stream: [utilities_1.noop, utilities_1.noop, utilities_1.noop, false],
            exec: [utilities_1.noop, false]
        };
        if (typeof query.table !== "string") {
            throw new Error("Can't listen on dynamic tables!");
        }
        if (query.action !== "select") {
            throw new Error("Can't listen to this kind of query!");
        }
        // detect tables to listen for
        this._listenTables.push(query.table);
        if (query.join) {
            var join = Array.isArray(query.join) ? query.join : [query.join];
            this._listenTables.concat(this._getTables(join));
        }
        if (query.graph) {
            var graph = Array.isArray(query.graph) ? query.graph : [query.graph];
            this._listenTables.concat(this._getTables(graph));
        }
        // remove duplicate tables
        this._listenTables = this._listenTables.filter(function (v, i, s) { return s.indexOf(v) === i; });
        this._throttleTrigger = utilities_1.throttle(this, this._doQuery, debounce);
        this._listenTables.forEach(function (table) {
            query.parent.on("change", _this._throttleTrigger, table);
        });
    }
    _nanoSQLObserverQuery.prototype._getTables = function (objects) {
        var _this = this;
        var tables = [];
        objects.forEach(function (j) {
            if (j.with && j.with.table && typeof j.with.table === "string") {
                tables.push(j.with.table);
            }
            var nestedGraph = j.graph;
            if (nestedGraph) {
                var graph = Array.isArray(nestedGraph) ? nestedGraph : [nestedGraph];
                tables.concat(_this._getTables(graph));
            }
        });
        return tables;
    };
    _nanoSQLObserverQuery.prototype._doQuery = function () {
        var _this = this;
        if (!this._active || typeof this._mode === "undefined")
            return;
        switch (this._mode) {
            case observerType.stream:
                this.query.returnEvent = this._cbs.stream[3];
                this.query.parent.triggerQuery(this.query, this._cbs.stream[0], this._cbs.stream[1], this._cbs.stream[2]);
                break;
            case observerType.exec:
                this.query.returnEvent = this._cbs.exec[1];
                var rows_1 = [];
                this.query.parent.triggerQuery(this.query, function (row) {
                    rows_1.push(row);
                }, function () {
                    if (_this.unique) {
                        var trigger = false;
                        if (!_this._oldValues) { // if no previous values, show results
                            trigger = true;
                        }
                        else {
                            if (_this._oldValues.length !== rows_1.length) { // if the query length is different, show results
                                trigger = true;
                            }
                            else {
                                trigger = !_this.compareFn(_this._oldValues, rows_1); // finally, deep equality check (slow af)
                            }
                        }
                        if (trigger) {
                            _this._oldValues = rows_1;
                            _this._cbs.exec[0](utilities_1.assign(rows_1));
                        }
                    }
                    else {
                        _this._cbs.exec[0](rows_1);
                    }
                }, function (err) {
                    _this._cbs.exec[0]([], err);
                });
                break;
        }
    };
    _nanoSQLObserverQuery.prototype._maybeError = function () {
        if (typeof this._mode !== "undefined") {
            throw new Error("Listen can't have multiple exports!");
        }
    };
    _nanoSQLObserverQuery.prototype.trigger = function () {
        this._throttleTrigger();
    };
    _nanoSQLObserverQuery.prototype.stream = function (onRow, complete, error, events) {
        if (this.unique) {
            throw new Error("Can't use unique with stream listener!");
        }
        this._maybeError();
        this._mode = observerType.stream;
        this._cbs.stream = [onRow, complete, error, events || false];
        this._doQuery();
    };
    _nanoSQLObserverQuery.prototype.exec = function (callback, events) {
        this._maybeError();
        this._mode = observerType.exec;
        this._cbs.exec = [callback, events || false];
        this._doQuery();
    };
    _nanoSQLObserverQuery.prototype.unsubscribe = function () {
        var _this = this;
        this._active = false;
        this._listenTables.forEach(function (table) {
            _this.query.parent.off("change", _this._throttleTrigger, table);
        });
    };
    return _nanoSQLObserverQuery;
}());
//# sourceMappingURL=query-builder.js.map

/***/ })
/******/ ]);
});