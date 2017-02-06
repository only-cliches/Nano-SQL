import { TSPromise } from "typescript-promise";
/**
 * Standard object placeholder with string key.
 *
 * @export
 * @interface StdObject
 * @template T
 */
export interface StdObject<T> {
    [key: string]: T;
}
/**
 * This is the format used for actions and views
 *
 * @export
 * @interface ActionOrView
 */
export interface ActionOrView {
    name: string;
    args?: Array<string>;
    extend?: any;
    call: (args?: {
        [key: string]: any;
    }, db?: SomeSQLInstance) => TSPromise<any>;
}
/**
 * You need an array of these to declare a data model.
 *
 * @export
 * @interface DataModel
 */
export interface DataModel {
    key: string;
    type: "string" | "int" | "float" | "array" | "map" | "bool" | string;
    default?: any;
    props?: Array<any>;
}
/**
 * Used to represent a single query command.
 *
 * @export
 * @interface QueryLine
 */
export interface QueryLine {
    type: string;
    args?: any;
}
/**
 * Returned by the event listener when it's called.
 *
 * @export
 * @interface DatabaseEvent
 */
export interface DatabaseEvent {
    table: string;
    query: Array<QueryLine>;
    time: number;
    result: Array<any>;
    name: "change" | "delete" | "upsert" | "drop" | "select" | "error";
    actionOrView: string;
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
    type: "left" | "inner" | "right" | "cross";
    table: string;
    where: Array<string>;
}
export interface DBRow {
    [key: string]: any;
}
/**
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class SomeSQLInstance
 */
