import { TSPromise } from "typescript-promise";
import { _SomeSQLImmuDB } from "./immutable-store";
// import { _SomeSQLMemDB } from "./old-memory-db";

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
    call: (args?: any, db?: SomeSQLInstance) => TSPromise<any>;
}

/**
 * You need an array of these to declare a data model.
 *
 * @export
 * @interface DataModel
 */
export interface DataModel {
    key: string;
    type: "string"|"int"|"float"|"array"|"map"|"bool"|"uuid"|string;
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
    name: "change"|"delete"|"upsert"|"drop"|"select"|"error";
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
    type: "left"|"inner"|"right"|"cross";
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
export class SomeSQLInstance {


    /**
     * Holds the current selected table
     *
     * @internal
     * @type {string}
     * @memberOf SomeSQLInstance
     */
    private _selectedTable: string;

    /**
     * Most recent selected table.
     *
     * @type {string}
     * @memberOf SomeSQLInstance
     */
    public activeTable: string;

    /**
     * Holds an array of the query arguments
     *
     * @internal
     * @type {Array<QueryLine>}
     * @memberOf SomeSQLInstance
     */
    private _query: Array<QueryLine>;

    /**
     * The backend currently being used
     *
     * @public
     * @type {SomeSQLBackend}
     * @memberOf SomeSQLInstance
     */
    public backend: SomeSQLBackend;

    /**
     * The callbacks for events
     *
     * @internal
     * @type {StdObject<StdObject<Array<Function>>>}
     * @memberOf SomeSQLInstance
     */
    private _callbacks: StdObject<StdObject<Array<Function>>>;

    /**
     * An array of possible events
     *
     * @internal
     * @type {Array<string>}
     * @memberOf SomeSQLInstance
     */
    private _events: Array<string>;

    /**
     * Holds a map of the current views for this database.
     *
     * @internal
     * @type {StdObject<Array<ActionOrView>>}
     * @memberOf SomeSQLInstance
     */
    private _views: StdObject<Array<ActionOrView>>;

    /**
     * Holds a map of the current actions for this database.
     *
     * @internal
     * @type {StdObject<Array<ActionOrView>>}
     * @memberOf SomeSQLInstance
     */
    private _actions: StdObject<Array<ActionOrView>>;


    /**
     * A map containing the models
     *
     * @internal
     * @type {StdObject<Array<DataModel>>}
     * @memberOf SomeSQLInstance
     */
    private _models: StdObject<Array<DataModel>>;

    /**
     * An array containing a temporary list of events to trigger
     *
     * @internal
     * @type {Array<"change"|"delete"|"upsert"|"drop"|"select"|"error">}
     * @memberOf SomeSQLInstance
     */
    private _triggerEvents: Array<"change"|"delete"|"upsert"|"drop"|"select"|"error">;

    /**
     * The current action or view being triggered.
     *
     * @internal
     * @type {string}
     * @memberOf SomeSQLInstance
     */
    private _activeActionOrView: string|undefined;

    /**
     * Holds custom filters implimented by the user
     *
     * @private
     *
     * @memberOf SomeSQLInstance
     */
    private _filters: {
        [key: string]:  (rows: Array<DBRow>) => Array<DBRow>
    };

    /**
     * Holds an array of custom commands, this is used if the custom() is used before we connect to the db.
     *
     * @internal
     * @type {Array<Array<any>>}
     * @memberOf SomeSQLInstance
     */
    private _preConnectExtend: Array<Array<any>>;

    /**
     * Holds an array of filters to apply to EVERY query.
     *
     * @internal
     * @type {Array<string>}
     * @memberOf SomeSQLInstance
     */
    private _permanentFilters: Array<string>;

    constructor() {
        let t = this;

        t._actions = {};
        t._views = {};
        t._models = {};
        t._query = [];
        t._preConnectExtend = [];
        t._events = ["change", "delete", "upsert", "drop", "select", "error"];

        t._callbacks = {};
        t._callbacks["*"] = {};
        let i = t._events.length;
        while (i--) {
            t._callbacks["*"][t._events[i]] = [];
        }

        t._filters = {};
        t._permanentFilters = [];
    }


