import { _NanoSQLQuery, IdbQuery, IdbQueryExec } from "./query/std-query";
import { _NanoSQLTransactionQuery } from "./query/transaction";
import { StdObject } from "./utilities";
import { NanoSQLStorageAdapter } from "./database/storage";
import { Observer } from "./observable";
export interface NanoSQLBackupAdapter {
    adapter: NanoSQLStorageAdapter;
    waitForWrites?: boolean;
}
export interface NanoSQLConfig {
    id?: string | number;
    peer?: boolean;
    cache?: boolean;
    mode?: string | NanoSQLStorageAdapter | boolean;
    history?: boolean;
    hostoryMode?: string | {
        [table: string]: string;
    };
    secondaryAdapters?: NanoSQLBackupAdapter[];
    idbVersion?: number;
    dbPath?: string;
    writeCache?: number;
    readCache?: number;
    size?: number;
    tokenizer?: (table: string, column: string, args: string[], value: string) => {
        o: string;
        w: string;
        i: number;
    }[] | boolean;
    [key: string]: any;
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
    call: (args?: any, db?: NanoSQLInstance) => Promise<any>;
}
export interface NanoSQLFunction {
    type: "A" | "S";
    call: (rows: any[], complete: (result: any | any[]) => void, ...args: any[]) => void;
}
/**
 * You need an array of these to declare a data model.
 *
 * @export
 * @interface DataModel
 */
