Object.defineProperty(exports, "__esModule", { value: true });
var lie_ts_1 = require("lie-ts");
exports.Promise = (function () {
    return typeof window !== "undefined" && window["Promise"] ? window["Promise"] : typeof global !== "undefined" && global["Promise"] ? global["Promise"] : lie_ts_1.Promise;
})();
/**
 * Object.assign, but better.
 *
 * @param {*} obj
 * @returns
 */
exports._assign = function (obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : null;
};
/**
 * Quickly and efficiently fire asyncrounous operations in sequence, returns once all operations complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
exports.fastCHAIN = function (items, callback) {
    return new exports.Promise(function (res, rej) {
        if (!items || !items.length) {
            res([]);
            return;
        }
        var results = [];
        var step = function () {
            if (results.length < items.length) {
                callback(items[results.length], results.length, function (result) {
                    results.push(result);
                    lie_ts_1.setFast(step);
                });
            }
            else {
                res(results);
            }
        };
        step();
    });
};
/**
 * Quickly and efficiently fire asyncrounous operations in parallel, returns once any operation completes.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
exports.fastRACE = function (items, callback) {
    return new exports.Promise(function (res, rej) {
        if (!items || !items.length) {
            res([]);
            return;
        }
        var resolved = false;
        var counter = 0;
        var step = function () {
            if (counter < items.length) {
                callback(items[counter], counter, function (result) {
                    if (!resolved) {
                        resolved = true;
                        res([result]);
                    }
                });
                counter++;
                step();
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
exports.fastALL = function (items, callback) {
    return exports.Promise.all((items || []).map(function (item, i) {
        return new exports.Promise(function (res, rej) {
            callback(item, i, function (result) {
                res(result);
            });
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
 * Generate a random 16 bit number using strongest crypto available.
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
var idTypes = {
    "int": function (value) { return value; },
    "uuid": exports.uuid,
    "timeId": function () { return exports.timeid(); },
    "timeIdms": function () { return exports.timeid(true); }
};
/**
 * A quick and dirty hashing function, turns a string into a md5 style hash.
 * stolen from https://github.com/darkskyapp/string-hash
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
            a[k2[0]] = exports.cast(k2[1], args[k2[0]] || undefined);
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
/**
 * Calculate Lavenshtein distance between two strings.
 *
 * Stolen from https://gist.github.com/andrei-m/982927
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
exports.levenshtein = function (a, b) {
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    var tmp, i, j, prev, val, row;
    // swap to save some memory O(min(a,b)) instead of O(a)
    if (a.length > b.length) {
        tmp = a;
        a = b;
        b = tmp;
    }
    row = Array(a.length + 1);
    // init the row
    for (i = 0; i <= a.length; i++) {
        row[i] = i;
    }
    // fill in the rest
    for (i = 1; i <= b.length; i++) {
        prev = i;
        for (j = 1; j <= a.length; j++) {
            if (b[i - 1] === a[j - 1]) {
                val = row[j - 1]; // match
            }
            else {
                val = Math.min(row[j - 1] + 1, // substitution
                Math.min(prev + 1, // insertion
                row[j] + 1)); // deletion
            }
            row[j - 1] = prev;
            prev = val;
        }
        row[a.length] = prev;
    }
    return row[a.length];
};
/**
 * Cast a javascript variable to a given type. Supports typescript primitives and more specific types.
 *
 * @param {string} type
 * @param {*} [val]
 * @returns {*}
 */
