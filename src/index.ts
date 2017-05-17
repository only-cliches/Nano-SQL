import { _NanoSQLDB, _fnForEach } from "./db-index";
import { Promise } from "lie-ts";
import { _NanoSQLQuery, _NanoSQLORMQuery } from "./index-query";
import { _NanoSQLTransactionQuery, _NanoSQLTransactionORMQuery } from "./index-transaction";

declare var global: any;

export interface UUID extends String {

}

// tslint:disable-next-line
export interface timeId extends String {

}

// tslint:disable-next-line
export interface timeIdms extends String {

}

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
    type: "aggregate"|"simple";
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
    type: "string"|"int"|"float"|"array"|"map"|"bool"|"uuid"|"blob"|"timeId"|"timeIdms"|"safestr"|string;
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
    query: QueryLine[];
    time: number;
    result: any[];
    name: "change"|"delete"|"upsert"|"drop"|"select"|"error";
    actionOrView: string;
    changeType: string;
    changedRows: DBRow[];
    changedRowPKS: any[];
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
    type: "left"|"inner"|"right"|"cross"|"outer";
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
    key?: string;
    offset?: number;
    limit?: number;
    orderBy?: {
        [column: string]: "asc"|"desc";
    };
    where?: any[]|any[][];
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

export const _assign = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
};

export interface IActionViewMod {
    (tableName: string, actionOrView: "Action"|"View", name: string, args: any, complete: (args: any) => void, error?: (errorMessage: string) => void): void;
}

/**
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class NanoSQLInstance
 */
export class NanoSQLInstance {


    /**
     * Holds the current selected table
     *
     * @internal
     * @type {string}
     * @memberOf NanoSQLInstance
     */
    private _selectedTable: string;

    /**
     * The backend currently being used
     *
     * @public
     * @type {NanoSQLBackend}
     * @memberOf NanoSQLInstance
     */
    public backend: NanoSQLBackend;

    /**
     * Misc placeholder that can be used by the dev.
     *
     * @type {*}
     * @memberOf NanoSQLInstance
     */
    public data: any;

    /**
     * The callbacks for events
     *
     * @internal
     * @type {StdObject<StdObject<Array<Function>>>}
     * @memberOf NanoSQLInstance
     */
    private _callbacks: StdObject<StdObject<Array<Function>>>;

    /**
     * An array of possible events
     *
     * @internal
     * @type {Array<string>}
     * @memberOf NanoSQLInstance
     */
    private _events: Array<string>;

    /**
     * Holds a map of the current views for this database.
     *
     * @internal
     * @type {StdObject<Array<ActionOrView>>}
     * @memberOf NanoSQLInstance
     */
    private _views: StdObject<Array<ActionOrView>>;

    /**
     * Holds a map of the current actions for this database.
     *
     * @internal
     * @type {StdObject<Array<ActionOrView>>}
     * @memberOf NanoSQLInstance
     */
    private _actions: StdObject<Array<ActionOrView>>;


    /**
     * A map containing the models
     *
     * @internal
     * @type {StdObject<Array<DataModel>>}
     * @memberOf NanoSQLInstance
     */
    public _models: StdObject<Array<DataModel>>;


    /**
     * Stores the default ORM functions for each table.
     *
     * @public
     *
     * @memberof NanoSQLInstance
     */
    public _ormFns: {
        [table: string]: (column: string, row: DBRow) => ORMArgs
    };

    /**
     * An array containing a temporary list of events to trigger
     *
     * @internal
     * @type {Array<"change"|"delete"|"upsert"|"drop"|"select"|"error">}
     * @memberOf NanoSQLInstance
     */
    public _triggerEvents: Array<"change"|"delete"|"upsert"|"drop"|"select"|"error"|string>;

    /**
     * Stores wether each table has events attached to it or not.
     *
     * @public
     * @type {StdObject<boolean>}
     * @memberOf NanoSQLInstance
     */
    public _hasEvents: StdObject<boolean>;

    /**
     * The current action or view being triggered.
     *
     * @internal
     * @type {string}
     * @memberOf NanoSQLInstance
     */
    public _activeAV: string|undefined;

