import { DataModel, NanoSQLInstance } from "../index";
import { StdObject } from "../utilities";
export interface DBRow {
    [key: string]: any;
}
export interface DBKey {
    string: any;
    number: any;
}
export interface NanoSQLStorageAdapter {
    makeTable(tableName: string, dataModels: DataModel[]): void;
    setID(id: string): void;
    connect(complete: () => void): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (finalRow: DBRow) => void, skipReadBeforeWrite: boolean): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, fromIdx?: number, toIdx?: number): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    drop(table: string, complete: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (pks: any[]) => void): void;
    destroy(complete: () => void): any;
    indexOfPK(table: string, pk: any, complete: (idx: number) => void): any;
}
export declare class _NanoSQLStorage {
    _mode: string | NanoSQLStorageAdapter;
    _id: string;
    _adapter: NanoSQLStorageAdapter;
    tableInfo: {
        [tableName: string]: {
            _pk: string;
            _pkType: string;
            _name: string;
            _secondaryIndexes: string[];
            _trieColumns: string[];
            _keys: string[];
            _defaults: any[];
        };
    };
    private _trieIndexes;
    models: {
        [tableName: string]: DataModel[];
    };
    private _tableNames;
    _doCache: boolean;
    _cache: {
        [table: string]: {
            [queryHash: number]: any[];
        };
    };
    _nsql: NanoSQLInstance;
    private _size;
    constructor(parent: NanoSQLInstance, args: {
        mode: string | NanoSQLStorageAdapter;
        id: string;
        dbPath: string;
        writeCache: number;
        persistent: boolean;
        readCache: number;
        cache: boolean;
        size: number;
    });
    init(dataModels: StdObject<DataModel[]>, complete: (newModels: StdObject<DataModel[]>) => void): void;
    rebuildIndexes(table: string, complete: (time: number) => void): void;
    private _secondaryIndexKey(value);
    _detectStorageMethod(): string;
    _secondaryIndexRead(table: string, column: string, search: string, callback: (rows: DBRow[]) => void): void;
    _rangeRead(table: string, fromIdx: number, toIdx: number, complete: (rows: DBRow[]) => void): void;
    _read(table: string, query: (row: DBRow, idx: number, toKeep: (result: boolean) => void) => void, callback: (rows: DBRow[]) => void): void;
    _trieRead(table: string, column: string, search: string, callback: (rows: DBRow[]) => void): void;
    private _clearSecondaryIndexes(table, pk, rowData, skipColumns, complete);
    private _setSecondaryIndexes(table, pk, rowData, skipColumns, complete);
    _write(table: string, pk: DBKey, oldRow: any, newRow: DBRow, complete: (row: DBRow) => void): void;
    _delete(table: string, pk: DBKey, complete: (row: DBRow) => void): void;
    _drop(table: string, complete: () => void): void;
    private _createSecondaryIndexTables(dataModels);
    private _newTable(tableName, dataModels);
}
