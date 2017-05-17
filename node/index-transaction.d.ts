import { ORMArgs, JoinArgs } from "./index";
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
    range(limit: number, offset: number): _NanoSQLTransactionQuery;
    orm(ormArgs?: (string | ORMArgs)[]): _NanoSQLTransactionQuery;
    orderBy(args: {
        [key: string]: "asc" | "desc";
    }): _NanoSQLTransactionQuery;
    groupBy(columns: {
        [key: string]: "asc" | "desc";
    }): _NanoSQLTransactionQuery;
    having(args: Array<any | Array<any>>): _NanoSQLTransactionQuery;
    join(args: JoinArgs): _NanoSQLTransactionQuery;
    limit(args: number): _NanoSQLTransactionQuery;
    trieSearch(column: string, stringToSearch: string): _NanoSQLTransactionQuery;
    offset(args: number): _NanoSQLTransactionQuery;
    private _addCmd(type, args);
    exec(): void;
}
