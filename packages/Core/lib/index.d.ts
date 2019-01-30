import { ReallySmallEvents } from "really-small-events";
import { InanoSQLConfig, InanoSQLFunction, InanoSQLQuery, InanoSQLDatabaseEvent, InanoSQLAdapter, InanoSQLTable, InanoSQLInstance, InanoSQLQueryBuilder, TableQueryResult, InanoSQLV1ConfigFn, InanoSQLFKActions, uuid } from "./interfaces";
export { InanoSQLInstance };
export declare class nanoSQL implements InanoSQLInstance {
    config: InanoSQLConfig;
    adapter: InanoSQLAdapter;
    version: number;
    filters: {
        [filterName: string]: ((inputArgs: any, complete: (args: any) => void, cancel: (info: any) => void) => void)[];
    };
    functions: {
        [fnName: string]: InanoSQLFunction;
    };
    planetRadius: number;
    _tables: {
        [tableName: string]: InanoSQLTable;
    };
    _tableIds: {
        [tableName: string]: string;
    };
    _fkRels: {
        [tableName: string]: {
            selfPath: string[];
            selfIsArray: boolean;
            onDelete: InanoSQLFKActions;
            childTable: string;
            childPath: string[];
            childIsArray: boolean;
            childIndex: string;
        }[];
    };
    state: {
        activeAV: string;
        hasAnyEvents: boolean;
        id: string;
        pid: string;
        peers: string[];
        peerEvents: string[];
        focused: boolean;
        peerMode: boolean;
        cacheId: uuid;
        connected: boolean;
        ready: boolean;
        exportQueryObj: boolean;
        selectedTable: string | any[] | ((where?: any[] | ((row: {
            [key: string]: any;
        }, i?: number) => boolean)) => Promise<TableQueryResult>);
    };
    _queryCache: {
        [id: string]: any[];
    };
    indexTypes: {
        [type: string]: (value: any) => any;
    };
    eventFNs: {
        Core: {
            [path: string]: ReallySmallEvents;
        };
        [eventName: string]: {
            [path: string]: ReallySmallEvents;
        };
    };
    private _Q;
    constructor();
    _rebuildFKs(): void;
    doFilter<T>(filterName: string, args: T, complete: (result: T) => void, cancelled: (abortInfo: any) => void): void;
    getCache(id: string, args?: {
        offset: number;
        limit: number;
    }): any[];
    clearCache(id: string): boolean;
    clearTTL(primaryKey: any): Promise<any>;
    expires(primaryKey: any): Promise<any>;
    _ttlTimer: any;
    _checkTTL(): void;
    selectTable(table?: string | any[] | ((where?: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)) => Promise<TableQueryResult>)): InanoSQLInstance;
    getPeers(): any;
    _detectStorageMethod(): string;
    _initPlugins(config: InanoSQLConfig): Promise<any>;
    _saveTableIds(): Promise<any>;
    presetQuery(fn: string): {
        promise: (args: any) => Promise<any[]>;
        stream: (args: any, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => void;
    };
    connect(config: InanoSQLConfig): Promise<any>;
    _initPeers(): void;
    every(args: {
        length: number;
        every?: number;
        offset?: number;
    }): number[];
    on(action: string, callBack: (event: InanoSQLDatabaseEvent) => void, selectTable?: string): void;
    off(action: string, callBack: (event: InanoSQLDatabaseEvent) => void, selectTable?: string): void;
    _refreshEventChecker(): InanoSQLInstance;
    getView(viewName: string, viewArgs: any): Promise<any>;
    doAction(actionName: string, actionArgs: any): Promise<any>;
    _doAV(AVType: "a" | "v", table: string, AVName: string, AVArgs: any): Promise<any>;
    query(action: string | ((nSQL: InanoSQLInstance) => InanoSQLQuery), args?: any): InanoSQLQueryBuilder;
    triggerQuery(query: InanoSQLQuery, onRow: (row: any) => void, complete: () => void, error: (err: string) => void): void;
    triggerEvent(eventData: InanoSQLDatabaseEvent, ignoreStarTable?: boolean): InanoSQLInstance;
    default(replaceObj?: any, table?: string): {
        [key: string]: any;
    } | Error;
    rawDump(tables: string[], indexes: boolean, onRow: (table: string, row: {
        [key: string]: any;
    }) => void): Promise<any>;
    rawImport(tables: {
        [table: string]: {
            [key: string]: any;
        }[];
    }, indexes: boolean, onProgress?: (percent: number) => void): Promise<any>;
    disconnect(): Promise<{}>;
    extend(scope: string, ...args: any[]): any | nanoSQL;
    loadJS(rows: {
        [key: string]: any;
    }[], onProgress?: (percent: number) => void, parallel?: boolean): Promise<any[]>;
    JSONtoCSV(json: any[], printHeaders?: boolean, useHeaders?: string[]): string;
    csvToArray(text: string): any[];
    CSVtoJSON(csv: string, rowMap?: (row: any) => any): any;
    loadCSV(csv: string, rowMap?: (row: any) => any, onProgress?: (percent: number) => void, parallel?: boolean): Promise<any[]>;
}
export declare const nSQLv1Config: (doConfig: (nSQLv1: (table?: string | undefined) => InanoSQLV1ConfigFn) => void) => InanoSQLConfig;
export declare const nSQL: (table?: string | any[] | ((where?: any[] | ((row: {
    [key: string]: any;
}, i?: number | undefined) => boolean) | undefined) => Promise<TableQueryResult>) | undefined) => InanoSQLInstance;
