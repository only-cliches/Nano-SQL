import { 
    InanoSQLQuery, 
    InanoSQLInstance, 
    adapterReadFilter, 
    adapterReadMultiFilter, 
    TableQueryResult, 
    InanoSQLTable,
    adapterWriteFilter,
    adapterConnectFilter,
    adapterDisconnectFilter,
    adapterCreateTableFilter,
    adapterDropTableFilter,
    adapterDeleteFilter,
    adapterGetTableIndexFilter,
    adapterGetTableIndexLengthFilter,
    adapterCreateIndexFilter,
    adapterDeleteIndexFilter,
    adapterAddIndexValueFilter,
    adapterDeleteIndexValueFilter,
    adapterReadIndexKeyFilter,
    adapterReadIndexKeysFilter,
    InanoSQLFunctionResult,
    InanoSQLDataModel
} from "./interfaces";
import { _nanoSQLQuery } from "./query";
import * as leven from "levenshtein-edit-distance";
import * as equal from "fast-deep-equal";

declare var global: any;

export const blankTableDefinition: InanoSQLTable = {
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
}

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
export const binarySearch = (arr: any[], value: any, indexOf: boolean, startVal?: number, endVal?: number): number => {

    const start = startVal || 0;
    const end = endVal || arr.length;

    if (arr[start] >= value) return indexOf ? -1 : start;
    if (arr[end] <= value) return indexOf ? -1 : end + 1;

    const m = Math.floor((start + end) / 2);
    if (value == arr[m]) return m;
    if (end - 1 == start) return indexOf ? -1 : end;
    if (value > arr[m]) return binarySearch(arr, value, indexOf, m, end);
    if (value < arr[m]) return binarySearch(arr, value, indexOf, start, m);
    return indexOf ? -1 : end;
};

/**
 * Converts a word to title case.
 *
 * @param {string} str
 * @returns
 */
export const titleCase = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const slugify = (str: string): string => {
    return String(str).replace(/\s+/g, "-").replace(/[^0-9a-z\-]/gi, "").toLowerCase();
}

export const buildQuery = (nSQL: InanoSQLInstance, table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>), action: string): InanoSQLQuery => {
    return {
        table: table || nSQL.state.selectedTable,
        parent: nSQL,
        action: action,
        state: "pending",
        result: [],
        time: Date.now(),
        queryID: uuid(),
        extend: [],
        comments: [],
        tags: []
    };
};

