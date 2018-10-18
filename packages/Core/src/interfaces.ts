import { uuid } from "./utilities";

export interface NanoSQLConfig {
    id?: string;
    peer?: boolean;
    cache?: boolean;
    queue?: boolean;
    mode?: string | NanoSQLAdapter;
    plugins?: NanoSQLPlugin[];
    version?: number;
    size?: number; // size of WebSQL database
    path?: string; // RocksDB path
    warnOnSlowQueries?: boolean;
    disableTTL?: boolean;
    onVersionUpdate?: (oldVersion: number) => Promise<number>;
}

export interface NanoSQLTableConfig {
    name: string;
    model: NanoSQLDataModel[];
    indexes?: {name: string, path: string}[];
    mapReduce?: {
        title?: string;
        throttle?: number;
        when: {
            onEvents?: string | string[];
            seconds?: number | number[];
            minute?: number | number[];
            hour?: number | number[];
            weekDay?: number | number[];
            date?: number | number[];
            month?: number | number[];
        };
        call: (evn: NanoSQLDatabaseEvent[]) => void;
    }[];
    filter?: (row: any) => any;
    actions?: NanoSQLActionOrView[];
    views?: NanoSQLActionOrView[];
    props?: any[];
    internal?: boolean;
}

export interface NanoSQLSortBy {
    sort: { path: string[], dir: string }[];
    index: string;
}

export interface NanoSQLPlugin {
    name: string;
    version: number;
    dependencies?: {
        [packageName: string]: number[];
    };
    filters: {
        name: string;
        priority: number;
        callback: (inputArgs: any) => Promise<any>;
    }[];
}

export interface NanoSQLAdapter {

    plugin?: NanoSQLPlugin;
    nSQL?: any; // NanoSQLInstance;

    connect(id: string, complete: () => void, error: (err: any) => void);

    disconnect(complete: () => void, error: (err: any) => void);

    createTable(tableName: string, tableData: NanoSQLTable, complete: () => void, error: (err: any) => void);
    
    dropTable(table: string, complete: () => void, error: (err: any) => void);

    disconnectTable(table: string, complete: () => void, error: (err: any) => void);

    write(table: string, pk: any, row: {[key: string]: any}, complete: (row: {[key: string]: any}) => void, error: (err: any) => void);

    read(table: string, pk: any, complete: (row: {[key: string]: any}) => void, error: (err: any) => void);

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void);

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHeigh: any, reverse: boolean, onRow: (row: {[key: string]: any}, i: number) => void, complete: () => void, error: (err: any) => void);

    readMultiPK(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHeigh: any, reverse: boolean, onPK: (pk: any, i: number) => void, complete: () => void, error: (err: any) => void);

    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void);

    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void);
}

/**
 * This is the format used for actions and views
 *
 * @export
 * @interface ActionOrView
 */
export interface NanoSQLActionOrView {
    name: string;
    args?: string[];
    extend?: any;
    call: (args?: any, db?: any) => Promise<any[]>;
}


export interface NanoSQLFunction {
    type: "A" | "S"; // aggregate or simple function
    aggregateStart?: {result: any, row?: any, [key: string]: any};
    call: (query: NanoSQLQuery, row: any, isJoin: boolean, prev: {result: any, row?: any, [key: string]: any}, ...args: any[]) => {result: any, row?: any, [key: string]: any}; // function call
    whereIndex?: (nSQL: any, query: NanoSQLQuery, fnArgs: string[], where: string[]) => WhereCondition | false;
    queryIndex?: (nSQL: any, query: NanoSQLQuery, where: WhereCondition, onlyPKs: boolean, onRow: (row, i) => void, complete: () => void) => void;
}

/**
 * You need an array of these to declare a data model.
 *
 * @export
 * @interface DataModel
 */
export interface NanoSQLDataModel {
    key: string;
    model?: NanoSQLDataModel[];
    default?: any;
    props?: any[];
}

export interface NanoSQLTable {
    model: NanoSQLDataModel[],
    columns: NanoSQLTableColumn[];
    indexes: {
        [name: string]: NanoSQLIndex;
    };
    filter?: (row: any) => any,
    actions: NanoSQLActionOrView[],
    views: NanoSQLActionOrView[],
    pkType: string;
    pkCol: string;
    ai: boolean;
    props?: any;
}

export interface NanoSQLTableColumn {
    key: string;
    type: string;
    model?: NanoSQLTableColumn[];
    notNull?: boolean;
    default?: any;
}

/**
 * Returned by the event listener when it's called.
 *
 * @export
 * @interface DatabaseEvent
 */
