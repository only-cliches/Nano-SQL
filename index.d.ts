import { tsMap } from "typescript-map";
import { tsPromise } from "typescript-promise";
export declare class SomeSQLInstance {
    constructor();
    table(table?: string): SomeSQLInstance;
    connect(backend?: SomeSQLBackend): tsPromise<Object | string>;
    on(actions: string, callBack: Function): SomeSQLInstance;
    off(callBack: Function): SomeSQLInstance;
    alwaysApplyFilter(filterName: string): SomeSQLInstance;
    model(dataModel: Array<{
        key: string;
        type: string;
        props?: Array<any>;
    }>): SomeSQLInstance;
    views(viewArray: Array<{
        name: string;
        args?: Array<string>;
        call: (args?: Object) => any;
    }>): SomeSQLInstance;
    getView(viewName: string, viewArgs: Object): tsPromise<Object | string>;
    actions(actionArray: Array<{
        name: string;
        args?: Array<string>;
        call: (args?: Object) => any;
    }>): SomeSQLInstance;
    doAction(actionName: string, actionArgs: Object): tsPromise<Object | string>;
    addFilter(filterName: string, filterFunction: Function): SomeSQLInstance;
    query(action: string, args?: Object): SomeSQLInstance;
    where(args: Array<any>): SomeSQLInstance;
    orderBy(args: Object): SomeSQLInstance;
    limit(args: number): SomeSQLInstance;
    offset(args: number): SomeSQLInstance;
    filter(name: string, args?: any): SomeSQLInstance;
    exec(): tsPromise<Array<Object | string>>;
    custom(argType: string, args: any): tsPromise<any>;
    loadJS(rows: Array<Object>): tsPromise<Object | string>;
    loadCSV(csv: string): tsPromise<Object | string>;
    toCSV(headers?: boolean): tsPromise<string>;
    static uuid(inputUUID?: string): string;
    static hash(str: string): string;
}
export interface SomeSQLBackend {
    connect(models: tsMap<string, Array<Object>>, actions: tsMap<string, Object>, views: tsMap<string, Object>, filters: tsMap<string, Function>, onSuccess: Function, onFail?: Function): void;
    exec(table: string, query: Array<tsMap<string, Object | Array<any>>>, viewOrAction: string, onSuccess: Function, onFail?: Function): void;
    custom?(command: string, args: any, onSuccess: Function, onFail?: Function): void;
}
export declare function someSQL(table: string): SomeSQLInstance;
