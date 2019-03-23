import * as metaphone from "metaphone";
import * as stemmer from "stemmer";
import { Promise as PR } from "lie-ts";
PR.doPolyFill();

/*
export const Promise = (() => {
    return typeof window !== "undefined" && window["Promise"] ? window["Promise"] : typeof global !== "undefined" && global["Promise"] ? global["Promise"] : PR;
})();
*/
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


export const stopWords = [
    "a", "about", "after", "all", "also", "am", "an", "and", "andor", "another", "any",
    "are", "as", "at", "be", "because", "been", "before", "being", "between",
    "both", "but", "by", "came", "can", "come", "could", "did", "do", "each",
    "for", "from", "get", "got", "had", "has", "have", "he", "her", "here",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "like",
    "make", "many", "me", "might", "more", "most", "much", "must", "my", "never",
    "now", "of", "on", "only", "or", "other", "our", "out", "over", "said", "same",
    "see", "should", "since", "some", "still", "such", "take", "than", "that", "the",
    "their", "them", "then", "there", "these", "they", "this", "those", "through",
    "to", "too", "under", "up", "very", "was", "way", "we", "well", "were", "what",
    "where", "which", "while", "who", "with", "would", "you", "your"
];

/**
 * Object.assign, but faster.
 *
 * @param {*} obj
 * @returns
 */
export const _assign = (obj: any) => {
    return obj ? JSON.parse(JSON.stringify(obj)) : null;
};

export const splitArr = (arr: any[], n: number): any[] => {
    let rest: number = arr.length % n, // how much to divide
        restUsed: number = rest, // to keep track of the division over the elements
        partLength: number = Math.floor(arr.length / n),
        result: any[] = [];

    for (let i = 0; i < arr.length; i += partLength) {
        let end = partLength + i,
            add = false;

        if (rest !== 0 && restUsed) { // should add one element for the division
            end++;
            restUsed--; // we've used one division element now
            add = true;
        }

        result.push(arr.slice(i, end)); // part of the array

        if (add) {
            i++; // also increment i in the case we added an extra element for division
        }
    }

    return result;
};

/**
 * Quickly and efficiently fire asyncrounous operations in sequence, returns once all operations complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export const fastCHAIN = (items: any[], callback: (item: any, i: number, next: (result?: any) => void, err: (result: any) => void) => void): Promise<any[]> => {
    return new Promise((res, rej) => {
        if (!items || !items.length) {
            res([]);
            return;
        }
        let results: any[] = [];
        let hasError = false;
        const step = () => {
            if (results.length < items.length) {
                callback(items[results.length], results.length, (result) => {
                    results.push(result);
                    results.length % 100 === 0 ? setFast(step) : step();
                }, (err) => {
                    hasError = true;
                    rej(err);
                });
            } else {
                if (hasError) return;
                res(results);
            }
        };
        step();
    });
};

/**
 * Quickly and efficiently fire asyncrounous operations in parallel, returns once first operation completes.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export const fastRACE = (items: any[], callback: (item: any, i: number, next: (result?: any) => void, err: (result: any) => void) => void): Promise<any[]> => {
    return new Promise((res, rej) => {
        if (!items || !items.length) {
            res([]);
            return;
        }
        let resolved = false;
        let counter = 0;
        const step = () => {
            if (counter < items.length) {
                callback(items[counter], counter, (result) => {
                    if (!resolved) {
                        resolved = true;
                        res([result]);
                    }
                }, (err) => {
                    if (!resolved) {
                        resolved = true;
                        rej(err);
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
export const fastALL = (items: any[], callback: (item: any, i: number, done: (result?: any) => void, err: (result: any) => void) => void): Promise<any[]> => {
    return Promise.all((items || []).map((item, i) => {
        return new Promise((res, rej) => {
            callback(item, i, res, rej);
        });
    }));
};


const ua = typeof window === "undefined" ? "" : (navigator.userAgent || "");
// Detects iOS device OR Safari running on desktop
export const isSafari: boolean = ua.length === 0 ? false : (/^((?!chrome|android).)*safari/i.test(ua)) || (/iPad|iPhone|iPod/.test(ua) && !window["MSStream"]);

// Detect Edge or Internet Explorer
export const isMSBrowser: boolean = ua.length === 0 ? false : ua.indexOf("MSIE ") > 0 || ua.indexOf("Trident/") > 0 || ua.indexOf("Edge/") > 0;

// Detect Android Device
export const isAndroid = /Android/.test(ua);

/**
 * Generate a random 16 bit number using strongest entropy/crypto available.
 *
 * @returns {number}
 */
export const random16Bits = (): number => {
    if (typeof crypto === "undefined") {
        return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
    } else {
        if (crypto.getRandomValues) { // Browser crypto
            let buf = new Uint16Array(1);
            crypto.getRandomValues(buf);
            return buf[0];
        } else if (typeof global !== "undefined" && global._crypto.randomBytes) { // NodeJS crypto
            return global._crypto.randomBytes(2).reduce((prev: number, cur: number) => cur * prev);
        } else {
            return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
        }
    }
};


