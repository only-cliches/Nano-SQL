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
    id?: string | number;
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


    /**
     * Called when it's time for the backend to be initilized.
     * Do all the backend setup work here, then resolve the promise when you're done.
     *
     * @param {() => void} complete
     * @memberof NanoSQLAdapter
     */
    connect(nSQL: any, complete: () => void, error: (err: any) => void);

    /**
     * Sent after connect(), sends data models and other info.
     * makeTable() will be called everytime the database backend is connected, so make sure
     * it's setup where you don't accidentally overwrite or destroy existing tables with the same name.
     *
     * @param {string} tableName
     * @param {DataModel[]} dataModels
     * @memberof NanoSQLAdapter
     */
    makeTable(tableName: string, dataModels: DataModel[], complete: () => void, error: (err: any) => void);

    /**
     * Completely delete/destroy a given table
     *
     * @param {() => void} complete
     * @memberof NanoSQLAdapter
     */
    destroyTable(table: string, complete: () => void, error: (err: any) => void);

    /**
     * Called to disconnect the database and do any clean up that's needed
     *
     * @param {() => void} complete
     * @param {(err: Error) => void} [error]
     * @memberof NanoSQLAdapter
     */
    disconnect?(complete: () => void, error: (err: any) => void);

    /**
     * Write a single row to the database backend.
     * Primary key will be provided if it's known before the insert, otherwise it will be null and up to the database backend to make one.
     * It's also intirely possible for a primary key to be provided for a non existent row, the backend should handle this gracefully.
     *
     * @param {string} table
     * @param {(DBKey|null)} pk
     * @param {DBRow} data
     * @param {(finalRow: DBRow) => void} complete
     * @param {boolean} skipReadBeforeWrite
     * @memberof NanoSQLAdapter
     */
    write(table: string, pk: any, row: {[key: string]: any}, complete: (row: {[key: string]: any}) => void, error: (err: any) => void);

    /**
     * Read a single row from the database
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {(row: DBRow ) => void} callback
     * @memberof NanoSQLAdapter
     */
    readPK(table: string, pk: any, complete: (row: {[key: string]: any}) => void, error: (err: any) => void);


    readAll(table: string, onRow: (row: {[key: string]: any}, nextRow: () => void) => void, complete: () => void, error: (err: any) => void);

    /**
     * Read a range of rows given a specific range of keys.
     *
     * @param {*} low
     * @param {*} high
     * @param {(row: {[key: string]: any}) => void} onRow
     * @returns {Promise<any>}
     * @memberof NanoSQLAdapter
     */
    readPKRange(table: string, low: any, high: any, onRow: (row: {[key: string]: any}, nextRow: () => void) => void, complete: () => void, error: (err: any) => void);

    /**
     * Read a range of rows given an offset and limit.
     *
     * @param {number} offset
     * @param {number} limit
     * @param {(row: {[key: string]: any}) => void} onRow
     * @returns {Promise<any>}
     * @memberof NanoSQLAdapter
     */
    readOffsetLimit(table: string, offset: number, limit: number, onRow: (row: {[key: string]: any}, nextRow: () => void) => void, complete: () => void, error: (err: any) => void);


    /**
     * Delete a row from the backend given a table and primary key.
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {() => void} complete
     * @memberof NanoSQLAdapter
     */
    deletePK(table: string, pk: any, complete: () => void, error: (err: any) => void);

    /**
     * Get the number of rows in a table or the table index;
     *
     * @param {string} table
     * @param {(count: number) => void} complete
     * @memberof NanoSQLAdapter
     */
    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void);

    /**
     * Get total number of records in database
     *
     * @param {string} table
     * @returns {Promise<number>}
     * @memberof NanoSQLAdapter
     */
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
    table: string;
    time: number;
    notes?: string[];
    result?: any[];
    events: string[];
    actionOrView?: string;
    affectedpks?: any[];
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
        queryID: uuid()
    };
};

export interface IdbQuery {
    table: string | any[];
    action: string;
    actionArgs?: {[key: string]: any};
    state: "pending" | "processing" | "complete";
    result: any[];
    time: number;
    comments?: string[];
    queryID: string;
    where?: ((row: any, idx: number) => boolean) | any[];
    range?: number[];
    orderBy?: { [column: string]: "asc" | "desc" };
    groupBy?: { [column: string]: "asc" | "desc" };
    having?: any[];
    join?: JoinArgs | JoinArgs[];
    limit?: number;
    offset?: number;
    extend?: {scope: string, args: any[]};
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