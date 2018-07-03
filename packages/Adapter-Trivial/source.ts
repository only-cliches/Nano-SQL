import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "nano-sql/lib/database/storage";
import { DataModel, NanoSQLInstance } from "nano-sql/lib/index";
import { StdObject, hash, fastALL, deepFreeze, uuid, timeid, _assign, generateID, intersect, fastCHAIN } from "nano-sql/lib/utilities";
import { DatabaseIndex } from "nano-sql/lib/database/db-idx";
const trivialdb = require('trivialdb');
import { setFast } from "lie-ts";

export interface trivialDBOpts {
    writeToDisk?: boolean;
    loadFromDisk?: boolean;
    rootPath?: string;
    dbPath?: string;
    writeDelay?: number;
    prettyPrint?: boolean;
    idFunc?: () => string;
};

export interface trivialDB {
    load: (key: any) => Promise<any>;
    save: (key: any, value: any) => Promise<any>;
    remove: (keyObj: { [primaryKeyCol: string]: any }) => Promise<any>;
    clear: () => Promise<any>;
    loading: Promise<any>;
    filter: (filterFunc: (value: any, key: any) => boolean) => void;
}

export class TrivialAdapter implements NanoSQLStorageAdapter {

    private _id: string;
    private _dbs: {
        [tableName: string]: trivialDB
    }

    private ns: {
        db: (name: string, dbOpts?: trivialDBOpts) => trivialDB;
    };

    private _pkKey: {
        [tableName: string]: string;
    };

    private _dbIndex: {
        [tableName: string]: DatabaseIndex;
    };

    constructor(public nameSpaceOpts?: {
        basePath?: string;
        dbPath?: string;
    }, public dbOpts?: trivialDBOpts) {
        this._pkKey = {};
        this._dbIndex = {};
    }

    /**
     * The ID of the database provided by nanoSQL
     * 
     * @param {string} id 
     * @memberof TrivalAdapter
     */
    public setID(id: string) {
        this._id = id;
        this._dbs = {};
    }

    /**
     * Async function to connect the database to it's backend.
     * 
     * Call complete() once a succesfull connection has been made, otherwise throw an error
     * 
     * @param {() => void} complete 
     * @memberof TrivalAdapter
     */
    public connect(complete: () => void) {
        this.ns = trivialdb.ns(this._id, this.nameSpaceOpts);

        fastCHAIN(Object.keys(this._dbIndex), (tableName, i, next) => {
            this._dbs[tableName] = this.ns.db(tableName, {
                pk: this._pkKey[tableName],
                ...this.dbOpts
            } as any);
            this._dbs[tableName].loading.then(() => {

                this._dbs[tableName].filter((val, key) => {
                    this._dbIndex[tableName].add(key);
                    return false;
                })
                next();

            }).catch((err) => {
                throw new Error(err);
            })
        }).then(complete);
    }

    /**
     * Called for every table the database needs to use.
     * Don't do any async work here, just save any details needed to perform the necessary async work in the connect() method.
     * 
     * @param {string} tableName 
     * @param {DataModel[]} dataModels 
     * @memberof TrivalAdapter
     */
    public makeTable(tableName: string, dataModels: DataModel[]): void {
        this._dbIndex[tableName] = new DatabaseIndex();

        dataModels.forEach((d) => {
            if (d.props && intersect(["pk", "pk()"], d.props)) {
                this._dbIndex[tableName].pkType = d.type;
                this._pkKey[tableName] = d.key;

                if (d.props && intersect(["ai", "ai()"], d.props) && (d.type === "int" || d.type === "number")) {
                    this._dbIndex[tableName].doAI = true;
                }
            }
        });
    }

    /**
     * When a write command is sent to the database, this is called.  A few different situations need to be handled.
     * 1. Primary key is provided but row doesn't exist (new row with provided primary key)
     * 2. Primary key is provided and row does exist (replace existing row)
     * 3. Primary key isn't provided and row doesn't exist.
     * 
     * All writes are a full replace of the whole row, partial updates will not be passed here.
     * 
     * @param {string} table 
     * @param {(DBKey | null)} pk Primary Key
     * @param {DBRow} newData 
     * @param {(row: DBRow) => void} complete 
     * @param {boolean} skipReadBeforeWrite 
     * @memberof TrivalAdapter
     */
    public write(table: string, pk: DBKey | null, newData: DBRow, complete: (row: DBRow) => void): void {
        pk = pk || generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai) as DBKey;

