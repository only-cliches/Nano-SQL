import { NanoSQLStorageAdapter, DBKey, DBRow } from "nano-sql/lib/database/storage";
import { DataModel } from "nano-sql";
export interface GDataEntity {
    key: any;
    data: {
        name: string;
        value: any;
        excludeFromIndexes?: boolean;
    }[] | {
        [key: string]: any;
    };
}
export declare class GDatastoreAdapter implements NanoSQLStorageAdapter {
    private _pkKey;
    private _dbIndex;
    private _dbColumns;
    private _id;
    private _path;
    private _dataStore;
    private _doStrong;
    private _distributedMode;
    constructor(args: {
        projectId: string;
        keyFilename?: string;
        strongConsistency?: boolean;
        distributedMode?: boolean;
    });
    connect(complete: () => void): void;
    setID(id: string): void;
    makeTable(tableName: string, dataModels: DataModel[]): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    private _clean(table, row);
    batchRead(table: string, pks: DBKey[], callback: (rows: any[]) => void): void;
    read(table: string, pk: DBKey, callback: (row: any) => void): void;
    doRetry(doThis: Promise<any>, maxRetries?: number): any;
    private _pkRangeRead(table, rowCallback, complete, from?, to?);
    private _offsetRangeRead(table, rowCallback, complete, from?, to?);
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    private _getIndexFromGoogle(table, complete);
    getIndex(table: string, getLength: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
}