    /**
     * Changes the table pointer to a new table.
     *
     * @param {string} [table]
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    public table(table?: string): SomeSQLInstance {
        if (table) this._selectedTable = table, this.activeTable = table;
        return this;
    }

    /**
     * Inits the backend database for use.
     *
     * Optionally include a custom database driver, otherwise the built in memory driver will be used.
     *
     * @param {SomeSQLBackend} [backend]
     * @returns {(TSPromise<Object | string>)}
     *
     * @memberOf SomeSQLInstance
     */
    public connect(backend?: SomeSQLBackend): TSPromise<Object | string> {
        let t = this;
        t.backend = backend || new _SomeSQLImmuDB();
        return new TSPromise((res, rej) => {
            t.backend._connect({
                _models: t._models,
                _actions: t._actions,
                _views: t._views,
                _filters: t._filters,
                _config: t._preConnectExtend,
                _parent: this,
                _onSuccess: (result: any) => {
                    res(result, t);
                },
                _onFail: (rejected: any) => {
                    if (rej) rej(rejected, t);
                }
            });
        });
    }

    /**
     * Adds an event listener to the selected database table.
     *
     * @param {("change"|"delete"|"upsert"|"drop"|"select"|"error")} actions
     * @param {Function} callBack
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    public on(actions: "change"|"delete"|"upsert"|"drop"|"select"|"error", callBack: (event: DatabaseEvent, database: SomeSQLInstance) => void): SomeSQLInstance {
        let t = this;
        let l = t._selectedTable;
        let i = 0;

        if (!t._callbacks[l]) { // Handle the event handler being called before the database has connected
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }

        let a = actions.split(" ");
        i = a.length;
        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l][a[i]].push(callBack);
            }
        }
        return t;
    }

	/**
	 * Remove a specific event handler from being triggered anymore.
	 *
	 * @param {Function} callBack
	 * @returns {SomeSQLInstance}
	 *
	 * @memberOf SomeSQLInstance
	 */
    public off(callBack: Function): SomeSQLInstance {
        let t = this;
        for (let key in t._callbacks) {
            for (let key2 in t._callbacks[key]) {
                t._callbacks[key][key2].filter((cBs) => {
                    return cBs !== callBack;
                });
            }
        }
        return t;
    }

	/**
	 * Set a filter to always be applied, on every single query.
	 *
	 * @param {string} filterName
	 * @returns {SomeSQLInstance}
	 *
	 * @memberOf SomeSQLInstance
	 */
    public alwaysApplyFilter(filterName: string): SomeSQLInstance {
        if (this._permanentFilters.indexOf(filterName) === -1) {
            this._permanentFilters.push(filterName);
        }
        return this;
    }

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
    public model(dataModel: Array<DataModel>): SomeSQLInstance {
        let t = this;
        let l = t._selectedTable;
        let i = t._events.length;
        if (!t._callbacks[l]) {
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }
        t._models[l] = dataModel;
        t._views[l] = [];
        t._actions[l] = [];
        return t;
    }

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
    public views(viewArray: Array<ActionOrView>): SomeSQLInstance {
        return this._views[this._selectedTable] = viewArray, this;
    }

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
    public getView(viewName: string, viewArgs: any = {}): TSPromise<Array<Object>> {
        let t = this;
        let l = t._selectedTable;
        let selView: ActionOrView | undefined;
        let i = t._views[l].length;
        while (i--) {
            if (t._views[l][i].name === viewName) {
                selView = t._views[l][i];
            }
        }
        if (!selView) throw Error;
        t._activeActionOrView = viewName;
        return selView.call.apply(t, [t._cleanArgs(selView.args ? selView.args : [], viewArgs), t]);
    }

    /**
     * Take an action or view and it's args, then make sure the args comform to the types declared in the model.
     *
     * @internal
     * @param {Array<string>} argDeclarations
     * @param {Object} args
     * @returns {Object}
     *
     * @memberOf SomeSQLInstance
     */
    private _cleanArgs(argDeclarations: Array<string>, args: StdObject<any>): StdObject<any> {
        let t = this;
        let l = t._selectedTable;
        let a: StdObject<any> = {};
        let i = argDeclarations.length ? argDeclarations.length : -1;
        if (i > 0) {
            while (i--) {
                let k2: Array<string> = argDeclarations[i].split(":");
                if (k2.length > 1) {
                    a[k2[0]] = t._cast(k2[1], args[k2[0]] || null);
                } else {
                    a[k2[0]] = args[k2[0]] || null;
                }
            }
        }

        return a;
    }

