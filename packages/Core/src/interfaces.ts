import { ReallySmallEvents } from "really-small-events";
import { _nanoSQLQueue } from "./utilities";

export const VERSION = 2.37;

export type uuid = String;
export type timeId = String;
export type timeIdms = String;

export interface InanoSQLDBConfig {
    config: InanoSQLConfig;
    adapter: InanoSQLAdapter;
    _ttlTimer: any;
    filters: {
        [filterName: string]: ((inputArgs: any, complete: (args: any) => void, cancel: (info: any) => void) => void)[];
    };
    _tables: {
        [tableName: string]: InanoSQLTable;
    };
    _tableIds: {
        [tableName: string]: string;
    }
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
    }
    state: {
        activeAV: string;
        hasAnyEvents: boolean;
        id: string;
        pid: string;
        peers: string[];
        peerEvents: string[];
        focused: boolean;
        peerMode: boolean;
        cacheId: uuid,
        connected: boolean;
        ready: boolean;
        exportQueryObj: boolean;
    };
    _queryCache: {
        [id: string]: any[];
    };
    _Q: _nanoSQLQueue;
}

export declare class InanoSQLInstance {

    version: number;
    functions: {
        [fnName: string]: InanoSQLFunction;
    };
    planetRadius: number;
    selectedDB: string;
    dbs: {
        [id: string]: InanoSQLDBConfig;
    }
    events: {
        [id: string]: {
            Core: { [path: string]: ReallySmallEvents };
            [eventName: string]: { [path: string]: ReallySmallEvents };
        };
    }
    selectedTable: string | any[] | ((where?: any[] | ((row: { [key: string]: any }, i?: number) => boolean)) => Promise<TableQueryResult>);
    indexTypes: {
        [type: string]: (value: any) => any;
    };
    txs: {
        [id: string]: {
            table: string;
            type: "put"|"del"|"idx-put"|"idx-del";
            data: any;
        }[]
    }
    getDB(id?:string): InanoSQLDBConfig;
    constructor();
    _rebuildFKs()
    doFilter<T>(databaseID: string|undefined, filterName: string, args: T, complete: (result: T) => void, cancelled: (error: any) => void): void;
    getCache(id: string, args?: { offset: number, limit: number }): any[];
    presetQuery(fn: string, args?: any): InanoSQLQueryBuilder
    clearCache(id: string): boolean;
    every(args: {length: number, every?: number, offset?: number}): number[];
    clearTTL(primaryKey: any): Promise<any>;
    expires(primaryKey: any): Promise<any>;
    _checkTTL(): void;
    _saveTableIds(databaseID: string): Promise<any>
    selectTable(table?: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>)): InanoSQLInstance;
    getPeers(): any;
    _initPlugins(config);
    connect(config?: InanoSQLConfig): Promise<any>;
    createDatabase(config?: InanoSQLConfig): Promise<any>;
    listDatabases(): string[];
    useDatabase(id: string): InanoSQLInstance;
    dropDatabase(id: string): Promise<any>;
    saveCount(databaseID: string, tableName: string, complete?: (err?: any) => void): void;
    _initPeers();
    on(action: string, callBack: (event: InanoSQLDatabaseEvent) => void, selectTable?: string): void;
    off(action: string, callBack: (event: InanoSQLDatabaseEvent) => void, selectTable?: string): void;
    _refreshEventChecker(): InanoSQLInstance;
    getView(viewName: string, viewArgs?: any): Promise<any>;
    doAction(actionName: string, actionArgs: any): Promise<any>;
    _doAV(AVType, table, AVName, AVargs);
    query(action: string | ((nSQL: InanoSQLInstance) => InanoSQLQuery), args?: any): InanoSQLQueryBuilder;
    triggerQuery(databaseID: string|undefined, query: InanoSQLQuery, onRow: (row: any) => void, complete: () => void, error: (err: string) => void): void;
    triggerEvent(databaseID: string|undefined, eventData: InanoSQLDatabaseEvent, ignoreStarTable?: boolean): InanoSQLInstance;
    default(databaseID: string|undefined, replaceObj?: any, table?: string): {
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
    disconnect(dbID?: string): Promise<any>;
    extend(scope: string, ...args: any[]): any | InanoSQLInstance;
    loadJS(rows: {
        [key: string]: any;
    }[], onProgress?: (percent: number) => void): Promise<any[]>;
    JSONtoCSV(json: any[], printHeaders?: boolean, useHeaders?: string[]): string;
    csvToArray(text: string): any[];
    maybeCreateEventObject(id: string);
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
    databaseID: string;
    constructor(databaseID: string, query: InanoSQLQuery, debounce: number, unique: boolean, compareFn: (rowsA: any[], rowsB: any[]) => boolean)
    trigger()
    stream(onRow: (row: any) => void, complete: () => void, error: (err: any) => void, events?: boolean)
    exec(callback: (rows: any[], error?: any) => void, events?: boolean)
    unsubscribe()
}
export declare class InanoSQLQueryBuilder {
    _db: InanoSQLInstance;
    _error: string;
    _AV: string;
    _query: InanoSQLQuery;
    databaseID: string;
    static execMap: any;
    constructor(databaseID: string, db: InanoSQLInstance, table: string | any[] | (() => Promise<any[]>), queryAction: string | ((nSQL: InanoSQLInstance) => InanoSQLQuery), queryArgs?: any, actionOrView?: string);
    where(args: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean)): InanoSQLQueryBuilder;
    orderBy(args: string[]): InanoSQLQueryBuilder;
    listen(args?: {debounce?: number, unique?: boolean, compareFn?: (rowsA: any[], rowsB: any[]) => boolean}): InanoSQLObserverQuery;
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
    toCSV(headers?: boolean): Promise<string>;
    stream(onRow: (row: any) => void, complete: () => void, err: (error: any) => void, exportEvent?: boolean): void;
    cache(cacheReady: (cacheId: string, recordCount: number) => void, error: (error: any) => void, streamPages?: {pageSize: number, onPage: (page: number, rows: any[]) => void, doNotCache?: boolean}): void;
    graph(graphArgs: InanoSQLGraphArgs | InanoSQLGraphArgs[]): InanoSQLQueryBuilder;
    from(tableObj: {
        table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string
    }): InanoSQLQueryBuilder;
    copyTo(table: string, mutate?: (row: any) => any): InanoSQLQueryBuilder;
    updateImmutable(rowData: {[key: string]: any}): InanoSQLQueryBuilder;
    into(table: string): InanoSQLQueryBuilder;
    on(table: string): InanoSQLQueryBuilder;
    exec(exportEvent?: boolean): Promise<{
        [key: string]: any;
    }[]>;
}