/**
 * nanoSQL's default tokenizer, handles a few different cases for the english language.
 *
 * @param {string} table
 * @param {string} column
 * @param {string[]} args
 * @param {string} value
 * @returns {{
 *     o: string; // original string
 *     w: string; // tokenized output
 *     i: number; // location of string
 * }[]}
 */
export const tokenizer = (table: string, column: string, args: string[], value: string, fractionFixed?: number): {
    o: string; // original string
    w: string; // tokenized output
    i: number; // location of string
}[] => {

    const isStopWord = (word: string): boolean => {
        return !word ? true : // is this word falsey? (ie no length, undefined, etc);
            String(word).length === 1 ? true : // is this word 1 length long?
                stopWords.indexOf(word) !== -1; // does word match something in the stop word list?
    };

    // Step 1, Clean up and normalize the text
    const words: string[] = (value || "")
        // everything to lowercase
        .toLowerCase()
        // normalize fractions and numbers (1/4 => 0.2500, 1,000,235 => 100235.0000)
        .replace(/(\d+)\/(\d+)|(?:\d+(?:,\d+)*|\d+)(?:\.\d+)?/gmi, (all, top, bottom) => top || bottom ? (parseInt(top) / parseInt(bottom)).toFixed(fractionFixed || 4) : (parseFloat(all.replace(/\,/gmi, ""))).toFixed(fractionFixed || 4))
        // replace dashes, underscores, anything like parantheses, slashes, newlines and tabs with a single whitespace
        .replace(/\-|\_|\[|\]|\(|\)|\{|\}|\r?\n|\r|\t/gmi, " ")
        // remove anything but letters, numbers and decimals inside numbers with nothing.
        .replace(/[^\w\s]|(\d\.)/gmi, "$1")
        // remove white spaces larger than 1 with 1 white space.
        .replace(/\s+/g, " ")
        .split(" ");

    // Step 2, stem away!
    switch (args[1]) {
        case "english": return words.map((w, i) => ({ // 220 words/ms
            i: i,
            o: w,
            w: isNaN(w as any) ? (isStopWord(w) ? "" : metaphone(stemmer(w))) : w
        }));
        case "english-stem": return words.map((w, i) => ({ // 560 words/ms
            i: i,
            o: w,
            w: isNaN(w as any) ? (isStopWord(w) ? "" : stemmer(w)) : w
        }));
        case "english-meta": return words.map((w, i) => ({ // 270 words/ms
            i: i,
            o: w,
            w: isNaN(w as any) ? (isStopWord(w) ? "" : metaphone(w)) : w
        }));
    }
    // 2,684 words/ms
    return words.map((w, i) => ({ o: w, w, i }));
};

/**
 * Generate a TimeID for use in the database.
 *
 * @param {boolean} [ms]
 * @returns {string}
 */
export const timeid = (ms?: boolean): string => {
    let time = Math.round((new Date().getTime()) / (ms ? 1 : 1000)).toString();
    while (time.length < (ms ? 13 : 10)) {
        time = "0" + time;
    }
    return time + "-" + (random16Bits() + random16Bits()).toString(16);
};

/**
 * See if two arrays intersect.
 *
 * @param {any[]} arr1
 * @param {any[]} arr2
 * @returns {boolean}
 */
export const intersect = (arr1: any[], arr2: any[]): boolean => {
    if (!arr1 || !arr2) return false;
    if (!arr1.length || !arr2.length) return false;
    return (arr1 || []).filter(item => (arr2 || []).indexOf(item) !== -1).length > 0;
};

/**
 * Generates a valid V4 UUID using the strongest crypto available.
 *
 * @returns {string}
 */
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



/**
 * A quick and dirty hashing function, turns a string into a md5 style hash.
 * Stolen from https://github.com/darkskyapp/string-hash
 *
 * @param {string} str
 * @returns {string}
 */
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

/**
 * Generate a row ID given the primary key type.
 *
 * @param {string} primaryKeyType
 * @param {number} [incrimentValue]
 * @returns {*}
 */
export const generateID = (primaryKeyType: string, incrimentValue?: number): any => {
    return idTypes[primaryKeyType] ? idTypes[primaryKeyType](incrimentValue || 1) : "";
};

/**
 * Clean the arguments from an object given an array of arguments and their types.
 *
 * @param {string[]} argDeclarations
 * @param {StdObject<any>} args
 * @returns {StdObject<any>}
 */
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
 * Given a sorted array and a value, find where that value fits into the array.
 *
 * @param {any[]} arr
 * @param {*} value
 * @param {number} [startVal]
 * @param {number} [endVal]
 * @returns {number}
 */
export const binarySearch = (arr: any[], value: any, startVal?: number, endVal?: number): number => {

    const start = startVal || 0;
    const end = endVal || arr.length;

    if (arr[start] > value) return start;
    if (arr[end] < value) return end + 1;

    const m = Math.floor((start + end) / 2);
    if (value === arr[m]) return m;
    if (end - 1 === start) return end;
    if (value > arr[m]) return binarySearch(arr, value, m, end);
    if (value < arr[m]) return binarySearch(arr, value, start, m);
    return end;
};


