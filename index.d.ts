import { TSMap } from "typescript-map";
import { TSPromise } from "typescript-promise";
/**
 * This is the format used for actions and views
 *
 * @export
 * @interface ActionOrView
 */
export interface ActionOrView {
    name: string;
    args?: Array<string>;
    call: (args?: Object) => TSPromise<any>;
}
/**
 * You need an array of these to declare a data model.
 *
 * @export
 * @interface DataModel
 */
export interface DataModel {
    key: string;
    type: "string" | "int" | "float" | "array" | "map" | "bool";
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
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class SomeSQLInstance
 */
export declare class SomeSQLInstance {
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
    on(actions: "change" | "delete" | "upsert" | "drop" | "select" | "error", callBack: Function): SomeSQLInstance;
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
     * ```
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
     * ```
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
     * ```
     * SomeSQL("users").getView("view-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     *
     * ```
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
     * ```
     * SomeSQL("users").getView('view-name',{foo:"bar"}).then(function(result) {
     *  console.log(result) <== view result.
     * })
     * ```
     *
     * @param {string} viewName
     * @param {Object} viewArgs
     * @returns {(TSPromise<Object | string>)}
     *
     * @memberOf SomeSQLInstance
     */
    getView(viewName: string, viewArgs: Object): TSPromise<Object | string>;
    /**
     * Declare the actions for the current selected table.  Must be called before connect()
     *
     * Actions are created like this:
     * ```
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
     * ```
     * SomeSQL("users").doAction("action-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     * ```
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
     * ```
     * SomeSQL("users").doAction('action-name',{foo:"bar"}).then(function(result) {
     *      console.log(result) <== result of your action
     * });
     * ```
     *
     * @param {string} actionName
     * @param {Object} actionArgs
     * @returns {(TSPromise<Object | string>)}
     *
     * @memberOf SomeSQLInstance
     */
    doAction(actionName: string, actionArgs: Object): TSPromise<Object | string>;
    /**
     * Add a filter to the usable list of filters for this database.  Must be called BEFORE connect().
     * Example:
     *
     * ```
     *  SomeSQL().addFilter('addOne',function(rows) {
     *  return rows.map((row) => row.balance + 1);
     * })
     * ```
     *
     * Then to use it in a query:
     * ```
     * SomeSQL("users").query("select").filter('addOne').exec();
     * ```
     *
     * @param {string} filterName
     * @param {Function} filterFunction
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    addFilter(filterName: string, filterFunction: Function): SomeSQLInstance;
    /**
     * Start a query into the current selected table.
     * Possibl querys are "select", "upsert", "delete", and "drop";
     *
     * Select is used to pull a set of rows or other data from the table.
     * When you use select the optional second argument of the query is an array of strings that allow you to show only specific columns.
     *
     * Select examples:
     * ```
     * .query("select") // No arguments, select all columns
     * .query("select",['username']) // only get the username column
     * .query("select",["username","balance"]) //Get two columns, username and balance.
     * ```
     * Upsert is used to add data into the database.
     * If the primary key rows are null or undefined, the data will always be added. Otherwise, you might be updating existing rows.
     * The second argument of the query with upserts is always an Object of the data to upsert.
     *
     * Upsert Examples:
     * ```
     * .query("upsert",{id:1,username:"Scott"}) //Set username to "Scott" where the row ID is 1.
     * .query("upsert",{username:"Scott"}) //Add a new row to the db with this username in the row.  Optionally, if you use a WHERE statement this data will be applied to the rows found with the where statement.
     * ```
     *
     * Delete is used to remove data from the database.
     * It works exactly like select, except it removes data instead of selecting it.  The second argument is an array of columns to clear.  If no second argument is passed, the database is dropped.
     *
     * Delete Examples:
     * ```
     * .query("delete",['balance']) //Clear the contents of the balance column.  If a where statment is passed you'll only clear the columns of the rows selected by the where statement.
     * ```
     * Drop is used to completely clear the contents of a database.  There are no arguments.
     *
     * Drop Examples:
     * ```
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
     * ```
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
     * ```
     * .orderBy({username:"asc"}) // order by username column, ascending
     * .orderBy({balance:"desc",lastName:"asc"}) // order by balance descending, then lastName ascending.
     * ```
     *
     * @param {Object} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    orderBy(args: Object): SomeSQLInstance;
    /**
     * Limits the result to a specific amount.  Example:
     *
     * ```
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
     * ```
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
     * The memory DB supports sum, first, last, min, max, average, and count
     *
     * Example:
     * ```
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
     * Executes the current pending query to the db engine.
     *
     * @returns {(TSPromise<Array<Object | string>>)}
     *
     * @memberOf SomeSQLInstance
     */
    exec(): TSPromise<Array<Object | string>>;
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
     * ```
     * [
     *  {"name":"billy","age":20},
     *  {"name":"johnny":"age":30}
     * ]
     * ```
     *
     * @param {Array<Object>} rows
     * @returns {(TSPromise<Object | string>)}
     *
     * @memberOf SomeSQLInstance
     */
    loadJS(rows: Array<Object>): TSPromise<Object | string>;
    /**
     * Load a CSV file into the DB.  Headers must exist and will be used to identify what columns to attach the data to.
     *
     * This function performs a bunch of upserts, so expect appropriate behavior based on the primary key.
     *
     * @param {string} csv
     * @returns {(TSPromise<Object | string>)}
     *
     * @memberOf SomeSQLInstance
     */
    loadCSV(csv: string): TSPromise<Object | string>;
    /**
     * Export the current query to a CSV file.
     *
     * @param {boolean} [headers]
     * @returns {TSPromise<string>}
     *
     * @memberOf SomeSQLInstance
     */
    toCSV(headers?: boolean): TSPromise<string>;
    /**
     * Generate a Psudo Random UUID
     * Stolen shamelessly from http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
     *
     * @static
     * @param {string} [inputUUID]
     * @returns {string}
     *
     * @memberOf SomeSQLInstance
     */
    static uuid(inputUUID?: string): string;
    /**
     * Generate a unique hash from a given string.  The same string will always return the same hash.
     * Stolen shamelessly from http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
     *
     * @static
     * @param {string} str
     * @returns {string}
     *
     * @memberOf SomeSQLInstance
     */
    static hash(str: string): string;
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
     * @param {TSMap<string, Array<Object>>} models
     * @param {TSMap<string, Array<ActionOrView>>} actions
     * @param {TSMap<string, Array<ActionOrView>>} views
     * @param {TSMap<string, Function>} filters
     * @param {Array<any>} extendCalls
     * @param {Function} onSuccess
     * @param {Function} [onFail]
     *
     * @memberOf SomeSQLBackend
     */
    connect(models: TSMap<string, Array<Object>>, actions: TSMap<string, Array<ActionOrView>>, views: TSMap<string, Array<ActionOrView>>, filters: TSMap<string, Function>, extendCalls: Array<any>, onSuccess: Function, onFail?: Function): void;
    /**
     * Executes a specific query on the database with a specific table
     *
     * This is called on "exec()" and all the query parameters are passed in as an array of Objects containing the query parameters.
     *
     * The syntax is pretty straightforward, for example a query like this: SomeSQL("users").query("select").exec() will turn into this:
     * [{type:'select',args:undefined}]
     *
     * Let's say the person using the system gets crazy and does SomeSQL("users").query("select",['username']).orderBy({name:'desc'}).exec();
     * Then you get this:
     * [{type:'select',args:['username']},{type:"orderBy",args:{name:'desc}}]
     *
     * With that information and the table name you can create the query as needed, then return it through the onSuccess function.
     *
     * @param {string} table
     * @param {(Array<QueryLine>)} query
     * @param {string} viewOrAction
     * @param {Function} onSuccess
     * @param {Function} [onFail]
     *
     * @memberOf SomeSQLBackend
     */
    exec(table: string, query: Array<QueryLine>, viewOrAction: string, onSuccess: Function, onFail?: Function): void;
    /**
     * Optional extension for the database.
     * The extend method for SomeSQL is just a passthrough to this method.
     * An entirely different and new API can be built around this.
     *
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf SomeSQLBackend
     */
    extend?(...args: Array<any>): any;
}
export declare function SomeSQL(setTablePointer?: string): SomeSQLInstance;