export declare class SomeSQLInstance {
    /**
     * Most recent selected table.
     *
     * @type {string}
     * @memberOf SomeSQLInstance
     */
    activeTable: string;
    /**
     * The backend currently being used
     *
     * @public
     * @type {SomeSQLBackend}
     * @memberOf SomeSQLInstance
     */
    backend: SomeSQLBackend;
    /**
     * Holds custom filters implimented by the user
     *
     * @private
     *
     * @memberOf SomeSQLInstance
     */
    private _filters;
    constructor();
    /**
     * Changes the table pointer to a new table.
     *
     * @param {string} [table]
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    table(table?: string): SomeSQLInstance;
    /**
     * Inits the backend database for use.
     *
     * @param {SomeSQLBackend} [backend]
     * @returns {(TSPromise<Object | string>)}
     *
     * @memberOf SomeSQLInstance
     */
    connect(backend?: SomeSQLBackend): TSPromise<Object | string>;
    /**
     * Adds an event listener to the selected database table.
     *
     * @param {("change"|"delete"|"upsert"|"drop"|"select"|"error")} actions
     * @param {Function} callBack
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    on(actions: "change" | "delete" | "upsert" | "drop" | "select" | "error", callBack: (event: DatabaseEvent, database: SomeSQLInstance) => void): SomeSQLInstance;
    /**
     * Remove a specific event handler from being triggered anymore.
     *
     * @param {Function} callBack
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    off(callBack: Function): SomeSQLInstance;
    /**
     * Set a filter to always be applied, on every single query.
     *
     * @param {string} filterName
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    alwaysApplyFilter(filterName: string): SomeSQLInstance;
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
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    model(dataModel: Array<DataModel>): SomeSQLInstance;
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
     *          // SomeSQL will not let any other arguments into this function.
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
     * SomeSQL("users").getView("view-name",{array:'',of:"",arguments:""}).then(function(result) {
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
     * SomeSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
     *
     * @param {Array<ActionOrView>} viewArray
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    views(viewArray: Array<ActionOrView>): SomeSQLInstance;
    /**
     * Execute a specific view.  Refernece the "views" function for more description.
     *
     * Example:
     * ```ts
     * SomeSQL("users").getView('view-name',{foo:"bar"}).then(function(result) {
     *  console.log(result) <== view result.
     * })
     * ```
     *
     * @param {string} viewName
     * @param {any} viewArgs
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    getView(viewName: string, viewArgs?: any): TSPromise<Array<Object>>;
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
     *          // SomeSQL will not let any other arguments into this function.
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
     * SomeSQL("users").doAction("action-name",{array:'',of:"",arguments:""}).then(function(result) {
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
     * SomeSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
     *
     * @param {Array<ActionOrView>} actionArray
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    actions(actionArray: Array<ActionOrView>): SomeSQLInstance;
    /**
     * Init an action for the current selected table. Reference the "actions" method for more info.
     *
     * Example:
     * ```ts
     * SomeSQL("users").doAction('action-name',{foo:"bar"}).then(function(result) {
     *      console.log(result) <== result of your action
     * });
     * ```
     *
     * @param {string} actionName
     * @param {any} actionArgs
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    doAction(actionName: string, actionArgs?: any): TSPromise<Array<Object>>;
    /**
     * Add a filter to the usable list of filters for this database.  Must be called BEFORE connect().
     * Example:
     *
     * ```ts
     * SomeSQL().addFilter('addBalance',function(rows) {
     *      return rows.map((row) => row.balance + 1);
     * })
     * ```
     *
     * Then to use it in a query:
     * ```ts
     * SomeSQL("users").query("select").filter('addOne').exec();
     * ```
     *
     * @param {string} filterName
     * @param {(rows: Array<Object>) => Array<Object>} filterFunction
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    addFilter(filterName: string, filterFunction: (rows: Array<Object>) => Array<Object>): SomeSQLInstance;
    /**
     * Start a query into the current selected table.
     * Possibl querys are "select", "upsert", "delete", and "drop";
     *
     * Select is used to pull a set of rows or other data from the table.
     * When you use select the optional second argument of the query is an array of strings that allow you to show only specific columns.
     *
     * Select examples:
     * ```ts
     * .query("select") // No arguments, select all columns
     * .query("select",['username']) // only get the username column
     * .query("select",["username","balance"]) //Get two columns, username and balance.
     * ```
     * Upsert is used to add data into the database.
     * If the primary key rows are null or undefined, the data will always be added. Otherwise, you might be updating existing rows.
     * The second argument of the query with upserts is always an Object of the data to upsert.
     *
     * Upsert Examples:
     * ```ts
     * .query("upsert",{id:1,username:"Scott"}) //Set username to "Scott" where the row ID is 1.
     * .query("upsert",{username:"Scott"}) //Add a new row to the db with this username in the row.  Optionally, if you use a WHERE statement this data will be applied to the rows found with the where statement.
     * ```
     *
     * Delete is used to remove data from the database.
     * It works exactly like select, except it removes data instead of selecting it.  The second argument is an array of columns to clear.  If no second argument is passed, the database is dropped.
     *
     * Delete Examples:
     * ```ts
     * .query("delete",['balance']) //Clear the contents of the balance column.  If a where statment is passed you'll only clear the columns of the rows selected by the where statement.
     * ```
     * Drop is used to completely clear the contents of a database.  There are no arguments.
     *
     * Drop Examples:
     * ```ts
     * .query("drop")
     * ```
     *
     * @param {("select"|"upsert"|"delete"|"drop")} action
     * @param {Object} [args]
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    query(action: "select" | "upsert" | "delete" | "drop", args?: Object): SomeSQLInstance;
    /**
     * Used to select specific rows based on a set of conditions.
     * You can pass in a single array with a conditional statement or an array of arrays seperated by "and", "or" for compound selects.
     * A single where statement has the column name on the left, an operator in the middle, then a comparison on the right.
     *
     * Where Examples:
     *
     * ```ts
     * .where(['username','=','billy'])
     * .where(['balance','>',20])
     * .where(['catgory','IN',['jeans','shirts']])
     * .where([['name','=','scott'],'and',['balance','>',200]])
     * .where([['id','>',50],'or',['postIDs','IN',[12,20,30]],'and',['name','LIKE','Billy']])
     * ```
     *
     * @param {(Array<any|Array<any>>)} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    where(args: Array<any | Array<any>>): SomeSQLInstance;
    /**
     * Order the results by a given column or columns.
     *
     * Examples:
     *
     * ```ts
     * .orderBy({username:"asc"}) // order by username column, ascending
     * .orderBy({balance:"desc",lastName:"asc"}) // order by balance descending, then lastName ascending.
     * ```
     *
     * @param {Object} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    orderBy(args: {
        [key: string]: "asc" | "desc";
    }): SomeSQLInstance;
    /**
     * Join command.
     *
     * Example:
     *
     * ```ts
     *  SomeSQL("orders").query("select",["orders.id","orders.title","users.name"]).join({
     *      type:"inner",
     *      query:SomeSQL("users").query("select").exec(),
     *      where:["orders.customerID","=","user.id"]
     *  }).exec();
     *
     * A few notes on the join command:
     * 1. You muse use dot notation and both tables in all "where" and "select" arguments
     * 2. The initial "select" command lets you set what columns will appear in the final query.
     * 3. The "query" argument lets you determine the data on the right side of the join.
     * 4. The "where" argument lets you set what conditions the tables are joined on.
     *
     * ```
     *
     * @param {JoinArgs} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    join(args: JoinArgs): SomeSQLInstance;
    /**
     * Limits the result to a specific amount.  Example:
     *
     * ```ts
     * .limit(20) // Limit to the first 20 results
     * ```
     *
     * @param {number} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    limit(args: number): SomeSQLInstance;
    /**
     * Offsets the results by a specific amount from the beginning.  Example:
     *
     * ```ts
     * .offset(10) //Skip the first 10 results.
     * ```
     *
     * @param {number} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    offset(args: number): SomeSQLInstance;
    /**
     * Adds a custom filter to the query.  The filter you use MUST be supported by the database driver OR a custom filter you provided before the connect method was called.
     * The built in memory DB supports sum, min, max, average, and count
     *
     * Example:
     * ```ts
     * //get number of results
     * SomeSQL("users").query("select").filter('count').exec();
     * ```
     *
     * @param {string} name
     * @param {*} [args]
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    filter(name: string, args?: any): SomeSQLInstance;
    /**
     * Trigger a database event
     *
     * @param {DatabaseEvent} eventData
     *
     * @memberOf SomeSQLInstance
     */
    triggerEvent(eventData: DatabaseEvent, triggerEvents: Array<string>): void;
    /**
     * Executes the current pending query to the db engine.
     *
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    exec(): TSPromise<Array<Object>>;
    /**
     * Configure the database driver, must be called before the connect() method.
     *
     * @param {any} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    config(args: any): SomeSQLInstance;
    /**
     * Perform a custom action supported by the database driver.
     *
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf SomeSQLInstance
     */
    extend(...args: Array<any>): any | SomeSQLInstance;
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
     * @param {Array<Object>} rows
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    loadJS(rows: Array<Object>): TSPromise<Array<Object>>;
    /**
     * Load a CSV file into the DB.  Headers must exist and will be used to identify what columns to attach the data to.
     *
     * This function performs a bunch of upserts, so expect appropriate behavior based on the primary key.
     *
     * @param {string} csv
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    loadCSV(csv: string): TSPromise<Array<Object>>;
    /**
     * Export the current query to a CSV file.
     *
     * @param {boolean} [headers]
     * @returns {TSPromise<string>}
     *
     * @memberOf SomeSQLInstance
     */
    toCSV(headers?: boolean): TSPromise<string>;
}
/**
 * This object is passed into a the database connect function to activate it.
 *
 * @export
 * @interface DBConnect
 */