export declare class InanoSQLQueryExec {
    databaseID: string | undefined;
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
    constructor(databaseID: string | undefined, nSQL: InanoSQLInstance, query: InanoSQLQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void);
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
    _createTable(table: InanoSQLTableConfig, alterTable: boolean, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void;
    _dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    _onError(err);
    _resolveFastWhere(onlyPKs, table, fastWhere, isReversed, orderByPK, onRow, complete);
    _fastQuery(onRow, complete);
    _getRecords(onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void): void
    _rebuildIndexes(table, complete, error);
    _where(singleRow, where, ignoreFirstPath);
    static likeCache: {
        [likeQuery: string]: RegExp;
    };
    _processLIKE(columnValue, givenValue);
    _getColValue(where, wholeRow, isJoin);
    _compare(where, wholeRow, isJoin);
    static _sortMemoized: {
        [key: string]: InanoSQLSortBy;
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

/**
 * id: the database name/id.  Must remain identical between app loads to persist data
 * peer: (false) Connect database events/state between browser tabs.
 * cache:  (false) Save query results in memory, returns the cache if the table hasn't changed.
 * mode: ("TEMP") How and where to persist data.  Can be a string or adapter.
 * plugins: (undefined) Array of plugins to use in this database
 * planetRadis: (6,371) The number to use as the radius in CROW calculations.  Change to 3959 for miles.
 * version: The current database version configuration.
 * onVersionUpdate: (oldVersion: number) => Promise<number> Used to migrate database versions.
 * path: (undefined) The path to drop file based databases into.  Does not work for all database adapters.
 * disableTTL: (false)  Database uses timers to check for TTL queries, disable them here.  
 * tables: (undefined) The database tables to use, can be added later with "create table" queries.
 * types: (undefined) A collection of types that can be used in table column definitions. Types export to interface filesw ith CLI.
 *
 * @export
 * @interface InanoSQLConfig
 */
export interface InanoSQLConfig {
    id?: string;
    peer?: boolean;
    cache?: boolean;
    mode?: string | InanoSQLAdapter;
    plugins?: InanoSQLPlugin[];
    planetRadius?: number;
    warnOnSlowQuery?: boolean;
    version?: number;
    size?: number; // size of WebSQL database
    path?: string; // database path (if supported)
    disableTTL?: boolean;
    tables?: InanoSQLTableConfig[];
    types?: {
        [typeName: string]: {
            onInsert?: (colValue: any) => any,
            onSelect?: (colValue: any) => any,
            interfaceText?: string;
            model?: {
                [colAndType: string]: InanoSQLDataModel;
            }
        }
    };
    onVersionUpdate?: (oldVersion: number) => Promise<number>;
}


export interface InanoSQLDataModel {
    ai?: boolean;
    pk?: boolean;
    default?: any;
    immutable?: boolean;
    model?: {
        [colAndType: string]: InanoSQLDataModel;
    }
    notNull?: boolean;
    max?: number;
    min?: number;
    [key: string]: any;
}
/*
export interface InanoSQLMapReduce {
    name: string;
    call: (evn: InanoSQLDatabaseEvent) => Promise<any>;
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
*/

export interface InanoSQLSortBy {
    sort: {
        fn?: string;
        path: string[], 
        dir: string
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
    new(...args: any[]): InanoSQLAdapter;
}

export interface InanoSQLAdapter {

    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;

    connect(id: string, complete: () => void, error: (err: any) => void);

    disconnect(complete: () => void, error: (err: any) => void);

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void);

    dropTable(table: string, complete: () => void, error: (err: any) => void);

    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void);

    batch?(table: string, actions: {type: "put"|"del", data: any}[], success: (result: any[]) => void, error: (msg: any) => void): void;

    read(table: string, pk: any, complete: (row: {[key: string]: any} | undefined) => void, error: (err: any) => void);

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void);

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {[key: string]: any}, i: number) => void, complete: () => void, error: (err: any) => void);

    readMulti2?(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {[key: string]: any}, i: number, getNext: () => void) => void, complete: () => void, error: (err: any) => void);

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void);

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void);

    createIndex(table: string, indexName: string, type: string, complete: () => void, error: (err: any) => void);

    deleteIndex(table: string, indexName: string, complete: () => void, error: (err: any) => void);

    addIndexValue(table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void);

    deleteIndexValue(table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void);

    readIndexKey(table: string, indexName: string, pk: any, onRowPK: (key: any) => void, complete: () => void, error: (err: any) => void);

    readIndexKeys(table: string, indexName: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, value: any) => void, complete: () => void, error: (err: any) => void);

    readIndexKeys2?(table: string, indexName: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, value: any, getNext: () => void) => void, complete: () => void, error: (err: any) => void);
}


