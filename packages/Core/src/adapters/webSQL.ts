import { INanoSQLAdapter, INanoSQLDataModel, INanoSQLTable, INanoSQLPlugin, INanoSQLInstance, VERSION, SQLiteAbstractFns } from "../interfaces";
import { isAndroid, generateID, setFast } from "../utilities";

let tables: string[] = [];

export const SQLiteAbstract = (
    _query: (allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void, error: (err: any) => void) => void,
    _batchSize: number
): SQLiteAbstractFns => {

    const checkTable = (table: string): string => {
        if (tables.indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        } else {
            return `"${table}"`;
        }
    };
    return {
        createAI: (complete: () => void, error: (err: any) => void) => {
            _query(true, `CREATE TABLE IF NOT EXISTS "_ai" (id TEXT PRIMARY KEY UNIQUE, inc BIGINT)`, [], complete, error);
        },
        createTable: (table: string, tableData: INanoSQLTable, ai: {[table: string]: number}, complete: () => void, error: (err: any) => void) => {
            tables.push(table);

            _query(true, `CREATE TABLE IF NOT EXISTS "${table}" (id ${tableData.isPkNum ? "REAL" : "TEXT"} PRIMARY KEY UNIQUE, data TEXT)`, [], () => {
                if (tableData.ai) {
                    _query(false, `SELECT "inc" FROM "_ai" WHERE id = ?`, [table], (result) => {
                        if (!result.rows.length) {
                            ai[table] = 0;
                            _query(true, `INSERT into "_ai" (id, inc) VALUES (?, ?)`, [table, 0], () => {
                                complete();
                            }, error);
                        } else {
                            ai[table] = parseInt(result.rows.item(0).inc);
                            complete();
                        }
                    }, error);
                } else {
                    complete();
                }
            }, error);
        },
        dropTable: (table: string, complete: () => void, error: (err: any) => void) => {
            _query(true, `DROP TABLE IF EXISTS ${checkTable(table)}`, [], () => {
                _query(true, `UPDATE "_ai" SET inc = ? WHERE id = ?`, [0, table], () => {
                    tables.splice(tables.indexOf(table), 1);
                    complete();
                }, error);
            }, error);
        },
        write: (pkType: string, pkCol: string, table: string, pk: any, row: any, doAI: boolean, ai: {[table: string]: number}, complete: (pk: any) => void, error: (err: any) => void) => {
            pk = pk || generateID(pkType, ai[table] + 1);
            if (typeof pk === "undefined") {
                error(new Error("Can't add a row without a primary key!"));
                return;
            }

            if (doAI) ai[table] = Math.max(pk, ai[table]);
            row[pkCol] = pk;
            const rowStr = JSON.stringify(row);

            _query(false, `SELECT id FROM ${checkTable(table)} WHERE id = ?`, [pk], (result) => {
                if (result.rows.length) {
                    _query(true, `UPDATE ${checkTable(table)} SET data = ? WHERE id = ?`, [rowStr, pk], () => {
                        if (doAI && pk === ai[table]) {
                            _query(true, `UPDATE "_ai" SET inc = ? WHERE id = ?`, [ai[table], table], () => {
                                complete(pk);
                            }, error);
                        } else {
                            complete(pk);
                        }
                    }, error);
                } else {
                    _query(true, `INSERT INTO ${checkTable(table)} (id, data) VALUES (?, ?)`, [pk, rowStr], () => {
                        if (doAI && pk === ai[table]) {
                            _query(true, `UPDATE "_ai" SET inc = ? WHERE id = ?`, [ai[table], table], () => {
                                complete(pk);
                            }, error);
                        } else {
                            complete(pk);
                        }
                    }, error);
                }
            }, error);


        },
        read: (table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) => {
            _query(false, `SELECT data FROM ${checkTable(table)} WHERE id = ?`, [pk], (result) => {
                if (result.rows.length) {
                    complete(JSON.parse(result.rows.item(0).data));
                } else {
                    complete(undefined);
                }
            }, error);
        },
        remove: (table: string, pk: any, complete: () => void, error: (err: any) => void) => {
            _query(true, `DELETE FROM ${checkTable(table)} WHERE id = ?`, [pk], () => {
                complete();
            }, error);
        },
        getIndex: (table: string, complete: (index: any[]) => void, error: (err: any) => void) => {
            _query(false, `SELECT id FROM ${checkTable(table)} ORDER BY id`, [], (result) => {
                let idx: any[] = [];
                for (let i = 0; i < result.rows.length; i++) {
                    idx.push(result.rows.item(i).id);
                }
                complete(idx);
            }, error);
        },
        getNumberOfRecords: (table: string, complete: (length: number) => void, error: (err: any) => void) => {
            _query(false, `SELECT COUNT(*) FROM ${checkTable(table)}`, [], (result) => {
                complete(result.rows.item(0)["COUNT(*)"]);
            }, error);
        },
        readMulti: (table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) => {
            let stmnt = `SELECT data FROM ${checkTable(table)}`;

            if (type === "range") {
                stmnt += ` WHERE id >= ? AND id <= ?`;
            }
            if (reverse) {
                stmnt += ` ORDER BY id DESC`;
            } else {
                stmnt += ` ORDER BY id`;
            }

            // get rows in batches to prevent from filling JS memory
            let batchNum = 0;
            const nextBatch = () => {
                let query = stmnt;
                if (type === "offset") {
                    if (limitOrHigh <= _batchSize) {
                        query += ` LIMIT ${limitOrHigh} OFFSET ${offsetOrLow}`;
                    } else {
                        const actualLimit = Math.min(_batchSize, limitOrHigh - (batchNum * _batchSize));
                        const actualOffset = offsetOrLow + (batchNum * _batchSize);
                        if (actualLimit <= 0) {
                            complete();
                            return;
                        }
                        query += ` LIMIT ${actualLimit} OFFSET ${actualOffset}`;
                    }
                } else {
                    query += ` LIMIT ${_batchSize} OFFSET ${batchNum * _batchSize}`;
                }

                _query(false, query, type === "range" ? [offsetOrLow, limitOrHigh] : [], (result) => {
                    if (!result.rows.length) {
                        complete();
                        return;
                    }
                    for (let i = 0; i < result.rows.length; i++) {
                        onRow(JSON.parse(result.rows.item(i).data), (batchNum * _batchSize) + i);
                    }
                    if (result.rows.length === _batchSize) {
                        batchNum++;
                        nextBatch();
                    } else {
                        complete();
                    }
                }, error);
            };
            nextBatch();
        }
    };
};


