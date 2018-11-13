/// <reference types="websql" />
import { INanoSQLAdapter, INanoSQLTable, INanoSQLPlugin, INanoSQLInstance, SQLiteAbstractFns } from "../interfaces";
export declare const SQLiteAbstract: (_query: (allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void, error: (err: any) => void) => void, _batchSize: number) => SQLiteAbstractFns;
export declare class WebSQL implements INanoSQLAdapter {
    plugin: INanoSQLPlugin;
    nSQL: INanoSQLInstance;
    private _size;
    private _id;
    private _db;
    private _ai;
    private _sqlite;
    constructor(size?: number, batchSize?: number);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    createAndInitTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void): void;
    _query(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void, error: (err: any) => void): void;
    disconnectTable(table: string, complete: () => void, error: (err: any) => void): void;
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
    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void): void;
    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void): void;
}
