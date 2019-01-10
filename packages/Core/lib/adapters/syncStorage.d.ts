import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "../interfaces";
import { nanoSQLMemoryIndex } from "./memoryIndex";
export declare class SyncStorage extends nanoSQLMemoryIndex {
    useLS?: boolean | undefined;
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    _index: {
        [tableName: string]: any[];
    };
    _rows: {
        [tableName: string]: {
            [key: string]: any;
        };
    };
    _id: string;
    _ai: {
        [tableName: string]: number;
    };
    _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    };
    constructor(useLS?: boolean | undefined);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void): void;
    dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    disconnect(complete: () => void, error: (err: any) => void): void;
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