export const adapterFilters = (nSQL: InanoSQLInstance, query?: InanoSQLQuery) => {
    return {
        write: (table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterWriteFilter>("adapterWrite", { res: { table, pk, row, complete, error }, query }, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.write(nSQL._tableIds[result.res.table], result.res.pk, result.res.row, (pk) => {
                    result.res.complete(pk);
                }, result.res.error);
            }, error as any);
        },
        read: (table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) => {
            
            nSQL.doFilter<adapterReadFilter>("adapterRead", { res: {table, pk, complete, error }, query }, (result) => {
                if (!result) return; // filter took over

                nSQL.adapter.read(nSQL._tableIds[result.res.table], result.res.pk, (row) => {
                    if (!row) {
                        result.res.complete(undefined);
                        return;
                    }
                    result.res.complete(row);
                }, result.res.error);

            }, error as any);
        },
        readMulti: (table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterReadMultiFilter>("adapterReadMulti", { res: { table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error }, query }, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.readMulti(nSQL._tableIds[result.res.table], result.res.type, result.res.offsetOrLow, result.res.limitOrHigh, result.res.reverse, (row, i) => {
                    result.res.onRow(row, i)
                }, () => {
                    result.res.complete();
                }, result.res.error);
            }, error);

        },
        connect: (id: string, complete: () => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterConnectFilter>("adapterConnect", {res: {id, complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.connect(result.res.id, result.res.complete, result.res.error);
            }, error);
        },
        disconnect: (complete: () => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterDisconnectFilter>("adapterDisconnect", {res: {complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.disconnect(result.res.complete, result.res.error);
            }, error);
        },
        createTable: (tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterCreateTableFilter>("adapterCreateTable", {res: {tableName, tableData, complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.createTable(nSQL._tableIds[result.res.tableName], result.res.tableData, result.res.complete, result.res.error);
            }, error);
        },
        dropTable: (table: string, complete: () => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterDropTableFilter>("adapterDropTable", {res: {table: nSQL._tableIds[table], complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.dropTable(result.res.table, result.res.complete, result.res.error);
            }, error);
        },
        delete: (table: string, pk: any, complete: () => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterDeleteFilter>("adapterDelete", {res: {table: nSQL._tableIds[table], pk, complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.delete(result.res.table, result.res.pk, result.res.complete, result.res.error);
            }, error);
        },
        getTableIndex: (table: string, complete: (index: any[]) => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterGetTableIndexFilter>("adapterGetTableIndex", {res: {table: nSQL._tableIds[table], complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.getTableIndex(result.res.table, result.res.complete, result.res.error);
            }, error);
        },
        getTableIndexLength: (table: string, complete: (length: number) => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterGetTableIndexLengthFilter>("adapterGetTableIndexLength", {res: {table: nSQL._tableIds[table], complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.getTableIndexLength(result.res.table, result.res.complete, result.res.error);
            }, error);
        },
        createIndex: (table: string, indexName: string, type: string, complete: () => void, error: (err: any) => void) => {
            nSQL.doFilter<adapterCreateIndexFilter>("adapterCreateIndex", {res: {table: nSQL._tableIds[table], indexName, type, complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.createIndex(result.res.table, result.res.indexName, result.res.type, result.res.complete, result.res.error);
            }, error);
        },
        deleteIndex: (table: string, indexName: string, complete: () => void, error: (err: any) => void) => {
            if (!nSQL._tables[table].indexes[indexName]) {
                error({error: `Index ${indexName} not found!`});
                return;
            }
            nSQL.doFilter<adapterDeleteIndexFilter>("adapterDeleteIndex", {res: {table: nSQL._tableIds[table], indexName, complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.deleteIndex(result.res.table, result.res.indexName, result.res.complete, result.res.error);
            }, error);
        },
        addIndexValue: (table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void) => {
            if (!nSQL._tables[table].indexes[indexName]) {
                error({error: `Index ${indexName} not found!`});
                return;
            }
            let value2 = value;
            // shift primary key query by offset
            if (typeof value2 === "number" && nSQL._tables[table].indexes[indexName].props && nSQL._tables[table].indexes[indexName].props.offset) {
                value2 += nSQL._tables[table].indexes[indexName].props.offset || 0;
            }

            nSQL.doFilter<adapterAddIndexValueFilter>("adapterAddIndexValue", {res: {table: nSQL._tableIds[table], indexName, key, value: value2, complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.addIndexValue(result.res.table, result.res.indexName, result.res.key, result.res.value, result.res.complete, result.res.error);
            }, error);
        },
        deleteIndexValue: (table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void) => {
            if (!nSQL._tables[table].indexes[indexName]) {
                error({error: `Index ${indexName} not found!`});
                return;
            }
            let key2 = value;
            // shift primary key query by offset
            if (typeof key2 === "number" && nSQL._tables[table].indexes[indexName].props && nSQL._tables[table].indexes[indexName].props.offset) {
                key2 += nSQL._tables[table].indexes[indexName].props.offset || 0;
            }

            nSQL.doFilter<adapterDeleteIndexValueFilter>("adapterDeleteIndexValue", {res: {table: nSQL._tableIds[table], indexName, key, value: key2, complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.deleteIndexValue(result.res.table, result.res.indexName, result.res.key, result.res.value, result.res.complete, result.res.error);
            }, error);
        },
        readIndexKey: (table: string, indexName: string, pk: any, onRowPK: (key: any) => void, complete: () => void, error: (err: any) => void) => {

            if (!nSQL._tables[table].indexes[indexName]) {
                error({error: `Index ${indexName} not found!`});
                return;
            }

            let key = pk;
            // shift primary key query by offset
            if (typeof key === "number" && nSQL._tables[table].indexes[indexName].props && nSQL._tables[table].indexes[indexName].props.offset) {
                key += nSQL._tables[table].indexes[indexName].props.offset || 0;
            }

            nSQL.doFilter<adapterReadIndexKeyFilter>("adapterReadIndexKey", {res: {table: nSQL._tableIds[table], indexName, pk: key, onRowPK, complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.readIndexKey(result.res.table, result.res.indexName, result.res.pk, result.res.onRowPK, result.res.complete, result.res.error);
            }, error);
        },
        readIndexKeys: (table: string, indexName: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, id: any) => void, complete: () => void, error: (err: any) => void) => {
            
            let lower = offsetOrLow;
            let higher = limitOrHigh;

            if (!nSQL._tables[table].indexes[indexName]) {
                error({error: `Index ${indexName} not found!`});
                return;
            }

            // shift range query by offset
            if (typeof lower === "number" && typeof higher === "number" && type === "range") {
                if (nSQL._tables[table].indexes[indexName] && nSQL._tables[table].indexes[indexName].props.offset) {
                    lower += nSQL._tables[table].indexes[indexName].props.offset || 0;
                    higher += nSQL._tables[table].indexes[indexName].props.offset || 0;
                }
            }
            nSQL.doFilter<adapterReadIndexKeysFilter>("adapterReadIndexKeys", {res: {table: nSQL._tableIds[table], indexName, type, offsetOrLow: lower, limitOrHigh: higher, reverse, onRowPK, complete, error}, query}, (result) => {
                if (!result) return; // filter took over
                nSQL.adapter.readIndexKeys(result.res.table, result.res.indexName, result.res.type, result.res.offsetOrLow, result.res.limitOrHigh, result.res.reverse, result.res.onRowPK, result.res.complete, result.res.error);
            }, error);
        }
    };
};

export const noop = () => { };
export const throwErr = (err: any) => {
    throw new Error(err);
};
export const nan = (input: any): number => {
    return isNaN(input) || input === null ? 0 : parseFloat(input)
}

/**
 * Object.assign, but faster.
 *
 * @param {*} obj
 * @returns
 */
export const assign = (obj: any) => {
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
export const objectsEqual = (obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== "object") return false; // primitives will always pass === when they're equal, so we have primitives that don't match.
    if (!obj1 || !obj2) return false; // if either object is undefined they don't match

    return equal(obj1, obj2);
};

// tslint:disable-next-line
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

/**
 * Quickly and efficiently fire asynchronous operations in sequence, returns once all operations complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export const chainAsync = (items: any[], callback: (item: any, i: number, next: (value?: any) => void, err: (err?: any) => void) => void): Promise<any[]> => {
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
 * Quickly and efficiently fire asynchronous operations in parallel, returns once all operations are complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, done: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export const allAsync = (items: any[], callback: (item: any, i: number, next: (value?: any) => void, err: (err: any) => void) => void): Promise<any[]> => {
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

export const throttle = (scope: any, func: any, limit: number) => {
    let waiting = false;
    return (...args: any[]) => {  
        if (waiting) return;
        waiting = true;
        setTimeout(() => {
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
export const timeid = (ms?: boolean): string => {
    let time = Math.round((new Date().getTime()) / (ms ? 1 : 1000)).toString();
    while (time.length < (ms ? 13 : 10)) {
        time = "0" + time;
    }
    let seed = (random16Bits() + random16Bits()).toString(16);
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

/**
 * Generate a row ID given the primary key type.
 *
 * @param {string} primaryKeyType
 * @param {number} [incrimentValue]
 * @returns {*}
 */
export const generateID = (primaryKeyType: string, incrimentValue?: number): any => {
    const idTypes = {
        "int": (value) => value,
        "float": (value) => value,
        "uuid": uuid,
        "timeId": () => timeid(),
        "timeIdms": () => timeid(true)
    }

    return idTypes[primaryKeyType] ? idTypes[primaryKeyType](incrimentValue || 1) : undefined;
};

export const cleanArgs2 = (args: any, dataModel: { [colAndType: string]: InanoSQLDataModel } | string, nSQL: InanoSQLInstance): any => {
    let returnObj = {};

    const conformType = (strType: string, obj: any, dModel: { [colAndType: string]: InanoSQLDataModel } | string): any => {
        if (strType.indexOf("[]") !== -1) {
            const arrayOf = strType.slice(0, strType.lastIndexOf("[]"));
            // value should be array but isn't, cast it to one
            if (!Array.isArray(obj)) return [];
            // we have an array, cast array of types
            return obj.map((v) => conformType(arrayOf, v, dModel));
        }
        if (typeof dModel === "string") {
            let findModel = dModel.replace(/\[\]/gmi, "");
            let typeModel = Object.keys(nSQL.config.types || {}).reduce((prev, cur) => {
                if (cur === findModel) return (nSQL.config.types || {})[cur];
                return prev;
            }, undefined);
            if (!typeModel) {
                throw new Error(`Can't find type ${findModel}!`);
            }
            return conformType(dModel, args, typeModel);
        } else {
            let returnObj = {};
            let getOtherCols: boolean = false;
            let definedCols: string[] = [];
            Object.keys(dModel).forEach((colAndType) => {
                const split = colAndType.split(":");
                if (split[0] === "*") {
                    getOtherCols = true;
                } else {
                    definedCols.push(split[0]);
                    returnObj[split[0]] = cast(split[1], obj[split[0]], false, nSQL);
                }
            });
            if (getOtherCols && isObject(obj)) {
                Object.keys(obj).filter(k => definedCols.indexOf(k) === -1).forEach((key) => {
                    returnObj[key] = obj[key];
                });
            }
            return returnObj;
        }
    };

    return conformType(typeof dataModel === "string" ? dataModel : "", args, dataModel);
}

/**
 * Clean the arguments from an object given an array of arguments and their types.
 *
 * @param {string[]} argDeclarations
 * @param {StdObject<any>} args
 * @returns {StdObject<any>}
 */
export const cleanArgs = (argDeclarations: string[], args: { [key: string]: any }, nSQL: InanoSQLInstance): { [key: string]: any } => {
    let a: { [key: string]: any } = {};
    let i = argDeclarations.length;
    const customTypes = Object.keys(nSQL.config.types || {});
    while (i--) {
        let k2: string[] = argDeclarations[i].split(":");
        if (k2.length > 1) {
            a[k2[0]] = cast(k2[1], args[k2[0]] || undefined, true, nSQL);
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

export const objSort = (path?: string, rev?: boolean) => {
    return (a: any, b: any): number => {
        const result = path ? (deepGet(path, a) > deepGet(path, b) ? -1 : 1) : (a > b ? -1 : 1);
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
export const execFunction = (query: InanoSQLQuery, fnString: string, row: any, prev: any): InanoSQLFunctionResult =>  {
    const fnArgs = fnString.match(/\((.*)\)/gmi) as string[];
    if (!fnArgs[0]) return {result: undefined}
    const args = fnArgs[0].substr(1, fnArgs[0].length - 2).split(/\,\s?(?![^\(]*\))/).map(s => s.trim());
    const fnName = fnString.split("(").shift() as string;
    const calcArgs = args.map(s => s.indexOf("(") !== -1 ? execFunction(query, s, row, prev).result : s);
    if (!query.parent.functions[fnName]) {
        return {result: undefined}
    }
    return query.parent.functions[fnName].call(query, row, prev, ...calcArgs);
}

/**
 * Cast a javascript variable to a given type. Supports typescript primitives and more specific types.
 *
 * @param {string} type
 * @param {*} [val]
 * @returns {*}
 */
export const cast = (type: string, val: any, allowUknownTypes?: boolean, nSQL?: InanoSQLInstance): any => {

    if (type === "any" || type === "blob" || type === "*") return val;

    // recursively cast arrays
    if (type.indexOf("[]") !== -1) {
        const arrayOf = type.slice(0, type.lastIndexOf("[]"));
        // value should be array but isn't, cast it to one
        if (!Array.isArray(val)) return [];
        // we have an array, cast array of types
        return val.map((v) => cast(arrayOf, v, allowUknownTypes));
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

    const types = nSQL ? nSQL.config.types || {} : {};

    // custom type found
    if (Object.keys(types).indexOf(type) !== -1) {
        if (isObject(val)) {
            let keys: string[] = [];
            let customType: string = "";
            const typeObj = types[type];
            let returnObj = Object.keys(typeObj).reduce((prev, cur) => {
                const key = cur.split(":");
                prev[key[0]] = cast(key[1], val[key[0]], allowUknownTypes, nSQL);
                return prev;
            }, {})
            return returnObj;
        }
        return {};
    }

    const doCast = (castType: string, castVal: any) => {
        switch (castType) {
            case "safestr": return doCast("string", castVal).replace(/[&<>"'`=\/]/gmi, (s) => entityMap[s]);
            case "int": return (t !== "number" || castVal % 1 !== 0) ? Math.round(nan(castVal)) : castVal;
            case "number":
            case "float": return t !== "number" ? nan(castVal) : castVal;
            case "array": return Array.isArray(castVal) ? castVal : [];
            case "uuid":
            case "timeId":
            case "timeIdms":
            case "string": return t !== "string" ? String(castVal) : castVal;
            case "object":
            case "obj":
            case "map": return isObject(castVal) ? castVal : {};
            case "boolean":
            case "bool": return castVal === true || castVal === 1 ? true : false;
        }

        // doesn't match known types, return null;
        return allowUknownTypes ? val : null;
    };

    if (typeof val === "undefined" || val === null) return null;

    const newVal = doCast(String(type || "").toLowerCase(), val);

    // force numerical values to be a number and not NaN.
    if (newVal !== undefined && ["int", "float", "number"].indexOf(type) > -1) {
        return isNaN(newVal) ? 0 : newVal;
    }

    return newVal;
};

export const rad2deg = (rad: number): number => {
    return rad * 180 / Math.PI;
}

export const deg2rad = (deg: number): number => {
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
export const crowDistance = (lat1: number, lon1: number, lat2: number, lon2: number, radius: number = 6371): number => {

    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.pow(Math.sin(dLat / 2), 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.pow(Math.sin(dLon / 2), 2);
    return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const levenshtein = (word1: string, word2: string): number => {
    return leven(word1, word2);
}

const objectPathCache: {
    [pathQuery: string]: string[];
} = {};

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

export const getFnValue = (row: any, valueOrPath: string): any => {
    return valueOrPath.match(/\".*\"|\'.*\'/gmi) ? valueOrPath.replace(/\"|\'/gmi, "") : deepGet(valueOrPath, row);
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

export const deepSet = (pathQuery: string|string[], object: any, value: any): any => {

    const safeSet = (getPath: string[], pathIdx: number, setObj: any) => {
        if (!getPath[pathIdx + 1]) { // end of path
            setObj[getPath[pathIdx]] = value;
            return;
        } else if (!setObj[getPath[pathIdx]] || (!Array.isArray(setObj[getPath[pathIdx]]) && !isObject(setObj[getPath[pathIdx]]))) { // nested value doesn't exist yet
            if (isNaN(getPath[pathIdx + 1] as any)) { // assume number queries are for arrays, otherwise an object
                setObj[getPath[pathIdx]] = {};
            } else {
                setObj[getPath[pathIdx]] = [];
            }
        }
        safeSet(getPath, pathIdx + 1, setObj[getPath[pathIdx] as string]);
    };

    safeSet(Array.isArray(pathQuery) ? pathQuery : resolvePath(pathQuery), 0, object);

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
export const deepGet = (pathQuery: string|string[], object: any): any => {

    const safeGet = (getPath: string[], pathIdx: number, object: any) => {
        if (!getPath[pathIdx] || !object) return object;
        return safeGet(getPath, pathIdx + 1, object[getPath[pathIdx] as string]);
    };

    return safeGet(Array.isArray(pathQuery) ? pathQuery : resolvePath(pathQuery), 0, object);
};

export const maybeAssign = (obj: any): any => {
    return Object.isFrozen(obj) ? assign(obj) : obj;
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

