import { Promise } from "lie-ts";
export interface UUID extends String {
}
export interface StdObject<T> {
    [key: string]: T;
}
export interface DBFunction {
    call: (row: DBRow, args: string[], ptr: number[], prev?: any) => DBRow[];
    type: "aggregate" | "simple";
}
export interface ActionOrView {
    name: string;
    args?: Array<string>;
    extend?: any;
    call: (args?: any, db?: NanoSQLInstance) => Promise<any>;
}
export interface DataModel {
    key: string;
    type: "string" | "int" | "float" | "array" | "map" | "bool" | "uuid" | "blob" | string;
    default?: any;
    props?: Array<any>;
}
export interface QueryLine {
    type: string;
    args?: any;
}
export interface DatabaseEvent {
    table: string;
    query: Array<QueryLine>;
    time: number;
    result: Array<any>;
    name: "change" | "delete" | "upsert" | "drop" | "select" | "error";
    actionOrView: string;
    changeType: string;
    changedRows: DBRow[];
}
export interface JoinArgs {
    type: "left" | "inner" | "right" | "cross" | "outer";
    table: string;
    where?: Array<string>;
}
export interface DBRow {
    [key: string]: any;
}
export declare const _assign: (obj: any) => any;
export interface IActionViewMod {
    (tableName: string, actionOrView: "Action" | "View", name: string, args: any, complete: (args: any) => void, error?: (errorMessage: string) => void): void;
}
export declare class NanoSQLInstance {
    backend: NanoSQLBackend;
    data: any;
    _hasEvents: StdObject<boolean>;
    private _functions;
    _AVMod: IActionViewMod;
    constructor();
    table(table?: string): NanoSQLInstance;
    connect(backend?: NanoSQLBackend): Promise<Object | string>;
    on(actions: "change" | "delete" | "upsert" | "drop" | "select" | "error", callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance;
    off(callBack: Function): NanoSQLInstance;
    private _refreshEventChecker();
    model(dataModel: Array<DataModel>): NanoSQLInstance;
    views(viewArray: Array<ActionOrView>): NanoSQLInstance;
    getView(viewName: string, viewArgs?: any): Promise<Array<any> | NanoSQLInstance>;
    cleanArgs(argDeclarations: Array<string>, args: StdObject<any>): StdObject<any>;
    actions(actionArray: Array<ActionOrView>): NanoSQLInstance;
    doAction(actionName: string, actionArgs: any): Promise<Array<DBRow> | NanoSQLInstance>;
    private _doAV(AVType, AVList, AVName, AVargs);
    newFunction(functionName: string, functionType: "aggregate" | "simple", filterFunction: (row: DBRow, args: string[], ptr: number[], prev?: any) => DBRow[]): NanoSQLInstance;
    query(action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe", args?: any): _NanoSQLQuery;
    triggerEvent(eventData: DatabaseEvent, triggerEvents: Array<string>): void;
    default(replaceObj?: any): {
        [key: string]: any;
    };
    beginTransaction(): void;
    endTransaction(): void;
    queryFilter(callBack: (args: DBExec, complete: (args: DBExec) => void) => void): NanoSQLInstance;
    avFilter(filterFunc: IActionViewMod): this;
    config(args: any): NanoSQLInstance;
    extend(...args: Array<any>): any | NanoSQLInstance;
    loadJS(table: string, rows: Array<Object>): Promise<Array<Object>>;
    rowFilter(callBack: (row: any) => any): this;
    loadCSV(table: string, csv: string): Promise<Array<Object>>;
    static uuid(): string;
}
export declare class _NanoSQLQuery {
    private _db;
    _action: {
        type: string;
        args: any;
    };
    _modifiers: any[];
    _table: string;
    _error: string;
    _AV: string;
    constructor(table: string, db: NanoSQLInstance, actionOrView?: string);
    where(args: Array<any | Array<any>>): _NanoSQLQuery;
    orderBy(args: {
        [key: string]: "asc" | "desc";
    }): _NanoSQLQuery;
    groupBy(columns: {
        [key: string]: "asc" | "desc";
    }): _NanoSQLQuery;
    having(args: Array<any | Array<any>>): _NanoSQLQuery;
    join(args: JoinArgs): _NanoSQLQuery;
    limit(args: number): _NanoSQLQuery;
    offset(args: number): _NanoSQLQuery;
    toCSV(headers?: boolean): Promise<string>;
    exec(): Promise<Array<Object | NanoSQLInstance>>;
}
export interface DBConnect {
    _models: StdObject<Array<DataModel>>;
    _actions: StdObject<Array<ActionOrView>>;
    _views: StdObject<Array<ActionOrView>>;
    _functions: {
        [key: string]: DBFunction;
    };
    _config: Array<any>;
    _parent: NanoSQLInstance;
    _onSuccess: Function;
    _onFail?: Function;
}
export interface DBExec {
    table: string;
    query: Array<QueryLine>;
    viewOrAction: string;
    onSuccess: (rows: Array<Object>, type: string, affectedRows: DBRow[]) => void;
    onFail: (rows: Array<Object>) => void;
}
export interface NanoSQLBackend {
    _connect(connectArgs: DBConnect): void;
    _exec(execArgs: DBExec): void;
    _extend?(instance: NanoSQLInstance, ...args: Array<any>): any;
    _transaction?(type: "start" | "end"): void;
}
export declare const nSQL: (setTablePointer?: string | undefined) => NanoSQLInstance;
