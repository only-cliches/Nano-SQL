import { tsPromise } from "typescript-promise";
export declare class someSQL_Instance {
    constructor();
    init(table?: string): someSQL_Instance;
    connect(backend: someSQL_Backend): tsPromise<any>;
    on(actions: string, callBack: Function): someSQL_Instance;
    model(dataModel: Array<any>): someSQL_Instance;
    views(viewMap: any): someSQL_Instance;
    getView(viewName: any, viewArgs: any): tsPromise<any>;
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
    loadJS(rows: Array<any>): tsPromise<any>;
    loadCSV(csv: string): tsPromise<any>;
    toCSV(headers?: boolean): tsPromise<any>;
    static uuid(inputUUID?: string): string;
}
export interface someSQL_Backend {
    connect(models: any, onSuccess: Function, onFail?: Function): void;
    exec(table: string, query: Array<any>, onSuccess: Function, onFail?: Function): void;
    custom?(command: string, args: any, onSuccess: Function, onFail?: Function): void;
}
export declare function someSQL(table?: string): someSQL_Instance;
