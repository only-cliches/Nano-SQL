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
    private _indexOf;
    ai: number;
    doAI: boolean;
    constructor();
    set(index?: any[]): void;
    getLocation(key: any): number;
    add(key: any): void;
    keys(): any[];
    indexOf(key: any): number;
    remove(key: any): void;
}
