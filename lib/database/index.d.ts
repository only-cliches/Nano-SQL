import { IdbQuery } from "../query/std-query";
import { NanoSQLPlugin, DBConnect, NanoSQLInstance } from "../index";
export declare class NanoSQLDefaultBackend implements NanoSQLPlugin {
    private _store;
    parent: NanoSQLInstance;
    private _queryPool;
    private _queryPtr;
    constructor();
    willConnect(connectArgs: DBConnect, next: (connectArgs: DBConnect) => void): void;
    getId(): string;
    doExec(execArgs: IdbQuery, next: (execArgs: IdbQuery) => void, error: (err: Error) => void): void;
    dumpTables(tables?: string[]): any;
    importTables(tables: any, onProgress: any): any;
    willDisconnect(next: any): void;
    extend(next: (args: any[], result: any[]) => void, args: any[], result: any[]): void;
}
