import { SomeSQLBackend } from "./index";
import { TSMap } from "typescript-map";
export declare class SomeSQLMemDB implements SomeSQLBackend {
    private _tables;
    private _selectedTable;
    private _act;
    private _mod;
    private _filters;
    private _cacheKey;
    private _cacheIndex;
    private _cacheQueryIndex;
    private _cache;
    private _pendingQuerys;
    constructor();
    connect(models: TSMap<string, Array<Object>>, actions: TSMap<string, Object>, views: TSMap<string, Object>, filters: TSMap<string, Function>, callback: Function): void;
    private _newModel(table, args);
    exec(table: string, query: Array<TSMap<string, Object | Array<any>>>, viewOrAction: string, onSuccess: Function, onFail?: Function): void;
    private _query(queryArg, resolve);
    private _initFilters();
    private _doFilter(filterName, rows, filterArgs?);
    private _runFilters(dbRows);
    private _removeCacheFromKeys(affectedKeys);
    private _exec(callBack);
    private _newWhere(table, whereStatement);
    private _singleWhereResolve(table, whereStatement);
    private _compare(val1, compare, val2);
}
