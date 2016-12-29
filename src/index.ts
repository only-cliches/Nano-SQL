import { TSMap } from "typescript-map";
import { TSPromise } from "typescript-promise";
import { SomeSQLMemDB } from "./memory-db";

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
    type: "string"|"int"|"float"|"array"|"map"|"bool";
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
     * @internal
     * @type {TSMap<string, TSMap<string, Array<Function>>>}
     * @memberOf SomeSQLInstance
     */
    private _callbacks: TSMap<string, TSMap<string, Array<Function>>>;


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
     * @type {TSMap<string, Array<ActionOrView>>}
     * @memberOf SomeSQLInstance
     */
    private _views: TSMap<string, Array<ActionOrView>>;



    /**
     * Holds a map of the current actions for this database.
     * 
     * @internal
     * @type {TSMap<string, Array<ActionOrView>>}
     * @memberOf SomeSQLInstance
     */
    private _actions: TSMap<string, Array<ActionOrView>>;


    /**
     * A map containing the models
     * 
     * @internal
     * @type {TSMap<string, Array<DataModel>>}
     * @memberOf SomeSQLInstance
     */
    private _models: TSMap<string, Array<DataModel>>;


    /**
     * An array containing a temporary list of events to trigger
     * 
     * @internal
     * @type {Array<string>}
     * @memberOf SomeSQLInstance
     */
    private _triggerEvents: Array<string>;


    /**
     * The current action or view being triggered.
     * 
     * @internal
     * @type {string}
     * @memberOf SomeSQLInstance
     */
    private _activeActionOrView: string;


    /**
     * Holds custom filters implimented by the user
     * 
     * @internal
     * @type {TSMap<string, Function>}
     * @memberOf SomeSQLInstance
     */
    private _filters: TSMap<string, Function>;



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

        t._actions = new TSMap<string, Array<any>>();
        t._views = new TSMap<string, Array<any>>();
        t._models = new TSMap<string, Array<DataModel>>();
        t._query = [];
        t._events = ["change", "delete", "upsert", "drop", "select", "error"];

        t._callbacks = new TSMap<string, TSMap<string, Array<Function>>>();
        t._callbacks.set("*", new TSMap<string, Array<Function>>());
        t._events.forEach((e) => {
            t._callbacks.get("*").set(e, []);
        });

        t._filters = new TSMap<string, Function>();
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
            t._backend.connect(t._models, t._actions, t._views, t._filters, res, rej);
        }, t);
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
    public on(actions: "change"|"delete"|"upsert"|"drop"|"select"|"error", callBack: Function): SomeSQLInstance {
        let t = this;
        let l = t._selectedTable;

        if (!t._callbacks.get(l)) {
            t._events.forEach((v) => {
                t._callbacks.get(l).set(v, []);
            });
        }

        actions.split(" ").forEach((a) => {
            if (t._events.indexOf(a) !== -1) {
                t._callbacks.get(l).get(a).push(callBack);
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
        this._callbacks.forEach((tables) => {
            tables.forEach((actions) => {
                actions.filter((cBs) => {
                    return cBs !== callBack;
                });
            });
        });

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
    public model(dataModel: Array<DataModel>): SomeSQLInstance {
        let t = this;
        let l = t._selectedTable;
        t._callbacks.set(l, new TSMap<string, Array<Function>>());
        t._callbacks.get(l).set("*", []);
        t._events.forEach((e) => {
            t._callbacks.get(l).set(e, []);
        });
        t._models.set(l, dataModel);
        t._views.set(l, []);
        t._actions.set(l, []);
        return t;
    }



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
    public views(viewArray: Array<ActionOrView>): SomeSQLInstance {
        return this._views.set(this._selectedTable, viewArray), this;
    }


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
    public getView(viewName: string, viewArgs: Object): TSPromise<Object | string> {
        let t = this;
        let l = t._selectedTable;
        let selView;
        t._views.get(l).forEach((view) => {
            if (view.name === viewName) {
                selView = view;
            }
        });
        if (!selView) throw Error("View does not exist");
        t._activeActionOrView = viewName;
        return selView.call.apply(t, [t._cleanArgs(selView.args, viewArgs)]);
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
    private _cleanArgs(argDeclarations: Array<string>, args: Object): Object {
        let t = this;
        let l = t._selectedTable;
        let a = {};
        argDeclarations.forEach((k) => {
            let k2 = k.split(":");
            if (k2.length > 1) {
                a[k2[0]] = t._cast(k2[1], args[k2[0]]);
            } else {
                a[k2[0]] = args[k2[0]];
            }
        });
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
    public actions(actionArray: Array<ActionOrView>): SomeSQLInstance {
        return this._actions.set(this._selectedTable, actionArray), this;
    }


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
    public doAction(actionName: string, actionArgs: Object): TSPromise<Object | string> {
        let t = this;
        let l = t._selectedTable;
        let selAction = t._actions.get(l).reduce((prev, cur) => {
            if (prev !== undefined) return prev;
            return cur.name === actionName ? cur : undefined;
        });
        if (!selAction) throw Error("Action does not exist");
        t._activeActionOrView = actionName;
        return selAction.call.apply(t, [t._cleanArgs(selAction.args, actionArgs)]);
    }

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
    public addFilter(filterName: string, filterFunction: Function): SomeSQLInstance {
        return this._filters.set(filterName, filterFunction), this;
    }


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
     * ```
     * .where(['username','=','billy'])
     * .where(['balance','>',20])
     * .where(['catgory','IN',['jeans','shirts']])
     * .where([['name','=','scott'],'and',['balance','>',200]])
     * .where([['id','>',50],'or',['postIDs','IN',[12,20,30]],'and,['name','LIKE','Billy']])
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
    public orderBy(args: Object): SomeSQLInstance {
        return this._addCmd("orderby", args);
    }


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
    public limit(args: number): SomeSQLInstance {
        return this._addCmd("limit", args);
    }


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
    public offset(args: number): SomeSQLInstance {
        return this._addCmd("offset", args);
    }


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
     * @returns {(TSPromise<Array<Object | string>>)}
     * 
     * @memberOf SomeSQLInstance
     */
    public exec(): TSPromise<Array<Object | string>> {

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

        let triggerEvents = (eventData: Object): void => {
            t._triggerEvents.forEach((e) => {
                t._callbacks.get(_t).get(e).concat(t._callbacks.get(_t).get("*")).forEach((cb) => {
                    eventData["name"] = e;
                    eventData["actionOrView"] = t._activeActionOrView;
                    cb.apply(t, [eventData]);
                });
            });
            t._activeActionOrView = undefined;
        };

        return new TSPromise((res, rej) => {

            let _tEvent = function (data, callBack, isError) {
                if (t._permanentFilters.length && isError !== true) {
                    data = t._permanentFilters.reduce((prev, cur, i) => {
                        return t._filters.get(t._permanentFilters[i]).apply(t, [data]);
                    }, data);
                }

                triggerEvents({
                    table: _t,
                    query: t._query,
                    time: new Date().getTime(),
                    result: data
                });

                callBack(data);
            };

            t._backend.exec(_t, t._query, t._activeActionOrView, (rows) => {
                _tEvent(rows, res, false);
            }, (err) => {
                t._triggerEvents = ["error"];
                _tEvent(err, rej, true);
            });
        }, t);
    }

    /**
     * Perform a custom action supported by the database driver.
     * This currently does nothing.
     * 
     * @param {string} argType
     * @param {*} [args]
     * @returns {*}
     * 
     * @memberOf SomeSQLInstance
     */
    public custom(argType: string, args?: any): any {
        let t = this;
        if (t._backend.custom) {
            return t._backend.custom.apply(t, [argType, args]);
        } else {
            return undefined;
        }
    }


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
    public loadJS(rows: Array<Object>): TSPromise<Object | string> {
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
     * @returns {(TSPromise<Object | string>)}
     * 
     * @memberOf SomeSQLInstance
     */
    public loadCSV(csv: string): TSPromise<Object | string> {
        let t = this;
        let fields = [];

        return new TSPromise((res, rej) => {
            TSPromise.all(csv.split("\n").map((v, k) => {
                return new TSPromise((resolve, reject) => {
                    if (k === 0) {
                        fields = v.split(",");
                        resolve();
                    } else {
                        let record = {};
                        let row = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g).map(str => str.replace(/^"(.+(?="$))"$/, "$1"));
                        fields.forEach((f, i) => {
                            if (row[i].indexOf("{") === 0 || row[i].indexOf("[") === 0) {
                                row[i] = JSON.parse(row[i].replace(/'/g, ""));
                            }
                            record[f] = row[i];
                        });
                        t.table(t._selectedTable).query("upsert", row).exec().then(() => {
                            resolve();
                        });
                    }
                }, t);
            })).then(function () {
                res();
            });
        }, t);
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

            t.exec().then(function (json: Array<Object>) {

                let header = t._query.filter((q) => {
                    return q.type === "select";
                }).map((q) => {
                    return q.args ? (<Array<any>>q.args).map((m) => {
                        return t._models.get(t._selectedTable).filter((f) => f["key"] === m)[0];
                    }) : t._models.get(t._selectedTable);
                })[0];

                if (headers) {
                    json.unshift(header.map((h) => {
                        return h["key"];
                    }));
                }

                res(json.map((row, i) => {
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
                }).join("\n"));
            });
        }, t);
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
     * @param {TSMap<string, Array<Object>>} models
     * @param {TSMap<string, Array<ActionOrView>>} actions
     * @param {TSMap<string, Array<ActionOrView>>} views
     * @param {TSMap<string, Function>} filters
     * @param {Function} onSuccess
     * @param {Function} [onFail]
     * 
     * @memberOf SomeSQLBackend
     */
    connect(models: TSMap<string, Array<Object>>, actions: TSMap<string, Array<ActionOrView>>, views: TSMap<string, Array<ActionOrView>>, filters: TSMap<string, Function>, onSuccess: Function, onFail?: Function): void;


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
     * 
     * @param {string} command
     * @param {*} args
     * @returns {*}
     * 
     * @memberOf SomeSQLBackend
     */
    custom?(command: string, args: any): any;
}

let _someSQLStatic = new SomeSQLInstance();

export function SomeSQL(table: string) {
    return _someSQLStatic.table(table);
}