export interface DataModel {
    key: string;
    type: "string" | "int" | "float" | "array" | "map" | "bool" | "uuid" | "blob" | "timeId" | "timeIdms" | "safestr" | "number" | "object" | "obj" | string;
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
    table: string;
    query: IdbQuery;
    time: number;
    notes: string[];
    result: any[];
    types: ("change" | "delete" | "upsert" | "drop" | "select" | "error" | "transaction" | "peer-change")[];
    actionOrView: string;
    transactionID?: string;
    affectedRowPKS?: any[];
    affectedRows: DBRow[];
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
/**
 * ORM arguments to query ORM data.
 *
 * @export
 * @interface ORMArgs
 */
export interface ORMArgs {
    key: string;
    select?: string[];
    offset?: number;
    limit?: number;
    orderBy?: {
        [column: string]: "asc" | "desc";
    };
    groupBy?: {
        [column: string]: "asc" | "desc";
    };
    where?: (row: DBRow, idx: number) => boolean | any[];
}
/**
 *  A single database row.
 *
 * @export
 * @interface DBRow
 */
export interface DBRow {
    [key: string]: any;
}
export interface IActionViewMod {
    (tableName: string, actionOrView: "Action" | "View", name: string, args: any, complete: (args: any) => void, error?: (errorMessage: string) => void): void;
}
/**
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class NanoSQLInstance
 */
export declare class NanoSQLInstance {
    /**
     * Holds the current selected table
     *
     * @public
     * @type {string}
     * @memberOf NanoSQLInstance
     */
    sTable: string | any[];
    private _config;
    plugins: NanoSQLPlugin[];
    version: number;
    static earthRadius: number;
    /**
     * Holds the plugin / adapter used by instance queries.
     *
     * @type {NanoSQLPlugin}
     * @memberof NanoSQLInstance
     */
    iB: NanoSQLPlugin;
    isConnected: boolean;
    private _randoms;
    private _randomPtr;
    static functions: {
        [fnName: string]: NanoSQLFunction;
    };
    static whereFunctions: {
        [fnName: string]: (row: any, isJoin: boolean, ...args: any[]) => any;
    };
    /**
     * Misc placeholder that can be used by the dev.
     *
     * @type {*}
     * @memberOf NanoSQLInstance
     */
    data: any;
    rowFilters: {
        [table: string]: (row: any) => any;
    };
    /**
     * Holds a reference to the optional action/view modifier
     *
     *
     * @memberOf NanoSQLInstance
     */
    private _AVMod;
    /**
     * Holds wether each table has a primary key or not
     *
     * @type {{[table: string]: boolean}}
     * @memberof NanoSQLInstance
     */
    hasPK: {
        [table: string]: boolean;
    };
    /**
     * Stores wether each table has events attached to it or not.
     *
     * @public
     * @type {StdObject<boolean>}
     * @memberOf NanoSQLInstance
     */
    private _hasEvents;
    /**
     * Stores wether the event system needs to be active at all.
     *
     * @type {boolean}
     * @memberof NanoSQLInstance
     */
    hasAnyEvents: boolean;
    pluginHasDidExec: boolean;
    /**
     * Store an array of table names for ORM type casting.
     *
     * @private
     * @type {string[]}
     * @memberof NanoSQLInstance
     */
    tableNames: string[];
    /**
     * Stores wether {key: "*", type: "*"} is in the data model
     *
     * @type {{
     *         [tableName: string]: boolean;
     *     }}
     * @memberof NanoSQLInstance
     */
    skipPurge: {
        [tableName: string]: boolean;
    };
    tablePKs: {
        [table: string]: any;
    };
    private _onConnectedCallBacks;
    private _callbacks;
    toColRules: {
        [table: string]: {
            [column: string]: string[];
        };
    };
    peers: string[];
    pid: string;
    id: string;
    peerEvents: string[];
    focused: boolean;
    peerMode: boolean;
    toRowFns: {
        [table: string]: {
            [fnName: string]: (primaryKey: any, existingRow: any, callback: (newRow: any) => void) => void;
        };
    };
    toColFns: {
        [table: string]: {
            [fnName: string]: (existingValue: any, callback: (newValue: any) => void, ...args: any[]) => void;
        };
    };
    constructor();
    rowFilter(callback: (row: any) => any): this;
    toColumn(columnFns: {
        [fnName: string]: (existingValue: any, callback: (newValue: any) => void, ...args: any[]) => void;
    }): this;
    toRow(columnFns: {
        [fnName: string]: (primaryKey: any, existingRow: any, callback: (newRow: any) => void) => void;
    }): this;
    /**
     * nanoSQL generates 50 random 16 bit strings on every launch.
     * If you don't need true randomness you can use this function to get a psudorandom 16 bit string.
     * Performance is orders of a magnitude faster since no random number generator is needed.
     *
     * @returns {string}
     * @memberof NanoSQLInstance
     */
    fastRand(): number;
    /**
     * Changes the table pointer to a new table.
     *
     * @param {string} [table]
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    table(table?: string | any[]): NanoSQLInstance;
    getPeers(): any;
    /**
     * Inits the backend database for use.
     *
     * Optionally include a custom database driver, otherwise the built in memory driver will be used.
     *
     * @param {NanoSQLBackend} [backend]
     * @returns {(Promise<Object | string>)}
     *
     * @memberOf NanoSQLInstance
     */
    connect(): Promise<Object | string>;
    /**
     * Get all actions for a given table
     * =
     * @param {string} table
     * @returns
     * @memberof NanoSQLInstance
     */
    getActions(table: string): {
        name: string;
        args: string[] | undefined;
    }[];
    /**
     * Get all views for a given table
     *
     * @param {string} table
     * @returns
     * @memberof NanoSQLInstance
     */
    getViews(table: string): {
        name: string;
        args: string[] | undefined;
    }[];
    /**
     * Grab a copy of the database config object.
     *
     * @returns
     * @memberof NanoSQLInstance
     */
    getConfig(): NanoSQLConfig;
    /**
     * Set the action/view filter function.  Called *before* the action/view is sent to the datastore
     *
     * @param {IActionViewMod} filterFunc
     * @returns
     *
     * @memberOf NanoSQLInstance
     */
    avFilter(filterFunc: IActionViewMod): this;
    use(plugin: NanoSQLPlugin): this;
    /**
     * Adds an event listener to the selected database table.
     *
     * @param {("change"|"delete"|"upsert"|"drop"|"select"|"error")} actions
     * @param {Function} callBack
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    on(actions: string, callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance;
    /**
     * Remove a specific event handler from being triggered anymore.
     *
     * @param {Function} callBack
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    off(actions: string, callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance;
    private _refreshEventChecker();
    /**
     * Declare the data model for the current selected table.
     *
     * Please reference the DataModel interface for how to impliment this, a quick example:
     *
     * ```ts
     * .model([
     *  {key:"id",type:"int",props:["ai","pk"]} //auto incriment and primary key
     *  {key:"name",type:"string"}
     * ])
     * ```
     *
     * @param {Array<DataModel>} dataModel
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    model(dataModel: DataModel[], props?: any[], ignoreSanityCheck?: boolean): NanoSQLInstance;
    /**
     * Declare the views for the current selected table.  Must be called before connect()
     *
     * Views are created like this:
     *
     * ```ts
     * .views([
     *  {
     *      name:"view-name",
     *      args: ["array","of","arguments"],
     *      call: function(args) {
     *          // Because of our "args" array the args input of this function will look like this:
     *          // NanoSQL will not let any other arguments into this function.
     *          args:{
     *              array:'',
     *              of:'',
     *              arguments:''
     *          }
     *          //We can use them in our query
     *          return this.query('select').where(['name','IN',args.array]).exec();
     *      }
     *  }
     * ])
     * ```
     *
     * Then later in your app..
     *
     * ```ts
     * NanoSQL("users").getView("view-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     *
     * ```ts
     * .views[{
     *      name:...
     *      args:["name:string","balance:float","active:bool"]
     *      call:...
     * }]
     * ```
     *
     * NanoSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
     *
     * @param {Array<ActionOrView>} viewArray
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    views(viewArray: ActionOrView[]): NanoSQLInstance;
    /**
     * Execute a specific view.  Refernece the "views" function for more description.
     *
     * Example:
     * ```ts
     * NanoSQL("users").getView('view-name',{foo:"bar"}).then(function(result) {
     *  console.log(result) <== view result.
     * })
     * ```
     *
     * @param {string} viewName
     * @param {any} viewArgs
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    getView(viewName: string, viewArgs?: any): Promise<Array<any> | NanoSQLInstance>;
    /**
     * Declare the actions for the current selected table.  Must be called before connect()
     *
     * Actions are created like this:
     * ```ts
     * .actions([
     *  {
     *      name:"action-name",
     *      args: ["array","of","arguments"],
     *      call: function(args) {
     *          // Because of our "args" array the args input of this function will look like this:
     *          // NanoSQL will not let any other arguments into this function.
     *          args:{
     *              array:'',
     *              of:'',
     *              arguments:''
     *          }
     *          //We can use them in our query
     *          return this.query("upsert",{balance:0}).where(['name','IN',args.array]).exec();
     *      }
     *  }
     * ])
     * ```
     *
     * Then later in your app..
     *
     * ```ts
     * NanoSQL("users").doAction("action-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     * ```ts
     * .actions[{
     *      name:...
     *      args:["name:string","balance:float","active:bool"]
     *      call:...
     * }]
     * ```
     *
     * NanoSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
     *
     * @param {Array<ActionOrView>} actionArray
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    actions(actionArray: Array<ActionOrView>): NanoSQLInstance;
    /**
     * Init an action for the current selected table. Reference the "actions" method for more info.
     *
     * Example:
     * ```ts
     * NanoSQL("users").doAction('action-name',{foo:"bar"}).then(function(result) {
     *      console.log(result) <== result of your action
     * });
     * ```
     *
     * @param {string} actionName
     * @param {any} actionArgs
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    doAction(actionName: string, actionArgs: any): Promise<Array<DBRow> | NanoSQLInstance>;
    /**
     * Adds a query filter to every request.
     *
     * @param {(args: DBExec, complete:(args: DBExec) => void) => void} callBack
     *
     * @memberOf NanoSQLInstance
     */
    queryFilter(callBack: (args: IdbQuery, complete: (args: IdbQuery) => void) => void): NanoSQLInstance;
    /**
     * Internal function to fire action/views.
     *
     * @private
     * @param {("Action"|"View")} AVType
     * @param {ActionOrView[]} AVList
     * @param {string} AVName
     * @param {*} AVargs
     * @returns {(Promise<Array<DBRow>|NanoSQLInstance>)}
     *
     * @memberOf NanoSQLInstance
     */
    private _doAV(AVType, AVList, AVName, AVargs);
    /**
     * Start a query into the current selected table.
     * Possibl querys are "select", "upsert", "delete", and "drop";
     *
     * ### Select
     *
     * Select is used to pull a set of rows or other data from the table.
     * When you use select the optional second argument of the query is an array of strings that allow you to show only specific columns.
     *
     * Examples:
     * ```ts
     * .query("select") // No arguments, select all columns
     * .query("select",['username']) // only get the username column
     * .query("select",["username","balance"]) //Get two columns, username and balance.
     * .query("select",["count(*)"]) //Get the length of records in the database
     * ```
     *
     * ### Upsert
     *
     * Upsert is used to add or modify data in the database.
     * If the primary key rows are null or undefined, the data will always be added in a new row. Otherwise, you might be updating existing rows.
     * The second argument of the query with upserts is always an Object of the data to upsert.
     *
     * Examples:
     * ```ts
     * .query("upsert",{id:1, username:"Scott"}) //If row ID 1 exists, set the username to scott, otherwise create a new row with this data.
     * .query("upsert",{username:"Scott"}) //Add a new row to the db with this username in the row.
     * .query("upsert",{balance:-35}).where(["balance","<",0]) // If you use a WHERE statement this data will be applied to the rows found with the where statement.
     * ```
     *
     * ### Delete
     *
     * Delete is used to remove data from the database.
     * It works exactly like select, except it removes data instead of selecting it.  The second argument is an array of columns to clear.  If no second argument is passed, the entire row is deleted.
     * If no where argument is passed, the entire table is dropped
     *
     * Examples:
     * ```ts
     * .query("delete",['balance']) //Clear the contents of the balance column on ALL rows.
     * .query("delete",['comments']).where(["accountType","=","spammer"]) // If a where statment is passed you'll only clear the columns of the rows selected by the where statement.
     * .query("delete").where(["balance","<",0]) // remove all rows with a balance less than zero
     * .query("delete") // Same as drop statement
     * ```
     *
     * ### Drop
     *
     * Drop is used to completely clear the contents of a database.  There are no arguments.
     *
     * Drop Examples:
     * ```ts
     * .query("drop")
     * ```
     *
     * @param {("select"|"upsert"|"delete"|"drop")} action
     * @param {any} [args]
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    query(action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe" | "toColumn" | "toRow", args?: any): _NanoSQLQuery;
    onConnected(callback: () => void): void;
    /**
     * Trigger a database event
     *
     * @param {DatabaseEvent} eventData
     *
     * @memberOf NanoSQLInstance
     */
    triggerEvent(eventData: DatabaseEvent): NanoSQLInstance;
    /**
     * Returns a default object for the current table's data model, useful for forms.
     *
     * The optional argument lets you pass in an object to over write the data model's defaults as desired.
     *
     * Examples:
     *
     * ```ts
     * console.log(NanoSQL("users").default()) <= {username:"none", id:undefined, age: 0}
     * console.log(NanoSQL("users").default({username:"defalt"})) <= {username:"default", id:undefined, age: 0}
     * ```
     *
     * DO NOT use this inside upsert commands like `.query("upsert",NanoSQL("users").defalt({userObj}))..`.
     * The database defaults are already applied through the upsert path, you'll be doing double work.
     *
     * Only use this to pull default values into a form in your UI or similar situation.
     *
     * @param {*} [replaceObj]
     * @returns {{[key: string]: any}}
     *
     * @memberOf NanoSQLInstance
     */
    default(replaceObj?: any): {
        [key: string]: any;
    };
    /**
     * Get the raw contents of the database, provides all tables.
     *
     * Optionally pass in the tables to export.  If no tables are provided then all tables will be dumped.
     *
     * @returns
     * @memberof NanoSQLInstance
     */
    rawDump(tables?: string[]): any;
    /**
     * Import table data directly into the datatabase.
     * Signifincatly faster than .loadJS but doesn't do type checking, indexing or anything else fancy.
     *
     * @param {{[table: string]: DBRow[]}} tables
     * @returns
     * @memberof NanoSQLInstance
     */
    rawImport(tables: {
        [table: string]: DBRow[];
    }, onProgress?: (percent: number) => void): Promise<any>;
    /**
     * Request disconnect from all databases.
     *
     * @returns
     * @memberof NanoSQLInstance
     */
    disconnect(): Promise<any[]>;
    /**
     * Executes a transaction against the database, batching all the queries together.
     *
     * @param {((
     *         db: (table?: string) => {
     *             query: (action: "select"|"upsert"|"delete"|"drop"|"show tables"|"describe", args?: any) => _NanoSQLTransactionQuery;
     *             updateORM: (action: "add"|"delete"|"drop"|"set", column?: string, relationIDs?: any[]) => _NanoSQLTransactionORMQuery|undefined;
     *         }, complete: () => void) => void)} initTransaction
     * @returns {Promise<any>}
     *
     * @memberof NanoSQLInstance
     */
    doTransaction(initTransaction: (db: (table?: string) => {
        query: (action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe", args?: any) => _NanoSQLTransactionQuery;
    }, complete: () => void) => void): Promise<any>;
    /**
     * Configure the database driver, must be called before the connect() method.
     *
     * @param {any} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    config(args: NanoSQLConfig): NanoSQLInstance;
    /**
     * Init obvserable query.
     *
     * Usage:
     * ```ts
     * nSQL()
     * .observable(() => nSQL("message").query("select").emit())
     * .filter((rows, idx) => rows.length > 0)
     * .subscribe((rows, event) => {
     *
     * });
     *
     * ```
     *
     * @template T
     * @param {((ev?: DatabaseEvent) => IdbQueryExec|undefined)} getQuery
     * @param {string[]} [tablesToListen]
     * @returns {Observer<T>}
     * @memberof NanoSQLInstance
     */
    observable<T>(getQuery: (ev?: DatabaseEvent) => IdbQueryExec | undefined, tablesToListen?: string[]): Observer<T>;
    /**
     * Perform a custom action supported by the database driver.
     *
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf NanoSQLInstance
     */
    extend(...args: any[]): any | NanoSQLInstance;
    /**
     * Load JSON directly into the DB.
     * JSON must be an array of maps, like this:
     * ```ts
     * [
     *  {"name":"billy","age":20},
     *  {"name":"johnny":"age":30}
     * ]
     * ```
     *
     * Rows must align with the data model.  Row data that isn't in the data model will be ignored.
     *
     * @param {string} table
     * @param {Array<Object>} rows
     * @returns {Promise<Array<Object>>}
     *
     * @memberOf NanoSQLInstance
     */
    loadJS(table: string, rows: Array<any>, useTransaction?: boolean, onProgress?: (percent: number) => void): Promise<Array<any>>;
    /**
     * Convert a JSON array of objects to a CSV.
     *
     * @param {any[]} json
     * @param {boolean} [printHeaders]
     * @param {string[]} [useHeaders]
     * @returns {string}
     * @memberof NanoSQLInstance
     */
    JSONtoCSV(json: any[], printHeaders?: boolean, useHeaders?: string[]): string;
    /**
     * Convert a CSV to array of JSON objects
     *
     * @param {string} csv
     * @param {(row: any) => any} [rowMap]
     * @returns {*}
     * @memberof NanoSQLInstance
     */
    CSVtoJSON(csv: string, rowMap?: (row: any) => any): any;
    /**
     * Load a CSV file into the DB.  Headers must exist and will be used to identify what columns to attach the data to.
     *
     * This function performs a bunch of upserts, so expect appropriate behavior based on the primary key.
     *
     * Rows must align with the data model.  Row data that isn't in the data model will be ignored.
     *
     * @param {string} csv
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    loadCSV(table: string, csv: string, useTransaction?: boolean, rowMap?: (row: any) => any, onProgress?: (percent: number) => void): Promise<Array<Object>>;
}
export interface DBConnect {
    models: StdObject<DataModel[]>;
    actions: StdObject<ActionOrView[]>;
    views: StdObject<ActionOrView[]>;
    config: StdObject<string>;
    parent: NanoSQLInstance;
}
/**
 * The interface for plugins used by NanoSQL
 * Current plugins include History and the default storage system.
 *
 * @export
 * @interface NanoSQLPlugin
 */
export interface NanoSQLPlugin {
    getId?: () => string;
    /**
     * Called before database connection with all the connection arguments, including data models and what not.
     * Lets you adjust the connect arguments, add tables, remove tables, adjust data models, etc.
     *
     * @memberof NanoSQLPlugin
     */
    willConnect?: (connectArgs: DBConnect, next: (connectArgs: DBConnect) => void) => void;
    /**
     * Called after connection, changes to the connectArgs won't have any affect on the database but can still be read.
     *
     * @memberof NanoSQLPlugin
     */
    didConnect?: (connectArgs: DBConnect, next: () => void) => void;
    /**
     *  Called when the user requests the database perform a disconnect action.
     *
     * @memberof NanoSQLPlugin
     */
    willDisconnect?: (next: () => void) => void;
    /**
     * Called when a query is sent through the system, once all plugins are called the query resullt is sent to the user.
     *
     * @memberof NanoSQLPlugin
     */
    doExec?: (execArgs: IdbQuery, next: (execArgs: IdbQuery) => void, error: (err: Error) => void) => void;
    /**
     * Called after the query is done, allows you to modify the event data before the event is emmited
     *
     * @memberof NanoSQLPlugin
     */
    didExec?: (event: DatabaseEvent, next: (event: DatabaseEvent) => void) => void;
    /**
     * Called before a transaction takes place.
     *
     * @memberof NanoSQLPlugin
     */
    transactionBegin?: (id: string, next: () => void) => void;
    /**
     * Called after a transaction completes.
     *
     * @memberof NanoSQLPlugin
     */
    transactionEnd?: (id: string, next: () => void) => void;
    /**
     * Dump the raw contents of all database tables.
     * Optionally provide a list of tables to export, if nothing is provided then all tables should be dumped.
     *
     * @memberof NanoSQLPlugin
     */
    dumpTables?: (tables?: string[]) => Promise<{
        [tableName: string]: DBRow[];
    }>;
    /**
     * Import tables directly into the database without any type checking, indexing or anything else fancy.
     *
     * @memberof NanoSQLPlugin
     */
    importTables?: (tables: {
        [tableName: string]: DBRow[];
    }, onProgress: (percent: number) => void) => Promise<any>;
    /**
     * Generic for other misc functions, called when ".extend()" is used.
     *
     * @memberof NanoSQLPlugin
     */
    extend?: (next: (args: any[], result: any[]) => void, args: any[], result: any[]) => void;
}
export declare const nSQL: (setTablePointer?: string | any[] | undefined) => NanoSQLInstance;
