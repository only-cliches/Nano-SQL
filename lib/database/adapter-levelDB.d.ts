import { NanoSQLStorageAdapter, DBKey, DBRow } from "./storage";
import { DataModel } from "../index";
export declare class _LevelStore implements NanoSQLStorageAdapter {
    path: string;
    writeCache: number;
    readCache: number;
    private _pkKey;
    private _pkType;
    private _isPKnum;
    private _dbIndex;
    private _id;
    private _path;
    private _levelDBs;
    constructor(path: string, writeCache: number, readCache: number);
    connect(complete: () => void): void;
    setID(id: string): void;
    makeTable(tableName: string, dataModels: DataModel[]): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, skipReadBeforeWrite: boolean): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: any) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
}
