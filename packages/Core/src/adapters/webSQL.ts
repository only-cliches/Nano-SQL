import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION, SQLiteAbstractFns } from "../interfaces";
import { isAndroid, generateID, setFast, deepSet, uuid, noop, deepGet, allAsync } from "../utilities";
import { nanoSQLMemoryIndex } from "./memoryIndex";



export const SQLiteAbstract = (
    _query: (allowWrite: boolean, sql: string, args: any[], onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => void,
    _batchSize: number
): SQLiteAbstractFns => {

    let tables: string[] = [];
    let tableConfigs: {
        [tableName: string]: InanoSQLTable;
    } = {};

    const checkTable = (table: string): string => {
        if (tables.indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        } else {
            return `"${table}"`;
        }
    };

    const SQLFns = {
        createAI: (complete: () => void, error: (err: any) => void) => {
            _query(true, `CREATE TABLE IF NOT EXISTS "_ai" (id TEXT PRIMARY KEY UNIQUE, inc BIGINT)`, [], noop, complete, error);
        },
        createTable: (table: string, tableData: InanoSQLTable, ai: { [table: string]: number }, complete: () => void, error: (err: any) => void) => {
            tables.push(table);
            tableConfigs[table] = tableData;
            _query(true, `CREATE TABLE IF NOT EXISTS "${table}" (id ${tableData.isPkNum ? "REAL" : "TEXT"} PRIMARY KEY UNIQUE, data TEXT)`, [], noop, () => {
                if (tableData.ai) {
                    let rows: any[] = [];
                    _query(false, `SELECT "inc" FROM "_ai" WHERE id = ?`, [table], (result) => {
                        rows.push(result);
                    }, () => {
                        if (!rows.length) {
                            ai[table] = 0;
                            _query(true, `INSERT into "_ai" (id, inc) VALUES (?, ?)`, [table, 0], noop, complete, error);
                        } else {
                            ai[table] = parseInt(rows[0].inc);
                            complete();
                        }
                    }, error);
                } else {
                    complete();
                }
            }, error);
        },
        dropTable: (table: string, complete: () => void, error: (err: any) => void) => {
            _query(true, `DROP TABLE IF EXISTS ${checkTable(table)}`, [], noop, () => {
                _query(true, `UPDATE "_ai" SET inc = ? WHERE id = ?`, [0, table], noop, () => {
                    tables.splice(tables.indexOf(table), 1);
                    complete();
                }, error);
            }, error);
        },
        write: (pkType: string, pkCol: string[], table: string, pk: any, row: any, doAI: boolean, ai: { [table: string]: number }, complete: (pk: any) => void, error: (err: any) => void) => {
            pk = pk || generateID(pkType, ai[table] + 1);
            if (typeof pk === "undefined") {
                error(new Error("Can't add a row without a primary key!"));
                return;
            }

            if (doAI) ai[table] = Math.max(pk, ai[table]);
            deepSet(pkCol, row, pk);
            const rowStr = JSON.stringify(row);

            const afterWrite = () => {
                if (doAI && pk >= ai[table]) {
                    _query(true, `UPDATE "_ai" SET inc = ? WHERE id = ?`, [ai[table], table], noop, () => {
                        complete(pk);
                    }, error);
                } else {
                    complete(pk);
                }
            }

            let rows: any[] = [];
            _query(false, `SELECT id FROM ${checkTable(table)} WHERE id = ?`, [pk], (result) => {
                rows.push(result);
            }, () => {
                if (rows.length) {
                    _query(true, `UPDATE ${checkTable(table)} SET data = ? WHERE id = ?`, [rowStr, pk], noop, afterWrite, error);
                } else {
                    _query(true, `INSERT INTO ${checkTable(table)} (id, data) VALUES (?, ?)`, [pk, rowStr], noop, afterWrite, error);
                }
            }, error);


        },
        batch: (table: string, actions: {type: "put"|"del", data: any}[], success: (result: any[]) => void, error: (msg: any) => void) => {
            _query(true, "BEGIN TRANSACTION", [], noop, () => {
                allAsync(actions, (action, i, next, err) => {
                    switch(action.type) {
                        case "put":
                            SQLFns.write(tableConfigs[table].pkType, tableConfigs[table].pkCol, table, deepGet(tableConfigs[table].pkCol, action.data), action.data, tableConfigs[table].ai, {}, next, err);
                        break;
                        case "del":
                            SQLFns.remove(table, action.data, next, err);
                        break;
                    }
                }).then((results) => {
                    _query(true, "END TRANSACTION", [], noop, () => {
                        success(results);
                    }, error);
                }).catch(error);
            }, error);
        },
        read: (table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) => {
            let rows: any[] = [];
            _query(false, `SELECT data FROM ${checkTable(table)} WHERE id = ?`, [pk], (result) => {
                rows.push(result);
            }, () => {
                if (rows.length) {
                    complete(JSON.parse(rows[0].data));
                } else {
                    complete(undefined);
                }
            }, error);
        },
        remove: (table: string, pk: any, complete: () => void, error: (err: any) => void) => {
            _query(true, `DELETE FROM ${checkTable(table)} WHERE id = ?`, [pk], noop, () => {
                complete();
            }, error);
        },
        getIndex: (table: string, complete: (index: any[]) => void, error: (err: any) => void) => {
            let idx: any[] = [];
            _query(false, `SELECT id FROM ${checkTable(table)} ORDER BY id`, [], (row) => {
                idx.push(row.id);
            }, () => {
                complete(idx);
            }, error);
        },
        getNumberOfRecords: (table: string, complete: (length: number) => void, error: (err: any) => void) => {
            let rows: any[] = [];
            _query(false, `SELECT COUNT(*) FROM ${checkTable(table)}`, [], (result) => {
                rows.push(result);
            }, () => {
                complete(rows[0]["COUNT(*)"]);
            }, error);
        },
        readMulti: (table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) => {
            let stmnt = `SELECT data FROM ${checkTable(table)}`;

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

            _query(false, query, type === "range" ? [offsetOrLow, limitOrHigh] : [], (row, i) => {
                onRow(JSON.parse(row.data), i);
            }, () => {
                complete();
            }, error);

        }
    };

    return SQLFns;
};


export class WebSQL extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "WebSQL Adapter",
        version: VERSION
    };

    nSQL: InanoSQLInstance;

    private _size: number;
    private _id: string;
    private _db: any;
    private _ai: { [table: string]: number };
    private _sqlite: SQLiteAbstractFns;
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    constructor(size?: number, batchSize?: number) {
        super(false, false);
        this._size = (size || 0) * 1000 * 1000;
        this._ai = {};
        this._query = this._query.bind(this);
        this._tableConfigs = {};
        this._sqlite = SQLiteAbstract(this._query, batchSize || 500);
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        try {
            this._db = window["openDatabase"](this._id, this.nSQL.dbs[id] ? String(this.nSQL.getDB(id).config.version || "1.0") : "1.0", this._id, (isAndroid ? 5000000 : this._size));
        } catch (e) {
            error(e);
        }
        
        setFast(() => {
            this._sqlite.createAI(complete, error);
        });
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    }

    _query(allowWrite: boolean, sql: string, args: any[], onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void {

        const doTransaction = (tx: any) => {
            tx.executeSql(sql, args, (tx2, result) => {
                for (let i = 0; i < result.rows.length; i++) {
                    onRow(result.rows.item(i), i);
                }
                complete();
            }, (tx, err) => {
                error(err);
                return false;
            });
        };
        if (allowWrite) {
            this._db.transaction(doTransaction);
        } else {
            this._db.readTransaction(doTransaction);
        }
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._sqlite.dropTable(table, complete, error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        complete();
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {
        this._sqlite.write(this._tableConfigs[table].pkType, this._tableConfigs[table].pkCol, table, pk, row, this._tableConfigs[table].ai, this._ai, complete, error);
    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        this._sqlite.read(table, pk, complete, error);
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this._sqlite.remove(table, pk, complete, error);
    }

    batch(table: string, actions: {type: "put"|"del", data: any}[], success: (result: any[]) => void, error: (msg: any) => void) {
        this._sqlite.batch(table, actions, success, error);
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {
        this._sqlite.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error);
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        this._sqlite.getIndex(table, complete, error);
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    }
}