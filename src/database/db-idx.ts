import { StdObject, hash, fastALL, deepFreeze, uuid, timeid, _assign, generateID, binarySearch, isAndroid, random16Bits } from "../utilities";
import { NanoSQLInstance } from "..";

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

    public pkType: string; // what type is the primary key?

    public doAI: boolean; // whether we're doing auto incriment or not

    public sortIndex: boolean; // do we need to maintain sorted order of the index?  Write performance is lowered consierably with this enabled.

    private _changeCB: (table: string, type: string, data: any) => void;
    private _ta: string;

    constructor() {
        this._sorted = [];
        this._exists = {};
        this.ai = 1;
        this.sortIndex = true;
        this.doAI = false;
    }

    public clone(skipEvent?: boolean) {
        if (this._changeCB && !skipEvent) this._changeCB(this._ta, "drop", null);
        const idx = new DatabaseIndex();
        idx.doAI = this.doAI;
        idx.ai = this.ai;
        idx.sortIndex = this.sortIndex;
        idx._changeCB = this._changeCB;
        idx._ta = this._ta;
        idx.pkType = this.pkType;
        if (skipEvent) {
            this.set([]);
        }
        return idx;
    }

    public onChange(table: string, cb: (table: string, type: string, data: any) => void) {
        this._ta = table;
        this._changeCB = cb;
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
            return binarySearch(this._sorted.sort((a, b) => a > b ? 1 : -1), key, startIdx);
        }
    }

    public add(key: any, skipEvent?: boolean): void {
        if (this._exists[String(key)]) return;
        if (this._changeCB && !skipEvent) this._changeCB(this._ta, "add", key);
        this._exists[String(key)] = true;
        if (skipEvent && ["number", "int", "float"].indexOf(this.pkType) !== -1) {
            key = parseFloat(key);
        }
        if (!this.doAI) {
            if (this.sortIndex) {
                const idx = binarySearch(this._sorted, key);
                this._sorted.splice(idx, 0, key);
            } else {
                this._sorted.push(key);
            }
        } else {
            this.ai++;
            this._sorted.push(key);
        }
    }

    public keys(): any[] {
        return this._sorted;
    }

    public exists(key: any): boolean {
        return this._exists[String(key)] ? true : false;
    }

    public indexOf(key: any): number {
        if (!this._exists[String(key)]) return -1;
        return this.sortIndex ? binarySearch(this._sorted, key) : this._sorted.indexOf(key);
    }

    public remove(key: any, skipEvent?: boolean): void {
        if (this._changeCB && !skipEvent) this._changeCB(this._ta, "rm", key);
        if (skipEvent && ["number", "int", "float"].indexOf(this.pkType) !== -1) {
            key = parseFloat(key);
        }
        if (this._exists[String(key)]) {
            const idx = this.indexOf(key);
            this._exists[String(key)] = false;
            this._sorted.splice(idx, 1);
        }
    }
}

export const syncPeerIndex = (nSQL: NanoSQLInstance, idx: {[table: string]: DatabaseIndex}) => {
    if (nSQL.peerMode) {
        Object.keys(idx).forEach((table) => {
            idx[table].onChange(table, (table, type, data) => {
                nSQL.peers.filter(p => p !== nSQL.pid).forEach((peer) => {
                    localStorage.setItem(peer + "::" + random16Bits().toString(16), type + "," + table + "," + (data || ""));
                });
            });
        });
        window.addEventListener("storage", (e) => {
            if (e.key && e.key.indexOf(nSQL.pid + "::") !== -1) {
                const data = (e.newValue || "").split(",");
                localStorage.removeItem(e.key);
                switch (data[0]) {
                    case "rm":
                        idx[data[1]].remove(data[2], true);
                        break;
                    case "add":
                        idx[data[1]].add(data[2], true);
                        break;
                    case "drop":
                        idx[data[1]].clone(true);
                        break;
                }
            }
        });
    }
};