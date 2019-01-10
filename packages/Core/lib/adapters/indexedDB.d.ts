import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "../interfaces";
import { nanoSQLMemoryIndex } from "./memoryIndex";
export declare class IndexedDB extends nanoSQLMemoryIndex {
    version?: number | undefined;
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    private _db;
    private _id;
    private _ai;
    private _tableConfigs;
    constructor(version?: number | undefined);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void): void;
    dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    disconnect(complete: () => void, error: (err: any) => void): void;
    store(table: string, type: IDBTransactionMode, open: (tr: IDBTransaction, store: IDBObjectStore) => void, error: (err: any) => void): void;
    write(table: string, pk: any, row: {
        [key: string]: any;
    }, complete: (pk: any) => void, error: (err: any) => void): void;
    read(table: string, pk: any, complete: (row: {
        [key: string]: any;
    } | undefined) => void, error: (err: any) => void): void;
    delete(table: string, pk: any, complete: () => void, error: (err: any) => void): void;
    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void): void;
    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void): void;
    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void): void;
}
