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
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, pkRange?: boolean): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    drop(table: string, complete: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index: any[] | number) => void): void;
    destroy(complete: () => void): any;
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
    models: {
        [tableName: string]: DataModel[];
    };
    _doCache: boolean;
    _cache: {
        [table: string]: {
            [queryHash: number]: any[];
        };
    };
    _nsql: NanoSQLInstance;
    private _size;
    _relFromTable: {
        [tableName: string]: {
            [thisColmn: string]: {
                _toTable: string;
                _toColumn: string;
                _toType: "array" | "single";
                _thisType: "array" | "single";
            };
        };
    };
    _columnsAreTables: {
        [tableName: string]: {
            [thisColmn: string]: {
                _toTable: string;
                _thisType: "array" | "single";
            };
        };
    };
    _relToTable: {
        [tableName: string]: {
            _thisColumn: string;
            _thisType: "array" | "single";
            _fromTable: string;
            _fromColumn: string;
            _fromType: "array" | "single";
        }[];
    };
    _relationColumns: {
        [tableName: string]: string[];
    };
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
    _detectStorageMethod(): string;
    _secondaryIndexRead(table: string, column: string, search: string, callback: (rows: DBRow[]) => void): void;
    _rangeReadIDX(table: string, fromIdx: number, toIdx: number, complete: (rows: DBRow[]) => void): void;
    _rangeReadPKs(table: string, fromPK: any, toPK: any, complete: (rows: DBRow[]) => void): void;
    _read(table: string, query: (row: DBRow, idx: number, toKeep: (result: boolean) => void) => void | any[], callback: (rows: DBRow[]) => void): void;
    _trieRead(table: string, column: string, search: string, callback: (rows: DBRow[]) => void): void;
    _write(table: string, pk: DBKey, oldRow: any, newRow: DBRow, complete: (row: DBRow) => void): void;
    _delete(table: string, pk: DBKey, complete: (row: DBRow) => void): void;
    _drop(table: string, complete: () => void): void;
}
