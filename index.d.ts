import { tsPromise } from "typescript-promise";
export declare class someSQL_Instance {
    private _selectedTable;
    private _query;
    private _backend;
    private _callbacks;
    private _events;
    private _views;
    private _actions;
    private _models;
    private _triggerEvents;
    constructor(backend?: any);
    init(table?: string): someSQL_Instance;
    connect(backend: someSQL_Backend): someSQL_Instance;
    on(actions: string, callBack: Function): someSQL_Instance;
    model(dataModel: Array<any>): someSQL_Instance;
    views(viewMap: any): someSQL_Instance;
    getView(viewName: any, viewArgs: any): tsPromise<any>;
    private _cleanArgs(funcArray, args);
    private _cast(type, val);
    actions(actionMap: any): someSQL_Instance;
    doAction(actionName: any, actionArgs: any): tsPromise<any>;
    query(action: string, args?: any): someSQL_Instance;
    where(args: any): someSQL_Instance;
    andWhere(args: any): someSQL_Instance;
    orWhere(args: any): someSQL_Instance;
    orderBy(args: any): someSQL_Instance;
    limit(args: any): someSQL_Instance;
    offset(args: any): someSQL_Instance;
    exec(): tsPromise<any>;
    custom(argType: string, args: any): tsPromise<any>;
    uuid(inputUUID?: string): string;
    loadJS(rows: Array<any>): tsPromise<any>;
    loadCSV(csv: string): tsPromise<any>;
    toCSV(headers?: boolean): tsPromise<any>;
}
export interface someSQL_Backend {
    new (parent: someSQL_Instance, args?: any): someSQL_Backend;
    newModel(table: string, args: any): void;
    exec(table: string, query: Array<any>, callback: Function): void;
    custom?(command: string, args: any, callback: Function): void;
}
export declare function someSQL(table?: string): someSQL_Instance;
