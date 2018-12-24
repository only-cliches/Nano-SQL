import { ReallySmallEvents } from "really-small-events";
export declare const VERSION = 2;
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
        runMR: {
            [table: string]: {
                [mrName: string]: (...args: any[]) => void;
            };
        };
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
    constructor();
    doFilter<T, R>(filterName: string, args: T, complete: (result: R) => void, cancelled: (error: any) => void): void;
    getCache(id: string, args: {
        offset: number;
        limit: number;
    }): any[];
    clearCache(id: string): boolean;
    triggerMapReduce(cb?: (event: INanoSQLDatabaseEvent) => void, table?: string, name?: string): void;
    every(args: {
        length: number;
        every?: number;
        offset?: number;
    }): number[];
    clearTTL(primaryKey: any): Promise<any>;
    expires(primaryKey: any): Promise<any>;
    _ttlTimer: any;
    _checkTTL(): void;
    selectTable(table?: string | any[] | ((where?: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)) => Promise<TableQueryResult>)): INanoSQLInstance;
    getPeers(): any;
    _detectStorageMethod(): any;
    _initPlugins(config: any): any;
    connect(config: INanoSQLConfig): Promise<any>;
    _initPeers(): any;
    on(action: string, callBack: (event: INanoSQLDatabaseEvent) => void): INanoSQLInstance;
    off(action: string, callBack: (event: INanoSQLDatabaseEvent, database: INanoSQLInstance) => void): INanoSQLInstance;
    _refreshEventChecker(): INanoSQLInstance;
    getView(viewName: string, viewArgs?: any): Promise<any>;
    doAction(actionName: string, actionArgs: any): Promise<any>;
    _doAV(AVType: any, table: any, AVName: any, AVargs: any): any;
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
        table: string | any[] | ((where?: any[] | ((row: {
            [key: string]: any;
        }, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string;
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
    _maybeJoin(joinData: any, leftRow: any, onRow: any, complete: any): any;
    _select(complete: any, onError: any): any;
    _groupByRows(): any;
    _upsert(onRow: any, complete: any, error: any): any;
    _updateRow(newData: any, oldRow: any, complete: any, error: any): any;
    _newRow(newRow: any, complete: any, error: any): any;
    _delete(onRow: any, complete: any, error: any): any;
    _getIndexValues(indexes: any, row: any): any;
    _showTables(): any;
    _describe(): any;
    _streamAS(row: any, isJoin: any): any;
    _orderByRows(a: any, b: any): any;
    _sortObj(objA: any, objB: any, columns: any): any;
    _createTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void;
    _alterTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void;
    _dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    _onError(err: any): any;
    _resolveFastWhere(onlyPKs: any, table: any, fastWhere: any, isReversed: any, orderByPK: any, onRow: any, complete: any): any;
    _fastQuery(onRow: any, complete: any): any;
    _getRecords(onRow: any, complete: any): any;
    _rebuildIndexes(table: any, complete: any, error: any): any;
    _where(singleRow: any, where: any, ignoreFirstPath: any): any;
    static likeCache: {
        [likeQuery: string]: RegExp;
    };
    _processLIKE(columnValue: any, givenValue: any): any;
    _getColValue(where: any, wholeRow: any, isJoin: any): any;
    _compare(where: any, wholeRow: any, isJoin: any): any;
    static _sortMemoized: {
        [key: string]: INanoSQLSortBy;
    };
    _parseSort(sort: any, checkforIndexes: any): any;
    static _selectArgsMemoized: {
        [key: string]: {
            hasAggrFn: boolean;
            args: ISelectArgs[];
        };
    };
    _hasAggrFn: any;
    _parseSelect(): any;
    static _whereMemoized: {
        [key: string]: IWhereArgs;
    };
    _parseWhere(qWhere: any, ignoreIndexes?: any): any;
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
    size?: number;
    path?: string | ((dbID: string, tableName: string) => {
        lvld: any;
        args?: any;
    });
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
    sort: {
        fn?: string;
        path: string[];
        dir: string;
    }[];
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
    new (...args: any[]): INanoSQLAdapter;
}
export interface INanoSQLAdapter {
    plugin: INanoSQLPlugin;
    nSQL: INanoSQLInstance;
    connect(id: string, complete: () => void, error: (err: any) => void): any;
    disconnect(complete: () => void, error: (err: any) => void): any;
    createAndInitTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void): any;
    dropTable(table: string, complete: () => void, error: (err: any) => void): any;
    disconnectTable(table: string, complete: () => void, error: (err: any) => void): any;
    write(table: string, pk: any, row: {
        [key: string]: any;
    }, complete: (pk: any) => void, error: (err: any) => void): any;
    read(table: string, pk: any, complete: (row: {
        [key: string]: any;
    } | undefined) => void, error: (err: any) => void): any;
    delete(table: string, pk: any, complete: () => void, error: (err: any) => void): any;
    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void): any;
    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void): any;
    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void): any;
}
export interface INanoSQLActionOrView {
    name: string;
    args?: string[];
    extend?: any;
    call: (args?: any, db?: any) => Promise<any[]>;
}
export interface INanoSQLFunction {
    type: "A" | "S";
    aggregateStart?: {
        result: any;
        row?: any;
        [key: string]: any;
    };
    call: (query: INanoSQLQuery, row: any, prev: {
        result: any;
        row?: any;
        [key: string]: any;
    }, ...args: any[]) => {
        result: any;
        row?: any;
        [key: string]: any;
    };
    checkIndex?: (query: INanoSQLQuery, fnArgs: string[], where: string[]) => IWhereCondition | false;
    queryIndex?: (query: INanoSQLQuery, where: IWhereCondition, onlyPKs: boolean, onRow: (row: any, i: any) => void, complete: () => void, error: (err: any) => void) => void;
}
export interface INanoSQLTableConfig {
    name: string;
    model: INanoSQLDataModel;
    indexes?: {
        [colAndType: string]: {
            [prop: string]: any;
        };
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
    pkOffset: number;
    isPkNum: boolean;
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
        table: string | any[] | ((where?: any[] | ((row: {
            [key: string]: any;
        }, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string;
    };
    on?: any[];
}
export interface INanoSQLGraphArgs {
    key: string;
    with: {
        table: string | any[] | ((where?: any[] | ((row: {
            [key: string]: any;
        }, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string;
    };
    select?: string[];
    single?: boolean;
    offset?: number;
    limit?: number;
    orderBy?: string[];
    groupBy?: string[];
    graph?: INanoSQLGraphArgs | INanoSQLGraphArgs[];
    on?: (row: {
        [key: string]: any;
    }, idx: number) => boolean | any[];
}
export interface INanoSQLQuery {
    table: string | any[] | ((where?: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)) => Promise<TableQueryResult>);
    tableAS?: string;
    action: string;
    actionArgs?: any;
    state: "pending" | "processing" | "complete" | "error";
    result: any[];
    time: number;
    extend: {
        scope: string;
        args: any[];
    }[];
    queryID: string;
    tags: string[];
    comments: string[];
    where?: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean);
    range?: number[];
    graph?: INanoSQLGraphArgs | INanoSQLGraphArgs[];
    orderBy?: string[];
    groupBy?: string[];
    having?: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean);
    join?: INanoSQLJoinArgs | INanoSQLJoinArgs[];
    limit?: number;
    offset?: number;
    ttl?: number;
    ttlCols?: string[];
    skipQueue?: boolean;
    union?: {
        type: "all" | "distinct";
        queries: (() => Promise<any[]>)[];
    };
    cacheID?: string;
    parent: INanoSQLInstance;
    returnEvent?: boolean;
    [key: string]: any;
}
export interface INanoSQLIndex {
    id: string;
    type: string;
    isArray: boolean;
    props: {
        [key: string]: any;
    };
    path: string[];
}
export interface ISelectArgs {
    isFn: boolean;
    value: string;
    as?: string;
    args?: string[];
}
export declare enum IWhereType {
    fast = 0,
    medium = 1,
    slow = 2,
    fn = 3,
    none = 4
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
    whereFn?: (row: {
        [name: string]: any;
    }, index: number) => boolean;
    fastWhere?: (IWhereCondition | string)[];
    slowWhere?: (IWhereCondition | string | (IWhereCondition | string)[])[];
}
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
    read: (table: string, pk: any, complete: (row: {
        [key: string]: any;
    } | undefined) => void, error: (err: any) => void) => void;
    remove: (table: string, pk: any, complete: () => void, error: (err: any) => void) => void;
    getIndex: (table: string, complete: (index: any[]) => void, error: (err: any) => void) => void;
    getNumberOfRecords: (table: string, complete: (length: number) => void, error: (err: any) => void) => void;
    readMulti: (table: string, type: "all" | "range" | "offset", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void) => void;
}
export interface extendFilter extends abstractFilter {
    scope: string;
    args: any[];
}
export interface configTableFilter extends abstractFilter {
    result: INanoSQLTableConfig;
    query: INanoSQLQuery;
}
export interface queryFilter extends abstractFilter {
    result: INanoSQLQuery;
}
export interface eventFilter extends abstractFilter {
    result: INanoSQLDatabaseEvent;
}
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
export interface actionFilter extends abstractFilter {
    result: IAVFilterResult;
}
export interface viewFilter extends abstractFilter {
    result: IAVFilterResult;
}
export interface configFilter extends abstractFilter {
    result: INanoSQLConfig;
}
export interface willConnectFilter extends abstractFilter {
}
export interface readyFilter extends abstractFilter {
}
export interface disconnectFilter extends abstractFilter {
}
export interface customQueryFilter extends abstractFilter {
    result: undefined;
    query: INanoSQLQueryExec;
    onRow: (row: any, i: number) => void;
    complete: () => void;
    error: (err: any) => void;
}
export interface customEventFilter extends abstractFilter {
    result: {
        nameSpace: string;
        path: string;
    };
    selectedTable: string;
    action: string;
    on: boolean;
}
export interface adapterDidReadFilter extends abstractFilter {
    result: any;
    table: string;
    pk: any;
    i: number;
    query: INanoSQLQuery;
}
export interface adapterWillReadFilter extends abstractFilter {
    result: any;
    table: string;
    pk: any;
    i: number;
    query: INanoSQLQuery;
}
export interface adapterWillReadMultiFilter extends abstractFilter {
    result: {
        table: string;
        type: string;
        offsetOrLow?: number;
        limitOrHigh?: number;
        reverse?: boolean;
    };
    onRow: (row: {
        [key: string]: any;
    }, i: number, nextRow: () => void) => void;
    complete: () => void;
    error: (err: any) => void;
    query: INanoSQLQuery;
}
export interface adapterWillWriteFilter extends abstractFilter {
    result: {
        table: string;
        pk: any;
        row: any;
    };
    query: INanoSQLQuery;
}
export interface adapterDidWriteFilter extends abstractFilter {
}
export interface conformRowFilter extends abstractFilter {
    result: any;
    oldRow: any;
}
export interface deleteRowFilter extends abstractFilter {
    query: INanoSQLQuery;
}
export interface addRowFilter extends abstractFilter {
    query: INanoSQLQuery;
}
export interface updateRowFilter extends abstractFilter {
    query: INanoSQLQuery;
    row: any;
}
export interface dropTableFilter extends abstractFilter {
    query: INanoSQLQuery;
    result: string;
}
export interface alterTableFilter extends abstractFilter {
    query: INanoSQLQuery;
    result: INanoSQLTableConfig;
}
export interface addTableFilter extends abstractFilter {
    query: INanoSQLQuery;
    result: {
        name: string;
        conf: INanoSQLTable;
    };
}
export interface mapReduceFilter extends abstractFilter {
    result: boolean;
    table: string;
    mr: INanoSQLMapReduce;
}
