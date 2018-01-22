import { Promise as PR, setFast } from "lie-ts";
export const Promise = (() => {
    return typeof window !== "undefined" && window["Promise"] ? window["Promise"] : typeof global !== "undefined" && global["Promise"] ? global["Promise"] : PR;
})();

declare var global: any;

/**
 * Standard object placeholder with string key.
 *
 * @export
 * @interface StdObject
 * @template T
 */
export interface StdObject<T> {
    [key: string]: T;
}

export interface UUID extends String {

}

// tslint:disable-next-line
export interface timeId extends String {

}

// tslint:disable-next-line
export interface timeIdms extends String {

}

export const _assign = (obj: any) => {
    return obj ? JSON.parse(JSON.stringify(obj)) : null;
};

export const fastCHAIN = (items: any[], callback: (item: any, i: number, next: (result?: any) => void) => void): Promise<any> => {
    return new Promise((res, rej) => {
        if (!items || !items.length) {
            res([]);
            return;
        }
        let results: any[] = [];
        const step = () => {
            if (results.length < items.length) {
                callback(items[results.length], results.length, (result) => {
                    results.push(result);
                    setFast(step);
                });
            } else {
                res(results);
            }
        };
        step();
    });
};

export const fastALL = (items: any[], callback: (item: any, i: number, done: (result?: any) => void) => void): Promise<any> => {
    return new Promise((res, rej) => {
        if (!items || !items.length) {
            res([]);
            return;
        }
        let i = items.length;
        let results: any[] = [];
        while (i--) {
            callback(items[i], i, (result) => {
                results.push(result);
                if (results.length === items.length) {
                    res(results);
                }
            });
        }
    });
};


const ua = typeof window === "undefined" ? "" : navigator.userAgent;
// Detects iOS device OR Safari running on desktop
export const isSafari: boolean = ua.length === 0 ? false : (/^((?!chrome|android).)*safari/i.test(ua)) || (/iPad|iPhone|iPod/.test(ua) && !window["MSStream"]);

// Detect Edge or Internet Explorer
export const isMSBrowser: boolean = ua.length === 0 ? false : ua.indexOf("MSIE ") > 0 || ua.indexOf("Trident/") > 0 || ua.indexOf("Edge/") > 0;

// detect Android
export const isAndroid = /Android/.test(ua);

// Generate a random 16 bit number using strongest crypto available.
export const random16Bits = (): number => {
    if (typeof crypto === "undefined") {
        return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
    } else {
        if (crypto.getRandomValues) { // Browser crypto
            let buf = new Uint16Array(1);
            crypto.getRandomValues(buf);
            return buf[0];
        } else if (global !== "undefined" && global._crypto.randomBytes) { // NodeJS crypto
            return global._crypto.randomBytes(2).reduce((prev: number, cur: number) => cur * prev);
        } else {
            return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
        }
    }
};

// Generate a TimeID for use in the database.
export const timeid = (ms?: boolean): string => {
    let time = Math.round((new Date().getTime()) / (ms ? 1 : 1000)).toString();
    while (time.length < (ms ? 13 : 10)) {
        time = "0" + time;
    }
    return time + "-" + (random16Bits() + random16Bits()).toString(16);
};


