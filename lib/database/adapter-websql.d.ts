/// <reference types="websql" />
import { NanoSQLStorageAdapter, DBKey, DBRow } from "./storage";
import { DataModel } from "../index";
/**
 * Handles WebSQL persistent storage
 *
 * @export
 * @class _SyncStore
 * @implements {NanoSQLStorageAdapter}
 */
export declare class _WebSQLStore implements NanoSQLStorageAdapter {
    private _pkKey;
    private _dbIndex;
    private _id;
    private _db;
    private _size;
    constructor(size?: number);
    setID(id: string): void;
    connect(complete: () => void): void;
    /**
     * Table names can't be escaped easily in the queries.
     * This function gaurantees any provided table is a valid table name being used by the system.
     *
     * @private
     * @param {string} table
     * @returns {string}
     * @memberof _WebSQLStore
     */
    private _chkTable(table);
    makeTable(tableName: string, dataModels: DataModel[]): void;
    _sql(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResultSet) => void): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, error: (err: Error) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    batchRead(table: string, pks: any[], callback: (rows: any[]) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
    setNSQL(nSQL: any): void;
}
