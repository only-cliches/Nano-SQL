import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, SQLiteAbstractFns } from "@nano-sql/core/lib/interfaces";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
import { SQLiteAbstract } from "@nano-sql/core/lib/adapters/webSQL";

export const sqlite3 = require('better-sqlite3');

export interface SQLiteOptions {
    memory?: boolean,
    readonly?: boolean,
    fileMustExist?: boolean,
    timeout?: number,
    verbose?: (logMessage: string) => void
}


export class SQLite extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "SQLite Adapter",
        version: 2.08
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _db: any;
    private _ai: { [table: string]: number };
    private _sqlite: SQLiteAbstractFns;
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    private _filename: string;
    private _args?: SQLiteOptions;

    constructor(fileName?: string, sqliteOptions?: SQLiteOptions, batchSize?: number) {
        super(false, true);
        this._ai = {};
        this._query = this._query.bind(this);
        this._filename = fileName || "";
        this._args = sqliteOptions && typeof sqliteOptions !== "number" ? sqliteOptions : undefined;
        this._tableConfigs = {};
        this._sqlite = SQLiteAbstract(this._query, batchSize || 500);
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        try {
            this._db = new sqlite3(this._filename && this._filename.length ? this._filename : this._id, {
                memory: this._filename === "" ? true : (this._args && this._args.memory === true ? true : false),
                ...(this._args || {})
            });
            this._sqlite.createAI(complete, error);
        } catch (err) {
            error(err);
        }
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    }

    _query(allowWrite: boolean, sql: string, args: any[], onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void {

        const stmt = this._db.prepare(sql);
  
        while(true) {
            if (allowWrite) {
                try {
                    stmt.run(...args);
                    complete();
                    break;
                } catch (e) {
                    if (e.message !== 'This database connection is busy executing a query') {
                        error(e);
                        break;
                    }
                }
            } else {
                try {
                    let k = 0;
                    const results = stmt.all(...args);
                    while (k < results.length) {
                        onRow(results[k], k);
                        k++;
                    }
                    complete();
                    break;
                } catch (e) {
                    if (e.message !== 'This database connection is busy executing a query') {
                        error(e);
                        break;
                    }
                }
            }
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