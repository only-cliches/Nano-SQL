import { InanoSQLAdapter, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "@nano-sql/core/lib/interfaces";
import * as redis from "redis";
export declare class Redis implements InanoSQLAdapter {
    connectArgs?: redis.ClientOpts | undefined;
    getClient?: ((redisClient: redis.RedisClient) => void) | undefined;
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    private _id;
    private _db;
    private _tableConfigs;
    constructor(connectArgs?: redis.ClientOpts | undefined, getClient?: ((redisClient: redis.RedisClient) => void) | undefined);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    key(tableName: string, key: any): string;
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void): void;
    dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    disconnect(complete: () => void, error: (err: any) => void): void;
    write(table: string, pk: any, row: {
        [key: string]: any;
    }, complete: (pk: any) => void, error: (err: any) => void): void;
    read(table: string, pk: any, complete: (row: {
        [key: string]: any;
    } | undefined) => void, error: (err: any) => void): void;
    readZIndex(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, complete: (index: any[]) => void, error: (err: any) => void): void;
    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void): void;
    delete(table: string, pk: any, complete: () => void, error: (err: any) => void): void;
    maybeMapIndex(table: string, index: any[]): any[];
    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void): void;
    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void): void;
    createIndex(tableId: string, index: string, type: string, complete: () => void, error: (err: any) => void): void;
    deleteIndex(tableId: string, index: string, complete: () => void, error: (err: any) => void): void;
    addIndexValue(tableId: string, index: string, rowID: any, indexKey: any, complete: () => void, error: (err: any) => void): Promise<void> | undefined;
    deleteIndexValue(tableId: string, index: string, rowID: any, indexKey: any, complete: () => void, error: (err: any) => void): void;
    readIndexKey(tableId: string, index: string, indexKey: any, onRowPK: (pk: any) => void, complete: () => void, error: (err: any) => void): void;
    readIndexKeys(tableId: string, index: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, id: any) => void, complete: () => void, error: (err: any) => void): void;
}
