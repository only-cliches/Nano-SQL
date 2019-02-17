import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "@nano-sql/core/lib/interfaces";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
export declare class MySQL extends nanoSQLMemoryIndex {
    connectArgs: {
        connectionLimit?: number;
        host?: string;
        port?: number;
        socketPath?: string;
        user: string;
        password: string;
        database: string;
        charset?: string;
        timezone?: string;
        connectTimeout?: number;
        stringifyObjects?: boolean;
        insecureAuth?: boolean;
        debug?: boolean;
        trace?: boolean;
        multipleStatements?: boolean;
        ssl?: {
            [key: string]: any;
        };
    };
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    private _id;
    private _db;
    private _tableConfigs;
    constructor(connectArgs: {
        connectionLimit?: number;
        host?: string;
        port?: number;
        socketPath?: string;
        user: string;
        password: string;
        database: string;
        charset?: string;
        timezone?: string;
        connectTimeout?: number;
        stringifyObjects?: boolean;
        insecureAuth?: boolean;
        debug?: boolean;
        trace?: boolean;
        multipleStatements?: boolean;
        ssl?: {
            [key: string]: any;
        };
    });
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    private _chkTable;
    _sql(sql: string, args: any[], complete: (rows: any) => void, error: (err: any) => void): void;
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
