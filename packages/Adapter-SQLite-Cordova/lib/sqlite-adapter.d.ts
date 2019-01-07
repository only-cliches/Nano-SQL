/// <reference types="websql" />
import { NanoSQLStorageAdapter, DBKey, DBRow } from "nano-sql/lib/database/storage";
import { DataModel } from "nano-sql/lib/index";
export interface CordovaSQLiteDB {
    sqlBatch: (queries: (string | any[])[], onSuccess: () => void, onFail: (err: Error) => void) => void;
    executeSql: (sql: string, vars: any[], onSuccess: (result: SQLResultSet) => void, onFail: (err: Error) => void) => void;
}
export declare const getMode: () => SQLiteStore | "PERM";
export declare class SQLiteStore implements NanoSQLStorageAdapter {
    private _pkKey;
    private _dbIndex;
    private _pkIsNum;
    private _id;
    private _db;
    constructor();
    setID(id: string): void;
    connect(complete: () => void): void;
    private _chkTable;
    makeTable(tableName: string, dataModels: DataModel[]): void;
    _sql(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    batchRead(table: string, pks: any[], callback: (rows: any[]) => void): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index: any) => void): void;
    destroy(complete: () => void): void;
}
