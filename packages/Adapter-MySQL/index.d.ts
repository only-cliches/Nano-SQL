import { NanoSQLStorageAdapter, DBKey, DBRow } from "nano-sql/lib/database/storage";
import { DataModel } from "nano-sql/lib/index";
export interface mySQLConnection {
    query: (sql: string, callback: (err: Error, results: any, fields: any) => void) => void;
    release: () => void;
}
export declare class SQLResult {
    rowData: any[];
    rows: {
        item: (idx: number) => any;
        length: number;
    };
    constructor(rows: any[]);
}
export declare class MySQLAdapter implements NanoSQLStorageAdapter {
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
    private _pkKey;
    private _pkType;
    private _doAI;
    private _id;
    private _db;
    private _filename;
    private _mode;
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
    setID(id: string): void;
    connect(complete: () => void): void;
    private _chkTable(table);
    makeTable(tableName: string, dataModels: DataModel[]): void;
    _sql(allowWrite: boolean, sql: string, args: any[], complete: (rows: SQLResult) => void, getPK?: string): void;
    write(table: string, pk: DBKey | null, data: DBRow, complete: (finalRow: DBRow) => void, error?: (err: Error) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
}
