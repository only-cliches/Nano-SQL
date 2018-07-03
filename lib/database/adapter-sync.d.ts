import { NanoSQLStorageAdapter, DBKey, DBRow } from "./storage";
import { DataModel } from "../index";
/**
 * Handles all available syncronous versions of storage (memory and localstorage)
 *
 * @export
 * @class _SyncStore
 * @implements {NanoSQLStorageAdapter}
 */
export declare class _SyncStore implements NanoSQLStorageAdapter {
    private _rows;
    private _pkKey;
    private _dbIndex;
    private _ls;
    private _id;
    constructor(useLocalStorage?: boolean);
    connect(complete: () => void): void;
    setID(id: string): void;
    makeTable(tableName: string, dataModels: DataModel[]): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, error: (err: Error) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
    setNSQL(nSQL: any): void;
}
