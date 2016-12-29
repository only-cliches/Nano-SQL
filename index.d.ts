import { TSMap } from "typescript-map";
import { TSPromise } from "typescript-promise";
export interface ActionOrView {
    name: string;
    args?: Array<string>;
    call: (args?: Object) => TSPromise<any>;
}
export interface DataModel {
    key: string;
    type: "string" | "int" | "float" | "array" | "map" | "bool";
    props?: Array<any>;
}
export interface QueryLine {
    type: string;
    args?: any;
}
export declare class SomeSQLInstance {
    private _selectedTable;
    private _query;
    private _backend;
    private _callbacks;
    private _events;
    private _views;
    private _actions;
    private _models;
    private _triggerEvents;
    private _activeActionOrView;
    private _filters;
    private _permanentFilters;
    constructor();
    table(table?: string): SomeSQLInstance;
    connect(backend?: SomeSQLBackend): TSPromise<Object | string>;
    on(actions: "change" | "delete" | "upsert" | "drop" | "select" | "error", callBack: Function): SomeSQLInstance;
    off(callBack: Function): SomeSQLInstance;
    alwaysApplyFilter(filterName: string): SomeSQLInstance;
    model(dataModel: Array<DataModel>): SomeSQLInstance;
    views(viewArray: Array<ActionOrView>): SomeSQLInstance;
    getView(viewName: string, viewArgs: Object): TSPromise<Object | string>;
    private _cleanArgs(argDeclarations, args);
    private _cast(type, val);
    actions(actionArray: Array<ActionOrView>): SomeSQLInstance;
    doAction(actionName: string, actionArgs: Object): TSPromise<Object | string>;
    addFilter(filterName: string, filterFunction: Function): SomeSQLInstance;
    query(action: "select" | "upsert" | "delete" | "drop", args?: Object): SomeSQLInstance;
    where(args: Array<any | Array<any>>): SomeSQLInstance;
    orderBy(args: Object): SomeSQLInstance;
    limit(args: number): SomeSQLInstance;
    offset(args: number): SomeSQLInstance;
    filter(name: string, args?: any): SomeSQLInstance;
    private _addCmd(type, args);
    exec(): TSPromise<Array<Object | string>>;
    custom(argType: string, args?: any): any;
    loadJS(rows: Array<Object>): TSPromise<Object | string>;
    loadCSV(csv: string): TSPromise<Object | string>;
    toCSV(headers?: boolean): TSPromise<string>;
    static uuid(inputUUID?: string): string;
    static hash(str: string): string;
}
export interface SomeSQLBackend {
    connect(models: TSMap<string, Array<Object>>, actions: TSMap<string, Array<ActionOrView>>, views: TSMap<string, Array<ActionOrView>>, filters: TSMap<string, Function>, onSuccess: Function, onFail?: Function): void;
    exec(table: string, query: Array<QueryLine>, viewOrAction: string, onSuccess: Function, onFail?: Function): void;
    custom?(command: string, args: any): any;
}
export declare function SomeSQL(table: string): SomeSQLInstance;
