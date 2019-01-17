import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, SQLiteAbstractFns } from "@nano-sql/core/lib/interfaces";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
import { SQLiteAbstract } from "@nano-sql/core/lib/adapters/webSQL"; 
import { Database } from "sqlite3";

export const sqlite3 = require('sqlite3');


export class SQLite  extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "SQLite Adapter",
        version: 2.04
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _db: Database;
    private _ai: {[table: string]: number};
    private _sqlite: SQLiteAbstractFns;
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    private _filename: string;
    private _mode: any;

    constructor(fileName?: string, mode?: any, batchSize?: number) {
        super(false, true);
        this._ai = {};
        this._query = this._query.bind(this);
        this._filename = fileName || ":memory:";
        this._mode = mode || (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
        this._tableConfigs = {};
        this._sqlite = SQLiteAbstract(this._query, batchSize || 500);
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        this._db = new sqlite3.Database(this._filename, this._mode || (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE), (err) => {

            if (err) {
                error(err);
                return;
            }

            this._sqlite.createAI(complete, error);
        });
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    }

    _query(allowWrite: boolean, sql: string, args: any[], onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void {

        if (allowWrite) {
            this._db.run(sql, args, (err) => {
                if (err) {
                    error(err);
                    return;
                }
                complete();
            });
        } else {
            let count = 0;

            this._db.each(sql, args, (err, row) => {
                if (err) {
                    error(err);
                    return;
                }
                onRow(row, count);
                count++;
            }, (err) => {
                if (err) {
                    error(err);
                    return;
                }
                complete();
            });
        }
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._sqlite.dropTable(table, complete, error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        complete();
    }

    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void) {
        this._sqlite.write(this._tableConfigs[table].pkType, this._tableConfigs[table].pkCol, table, pk, row, this._tableConfigs[table].ai, this._ai, complete, error);
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

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        this._sqlite.getIndex(table, complete, error);
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    }
}