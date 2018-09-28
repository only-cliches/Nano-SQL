import { uuid } from "./utilities";

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

export interface NanoSQLConfig {
    id?: string;
    peer?: boolean;
    cache?: boolean;
    queueQueries?: boolean;
    disableTTL?: boolean;
    mode?: string | NanoSQLAdapter;
    plugins?: NanoSQLPlugin[];
    version?: number;
    size?: number; // size of WebSQL database
    onVersionUpdate?: (oldVersion: number) => Promise<number>;
    tables: {
        name: string;
        types?: {[name: string]: {[key: string]: {type: string, default?: any}}}
        model: DataModel[],
        filter?: (row: any) => any,
        actions?: ActionOrView[],
        views?: ActionOrView[],
        props?: any;
    }[];
}

export interface NanoSQLAdapter {

    name: string;
    plugin?: NanoSQLPlugin;

    connect(nSQL: any, complete: () => void, error: (err: any) => void);

    makeTable(tableName: string, dataModels: DataModel[], complete: () => void, error: (err: any) => void);

    destroyTable(table: string, complete: () => void, error: (err: any) => void);

    disconnect(complete: () => void, error: (err: any) => void);

    write(table: string, pk: any, row: {[key: string]: any}, complete: (row: {[key: string]: any}) => void, error: (err: any) => void);

    readPK(table: string, pk: any, complete: (row: {[key: string]: any}) => void, error: (err: any) => void);

    readAll(table: string, onRow: (row: {[key: string]: any}, nextRow: () => void) => void, complete: () => void, error: (err: any) => void);

    readPKRange(table: string, low: any, high: any, onRow: (row: {[key: string]: any}, nextRow: () => void) => void, complete: () => void, error: (err: any) => void);

    readOffsetLimit(table: string, offset: number, limit: number, onRow: (row: {[key: string]: any}, nextRow: () => void) => void, complete: () => void, error: (err: any) => void);

    deletePK(table: string, pk: any, complete: () => void, error: (err: any) => void);

    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void);

    getNumberOfRecords?(table: string, complete: (length: number) => void, error: (err: any) => void);
}

/**
 * This is the format used for actions and views
 *
 * @export
 * @interface ActionOrView
 */
export interface ActionOrView {
    name: string;
    args?: string[];
    extend?: any;
    call: (args?: any, db?: any) => Promise<any[]>;
}


export interface NanoSQLFunction {
    type: "A" | "S"; // aggregate or simple function
    aggregateStart?: {result: any, row?: any, [key: string]: any};
    call: (row: any, complete: (result: {result: any, row?: any, [key: string]: any}) => void, isJoin: boolean, prev: {result: any, row?: any, [key: string]: any}, ...args: any[]) => void; // function call
}

/**
 * You need an array of these to declare a data model.
 *
 * @export
 * @interface DataModel
 */
export interface DataModel {
    key: string;
    type: "string" | "int" | "float" | "array" | "map" | "bool" | "uuid" | "blob" | "timeId" | "timeIdms" | "safestr" | "number" | "object" | "obj" | "gps" | string;
    default?: any;
    props?: any[];
}

/**
 * Returned by the event listener when it's called.
 *
 * @export
 * @interface DatabaseEvent
 */
export interface DatabaseEvent {
    source: string;
    sourceID: string;
    table: string;
    time: number;
    notes?: string[];
    result: any[];
    events: string[];
    actionOrView?: string;
    affectedPKs?: any[];
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
export interface JoinArgs {
    type: "left" | "inner" | "right" | "cross" | "outer";
    table: string;
    where?: Array<string>;
}

export const buildQuery = (table: string, action: string): IdbQuery => {
    return {
        table: table,
        action: action,
        state: "pending",
        result: [],
        time: Date.now(),
        queryID: uuid(),
        extend: []
    };
};

export interface IdbQuery {
    table: string | any[];
    action: string;
    actionArgs?: {[key: string]: any};
    state: "pending" | "processing" | "complete";
    result: any[];
    time: number;
    extend: {scope: string, args: any[]}[];
    queryID: string;
    comments?: string[];
    from?: () => Promise<any[]>;
    where?: any[] | ((row: {[key: string]: any}) => boolean);
    range?: number[];
    orderBy?: { [column: string]: "asc" | "desc" };
    groupBy?: { [column: string]: "asc" | "desc" };
    having?: any[] | ((row: {[key: string]: any}) => boolean);
    join?: JoinArgs | JoinArgs[];
    limit?: number;
    offset?: number;
    ttl?: number;
    ttlCols?: string[];
    [key: string]: any;
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
export interface disconnectFilter extends abstractFilter {

}

// tslint:disable-next-line
export interface extendFilter extends abstractFilter {
    scope: string;
    args: any[];
}

// tslint:disable-next-line
export interface queryFilter extends abstractFilter {
    result: IdbQuery;
}

// tslint:disable-next-line
export interface eventFilter extends abstractFilter {
    result: DatabaseEvent;
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
export interface connectFilter extends abstractFilter {

}