import { Promise } from "lie-ts";
import { _NanoSQLQuery, IdbQuery } from "./query/std-query";
import { _NanoSQLTransactionQuery } from "./query/transaction";
import { StdObject } from "./utilities";
export interface ActionOrView {
    name: string;
    args?: string[];
    extend?: any;
    call: (args?: any, db?: NanoSQLInstance) => Promise<any>;
}
export interface NanoSQLFunction {
    type: "A" | "S";
    call: (rows: any[], complete: (result: any | any[]) => void, ...args: any[]) => void;
}
export interface DataModel {
    key: string;
    type: "string" | "int" | "float" | "array" | "map" | "bool" | "uuid" | "blob" | "timeId" | "timeIdms" | "safestr" | "number" | "object" | "obj" | string;
    default?: any;
    props?: any[];
}
export interface DatabaseEvent {
    table: string;
    query: IdbQuery;
    time: number;
    notes: string[];
    result: any[];
    types: ("change" | "delete" | "upsert" | "drop" | "select" | "error" | "transaction")[];
    actionOrView: string;
    transactionID?: string;
    affectedRowPKS?: any[];
    affectedRows: DBRow[];
}
export interface JoinArgs {
    type: "left" | "inner" | "right" | "cross" | "outer";
    table: string;
    where?: Array<string>;
}
export interface ORMArgs {
    key: string;
    select?: string;
    offset?: number;
    limit?: number;
    orderBy?: {
        [column: string]: "asc" | "desc";
    };
    where?: (row: DBRow, idx: number) => boolean | any[];
}
export interface DBRow {
    [key: string]: any;
}
export interface IActionViewMod {
    (tableName: string, actionOrView: "Action" | "View", name: string, args: any, complete: (args: any) => void, error?: (errorMessage: string) => void): void;
}
export declare class NanoSQLInstance {
    sTable: string | any[];
    private _config;
    _plugins: NanoSQLPlugin[];
    static functions: {
        [fnName: string]: NanoSQLFunction;
    };
    data: any;
    _hasEvents: StdObject<boolean>;
    _tableNames: string[];
    relations: {
        [tableName: string]: {
            toTable: string;
            column: string;
            toColumn: string;
            type: "array" | "single";
            toType: "array" | "single" | "";
        }[];
    };
    relationColumns: {
        [tableName: string]: string[];
    };
    private _callbacks;
    constructor();
    table(table?: string): NanoSQLInstance;
    connect(): Promise<Object | string>;
    use(plugin: NanoSQLPlugin): this;
    on(actions: string, callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance;
    off(actions: string, callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance;
    private _refreshEventChecker();
    model(dataModel: Array<DataModel>): NanoSQLInstance;
    views(viewArray: ActionOrView[]): NanoSQLInstance;
    getView(viewName: string, viewArgs?: any): Promise<Array<any> | NanoSQLInstance>;
    actions(actionArray: Array<ActionOrView>): NanoSQLInstance;
    doAction(actionName: string, actionArgs: any): Promise<Array<DBRow> | NanoSQLInstance>;
    private _doAV(AVType, AVList, AVName, AVargs);
    query(action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe", args?: any, bypassORMPurge?: boolean): _NanoSQLQuery;
    triggerEvent(eventData: DatabaseEvent): NanoSQLInstance;
    default(replaceObj?: any): {
        [key: string]: any;
    };
    doTransaction(initTransaction: (db: (table?: string) => {
        query: (action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe", args?: any) => _NanoSQLTransactionQuery;
    }, complete: () => void) => void): Promise<any>;
    config(args: StdObject<string>): NanoSQLInstance;
    extend(...args: any[]): any | NanoSQLInstance;
    loadJS(table: string, rows: Array<Object>, useTransaction?: boolean): Promise<Array<Object>>;
    loadCSV(table: string, csv: string, useTransaction?: boolean): Promise<Array<Object>>;
}
export interface DBConnect {
    models: StdObject<DataModel[]>;
    actions: StdObject<ActionOrView[]>;
    views: StdObject<ActionOrView[]>;
    config: StdObject<string>;
    parent: NanoSQLInstance;
}
export interface NanoSQLPlugin {
    willConnect?: (connectArgs: DBConnect, next: (connectArgs: DBConnect) => void) => void;
    didConnect?: (connectArgs: DBConnect, next: () => void) => void;
    doExec?: (execArgs: IdbQuery, next: (execArgs: IdbQuery) => void) => void;
    didExec?: (event: DatabaseEvent, next: (event: DatabaseEvent) => void) => void;
    transactionBegin?: (id: string, next: () => void) => void;
    transactionEnd?: (id: string, next: () => void) => void;
    extend?: (next: (args: any[], result: any[]) => void, args: any[], result: any[]) => void;
}
export declare const nSQL: (setTablePointer?: string | undefined) => NanoSQLInstance;
