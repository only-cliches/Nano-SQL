import { NanoSQLStorageAdapter, DBKey, DBRow } from "./storage";
import { DataModel } from "../index";
export declare class _IndexedDBStore implements NanoSQLStorageAdapter {
    private _pkKey;
    private _pkType;
    private _dbIndex;
    private _id;
    private _w;
    private _waitingCBs;
    private _useWorker;
    constructor(useWorker: boolean);
    connect(complete: () => void): void;
    setID(id: string): void;
    private _handleWWMessage(action, args);
    makeTable(tableName: string, dataModels: DataModel[]): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, skipReadBeforeWrite: any): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, fromIdx?: number, toIdx?: number): void;
    drop(table: string, callback: () => void): void;
    indexOfPK(table: string, pk: any, complete: (idx: number) => void): void;
    getIndex(table: string, getIdx: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
}
