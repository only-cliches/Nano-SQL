import { IdbQuery } from "../query/std-query";
import { _NanoSQLStorage, DBRow } from "./storage";
export declare class _NanoSQLStorageQuery {
    private _store;
    private _query;
    private _isInstanceTable;
    constructor(_store: _NanoSQLStorage);
    doQuery(query: IdbQuery, next: (q: IdbQuery) => void): void;
    private _getRows(complete);
    private _select(next);
    private _upsert(next);
    private _delete(next);
    private _drop(next);
}
export declare class _MutateSelection {
    q: IdbQuery;
    s: _NanoSQLStorage;
    private _groupByColumns;
    private _sortGroups;
    constructor(q: IdbQuery, s: _NanoSQLStorage);
    private _join(rows, complete);
    private _groupByKey(columns, row);
    private _groupBy(rows);
    private _having(rows);
    private _orderBy(rows);
    private _offset(rows);
    private _limit(rows);
    private _ormTableCache;
    private _orm(rows, complete);
    private _doJoin(type, leftTable, rightTable, joinConditions, complete);
    private _sortObj(objA, objB, columns, resolvePaths);
    private _mutateRows(rows, complete);
    _executeQueryArguments(inputRows: DBRow[], callback: (rows: DBRow[]) => void): void;
}
export declare class _RowSelection {
    q: IdbQuery;
    s: _NanoSQLStorage;
    constructor(q: IdbQuery, s: _NanoSQLStorage);
    getRows(callback: (rows: DBRow[]) => void): void;
    private _selectByKeys(callback);
    private _selectRowsByIndex(where, callback);
    private _selectByRange(callback);
    private _selectByTrie(callback);
    private _fullTableScan(callback);
    private _isOptimizedWhere(wArgs);
}
export declare class InstanceSelection {
    q: IdbQuery;
    constructor(q: IdbQuery);
    getRows(callback: (rows: DBRow[]) => void): void;
}
