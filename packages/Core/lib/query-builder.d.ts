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
    orderBy(args: string[]): _nanoSQLQueryBuilder;
    groupBy(columns: string[]): _nanoSQLQueryBuilder;
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
    exec(returnEvents?: boolean): Promise<{
        [key: string]: any;
    }[]>;
    streamEvent(onRow: (row: any) => void, complete: () => void, err: (error: any) => void): void;
    stream(onRow: (row: any) => void, complete: () => void, err: (error: any) => void): void;
    cache(): Promise<{
        id: string;
        total: number;
    }>;
}
