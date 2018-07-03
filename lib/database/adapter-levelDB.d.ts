import { NanoSQLStorageAdapter, DBKey, DBRow } from "./storage";
import { DataModel } from "../index";
/**
 * Handles Level DB storage.
 *
 * @export
 * @class _LevelStore
 * @implements {NanoSQLStorageAdapter}
 */
export declare class _LevelStore implements NanoSQLStorageAdapter {
    path: string | ((dbID: string, tableName: string) => {
        lvld: any;
        args: any;
    }) | undefined;
    writeCache: number | undefined;
    readCache: number | undefined;
    private _pkKey;
    private _pkType;
    private _isPKnum;
    private _dbIndex;
    private _id;
    private _path;
    private _levelDBs;
    private _lvlDown;
    constructor(path?: string | ((dbID: string, tableName: string) => {
        lvld: any;
        args: any;
    }) | undefined, writeCache?: number | undefined, readCache?: number | undefined);
    connect(complete: () => void): void;
    disconnect(complete: () => void): void;
    setID(id: string): void;
    makeTable(tableName: string, dataModels: DataModel[]): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, error: (err: Error) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: any) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
}
