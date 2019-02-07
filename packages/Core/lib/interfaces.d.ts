import { ReallySmallEvents } from "really-small-events";
export declare const VERSION = 2.16;
export declare type uuid = String;
export declare type timeId = String;
export declare type timeIdms = String;
export declare class InanoSQLInstance {
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
    state: {
        activeAV: string;
        hasAnyEvents: boolean;
        id: string;
        pid: string;
        cacheId: uuid;
        peers: string[];
        peerEvents: string[];
        focused: boolean;
        peerMode: boolean;
        connected: boolean;
        ready: boolean;
        exportQueryObj: boolean;
        selectedTable: string | any[] | ((where?: any[] | ((row: {
            [key: string]: any;
        }, i?: number) => boolean)) => Promise<TableQueryResult>);
    };
    _fkRels: {
        [tableName: string]: InanoSQLForeignKey[];
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
    _rebuildFKs(): any;
    doFilter<T>(filterName: string, args: T, complete: (result: T) => void, cancelled: (error: any) => void): void;
    getCache(id: string, args?: {
        offset: number;
        limit: number;
    }): any[];
    presetQuery(fn: string): {
        promise: (args: any) => Promise<any[]>;
        stream: (args: any, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => void;
    };
    clearCache(id: string): boolean;
    every(args: {
        length: number;
        every?: number;
        offset?: number;
    }): number[];
    clearTTL(primaryKey: any): Promise<any>;
    expires(primaryKey: any): Promise<any>;
    _ttlTimer: any;
    _checkTTL(): void;
    _saveTableIds(): Promise<any>;
    selectTable(table?: string | any[] | ((where?: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)) => Promise<TableQueryResult>)): InanoSQLInstance;
    getPeers(): any;
    _detectStorageMethod(): any;
    _initPlugins(config: any): any;
    connect(config: InanoSQLConfig): Promise<any>;
    _initPeers(): any;
    on(action: string, callBack: (event: InanoSQLDatabaseEvent) => void, selectTable?: string): void;
    off(action: string, callBack: (event: InanoSQLDatabaseEvent) => void, selectTable?: string): void;
    _refreshEventChecker(): InanoSQLInstance;
    getView(viewName: string, viewArgs?: any): Promise<any>;
    doAction(actionName: string, actionArgs: any): Promise<any>;
    _doAV(AVType: any, table: any, AVName: any, AVargs: any): any;
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
    disconnect(): Promise<any>;
    extend(scope: string, ...args: any[]): any | InanoSQLInstance;
    loadJS(rows: {
        [key: string]: any;
    }[], onProgress?: (percent: number) => void): Promise<any[]>;
    JSONtoCSV(json: any[], printHeaders?: boolean, useHeaders?: string[]): string;
    csvToArray(text: string): any[];
    CSVtoJSON(csv: string, rowMap?: (row: any) => any): any;
    loadCSV(csv: string, rowMap?: (row: any) => any, onProgress?: (percent: number) => void): Promise<any[]>;
}
export interface InanoSQLForeignKey {
    selfPath: string[];
    selfIsArray: boolean;
    onDelete: InanoSQLFKActions;
    childTable: string;
    childPath: string[];
    childIsArray: boolean;
    childIndex: string;
}
export declare class InanoSQLObserverQuery {
    constructor(query: InanoSQLQuery, debounce: number, unique: boolean, compareFn: (rowsA: any[], rowsB: any[]) => boolean);
    trigger(): any;
    stream(onRow: (row: any) => void, complete: () => void, error: (err: any) => void, events?: boolean): any;
    exec(callback: (rows: any[], error?: any) => void, events?: boolean): any;
    unsubscribe(): any;
}
export declare class InanoSQLQueryBuilder {
    _db: InanoSQLInstance;
    _error: string;
    _AV: string;
    _query: InanoSQLQuery;
    static execMap: any;
    constructor(db: InanoSQLInstance, table: string | any[] | (() => Promise<any[]>), queryAction: string | ((nSQL: InanoSQLInstance) => InanoSQLQuery), queryArgs?: any, actionOrView?: string);
    where(args: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)): InanoSQLQueryBuilder;
    orderBy(args: string[]): InanoSQLQueryBuilder;
    listen(args?: {
        debounce?: number;
        unique?: boolean;
        compareFn?: (rowsA: any[], rowsB: any[]) => boolean;
    }): InanoSQLObserverQuery;
    groupBy(columns: string[]): InanoSQLQueryBuilder;
    having(args: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)): InanoSQLQueryBuilder;
    join(args: InanoSQLJoinArgs | InanoSQLJoinArgs[]): InanoSQLQueryBuilder;
    limit(args: number): InanoSQLQueryBuilder;
    comment(comment: string): InanoSQLQueryBuilder;
    extend(scope: string, ...args: any[]): InanoSQLQueryBuilder;
    union(queries: (() => Promise<any[]>)[], unionAll?: boolean): InanoSQLQueryBuilder;
    offset(args: number): InanoSQLQueryBuilder;
    tag(tag: string): InanoSQLQueryBuilder;
    emit(): InanoSQLQuery;
    distinct(columns: string[]): InanoSQLQueryBuilder;
    ttl(seconds?: number, cols?: string[]): InanoSQLQueryBuilder;
    toCSV(headers?: boolean): any;
    stream(onRow: (row: any) => void, complete: () => void, err: (error: any) => void): void;
    cache(cacheReady: (cacheId: string, recordCount: number) => void, error: (error: any) => void, streamPages?: {
        pageSize: number;
        onPage: (page: number, rows: any[]) => void;
        doNotCache?: boolean;
    }): void;
    graph(graphArgs: InanoSQLGraphArgs | InanoSQLGraphArgs[]): InanoSQLQueryBuilder;
    from(tableObj: {
        table: string | any[] | ((where?: any[] | ((row: {
            [key: string]: any;
        }, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string;
    }): InanoSQLQueryBuilder;
    into(table: string): InanoSQLQueryBuilder;
    on(table: string): InanoSQLQueryBuilder;
    exec(): Promise<{
        [key: string]: any;
    }[]>;
}
export declare class InanoSQLQueryExec {
    nSQL: InanoSQLInstance;
    query: InanoSQLQuery;
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
    _orderBy: InanoSQLSortBy;
    _groupBy: InanoSQLSortBy;
    constructor(nSQL: InanoSQLInstance, query: InanoSQLQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void);
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
    _createTable(table: InanoSQLTableConfig, alterTable: boolean, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void;
    _dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    _onError(err: any): any;
    _resolveFastWhere(onlyPKs: any, table: any, fastWhere: any, isReversed: any, orderByPK: any, onRow: any, complete: any): any;
    _fastQuery(onRow: any, complete: any): any;
    _getRecords(onRow: (row: {
        [name: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void): void;
    _rebuildIndexes(table: any, complete: any, error: any): any;
    _where(singleRow: any, where: any, ignoreFirstPath: any): any;
    static likeCache: {
        [likeQuery: string]: RegExp;
    };
    _processLIKE(columnValue: any, givenValue: any): any;
    _getColValue(where: any, wholeRow: any, isJoin: any): any;
    _compare(where: any, wholeRow: any, isJoin: any): any;
    static _sortMemoized: {
        [key: string]: InanoSQLSortBy;
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
export interface InanoSQLConfig {
    id?: string;
    peer?: boolean;
    cache?: boolean;
    queue?: boolean;
    mode?: string | InanoSQLAdapter;
    plugins?: InanoSQLPlugin[];
    planetRadius?: number;
    version?: number;
    size?: number;
    path?: string | ((dbID: string, tableName: string) => {
        lvld: any;
        args?: any;
    });
    disableTTL?: boolean;
    tables?: InanoSQLTableConfig[];
    types?: {
        [typeName: string]: {
            [colAndType: string]: InanoSQLDataModel;
        };
    };
    onVersionUpdate?: (oldVersion: number) => Promise<number>;
}
export interface InanoSQLDataModel {
    ai?: boolean;
    pk?: boolean;
    default?: any;
    model?: {
        [colAndType: string]: InanoSQLDataModel;
    };
    notNull?: boolean;
    max?: number;
    min?: number;
    [key: string]: any;
}
export interface InanoSQLSortBy {
    sort: {
        fn?: string;
        path: string[];
        dir: string;
    }[];
    index: string;
}
export interface InanoSQLPlugin {
    name: string;
    version: number;
    dependencies?: {
        [packageName: string]: number[];
    };
    filters?: {
        name: string;
        priority: number;
        call: (inputArgs: any, complete: (args: any) => void, cancel: (info: any) => void) => void;
    }[];
}
export interface InanoSQLAdapterConstructor {
    new (...args: any[]): InanoSQLAdapter;
}
export interface InanoSQLAdapter {
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;
    connect(id: string, complete: () => void, error: (err: any) => void): any;
    disconnect(complete: () => void, error: (err: any) => void): any;
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void): any;
    dropTable(table: string, complete: () => void, error: (err: any) => void): any;
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
    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void): any;
    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void): any;
    createIndex(table: string, indexName: string, type: string, complete: () => void, error: (err: any) => void): any;
    deleteIndex(table: string, indexName: string, complete: () => void, error: (err: any) => void): any;
    addIndexValue(table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void): any;
    deleteIndexValue(table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void): any;
    readIndexKey(table: string, indexName: string, pk: any, onRowPK: (key: any) => void, complete: () => void, error: (err: any) => void): any;
    readIndexKeys(table: string, indexName: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, value: any) => void, complete: () => void, error: (err: any) => void): any;
}
export interface InanoSQLActionOrView {
    name: string;
    args?: string[];
    extend?: any;
    call: (args: any, db: InanoSQLInstance) => Promise<any[]>;
}
export interface InanoSQLFunctionResult {
    result: any;
    row?: any;
    [key: string]: any;
}
export interface InanoSQLFunction {
    type: "A" | "S";
    aggregateStart?: {
        result: any;
        row?: any;
        [key: string]: any;
    };
    call: (query: InanoSQLQuery, row: any, prev: {
        result: any;
        row?: any;
        [key: string]: any;
    }, ...args: any[]) => InanoSQLFunctionResult;
    checkIndex?: (query: InanoSQLQuery, fnArgs: string[], where: string[]) => IWhereCondition | false;
    queryIndex?: (query: InanoSQLQuery, where: IWhereCondition, onlyPKs: boolean, onRow: (row: any, i: any) => void, complete: () => void, error: (err: any) => void) => void;
}
export interface InanoSQLV1ConfigFn {
    model: (dataModels: {
        key: string;
        type: string;
        props?: any[];
        default?: any;
    }[]) => InanoSQLV1ConfigFn;
    actions: (actions: InanoSQLActionOrView[]) => InanoSQLV1ConfigFn;
    views: (views: InanoSQLActionOrView[]) => InanoSQLV1ConfigFn;
    config: (obj: {
        [key: string]: any;
    }) => InanoSQLV1ConfigFn;
    table: (ta?: string) => InanoSQLV1ConfigFn;
    rowFilter: (callback: (row: any) => any) => InanoSQLV1ConfigFn;
}
export declare enum InanoSQLFKActions {
    NONE = 0,
    CASCADE = 1,
    RESTRICT = 2,
    SET_NULL = 3
}
export interface InanoSQLTableIndexConfig {
    offset?: number;
    unique?: boolean;
    foreignKey?: {
        target: string;
        onDelete?: InanoSQLFKActions;
    };
    [prop: string]: any;
}
export interface InanoSQLTableConfig {
    name: string;
    model: {
        [colAndType: string]: InanoSQLDataModel;
    } | string;
    primaryKey?: string;
    indexes?: {
        [colAndType: string]: InanoSQLTableIndexConfig;
    };
    queries?: {
        name: string;
        args?: {
            [colAndType: string]: InanoSQLDataModel;
        } | string;
        returns?: {
            [colAndType: string]: InanoSQLDataModel;
        } | string;
        call: (db: InanoSQLInstance, args: any, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => any;
    }[];
    filter?: (row: any) => any;
    actions?: InanoSQLActionOrView[];
    views?: InanoSQLActionOrView[];
    props?: {
        [key: string]: any;
    };
    _internal?: boolean;
}
export interface InanoSQLTable {
    model: {
        [colAndType: string]: InanoSQLDataModel;
    } | string;
    id: string;
    name: string;
    columns: InanoSQLTableColumn[];
    indexes: {
        [id: string]: InanoSQLIndex;
    };
    queries: {
        [fnName: string]: {
            args?: {
                [colAndType: string]: InanoSQLDataModel;
            } | string;
            returns?: {
                [colAndType: string]: InanoSQLDataModel;
            } | string;
            call: (db: InanoSQLInstance, args: any, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => any;
        };
    };
    filter?: (row: any) => any;
    actions: InanoSQLActionOrView[];
    views: InanoSQLActionOrView[];
    pkType: string;
    pkCol: string[];
    isPkNum: boolean;
    ai: boolean;
    props?: any;
}
export interface InanoSQLTableColumn {
    key: string;
    type: string;
    model?: InanoSQLTableColumn[];
    notNull?: boolean;
    default?: any;
    max?: number;
    min?: number;
    ai?: boolean;
    pk?: boolean;
}
export interface InanoSQLDatabaseEvent {
    target: string;
    path: string;
    events: string[];
    time: number;
    result?: any;
    [key: string]: any;
}
export interface InanoSQLJoinArgs {
    type: "left" | "inner" | "right" | "cross" | "outer";
    with: {
        table: string | any[] | ((where?: any[] | ((row: {
            [key: string]: any;
        }, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string;
    };
    on?: any[];
}
export interface InanoSQLGraphArgs {
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
    graph?: InanoSQLGraphArgs | InanoSQLGraphArgs[];
    on?: (row: {
        [key: string]: any;
    }, idx: number) => boolean | any[];
}
export interface InanoSQLUnionArgs {
    type: "all" | "distinct";
    queries: (() => Promise<any[]>)[];
}
export interface InanoSQLQuery {
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
    graph?: InanoSQLGraphArgs | InanoSQLGraphArgs[];
    orderBy?: string[];
    groupBy?: string[];
    having?: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean);
    join?: InanoSQLJoinArgs | InanoSQLJoinArgs[];
    limit?: number;
    offset?: number;
    distinct?: string[];
    ttl?: number;
    ttlCols?: string[];
    skipQueue?: boolean;
    union?: InanoSQLUnionArgs;
    cacheID?: string;
    parent: InanoSQLInstance;
    returnEvent?: boolean;
    [key: string]: any;
}
export interface InanoSQLIndex {
    id: string;
    type: string;
    isArray: boolean;
    props: {
        unique?: boolean;
        offset?: number;
        foreignKey?: {
            target: string;
            onDelete?: InanoSQLFKActions;
        };
        ignore_case?: boolean;
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
    fnString?: string;
    parsedFn?: {
        name: string;
        args: string[];
    };
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
    res?: any;
}
export interface SQLiteAbstractFns {
    createAI: (complete: () => void, error: (err: any) => void) => void;
    createTable: (table: string, tableData: InanoSQLTable, ai: {
        [table: string]: number;
    }, complete: () => void, error: (err: any) => void) => void;
    dropTable: (table: string, complete: () => void, error: (err: any) => void) => void;
    write: (pkType: string, pkCol: string[], table: string, pk: any, row: any, doAI: boolean, ai: {
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
    res: InanoSQLTableConfig;
    query: InanoSQLQuery;
}
export interface queryFilter extends abstractFilter {
    res: InanoSQLQuery;
}
export interface eventFilter extends abstractFilter {
    res: InanoSQLDatabaseEvent;
}
export interface configFilter extends abstractFilter {
    res: InanoSQLConfig;
}
export interface IAVFilterResult {
    AVType: "a" | "v";
    table: string;
    AVName: string;
    AVArgs: any;
}
export interface TableQueryResult {
    rows: string | any[];
    filtered: boolean;
    cache?: boolean;
}
export interface actionViewFilter extends abstractFilter {
    res: IAVFilterResult;
}
export interface configFilter extends abstractFilter {
    res: InanoSQLConfig;
}
export interface willConnectFilter extends abstractFilter {
    res: InanoSQLInstance;
}
export interface readyFilter extends abstractFilter {
}
export interface disconnectFilter extends abstractFilter {
}
export interface customQueryFilter extends abstractFilter {
    res: undefined;
    query: InanoSQLQuery;
    onRow: (row: any, i: number) => void;
    complete: () => void;
    error: (err: any) => void;
}
export interface customEventFilter extends abstractFilter {
    res: {
        nameSpace: string;
        path: string;
    };
    selectedTable: string;
    action: string;
    on: boolean;
}
export interface adapterReadFilter extends abstractFilter {
    res: {
        table: string;
        pk: any;
        complete: (row: {
            [key: string]: any;
        } | undefined) => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterReadMultiFilter extends abstractFilter {
    res: {
        table: string;
        type: "range" | "offset" | "all";
        offsetOrLow: any;
        limitOrHigh: any;
        reverse: boolean;
        onRow: (row: {
            [key: string]: any;
        }, i: number) => void;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterWriteFilter extends abstractFilter {
    res: {
        table: string;
        pk: any;
        row: {
            [key: string]: any;
        };
        complete: (pk: any) => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterConnectFilter extends abstractFilter {
    res: {
        id: string;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterDisconnectFilter extends abstractFilter {
    res: {
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterCreateTableFilter extends abstractFilter {
    res: {
        tableName: string;
        tableData: InanoSQLTable;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterDropTableFilter extends abstractFilter {
    res: {
        table: string;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterDeleteFilter extends abstractFilter {
    res: {
        table: string;
        pk: any;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterGetTableIndexFilter extends abstractFilter {
    res: {
        table: string;
        complete: (index: any[]) => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterGetTableIndexLengthFilter extends abstractFilter {
    res: {
        table: string;
        complete: (index: number) => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterCreateIndexFilter extends abstractFilter {
    res: {
        table: string;
        indexName: string;
        type: string;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterDeleteIndexFilter extends abstractFilter {
    res: {
        table: string;
        indexName: string;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterAddIndexValueFilter extends abstractFilter {
    res: {
        table: string;
        indexName: string;
        key: any;
        value: any;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterDeleteIndexValueFilter extends abstractFilter {
    res: {
        table: string;
        indexName: string;
        key: any;
        value: any;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterReadIndexKeyFilter extends abstractFilter {
    res: {
        table: string;
        indexName: string;
        pk: any;
        onRowPK: (key: any) => void;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface adapterReadIndexKeysFilter extends abstractFilter {
    res: {
        table: string;
        indexName: string;
        type: "range" | "offset" | "all";
        offsetOrLow: any;
        limitOrHigh: any;
        reverse: boolean;
        onRowPK: (key: any, id: any) => void;
        complete: () => void;
        error: (err: any) => void;
    };
    query?: InanoSQLQuery;
}
export interface loadIndexCacheFilter extends abstractFilter {
    res: {
        load: boolean;
    };
    index: string;
}
export interface conformRowFilter extends abstractFilter {
    res: any;
    oldRow: any;
    query: InanoSQLQuery;
}
export interface onEventFilter extends abstractFilter {
    res: {
        action: string;
        callback: (event: InanoSQLDatabaseEvent) => void;
    };
}
export interface offEventFilter extends abstractFilter {
    res: {
        action: string;
        callback: (event: InanoSQLDatabaseEvent) => void;
    };
}
export interface deleteRowFilter extends abstractFilter {
    query: InanoSQLQuery;
}
export interface addRowFilter extends abstractFilter {
    query: InanoSQLQuery;
}
export interface updateRowFilter extends abstractFilter {
    query: InanoSQLQuery;
    row: any;
}
export interface postConnectFilter extends abstractFilter {
    res: InanoSQLConfig;
}
export interface readyFilter extends abstractFilter {
    res: InanoSQLDatabaseEvent;
}
export interface addRowEventFilter extends abstractFilter {
    res: InanoSQLDatabaseEvent;
    query: InanoSQLQuery;
}
export interface deleteRowEventFilter extends abstractFilter {
    res: InanoSQLDatabaseEvent;
    query: InanoSQLQuery;
}
export interface updateRowEventFilter extends abstractFilter {
    res: InanoSQLDatabaseEvent;
    query: InanoSQLQuery;
}
export interface InanoSQLupdateIndex {
    table: string;
    indexName: string;
    value: any;
    pk: any;
    addToIndex: boolean;
    done: () => void;
    err: (err: any) => void;
    query: InanoSQLQuery;
    nSQL: InanoSQLInstance;
}
export interface updateIndexFilter extends abstractFilter {
    res: InanoSQLupdateIndex;
    query: InanoSQLQuery;
}
export interface configTableSystemFilter extends abstractFilter {
    res: InanoSQLTable;
    query: InanoSQLQuery;
}