        if (!pk) {
            throw new Error("nSQL: Can't add a row without a primary key!");
        }

        if (this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
        }

        const r = {
            ...newData,
            [this._pkKey[table]]: pk,
        };
        this._dbs[table].save(pk, r).then(() => {
            complete(r);
        }).catch((err) => {
            throw new Error(err);
        });
    }

    /**
     * A table and primary key will be provided, call complete when the row is gone from the database
     * 
     * @param {string} table 
     * @param {DBKey} pk Primary Key
     * @param {() => void} complete 
     * @memberof TrivalAdapter
     */
    public delete(table: string, pk: DBKey, complete: () => void): void {
        let idx = this._dbIndex[table].indexOf(pk);
        if (idx !== -1) {
            this._dbIndex[table].remove(pk);
        }

        this._dbs[table].remove({ [this._pkKey[table]]: pk }).then((removedIds) => {
            complete();
        }).catch((err) => {
            throw new Error(err);
        });
    }

    /**
     * Return a single row given it's primary key
     * 
     * @param {string} table 
     * @param {DBKey} pk 
     * @param {(row: DBRow) => void} callback 
     * @memberof TrivalAdapter
     */
    public read(table: string, pk: DBKey, callback: (row: DBRow) => void): void {
        this._dbs[table].load(pk).then(callback).catch((err) => {
            callback(undefined as any);
        })
    }

    /**
     * This method is used to get a section of rows or all rows in a table.
     * For every row requested rowCallback() should be called, then nextRow() will be called by nanoSQL when it's ready for the next row.
     * 
     * No rows are passed into the complete() function, that's only called after the last row has been passed into rowCallback()
     * 
     * The method should support the following situations:
     * 1. from, to, and usePK are all undefined: return whole table.
     * 2. from and to are provided, usePK is false: return rows inside a given number range, for example return the 10th row to the 20th row (assuming primary keys are sorted).
     * 3. from and to are provided, usePK is true: return rows inside a range of primary keys
     * 
     * 
     * @param {string} table 
     * @param {(row: DBRow, idx: number, nextRow: () => void) => void} rowCallback 
     * @param {() => void} complete 
     * @param {*} [from] 
     * @param {*} [to] 
     * @param {boolean} [usePK] 
     * @memberof TrivalAdapter
     */
    public rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void {
        let keys = this._dbIndex[table].keys();
        const usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        let ranges: number[] = usefulValues ? [from as any, to as any] : [0, keys.length - 1];
        if (!keys.length) {
            complete();
            return;
        }

        if (this._dbIndex[table].sortIndex === false) {
            keys = keys.sort();
        }

        if (usePK && usefulValues) {
            ranges = ranges.map(r => {
                const idxOf = this._dbIndex[table].indexOf(r);
                return idxOf !== -1 ? idxOf : this._dbIndex[table].getLocation(r);
            });
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
                this._dbs[table].load(keys[idx]).then((row) => {
                    rowCallback(row, idx, rowDone);
                }).catch((err) => {
                    throw new Error(err);
                });
            } else {
                complete();
            }
        };
        getRow();
    }

    /**
     * Delete every row in the given table
     * 
     * @param {string} table 
     * @param {() => void} callback 
     * @memberof TrivalAdapter
     */
    public drop(table: string, callback: () => void): void {

        this._dbs[table].clear().then(() => {
            let idx = new DatabaseIndex();
            idx.doAI = this._dbIndex[table].doAI;
            idx.sortIndex = this._dbIndex[table].sortIndex;
            this._dbIndex[table] = idx;
            callback();
        }).catch((err) => {
            throw new Error(err);
        });
    }

    /**
     * Get a copy of the database index or just the length of the database index.
     * 
     * @param {string} table 
     * @param {boolean} getLength 
     * @param {(index) => void} complete 
     * @memberof TrivalAdapter
     */
    public getIndex(table: string, getLength: boolean, complete: (index) => void): void {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    }

    /**
     * Used only by the testing system, completely remove all tables and everything.
     * 
     * @param {() => void} complete 
     * @memberof TrivalAdapter
     */
    public destroy(complete: () => void) {
        fastALL(Object.keys(this._dbIndex), (table, i, done) => {
            this.drop(table, done);
        }).then(complete);
    }
}
