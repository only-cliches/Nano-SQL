import { NanoSQLStorageAdapter, DBKey, DBRow } from "nano-sql/lib/database/storage";
import { DataModel } from "nano-sql/lib/index";
export declare const sqlite3: any;
export declare class SQLiteResult {
    rowData: any[];
    rows: {
        item: (idx: number) => any;
        length: number;
    };
    constructor(rows: any[]);
}
export declare class nSQLiteAdapter implements NanoSQLStorageAdapter {
    private _pkKey;
    private _dbIndex;
    private _id;
    private _db;
    private _filename;
    private _mode;
    constructor(filename: ":memory:" | string, mode?: any);
    setID(id: string): void;
    connect(complete: () => void): void;
    private _chkTable;
    makeTable(tableName: string, dataModels: DataModel[]): void;
    _sql(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLiteResult) => void): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    batchRead(table: string, pks: any[], callback: (rows: any[]) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index: any) => void): void;
    destroy(complete: () => void): void;
}