// turn path into array of strings, ie value[hey][there].length => [value, hey, there, length];
export const resolvePath = (pathQuery: string): string[] => {
    if (!pathQuery) return [];

    if (objectPathCache[pathQuery]) {
        return objectPathCache[pathQuery].slice();
    }
    const path = pathQuery.indexOf("[") !== -1 ?
        // handle complex mix of dots and brackets like "users.value[meta][value].length"
        pathQuery.split(/\.|\[/gmi).map(v => v.replace(/\]/gmi, "")) :
        // handle simple dot paths like "users.meta.value.length"
        pathQuery.split(".");



    objectPathCache[pathQuery] = path;

    return objectPathCache[pathQuery].slice();
};

export const noop = () => {};

// tslint:disable-next-line:class-name
export class _nanoSQLQueue {

    private _items: [any, undefined | ((item: any, complete: () => void, err?: (err: any) => void) => void)][] = [];
    private _going: boolean = false;
    private _done: boolean = false;
    private _count: number = 0;
    private _triggeredComplete: boolean = false;

    constructor(
        public processItem?: (item: any, count: number, complete: () => void, error: (err: any) => void) => void,
        public onError?: (err: any) => void,
        public onComplete?: () => void
    ) {
        this._progressBuffer = this._progressBuffer.bind(this);
    }

    private _progressBuffer() {
        if (this._triggeredComplete) {
            return;
        }

        // quueue as finished
        if (this._done && !this._items.length) {
            this._triggeredComplete = true;
            if (this.onComplete) this.onComplete();
            return;
        }

        // queue has paused
        if (!this._items.length) {
            this._going = false;
            return;
        }

        const next = () => {
            this._count++;
            this._count % 100 === 0 ? setFast(this._progressBuffer) : this._progressBuffer();
        };

        // process queue
        const item = this._items.shift() || [];
        if (item[1]) {
            item[1](item[0], next, this.onError ? this.onError : noop);
        } else if (this.processItem) {
            this.processItem(item[0], this._count, next, this.onError ? this.onError : noop);
        }

    }

    public finished() {
        this._done = true;
        if (this._triggeredComplete) {
            return;
        }
        if (!this._going && !this._items.length) {
            this._triggeredComplete = true;
            if (this.onComplete) this.onComplete();
        }
    }

    public newItem(item: any, processFn?: (item: any, complete: () => void, err?: (error: any) => void) => void) {
        this._items.push([item, processFn]);
        if (!this._going) {
            this._going = true;
            this._progressBuffer();
        }
    }
}


export const deepGet = (pathQuery: string | string[], object: any): any => {

    const safeGet = (getPath: string[], pathIdx: number, object: any) => {
        if (!getPath[pathIdx] || !object) return object;
        return safeGet(getPath, pathIdx + 1, object[getPath[pathIdx] as string]);
    };

    return safeGet(Array.isArray(pathQuery) ? pathQuery : resolvePath(pathQuery), 0, object);
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
export const crowDistance = (lat1: number, lon1: number, lat2: number, lon2: number, radius: number = 6371): number => {
    const deg2rad = (deg: number): number => {
        return deg * (Math.PI / 180);
    };

    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return radius * c;
};

const objectPathCache: {
    [pathQuery: string]: string[];
} = {};

/**
 * Take an object and a string describing a path like "value.length" or "val[length]" and safely get that value in the object.
 *
 * objQuery("hello", {hello: 2}, false) => 2
 * objQuery("hello.length", {hello: [0]}, false) => 1
 * objQuery("hello[0]", {hello: ["there"]}, false) => "there"
 * objQuery("hello[0].length", {hello: ["there"]}, false) => 5
 * objQuery("hello.color.length", {"hello.color": "blue"}, true) => 4
 * objQuery("hello.color.length", {hello: {color: "blue"}}, false) => 4
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
    if (objectPathCache[cacheKey]) {
        return safeGet(objectPathCache[cacheKey], 0, object);
    }

    let path: string[] = [];

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

    return safeGet(objectPathCache[cacheKey], 0, object);
};


let uid = 0;
let storage = {};
let slice = Array.prototype.slice;
let message = "setMsg";

const canPost = typeof window !== "undefined" && window.postMessage && window.addEventListener;

const fastApply = (args) => {
    return args[0].apply(null, slice.call(args, 1));
};

const callback = (event) => {
    let key = event.data;
    let data;
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

const setImmediatePolyfill = (...args: any[]) => {
    let id = uid++;
    let key = message + id;
    storage[key] = args;
    window.postMessage(key, "*");
    return id;
};

export const setFast = (() => {
    return canPost ? setImmediatePolyfill : // built in window messaging (pretty fast, not bad)
    (...args: any[]) => {
        setTimeout(() => { // setTimeout, absolute worse case :(
            fastApply(args);
        }, 0);
    };
})();