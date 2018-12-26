import { INanoSQLAdapter, INanoSQLTable, INanoSQLInstance, INanoSQLPlugin } from "../interfaces";
export declare const err: Error;
export declare class NanoSQLMemoryIndex implements INanoSQLAdapter {
    assign?: boolean | undefined;
    plugin: INanoSQLPlugin;
    nSQL: INanoSQLInstance;
    indexes: {
        [indexName: string]: {
            [key: string]: any[];
        };
    };
    indexLoaded: {
        [indexName: string]: boolean;
    };
    constructor(assign?: boolean | undefined);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    disconnect(complete: () => void, error: (err: any) => void): void;
    createTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void): void;
    dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    disconnectTable(table: string, complete: () => void, error: (err: any) => void): void;
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
    createIndex(indexName: string, type: string, complete: () => void, error: (err: any) => void): void;
    deleteIndex(indexName: string, complete: () => void, error: (err: any) => void): void;
    addIndexValue(indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void): void;
    deleteIndexValue(indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void): void;
    readIndexKey(table: string, pk: any, onRowPK: (pk: any) => void, complete: () => void, error: (err: any) => void): void;
    readIndexKeys(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, id: any) => void, complete: () => void, error: (err: any) => void): void;
}