export interface InanoSQLActionOrView {
    name: string;
    args?: string[];
    extend?: any;
    call: (args: any, db: InanoSQLInstance) => Promise<any[]>;
}

export interface InanoSQLFunctionResult {
    result: any, 
    row?: any, 
    [key: string]: any
}

export interface InanoSQLFunction {
    type: "A" | "S"; // aggregate or simple function
    aggregateStart?: {result: any, row?: any, [key: string]: any};
    call: (query: InanoSQLQuery, row: any, prev: {result: any, row?: any, [key: string]: any}, ...args: any[]) => InanoSQLFunctionResult; // function call
    checkIndex?: (query: InanoSQLQuery, fnArgs: string[], where: string[]) => IWhereCondition | false;
    queryIndex?: (query: InanoSQLQuery, where: IWhereCondition, onlyPKs: boolean, onRow: (row, i) => void, complete: () => void, error: (err: any) => void) => void;
}

export interface InanoSQLV1ConfigFn {
    model: (dataModels: {key: string, type: string, props?: any[], default?: any}[]) => InanoSQLV1ConfigFn;
    actions: (actions: InanoSQLActionOrView[]) => InanoSQLV1ConfigFn;
    views: (views: InanoSQLActionOrView[]) => InanoSQLV1ConfigFn;
    config: (obj: {[key: string]: any}) => InanoSQLV1ConfigFn;
    table: (ta?: string) => InanoSQLV1ConfigFn;
    rowFilter: (callback: (row: any) => any) => InanoSQLV1ConfigFn;
};

export enum InanoSQLFKActions {
    NONE,
    CASCADE,
    RESTRICT,
    SET_NULL,
}

export interface InanoSQLTableIndexConfig {
    offset?: number;
    unique?: boolean;
    foreignKey?: { target: string, onDelete?: InanoSQLFKActions  };
    [prop: string]: any
}


export interface InanoSQLTableConfig {
    name: string;
    mode?: string | InanoSQLAdapter;
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
        call: (db: InanoSQLInstance, args: any) => InanoSQLQuery;
    }[],
    filter?: (row: any) => any;
    select?: (row: any) => any;
    actions?: InanoSQLActionOrView[];
    views?: InanoSQLActionOrView[];
    props?: {
        [key: string]: any;
    };
    _internal?: boolean;
}
/*
// not sure if we should even do denormalization
// since graph queries basically solve this in a more performant way
// keeping this here just incase
export interface InanoSQLDenormalizeModel {
    table: string;
    columns: {
        [thisCol: string]: string;
    }
    array?: boolean;
    direction?: "tgt<-src" | "tgt<->src"
    onSrcDel?: "del" | "keep"
}
*/

