import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION } from "@nano-sql/core/lib/interfaces";
import { generateID, setFast, deepSet } from "@nano-sql/core/lib/utilities";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
import * as mysql from "mysql";

/*
export interface mySQLConnection {
    query: (sql: string, callback: (err: Error, results: any, fields: any) => void) => void;
    release: () => void;
}*/

export class MySQL extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "MySQL Adapter",
        version: 2.01
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _db: mysql.Pool;
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

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
        super(false, false);
        this._tableConfigs = {};
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        this._db = mysql.createPool({
            connectionLimit: 20,
            ...this.connectArgs
        });

        this._db.getConnection((err, connection) => {
            if (err) {
                error(err);
                return;
            }
            connection.release();
            complete();
        });
    }


    private _chkTable(table: string): string {
        if (Object.keys(this._tableConfigs).indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        } else {
            return `${this._id}_${table}`;
        }
    }

    public _sql(sql: string, args: any[], complete: (rows: any) => void, error: (err: any) => void): void {
        this._db.getConnection((err, db) => {
            if (err) {
                error(err); return;
            };

            db.query(mysql.format(sql, args), (err, result, fields) => {
                if (err) {
                    error(err); return;
                };
                db.release();
                complete(result);
            });
        });
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {

        this._tableConfigs[tableName] = tableData;
        this._sql(`CREATE TABLE IF NOT EXISTS ${this._chkTable(tableName)} (id ${tableData.isPkNum ? (tableData.pkType === "int" ? "INT" : "DOUBLE") : "VARCHAR(36)"} ${tableData.ai ? "AUTO_INCREMENT" : ""} PRIMARY KEY UNIQUE, data BLOB)`, [], (rows) => {
            complete();
        }, error);
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._sql(`DROP TABLE ${this._chkTable(table)};`, [], (rows) => {
            delete this._tableConfigs[table];
            complete();
        }, error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        this._db.end((err) => {
            if (err) {
                error(err);
                return;
            }
            complete();
        });
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {

        pk = this._tableConfigs[table].ai ? pk : pk || generateID(this._tableConfigs[table].pkType, 0);

        if (this._tableConfigs[table].ai && !pk) {
            this._sql(`INSERT into ${this._chkTable(table)} (data) VALUES (?)`, [JSON.stringify(row)], (result) => {
                deepSet(this._tableConfigs[table].pkCol, row, result.insertId);
                this._sql(`UPDATE ${this._chkTable(table)} SET data = ? WHERE id = ?`, [JSON.stringify(row), result.insertId], () => {
                    complete(result.insertId);
                }, error);
            }, error);
        } else {
            if (!pk) {
                error("Can't add a row without a primary key!");
                return;
            }
            const json = JSON.stringify(deepSet(this._tableConfigs[table].pkCol, row, pk));
            this._sql(`INSERT into ${this._chkTable(table)} (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?`, [pk, json, json], (result) => {
                complete(pk);
            }, error);
        }
    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        this._sql(`SELECT * FROM ${this._chkTable(table)} WHERE id = ?`, [pk], (rows) => {
            if (rows.length) {
                complete(JSON.parse(rows[0].data.toString('utf8')));
            } else {
                complete(undefined);
            }
        }, error);
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {

        let stmnt = `SELECT data FROM ${this._chkTable(table)}`;

        if (type === "range") {
            stmnt += ` WHERE id BETWEEN ? AND ?`;
        }
        if (reverse) {
            stmnt += ` ORDER BY id DESC`;
        } else {
            stmnt += ` ORDER BY id`;
        }

        let query = stmnt;
        if (type === "offset") {
            const lower = reverse ? offsetOrLow + 1 : offsetOrLow;
            const higher = limitOrHigh;
            query += ` LIMIT ${higher} OFFSET ${lower}`;
        }
        
        let count = 0;
        this._db.query(query, type === "range" ? [offsetOrLow, limitOrHigh] : []).on('error', function (err) {
            error(err);
        }).on('result', function (row) {
            onRow(JSON.parse(row.data.toString('utf8')), count);
            count++;
        }).on('end', function () {
            complete();
        });
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this._sql(`DELETE FROM ${this._chkTable(table)} WHERE id = ?`, [pk], () => {
            complete();
        }, error);
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        this._sql(`SELECT id FROM ${this._chkTable(table)} ORDER BY id`, [], (rows) => {
            let idx: any[] = [];
            for (let i = 0; i < rows.length; i++) {
                idx.push(rows[i].id);
            }
            complete(idx);
        }, error);
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        this._sql(`SELECT COUNT(*) FROM ${this._chkTable(table)}`, [], (rows) => {
            complete(rows[0]["COUNT(*)"]);
        }, error);
    }
}