    /**
     * Cast variables to a specific type.
     *
     * @internal
     * @param {string} type
     * @param {*} val
     * @returns {*}
     *
     * @memberOf SomeSQLInstance
     */
    private _cast(type: string, val: any): any {
        let types: StdObject<any> = {
            "string": String(val),
            "int": parseInt(val),
            "float": parseFloat(val),
            "array": {...val},
            "map": {...val},
            "bool": val === true
        };
        return types[type] || val;
    }

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
    public actions(actionArray: Array<ActionOrView>): SomeSQLInstance {
        return this._actions[this._selectedTable] = actionArray, this;
    }

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
    public doAction(actionName: string, actionArgs: any = {}): TSPromise<Array<Object>> {
        let t = this;
        let l = t._selectedTable;
        let selAction: ActionOrView | undefined;
        let i = t._actions[l].length;
        while (i--) {
            if (t._actions[l][i].name === actionName) {
                selAction = t._actions[l][i];
            }
        }
        if (!selAction) throw Error;
        t._activeActionOrView = actionName;
        return selAction.call.apply(t, [t._cleanArgs(selAction.args ? selAction.args : [], actionArgs), t]);
    }

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
    public addFilter(filterName: string, filterFunction: (rows: Array<Object>) => Array<Object>): SomeSQLInstance {
        return this._filters[filterName] = filterFunction, this;
    }

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
     * It works exactly like select, except it removes data instead of selecting it.  The second argument is an array of columns to clear.  If no second argument is passed, the database is dropped.
     *
     * Examples:
     * ```ts
     * .query("delete",['balance']) //Clear the contents of the balance column on ALL rows.
     * .query("delete",['comments']).where(["accountType","=","spammer"]) // If a where statment is passed you'll only clear the columns of the rows selected by the where statement.
     * .query("delete") // same as drop statement
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
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    public query(action: "select"|"upsert"|"delete"|"drop", args?: any): SomeSQLInstance {
        this._query = [];
        let a = action.toLowerCase();
        if (["select", "upsert", "delete", "drop"].indexOf(a) !== -1) {
            this._query.push({type: a, args: args});
        } else {
            throw Error;
        }
        return this;
    }

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
    public where(args: Array<any|Array<any>>): SomeSQLInstance {
        return this._addCmd("where", args);
    }

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
    public orderBy(args: {[key: string]: "asc"|"desc"}): SomeSQLInstance {
        return this._addCmd("orderby", args);
    }

    /**
     * Join command.
     *
     * Example:
     *
     * ```ts
     *  SomeSQL("orders").query("select",["orders.id","orders.title","users.name"]).join({
     *      type:"inner",
     *      table:"users",
     *      where:["orders.customerID","=","user.id"]
     *  }).exec();
     *
     * A few notes on the join command:
     * 1. You muse use dot notation and both tables in all "where", "select", and "orderby" arguments
     * 2. The "table" argument lets you determine the data on the right side of the join.
     * 3. The "where" argument lets you set what conditions the tables are joined on.
     *
     * ```
     *
     * @param {JoinArgs} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    public join(args: JoinArgs): SomeSQLInstance {
        return this._addCmd("join", args);
    }

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
    public limit(args: number): SomeSQLInstance {
        return this._addCmd("limit", args);
    }

    /**
     * Offsets the results by a specific amount from the beginning.  Example:
     *
     * ```ts
     * .offset(10) // Skip the first 10 results.
     * ```
     *
     * @param {number} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    public offset(args: number): SomeSQLInstance {
        return this._addCmd("offset", args);
    }

    /**
     * Adds a custom filter to the query.  The filter you use MUST be supported by the database driver OR a custom filter you provided before the connect method was called.
     * The built in memory DB supports sum, min, max, average, and count
     *
     * Example:
     * ```ts
     * //get number of rows
     * SomeSQL("users").query("select").filter("count"").exec().then(function(rows) {
     *  console.log(rows) // <= [{count:300}]
     * });
     * ```
     *
     * @param {string} name
     * @param {*} [args]
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    public filter(name: string, args?: any): SomeSQLInstance {
        return this._addCmd("filter-" + name, args);
    }

    /**
     * Used to add a command to the query
     *
     * @internal
     * @param {string} type
     * @param {(any)} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    private _addCmd(type: string, args: any): SomeSQLInstance {
        return this._query.push({type: type, args: args}), this;
    }

    /**
     * Trigger a database event
     *
     * @param {DatabaseEvent} eventData
     *
     * @memberOf SomeSQLInstance
     */
    public triggerEvent(eventData: DatabaseEvent, triggerEvents: Array<string>): void {
        let t = this;
        let i = triggerEvents.length;
        let j = 0;
        let e: any;
        let c: Array<Function>;
        while (i--) {
            e = triggerEvents[i];
            c = t._callbacks[t._selectedTable][e].concat(t._callbacks[t._selectedTable]["*"]);
            j = c.length;
            while (j--) {
                eventData.name = e;
                eventData.actionOrView = t._activeActionOrView || "";
                c[j].apply(t, [eventData, t]);
            }
        }
        t._activeActionOrView = undefined;
    }

    /**
     * Executes the current pending query to the db engine, returns a promise with the rows as objects in an array.
     * The second argument of the promise is always the SomeSQL variable, allowing you to chain commands.
     *
     * Example:
     * SomeSQL("users").query("select").exec().then(function(rows, db) {
     *     console.log(rows) // <= [{id:1,username:"Scott",password:"1234"},{id:2,username:"Jeb",password:"1234"}]
     *     return db.query("upsert",{password:"something more secure"}).where(["id","=",1]).exec();
     * }).then(function(rows, db) {
     *  ...
     * })...
     *
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    public exec(): TSPromise<Array<Object>> {

        let t = this;
        let _t = t._selectedTable;

        t._triggerEvents = <any>t._query.map((q) => {
            switch (q.type) {
                case "select": return [q.type];
                case "delete":
                case "upsert":
                case "drop": return [q.type, "change"];
                default: return [];
            }
        }).reduce((a, b) => a.concat(b));

        return new TSPromise((res, rej) => {

            let _tEvent = (data: Array<Object>, callBack: Function, isError: Boolean) => {
                if (t._permanentFilters.length && isError !== true) {
                    data = t._permanentFilters.reduce((prev, cur, i) => {
                        return t._filters[t._permanentFilters[i]].apply(t, [data]);
                    }, data);
                }

                t.triggerEvent({
                    name: "error",
                    actionOrView: "",
                    table: _t,
                    query: t._query,
                    time: new Date().getTime(),
                    result: data
                }, t._triggerEvents);
                callBack(data, t);
            };

            t.backend._exec({
                _table: _t,
                _query: t._query,
                _viewOrAction: t._activeActionOrView || "",
                _onSuccess: (rows) => {
                    _tEvent(rows, res, false);
                },
                _onFail: (err: any) => {
                    t._triggerEvents = ["error"];
                    if (rej) _tEvent(err, rej, true);
                }
            });
        });
    }


    /**
     * Configure the database driver, must be called before the connect() method.
     *
     * @param {any} args
     * @returns {SomeSQLInstance}
     *
     * @memberOf SomeSQLInstance
     */
    public config(args: any): SomeSQLInstance {
        let t = this;
        if (!t.backend) t._preConnectExtend.push(args);
        return t;
    }

    /**
     * Perform a custom action supported by the database driver.
     *
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf SomeSQLInstance
     */
    public extend(...args: Array<any>): any|SomeSQLInstance {
        let t = this;

        if (t.backend) { // Query Mode
            if (t.backend._extend) {
                args.unshift(t);
                return t.backend._extend.apply(t.backend, args);
            } else {
                return undefined;
            }
        }
    }

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
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    public loadJS(rows: Array<Object>): TSPromise<Array<Object>> {
        let t = this;
        return new TSPromise((res, rej) => {
            TSPromise.chain(rows.map((row) => {
                return t.table(t._selectedTable).query("upsert", row).exec();
            })).then((rowData) => {
                res(rowData, t);
            });
        });
    }

    /**
     * Load a CSV file into the DB.  Headers must exist and will be used to identify what columns to attach the data to.
     *
     * This function performs a bunch of upserts, so expect appropriate behavior based on the primary key.
     *
     * Rows must align with the data model.  Row data that isn't in the data model will be ignored.
     *
     * @param {string} csv
     * @returns {(TSPromise<Array<Object>>)}
     *
     * @memberOf SomeSQLInstance
     */
    public loadCSV(csv: string): TSPromise<Array<Object>> {
        let t = this;
        let fields: Array<string> = [];

        return new TSPromise((res, rej) => {
            TSPromise.all(csv.split("\n").map((v, k) => {
                return new TSPromise((resolve, reject) => {
                    if (k === 0) {
                        fields = v.split(",");
                        resolve();
                    } else {
                        let record: StdObject<any> = {};
                        let row = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                        row = row.map(str => str.replace(/^"(.+(?="$))"$/, "$1"));
                        let i = fields.length;
                        while (i--) {
                            if (row[i].indexOf("{") === 0 || row[i].indexOf("[") === 0) {
                                row[i] = JSON.parse(row[i].replace(/'/g, ""));
                            }
                            record[fields[i]] = row[i];
                        }
                        t.table(t._selectedTable).query("upsert", record).exec().then(() => {
                            resolve();
                        });
                    }
                });
            })).then(function () {
                res([], t);
            });
        });
    }

    /**
     * RFC4122 compliant UUID v4, 9 randomly generated 16 bit numbers.
     *
     * @static
     * @returns {string}
     *
     * @memberOf SomeSQLInstance
     */
    public static uuid(): string {
        let r, s, buf;
        const random16Bits = (): number => {
            if (window && window.crypto.getRandomValues) { // Browser crypto
                buf = new Uint16Array(1);
                window.crypto.getRandomValues(buf);
                return buf[0];
            } else {
                return Math.round(Math.random() * Math.pow(2, 16)); // Oh god, please no.
            }
        }, b = "";

        return [b, b, b, b, b, b, b, b, b].reduce((prev: string, cur: any, i: number): string => {
            r = random16Bits();
            s = (i === 4 ? i : (i === 5 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
            r = r.toString(16);
            while (r.length < 4) r = "0" + r;
            return prev + ([3, 4, 5, 6].indexOf(i) >= 0 ? "-" : b) + (s + r).slice(0, 4);
        }, b);
    };

    /**
     * Utility function for generating numerical hashes from strings.
     *
     * @internal
     * @param {string} key
     * @returns {number}
     *
     * @memberOf _SomeSQLImmuDB
     */
    public static _hash(key: string): number {
        return Math.abs(key.split("").reduce(function (prev, next, i) {
            return (((prev << 5) + prev) + key.charCodeAt(i));
        }, 0));
    }

    /**
     * Export the current query to a CSV file, use in place of "exec()";
     *
     * Example:
     * SomeSQL("users").query("select").toCSV(true).then(function(csv, db) {
     *   console.log(csv);
     *   // Returns something like:
     *   id,name,pass,postIDs
     *   1,"scott","1234","[1,2,3,4]"
     *   2,"jeb","5678","[5,6,7,8]"
     * });
     *
     * @param {boolean} [headers]
     * @returns {TSPromise<string>}
     *
     * @memberOf SomeSQLInstance
     */
    public toCSV(headers?: boolean): TSPromise<string> {
        let t = this;
        return new TSPromise((res, rej) => {

            t.exec().then((json: Array<Object>) => {

                let header = t._query.filter((q) => {
                    return q.type === "select";
                }).map((q) => {
                    return q.args ? (<Array<any>>q.args).map((m) => {
                        return t._models[t._selectedTable].filter((f) => f["key"] === m)[0];
                    }) : t._models[t._selectedTable];
                })[0];

                if (headers) {
                    json.unshift(header.map((h) => {
                        return h["key"];
                    }));
                }

                res(json.map((row: StdObject<any>, i) => {
                    if (headers && i === 0) return row;
                    return header.filter((column) => {
                        return row[column["key"]] ? true : false;
                    }).map((column) => {
                        switch (column["type"]) {
                            case "map":
                            // tslint:disable-next-line
                            case "array": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
                            default: return JSON.stringify(row[column["key"]]);
                        }
                    }).join(",");
                }).join("\n"), t);
            });
        });
    }
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
        [key: string]:  (rows: Array<DBRow>) => Array<DBRow>
    };
    _config: Array<any>;
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

/**
 * @internal
 */
let _someSQLStatic = new SomeSQLInstance();

export function SomeSQL(setTablePointer?: string) {
    return _someSQLStatic.table(setTablePointer);
}