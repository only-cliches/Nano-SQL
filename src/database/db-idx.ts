import { StdObject, hash, ALL, CHAIN, deepFreeze, uuid, timeid, _assign, generateID, binarySearch, isAndroid } from "../utilities";

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
    private _indexOf: {[k: string]: any}; // the .indexOf value for each key

    public ai: number; // auto incriment value

    public doAI: boolean; // whether we're doing auto incriment or not

    constructor() {
        this._sorted = [];
        this._indexOf = {};
        this.ai = 1;
        this.doAI = false;
    }

    public set(index?: any[]): void {
        this._sorted = index || [];
        this._indexOf = {};
        this._sorted.forEach((s, i) => {
            this._indexOf[String(s)] = i;
        });

        if (this.doAI && this._sorted.length) {
            const l = this._sorted.length;
            this.ai = this._sorted[l - 1] + 1;
        }
    }

    public getLocation(key: any): number {
        const idx = this.indexOf(key);
        if (idx !== -1) {
            return idx;
        }
        return binarySearch(this._sorted, key);
    }

    public add(key: any): void {

        if (!this.doAI) {
            const idx = binarySearch(this._sorted, key);
            this._sorted.splice(idx, 0, key);
            this._indexOf[String(key)] = idx;
            for (let i = idx + 1; i < this._sorted.length; i++) {
                this._indexOf[String(this._sorted[i])]++;
            }
        } else {
            if (parseInt(key) >= this.ai) {
                this.ai++;
            }
            this._indexOf[String(key)] = this._sorted.length;
            this._sorted.push(key);
        }
    }

    public keys(): any[] {
        return this._sorted;
    }

    public indexOf(key: any): number {
        return this._indexOf[String(key)] || -1;
    }

    public remove(key: any): void {
        const idx = this._indexOf[String(key)];
        if (idx !== undefined) {
            delete this._indexOf[String(key)];
            this._sorted.splice(idx, 1);
            for (let i = idx; i < this._sorted.length; i++) {
                this._indexOf[String(this._sorted[i])]--;
            }
        }
    }
}