import { Promise } from "lie-ts";
import { _NanoSQLQuery, _NanoSQLORMQuery } from "./index-query";
import { _NanoSQLTransactionQuery, _NanoSQLTransactionORMQuery } from "./index-transaction";
export interface UUID extends String {
}
export interface timeId extends String {
}
export interface timeIdms extends String {
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
    type: "string" | "int" | "float" | "array" | "map" | "bool" | "uuid" | "blob" | "timeId" | "timeIdms" | "safestr" | string;
    default?: any;
    props?: Array<any>;
}
export interface QueryLine {
    type: string;
    args?: any;
}
export interface DatabaseEvent {
    table: string;
    query: QueryLine[];
    time: number;
    result: any[];
    name: "change" | "delete" | "upsert" | "drop" | "select" | "error";
    actionOrView: string;
    changeType: string;
    changedRows: DBRow[];
    changedRowPKS: any[];
}
export interface JoinArgs {
    type: "left" | "inner" | "right" | "cross" | "outer";
    table: string;
    where?: Array<string>;
}
export interface ORMArgs {
    key?: string;
    offset?: number;
    limit?: number;
    orderBy?: {
        [column: string]: "asc" | "desc";
    };
    where?: any[] | any[][];
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
    _ormFns: {
        [table: string]: (column: string, row: DBRow) => ORMArgs;
    };
    _hasEvents: StdObject<boolean>;
    private _functions;
    _AVMod: IActionViewMod;
    private static _tzOffset;
    _tableNames: string[];
    private _transactionTables;
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
    query(action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe", args?: any, bypassORMPurge?: boolean): _NanoSQLQuery;
    updateORM(action: "add" | "delete" | "drop" | "rebuild" | "set", column?: string, relationIDs?: any[]): _NanoSQLORMQuery;
    defaultORM(callBack: (column: string, parentRowData: DBRow[]) => ORMArgs): this;
    triggerEvent(eventData: DatabaseEvent, triggerEvents: Array<string>): void;
    default(replaceObj?: any): {
        [key: string]: any;
    };
    doTransaction(initTransaction: (db: (table?: string) => {
        query: (action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe", args?: any) => _NanoSQLTransactionQuery;
        updateORM: (action: "add" | "delete" | "drop" | "set", column?: string, relationIDs?: any[]) => _NanoSQLTransactionORMQuery | undefined;
    }, complete: () => void) => void): Promise<any>;
    queryFilter(callBack: (args: DBExec, complete: (args: DBExec) => void) => void): NanoSQLInstance;
    avFilter(filterFunc: IActionViewMod): this;
    config(args: any): NanoSQLInstance;
    extend(...args: Array<any>): any | NanoSQLInstance;
    loadJS(table: string, rows: Array<Object>, useTransaction?: boolean): Promise<Array<Object>>;
    rowFilter(callBack: (row: any) => any): this;
    loadCSV(table: string, csv: string, useTransaction?: boolean): Promise<Array<Object>>;
    private static _random16Bits();
    static timeid(ms?: boolean): string;
    static uuid(): string;
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
    transactionID: number;
    onSuccess: (rows: Array<Object>, type: string, affectedRows: DBRow[], affectedPKS: any[]) => void;
    onFail: (rows: Array<Object>) => void;
}
export interface NanoSQLBackend {
    _connect(connectArgs: DBConnect): void;
    _exec(execArgs: DBExec): void;
    _extend?(instance: NanoSQLInstance, ...args: Array<any>): any;
    _transaction(type: "start" | "end", id: number): Promise<any[]>;
}
export declare const nSQL: (setTablePointer?: string | undefined) => NanoSQLInstance;
