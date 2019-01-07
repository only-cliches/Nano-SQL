import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "nano-sql/lib/database/storage";
import { DataModel } from "nano-sql/lib/index";
import { setFast } from "lie-ts";
import { StdObject, hash, fastALL, fastCHAIN, splitArr, deepFreeze, uuid, timeid, _assign, generateID, isAndroid, intersect } from "nano-sql/lib/utilities";
import { DatabaseIndex } from "nano-sql/lib/database/db-idx";

declare const cordova: any;

export interface CordovaSQLiteDB {
    sqlBatch: (queries: (string|any[])[], onSuccess: () => void, onFail: (err: Error) => void) => void;
    executeSql: (sql: string, vars: any[], onSuccess: (result: SQLResultSet) => void, onFail: (err: Error) => void) => void;
}

export const getMode = () => {
    if (typeof cordova !== "undefined" && window["sqlitePlugin"]) {
        if (window["device"] && window["device"].platform && window["device"].platform !== "browser") {
            return new SQLiteStore();
        } else {
            return "PERM";
        }
    } else {
        return "PERM";
    }
};

/**
 * Handles WebSQL persistent storage
 *
 * @export
 * @class _SyncStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
export class SQLiteStore implements NanoSQLStorageAdapter {


    private _pkKey: {
        [tableName: string]: string;
    };

    private _dbIndex: {
        [tableName: string]: DatabaseIndex;
    };

    private _pkIsNum: {
        [tableName: string]: boolean;
    };


    private _id: string;

    private _db: CordovaSQLiteDB;

    constructor() {
        this._pkKey = {};
        this._dbIndex = {};
        this._pkIsNum = {};
    }

    public setID(id: string) {
        this._id = id;
    }

    public connect(complete: () => void) {
        if (!window["sqlitePlugin"]) {
            throw Error("SQLite plugin not installed or nanoSQL plugin called before device ready!");
        }
        console.log(`NanoSQL "${this._id}" using SQLite.`);
        this._db = window["sqlitePlugin"].openDatabase({name: `${this._id}_db`, location: "default"});

        fastALL(Object.keys(this._pkKey), (table, i, nextKey) => {
            this._sql(true, `CREATE TABLE IF NOT EXISTS "${table}" (id ${this._pkIsNum[table] ? "REAL" : "TEXT"} PRIMARY KEY UNIQUE, data TEXT)`, [], () => {
                this._sql(false, `SELECT id FROM "${table}"`, [], (result) => {
                    let idx: any[] = [];
                    for (let i = 0; i < result.rows.length; i++) {
                        idx.push(result.rows.item(i).id);
                    }
                    // SQLite doesn't sort primary keys, but the system depends on sorted primary keys
                    idx = idx.sort();
                    this._dbIndex[table].set(idx);
                    nextKey();
                });
            });
        }).then(complete);
    }

    /**
     * Table names can't be escaped easily in the queries. (or I can't find out how to)
     * This function gaurantees any provided table is a valid table name being used by the system.
     *
     * @private
     * @param {string} table
     * @returns {string}
     * @memberof _WebSQLStore
     */
    private _chkTable(table: string): string {
        if (Object.keys(this._dbIndex).indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        } else {
            return `"${table}"`;
        }
    }

    public makeTable(tableName: string, dataModels: DataModel[]): void {
        this._dbIndex[tableName] = new DatabaseIndex();

        dataModels.forEach((d) => {
            if (d.props && intersect(["pk", "pk()"], d.props)) {
                this._dbIndex[tableName].pkType = d.type;
                this._pkKey[tableName] = d.key;

                if (d.props && intersect(["ai", "ai()"], d.props) && (d.type === "int" || d.type === "number")) {
                    this._dbIndex[tableName].doAI = true;
                }

                if (["number", "float", "int"].indexOf(this._dbIndex[tableName].pkType) !== -1) {
                    this._pkIsNum[tableName] = true;
                }

                if (d.props && intersect(["ns", "ns()"], d.props) || ["uuid", "timeId", "timeIdms"].indexOf(this._dbIndex[tableName].pkType) !== -1) {
                    this._dbIndex[tableName].sortIndex = false;
                }
            }
        });
    }

    public _sql(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void): void {
        this._db.executeSql(sql, args, (result) => {
            complete(result);
        }, (err) => {
            console.error(sql, args, err);
            return false;
        });
    }

    public write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void): void {

        pk = pk || generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai) as DBKey;

        if (!pk) {
            throw new Error("Can't add a row without a primary key!");
        }

        this._sql(false, `SELECT id FROM ${this._chkTable(table)} WHERE id = ?`, [pk], (result) => {
            if (!result.rows.length) {
                this._dbIndex[table].add(pk);
                const r = {
                    ...data,
                    [this._pkKey[table]]: pk,
                };
                this._sql(true, `INSERT into ${this._chkTable(table)} (id, data) VALUES (?, ?)`, [pk, JSON.stringify(r)], (result) => {
                    complete(r);
                });
            } else {
                const r = {
                    ...data,
                    [this._pkKey[table]]: pk,
                };
                this._sql(true, `UPDATE ${this._chkTable(table)} SET data = ? WHERE id = ?`, [JSON.stringify(r), pk], () => {
                    complete(r);
                });
            }
        });
    }

    public delete(table: string, pk: DBKey, complete: () => void): void {
        let pos = this._dbIndex[table].indexOf(pk);
        if (pos !== -1) {
            this._dbIndex[table].remove(pk);
        }
        this._sql(true, `DELETE FROM ${this._chkTable(table)} WHERE id = ?`, [pk], () => {
            complete();
        });
    }

    public read(table: string, pk: DBKey, callback: (row: DBRow) => void): void {
        this._sql(false, `SELECT data FROM ${this._chkTable(table)} WHERE id = ?`, [pk], (result) => {
            if (result.rows.length) {
                callback(JSON.parse(result.rows.item(0).data));
            } else {
                callback(undefined as any);
            }
        });
    }

    public rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void {
        let keys = this._dbIndex[table].keys();
        const usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        let ranges: number[] = usefulValues ? [from as any, to as any] : [];
        if (!keys.length) {
            complete();
            return;
        }

        if (!(usePK && usefulValues) && this._dbIndex[table].sortIndex === false) {
            keys = keys.sort();
        }

        if (usePK && usefulValues) {
            ranges = ranges.map(r => this._dbIndex[table].getLocation(r));
        }

        let idx = ranges[0] || 0;

        let getKeys: any[] = [];
        let startIDX = ranges[0];
        let stmnt = "SELECT data from " + this._chkTable(table);

        // SQLite doesn't handle BETWEEN statements gracefully with primary keys, always doing a full table scan.
        // So we take the index of the table (which is in js memory) and convert it into an IN statement meaning SQLite
        // can go directly to the rows we need without a full table scan.
        if (ranges.length) {
            const t = typeof keys[startIDX] === "number";
            while (startIDX <= ranges[1]) {
                getKeys.push(t ? keys[startIDX] : `"${keys[startIDX]}"`);
                startIDX++;
            }
            stmnt += ` WHERE id IN (${getKeys.map(k => "?").join(", ")})`;
        }

        stmnt += " ORDER BY id";

        if (getKeys.length) {
            this.batchRead(table, getKeys, (result: any[]) => {
                let i = 0;
                const getRow = () => {
                    if (result.length > i) {
                        rowCallback(result[i], idx, () => {
                            idx++;
                            i++;
                            i % 500 === 0 ? setFast(getRow) : getRow(); // handle maximum call stack error
                        });
                    } else {
                        complete();
                    }
                };
                getRow();
            });
        } else {
            this._sql(false, stmnt, [], (result) => {
                let i = 0;
                const getRow = () => {
                    if (result.rows.length > i) {
                        rowCallback(JSON.parse(result.rows.item(i).data), idx, () => {
                            idx++;
                            i++;
                            i % 500 === 0 ? setFast(getRow) : getRow(); // handle maximum call stack error
                        });
                    } else {
                        complete();
                    }
                };
                getRow();
            });
        }
    }

    public batchRead(table: string, pks: any[], callback: (rows: any[]) => void) {
        const useKeys = splitArr(pks, 500);
        let rows: any[] = [];
        fastCHAIN(useKeys, (keys, i, next) => {
            this._sql(false, `SELECT data from ${this._chkTable(table)} WHERE id IN (${keys.map(p => "?").join(", ")}) ORDER BY id`, keys.map(p => typeof p === "string" ? `'${p}'` : p), (result) => {
                let i = result.rows.length;
                while (i--) {
                    rows.push(JSON.parse(result.rows.item(i).data));
                }
                next();
            });
        }).then(() => {
            callback(rows);
        });
    }

    public drop(table: string, callback: () => void): void {
        let idx = new DatabaseIndex();
        idx.doAI = this._dbIndex[table].doAI;
        this._dbIndex[table] = idx;
        this._sql(true, `DELETE FROM ${this._chkTable(table)}`, [], (rows) => {
            callback();
        });
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