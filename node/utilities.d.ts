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
export declare class CHAIN {
    callbacks: ((next: (result?: any) => void) => void)[];
    constructor(callbacks: ((next: (result?: any) => void) => void)[]);
    then(complete: (results: any[]) => void): void;
}
export declare class ALL {
    callbacks: ((result: (result?: any) => void) => void)[];
    constructor(callbacks: ((result: (result?: any) => void) => void)[]);
    then(complete: (results: any[]) => void): void;
}
export declare const isSafari: boolean;
export declare const isMSBrowser: boolean;
export declare const isAndroid: boolean;
export declare const random16Bits: () => number;
export declare const timeid: (ms?: boolean | undefined) => string;
export declare const uuid: () => string;
export declare const hash: (key: string) => string;
export declare const generateID: (primaryKeyType: string, incrimentValue?: number | undefined) => any;
export declare const cleanArgs: (argDeclarations: string[], args: StdObject<any>) => StdObject<any>;
export declare const isObject: (val: any) => boolean;
export declare const cast: (type: string, val?: any) => any;
export declare const sortedInsert: (arr: any[], value: any, startVal?: number | undefined, endVal?: number | undefined) => any[];
export declare const binarySearch: (arr: any[], value: any, startVal?: number | undefined, endVal?: number | undefined) => number;
export declare const removeDuplicates: (arr: any[]) => any[];
export declare const deepFreeze: (obj: any) => any;
export declare const objQuery: (pathQuery: string, object: any, ignoreFirstPath?: boolean | undefined) => any;