    /**
     * Holds custom filters implimented by the user
     *
     * @private
     *
     * @memberOf NanoSQLInstance
     */
    private _functions: {
        [key: string]:  DBFunction
    };

    /**
     * Holds an array of custom commands, this is used if the custom() is used before we connect to the db.
     *
     * @internal
     * @type {Array<Array<any>>}
     * @memberOf NanoSQLInstance
     */
    private _preConnectExtend: Array<Array<any>>;

    /**
     * Holds an object containing the insert filters.
     *
     * @internal
     *
     * @memberOf NanoSQLInstance
     */
    private _rowFilters: {
        [key: string]: (row: any) => any;
    };

    /**
     * Lets you modify queries before they run on the database
     *
     * @internal
     *
     * @memberOf NanoSQLInstance
     */
    public _queryMod: (args: DBExec, complete: (args: DBExec) => void) => void;

    /**
     * Holds a reference to the optional action/view modifier
     *
     *
     * @memberOf NanoSQLInstance
     */
    public _AVMod: IActionViewMod;

    /**
     * The current timezone offset of this system.
     *
     * @private
     * @type {number}
     * @memberOf NanoSQLInstance
     */
    private static _tzOffset: number;

    /**
     * Store an array of table names for ORM type casting.
     *
     * @private
     * @type {string[]}
     * @memberof NanoSQLInstance
     */
    public _tableNames: string[];

    /**
     * Store an array of updated tables to decide what tables to trigger a change on after the transaction.
     *
     * @private
     * @type {string[]}
     * @memberOf NanoSQLInstance
     */
    private _transactionTables: string[];

    constructor() {

        let t = this;
        t._actions = {};
        t._views = {};
        t._models = {};
        t._preConnectExtend = [];
        t._transactionTables = [];
        t._events = ["change", "delete", "upsert", "drop", "select", "error"];

        t._callbacks = {};
        t._ormFns = {};
        t._hasEvents = {};
        t._callbacks["*"] = {};
        t._tableNames = [];
        let i = t._events.length;
        while (i--) {
            t._callbacks["*"][t._events[i]] = [];
        }

        t._functions = {};
        t._rowFilters = {};
    }


