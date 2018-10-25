import { INanoSQLQueryBuilder, INanoSQLInstance, INanoSQLQuery, INanoSQLJoinArgs, IORMArgs } from "./interfaces";
export declare class _NanoSQLQueryBuilder implements INanoSQLQueryBuilder {
    _db: INanoSQLInstance;
    _error: string;
    _AV: string;
    _query: INanoSQLQuery;
    static execMap: any;
    constructor(db: INanoSQLInstance, table: string | any[] | (() => Promise<any[]>), queryAction: string | ((nSQL: INanoSQLInstance) => INanoSQLQuery), queryArgs?: any, actionOrView?: string);
    where(args: any[] | ((row: {
        [key: string]: any;
    }, i?: number, isJoin?: boolean) => boolean)): _NanoSQLQueryBuilder;
    orderBy(args: string[]): _NanoSQLQueryBuilder;
    groupBy(columns: string[]): _NanoSQLQueryBuilder;
    having(args: any[] | ((row: {
        [key: string]: any;
    }, i?: number, isJoin?: boolean) => boolean)): _NanoSQLQueryBuilder;
    join(args: INanoSQLJoinArgs | INanoSQLJoinArgs[]): _NanoSQLQueryBuilder;
    limit(args: number): _NanoSQLQueryBuilder;
    comment(comment: string): _NanoSQLQueryBuilder;
    extend(scope: string, ...args: any[]): _NanoSQLQueryBuilder;
    union(queries: (() => Promise<any[]>)[], unionAll?: boolean): _NanoSQLQueryBuilder;
    offset(args: number): _NanoSQLQueryBuilder;
    emit(): INanoSQLQuery;
    ttl(seconds?: number, cols?: string[]): _NanoSQLQueryBuilder;
    toCSV(headers?: boolean): any;
    stream(onRow: (row: any) => void, complete: () => void, err: (error: any) => void): void;
    cache(): Promise<{
        id: string;
        total: number;
    }>;
    orm(ormArgs?: (string | IORMArgs)[]): _NanoSQLQueryBuilder;
    from(table: string | any[] | (() => Promise<any[]>), AS?: string): _NanoSQLQueryBuilder;
    exec(): Promise<{
        [key: string]: any;
    }[]>;
}