export interface InanoSQLTable {
    model: {
        [colAndType: string]: InanoSQLDataModel;
    } | string;
    id: string;
    count: number;
    rowLocks: {
        [key: string]: boolean;
    }
    name: string;
    mode?: InanoSQLAdapter;
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
            call: (db: InanoSQLInstance, args?: any) => InanoSQLQuery;
        }
    },
    filter?: (row: any) => any;
    select?: (row: any) => any;
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
    immutable: boolean;
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
        table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string;
    };
    on?: any[];
}


export interface InanoSQLGraphArgs {
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
    graph?: InanoSQLGraphArgs | InanoSQLGraphArgs[];
    on?: (row: {[key: string]: any}, idx: number) => boolean | any[];
}

export interface InanoSQLUnionArgs {
    type: "all" | "distinct", 
    queries: (() => Promise<any[]>)[]
}

export interface InanoSQLQuery {
    databaseID: string|undefined;
    table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
    tableAS?: string;
    action: string;
    actionArgs?: any;
    state: "pending" | "processing" | "complete" | "error";
    error?: any;
    result: any[];
    time: number;
    extend: {scope: string, args: any[]}[];
    queryID: string;
    tags: string[];
    copyTo?: {table: string, mutate: (row: any) => any};
    comments: string[];
    where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean);
    graph?: InanoSQLGraphArgs | InanoSQLGraphArgs[];
    orderBy?: string[];
    groupBy?: string[];
    having?: any[] | ((row: {[key: string]: any}, i?: number) => boolean);
    join?: InanoSQLJoinArgs | InanoSQLJoinArgs[];
    limit?: number;
    offset?: number;
    distinct?: string[];
    ttl?: number;
    ttlCols?: string[];
    union?: InanoSQLUnionArgs;
    cacheID?: string;
    parent: InanoSQLInstance;
    returnEvent?: boolean;
    updateImmutable?: any;
    transactionId?: string;
    [key: string]: any;
}

export interface _nanoSQLPreparedQuery {
    query: InanoSQLQuery
    type: 1|2|3; // 1 = fast, 2 = medium, 3 = complete
    whereArgs: IWhereArgs;
    havingArgs: IWhereArgs;
    orderBy: InanoSQLSortBy;
    groupBy: InanoSQLSortBy;
    pkOrderBy: boolean;
    idxOrderBy: boolean;
    hasFn: boolean;
    hasAggrFn: boolean;
    selectArgs: ISelectArgs[];
    indexes: string[];
}

export interface InanoSQLIndex {
    id: string;
    type: string;
    isArray: boolean;
    props: {
        unique?: boolean;
        offset?: number;
        foreignKey?: { target: string, onDelete?: InanoSQLFKActions  };
        ignore_case?: boolean;
        [key: string]: any;
    };
    path: string[];
    isDate: boolean;
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
    fnString?: string;
    parsedFn?: {name: string, args: string[]};
    col?: string;
    comp: string;
    value: any;
    type?: string;
}

export interface IWhereArgs {
    type: IWhereType;
    whereFn?: (row: { [name: string]: any }, index: number) => boolean;
    fastWhere?: (IWhereCondition|string)[];
    slowWhere?: (IWhereCondition|string|(IWhereCondition|string)[])[];
    indexesUsed?: string[];
}

// tslint:disable-next-line
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
    read: (table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) => void;
    remove: (table: string, pk: any, complete: () => void, error: (err: any) => void) => void;
    batch: (table: string, actions: {type: "put"|"del", data: any}[], success: (result: any[]) => void, error: (msg: any) => void) => void;
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
    res: InanoSQLTableConfig;
    query: InanoSQLQuery;
}

// tslint:disable-next-line
export interface queryFilter extends abstractFilter {
    res: InanoSQLQuery;
}

// tslint:disable-next-line
export interface eventFilter extends abstractFilter {
    res: InanoSQLDatabaseEvent;
}

// tslint:disable-next-line
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

// tslint:disable-next-line
export interface actionViewFilter extends abstractFilter {
    res: IAVFilterResult;
}

// tslint:disable-next-line
export interface configFilter extends abstractFilter {
    res: InanoSQLConfig;
}