export class WebSQL implements INanoSQLAdapter {

    plugin: INanoSQLPlugin = {
        name: "WebSQL Adapter",
        version: VERSION
    };

    nSQL: INanoSQLInstance;

    private _size: number;
    private _id: string;
    private _db: Database;
    private _ai: {[table: string]: number};
    private _sqlite: SQLiteAbstractFns;

    constructor(size?: number, batchSize?: number) {
        this._size = (size || 0) * 1000 * 1000;
        this._ai = {};
        this._query = this._query.bind(this);
        this._sqlite = SQLiteAbstract(this._query, batchSize || 500);
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        let isCompleting: boolean = false;
        this._db = window.openDatabase(this._id, String(this.nSQL.config.version) || "1.0", this._id, (isAndroid ? 5000000 : this._size));
        setFast(() => {
            this._sqlite.createAI(complete, error);
        });
    }

    createAndInitTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    }

    _query(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void, error: (err: any) => void): void {
        const doTransaction = (tx: SQLTransaction) => {
            tx.executeSql(sql, args, (tx2, result) => {
                complete(result);
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

    disconnectTable(table: string, complete: () => void, error: (err: any) => void) {
        complete();
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._sqlite.dropTable(table, complete, error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        complete();
    }

    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void) {
        this._sqlite.write(this.nSQL.tables[table].pkType, this.nSQL.tables[table].pkCol, table, pk, row, this.nSQL.tables[table].ai, this._ai, complete, error);
    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        this._sqlite.read(table, pk, complete, error);
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this._sqlite.remove(table, pk, complete, error);
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {
        this._sqlite.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error);
    }

    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        this._sqlite.getIndex(table, complete, error);
    }

    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    }
}