import { someSQL_Backend } from "./index";
import { tsMap } from "typescript-map";
export declare class someSQL_MemDB implements someSQL_Backend {
    private _tables;
    private _models;
    private _sT;
    private _act;
    private _mod;
    private _cacheKey;
    private _tIndex;
    private _tCacheI;
    private _immu;
    private _i;
    constructor();
    connect(models: tsMap<string, Array<Object>>, callback: Function): void;
    private _newModel(table, args);
    exec(table: string, query: Array<tsMap<string, Object | Array<any>>>, onSuccess: Function, onFail?: Function): void;
    private _query(queryArg, resolve);
    private _exec(callBack);
    private _where(tableIndexes);
    private _compare(val1, compare, val2);
}