export interface NanoSQLDatabaseEvent {
    target: string;
    targetId: string;
    events: string[];
    time: number;
    result?: any[];
    actionOrView?: string;
    [key: string]: any;
}

/**
 * The arguments used for the join command.
 *
 * Type: join type to use
 * Query: A select query to use for the right side of the join
 * Where: Conditions to use to merge the data
 *
 * @export
 * @interface JoinArgs
 */
export interface NanoSQLJoinArgs {
    type: "left" | "inner" | "right" | "cross" | "outer";
    table: string;
    where?: Array<string>;
}

export const buildQuery = (table: string | any[] | (() => Promise<any[]>), action: string): NanoSQLQuery => {
    return {
        table: table,
        action: action,
        state: "pending",
        result: [],
        time: Date.now(),
        queryID: uuid(),
        extend: [],
        comments: []
    };
};

/**
 * ORM arguments to query ORM data.
 *
 * @export
 * @interface ORMArgs
 */
export interface ORMArgs {
    key: string;
    select?: string[];
    orm?: (string | ORMArgs)[];
    offset?: number;
    limit?: number;
    orderBy?: {
        [column: string]: "asc" | "desc";
    };
    groupBy?: {
        [column: string]: "asc" | "desc";
    };
    where?: (row: {[key: string]: any}, idx: number) => boolean | any[];
}

export interface NanoSQLQuery {
    table: string | any[] | (() => Promise<any[]>);
    action: string;
    actionArgs?: {[key: string]: any};
    state: "pending" | "processing" | "complete" | "error";
    result: any[];
    time: number;
    extend: {scope: string, args: any[]}[];
    queryID: string;
    comments: string[];
    where?: any[] | ((row: {[key: string]: any}, i?: number, isJoin?: boolean) => boolean);
    range?: number[];
    orm?: (string | ORMArgs)[];
    orderBy?: string[];
    groupBy?: string[];
    having?: any[] | ((row: {[key: string]: any}, i?: number, isJoin?: boolean) => boolean);
    join?: NanoSQLJoinArgs | NanoSQLJoinArgs[];
    limit?: number;
    offset?: number;
    ttl?: number;
    ttlCols?: string[];
    model?: NanoSQLTableConfig;
    [key: string]: any;
}

export interface NanoSQLIndex {
    name: string;
    type: string;
    path: string[];
}

export interface SelectArgs {
    isFn: boolean;
    value: string;
    as?: string;
    args?: string[];
}

export enum WhereType {
    fast, // primary key or secondary index on all WHERE statements using nothing but AND with single dimensional WHERE
    medium, // fast query followed by AND with slow query (lets us grab optimized rows, then full table scan the optimized rows)
    slow, // full table scan
    fn, // full table scan with function
    none // no where, return all rows
}

export interface WhereCondition {
    index?: string;
    fnName?: string;
    fnArgs?: string[];
    col?: string;
    comp: string;
    value: string | string[];
}

export interface WhereArgs {
    type: WhereType;
    whereFn?: (row: { [name: string]: any }, index: number) => boolean;
    fastWhere?: (WhereCondition|string)[];
    slowWhere?: (WhereCondition|string|(WhereCondition|string)[])[];
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

// tslint:disable-next-line
export interface extendFilter extends abstractFilter {
    scope: string;
    args: any[];
}

// tslint:disable-next-line
export interface createTableFilter extends abstractFilter {
    result: NanoSQLTableConfig;
}

// tslint:disable-next-line
export interface queryFilter extends abstractFilter {
    result: NanoSQLQuery;
}

// tslint:disable-next-line
export interface eventFilter extends abstractFilter {
    result: NanoSQLDatabaseEvent;
}

// tslint:disable-next-line
export interface config extends abstractFilter {
    result: NanoSQLConfig;
}

export interface AVFilterResult {
    AVType: "Action" | "View";
    table: string;
    AVName: string;
    AVargs: any;
}

// tslint:disable-next-line
export interface actionFilter extends abstractFilter {
    result: AVFilterResult;
}

// tslint:disable-next-line
export interface viewFilter extends abstractFilter {
    result: AVFilterResult;
}

// tslint:disable-next-line
export interface configFilter extends abstractFilter {
    result: NanoSQLConfig;
}

// tslint:disable-next-line
export interface willConnectFilter extends abstractFilter { }
// tslint:disable-next-line
export interface readyFilter extends abstractFilter { }
// tslint:disable-next-line
export interface disconnectFilter extends abstractFilter { }