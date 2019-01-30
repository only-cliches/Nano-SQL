import { InanoSQLQueryBuilder, InanoSQLInstance, InanoSQLQuery, InanoSQLJoinArgs, InanoSQLGraphArgs, TableQueryResult } from "./interfaces";
export declare class _nanoSQLQueryBuilder implements InanoSQLQueryBuilder {
    _db: InanoSQLInstance;
    _error: string;
    _AV: string;
    _query: InanoSQLQuery;
    static execMap: any;
    constructor(db: InanoSQLInstance, table: string | any[] | ((where?: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)) => Promise<TableQueryResult>), queryAction: string | ((nSQL: InanoSQLInstance) => InanoSQLQuery), queryArgs?: any, actionOrView?: string);
    where(args: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)): _nanoSQLQueryBuilder;
    orderBy(columns: string[] | {
        [col: string]: string;
    }): _nanoSQLQueryBuilder;
    distinct(columns: string[]): _nanoSQLQueryBuilder;
    groupBy(columns: string[] | {
        [col: string]: string;
    }): _nanoSQLQueryBuilder;
    having(args: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)): _nanoSQLQueryBuilder;
    join(args: InanoSQLJoinArgs | InanoSQLJoinArgs[]): _nanoSQLQueryBuilder;
    limit(args: number): _nanoSQLQueryBuilder;
    comment(comment: string): _nanoSQLQueryBuilder;
    tag(tag: string): _nanoSQLQueryBuilder;
    extend(scope: string, ...args: any[]): _nanoSQLQueryBuilder;
    union(queries: (() => Promise<any[]>)[], unionAll?: boolean): _nanoSQLQueryBuilder;
    offset(args: number): _nanoSQLQueryBuilder;
    emit(): InanoSQLQuery;
    ttl(seconds?: number, cols?: string[]): _nanoSQLQueryBuilder;
    graph(ormArgs: InanoSQLGraphArgs[]): _nanoSQLQueryBuilder;
    from(tableObj: {
        table: string | any[] | ((where?: any[] | ((row: {
            [key: string]: any;
        }, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string;
    } | string): _nanoSQLQueryBuilder;
    into(table: string): _nanoSQLQueryBuilder;
    on(table: string): _nanoSQLQueryBuilder;
    toCSV(headers?: boolean): any;
    exec(returnEvents?: boolean): Promise<any[]>;
    listen(args?: {
        debounce?: number;
        unique?: boolean;
        compareFn?: (rowsA: any[], rowsB: any[]) => boolean;
    }): _nanoSQLObserverQuery;
    stream(onRow: (row: any) => void, complete: () => void, err: (error: any) => void, events?: boolean): void;
    cache(cacheReady: (cacheId: string, recordCount: number) => void, error: (error: any) => void, streamPages?: {
        pageSize: number;
        onPage: (page: number, rows: any[]) => void;
        doNotCache?: boolean;
    }): void;
}
declare class _nanoSQLObserverQuery {
    query: InanoSQLQuery;
    debounce: number;
    unique: boolean;
    compareFn: (rowsA: any[], rowsB: any[]) => boolean;
    private _listenTables;
    private _mode;
    private _active;
    private _throttleTrigger;
    private _oldValues;
    private _cbs;
    constructor(query: InanoSQLQuery, debounce?: number, unique?: boolean, compareFn?: (rowsA: any[], rowsB: any[]) => boolean);
    private _getTables;
    private _doQuery;
    private _maybeError;
    trigger(): void;
    stream(onRow: (row: any) => void, complete: () => void, error: (err: any) => void, events?: boolean): void;
    exec(callback: (rows: any[], error?: any) => void, events?: boolean): void;
    unsubscribe(): void;
}
export {};
