import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "./storage";
import { DataModel } from "../index";
import { setFast } from "lie-ts";
import { StdObject, hash, fastALL, deepFreeze, uuid, timeid, _assign, generateID, isAndroid, intersect } from "../utilities";
import { DatabaseIndex, syncPeerIndex } from "./db-idx";


/**
 * Handles WebSQL persistent storage
 *
 * @export
 * @class _SyncStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
export class _WebSQLStore implements NanoSQLStorageAdapter {


    private _pkKey: {
        [tableName: string]: string;
    };

    private _dbIndex: {
        [tableName: string]: DatabaseIndex;
    };

    private _id: string;

    private _db: Database;

    private _size: number;

    constructor(size?: number) {
        this._pkKey = {};
        this._dbIndex = {};
        this._size = (size || 0) * 1000 * 1000;
    }

    public setID(id: string) {
        this._id = id;
    }

    public connect(complete: () => void) {
        this._db = window.openDatabase(this._id, "1.0", this._id, this._size || isAndroid ? 5000000 : 1);

        fastALL(Object.keys(this._pkKey), (table, i, nextKey) => {
                this._sql(true, `CREATE TABLE IF NOT EXISTS ${table} (id BLOB PRIMARY KEY UNIQUE, data TEXT)`, [], () => {
                    this._sql(false, `SELECT id FROM ${table}`, [], (result) => {
                        let idx: any[] = [];
                        for (let i = 0; i < result.rows.length; i++) {
                            idx.push(result.rows.item(i).id);
                        }
                        // SQLite doesn't sort primary keys, but the system depends on sorted primary keys
                        if (this._dbIndex[table].sortIndex) {
                            idx = idx.sort((a, b) => a > b ? 1 : -1);
                        }
                        this._dbIndex[table].set(idx);
                        nextKey();
                    });
                });
        }).then(complete);
    }

    /**
     * Table names can't be escaped easily in the queries.
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
            return table;
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

                if (d.props && intersect(["ns", "ns()"], d.props) || ["uuid", "timeId", "timeIdms"].indexOf(this._dbIndex[tableName].pkType) !== -1) {
                    this._dbIndex[tableName].sortIndex = false;
                }
            }
        });
    }

    public _sql(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void): void {
        const doTransaction = (tx: SQLTransaction) => {
            tx.executeSql(sql, args, (tx2, result) => {
                complete(result);
            }, (tx, err) => {
                console.error(sql, args, err);
                return false;
            });
        };
        if (allowWrite) {
            this._db.transaction(doTransaction);
        } else {
            this._db.readTransaction(doTransaction);
        }
    }

    public write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, error: (err: Error) => void): void {

        pk = pk || generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai) as DBKey;

        if (!pk) {
            error(new Error("nSQL: Can't add a row without a primary key!"));
            return;
        }

        let newRow = false;
        if (!this._dbIndex[table].exists(pk)) {
            newRow = true;
            this._dbIndex[table].add(pk);
        }

        if (newRow) {
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

    public batchRead(table: string, pks: any[], callback: (rows: any[]) => void) {
        this._sql(false, `SELECT data from ${this._chkTable(table)} WHERE id IN (${pks.map(p => "?").join(", ")}) ORDER BY id`, pks, (result) => {
            let i = result.rows.length;
            let rows: any[] = [];
            while (i--) {
                rows.unshift(JSON.parse(result.rows.item(i).data));
            }
            callback(rows);
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
        if (usePK && usefulValues) {
            ranges = ranges.map(r => this._dbIndex[table].getLocation(r));
        }

        if (!(usePK && usefulValues) && this._dbIndex[table].sortIndex === false) {
            keys = keys.sort();
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
                getKeys.push(keys[startIDX]);
                startIDX++;
            }
            stmnt += ` WHERE id IN (${getKeys.map(k => "?").join(", ")})`;
        }

        stmnt += " ORDER BY id";

        this._sql(false, stmnt, getKeys, (result) => {
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

    public drop(table: string, callback: () => void): void {
        this._dbIndex[table] = this._dbIndex[table].clone();
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

    public setNSQL(nSQL) {
        syncPeerIndex(nSQL, this._dbIndex);
    }
}