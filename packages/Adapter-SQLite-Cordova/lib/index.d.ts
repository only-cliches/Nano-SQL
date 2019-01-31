/// <reference types="websql" />
import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "@nano-sql/core/lib/interfaces";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
export interface CordovaSQLiteDB {
    sqlBatch: (queries: (string | any[])[], onSuccess: () => void, onFail: (err: Error) => void) => void;
    executeSql: (sql: string, vars: any[], onSuccess: (result: SQLResultSet) => void, onFail: (err: Error) => void) => void;
}
export declare const getMode: () => SQLiteCordova | "PERM";
export declare class SQLiteCordova extends nanoSQLMemoryIndex {
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    private _db;
    private _ai;
    private _sqlite;
    private _tableConfigs;
    constructor();
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void): void;
    _query(allowWrite: boolean, sql: string, args: any[], onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void;
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
