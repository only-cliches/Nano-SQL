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
/**
 * Object.assign, but better.
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
export declare const fastCHAIN: (items: any[], callback: (item: any, i: number, next: (result?: any) => void) => void) => Promise<any[]>;
/**
 * Quickly and efficiently fire asyncrounous operations in parallel, returns once any operation completes.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, next: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export declare const fastRACE: (items: any[], callback: (item: any, i: number, next: (result?: any) => void) => void) => Promise<any[]>;
/**
 * Quickly and efficiently fire asyncrounous operations in parallel, returns once all operations are complete.
 *
 * @param {any[]} items
 * @param {(item: any, i: number, done: (result?: any) => void) => void} callback
 * @returns {Promise<any[]>}
 */
export declare const fastALL: (items: any[], callback: (item: any, i: number, done: (result?: any) => void) => void) => Promise<any[]>;
export declare const isSafari: boolean;
export declare const isMSBrowser: boolean;
export declare const isAndroid: boolean;
/**
 * Generate a random 16 bit number using strongest crypto available.
 *
 * @returns {number}
 */
export declare const random16Bits: () => number;
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
 * stolen from https://github.com/darkskyapp/string-hash
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
 * Insert a value into a sorted array, efficiently gaurantees records are sorted on insert.
 *
 * @param {any[]} arr
 * @param {*} value
 * @param {number} [startVal]
 * @param {number} [endVal]
 * @returns {any[]}
 */
export declare const sortedInsert: (arr: any[], value: any, startVal?: number | undefined, endVal?: number | undefined) => any[];
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
 * Take an object and a string describing a path like "value.length" or "val[length]" and safely get that value in the object.
 *
 * @param {string} pathQuery
 * @param {*} object
 * @param {boolean} [ignoreFirstPath]
 * @returns {*}
 */
export declare const objQuery: (pathQuery: string, object: any, ignoreFirstPath?: boolean | undefined) => any;
