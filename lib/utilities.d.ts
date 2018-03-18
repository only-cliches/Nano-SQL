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
export declare const _assign: (obj: any) => any;
export declare const fastCHAIN: (items: any[], callback: (item: any, i: number, next: (result?: any) => void) => void) => Promise<any>;
export declare const fastRACE: (items: any[], callback: (item: any, i: number, next: (result?: any) => void) => void) => Promise<any>;
export declare const fastALL: (items: any[], callback: (item: any, i: number, done: (result?: any) => void) => void) => Promise<any>;
export declare const isSafari: boolean;
export declare const isMSBrowser: boolean;
export declare const isAndroid: boolean;
export declare const random16Bits: () => number;
export declare const timeid: (ms?: boolean | undefined) => string;
export declare const uuid: () => string;
export declare const hash: (str: string) => string;
export declare const generateID: (primaryKeyType: string, incrimentValue?: number | undefined) => any;
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
 * Insert a value into a given array, efficiently gaurantees records are sorted on insert.
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
 * Take an object and a string like "value.length" or "val[length]" and safely get that value in the object.
 *
 * @param {string} pathQuery
 * @param {*} object
 * @param {boolean} [ignoreFirstPath]
 * @returns {*}
 */
export declare const objQuery: (pathQuery: string, object: any, ignoreFirstPath?: boolean | undefined) => any;
