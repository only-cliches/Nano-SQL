import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "./storage";
import { DataModel } from "../index";
import { setFast } from "lie-ts";
import { StdObject, hash, fastALL, deepFreeze, uuid, timeid, _assign, generateID, sortedInsert } from "../utilities";
import { DatabaseIndex } from "./db-idx";


/**
 * Handles all available syncronous versions of storage (memory and localstorage)
 *
 * @export
 * @class _SyncStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
export class _SyncStore implements NanoSQLStorageAdapter {

    private _rows: {
        [tableName: string]: {
            [key: string]: any;
        }
    };

    private _pkKey: {
        [tableName: string]: string;
    };

    private _pkType: {
        [tableName: string]: string;
    };

    private _dbIndex: {
        [tableName: string]: DatabaseIndex;
    };

    private _ls: boolean;

    private _id: string;

    constructor(useLocalStorage?: boolean) {
        this._pkKey = {};
        this._pkType = {};
        this._rows = {};
        this._dbIndex = {};
        this._ls = useLocalStorage || false;
    }

    public connect(complete: () => void) {
        complete();
    }

    public setID(id: string) {
        this._id = id;
    }

    public makeTable(tableName: string, dataModels: DataModel[]): void {
        this._rows[tableName] = {};
        this._dbIndex[tableName] = new DatabaseIndex();

        dataModels.forEach((d) => {
            if (d.props && d.props.indexOf("pk") > -1) {
                this._pkType[tableName] = d.type;
                this._pkKey[tableName] = d.key;
            }

            if (d.props && d.props.indexOf("ai") > -1 && d.props.indexOf("pk") > -1 && d.type === "int") {
                this._dbIndex[tableName].doAI = true;
            }

            if (this._ls) {
                const index = localStorage.getItem(this._id + "*" + tableName + "_idx");
                if (index) {
                    this._dbIndex[tableName].set(JSON.parse(index));
                }
            }
        });
    }

    public write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void): void {

        pk = pk || generateID(this._pkType[table], this._dbIndex[table].ai) as DBKey;

        if (!pk) {
            throw new Error("Can't add a row without a primary key!");
        }


        if (this._dbIndex[table].indexOf(pk) === -1) {

            this._dbIndex[table].add(pk);

            if (this._ls) {
                localStorage.setItem(this._id + "*" + table + "_idx", JSON.stringify(this._dbIndex[table].keys()));
            }
        }

        if (this._ls) {
            const r = {
                ...data,
                [this._pkKey[table]]: pk,
            };
            localStorage.setItem(this._id + "*" + table + "__" + pk, JSON.stringify(r));
            complete(r);
        } else {

            const r = {
                ...data,
                [this._pkKey[table]]: pk,
            };
            this._rows[table][pk as any] = deepFreeze(r);
            complete(r);

        }
    }

    public delete(table: string, pk: DBKey, complete: () => void): void {
        let idx = this._dbIndex[table].indexOf(pk);
        if (idx !== -1) {
            this._dbIndex[table].remove(pk);
            if (this._ls) {
                localStorage.setItem(this._id + "*" + table + "_idx", JSON.stringify(this._dbIndex[table].keys()));
            }
        }
        if (this._ls) {
            localStorage.removeItem(this._id + "*" + table + "__" + pk);
        } else {
            delete this._rows[table][pk as any];
        }
        complete();
    }

    public read(table: string, pk: DBKey, callback: (row: DBRow) => void): void {
        if (this._ls) {
            let r = localStorage.getItem(this._id + "*" + table + "__" + pk);
            callback(r ? JSON.parse(r) : undefined);
        } else {
            callback(this._rows[table][pk as any]);
        }
    }

    public rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void {
        const keys = this._dbIndex[table].keys();
        const usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        let ranges: number[] = usefulValues ? [from as any, to as any] : [0, keys.length - 1];
        if (!keys.length) {
            complete();
            return;
        }

        if (usePK && usefulValues) {
            ranges = ranges.map(r => this._dbIndex[table].getLocation(r));
        }

        let idx = ranges[0];
        let i = 0;

        const rowDone = () => {
            idx++;
            i++;
            i % 500 === 0 ? setFast(getRow) : getRow(); // handle maximum call stack error
        };

        const getRow = () => {
            if (idx <= ranges[1]) {
                if (this._ls) {
                    let r = localStorage.getItem(this._id + "*" + table + "__" + keys[idx]);
                    rowCallback(r ? JSON.parse(r) : undefined, idx, rowDone);
                } else {
                    rowCallback(this._rows[table][keys[idx]], idx, rowDone);
                }

            } else {
                complete();
            }
        };
        getRow();
    }

    public drop(table: string, callback: () => void): void {

        if (this._ls) {
            localStorage.setItem(this._id + "*" + table + "_idx", JSON.stringify([]));
            this._dbIndex[table].keys().forEach((key) => {
                localStorage.removeItem(this._id + "*" + table + "__" + key);
            });
        } else {
            this._rows[table] = {};
        }

        let idx = new DatabaseIndex();
        idx.doAI = this._dbIndex[table].doAI;
        this._dbIndex[table] = idx;
        callback();
    }

    public getIndex(table: string, getLength: boolean, complete: (index) => void): void {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    }

    public destroy(complete: () => void) {
        fastALL(Object.keys(this._dbIndex), (table, i, done) => {
            this.drop(table, done);
        }).then(complete);
    }
}