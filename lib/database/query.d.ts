import { IdbQuery } from "../query/std-query";
import { _NanoSQLStorage, DBRow } from "./storage";
export declare class _NanoSQLStorageQuery {
    private _store;
    constructor(_store: _NanoSQLStorage);
    doQuery(query: IdbQuery, next: (q: IdbQuery) => void): void;
    private _updateORMRows(relation, fromPKs, add, primaryKey, complete);
    private _syncORM(type, oldRows, newRows, complete);
}
export declare class _MutateSelection {
    q: IdbQuery;
    s: _NanoSQLStorage;
    constructor(q: IdbQuery, s: _NanoSQLStorage);
    _executeQueryArguments(inputRows: DBRow[], callback: (rows: DBRow[]) => void): void;
}
export declare class _RowSelection {
    q: IdbQuery;
    s: _NanoSQLStorage;
    constructor(q: IdbQuery, s: _NanoSQLStorage);
    getRows(callback: (rows: DBRow[]) => void): void;
}
export declare class InstanceSelection {
    q: IdbQuery;
    constructor(q: IdbQuery);
    getRows(callback: (rows: DBRow[]) => void): void;
}
