import { ReallySmallEvents } from "really-small-events";

export const VERSION = 2.0;

export declare class INanoSQLInstance {
    config: INanoSQLConfig;
    adapter: INanoSQLAdapter;
    version: number;
    filters: {
        [filterName: string]: ((inputArgs: any, complete: (args: any) => void, cancel: (info: any) => void) => void)[];
    };
    functions: {
        [fnName: string]: INanoSQLFunction;
    };
    planetRadius: number;
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
        MRTimer: any;
        runMR: {[table: string]: {[mrName: string]: (...args: any[]) => void}};
        selectedTable: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
    };
    _queryCache: {
        [id: string]: any[];
    };
    indexTypes: {
        [type: string]: (value: any) => any;
    };
    eventFNs: {
        Core: {[path: string]: ReallySmallEvents};
        [eventName: string]: {[path: string]: ReallySmallEvents};
    };
    constructor();
    doFilter<T, R>(filterName: string, args: T, complete: (result: R) => void, cancelled: (error: any) => void): void;
    getCache(id: string, args: {
        offset: number;
        limit: number;
    }): any[];
    clearCache(id: string): boolean;
    triggerMapReduce(cb?: (event: INanoSQLDatabaseEvent) => void, table?: string, name?: string): void;
    every(args: {length: number, every?: number, offset?: number}): number[];
    clearTTL(primaryKey: any): Promise<any>;
    expires(primaryKey: any): Promise<any>;
    _ttlTimer;
    _checkTTL(): void;
    selectTable(table?: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>)): INanoSQLInstance;
    getPeers(): any;
    _detectStorageMethod();
    _initPlugins(config);
    connect(config: INanoSQLConfig): Promise<any>;
    _initPeers();
    on(action: string, callBack: (event: INanoSQLDatabaseEvent) => void): INanoSQLInstance;
    off(action: string, callBack: (event: INanoSQLDatabaseEvent, database: INanoSQLInstance) => void): INanoSQLInstance;
    _refreshEventChecker(): INanoSQLInstance;
    getView(viewName: string, viewArgs?: any): Promise<any>;
    doAction(actionName: string, actionArgs: any): Promise<any>;
    _doAV(AVType, table, AVName, AVargs);
    query(action: string | ((nSQL: INanoSQLInstance) => INanoSQLQuery), args?: any): INanoSQLQueryBuilder;
    triggerQuery(query: INanoSQLQuery, onRow: (row: any) => void, complete: () => void, error: (err: string) => void): void;
    triggerEvent(eventData: INanoSQLDatabaseEvent, ignoreStarTable?: boolean): INanoSQLInstance;
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
    disconnect(): Promise<any>;
    extend(scope: string, ...args: any[]): any | INanoSQLInstance;
    loadJS(rows: {
        [key: string]: any;
    }[], onProgress?: (percent: number) => void): Promise<any[]>;
    JSONtoCSV(json: any[], printHeaders?: boolean, useHeaders?: string[]): string;
    csvToArray(text: string): any[];
    CSVtoJSON(csv: string, rowMap?: (row: any) => any): any;
    loadCSV(csv: string, rowMap?: (row: any) => any, onProgress?: (percent: number) => void): Promise<any[]>;
}

