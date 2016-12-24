import { tsMap } from "typescript-map";
import { tsPromise } from "typescript-promise";
export declare class someSQL_Instance {
    private _permanentFilters;
    constructor();
    init(table?: string): someSQL_Instance;
    connect(backend?: someSQL_Backend): tsPromise<Object | string>;
    on(actions: string, callBack: Function): someSQL_Instance;
    off(callBack: Function): someSQL_Instance;
    alwaysApplyFilter(filterName: string): someSQL_Instance;
    model(dataModel: Array<Object>): someSQL_Instance;
    views(viewMap: Object): someSQL_Instance;
    getView(viewName: string, viewArgs: Object): tsPromise<Object | string>;
    actions(actionMap: Object): someSQL_Instance;
    doAction(actionName: string, actionArgs: Object): tsPromise<Object | string>;
    addFilter(filterName: string, filterFunction: Function): someSQL_Instance;
    query(action: string, args?: Object): someSQL_Instance;
    where(args: Array<any>): someSQL_Instance;
    orderBy(args: Array<Object>): someSQL_Instance;
    limit(args: number): someSQL_Instance;
    offset(args: number): someSQL_Instance;
    filter(name: string, args?: any): someSQL_Instance;
    exec(): tsPromise<Array<Object | string>>;
    custom(argType: string, args: any): tsPromise<any>;
    loadJS(rows: Array<Object>): tsPromise<Object | string>;
    loadCSV(csv: string): tsPromise<Object | string>;
    toCSV(headers?: boolean): tsPromise<string>;
    static uuid(inputUUID?: string): string;
    static hash(str: string): string;
}
export interface someSQL_Backend {
    connect(models: tsMap<string, Array<Object>>, actions: tsMap<string, Object>, views: tsMap<string, Object>, filters: tsMap<string, Function>, onSuccess: Function, onFail?: Function): void;
    exec(table: string, query: Array<tsMap<string, Object | Array<any>>>, viewOrAction: string, onSuccess: Function, onFail?: Function): void;
    custom?(command: string, args: any, onSuccess: Function, onFail?: Function): void;
}
export declare function someSQL(table?: string): someSQL_Instance;
