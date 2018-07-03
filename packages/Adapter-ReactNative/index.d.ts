import { NanoSQLStorageAdapter, DBKey, DBRow } from "nano-sql/lib/database/storage";
import { DataModel, NanoSQLInstance } from "nano-sql/lib/index";
export declare class ReactNativeAdapter implements NanoSQLStorageAdapter {
    private _id;
    private _pkKey;
    private _dbIndex;
    private _writeIdx;
    constructor();
    setID(id: string): void;
    key(table: string, id: any): string;
    connect(complete: () => void): void;
    makeTable(tableName: string, dataModels: DataModel[]): void;
    writeIndex(table: string): void;
    write(table: string, pk: DBKey | null, newData: DBRow, complete: (row: DBRow) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    batchRead(table: string, pks: DBKey[], callback: (rows: any[]) => void): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
    setNSQL(nsql: NanoSQLInstance): void;
}
