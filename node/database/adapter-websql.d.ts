/// <reference types="websql" />
import { NanoSQLStorageAdapter, DBKey, DBRow } from "./storage";
import { DataModel } from "../index";
export declare class _WebSQLStore implements NanoSQLStorageAdapter {
    private _pkKey;
    private _pkType;
    private _dbIndex;
    private _id;
    private _db;
    private _size;
    constructor(size?: number);
    setID(id: string): void;
    connect(complete: () => void): void;
    private _chkTable(table);
    makeTable(tableName: string, dataModels: DataModel[]): void;
    _sql(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, skipReadBeforeWrite: boolean): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, fromIdx?: number, toIdx?: number): void;
    drop(table: string, callback: () => void): void;
    indexOfPK(table: string, pk: any, complete: (idx: number) => void): void;
    getIndex(table: string, getIdx: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
}