// tslint:disable-next-line
export interface willConnectFilter extends abstractFilter {
    res: InanoSQLInstance;
 }
// tslint:disable-next-line
export interface readyFilter extends abstractFilter { }
// tslint:disable-next-line
export interface disconnectFilter extends abstractFilter { }
// tslint:disable-next-line
export interface customQueryFilter extends abstractFilter {
    res: undefined;
    query: InanoSQLQuery;
    onRow: (row: any, i: number) => void;
    complete: () => void;
    error: (err: any) => void;
}
// tslint:disable-next-line
export interface customEventFilter extends abstractFilter { 
    res: {nameSpace: string, path: string};
    selectedTable: string;
    action: string;
    on: boolean;
}

// tslint:disable-next-line
export interface adapterReadFilter extends abstractFilter { 
    res: { table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterReadMultiFilter extends abstractFilter {
    res: {
        table: string, 
        type: "range" | "offset" | "all", 
        offsetOrLow: any, 
        limitOrHigh: any, 
        reverse: boolean, 
        onRow: (row: { [key: string]: any }, i: number) => void, 
        complete: () => void, 
        error: (err: any) => void
    };
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterWriteFilter extends abstractFilter { 
    res: {table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void};
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterConnectFilter extends abstractFilter {
    res: {
        id: string, 
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterDisconnectFilter extends abstractFilter {
    res: {
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterCreateTableFilter extends abstractFilter {
    res: {
        table: string, 
        tableData: InanoSQLTable, 
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterDropTableFilter extends abstractFilter {
    res: {
        table: string, 
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterDeleteFilter extends abstractFilter {
    res: {
        table: string, 
        pk: any,
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterGetTableIndexFilter extends abstractFilter {
    res: {
        table: string, 
        complete: (index: any[]) => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterGetTableIndexLengthFilter extends abstractFilter {
    res: {
        table: string, 
        complete: (index: number) => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterCreateIndexFilter extends abstractFilter {
    res: {
        table: string,
        indexName: string, 
        type: string, 
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterDeleteIndexFilter extends abstractFilter {
    res: {
        table: string,
        indexName: string, 
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterAddIndexValueFilter extends abstractFilter {
    res: {
        table: string,
        indexName: string, 
        key: any, 
        value: any, 
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterDeleteIndexValueFilter extends abstractFilter {
    res: {
        table: string,
        indexName: string, 
        key: any, 
        value: any, 
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterReadIndexKeyFilter extends abstractFilter {
    res: {
        table: string,
        indexName: string, 
        pk: any, 
        onRowPK: (key: any) => void, 
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface adapterReadIndexKeysFilter extends abstractFilter {
    res: {
        table: string,
        indexName: string, 
        type: "range" | "offset" | "all", 
        offsetOrLow: any, 
        limitOrHigh: any, 
        reverse: boolean, 
        onRowPK: (key: any, id: any) => void, 
        complete: () => void, 
        error: (err: any) => void
    }
    query?: InanoSQLQuery;
}

// tslint:disable-next-line
export interface loadIndexCacheFilter extends abstractFilter { 
    res: {load: boolean};
    index: string;
}

// tslint:disable-next-line
export interface conformRowFilter extends abstractFilter { 
    res: any;
    oldRow: any;
    query: InanoSQLQuery
}

// tslint:disable-next-line
export interface onEventFilter extends abstractFilter { 
    res: {action: string, callback: (event: InanoSQLDatabaseEvent) => void}
}

// tslint:disable-next-line
export interface offEventFilter extends abstractFilter { 
    res: {action: string, callback: (event: InanoSQLDatabaseEvent) => void}
}

// tslint:disable-next-line
export interface deleteRowFilter extends abstractFilter { 
    query: InanoSQLQuery;
}

// tslint:disable-next-line
export interface addRowFilter extends abstractFilter { 
    query: InanoSQLQuery;
}

// tslint:disable-next-line
export interface updateRowFilter extends abstractFilter { 
    query: InanoSQLQuery;
    row: any;
}

// tslint:disable-next-line
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
    query: InanoSQLQuery
}

export interface InanoSQLupdateIndex {
    table: string,
    indexName: string;
    value: any, 
    pk: any, 
    addToIndex: boolean,
    done: () => void,
    err: (err: any) => void,
    query: InanoSQLQuery,
    nSQL: InanoSQLInstance
}

export interface updateIndexFilter extends abstractFilter {
    res: InanoSQLupdateIndex;
    query: InanoSQLQuery;
}

export interface configTableSystemFilter extends abstractFilter {
    res: InanoSQLTable;
    query: InanoSQLQuery;
}