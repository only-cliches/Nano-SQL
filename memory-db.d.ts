import { someSQL_Backend } from "./index";
import { tsMap } from "typescript-map";
export declare class someSQL_MemDB implements someSQL_Backend {
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
    connect(models: tsMap<string, Array<Object>>, actions: tsMap<string, Object>, views: tsMap<string, Object>, filters: tsMap<string, Function>, callback: Function): void;
    private _newModel(table, args);
    exec(table: string, query: Array<tsMap<string, Object | Array<any>>>, viewOrAction: string, onSuccess: Function, onFail?: Function): void;
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
