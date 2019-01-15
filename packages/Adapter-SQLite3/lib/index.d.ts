/// <reference types="websql" />
import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "@nano-sql/core/lib/interfaces";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
export declare const sqlite3: any;
export declare class SQLiteResult {
    rowData: any[];
    insertId: any;
    rowsAffected: number;
    rows: {
        item: (idx: number) => any;
        length: number;
    };
    constructor(rows: any[]);
}
export declare class SQLite extends nanoSQLMemoryIndex {
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    private _id;
    private _db;
    private _ai;
    private _sqlite;
    private _tableConfigs;
    private _filename;
    private _mode;
    constructor(fileName?: string, mode?: any, batchSize?: number);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void): void;
    _query(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void, error: (err: any) => void): void;
    dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    disconnect(complete: () => void, error: (err: any) => void): void;
    write(table: string, pk: any, row: {
        [key: string]: any;
    }, complete: (pk: any) => void, error: (err: any) => void): void;
    read(table: string, pk: any, complete: (row: {
        [key: string]: any;
    } | undefined) => void, error: (err: any) => void): void;
    delete(table: string, pk: any, complete: () => void, error: (err: any) => void): void;
    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void): void;
    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void): void;
    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void): void;
}
