import { NanoSQLInstance, ORMArgs, JoinArgs } from "./index";
import { Promise } from "lie-ts";
export declare class _NanoSQLQuery {
    private _db;
    _action: {
        type: string;
        args: any;
    };
    _modifiers: any[];
    _table: string;
    _error: string;
    _AV: string;
    _transactionID: number;
    constructor(table: string, db: NanoSQLInstance, actionOrView?: string);
    tID(transactionID?: number): _NanoSQLQuery;
    where(args: Array<any | Array<any>>): _NanoSQLQuery;
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
    offset(args: number): _NanoSQLQuery;
    toCSV(headers?: boolean): Promise<string>;
    manualExec(table: string, modifiers: any[]): Promise<Array<Object | NanoSQLInstance>>;
    exec(): Promise<Array<Object | NanoSQLInstance>>;
}
export declare class _NanoSQLORMQuery {
    private _db;
    private _tableName;
    private _action;
    private _column;
    private _relationIDs;
    private _whereArgs;
    _transactionID: number;
    constructor(db: NanoSQLInstance, table: string, action: "add" | "delete" | "drop" | "rebuild" | "set", column?: string, relationIDs?: any[]);
    where(args: Array<any | Array<any>>): this;
    rebuild(callBack: (updatedRows: number) => void): void;
    tID(transactionID?: number): _NanoSQLORMQuery;
    exec(): Promise<number>;
}
