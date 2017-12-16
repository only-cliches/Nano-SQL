Object.defineProperty(exports, "__esModule", { value: true });
var lie_ts_1 = require("lie-ts");
exports._assign = function (obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : null;
};
var CHAIN = (function () {
    function CHAIN(callbacks) {
        this.callbacks = callbacks;
    }
    CHAIN.prototype.then = function (complete) {
        var _this = this;
        var results = [];
        var ptr = 0;
        if (!this.callbacks || !this.callbacks.length) {
            complete([]);
        }
        var next = function () {
            if (ptr < _this.callbacks.length) {
                _this.callbacks[ptr](function (result) {
                    results.push(result);
                    ptr++;
                    lie_ts_1.setFast(next);
                });
            }
            else {
                complete(results);
            }
        };
        next();
    };
    return CHAIN;
}());
exports.CHAIN = CHAIN;
var ALL = (function () {
    function ALL(callbacks) {
        this.callbacks = callbacks;
    }
    ALL.prototype.then = function (complete) {
        var _this = this;
        var results = [];
        var ptr = 0;
        if (!this.callbacks || !this.callbacks.length) {
            complete([]);
        }
        this.callbacks.forEach(function (cb, i) {
            cb(function (response) {
                results[i] = response;
                ptr++;
                if (ptr === _this.callbacks.length) {
                    complete(results);
                }
            });
        });
    };
    return ALL;
}());
exports.ALL = ALL;
var ua = typeof window === "undefined" ? "" : navigator.userAgent;
exports.isSafari = ua.length === 0 ? false : (/^((?!chrome|android).)*safari/i.test(ua)) || (/iPad|iPhone|iPod/.test(ua) && !window["MSStream"]);
exports.isMSBrowser = ua.length === 0 ? false : ua.indexOf("MSIE ") > 0 || ua.indexOf("Trident/") > 0 || ua.indexOf("Edge/") > 0;
exports.isAndroid = /Android/.test(ua);
exports.random16Bits = function () {
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
exports.timeid = function (ms) {
    var time = Math.round((new Date().getTime()) / (ms ? 1 : 1000)).toString();
    while (time.length < (ms ? 13 : 10)) {
        time = "0" + time;
    }
    return time + "-" + (exports.random16Bits() + exports.random16Bits()).toString(16);
};
exports.uuid = function () {
    var r, s, b = "";
    return [b, b, b, b, b, b, b, b, b].reduce(function (prev, cur, i) {
        r = exports.random16Bits();
        s = (i === 4 ? i : (i === 5 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
        r = r.toString(16);
        while (r.length < 4)
            r = "0" + r;
        return prev + ([3, 4, 5, 6].indexOf(i) > -1 ? "-" : b) + (s + r).slice(0, 4);
    }, b);
};
exports.hash = function (str) {
    var hash = 5381, i = str.length;
    while (i) {
        hash = (hash * 33) ^ str.charCodeAt(--i);
    }
    return (hash >>> 0).toString(16);
};
exports.generateID = function (primaryKeyType, incrimentValue) {
    switch (primaryKeyType) {
        case "int":
            return incrimentValue || 1;
        case "uuid":
            return exports.uuid();
        case "timeId":
            return exports.timeid();
        case "timeIdms":
            return exports.timeid(true);
    }
    return "";
};
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
exports.isObject = function (val) {
    return Object.prototype.toString.call(val) === "[object Object]";
};
exports.cast = function (type, val) {
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
    if (t === "undefined" || val === null) {
        return val;
    }
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
exports.binarySearch = function (arr, value, startVal, endVal) {
    var length = arr.length;
    var start = startVal || 0;
    var end = endVal !== undefined ? endVal : length - 1;
    if (length === 0) {
        return 0;
    }
    if (value > arr[end]) {
        return end + 1;
    }
    if (value < arr[start]) {
        return start;
    }
    if (start >= end) {
        return 0;
    }
    var m = start + Math.floor((end - start) / 2);
    if (value < arr[m]) {
        return exports.binarySearch(arr, value, start, m - 1);
    }
    if (value > arr[m]) {
        return exports.binarySearch(arr, value, m + 1, end);
    }
    return 0;
};
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
exports.deepFreeze = function (obj) {
    Object.getOwnPropertyNames(obj || {}).forEach(function (name) {
        var prop = obj[name];
        if (typeof prop === "object" && prop !== null) {
            obj[name] = exports.deepFreeze(prop);
        }
    });
    return Object.freeze(obj);
};
var objectPathCache = {};
exports.objQuery = function (pathQuery, object, ignoreFirstPath) {
    var val;
    var safeGet = function (getPath, pathIdx, object) {
        if (!getPath[pathIdx] || !object)
            return object;
        return safeGet(getPath, pathIdx + 1, object[getPath[pathIdx]]);
    };
    var cacheKey = pathQuery + (ignoreFirstPath ? "1" : "0");
    var path = objectPathCache[cacheKey] || [];
    if (path.length) {
        return safeGet(path, 0, object);
    }
    path = pathQuery.indexOf("[") > -1 ?
        [].concat.apply([], pathQuery.split(".").map(function (v) { return v.match(/([^\[]+)|\[([^\]]+)\]\[/gmi) || v; })).map(function (v) { return v.replace(/\[|\]/gmi, ""); }) :
        pathQuery.split(".");
    if (ignoreFirstPath) {
        var firstPath = path.shift() + "." + path.shift();
        path.unshift(firstPath);
    }
    objectPathCache[cacheKey] = path;
    return safeGet(path, 0, object);
};
