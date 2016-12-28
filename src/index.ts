import { TSMap } from "typescript-map";
import { TSPromise } from "typescript-promise";
import { SomeSQLMemDB } from "./memory-db";

export interface ActionOrView {
    name: string;
    args?: Array<string>;
    call: (args?: Object) => TSPromise<any>;
}

export interface DataModel {
    key: string;
    type: string;
    props?: Array<any>;
}

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
    * @type {Array<any>}
    * @memberOf SomeSQLInstance
    */
    private _query: Array<TSMap<string, Object | Array<any>>>;

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
    * @type {*}
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
	 * 
	 * @memberOf SomeSQLInstance
	 */
    private _views: TSMap<string, Array<ActionOrView>>;


	/**
	 * Holds a map of the current actions for this database.
	 * 
	 * @internal
	 * 
	 * @memberOf SomeSQLInstance
	 */
    private _actions: TSMap<string, Array<ActionOrView>>;

	/**
    * A map containing the models
    * 
    * @internal
    * @type {*}
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
    * @type {TSMap<string,Function>}
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
    * Changes the table pointer
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
    * Inits the backend database for use
    * 
    * @param {SomeSQLBackend} backend
    * @returns {TSPromise<any>}
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
    * Allows you to apply a callback function to any valid event.
    * 
    * @param {string} actions
    * @param {Function} callBack
    * @returns {SomeSQLInstance}
    * 
    * @memberOf SomeSQLInstance
    */
    public on(actions: string, callBack: Function): SomeSQLInstance {
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
	 * Declare the views for the current selected table.
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
		* Execute a specific view.
		* 
		* @param {any} viewName
		* @param {any} viewArgs
		* @returns {TSPromise<any>}
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
    * @param {Array<any>} funcArray
    * @param {*} args
    * @returns {*}
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
    * @returns
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
	 * Declare actions for the current selected table.
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
    * Init an action for the current selected table.
    * 
    * @param {any} actionName
    * @param {any} actionArgs
    * @returns {TSPromise<any>}
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
	 * Add a filter to the usable list of filters for this database.
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
    * 
    * @param {string} action
    * @param {Object} [args]
    * @returns {SomeSQLInstance}
    * 
    * @memberOf SomeSQLInstance
    */
    public query(action: string, args?: Object): SomeSQLInstance {
        this._query = [];
        let a = action.toLowerCase();
        if (["select", "upsert", "delete", "drop"].indexOf(a) !== -1) {
            this._query.push(new TSMap<string, Object | Array<any>>([["type", a], ["args", args]]));
        }
        return this;
    }

	/**
    * Narrow down your search by a single where clause:
    * [value,comparison,check], for example:
    * 
    * @param {Array<any>} args ['name','=','berry'] or ['name','IN',['berry','john']]
    * @returns {SomeSQLInstance}
    * 
    * @memberOf SomeSQLInstance
    */
    public where(args: Array<any>): SomeSQLInstance {
        return this._addCmd("where", args);
    }

	/**
    * Order the results by specific values
    * Args is an array of maps, where each map represents a column to sort by and it's order.
    * 
    * @param {Object} args Objects for each column to sort, Example: {name:'desc',age:'asc'}
    * @returns {SomeSQLInstance}
    * 
    * @memberOf SomeSQLInstance
    */
    public orderBy(args: Object): SomeSQLInstance {
        return this._addCmd("orderby", args);
    }

	/**
    * Limits the result to a specific amount.
    * 
    * @param {number} args How many items to limit to?
    * @returns {SomeSQLInstance}
    * 
    * @memberOf SomeSQLInstance
    */
    public limit(args: number): SomeSQLInstance {
        return this._addCmd("limit", args);
    }

	/**
    * Offsets the results by a specific amount from the beginning.
    * 
    * @param {number} args What's the offset length?
    * @returns {SomeSQLInstance}
    * 
    * @memberOf SomeSQLInstance
    */
    public offset(args: number): SomeSQLInstance {
        return this._addCmd("offset", args);
    }

	/**
    * Adds a custom filter to the query
    * 
    * @param {string} name
    * @param {*} args
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
    * @param {string} type Command name
    * @param {(Array<any>|Object)} args Command arguments
    * 
    * @memberOf SomeSQLInstance
    */
    private _addCmd(type: string, args: Array<any> | Object): SomeSQLInstance {
        return this._query.push(new TSMap<string, Object | Array<any>>([["type", type], ["args", args]])), this;
    }

	/**
    * Executes the current pending query to the db engine.
    * 
    * @returns {TSPromise<Object|string>}
    * 
    * @memberOf SomeSQLInstance
    */
    public exec(): TSPromise<Array<Object | string>> {

        let t = this;
        let _t = t._selectedTable;

        t._triggerEvents = <any>t._query.map((q) => {
            switch (q.get("type")) {
                case "select": return [q.get("type")];
                case "delete":
                case "upsert":
                case "drop": return [q.get("type"), "change"];
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
                    query: t._query.map((q) => q.toJSON()),
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
    * Plugin system, allows the db engine to support any custom functionality as needed.
    * 
    * @param {string} argType
    * @param {*} args
    * @returns {TSPromise<any>}
    * 
    * @memberOf SomeSQLInstance
    */
    public custom(argType: string, args: any): TSPromise<any> {
        let t = this;
        return new TSPromise((res, rej) => {
            if (t._backend.custom) {
                t._backend.custom.apply(t, [argType, args, res, rej]);
            } else {
                res();
            }
        }, t);
    }

	/**
    * Load JSON directly into the DB.
    * JSON must be an array of maps, like this:
    * [
    *  {"name":"billy","age":20},
    *  {"name":"johnny":"age":30}
    * ]
    * 
    * @param {Array<any>} rows
    * @returns {TSPromise<any>}
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
    * Load a CSV file into the DB.
    * 
    * @param {string} csv
    * @returns {TSPromise<any>}
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
    * @returns {TSPromise<any>}
    * 
    * @memberOf SomeSQLInstance
    */
    public toCSV(headers?: boolean): TSPromise<string> {
        let t = this;
        return new TSPromise((res, rej) => {

            t.exec().then(function (json: Array<Object>) {

                let header = t._query.filter((q) => {
                    return q.get("type") === "select";
                }).map((q) => {
                    return q.get("args") ? (<Array<any>>q.get("args")).map((m) => {
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
    * @param {TSMap<string,Array<Object>>} models
    * @param {TSMap<string,Object>} actions
    * @param {TSMap<string,Object>} views
    * @param {Function} onSuccess
    * @param {Function} [onFail]
    * 
    * @memberOf SomeSQLBackend
    */
    connect(models: TSMap<string, Array<Object>>, actions: TSMap<string, Object>, views: TSMap<string, Object>, filters: TSMap<string, Function>, onSuccess: Function, onFail?: Function): void;

	/**
    * Executes a specific query on the database with a specific table
    * 
    * @param {string} table
    * @param {Array<any>} query
    * @returns {(TSPromise<Array<any>|string>)}
    * 
    * @memberOf SomeSQLBackend
    */
    exec(table: string, query: Array<TSMap<string, Object | Array<any>>>, viewOrAction: string, onSuccess: Function, onFail?: Function): void;

	/**
    * Custom implimentations for this db type, can be literally anything.
    * 
    * @param {string} command
    * @param {*} args
    * @param {Function} callback
    * 
    * @memberOf SomeSQLBackend
    */
    custom?(command: string, args: any, onSuccess: Function, onFail?: Function): void;
}

let _someSQLStatic = new SomeSQLInstance();

export function SomeSQL(table: string) {
    return _someSQLStatic.table(table);
}

