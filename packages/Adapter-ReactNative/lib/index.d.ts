import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "@nano-sql/core/lib/interfaces";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
export declare const binaryInsert: (arr: any[], value: any, remove: boolean, startVal?: number | undefined, endVal?: number | undefined) => boolean;
export declare class NativeStorage extends nanoSQLMemoryIndex {
    cacheIndexes: boolean;
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    private _id;
    private _indexes;
    private _ai;
    private _tableConfigs;
    constructor(cacheIndexes: boolean);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    key(table: string, pk: any): string;
    getIndex(table: string): Promise<any[]>;
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void): void;
    dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    disconnect(complete: () => void, error: (err: any) => void): void;
    write(table: string, pk: any, row: {
        [key: string]: any;
    }, complete: (pk: any) => void, error: (err: any) => void): void;
    read(table: string, pk: any, complete: (row: {
        [key: string]: any;
    } | undefined) => void, error: (err: any) => void): void;
    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void): void;
    delete(table: string, pk: any, complete: () => void, error: (err: any) => void): void;
    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void): void;
    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void): void;
}
