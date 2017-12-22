import { NanoSQLInstance, ORMArgs, JoinArgs, DBRow } from "../index";
export interface IdbQuery extends IdbQueryBase {
    table: string | any[];
    action: string;
    actionArgs: any;
    state: string;
    result: DBRow[];
    comments: string[];
}
export interface IdbQueryBase {
    queryID?: string;
    transaction?: boolean;
    where?: (row: DBRow, idx: number) => boolean | any[];
    range?: number[];
    ormSync?: string[];
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
    extend?: any[];
}
export interface IdbQueryExec extends IdbQueryBase {
    table?: string | any[];
    action?: string;
    actionArgs?: any;
    state?: string;
    comments?: string[];
    result?: DBRow[];
}
export declare class _NanoSQLQuery {
    private _db;
    _error: string;
    _AV: string;
    private _query;
    constructor(table: string | any[], db: NanoSQLInstance, queryAction: string, queryArgs?: any, actionOrView?: string);
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
    toCSV(headers?: boolean): any;
    manualExec(query: IdbQueryExec): Promise<any>;
    exec(): any;
}