    /**
     * Changes the table pointer to a new table.
     *
     * @param {string} [table]
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public table(table?: string): NanoSQLInstance {
        if (table) this._selectedTable = table;
        return this;
    }

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
    public connect(backend?: NanoSQLBackend): Promise<Object | string> {
        let t = this;

        if (t.backend) {
            return new Promise((res, rej) => {
                rej();
                throw Error();
            });
        }
        t.backend = backend || new _NanoSQLDB();
        return new Promise((res, rej) => {
            t.backend._connect({
                _models: t._models,
                _actions: t._actions,
                _views: t._views,
                _functions: t._functions,
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
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public on(actions: "change"|"delete"|"upsert"|"drop"|"select"|"error", callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance {
        let t = this;
        let l = t._selectedTable;
        let i = 0;
        let a = actions.split(" ");

        if (!t._callbacks[l]) { // Handle the event handler being called before the database has connected
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }

        i = a.length;
        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l][a[i]].push(callBack);
            }
        }
        t._refreshEventChecker();
        return t;
    }

	/**
	 * Remove a specific event handler from being triggered anymore.
	 *
	 * @param {Function} callBack
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public off(callBack: Function): NanoSQLInstance {
        let t = this;
        for (let key in t._callbacks) {
            for (let key2 in t._callbacks[key]) {
                t._callbacks[key][key2] = t._callbacks[key][key2].filter((cBs) => {
                    return cBs !== callBack;
                });
            }
        }
        t._refreshEventChecker();
        return t;
    }

    private _refreshEventChecker() {
        this._hasEvents = {};
        Object.keys(this._models).concat(["*"]).forEach((table) => {
            this._hasEvents[table] = this._events.reduce((prev, cur) => {
                return prev + (this._callbacks[table] ? this._callbacks[table][cur].length : 0);
            }, 0) > 0;
        });
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
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public model(dataModel: Array<DataModel>): NanoSQLInstance {
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
        t._tableNames.push(l);
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
    public views(viewArray: Array<ActionOrView>): NanoSQLInstance {
        return this._views[this._selectedTable] = viewArray, this;
    }

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
    public getView(viewName: string, viewArgs: any = {}): Promise<Array<any>|NanoSQLInstance> {
        return this._doAV("View", this._views[this._selectedTable], viewName, viewArgs);
    }

    /**
     * Take an action or view and it's args, then make sure the args comform to the types declared in the model.
     *
     * @public
     * @param {Array<string>} argDeclarations
     * @param {Object} args
     * @returns {Object}
     *
     * @memberOf NanoSQLInstance
     */
    public cleanArgs(argDeclarations: Array<string>, args: StdObject<any>): StdObject<any> {
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
     * @memberOf NanoSQLInstance
     */
    private _cast(type: string, val?: any): any {
        let p = this;
        const entityMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;",
            "/": "&#x2F;",
            "`": "&#x60;",
            "=": "&#x3D;"
        };
        const t = typeof val;
        let types = (type: string, val: any) => {
            switch (type) {
                case "safestr": return types("string", val).replace(/[&<>"'`=\/]/g, (s) => entityMap[s]);
                case "int": return (t !== "number" || val % 1 !== 0) ? parseInt(val || 0) : val;
                case "float": return t !== "number" ? parseFloat(val || 0) : val;
                case "any[]":
                case "array": return Array.isArray(val) ? _assign(val || []) : [];
                case "uuid":
                case "timeId":
                case "timeIdms":
                case "string": return val === null ? "" : t !== "string" ? String(val) : val;
                case "map": return t === "object" ? _assign(val || {}) : {};
                case "bool": return val === true;
                // case "any":
                // case "blob": return val;
            }

            return val;
        };

        const newVal = types(type, val);

        if (type.indexOf("[]") !== -1) {
            const arrayOf = type.slice(0, type.lastIndexOf("[]"));
            return (val || []).map((v) => {
                return this._cast(arrayOf, v);
            });
        } else if (newVal !== undefined) {
            if (["int", "float"].indexOf(type) !== -1) {
                return isNaN(newVal) ? 0 : newVal;
            } else {
                return newVal;
            }
        }

        return undefined;
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
    public actions(actionArray: Array<ActionOrView>): NanoSQLInstance {
        return this._actions[this._selectedTable] = actionArray, this;
    }

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
    public doAction(actionName: string, actionArgs: any): Promise<Array<DBRow>|NanoSQLInstance> {
        return this._doAV("Action", this._actions[this._selectedTable], actionName, actionArgs);
    }

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
    private _doAV(AVType: "Action"|"View", AVList: ActionOrView[], AVName: string, AVargs: any): Promise<Array<DBRow>|NanoSQLInstance> {
       let t = this;

        let selAV: ActionOrView|null = AVList.reduce((prev, cur) => {
            if (cur.name === AVName) return cur;
            return prev;
        }, null as any);

        if (!selAV) {
            return new Promise((res, rej) => rej("Action/View Not Found!"));
        }
        t._activeAV = AVName;

        let cleanArgs = selAV.args ? t.cleanArgs(selAV.args, AVargs) : {};

        if (t._AVMod) {
            return new Promise((res, rej) => {
                t._AVMod(this._selectedTable, AVType, t._activeAV || "", cleanArgs, (args) => {
                    selAV ? selAV.call(args, t).then((result) => {
                        res(result, t);
                    }) : false;
                }, (err) => {
                    rej(err);
                });
            });
        } else {
            return selAV.call(cleanArgs, t);
        }
    }

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
    public newFunction(functionName: string, functionType: "aggregate"|"simple", filterFunction: (row: DBRow, args: string[], ptr: number[], prev?: any) => DBRow[]): NanoSQLInstance {
        return this._functions[functionName] = {type: functionType, call: filterFunction}, this;
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
    public query(action: "select"|"upsert"|"delete"|"drop"|"show tables"|"describe", args?: any, bypassORMPurge?: boolean): _NanoSQLQuery {

        let t = this;
        let query = new _NanoSQLQuery(t._selectedTable, t, t._activeAV);
        t._activeAV = undefined;
        const a = action.toLowerCase();
        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) !== -1) {

            let newArgs = args || (a === "select" || a === "delete" ? [] : {});
            if (["upsert", "delete", "drop"].indexOf(a) !== -1) {
                t._transactionTables.push(t._selectedTable);
            }

            // Purge ORM columns from the delete arguments
            if (action === "delete" && !bypassORMPurge) {
                let inputArgs = {};
                t._models[t._selectedTable].forEach((model) => {
                    if (t._tableNames.indexOf(model.type.replace("[]", "")) !== -1) {
                        newArgs[model.key] = undefined;
                    }
                });
                newArgs = inputArgs;
            }

            if (action === "upsert") {

                // Cast row types and remove columns that don't exist in the data model
                let inputArgs = {};

                t._models[t._selectedTable].forEach((model) => {
                    if (!bypassORMPurge) {
                        // Purge ORM columns
                        if (t._tableNames.indexOf(model.type.replace("[]", "")) !== -1) {
                            newArgs[model.key] = undefined;
                        }
                    }

                    // Cast known columns and purge uknown columns
                    if (newArgs[model.key] !== undefined) {
                        let cast = t._cast(model.type, newArgs[model.key]);
                        if (cast !== undefined) inputArgs[model.key] = cast;
                    }
                });

                // Apply insert filters
                if (t._rowFilters[t._selectedTable]) {
                    inputArgs = t._rowFilters[t._selectedTable](inputArgs);
                }

                newArgs = inputArgs;
            }
            query._action = {type: a, args: newArgs};
        } else {
            throw Error;
        }
        return query;
    }

    /**
     * Update relational ORM data.
     *
     * @param {("add"|"delete"|"drop"|"rebuild"|"set")} action
     * @param {string} column
     * @param {any[]} [relationIDs]
     * @returns
     *
     * @memberof NanoSQLInstance
     */
    public updateORM(action: "add"|"delete"|"drop"|"rebuild"|"set", column?: string, relationIDs?: any[]): _NanoSQLORMQuery {
        return new _NanoSQLORMQuery(this, this._selectedTable, action, column, relationIDs);
    }

    /**
     * Add a default ORM query to a speicfic table.
     *
     * @param {(column: string) => ORMArgs} callBack
     *
     * @memberof NanoSQLInstance
     */
    public defaultORM(callBack: (column: string, parentRowData: DBRow[]) => ORMArgs): this {
        this._ormFns[this._selectedTable] = callBack;
        return this;
    }

    /**
     * Trigger a database event
     *
     * @param {DatabaseEvent} eventData
     *
     * @memberOf NanoSQLInstance
     */
    public triggerEvent(eventData: DatabaseEvent, triggerEvents: Array<string>): void {
        let t = this;
        setTimeout(() => {
            let i = triggerEvents.length;
            let j = 0;
            let e: any;
            let c: Array<Function>;
            while (i--) {
                e = triggerEvents[i];
                c = t._callbacks[eventData.table][e].concat(t._callbacks[eventData.table]["*"]);
                j = c.length;
                while (j--) {
                    eventData.name = e;
                    c[j](eventData, t);
                }
            }
        }, 0);
    }

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
    public default(replaceObj?: any): {[key: string]: any} {
        let newObj = {};
        let t = this;
        t._models[t._selectedTable].forEach((m) => {
            newObj[m.key] = (replaceObj && replaceObj[m.key]) ? replaceObj[m.key] : m.default;
            if (!newObj[m.key]) {
                newObj[m.key] = t._cast(m.type, null); // Generate default value from type, eg int == 0
            }
        });
        return newObj;
    }

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
    public doTransaction(initTransaction: (
        db: (table?: string) => {
            query: (action: "select"|"upsert"|"delete"|"drop"|"show tables"|"describe", args?: any) => _NanoSQLTransactionQuery;
            updateORM: (action: "add"|"delete"|"drop"|"set", column?: string, relationIDs?: any[]) => _NanoSQLTransactionORMQuery|undefined;
        }, complete: () => void) => void
    ): Promise<any> {
        let t = this;
        let queries: {
            type: "std"|"orm",
            table: string;
            action: any;
            actionArgs?: any;
            query?: any[];
            column?: string;
            relationIDs?: any[];
            where?: any[];
        }[] = [];
        let transactionID = new Date().getTime();

        return new Promise((resolve, reject) => {
            t.backend._transaction("start", transactionID).then(() => {
                initTransaction(
                    (table?: string) => {
                        let ta: string = table || t._selectedTable;
                        return {
                            query: (action: "select"|"upsert"|"delete"|"drop"|"show tables"|"describe", args?: any) => {
                                return new _NanoSQLTransactionQuery(action, args, ta, queries);
                            },
                            updateORM: (action: "add"|"delete"|"drop"|"set"|"rebuild", column?: string, relationIDs?: any[]) => {
                                if (action === "rebuild") {
                                    return undefined;
                                } else {
                                    return new _NanoSQLTransactionORMQuery(queries, ta, action, column, relationIDs);
                                }
                            }
                        };
                    },
                    () => {

                        Promise.all(queries.map((quer) => {
                            if (quer.type === "std") {
                               return t.table(quer.table).query(quer.action, quer.actionArgs, true).tID(transactionID)._manualExec(quer.table, quer.query || []);
                            } else {
                                let ormQuery = t.table(quer.table).updateORM(quer.action, quer.column, quer.relationIDs).tID(transactionID);
                                const where = quer.where;
                                if ( where ) ormQuery.where(where);
                                return ormQuery.exec();
                            }
                        })).then(() => {
                            t.backend._transaction("end", transactionID).then((result) => {

                                t._transactionTables.forEach((table) => {
                                    if (table.indexOf("_") !== 0) {
                                        t.triggerEvent({
                                            table: table,
                                            query: [],
                                            time: new Date().getTime(),
                                            result: [],
                                            name: "change",
                                            actionOrView: "",
                                            changeType: "transaction",
                                            changedRows: [],
                                            changedRowPKS: []
                                        }, ["change"]);
                                    }
                                });

                                resolve(result);
                            });
                        });
                    }
                );
            });
        });
    }

    /**
     * Adds a query filter to every request.
     *
     * @param {(args: DBExec, complete:(args: DBExec) => void) => void} callBack
     *
     * @memberOf NanoSQLInstance
     */
    public queryFilter(callBack: (args: DBExec, complete: (args: DBExec) => void) => void): NanoSQLInstance {
        this._queryMod = callBack;
        return this;
    }


    /**
     * Set the action/view filter function.  Called *before* the action/view is sent to the datastore
     *
     * @param {IActionViewMod} filterFunc
     * @returns
     *
     * @memberOf NanoSQLInstance
     */
    public avFilter(filterFunc: IActionViewMod) {
        this._AVMod = filterFunc;
        return this;
    }

    /**
     * Configure the database driver, must be called before the connect() method.
     *
     * @param {any} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public config(args: any): NanoSQLInstance {
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
     * @memberOf NanoSQLInstance
     */
    public extend(...args: Array<any>): any|NanoSQLInstance {
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
     * @param {string} table
     * @param {Array<Object>} rows
     * @returns {Promise<Array<Object>>}
     *
     * @memberOf NanoSQLInstance
     */
    public loadJS(table: string, rows: Array<Object>): Promise<Array<Object>> {
        let t = this;
        return t.doTransaction((db, complete) => {
            rows.forEach((row) => {
                db(table).query("upsert", row).exec();
            });
            complete();
        });
        /*
        return new Promise((res, rej) => {
            let pointer = 0;
            let rowData: any[] = [];
            const next = () => {
                if (pointer < rows.length) {
                    if (rows[pointer]) {
                        t.table(table).query("upsert", rows[pointer], true).exec().then((res) => {
                            rowData.push(res);
                            pointer++;
                            next();
                        });
                    } else {
                        pointer++;
                        next();
                    }
                } else {
                    // t.endTransaction();
                    res(rowData, t);
                }
            };
            next();
        });
        */
    }

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
    public rowFilter(callBack: (row: any) => any) {
        return this._rowFilters[this._selectedTable] = callBack, this;
    }

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
    public loadCSV(table: string, csv: string): Promise<Array<Object>> {
        let t = this;
        let fields: Array<string> = [];

        return new Promise((res, rej) => {
            // t.beginTransaction();
            Promise.all(csv.split("\n").map((v, k) => {
                return new Promise((resolve, reject) => {
                    if (k === 0) {
                        fields = v.split(",");
                        resolve();
                    } else {
                        let record: StdObject<any> = {};
                        let row = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                        let i = fields.length;
                        while (i--) {
                            if (row[i].indexOf("{") === 1 || row[i].indexOf("[") === 1) {
                                // tslint:disable-next-line
                                row[i] = JSON.parse(row[i].slice(1, row[i].length - 1).replace(/'/gm, '\"'));
                            // tslint:disable-next-line
                            } else if (row[i].indexOf('"') === 0) {
                                row[i] = row[i].slice(1, row[i].length - 1);
                            }
                            record[fields[i]] = row[i];
                        }
                        t.table(table).query("upsert", record, true).exec().then(() => {
                            resolve();
                        });
                    }
                });
            })).then(function () {
                // t.endTransaction();
                res([], t);
            });
        });
    }

    private static _random16Bits(): number {
        if (typeof crypto === "undefined") {
            return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
        } else {
            if (crypto.getRandomValues) { // Browser crypto
                let buf = new Uint16Array(1);
                crypto.getRandomValues(buf);
                return buf[0];
            } else if (global !== "undefined" && global._crypto.randomBytes) { // NodeJS crypto
                return  global._crypto.randomBytes(2).reduce((prev: number, cur: number) => cur * prev);
            } else {
                return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
            }
        }
    }

    /**
     * Generate a unique, sortable time ID
     *
     * @static
     * @returns {string}
     *
     * @memberOf NanoSQLInstance
     */
    public static timeid(ms?: boolean): string {
        let t = this;
        if (!t._tzOffset) {
            t._tzOffset = new Date().getTimezoneOffset() * 60000; // In milliseconds
        }
        let time = Math.round((new Date().getTime() + t._tzOffset) / (ms ? 1 : 1000)).toString();
        while (time.length < (ms ? 13 : 10)) {
            time = "0" + time;
        }
        return time + "-" +  (t._random16Bits() + t._random16Bits()).toString(16);
    }

    /**
     * RFC4122 compliant UUID v4, 9 randomly generated 16 bit numbers.
     *
     * @static
     * @returns {string}
     *
     * @memberOf NanoSQLInstance
     */
    public static uuid(): string {
        let r, s, b = "";
        return [b, b, b, b, b, b, b, b, b].reduce((prev: string, cur: any, i: number): string => {
            r = this._random16Bits();
            s = (i === 4 ? i : (i === 5 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
            r = r.toString(16);
            while (r.length < 4) r = "0" + r;
            return prev + ([3, 4, 5, 6].indexOf(i) >= 0 ? "-" : b) + (s + r).slice(0, 4);
        }, b);
    }

    /**
     * Utility function for generating numerical hashes from strings.
     *
     * @internal
     * @param {string} key
     * @returns {number}
     *
     * @memberOf _NanoSQLDB
     */
    public static _hash(key: string): number {
        return Math.abs(key.split("").reduce(function (prev, next, i) {
            return ((prev << 5) + prev) + key.charCodeAt(i);
        }, 0));
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
    _functions: {
        [key: string]:  DBFunction
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
    table: string;
    query: Array<QueryLine>;
    viewOrAction: string;
    transactionID: number;
    onSuccess: (rows: Array<Object>, type: string, affectedRows: DBRow[], affectedPKS: any[]) => void;
    onFail: (rows: Array<Object>) => void;
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
    _transaction(type: "start"|"end", id: number): Promise<any[]>;
}

/**
 * @internal
 */
let _NanoSQLStatic = new NanoSQLInstance();

export const nSQL = (setTablePointer?: string) => {
    return _NanoSQLStatic.table(setTablePointer);
};