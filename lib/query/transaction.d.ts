import { IdbQuery } from "./std-query";
export declare class _NanoSQLTransactionQuery {
    private _db;
    _queries: IdbQuery[];
    thisQ: IdbQuery;
    constructor(action: string, args: any, table: string, queries: IdbQuery[], transactionID: string);
    where(args: any[] | any): _NanoSQLTransactionQuery;
    exec(): void;
}