export interface DBConnect {
    _models: StdObject<Array<DataModel>>;
    _actions: StdObject<Array<ActionOrView>>;
    _views: StdObject<Array<ActionOrView>>;
    _filters: {
        [key: string]: (rows: Array<DBRow>) => Array<DBRow>;
    };
    _extendCalls: Array<any>;
    _parent: SomeSQLInstance;
    _onSuccess: Function;
    _onFail?: Function;
}
/**
 * These variables are passed into the database execution function.
 *
 * @export
 * @interface DBExec
 */
export interface DBExec {
    _table: string;
    _query: Array<QueryLine>;
    _viewOrAction: string;
    _onSuccess: (rows: Array<Object>) => void;
    _onFail: (rows: Array<Object>) => void;
}
export interface SomeSQLBackend {
    /**
     * Inilitize the database for use, async so you can connect to remote stuff as needed.
     *
     * This is called by SomeSQL once to the DB driver once the developer calls "connect()".
     *
     * Models, Views, Actions, and added Filters are all sent in at once.  Once the "onSuccess" function is called the database should be ready to use.
     *
     * The "preCustom" var contains an array of calls made to the "custom" method before connect() was called.  All subsequent custom() calls will pass directly to the database "custom()" method.
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf SomeSQLBackend
     */
    _connect(connectArgs: DBConnect): void;
    /**
     * Executes a specific query on the database with a specific table
     *
     * This is called on "exec()" and all the query parameters are passed in as an array of Objects containing the query parameters.
     *
     * The syntax is pretty straightforward, for example a query like this: SomeSQL("users").query("select").exec() will turn into this:
     * ```ts
     * [{type:'select',args:undefined}]
     * ```
     *
     * Let's say the person using the system gets crazy and does SomeSQL("users").query("select",['username']).orderBy({name:'desc'}).exec();
     * Then you get this:
     * ```ts
     * [{type:'select',args:['username']},{type:"orderBy",args:{name:'desc}}]
     * ```
     *
     * With that information and the table name you can create the query as needed, then return it through the onSuccess function.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf SomeSQLBackend
     */
    _exec(execArgs: DBExec): void;
    /**
     * Optional extension for the database.
     * The extend method for SomeSQL is just a passthrough to this method.
     * An entirely different and new API can be built around this.
     *
     * @param {SomeSQLInstance} instance
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf SomeSQLBackend
     */
    _extend?(instance: SomeSQLInstance, ...args: Array<any>): any;
}
export declare function SomeSQL(setTablePointer?: string): SomeSQLInstance;
