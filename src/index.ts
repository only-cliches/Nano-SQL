import { TSPromise } from "typescript-promise";
import { SomeSQLMemDB } from "./memory-db";

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
    call: (args?: Object, db?: SomeSQLInstance) => TSPromise<any>;
}

/**
 * You need an array of these to declare a data model.
 * 
 * @export
 * @interface DataModel
 */
export interface DataModel {
    key: string;
    type: "string"|"int"|"float"|"array"|"map"|"bool"|"uuid";
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

export interface DatabaseEvent {
    table: string;
    query: Array<QueryLine>;
    time: number;
    result: Array<any>;
    name: "change"|"delete"|"upsert"|"drop"|"select"|"error";
    actionOrView: string;
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
     * @internal
     * @type {SomeSQLBackend}
     * @memberOf SomeSQLInstance
     */
    private _backend: SomeSQLBackend;

    /**
     * The callbacks for events
     * 
     * @private
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
     * @private
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
     * @internal
     * @type {StdObject<Function>}
     * @memberOf SomeSQLInstance
     */
    private _filters: StdObject<Function>;



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
        t._events.forEach((e) => {
            t._callbacks["*"][e] = [];
        });

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
        if (table) this._selectedTable = table;
        return this;
    }

    /**
     * Inits the backend database for use.
     * 
     * @param {SomeSQLBackend} [backend]
     * @returns {(TSPromise<Object | string>)}
     * 
     * @memberOf SomeSQLInstance
     */
    public connect(backend?: SomeSQLBackend): TSPromise<Object | string> {
        let t = this;
        t._backend = backend || new SomeSQLMemDB();
        return new TSPromise((res, rej) => {
            t._backend.connect(t._models, t._actions, t._views, t._filters, t._preConnectExtend, (result: any) => {
                res(result, t);
            }, (rejected: any) => {
                if (rej) rej(rejected, t);
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

        if (!t._callbacks[l]) {
            t._events.forEach((v) => {
                t._callbacks[l][v] = [];
            });
        }

        actions.split(" ").forEach((a) => {
            if (t._events.indexOf(a) !== -1) {
                t._callbacks[l][a].push(callBack);
            }
        });
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
        for (let key in this._callbacks) {
            for (let key2 in this._callbacks[key]) {
                this._callbacks[key][key2].filter((cBs) => {
                    return cBs !== callBack;
                });
            }
        }
        return this;
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
     * ```typescript
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
        t._callbacks[l] = {};
        t._callbacks[l]["*"] = [];
        t._events.forEach((e) => {
            t._callbacks[l][e] = [];
        });
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
     * ```typescript
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
     * ```typescript
     * SomeSQL("users").getView("view-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     * 
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     * 
     * ```typescript
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
     * ```typescript
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
        t._views[l].forEach((view) => {
            if (view.name === viewName) {
                selView = view;
            }
        });
        if (!selView) throw Error("View does not exist");
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
        if (argDeclarations) {
            argDeclarations.forEach((k) => {
                let k2: Array<string> = k.split(":");
                if (k2.length > 1) {
                    a[k2[0]] = t._cast(k2[1], args[k2[0]] || null);
                } else {
                    a[k2[0]] = args[k2[0]] || null;
                }
            });
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
        switch (["string", "int", "float", "array", "map", "bool"].indexOf(type)) {
            case 0: return String(val);
            case 1: return parseInt(val);
            case 2: return parseFloat(val);
            case 3:
            case 4: return JSON.parse(JSON.stringify(val));
            case 5: return val === true;
            default: return "";
        }
    }

	/**
	 * Declare the actions for the current selected table.  Must be called before connect()
     * 
     * Actions are created like this:
     * ```typescript
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
     * ```typescript
     * SomeSQL("users").doAction("action-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     * 
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     * ```typescript
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
     * ```typescript
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
        t._actions[l].forEach((action) => {
            if (action.name === actionName) {
                selAction = action;
            }
        });
        if (!selAction) throw Error("Action does not exist");
        t._activeActionOrView = actionName;
        return selAction.call.apply(t, [t._cleanArgs(selAction.args ? selAction.args : [], actionArgs), t]);
    }

    /**
	 * Add a filter to the usable list of filters for this database.  Must be called BEFORE connect().
     * Example:
     * 
     * ```typescript
     * SomeSQL().addFilter('addBalance',function(rows) {
     *      return rows.map((row) => row.balance + 1);
     * })
     * ```
     * 
     * Then to use it in a query: 
     * ```typescript
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
     * Select is used to pull a set of rows or other data from the table.  
     * When you use select the optional second argument of the query is an array of strings that allow you to show only specific columns.
     * 
     * Select examples:
     * ```typescript
     * .query("select") // No arguments, select all columns
     * .query("select",['username']) // only get the username column
     * .query("select",["username","balance"]) //Get two columns, username and balance.
     * ```
     * Upsert is used to add data into the database.  
     * If the primary key rows are null or undefined, the data will always be added. Otherwise, you might be updating existing rows.
     * The second argument of the query with upserts is always an Object of the data to upsert.
     * 
     * Upsert Examples:
     * ```typescript
     * .query("upsert",{id:1,username:"Scott"}) //Set username to "Scott" where the row ID is 1.
     * .query("upsert",{username:"Scott"}) //Add a new row to the db with this username in the row.  Optionally, if you use a WHERE statement this data will be applied to the rows found with the where statement.
     * ```
     * 
     * Delete is used to remove data from the database.
     * It works exactly like select, except it removes data instead of selecting it.  The second argument is an array of columns to clear.  If no second argument is passed, the database is dropped.
     * 
     * Delete Examples:
     * ```typescript
     * .query("delete",['balance']) //Clear the contents of the balance column.  If a where statment is passed you'll only clear the columns of the rows selected by the where statement.
     * ```
     * Drop is used to completely clear the contents of a database.  There are no arguments.
     * 
     * Drop Examples:
     * ```typescript
     * .query("drop")
     * ```
     * 
     * @param {("select"|"upsert"|"delete"|"drop")} action
     * @param {Object} [args]
     * @returns {SomeSQLInstance}
     * 
     * @memberOf SomeSQLInstance
     */
    public query(action: "select"|"upsert"|"delete"|"drop", args?: Object): SomeSQLInstance {
        this._query = [];
        let a = action.toLowerCase();
        if (["select", "upsert", "delete", "drop"].indexOf(a) !== -1) {
            this._query.push({type: a, args: args});
        } else {
            console.error("Invalid query '" + action + "'!");
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
     * ```typescript
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
     * ```typescript
     * .orderBy({username:"asc"}) // order by username column, ascending
     * .orderBy({balance:"desc",lastName:"asc"}) // order by balance descending, then lastName ascending.
     * ```
     * 
     * @param {Object} args
     * @returns {SomeSQLInstance}
     * 
     * @memberOf SomeSQLInstance
     */
    public orderBy(args: Object): SomeSQLInstance {
        return this._addCmd("orderby", args);
    }


    /**
     * Limits the result to a specific amount.  Example:
     * 
     * ```typescript
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
     * ```typescript
     * .offset(10) //Skip the first 10 results.
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
     * The memory DB supports sum, first, last, min, max, average, and count
     * 
     * Example:
     * ```typescript
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
    public filter(name: string, args?: any): SomeSQLInstance {
        return this._addCmd("filter-" + name, args);
    }



    /**
     * Used to add a command to the query
     * 
     * @internal
     * @param {string} type
     * @param {(Array<any> | Object)} args
     * @returns {SomeSQLInstance}
     * 
     * @memberOf SomeSQLInstance
     */
    private _addCmd(type: string, args: Array<any> | Object): SomeSQLInstance {
        return this._query.push({type: type, args: args}), this;
    }


    /**
     * Executes the current pending query to the db engine.
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

        let triggerEvents = (eventData: DatabaseEvent): void => {
            t._triggerEvents.forEach((e) => {
                t._callbacks[_t][e].concat(t._callbacks[_t]["*"]).forEach((cb) => {
                    eventData.name = e;
                    eventData.actionOrView = t._activeActionOrView || "";
                    cb.apply(t, [eventData, t]);
                });
            });
            t._activeActionOrView = undefined;
        };

        return new TSPromise((res, rej) => {

            let _tEvent = (data: Array<Object>, callBack: Function, isError: Boolean) => {
                if (t._permanentFilters.length && isError !== true) {
                    data = t._permanentFilters.reduce((prev, cur, i) => {
                        return t._filters[t._permanentFilters[i]].apply(t, [data]);
                    }, data);
                }

                triggerEvents({
                    name: "error",
                    actionOrView: "",
                    table: _t,
                    query: t._query,
                    time: new Date().getTime(),
                    result: data
                });
                callBack(data, t);
            };

            t._backend.exec(_t, t._query, t._activeActionOrView || "", (rows) => {
                _tEvent(rows, res, false);
            }, (err: any) => {
                t._triggerEvents = ["error"];
                if (rej) _tEvent(err, rej, true);
            });
        });
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

        if (t._backend) { // Query Mode
            if (t._backend.extend) {
                return t._backend.extend.apply(t, args);
            } else {
                return undefined;
            }
        } else { // Setup Mode
            return t._preConnectExtend.push(args), this;
        }
    }


    /**
     * Load JSON directly into the DB.
     * JSON must be an array of maps, like this:
     * ```typescript
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
    public loadJS(rows: Array<Object>): TSPromise<Array<Object>> {
        let t = this;
        return TSPromise.all(rows.map((row) => {
            return t.table(t._selectedTable).query("upsert", row).exec();
        }));
    }


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
                        fields.forEach((f, i) => {
                            if (row[i].indexOf("{") === 0 || row[i].indexOf("[") === 0) {
                                row[i] = JSON.parse(row[i].replace(/'/g, ""));
                            }
                            record[f] = row[i];
                        });
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
     * Export the current query to a CSV file.
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
                            // tslint:disable-next-line
                            case "map": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
                            // tslint:disable-next-line
                            case "array": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
                            default: return JSON.stringify(row[column["key"]]);
                        }
                    }).join(",");
                }).join("\n"), t);
            });
        });
    }


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
    public static uuid(inputUUID?: string): string {
        return inputUUID ? inputUUID : (function () {
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
                let r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        })();
    }


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
    public static hash(str: string): string {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            let char = str.charCodeAt(i);
            hash = ((hash << 5) + hash) + char; /* hash * 33 + c */
        }
        return String(hash);
    }
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
     * @param {StdObject<Array<Object>>} models
     * @param {StdObject<Array<ActionOrView>>} actions
     * @param {StdObject<Array<ActionOrView>>} views
     * @param {StdObject<Function>} filters
     * @param {Array<any>} extendCalls
     * @param {Function} onSuccess
     * @param {Function} [onFail]
     * 
     * @memberOf SomeSQLBackend
     */
    connect(models: StdObject<Array<Object>>, actions: StdObject<Array<ActionOrView>>, views: StdObject<Array<ActionOrView>>, filters: StdObject<Function>, extendCalls: Array<any>, onSuccess: Function, onFail?: Function): void;



    /**
     * Executes a specific query on the database with a specific table
     * 
     * This is called on "exec()" and all the query parameters are passed in as an array of Objects containing the query parameters.
     * 
     * The syntax is pretty straightforward, for example a query like this: SomeSQL("users").query("select").exec() will turn into this:
     * ```typescript
     * [{type:'select',args:undefined}]
     * ```
     * 
     * Let's say the person using the system gets crazy and does SomeSQL("users").query("select",['username']).orderBy({name:'desc'}).exec();
     * Then you get this:
     * ```typescript
     * [{type:'select',args:['username']},{type:"orderBy",args:{name:'desc}}]
     * ```
     * 
     * With that information and the table name you can create the query as needed, then return it through the onSuccess function.
     * 
     * @param {string} table
     * @param {Array<QueryLine>} query
     * @param {string} viewOrAction
     * @param {(rows: Array<Object>) => void} onSuccess
     * @param {(rows: Array<Object>) => void} onFail
     * 
     * @memberOf SomeSQLBackend
     */
    exec(table: string, query: Array<QueryLine>, viewOrAction: string, onSuccess: (rows: Array<Object>) => void, onFail: (rows: Array<Object>) => void): void;


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

/**
 * @private
 */
let _someSQLStatic = new SomeSQLInstance();

export function SomeSQL(setTablePointer?: string) {
    return _someSQLStatic.table(setTablePointer);
}