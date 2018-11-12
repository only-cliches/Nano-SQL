Object.defineProperty(exports, "__esModule", { value: true });
exports.binarySearch = function (arr, value, startVal, endVal) {
    var start = startVal || 0;
    var end = endVal || arr.length;
    if (arr[start] > value)
        return start;
    if (arr[end] < value)
        return end + 1;
    var m = Math.floor((start + end) / 2);
    if (value === arr[m])
        return m;
    if (end - 1 === start)
        return end;
    if (value > arr[m])
        return exports.binarySearch(arr, value, m, end);
    if (value < arr[m])
        return exports.binarySearch(arr, value, start, m);
    return end;
};
exports.buildQuery = function (table, action) {
    return {
        table: table,
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
exports.noop = function () { };
exports.throwErr = function (err) {
    throw new Error(err);
};
// export const events = ["*", "change", "delete", "upsert", "drop", "select", "error", "peer-change"];
/**
 * Object.assign, but faster.
 *
 * @param {*} obj
 * @returns
 */
exports._assign = function (obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : null;
};
/**
 * Compare two javascript variables for equality.
 * Works with primitives, arrays and objects recursively.
 *
 * @param {*} obj1
 * @param {*} obj2
 * @returns {boolean}
 */
exports.doObjectsEqual = function (obj1, obj2) {
    if (obj1 === obj2)
        return true;
    if (typeof obj1 !== "object")
        return false; // primitives will always pass === when they're equal, so we have primitives that don't match.
    if (!obj1 || !obj2)
        return false; // if either object is undefined/false they don't match
    var isArray = Array.isArray(obj1);
    var keys = Object.keys(obj1);
    // If sizes differ then we can skip further comparison
    var matches = isArray ? obj1.length === obj2.length : keys.length === Object.keys(obj2).length;
    if (!matches)
        return false;
    var i = keys.length;
    while (i-- && matches) {
        var key = keys[i];
        if (typeof obj1[key] === "object") { // nested compare
            matches = exports.doObjectsEqual(obj1[key], obj2[key]);
        }
        else {
            matches = obj1[key] === obj2[key];
        }
    }
    return matches;
};
var NanoSQLBuffer = /** @class */ (function () {
    function NanoSQLBuffer(processItem, onError, onComplete) {
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
    NanoSQLBuffer.prototype._progressBuffer = function () {
        var _this = this;
        if (this._triggeredComplete) {
            return;
        }
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
            _this._count % 500 === 0 ? exports.setFast(_this._progressBuffer) : _this._progressBuffer();
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
    NanoSQLBuffer.prototype.finished = function () {
        this._done = true;
        if (this._triggeredComplete) {
            return;
        }
        if (!this._going) {
            this._triggeredComplete = true;
            if (this.onComplete)
                this.onComplete();
        }
    };
    NanoSQLBuffer.prototype.newItem = function (item, processFn) {
        this._items.push([item, processFn]);
        if (!this._going) {
            this._going = true;
            this._progressBuffer();
        }
    };
    return NanoSQLBuffer;
}());
exports.NanoSQLBuffer = NanoSQLBuffer;
/**
 * Quickly and efficiently fire asyncrounous operations in sequence, returns once all operations complete.
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
 * Quickly and efficiently fire asyncrounous operations in parallel, returns once all operations are complete.
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
exports.throttle = function (func, limit) {
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
            func.apply(null, args);
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
    return time + "-" + (exports.random16Bits() + exports.random16Bits()).toString(16);
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
var idTypes = {
    "int": function (value) { return value; },
    "uuid": exports.uuid,
    "timeId": function () { return exports.timeid(); },
    "timeIdms": function () { return exports.timeid(true); }
};
/**
 * Generate a row ID given the primary key type.
 *
 * @param {string} primaryKeyType
 * @param {number} [incrimentValue]
 * @returns {*}
 */
exports.generateID = function (primaryKeyType, incrimentValue) {
    return idTypes[primaryKeyType] ? idTypes[primaryKeyType](incrimentValue || 1) : "";
};
/**
 * Clean the arguments from an object given an array of arguments and their types.
 *
 * @param {string[]} argDeclarations
 * @param {StdObject<any>} args
 * @returns {StdObject<any>}
 */
exports.cleanArgs = function (argDeclarations, args) {
    var a = {};
    var i = argDeclarations.length;
    while (i--) {
        var k2 = argDeclarations[i].split(":");
        if (k2.length > 1) {
            a[k2[0]] = exports.cast(k2[1], args[k2[0]] || undefined, true);
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
 * Cast a javascript variable to a given type. Supports typescript primitives and more specific types.
 *
 * @param {string} type
 * @param {*} [val]
 * @returns {*}
 */
exports.cast = function (type, val, allowUknownTypes) {
    if (type === "any" || type === "blob")
        return val;
    // recursively cast arrays
    if (type.indexOf("[]") !== -1) {
        var arrayOf_1 = type.slice(0, type.lastIndexOf("[]"));
        // value should be array but isn't, cast it to one
        if (!Array.isArray(val))
            return [];
        // we have an array, cast array of types
        return val.map(function (v) { return exports.cast(arrayOf_1, v, allowUknownTypes); });
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
    var doCast = function (castType, castVal) {
        switch (castType) {
            case "safestr": return doCast("string", castVal).replace(/[&<>"'`=\/]/gmi, function (s) { return entityMap[s]; });
            case "int": return (t !== "number" || castVal % 1 !== 0) ? parseInt(castVal || 0) : castVal;
            case "number":
            case "float": return t !== "number" ? parseFloat(castVal || 0) : castVal;
            case "array": return Array.isArray(castVal) ? castVal : [];
            case "uuid":
            case "timeId":
            case "timeIdms":
            case "string": return t !== "string" ? String(castVal) : castVal;
            case "object":
            case "obj":
            case "map": return exports.isObject(castVal) ? castVal : {};
            case "boolean":
            case "bool": return castVal === true || castVal === 1;
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
    var deg2rad = function (deg) {
        return deg * (Math.PI / 180);
    };
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radius * c;
};
var objectPathCache = {};
// turn path into array of strings, ie value[hey][there].length => [value, hey, there, length];
exports.resolvePath = function (pathQuery) {
    var cacheKey = pathQuery;
    if (objectPathCache[cacheKey]) {
        return objectPathCache[cacheKey];
    }
    var path = pathQuery.indexOf("[") !== -1 ?
        // handle complex mix of dots and brackets like "users.value[meta][value].length"
        pathQuery.split(/\.|\[/gmi).map(function (v) { return v.replace(/\]/gmi, ""); }) :
        // handle simple dot paths like "users.meta.value.length"
        pathQuery.split(".");
    objectPathCache[cacheKey] = path;
    return objectPathCache[cacheKey];
};
exports.getFnValue = function (row, str) {
    return str.match(/\".*\"|\'.*\'/gmi) ? str.replace(/\"|\'/gmi, "") : exports.deepGet(str, row);
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
        else if (!setObj[getPath[pathIdx]]) { // nested value doesn't exist yet
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
exports._maybeAssign = function (obj) {
    if (Object.isFrozen(obj))
        return exports._assign(obj);
    return obj;
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