exports.cast = function (type, val) {
    if (type === "any" || type === "blob")
        return val;
    var t = typeof val;
    if (t === "undefined" || val === null) {
        return val;
    }
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
    var types = function (type, val) {
        switch (type) {
            case "safestr": return types("string", val).replace(/[&<>"'`=\/]/gmi, function (s) { return entityMap[s]; });
            case "int": return (t !== "number" || val % 1 !== 0) ? parseInt(val || 0) : val;
            case "number":
            case "float": return t !== "number" ? parseFloat(val || 0) : val;
            case "any[]":
            case "array": return Array.isArray(val) ? val : [];
            case "uuid":
            case "timeId":
            case "timeIdms":
            case "string": return t !== "string" ? String(val) : val;
            case "object":
            case "obj":
            case "map": return exports.isObject(val) ? val : {};
            case "boolean":
            case "bool": return val === true;
        }
        return val;
    };
    var newVal = types(String(type || "").toLowerCase(), val);
    if (type.indexOf("[]") !== -1) {
        var arrayOf_1 = type.slice(0, type.lastIndexOf("[]"));
        return (val || []).map(function (v) {
            return exports.cast(arrayOf_1, v);
        });
    }
    else if (newVal !== undefined) {
        if (["int", "float", "number"].indexOf(type) > -1) {
            return isNaN(newVal) ? 0 : newVal;
        }
        else {
            return newVal;
        }
    }
    return undefined;
};
/**
 * Insert a value into a sorted array, efficiently gaurantees records are sorted on insert.
 *
 * @param {any[]} arr
 * @param {*} value
 * @param {number} [startVal]
 * @param {number} [endVal]
 * @returns {any[]}
 */
exports.sortedInsert = function (arr, value, startVal, endVal) {
    if (arr.length) {
        arr.splice(exports.binarySearch(arr, value), 0, value);
        return arr;
    }
    else {
        arr.push(value);
        return arr;
    }
};
/**
 * Given a sorted array and a value, find where that value fits into the array.
 * Thanks to Olical for this. https://github.com/Olical/binary-search
 *
 * @param {any[]} arr
 * @param {*} value
 * @param {number} [startVal]
 * @param {number} [endVal]
 * @returns {number}
 */
exports.binarySearch = function (arr, value, startVal, endVal) {
    var min = 0;
    var max = arr.length - 1;
    var guess;
    if (value < arr[min])
        return 0;
    if (value > arr[max])
        return max + 1;
    var bitwise = (max <= 2147483647) ? true : false;
    if (bitwise) {
        while (min <= max) {
            guess = (min + max) >> 1;
            if (arr[guess] === value) {
                return guess;
            }
            else {
                if (arr[guess] < value) {
                    min = guess + 1;
                }
                else {
                    max = guess - 1;
                }
            }
        }
    }
    else {
        while (min <= max) {
            guess = Math.floor((min + max) / 2);
            if (arr[guess] === value) {
                return guess;
            }
            else {
                if (arr[guess] < value) {
                    min = guess + 1;
                }
                else {
                    max = guess - 1;
                }
            }
        }
    }
    return guess;
};
/**
 * Quickly removes duplicates from a sorted array.
 *
 * @param {any[]} arr
 * @returns {any[]}
 */
exports.removeDuplicates = function (arr) {
    if (!arr.length)
        return [];
    var newarr = [arr[0]];
    for (var i = 1; i < arr.length; i++) {
        if (arr[i] !== arr[i - 1])
            newarr.push(arr[i]);
    }
    return newarr;
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
var objectPathCache = {};
/**
 * Take an object and a string describing a path like "value.length" or "val[length]" and safely get that value in the object.
 *
 * @param {string} pathQuery
 * @param {*} object
 * @param {boolean} [ignoreFirstPath]
 * @returns {*}
 */
exports.objQuery = function (pathQuery, object, ignoreFirstPath) {
    var val;
    var safeGet = function (getPath, pathIdx, object) {
        if (!getPath[pathIdx] || !object)
            return object;
        return safeGet(getPath, pathIdx + 1, object[getPath[pathIdx]]);
    };
    var cacheKey = pathQuery + (ignoreFirstPath ? "1" : "0");
    // cached path arrays, skips subsequent identical path requests.
    if (objectPathCache[cacheKey]) {
        return safeGet(objectPathCache[cacheKey], 0, object);
    }
    var path = [];
    // need to turn path into array of strings, ie value[hey][there].length => [value, hey, there, length];
    path = pathQuery.indexOf("[") > -1 ?
        // handle complex mix of dots and brackets like "users.value[meta][value].length"
        [].concat.apply([], pathQuery.split(".").map(function (v) { return v.match(/([^\[]+)|\[([^\]]+)\]\[/gmi) || v; })).map(function (v) { return v.replace(/\[|\]/gmi, ""); }) :
        // handle simple dot paths like "users.meta.value.length"
        pathQuery.split(".");
    // handle joins where each row is defined as table.column
    if (ignoreFirstPath) {
        var firstPath = path.shift() + "." + path.shift();
        path.unshift(firstPath);
    }
    objectPathCache[cacheKey] = path;
    return safeGet(objectPathCache[cacheKey], 0, object);
};
