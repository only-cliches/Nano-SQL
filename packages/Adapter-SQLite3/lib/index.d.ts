import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "@nano-sql/core/lib/interfaces";
import * as AWS from "aws-sdk";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
export interface DynamoAdapterArgs {
    filterSchema?: (schema: AWS.DynamoDB.CreateTableInput) => AWS.DynamoDB.CreateTableInput;
    filterDrop?: (dropReq: AWS.DynamoDB.DeleteTableInput) => AWS.DynamoDB.DeleteTableInput;
    filterScan?: (scanReq: AWS.DynamoDB.DocumentClient.ScanInput) => AWS.DynamoDB.DocumentClient.ScanInput;
    filterQuery?: (queryReq: AWS.DynamoDB.DocumentClient.QueryInput) => AWS.DynamoDB.DocumentClient.QueryInput;
    filterUpdate?: (updateReq: AWS.DynamoDB.DocumentClient.UpdateItemInput) => AWS.DynamoDB.DocumentClient.UpdateItemInput;
    filterDelete?: (deleteReq: AWS.DynamoDB.DocumentClient.DeleteItemInput) => AWS.DynamoDB.DocumentClient.DeleteItemInput;
    filterGet?: (getReq: AWS.DynamoDB.DocumentClient.GetItemInput) => AWS.DynamoDB.DocumentClient.GetItemInput;
}
export interface DynamoAdapterConfig {
    filterSchema: (schema: AWS.DynamoDB.CreateTableInput) => AWS.DynamoDB.CreateTableInput;
    filterDrop: (dropReq: AWS.DynamoDB.DeleteTableInput) => AWS.DynamoDB.DeleteTableInput;
    filterScan: (scanReq: AWS.DynamoDB.DocumentClient.ScanInput) => AWS.DynamoDB.DocumentClient.ScanInput;
    filterQuery: (queryReq: AWS.DynamoDB.DocumentClient.QueryInput) => AWS.DynamoDB.DocumentClient.QueryInput;
    filterUpdate: (updateReq: AWS.DynamoDB.DocumentClient.UpdateItemInput) => AWS.DynamoDB.DocumentClient.UpdateItemInput;
    filterDelete: (deleteReq: AWS.DynamoDB.DocumentClient.DeleteItemInput) => AWS.DynamoDB.DocumentClient.DeleteItemInput;
    filterGet: (getReq: AWS.DynamoDB.DocumentClient.GetItemInput) => AWS.DynamoDB.DocumentClient.GetItemInput;
}
export declare const copy: (e: any) => any;
export declare class DynamoDB extends nanoSQLMemoryIndex {
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    private _id;
    private _db;
    private _connectArgs;
    private _client;
    private config;
    private _tableConfigs;
    constructor(connectArgs?: AWS.DynamoDB.ClientConfiguration, args?: DynamoAdapterArgs);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    table(tableName: string): string;
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
