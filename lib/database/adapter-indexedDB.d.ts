import { NanoSQLStorageAdapter, DBKey, DBRow } from "./storage";
import { DataModel } from "../index";
/**
 * Handles IndexedDB with and without web workers.
 * Uses blob worker OR eval()s the worker and uses it inline.
 *
 * @export
 * @class _IndexedDBStore
 * @implements {NanoSQLStorageAdapter}
 */
export declare class _IndexedDBStore implements NanoSQLStorageAdapter {
    version: number | undefined;
    private _pkKey;
    private _dbIndex;
    private _id;
    private _db;
    private _modelHash;
    private _dataModels;
    constructor(version?: number | undefined);
    private onError(ev);
    connect(complete: () => void): void;
    store(table: string, type: IDBTransactionMode, open: (tr: IDBTransaction, store: IDBObjectStore) => void): void;
    setID(id: string): void;
    makeTable(tableName: string, dataModels: DataModel[]): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, error: (err: Error) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: any) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
    setNSQL(nSQL: any): void;
}
