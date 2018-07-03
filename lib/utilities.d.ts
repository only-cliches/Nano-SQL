export declare const Promise: any;
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
export interface timeId extends String {
}
export interface timeIdms extends String {
}
export declare const stopWords: string[];
/**
 * Object.assign, but faster.
 *
 * @param {*} obj
 * @returns
 */
export declare const _assign: (obj: any) => any;
/**
 * Quickly and efficiently fire asyncrounous operations in sequence, returns once all operations complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export declare const fastCHAIN: (items: any[], callback: (item: any, i: number, next: (result?: any) => void, err: (result: any) => void) => void) => Promise<any[]>;
/**
 * Quickly and efficiently fire asyncrounous operations in parallel, returns once first operation completes.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export declare const fastRACE: (items: any[], callback: (item: any, i: number, next: (result?: any) => void, err: (result: any) => void) => void) => Promise<any[]>;
/**
 * Quickly and efficiently fire asyncrounous operations in parallel, returns once all operations are complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, done: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export declare const fastALL: (items: any[], callback: (item: any, i: number, done: (result?: any) => void, err: (result: any) => void) => void) => Promise<any[]>;
export declare const isSafari: boolean;
export declare const isMSBrowser: boolean;
export declare const isAndroid: boolean;
/**
 * Generate a random 16 bit number using strongest entropy/crypto available.
 *
 * @returns {number}
 */
export declare const random16Bits: () => number;
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
export declare const tokenizer: (table: string, column: string, args: string[], value: string, fractionFixed?: number | undefined) => {
    o: string;
    w: string;
    i: number;
}[];
/**
 * Generate a TimeID for use in the database.
 *
 * @param {boolean} [ms]
 * @returns {string}
 */
export declare const timeid: (ms?: boolean | undefined) => string;
/**
 * See if two arrays intersect.
 *
 * @param {any[]} arr1
 * @param {any[]} arr2
 * @returns {boolean}
 */
export declare const intersect: (arr1: any[], arr2: any[]) => boolean;
/**
 * Generates a valid V4 UUID using the strongest crypto available.
 *
 * @returns {string}
 */
export declare const uuid: () => string;
/**
 * A quick and dirty hashing function, turns a string into a md5 style hash.
 * Stolen from https://github.com/darkskyapp/string-hash
 *
 * @param {string} str
 * @returns {string}
 */
export declare const hash: (str: string) => string;
/**
 * Generate a row ID given the primary key type.
 *
 * @param {string} primaryKeyType
 * @param {number} [incrimentValue]
 * @returns {*}
 */
export declare const generateID: (primaryKeyType: string, incrimentValue?: number | undefined) => any;
/**
 * Clean the arguments from an object given an array of arguments and their types.
 *
 * @param {string[]} argDeclarations
 * @param {StdObject<any>} args
 * @returns {StdObject<any>}
 */
export declare const cleanArgs: (argDeclarations: string[], args: StdObject<any>) => StdObject<any>;
/**
 * Determine if a given value is a javascript object or not. Exludes Arrays, Functions, Null, Undefined, etc.
 *
 * @param {*} val
 * @returns {boolean}
 */
export declare const isObject: (val: any) => boolean;
/**
 * Cast a javascript variable to a given type. Supports typescript primitives and more specific types.
 *
 * @param {string} type
 * @param {*} [val]
 * @returns {*}
 */
export declare const cast: (type: string, val?: any) => any;
/**
 * Given a sorted array and a value, find where that value fits into the array.
 *
 * @param {any[]} arr
 * @param {*} value
 * @param {number} [startVal]
 * @param {number} [endVal]
 * @returns {number}
 */
export declare const binarySearch: (arr: any[], value: any, startVal?: number | undefined, endVal?: number | undefined) => number;
/**
 * Quickly removes duplicates from a sorted array.
 *
 * @param {any[]} arr
 * @returns {any[]}
 */
export declare const removeDuplicates: (arr: any[]) => any[];
/**
 * Recursively freeze a javascript object to prevent it from being modified.
 *
 * @param {*} obj
 * @returns
 */
export declare const deepFreeze: (obj: any) => any;
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
export declare const crowDistance: (lat1: number, lon1: number, lat2: number, lon2: number, radius?: number) => number;
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
export declare const objQuery: (pathQuery: string, object: any, ignoreFirstPath?: boolean | undefined) => any;