export declare class INanoSQLQueryBuilder {
    _db: INanoSQLInstance;
    _error: string;
    _AV: string;
    _query: INanoSQLQuery;
    static execMap: any;
    constructor(db: INanoSQLInstance, table: string | any[] | (() => Promise<any[]>), queryAction: string | ((nSQL: INanoSQLInstance) => INanoSQLQuery), queryArgs?: any, actionOrView?: string);
    where(args: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)): INanoSQLQueryBuilder;
    orderBy(args: string[]): INanoSQLQueryBuilder;
    groupBy(columns: string[]): INanoSQLQueryBuilder;
    having(args: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)): INanoSQLQueryBuilder;
    join(args: INanoSQLJoinArgs | INanoSQLJoinArgs[]): INanoSQLQueryBuilder;
    limit(args: number): INanoSQLQueryBuilder;
    comment(comment: string): INanoSQLQueryBuilder;
    extend(scope: string, ...args: any[]): INanoSQLQueryBuilder;
    union(queries: (() => Promise<any[]>)[], unionAll?: boolean): INanoSQLQueryBuilder;
    offset(args: number): INanoSQLQueryBuilder;
    tag(tag: string): INanoSQLQueryBuilder;
    emit(): INanoSQLQuery;
    ttl(seconds?: number, cols?: string[]): INanoSQLQueryBuilder;
    toCSV(headers?: boolean): any;
    stream(onRow: (row: any) => void, complete: () => void, err: (error: any) => void): void;
    cache(): Promise<{
        id: string;
        total: number;
    }>;
    graph(graphArgs: INanoSQLGraphArgs | INanoSQLGraphArgs[]): INanoSQLQueryBuilder;
    from(tableObj: {
        table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string
    }): INanoSQLQueryBuilder;
    into(table: string): INanoSQLQueryBuilder;
    on(table: string): INanoSQLQueryBuilder;
    exec(): Promise<{
        [key: string]: any;
    }[]>;
}


export declare class INanoSQLQueryExec {
    nSQL: INanoSQLInstance;
    query: INanoSQLQuery;
    progress: (row: any, i: number) => void;
    complete: () => void;
    error: (err: any) => void;
    _queryBuffer: any[];
    _stream: boolean;
    _selectArgs: ISelectArgs[];
    _whereArgs: IWhereArgs;
    _havingArgs: IWhereArgs;
    _pkOrderBy: boolean;
    _idxOrderBy: boolean;
    _sortGroups: any[][];
    _sortGroupKeys: {
        [groupKey: string]: number;
    };
    _groupByColumns: string[];
    _orderBy: INanoSQLSortBy;
    _groupBy: INanoSQLSortBy;
    constructor(nSQL: INanoSQLInstance, query: INanoSQLQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void);
    _maybeJoin(joinData, leftRow, onRow, complete);
    _select(complete, onError);
    _groupByRows();
    _upsert(onRow, complete, error);
    _updateRow(newData, oldRow, complete, error);
    _newRow(newRow, complete, error);
    _delete(onRow, complete, error);
    _getIndexValues(indexes, row);
    _showTables();
    _describe();
    _streamAS(row, isJoin);
    _orderByRows(a, b);
    _sortObj(objA, objB, columns);
    _createTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void;
    _alterTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void;
    _dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    _onError(err);
    _resolveFastWhere(onlyPKs, table, fastWhere, isReversed, orderByPK, onRow, complete);
    _fastQuery(onRow, complete);
    _getRecords(onRow, complete);
    _rebuildIndexes(table, complete, error);
    _where(singleRow, where, ignoreFirstPath);
    static likeCache: {
        [likeQuery: string]: RegExp;
    };
    _processLIKE(columnValue, givenValue);
    _getColValue(where, wholeRow, isJoin);
    _compare(where, wholeRow, isJoin);
    static _sortMemoized: {
        [key: string]: INanoSQLSortBy;
    };
    _parseSort(sort, checkforIndexes);
    static _selectArgsMemoized: {
        [key: string]: {
            hasAggrFn: boolean;
            args: ISelectArgs[];
        };
    };
    _hasAggrFn;
    _parseSelect();
    static _whereMemoized: {
        [key: string]: IWhereArgs;
    };
    _parseWhere(qWhere, ignoreIndexes?);
}

export interface INanoSQLConfig {
    id?: string;
    peer?: boolean;
    cache?: boolean;
    queue?: boolean;
    mode?: string | INanoSQLAdapter;
    plugins?: INanoSQLPlugin[];
    planetRadius?: number;
    version?: number;
    size?: number; // size of WebSQL database
    path?: string | ((dbID: string, tableName: string) => {lvld: any, args?: any}); // RocksDB path
    warnOnSlowQueries?: boolean;
    disableTTL?: boolean;
    tables?: INanoSQLTableConfig[];
    onVersionUpdate?: (oldVersion: number) => Promise<number>;
}

