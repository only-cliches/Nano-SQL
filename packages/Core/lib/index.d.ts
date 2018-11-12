import { ReallySmallEvents } from "really-small-events";
import { Observer } from "./observable";
import { INanoSQLConfig, INanoSQLFunction, INanoSQLQuery, INanoSQLDatabaseEvent, INanoSQLAdapter, INanoSQLTable, INanoSQLInstance, INanoSQLQueryBuilder } from "./interfaces";
export declare class NanoSQL implements INanoSQLInstance {
    config: INanoSQLConfig;
    adapter: INanoSQLAdapter;
    version: number;
    filters: {
        [filterName: string]: ((inputArgs: any) => Promise<any>)[];
    };
    functions: {
        [fnName: string]: INanoSQLFunction;
    };
    earthRadius: number;
    tables: {
        [tableName: string]: INanoSQLTable;
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
        connected: boolean;
        ready: boolean;
        selectedTable: string | any[] | (() => Promise<any[]>);
    };
    _queryCache: {
        [id: string]: any[];
    };
    indexTypes: {
        [type: string]: (value: any) => any;
    };
    _eventCBs: {
        Core: {
            [path: string]: ReallySmallEvents;
        };
        [eventName: string]: {
            [path: string]: ReallySmallEvents;
        };
    };
    private _Q;
    constructor();
    doFilter<T, R>(filterName: string, args: T): Promise<R>;
    getCache(id: string, args: {
        offset: number;
        limit: number;
    }): any[];
    clearCache(id: string): boolean;
    clearTTL(primaryKey: any): Promise<any>;
    expires(primaryKey: any): Promise<any>;
    _ttlTimer: any;
    _checkTTL(): void;
    selectTable(table?: string | any[] | (() => Promise<any[]>)): INanoSQLInstance;
    getPeers(): any;
    _detectStorageMethod(): string;
    _initPlugins(config: INanoSQLConfig): Promise<any>;
    connect(config: INanoSQLConfig): Promise<any>;
    _initPeers(): void;
    on(action: string, callBack: (event: INanoSQLDatabaseEvent) => void): INanoSQLInstance;
    off(action: string, callBack: (event: INanoSQLDatabaseEvent, database: INanoSQLInstance) => void): INanoSQLInstance;
    _refreshEventChecker(): INanoSQLInstance;
    getView(viewName: string, viewArgs: any): Promise<any>;
    doAction(actionName: string, actionArgs: any): Promise<any>;
    _doAV(AVType: "Action" | "View", table: string, AVName: string, AVargs: any): Promise<any>;
    query(action: string | ((nSQL: INanoSQLInstance) => INanoSQLQuery), args?: any): INanoSQLQueryBuilder;
    triggerQuery(query: INanoSQLQuery, onRow: (row: any) => void, complete: () => void, error: (err: string) => void): void;
    triggerEvent(eventData: INanoSQLDatabaseEvent): INanoSQLInstance;
    default(replaceObj?: any, table?: string): {
        [key: string]: any;
    } | Error;
    rawDump(tables: string[], onRow: (table: string, row: {
        [key: string]: any;
    }) => void): Promise<any>;
    rawImport(tables: {
        [table: string]: {
            [key: string]: any;
        }[];
    }, onProgress?: (percent: number) => void): Promise<any>;
    disconnect(): Promise<{}>;
    observable<T>(getQuery: (ev?: INanoSQLDatabaseEvent) => INanoSQLQuery, tablesToListen?: string[]): Observer<T>;
    extend(scope: string, ...args: any[]): any | NanoSQL;
    loadJS(rows: {
        [key: string]: any;
    }[], onProgress?: (percent: number) => void): Promise<any[]>;
    JSONtoCSV(json: any[], printHeaders?: boolean, useHeaders?: string[]): string;
    csvToArray(text: string): any[];
    CSVtoJSON(csv: string, rowMap?: (row: any) => any): any;
    loadCSV(csv: string, rowMap?: (row: any) => any, onProgress?: (percent: number) => void): Promise<any[]>;
}
export declare const nSQL: (setTablePointer?: string | any[] | (() => Promise<any[]>) | undefined) => INanoSQLInstance;
