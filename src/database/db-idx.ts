import { StdObject, hash, fastALL, deepFreeze, uuid, timeid, _assign, generateID, binarySearch, isAndroid } from "../utilities";

/**
 * Optimized in memory index used for each table.
 * Even if you're not using auto incriment, the index will gaurantee to maintain a sorted order of keys.
 * Exchanges a reduced write performance for increased read performance.
 *
 * @export
 * @class DatabaseIndex
 */
export class DatabaseIndex {

    private _sorted: any[]; // sorted array of keys
    private _exists: { [k: string]: any }; // the .indexOf value for each key

    public ai: number; // auto incriment value

    public doAI: boolean; // whether we're doing auto incriment or not

    public sortIndex: boolean; // do we need to maintain sorted order of the index?  Write performance is lowered consierably with this enabled.

    constructor() {
        this._sorted = [];
        this._exists = {};
        this.ai = 1;
        this.sortIndex = true;
        this.doAI = false;
    }

    public set(index?: any[]): void {
        this._sorted = index || [];
        this._exists = {};
        this._sorted.forEach((s, i) => {
            this._exists[String(s)] = true;
        });

        if (this.doAI && this._sorted.length) {
            this.ai = this._sorted[this._sorted.length - 1] + 1;
        }
    }

    public getLocation(key: any, startIdx?: number): number {
        const idx = this.indexOf(key);
        if (idx !== -1) {
            return idx;
        }
        if (this.sortIndex) {
            return binarySearch(this._sorted, key, startIdx);
        } else {
            return 0;
        }
    }

    public add(key: any): void {
        if (this._exists[String(key)]) return;
        this._exists[String(key)] = true;
        if (!this.doAI) {
            if (this.sortIndex) {
                const idx = binarySearch(this._sorted, key);
                this._sorted.splice(idx, 0, key);
            } else {
                this._sorted.push(key);
            }
        } else {
            if (parseInt(key) >= this.ai) {
                this.ai++;
            }
            this._sorted.push(key);
        }
    }

    public keys(): any[] {
        return this._sorted;
    }

    public indexOf(key: any): number {
        if (this.sortIndex) {
            return this._exists[String(key)] ? binarySearch(this._sorted, key) : -1;
        } else {
            return this._exists[String(key)] ? this._sorted.indexOf(key) : -1;
        }
    }

    public remove(key: any): void {
        if (this._exists[String(key)]) {
            this._exists[String(key)] = false;
            const idx = this.indexOf(key);
            this._sorted.splice(idx, 1);
        }
    }
}