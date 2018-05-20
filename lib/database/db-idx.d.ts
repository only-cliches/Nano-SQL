import { NanoSQLInstance } from "..";
/**
 * Optimized in memory index used for each table.
 * Even if you're not using auto incriment, the index will gaurantee to maintain a sorted order of keys.
 * Exchanges a reduced write performance for increased read performance.
 *
 * @export
 * @class DatabaseIndex
 */
export declare class DatabaseIndex {
    private _sorted;
    private _exists;
    ai: number;
    pkType: string;
    doAI: boolean;
    sortIndex: boolean;
    private _changeCB;
    private _ta;
    constructor();
    clone(skipEvent?: boolean): DatabaseIndex;
    onChange(table: string, cb: (table: string, type: string, data: any) => void): void;
    set(index?: any[]): void;
    getLocation(key: any, startIdx?: number): number;
    add(key: any, skipEvent?: boolean): void;
    keys(): any[];
    exists(key: any): boolean;
    indexOf(key: any): number;
    remove(key: any, skipEvent?: boolean): void;
}
export declare const syncPeerIndex: (nSQL: NanoSQLInstance, idx: {
    [table: string]: DatabaseIndex;
}) => void;
