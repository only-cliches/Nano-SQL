import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, SQLiteAbstractFns } from "@nano-sql/core/lib/interfaces";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
export declare class NativeSQLite extends nanoSQLMemoryIndex {
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    _id: string;
    _db: any;
    _ai: {
        [table: string]: number;
    };
    _sqlite: SQLiteAbstractFns;
    _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    };
    _filename: string;
    constructor(fileName?: string);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void): void;
    _query(allowWrite: boolean, sql: string, args: any[], onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void;
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