export interface INanoSQLDataModel {
    [colAndType: string]: {
        ai?: boolean;
        pk?: boolean;
        default?: any;
        model?: INanoSQLDataModel;
        notNull?: boolean;
        offset?: number;
        max?: number;
        min?: number;
        [key: string]: any;
    };
}

export interface INanoSQLMapReduce {
    name: string;
    call: (evn: INanoSQLDatabaseEvent) => Promise<any>;
    throttle?: number;
    onEvents?: string[];
    onTimes?: {
        seconds?: number | number[];
        minutes?: number | number[];
        hours?: number | number[];
        weekDay?: number | number[];
        weekOfYear?: number | number[];
        date?: number | number[];
        month?: number | number[];
    };
}

export interface INanoSQLSortBy {
    sort: { path: string[], dir: string }[];
    index: string;
}

export interface INanoSQLPlugin {
    name: string;
    version: number;
    dependencies?: {
        [packageName: string]: number[];
    };
    filters?: {
        name: string;
        priority: number;
        call: ((inputArgs: any, complete: (args: any) => void, cancel: (info: any) => void) => void)[];
    }[];
}

export interface INanoSQLAdapterConstructor {
    new(...args: any[]): INanoSQLAdapter;
}

export interface INanoSQLAdapter {

    plugin: INanoSQLPlugin;
    nSQL: INanoSQLInstance;

    connect(id: string, complete: () => void, error: (err: any) => void);

    disconnect(complete: () => void, error: (err: any) => void);

    createAndInitTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void);

    dropTable(table: string, complete: () => void, error: (err: any) => void);

    disconnectTable(table: string, complete: () => void, error: (err: any) => void);

    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void);

    read(table: string, pk: any, complete: (row: {[key: string]: any} | undefined) => void, error: (err: any) => void);

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void);

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {[key: string]: any}, i: number) => void, complete: () => void, error: (err: any) => void);

    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void);

    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void);
}


export interface INanoSQLActionOrView {
    name: string;
    args?: string[];
    extend?: any;
    call: (args?: any, db?: any) => Promise<any[]>;
}


export interface INanoSQLFunction {
    type: "A" | "S"; // aggregate or simple function
    aggregateStart?: {result: any, row?: any, [key: string]: any};
    call: (query: INanoSQLQuery, row: any, prev: {result: any, row?: any, [key: string]: any}, ...args: any[]) => {result: any, row?: any, [key: string]: any}; // function call
    whereIndex?: (query: INanoSQLQuery, fnArgs: string[], where: string[]) => IWhereCondition | false;
    queryIndex?: (query: INanoSQLQuery, where: IWhereCondition, onlyPKs: boolean, onRow: (row, i) => void, complete: () => void, error: (err: any) => void) => void;
}

export interface INanoSQLTableConfig {
    name: string;
    model: INanoSQLDataModel;
    indexes?: {
        [colAndType: string]: {[prop: string]: any};
    };
    mapReduce?: INanoSQLMapReduce[];
    filter?: (row: any) => any;
    actions?: INanoSQLActionOrView[];
    views?: INanoSQLActionOrView[];
    props?: {
        [key: string]: any;
    };
    _internal?: boolean;
}

export interface INanoSQLTable {
    model: INanoSQLDataModel;
    columns: INanoSQLTableColumn[];
    indexes: {
        [id: string]: INanoSQLIndex;
    };
    mapReduce?: INanoSQLMapReduce[];
    filter?: (row: any) => any;
    actions: INanoSQLActionOrView[];
    views: INanoSQLActionOrView[];
    pkType: string;
    pkCol: string;
    isPkNum: boolean;
    offsets: {path: string[], offset: number}[];
    ai: boolean;
    props?: any;
}

