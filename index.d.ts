import { tsMap } from "typescript-map";
import { TSPromise } from "typescript-promise";
export interface ActionOrView {
    name: string;
    args?: Array<string>;
    call: (args?: Object) => TSPromise<any>;
}
export interface DateModel {
    key: string;
    type: string;
    props?: Array<any>;
}
export declare class SomeSQLInstance {
    constructor();
    table(table?: string): SomeSQLInstance;
    connect(backend?: SomeSQLBackend): TSPromise<Object | string>;
    on(actions: string, callBack: Function): SomeSQLInstance;
    off(callBack: Function): SomeSQLInstance;
    alwaysApplyFilter(filterName: string): SomeSQLInstance;
    model(dataModel: Array<DateModel>): SomeSQLInstance;
    views(viewArray: Array<ActionOrView>): SomeSQLInstance;
    getView(viewName: string, viewArgs: Object): TSPromise<Object | string>;
    actions(actionArray: Array<ActionOrView>): SomeSQLInstance;
    doAction(actionName: string, actionArgs: Object): TSPromise<Object | string>;
    addFilter(filterName: string, filterFunction: Function): SomeSQLInstance;
    query(action: string, args?: Object): SomeSQLInstance;
    where(args: Array<any>): SomeSQLInstance;
    orderBy(args: Object): SomeSQLInstance;
    limit(args: number): SomeSQLInstance;
    offset(args: number): SomeSQLInstance;
    filter(name: string, args?: any): SomeSQLInstance;
    exec(): TSPromise<Array<Object | string>>;
    custom(argType: string, args: any): TSPromise<any>;
    loadJS(rows: Array<Object>): TSPromise<Object | string>;
    loadCSV(csv: string): TSPromise<Object | string>;
    toCSV(headers?: boolean): TSPromise<string>;
    static uuid(inputUUID?: string): string;
    static hash(str: string): string;
}
export interface SomeSQLBackend {
    connect(models: tsMap<string, Array<Object>>, actions: tsMap<string, Object>, views: tsMap<string, Object>, filters: tsMap<string, Function>, onSuccess: Function, onFail?: Function): void;
    exec(table: string, query: Array<tsMap<string, Object | Array<any>>>, viewOrAction: string, onSuccess: Function, onFail?: Function): void;
    custom?(command: string, args: any, onSuccess: Function, onFail?: Function): void;
}
export declare function SomeSQL(table: string): SomeSQLInstance;