// Generates a valid V4 UUID.
export const uuid = (): string => {
    let r, s, b = "";
    return [b, b, b, b, b, b, b, b].reduce((prev: string, cur: any, i: number): string => {
        r = random16Bits();
        s = (i === 3 ? 4 : (i === 4 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
        r = r.toString(16);
        while (r.length < 4) r = "0" + r;
        return prev + ([2, 3, 4, 5].indexOf(i) > -1 ? "-" : b) + (s + r).slice(0, 4);
    }, b);
};

// A quick and dirty hashing function, turns a string into a md5 style hash.
// stolen from https://github.com/darkskyapp/string-hash
export const hash = (str: string): string => {
    let hash = 5381, i = str.length;
    while (i) {
        hash = (hash * 33) ^ str.charCodeAt(--i);
    }
    return (hash >>> 0).toString(16);
};

const idTypes = {
    "int": (value) => value,
    "uuid": uuid,
    "timeId": () => timeid(),
    "timeIdms": () => timeid(true)
};

// Generate a row ID given the primary key type.
export const generateID = (primaryKeyType: string, incrimentValue?: number): any => {
    return idTypes[primaryKeyType] ? idTypes[primaryKeyType](incrimentValue || 1) : "";
};

// Clean the arguments from an object given an array of arguments and their types.
export const cleanArgs = (argDeclarations: string[], args: StdObject<any>): StdObject<any> => {
    let a: StdObject<any> = {};
    let i = argDeclarations.length;
    while (i--) {
        let k2: string[] = argDeclarations[i].split(":");
        if (k2.length > 1) {
            a[k2[0]] = cast(k2[1], args[k2[0]] || undefined);
        } else {
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
export const isObject = (val: any): boolean => {
    return Object.prototype.toString.call(val) === "[object Object]";
};

/**
 * Cast a javascript variable to a given type. Supports typescript primitives and more specific types.
 *
 * @param {string} type
 * @param {*} [val]
 * @returns {*}
 */
export const cast = (type: string, val?: any): any => {

    if (type === "any" || type === "blob") return val;

    const t = typeof val;
    if (t === "undefined" || val === null) {
        return val;
    }

    const entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
        "/": "&#x2F;",
        "`": "&#x60;",
        "=": "&#x3D;"
    };

    const types = (type: string, val: any) => {
        switch (type) {
            case "safestr": return types("string", val).replace(/[&<>"'`=\/]/gmi, (s) => entityMap[s]);
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
            case "map": return isObject(val) ? val : {};
            case "boolean":
            case "bool": return val === true;
        }

        return val;
    };

    const newVal = types(String(type || "").toLowerCase(), val);

    if (type.indexOf("[]") !== -1) {
        const arrayOf = type.slice(0, type.lastIndexOf("[]"));
        return (val || []).map((v) => {
            return cast(arrayOf, v);
        });
    } else if (newVal !== undefined) {
        if (["int", "float", "number"].indexOf(type) > -1) {
            return isNaN(newVal) ? 0 : newVal;
        } else {
            return newVal;
        }
    }

    return undefined;
};

/**
 * Insert a value into a given array, efficiently gaurantees records are sorted on insert.
 *
 * @param {any[]} arr
 * @param {*} value
 * @param {number} [startVal]
 * @param {number} [endVal]
 * @returns {any[]}
 */
export const sortedInsert = (arr: any[], value: any, startVal?: number, endVal?: number): any[] => {
    if (arr.length) {
        arr.splice(binarySearch(arr, value), 0, value);
        return arr;
    } else {
        arr.push(value);
        return arr;
    }
};
/**
 * Given a sorted array and a value, find where that value fits into the array.
 *
 * @param {any[]} arr
 * @param {*} value
 * @param {number} [startVal]
 * @param {number} [endVal]
 * @returns {number}
 */
export const binarySearch = (arr: any[], value: any, startVal?: number, endVal?: number): number => {
    const length = arr.length;
    const start = startVal || 0;
    const end = endVal !== undefined ? endVal : length - 1;

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

    const m = start + Math.floor((end - start) / 2);

    if (value < arr[m]) {
        return binarySearch(arr, value, start, m - 1);
    }

    if (value > arr[m]) {
        return binarySearch(arr, value, m + 1, end);
    }
    return 0;
};

/**
 * Quickly removes duplicates from a sorted array.
 *
 * @param {any[]} arr
 * @returns {any[]}
 */
export const removeDuplicates = (arr: any[]): any[] => {
    if (!arr.length) return [];
    let newarr = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] !== arr[i - 1]) newarr.push(arr[i]);
    }
    return newarr;
};

/**
 * Recursively freeze a javascript object to prevent it from being modified.
 *
 * @param {*} obj
 * @returns
 */
export const deepFreeze = (obj: any) => {

    Object.getOwnPropertyNames(obj || {}).forEach((name) => {
        const prop = obj[name];
        if (typeof prop === "object" && prop !== null) {
            obj[name] = deepFreeze(prop);
        }
    });

    // Freeze self (no-op if already frozen)
    return Object.freeze(obj);
};


let objectPathCache: {
    [pathQuery: string]: string[];
} = {};

/**
 * Take an object and a string like "value.length" or "val[length]" and safely get that value in the object.
 *
 * @param {string} pathQuery
 * @param {*} object
 * @param {boolean} [ignoreFirstPath]
 * @returns {*}
 */
export const objQuery = (pathQuery: string, object: any, ignoreFirstPath?: boolean): any => {
    let val;
    const safeGet = (getPath: string[], pathIdx: number, object: any) => {
        if (!getPath[pathIdx] || !object) return object;
        return safeGet(getPath, pathIdx + 1, object[getPath[pathIdx] as string]);
    };

    const cacheKey = pathQuery + (ignoreFirstPath ? "1" : "0");

    // cached path arrays, skips subsequent identical path requests.
    let path: string[] = objectPathCache[cacheKey] || [];
    if (path.length) {
        return safeGet(path, 0, object);
    }

    // need to turn path into array of strings, ie value[hey][there].length => [value, hey, there, length];
    path = pathQuery.indexOf("[") > -1 ?
        // handle complex mix of dots and brackets like "users.value[meta][value].length"
        [].concat.apply([], pathQuery.split(".").map(v => v.match(/([^\[]+)|\[([^\]]+)\]\[/gmi) || v)).map(v => v.replace(/\[|\]/gmi, "")) :
        // handle simple dot paths like "users.meta.value.length"
        pathQuery.split(".");

    // handle joins where each row is defined as table.column
    if (ignoreFirstPath) {
        const firstPath = path.shift() + "." + path.shift();
        path.unshift(firstPath);
    }

    objectPathCache[cacheKey] = path;

    return safeGet(path, 0, object);
};