export interface INanoSQLTableColumn {
    key: string;
    type: string;
    model?: INanoSQLTableColumn[];
    notNull?: boolean;
    default?: any;
    max?: number;
    min?: number;
}

export interface INanoSQLDatabaseEvent {
    target: string;
    path: string;
    events: string[];
    time: number;
    result?: any;
    [key: string]: any;
}

export interface INanoSQLJoinArgs {
    type: "left" | "inner" | "right" | "cross" | "outer";
    with: {
        table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string;
    };
    on?: any[];
}


export interface INanoSQLGraphArgs {
    key: string;
    with: {
        table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string;
    };
    select?: string[];
    single?: boolean;
    offset?: number;
    limit?: number;
    orderBy?: string[];
    groupBy?: string[];
    graph?: INanoSQLGraphArgs | INanoSQLGraphArgs[];
    on?: (row: {[key: string]: any}, idx: number) => boolean | any[];
}

export interface INanoSQLQuery {
    table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
    tableAS?: string;
    action: string;
    actionArgs?: any;
    state: "pending" | "processing" | "complete" | "error";
    result: any[];
    time: number;
    extend: {scope: string, args: any[]}[];
    queryID: string;
    tags: string[];
    comments: string[];
    where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean);
    range?: number[];
    graph?: INanoSQLGraphArgs | INanoSQLGraphArgs[];
    orderBy?: string[];
    groupBy?: string[];
    having?: any[] | ((row: {[key: string]: any}, i?: number) => boolean);
    join?: INanoSQLJoinArgs | INanoSQLJoinArgs[];
    limit?: number;
    offset?: number;
    ttl?: number;
    ttlCols?: string[];
    skipQueue?: boolean;
    union?: {type: "all" | "distinct", queries: (() => Promise<any[]>)[]};
    cacheID?: string;
    parent: INanoSQLInstance;
    [key: string]: any;
}

export interface INanoSQLIndex {
    id: string;
    type: string;
    isArray: boolean;
    props: {[key: string]: any};
    path: string[];
}

export interface ISelectArgs {
    isFn: boolean;
    value: string;
    as?: string;
    args?: string[];
}

export enum IWhereType {
    fast, // primary key or secondary index on all WHERE statements using nothing but AND with single dimensional WHERE
    medium, // fast query followed by AND with slow query (lets us grab optimized rows, then full table scan the optimized rows)
    slow, // full table scan
    fn, // full table scan with function
    none // no where, return all rows
}

export interface IWhereCondition {
    index?: string;
    indexArray?: boolean;
    fnName?: string;
    fnArgs?: string[];
    col?: string;
    comp: string;
    value: any;
}

export interface IWhereArgs {
    type: IWhereType;
    whereFn?: (row: { [name: string]: any }, index: number) => boolean;
    fastWhere?: (IWhereCondition|string)[];
    slowWhere?: (IWhereCondition|string|(IWhereCondition|string)[])[];
}

// tslint:disable-next-line
export interface abstractFilter {
    abort?: {
        source: string;
        reason: string;
        [key: string]: any;
    };
    result?: any;
}

export interface SQLiteAbstractFns {
    createAI: (complete: () => void, error: (err: any) => void) => void;
    createTable: (table: string, tableData: INanoSQLTable, ai: {
        [table: string]: number;
    }, complete: () => void, error: (err: any) => void) => void;
    dropTable: (table: string, complete: () => void, error: (err: any) => void) => void;
    write: (pkType: string, pkCol: string, table: string, pk: any, row: any, doAI: boolean, ai: {
        [table: string]: number;
    }, complete: (pk: any) => void, error: (err: any) => void) => void;
    read: (table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) => void;
    remove: (table: string, pk: any, complete: () => void, error: (err: any) => void) => void;
    getIndex: (table: string, complete: (index: any[]) => void, error: (err: any) => void) => void;
    getNumberOfRecords: (table: string, complete: (length: number) => void, error: (err: any) => void) => void;
    readMulti: (table: string, type: "all" | "range" | "offset", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void) => void;
}

