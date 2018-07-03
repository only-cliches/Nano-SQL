import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "nano-sql/lib/database/storage";
import { DataModel } from "nano-sql/lib/index";
import { setFast } from "lie-ts";
import { StdObject, hash, fastALL, fastCHAIN, deepFreeze, uuid, timeid, _assign, generateID, intersect, isAndroid } from "nano-sql/lib/utilities";
import { DatabaseIndex } from "nano-sql/lib/database/db-idx";
import * as mysql from "mysql";

/**
 * MySQL Unoffocial Benchmarks You Should Ignore:
 * Writes: ~2/ms
 * Reads: ~100/ms
 * IndexRead: ~166/ms
 */


export interface mySQLConnection {
    query: (sql: string, callback: (err: Error, results: any, fields: any) => void) => void;
    release: () => void;
}

export class SQLResult {

    public rowData: any[];

    public rows: {
        item: (idx: number) => any
        length: number;
    };

    constructor(rows: any[]) {
        this.rowData = rows;
        this.rows = {
            item: (idx: number) => {
                return this.rowData[idx];
            },
            length: this.rowData.length
        };
    }
}

/**
 * Handles WebSQL persistent storage
 *
 * @export
 * @class _SyncStore
 * @implements {NanoSQLStorageAdapter}
 */
export class MySQLAdapter implements NanoSQLStorageAdapter {


    private _pkKey: {
        [tableName: string]: string;
    };

    private _pkType: {
        [tableName: string]: string;
    };

    private _doAI: {
        [tableName: string]: boolean;
    }


    private _id: string;

    private _db: {
        getConnection: (callback: (err: Error, connection: mySQLConnection) => void) => void;
        end: (callback?: (err?: Error) => void) => void;
    }

    private _filename: string;
    private _mode: any;

    constructor(public connectArgs: {
        connectionLimit?: number;
        host?: string;
        port?: number;
        socketPath?: string;
        user: string;
        password: string;
        database: string;
        charset?: string;
        timezone?: string;
        connectTimeout?: number;
        stringifyObjects?: boolean;
        insecureAuth?: boolean;
        debug?: boolean;
        trace?: boolean;
        multipleStatements?: boolean;
        ssl?: { [key: string]: any }
    }) {
        this._pkKey = {};
        this._pkType = {};
        this._doAI = {};
    }

    public setID(id: string) {
        this._id = id;
    }

    public connect(complete: () => void) {

        this._db = mysql.createPool({
            connectionLimit: 20,
            ...this.connectArgs
        });

        this._db.getConnection((err, connection) => {
            if (err) {
                throw err;
            }
            connection.release();
            fastALL(Object.keys(this._pkKey), (table, i, nextKey) => {
                const stmt = this._doAI[table] ?
                    `CREATE TABLE IF NOT EXISTS ${this._chkTable(table)} (id Integer AUTO_INCREMENT PRIMARY KEY , data BLOB)` :
                    `CREATE TABLE IF NOT EXISTS ${this._chkTable(table)} (id VARCHAR(36) PRIMARY KEY, data BLOB)`;
                this._sql(true, stmt, [], () => {
                    nextKey();
                });
            }).then(() => {
                complete();
            });
        });
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
        if (Object.keys(this._pkType).indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        } else {
            return "DB" + "_" + this._id + "_" + table;
        }
    }

    public makeTable(tableName: string, dataModels: DataModel[]): void {

        dataModels.forEach((d) => {
            if (d.props && intersect(["pk", "pk()"], d.props)) {
                this._pkType[tableName] = d.type;
                this._pkKey[tableName] = d.key;
                if (d.type === "int" && intersect(["ai", "ai()"], d.props)) {
                    this._doAI[tableName] = true;
                }
            }
        });
    }

    public _sql(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResult) => void, getPK?: string): void {
        this._db.getConnection((err, db) => {
            if (err) { throw err };
            db.query(mysql.format(sql, args), (err, rows, fields) => {
                if (err) { throw err };
                if (getPK) {
                    db.query(`SELECT LAST_INSERT_ID() FROM ${this._chkTable(getPK)}`, (err, result, fields) => {
                        db.release();
                        complete(result);
                    });
                } else {
                    db.release();
                    complete(new SQLResult(rows || []));
                }

            });
        });
    }

    public write(table: string, pk: DBKey | null, data: DBRow, complete: (finalRow: DBRow) => void, error?: (err: Error) => void): void {

        if (!this._doAI[table]) {
            pk = pk || generateID(this._pkType[table], 0) as DBKey;

            if (!pk) {
                throw new Error("Can't add a row without a primary key!");
            }
        }


        const r = {
            ...data,
            [this._pkKey[table]]: pk
        }

        if (this._doAI[table] && !pk) {
            this._sql(true, `INSERT into ${this._chkTable(table)} (data) VALUES (?)`, [JSON.stringify(r)], (result) => {
                const r2 = {
                    ...r,
                    [this._pkKey[table]]: result[0]['LAST_INSERT_ID()']
                }
                this._sql(true, `UPDATE ${this._chkTable(table)} SET data = ? WHERE id = ?`, [JSON.stringify(r2), result[0]['LAST_INSERT_ID()']], () => {
                    complete(r2);
                });
            }, table);
        } else {
            const json = JSON.stringify(r);
            this._sql(true, `INSERT into ${this._chkTable(table)} (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?`, [pk, json, json], (result) => {
                complete(r);
            });
        }



    }

    public delete(table: string, pk: DBKey, complete: () => void): void {
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

        const usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;

        let stmnt = "SELECT data from " + this._chkTable(table);

        let args: any[] = [];
        if (usefulValues && usePK) {
            args = [from, to];
            stmnt += ` WHERE id BETWEEN ? AND ?`
        }

        stmnt += " ORDER BY id ASC";

        if (usefulValues && !usePK) {
            args = [(to - from) + 1, from];
            stmnt += ` LIMIT ? OFFSET ?`
        }

        this._sql(false, stmnt, args, (result) => {
            let i = 0;
            const getRow = () => {
                if (result.rows.length > i) {
                    rowCallback(JSON.parse(result.rows.item(i).data), i, () => {
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
        this._sql(true, `DELETE FROM ${this._chkTable(table)}`, [], (rows) => {
            callback();
        });
    }

    public getIndex(table: string, getLength: boolean, complete: (index) => void): void {
        if (getLength) {
            this._sql(false, `SELECT COUNT(*) AS length FROM ${this._chkTable(table)}`, [], (result) => {
                complete(result.rows.item(0).length);
            });
        } else {
            this._sql(false, `SELECT id FROM ${this._chkTable(table)} ORDER BY id ASC`, [], (result) => {
                let idx: any[] = [];
                let i = result.rows.length;
                while (i--) {
                    idx.unshift(result.rows.item(i).id);
                }
                complete(idx);
            });
        }
    }

    public destroy(complete: () => void) {
        fastALL(Object.keys(this._pkKey), (table, i, done) => {
            this._sql(true, "DROP TABLE " + this._chkTable(table), [], () => {
                done();
            });
        }).then(complete);
    }
}
