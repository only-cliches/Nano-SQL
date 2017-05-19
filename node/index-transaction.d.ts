import { ORMArgs } from "./index";
export declare class _NanoSQLTransactionORMQuery {
    private _queries;
    private _query;
    constructor(queries: any[], table: string, action: "add" | "delete" | "drop" | "rebuild" | "set", column?: string, relationIDs?: any[]);
    where(args: Array<any | Array<any>>): this;
    exec(): void;
}
export declare class _NanoSQLTransactionQuery {
    private _db;
    _modifiers: any[];
    _table: string;
    _queries: any[];
    _action: string;
    _actionArgs: any;
    constructor(action: string, args: any, table: string, queries: any[]);
    where(args: Array<any | Array<any>>): _NanoSQLTransactionQuery;
    orm(ormArgs?: (string | ORMArgs)[]): _NanoSQLTransactionQuery;
    private _addCmd(type, args);
    exec(): void;
}