// tslint:disable-next-line
export interface extendFilter extends abstractFilter {
    scope: string;
    args: any[];
}

// tslint:disable-next-line
export interface configTableFilter extends abstractFilter {
    result: INanoSQLTableConfig;
    query: INanoSQLQuery;
}

// tslint:disable-next-line
export interface queryFilter extends abstractFilter {
    result: INanoSQLQuery;
}

// tslint:disable-next-line
export interface eventFilter extends abstractFilter {
    result: INanoSQLDatabaseEvent;
}

// tslint:disable-next-line
export interface config extends abstractFilter {
    result: INanoSQLConfig;
}

export interface IAVFilterResult {
    AVType: "Action" | "View";
    table: string;
    AVName: string;
    AVargs: any;
}

export interface TableQueryResult {
    rows: string | any[];
    filtered: boolean;
    cache?: boolean;
}

// tslint:disable-next-line
export interface actionFilter extends abstractFilter {
    result: IAVFilterResult;
}

// tslint:disable-next-line
export interface viewFilter extends abstractFilter {
    result: IAVFilterResult;
}

// tslint:disable-next-line
export interface configFilter extends abstractFilter {
    result: INanoSQLConfig;
}

// tslint:disable-next-line
export interface willConnectFilter extends abstractFilter { }
// tslint:disable-next-line
export interface readyFilter extends abstractFilter { }
// tslint:disable-next-line
export interface disconnectFilter extends abstractFilter { }
// tslint:disable-next-line
export interface customQueryFilter extends abstractFilter {
    result: undefined;
    query: INanoSQLQueryExec;
    onRow: (row: any, i: number) => void;
    complete: () => void;
    error: (err: any) => void;
}
// tslint:disable-next-line
export interface customEventFilter extends abstractFilter { 
    result: {nameSpace: string, path: string};
    selectedTable: string;
    action: string;
    on: boolean;
}

// tslint:disable-next-line
export interface adapterDidReadFilter extends abstractFilter { 
    result: any;
    table: string;
    pk: any;
    i: number;
    query: INanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterWillReadFilter extends abstractFilter { 
    result: any;
    table: string;
    pk: any;
    i: number;
    query: INanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterWillReadMultiFilter extends abstractFilter {
    result: {
        table: string;
        type: string;
        offsetOrLow?: number;
        limitOrHigh?: number;
        reverse?: boolean;
    };
    onRow: (row: {[key: string]: any}, i: number, nextRow: () => void) => void;
    complete: () => void;
    error: (err: any) => void;
    query: INanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterWillWriteFilter extends abstractFilter { 
    result: {table: string, pk: any, row: any};
    query: INanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterDidWriteFilter extends abstractFilter { 

}

// tslint:disable-next-line
export interface conformRowFilter extends abstractFilter { 
    result: any;
    oldRow: any;
}

// tslint:disable-next-line
export interface deleteRowFilter extends abstractFilter { 
    query: INanoSQLQuery;
}

// tslint:disable-next-line
export interface addRowFilter extends abstractFilter { 
    query: INanoSQLQuery;
}

// tslint:disable-next-line
export interface updateRowFilter extends abstractFilter { 
    query: INanoSQLQuery;
    row: any;
}

// tslint:disable-next-line
export interface dropTableFilter extends abstractFilter { 
    query: INanoSQLQuery;
    result: string;
}

// tslint:disable-next-line
export interface alterTableFilter extends abstractFilter { 
    query: INanoSQLQuery;
    result: INanoSQLTableConfig;
}

// tslint:disable-next-line
export interface addTableFilter extends abstractFilter {
    query: INanoSQLQuery;
    result: {name: string, conf: INanoSQLTable};
}

// tslint:disable-next-line
export interface mapReduceFilter extends abstractFilter {
    result: boolean;
    table: string;
    mr: INanoSQLMapReduce;
}