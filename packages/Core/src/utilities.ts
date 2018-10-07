declare var global: any;


export interface UUID extends String {

}

// tslint:disable-next-line
export interface timeId extends String {

}

// tslint:disable-next-line
export interface timeIdms extends String {

}

export const noop = () => { };
export const throwErr = (err: any) => {
    throw new Error(err);
};

// export const events = ["*", "change", "delete", "upsert", "drop", "select", "error", "peer-change"];

/**
 * Object.assign, but faster.
 *
 * @param {*} obj
 * @returns
 */
export const _assign = (obj: any) => {
    return obj ? JSON.parse(JSON.stringify(obj)) : null;
};

/**
 * Quickly and efficiently fire asyncrounous operations in sequence, returns once all operations complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export const chainAsync = (items: any[], callback: (item: any, i: number, next: (value?: any) => void, err?: (err: any) => void) => void): Promise<any[]> => {
    return new Promise((res, rej) => {
        if (!items || !items.length) {
            res([]);
            return;
        }
        let results: any[] = [];
        let i = 0;
        const step = () => {
            if (i < items.length) {
                callback(items[i], i, (result) => {
                    if (result) {
                        results.push(result || 0);
                    }
                    i++;
                    i % 500 === 0 ? setFast(step) : step();
                }, (err) => {
                    rej(err);
                });
            } else {
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
export const allAsync = (items: any[], callback: (item: any, i: number, next: (value: any) => void, err: (err: any) => void) => void): Promise<any[]> => {
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

export const throttle = (func: any, limit: number) => {
    let waiting = false;
    return (...args: any[]) => {
        if (waiting) return;
        waiting = true;
        setTimeout(() => {
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
export const cleanArgs = (argDeclarations: string[], args: { [key: string]: any }, customTypes: { [name: string]: { [key: string]: { type: string, default?: any } } }): { [key: string]: any } => {
    let a: { [key: string]: any } = {};
    let i = argDeclarations.length;
    while (i--) {
        let k2: string[] = argDeclarations[i].split(":");
        if (k2.length > 1) {
            a[k2[0]] = cast(k2[1], customTypes, args[k2[0]] || undefined);
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
export const cast = (type: string, customTypes: { [name: string]: { [key: string]: { type: string, default?: any } } }, val: any, doUndefined?: boolean, depth?: number): any => {

    if (type === "any" || type === "blob") return val;

    const lvl = depth || 0;

    if (lvl > 50) {
        throw new Error(`Infinite recursion found in ${type} type.`);
    }

    // recursively cast arrays
    if (type.indexOf("[]") !== -1) {
        const arrayOf = type.slice(0, type.lastIndexOf("[]"));
        // value should be array but isn't, cast it to one
        if (!Array.isArray(val)) return [];
        // we have an array, cast array of types
        return val.map((v) => cast(arrayOf, customTypes, v, doUndefined, 0));
    }

    const t = typeof val;

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

    const doCast = (castType: string, castVal: any) => {
        switch (castType) {
            case "safestr": return doCast("string", castVal).replace(/[&<>"'`=\/]/gmi, (s) => entityMap[s]);
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
            case "map": return isObject(castVal) ? castVal : {};
            case "boolean":
            case "bool": return castVal === true || castVal === 1;
        }


        if (Object.keys(customTypes).indexOf(castType) !== -1) {
            // cast this object as custom type
            const objVal = isObject(castVal) ? castVal : {};
            return Object.keys(customTypes[castType]).reduce((prev, key) => {
                const nestedValue = typeof objVal[key] !== "undefined" ? objVal[key] : customTypes[castType][key].default;
                prev[key] = cast(customTypes[castType][key].type, customTypes, nestedValue, doUndefined, lvl + 1);
                return prev;
            }, {});
        }

        // doesn't match known types or custom types, return null;
        return null;
    };

    if (doUndefined && (typeof val === "undefined" || val === null)) return null;

    const newVal = doCast(String(type || "").toLowerCase(), val);

    // force numerical values to be a number and not NaN.
    if (newVal !== undefined && ["int", "float", "number"].indexOf(type) > -1) {
        return isNaN(newVal) ? 0 : newVal;
    }

    return newVal;
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

// turn path into array of strings, ie value[hey][there].length => [value, hey, there, length];
export const resolveObjPath = (pathQuery: string, ignoreFirstPath?: boolean): string[] => {
    const cacheKey = pathQuery + (ignoreFirstPath ? "0" : "1");
    if (objectPathCache[cacheKey]) {
        return objectPathCache[cacheKey];
    }
    const path = pathQuery.indexOf("[") > -1 ?
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

    return objectPathCache[cacheKey];
};

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

    return safeGet(resolveObjPath(pathQuery, ignoreFirstPath), 0, object);
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
            if (typeof global !== "undefined") {
                global["setImmediate"](() => { // setImmediate in node
                    fastApply(args);
                });
            } else {
                setTimeout(() => { // setTimeout, worst case...
                    fastApply(args);
                }, 0);
            }
        };
})();