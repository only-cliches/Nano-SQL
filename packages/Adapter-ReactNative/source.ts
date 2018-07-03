import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "nano-sql/lib/database/storage";
import { DataModel, NanoSQLInstance } from "nano-sql/lib/index";
import { StdObject, hash, fastALL, fastCHAIN, deepFreeze, uuid, timeid, _assign, generateID, intersect } from "nano-sql/lib/utilities";
import { AsyncStorage } from "react-native";
import { setFast } from "lie-ts";
import { DatabaseIndex } from "nano-sql/lib/database/db-idx";

export class ReactNativeAdapter implements NanoSQLStorageAdapter {

    private _id: string;

    private _pkKey: {
        [tableName: string]: string;
    };

    private _dbIndex: {
        [tableName: string]: DatabaseIndex;
    };

    private _writeIdx: {
        [tableName: string]: any;
    }

    constructor() {
        this._pkKey = {};
        this._writeIdx = {};
        this._dbIndex = {};
    }

    /**
     * The ID of the database provided by nanoSQL
     * 
     * @param {string} id 
     * @memberof SampleAdapter
     */
    public setID(id: string) {
        this._id = id;
    }

    public key(table: string, id: any) {
        return this._id + "::" + table + "::" + String(id);
    }

    /**
     * Async function to connect the database to it's backend.
     * 
     * Call complete() once a succesfull connection has been made, otherwise throw an error
     * 
     * @param {() => void} complete 
     * @memberof SampleAdapter
     */
    public connect(complete: () => void) {
        fastALL(Object.keys(this._dbIndex), (table, i, done) => {
            AsyncStorage.getItem(this.key(table, "_idx_")).then((result) => {
                this._dbIndex[table].set(JSON.parse(result || "[]") || []);
                done();
            }).catch((err) => {
                throw err;
            });
        }).then(complete);
    }


    /**
     * Called for every table the database needs to use.
     * Don't do any async work here, just save any details needed to perform the necessary async work in the connect() method.
     * 
     * @param {string} tableName 
     * @param {DataModel[]} dataModels 
     * @memberof SampleAdapter
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

                if (d.props && intersect(["ns", "ns()"], d.props) || ["uuid", "timeId", "timeIdms"].indexOf(this._dbIndex[tableName].pkType) !== -1) {
                    this._dbIndex[tableName].sortIndex = false;
                }
            }
        });
    }

    public writeIndex(table: string) {
        if (this._writeIdx[table]) {
            clearTimeout(this._writeIdx[table]);
        }

        this._writeIdx[table] = setTimeout(() => {
            AsyncStorage.setItem(this.key(table, "_idx_"), JSON.stringify(this._dbIndex[table].keys()));
        }, 1000);
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
     * @memberof SampleAdapter
     */
    public write(table: string, pk: DBKey | null, newData: DBRow, complete: (row: DBRow) => void): void {
        pk = pk || generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai) as DBKey;

        if (!pk) {
            throw new Error("Can't add a row without a primary key!");
        }


        if (this._dbIndex[table].indexOf(pk) === -1) {

            this._dbIndex[table].add(pk);

            this.writeIndex(table);
        }

        const row = {
            ...newData,
            [this._pkKey[table]]: pk,
        };

        AsyncStorage.setItem(this.key(table, pk), JSON.stringify(row)).then(() => {
            complete(row);
        }).catch((err) => {
            throw err;
        })
    }

    /**
     * A table and primary key will be provided, call complete when the row is gone from the database
     * 
     * @param {string} table 
     * @param {DBKey} pk Primary Key
     * @param {() => void} complete 
     * @memberof SampleAdapter
     */
    public delete(table: string, pk: DBKey, complete: () => void): void {
        AsyncStorage.removeItem(this.key(table, pk)).then(() => {
            this._dbIndex[table].remove(pk);
            this.writeIndex(table);
            complete();
        }).catch((err) => {
            throw err;
        })
    }

    /**
     * OPTIONAL METHOD
     * An array of primary keys is provided, return all the rows with those primary keys.
     * 
     * @param {string} table 
     * @param {DBKey[]} pks 
     * @param {(rows: any[]) => void} callback 
     * @memberof SampleAdapter
     */
    public batchRead(table: string, pks: DBKey[], callback: (rows: any[]) => void) {
        AsyncStorage.multiGet(pks.map(pk => this.key(table, pk))).then((rows) => {
            callback(rows.map(r => JSON.parse(r[1])));
        }).catch((err) => {
            throw err;
        })
    }

    /**
     * Return a single row given it's primary key
     * 
     * @param {string} table 
     * @param {DBKey} pk 
     * @param {(row: DBRow) => void} callback 
     * @memberof SampleAdapter
     */
    public read(table: string, pk: DBKey, callback: (row: DBRow) => void): void {
        AsyncStorage.getItem(this.key(table, pk)).then((row) => {
            callback(JSON.parse(row));
        }).catch((err) => {
            throw err;
        });
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
     * @memberof SampleAdapter
     */
    public rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void {
        let keys = this._dbIndex[table].keys();
        const usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        let ranges: number[] = usefulValues ? [from as any, to as any] : [0, keys.length - 1];
        if (!keys.length) {
            complete();
            return;
        }

        
        let pks: any[] = [];

        if (usePK && usefulValues) {
            if (this._dbIndex[table].sortIndex) {
                ranges = ranges.map(r => this._dbIndex[table].getLocation(r));
            } else {
                keys.sort().forEach((key) => {
                    if (key >= ranges[0] && key <= ranges[1]) {
                        pks.push(key);
                    }
                });
            }
        } else {
            let idx = ranges[0];
            if (!this._dbIndex[table].sortIndex) {
                keys = keys.sort();
            }
            while (idx <= ranges[1]) {
                pks.push(keys[idx]);
                idx++;
            }
        }

        AsyncStorage.multiGet(pks.map(pk => this.key(table, pk))).then((rows) => {
            fastCHAIN(rows.map(r => JSON.parse(r[1])), (row, i, next) => {
                rowCallback(row, i, next);
            }).then(complete);
        })
    }

    /**
     * Delete every row in the given table
     * 
     * @param {string} table 
     * @param {() => void} callback 
     * @memberof SampleAdapter
     */
    public drop(table: string, callback: () => void): void {
        AsyncStorage.multiRemove(this._dbIndex[table].keys().map(k => this.key(table, k))).then(() => {
            let idx = new DatabaseIndex();
            idx.doAI = this._dbIndex[table].doAI;
            this._dbIndex[table] = idx;
            this.writeIndex(table);
            callback();
        }).catch((err) => {
            throw err;
        })
    }

    /**
     * Get a copy of the database index or just the length of the database index.
     * 
     * @param {string} table 
     * @param {boolean} getLength 
     * @param {(index) => void} complete 
     * @memberof SampleAdapter
     */
    public getIndex(table: string, getLength: boolean, complete: (index) => void): void {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    }

    /**
     * Used only by the testing system, completely remove all tables and everything.
     * 
     * @param {() => void} complete 
     * @memberof SampleAdapter
     */
    public destroy(complete: () => void) {
        fastALL(Object.keys(this._dbIndex), (table, i, done) => {
            this.drop(table, done);
        }).then(complete);
    }

    /**
     * OPTIONAL METHOD
     * Provides the nano-sql instance this adapter is attached to.
     * 
     * @param {NanoSQLInstance} nsql 
     * @memberof SampleAdapter
     */
    public setNSQL(nsql: NanoSQLInstance) {

    }
}
