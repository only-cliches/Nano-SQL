import { NanoSQLInstance, ORMArgs, JoinArgs, DBRow } from "../index";
import { Promise } from "lie-ts";
export interface IdbQuery {
    table: string | any[];
    action: string;
    actionArgs: any;
    state: string;
    queryID?: string;
    transaction?: boolean;
    where?: (row: DBRow, idx: number) => boolean | any[];
    range?: number[];
    orm?: (string | ORMArgs)[];
    orderBy?: {
        [column: string]: "asc" | "desc";
    };
    groupBy?: {
        [column: string]: "asc" | "desc";
    };
    having?: any[];
    join?: JoinArgs;
    limit?: number;
    offset?: number;
    trie?: {
        column: string;
        search: string;
    };
    comments: string[];
    extend?: any[];
    result: DBRow[];
}
export declare class _NanoSQLQuery {
    private _db;
    _error: string;
    _AV: string;
    private _query;
    constructor(table: string | any[], db: NanoSQLInstance, queryAction: string, queryArgs?: any, actionOrView?: string, bypassORMPurge?: boolean);
    where(args: any[] | any): _NanoSQLQuery;
    range(limit: number, offset: number): _NanoSQLQuery;
    orm(ormArgs?: (string | ORMArgs)[]): _NanoSQLQuery;
    orderBy(args: {
        [key: string]: "asc" | "desc";
    }): _NanoSQLQuery;
    groupBy(columns: {
        [key: string]: "asc" | "desc";
    }): _NanoSQLQuery;
    having(args: Array<any | Array<any>>): _NanoSQLQuery;
    join(args: JoinArgs): _NanoSQLQuery;
    limit(args: number): _NanoSQLQuery;
    trieSearch(column: string, stringToSearch: string): _NanoSQLQuery;
    comment(comment: string): _NanoSQLQuery;
    extend(...args: any[]): _NanoSQLQuery;
    offset(args: number): _NanoSQLQuery;
    toCSV(headers?: boolean): Promise<string>;
    manualExec(query: IdbQuery, complete?: (err: any, result: any[]) => void): Promise<any>;
    exec(): Promise<(object | NanoSQLInstance)[]>;
}
