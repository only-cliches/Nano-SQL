import { Promise } from "lie-ts";
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
 * Custom functinos for the database.
 *
 * @export
 * @interface DBFunction
 */
export interface DBFunction {
    call: (row: DBRow, args: string[], ptr: number[], prev?: any) => DBRow[];
    type: "aggregate" | "simple";
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
    call: (args?: any, db?: NanoSQLInstance) => Promise<any>;
}
/**
 * You need an array of these to declare a data model.
 *
 * @export
 * @interface DataModel
 */
export interface DataModel {
    key: string;
    type: "string" | "int" | "float" | "array" | "map" | "bool" | "uuid" | "blob" | string;
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
    changeType: string;
    changedRows: DBRow[];
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
 *  A single database row.
 *
 * @export
 * @interface DBRow
 */
export interface DBRow {
    [key: string]: any;
}
export declare const _assign: (obj: any) => any;
/**
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class NanoSQLInstance
 */
export declare class NanoSQLInstance {
    /**
     * Most recent selected table.
     *
     * @type {string}
     * @memberOf NanoSQLInstance
     */
    activeTable: string;
    /**
     * The backend currently being used
     *
     * @public
     * @type {NanoSQLBackend}
     * @memberOf NanoSQLInstance
     */
    backend: NanoSQLBackend;
    /**
     * Stores wether each table has events attached to it or not.
     *
     * @private
     * @type {StdObject<boolean>}
     * @memberOf NanoSQLInstance
     */
    private _hasEvents;
    /**
     * Holds custom filters implimented by the user
     *
     * @private
     *
     * @memberOf NanoSQLInstance
     */
    private _functions;
    constructor();
    /**
     * Changes the table pointer to a new table.
     *
     * @param {string} [table]
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    table(table?: string): NanoSQLInstance;
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
    connect(backend?: NanoSQLBackend): Promise<Object | string>;
    /**
     * Adds an event listener to the selected database table.
     *
     * @param {("change"|"delete"|"upsert"|"drop"|"select"|"error")} actions
     * @param {Function} callBack
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    on(actions: "change" | "delete" | "upsert" | "drop" | "select" | "error", callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance;
    /**
     * Remove a specific event handler from being triggered anymore.
     *
     * @param {Function} callBack
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    off(callBack: Function): NanoSQLInstance;
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
    model(dataModel: Array<DataModel>): NanoSQLInstance;
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
    views(viewArray: Array<ActionOrView>): NanoSQLInstance;
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
    getView(viewName: string, viewArgs?: any): Promise<Array<Object>>;
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
    doAction(actionName: string, actionArgs?: any): Promise<Array<Object>>;
    /**
     * Add a function to the usable list of functions for this database.  Must be called BEFORE connect().
     *
     * Functions can be used with any database on the attached store.
     *
     * Example:
     *
     * ```ts
     * NanoSQL().newFunction('ADD',{ // Function is called "ADD"
     *  type:"simple", // "aggregate" or "simple"
     *  call:function(row:DBRow, args: string[], ptr: number[], prev: any) {
     *      // arguments are passed in as an array in the args argument.
     *      // ptr is an array that lets you know the length and position of the current query.
     *      // ptr[0] is the current index, ptr[1] is the max index/length
     *      // prev is only used for aggregate functions, lets  you pass an argument into the next function call.
     *      let r = JSON.parse(JSON.stringify(row));
     *      r.ADD = args.reduce((a, b) => parseFloat(a) + parseFloat(b));
     *      return r;
     *  }
     * });
     * ```
     *
     * Then to use it in a query:
     * ```ts
     * NanoSQL("users").query("select",["name","ADD(balance, 2)"]).exec();
     * ```
     *
     * Make sure the calculated value is add to the row(s) with the `useKey` argument, otherwise `AS` arguments won't work.
     *
     * @param {string} filterName
     * @param {(rows: Array<Object>) => Array<Object>} filterFunction
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    newFunction(functionName: string, functionType: "aggregate" | "simple", filterFunction: (row: DBRow, args: string[], ptr: number[], prev?: any) => DBRow[]): NanoSQLInstance;
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
    query(action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe", args?: any): NanoSQLInstance;
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    where(args: Array<any | Array<any>>): NanoSQLInstance;
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    orderBy(args: {
        [key: string]: "asc" | "desc";
    }): NanoSQLInstance;
    /**
     * Group By command, typically used with an aggregate function.
     *
     * Example:
     *
     * ```ts
     * NanoSQL("users").query("select",["favoriteColor","count(*)"]).groupBy({"favoriteColor":"asc"}).exec();
     * ```
     *
     * This will provide a list of all favorite colors and how many each of them are in the db.
     *
     * @param {({[key: string]:"asc"|"desc"})} columns
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    groupBy(columns: {
        [key: string]: "asc" | "desc";
    }): NanoSQLInstance;
    /**
     * Having statement, used to filter Group BY statements. Syntax is identical to where statements.
     *
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    having(args: Array<any | Array<any>>): NanoSQLInstance;
    /**
     * Join command.
     *
     * Example:
     *
     * ```ts
     *  NanoSQL("orders")
     *  .query("select", ["orders.id","orders.title","users.name"])
     *  .where(["orders.status","=","complete"])
     *  .orderBy({"orders.date":"asc"})
     *  .join({
     *      type:"inner",
     *      table:"users",
     *      where:["orders.customerID","=","user.id"]
     *  }).exec();
     *```
     * A few notes on the join command:
     * 1. You muse use dot notation with the table names in all "where", "select", "orderby", and "groupby" arguments.
     * 2. Possible join types are `inner`, `left`, `right`, and `outer`.
     * 3. The "table" argument lets you determine the data on the right side of the join.
     * 4. The "where" argument lets you set what conditions the tables are joined on.
     *
     *
     *
     * @param {JoinArgs} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    join(args: JoinArgs): NanoSQLInstance;
    /**
     * Limits the result to a specific amount.  Example:
     *
     * ```ts
     * .limit(20) // Limit to the first 20 results
     * ```
     *
     * @param {number} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    limit(args: number): NanoSQLInstance;
    /**
     * Offsets the results by a specific amount from the beginning.  Example:
     *
     * ```ts
     * .offset(10) // Skip the first 10 results.
     * ```
     *
     * @param {number} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    offset(args: number): NanoSQLInstance;
    /**
     * Trigger a database event
     *
     * @param {DatabaseEvent} eventData
     *
     * @memberOf NanoSQLInstance
     */
    triggerEvent(eventData: DatabaseEvent, triggerEvents: Array<string>): void;
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
     * Start a database transaction, useful for importing large amounts of data.
     *
     *
     * @memberOf NanoSQLInstance
     */
    beginTransaction(): void;
    /**
     * End a database transaction.
     *
     *
     * @memberOf NanoSQLInstance
     */
    endTransaction(): void;
    /**
     * Executes the current pending query to the db engine, returns a promise with the rows as objects in an array.
     * The second argument of the promise is always the NanoSQL variable, allowing you to chain commands.
     *
     * Example:
     * NanoSQL("users").query("select").exec().then(function(rows, db) {
     *     console.log(rows) // <= [{id:1,username:"Scott",password:"1234"},{id:2,username:"Jeb",password:"1234"}]
     *     return db.query("upsert",{password:"something more secure"}).where(["id","=",1]).exec();
     * }).then(function(rows, db) {
     *  ...
     * })...
     *
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    exec(): Promise<Array<Object | NanoSQLInstance>>;
    /**
     * Configure the database driver, must be called before the connect() method.
     *
     * @param {any} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    config(args: any): NanoSQLInstance;
    /**
     * Perform a custom action supported by the database driver.
     *
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf NanoSQLInstance
     */
    extend(...args: Array<any>): any | NanoSQLInstance;
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
     * @param {Array<Object>} rows
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    loadJS(rows: Array<Object>): Promise<Array<Object>>;
    /**
     * Adds a filter to rows going into the database, allows you to control the range and type of inputs.
     *
     * This function will be called on every upsert and you'll recieve the upsert data as it's being passed in.
     *
     * NanoSQL will apply the "default" row data to each column and type cast each column BEFORE calling this function.
     *
     * @param {(row: object) => object} callBack
     *
     * @memberOf NanoSQLInstance
     */
    rowFilter(callBack: (row: any) => any): this;
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
    loadCSV(csv: string): Promise<Array<Object>>;
    /**
     * RFC4122 compliant UUID v4, 9 randomly generated 16 bit numbers.
     *
     * @static
     * @returns {string}
     *
     * @memberOf NanoSQLInstance
     */
    static uuid(): string;
    /**
     * Export the current query to a CSV file, use in place of "exec()";
     *
     * Example:
     * NanoSQL("users").query("select").toCSV(true).then(function(csv, db) {
     *   console.log(csv);
     *   // Returns something like:
     *   id,name,pass,postIDs
     *   1,"scott","1234","[1,2,3,4]"
     *   2,"jeb","5678","[5,6,7,8]"
     * });
     *
     * @param {boolean} [headers]
     * @returns {Promise<string>}
     *
     * @memberOf NanoSQLInstance
     */
    toCSV(headers?: boolean): Promise<string>;
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
    _functions: {
        [key: string]: DBFunction;
    };
    _config: Array<any>;
    _parent: NanoSQLInstance;
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
    _onSuccess: (rows: Array<Object>, type: string, affectedRows: DBRow[]) => void;
    _onFail: (rows: Array<Object>) => void;
}
export interface NanoSQLBackend {
    /**
     * Inilitize the database for use, async so you can connect to remote stuff as needed.
     *
     * This is called by NanoSQL once to the DB driver once the developer calls "connect()".
     *
     * Models, Views, Actions, and added Filters are all sent in at once.  Once the "onSuccess" function is called the database should be ready to use.
     *
     * The "preCustom" var contains an array of calls made to the "custom" method before connect() was called.  All subsequent custom() calls will pass directly to the database "custom()" method.
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf NanoSQLBackend
     */
    _connect(connectArgs: DBConnect): void;
    /**
     * Executes a specific query on the database with a specific table
     *
     * This is called on "exec()" and all the query parameters are passed in as an array of Objects containing the query parameters.
     *
     * The syntax is pretty straightforward, for example a query like this: NanoSQL("users").query("select").exec() will turn into this:
     * ```ts
     * [{type:'select',args:undefined}]
     * ```
     *
     * Let's say the person using the system gets crazy and does NanoSQL("users").query("select",['username']).orderBy({name:'desc'}).exec();
     * Then you get this:
     * ```ts
     * [{type:'select',args:['username']},{type:"orderBy",args:{name:'desc}}]
     * ```
     *
     * With that information and the table name you can create the query as needed, then return it through the onSuccess function.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf NanoSQLBackend
     */
    _exec(execArgs: DBExec): void;
    /**
     * Optional extension for the database.
     * The extend method for NanoSQL is just a passthrough to this method.
     * An entirely different and new API can be built around this.
     *
     * @param {NanoSQLInstance} instance
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf NanoSQLBackend
     */
    _extend?(instance: NanoSQLInstance, ...args: Array<any>): any;
    /**
     * Let the database driver know it needs to start or end a transaction
     *
     * @param {("start"|"end")} type
     *
     * @memberOf NanoSQLBackend
     */
    _transaction?(type: "start" | "end"): void;
}
export declare const nSQL: (setTablePointer?: string) => NanoSQLInstance;
