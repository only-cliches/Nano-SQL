import { tsMap } from "typescript-map";
import { tsPromise } from "typescript-promise";
import { someSQL_MemDB } from "Some-SQL-Memory";

export class someSQL_Instance {

    /**
     * Holds the current selected table
     * 
     * @internal
     * @type {string}
     * @memberOf someSQL_Instance
     */
    private _selectedTable:string;

    /**
     * Holds an array of the query arguments
     * 
     * @internal
     * @type {Array<any>}
     * @memberOf someSQL_Instance
     */
    private _query:Array<any>; //Query

    /**
     * The backend currently being used
     * 
     * @internal
     * @type {someSQL_Backend}
     * @memberOf someSQL_Instance
     */
    private _backend:someSQL_Backend;

    /**
     * The callbacks for events
     * 
     * @internal
     * @type {*}
     * @memberOf someSQL_Instance
     */
    private _callbacks:any;

    /**
     * An array of possible events
     * 
     * @internal
     * @type {Array<string>}
     * @memberOf someSQL_Instance
     */
    private _events:Array<string>;

    /**
     * A map containing the views
     * 
     * @internal
     * @type {*}
     * @memberOf someSQL_Instance
     */
    private _views:any; //Views

    /**
     * A map containing the actions
     * 
     * @internal
     * @type {*}
     * @memberOf someSQL_Instance
     */
    private _actions:any; //Actions

    /**
     * A map containing the models
     * 
     * @internal
     * @type {*}
     * @memberOf someSQL_Instance
     */
    private _models:any; //Models

    /**
     * An array containing a temporary list of event callbacks
     * 
     * @internal
     * @type {Array<string>}
     * @memberOf someSQL_Instance
     */
    private _triggerEvents:Array<string>;//Evens to trigger

    constructor() {
        let t = this;
        
        t._callbacks = {"*":{}};
        t._actions = {};
        t._views = {};
        t._models = {};
        t._query = [];

        t._events = ['change','delete','upsert','drop','select'];  
        t._events.forEach((e) => {
            t._callbacks['*'][e] = [];
        });  
    }

    /**
     * Changes the table pointer
     * 
     * @param {string} [table]
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public init(table?:string):someSQL_Instance {
        if(table) this._selectedTable = table;
        return this;
    }

    /**
     * Inits the backend database for use
     * 
     * @param {someSQL_Backend} backend
     * @returns {tsPromise<any>}
     * 
     * @memberOf someSQL_Instance
     */
    public connect(backend?:someSQL_Backend):tsPromise<any> {
        let t = this;
        t._backend = backend || new someSQL_MemDB();  
        return new someSQL_Promise(t,(res, rej) => {
            t._backend.connect(t._models, res, rej);
        });
    }

    /**
     * Allows you to apply a callback function to any valid event.
     * 
     * @param {string} actions
     * @param {Function} callBack
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public on(actions:string, callBack:Function):someSQL_Instance {
        actions.split(' ').forEach((a) => {
            if(this._events.indexOf(a) == -1) {
                throw new Error(a + "ins't a valid attachable event!");
            }
            this._callbacks[this._selectedTable][a].push(callBack);
        });
        return this;
    }

    /**
     * Create a new data model for the current selected table.
     * 
     * @param {Array<any>} dataModel
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public model(dataModel:Array<any>):someSQL_Instance {
        let t = this;
        let l = t._selectedTable;
        t._callbacks[l] = {};
        t._events.forEach((v) => {
            t._callbacks[l][v] = [];
        });
        t._models[l] = dataModel;
        t._views[l] = {};
        t._actions[l] = {};
        return this;
        /*return new someSQL_Promise(this, (res, rej) => {
            t._backend.newModel(l, dataModel, res, rej);
        });*/
    }

    /**
     * Set views for the current selected table.
     * 
     * @param {any} viewMap
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public views(viewMap):someSQL_Instance {
        this._views[this._selectedTable] = viewMap;
        return this;
    }

    /**
     * Execute a specific view.
     * 
     * @param {any} viewName
     * @param {any} viewArgs
     * @returns {tsPromise<any>}
     * 
     * @memberOf someSQL_Instance
     */
    public getView(viewName, viewArgs):tsPromise<any> {
        let t = this;
        let l = t._selectedTable;
        let v = t._views[l][viewName];
        return v[1](t.init(l), t._cleanArgs(v, viewArgs));
    }

    /**
     * Take an action or view and it's args, then make sure the args comform to the types declared in the model.
     * 
     * @internal
     * @param {Array<any>} funcArray
     * @param {*} args
     * @returns {*}
     * 
     * @memberOf someSQL_Instance
     */
    private _cleanArgs(funcArray:Array<any>, args:any):any {
        let t = this;
        let l = t._selectedTable;
        let a = {};
        let v = funcArray;
        v[0].forEach((k) => {
            let k2 = k.split(':');
            if(k2.length > 1) {
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
     * @memberOf someSQL_Instance
     */
    private _cast(type:string, val:any) {
        switch(['string','int','float','array','map'].indexOf(type)) {
            case 0:return String(val);
            case 1:return parseInt(val);
            case 2:return parseFloat(val);
            case 3:
            case 4:return JSON.parse(JSON.stringify(val));
            default:return val;
        }
    }

    /**
     * Declare a map of actions for the current table.
     * 
     * @param {any} actionMap
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public actions(actionMap):someSQL_Instance {
        this._actions[this._selectedTable] = actionMap;
        return this;
    }

    /**
     * Init an action for the current selected table.
     * 
     * @param {any} actionName
     * @param {any} actionArgs
     * @returns {tsPromise<any>}
     * 
     * @memberOf someSQL_Instance
     */
    public doAction(actionName, actionArgs):tsPromise<any> {
        let t = this;
        let l = t._selectedTable;
        let a = t._actions[l][actionName];
        return a[1](t.init(l), t._cleanArgs(a, actionArgs));
    }

    /**
     * Start a query into the current selected table.
     * 
     * @param {string} action
     * @param {*} [args]
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public query(action:string, args?:any):someSQL_Instance {
        this._query = [];
        let a = action.toLowerCase();
        if(['select','upsert','delete','drop'].indexOf(a) != -1) {
            this._query.push({type:a,args:args});
        }
        return this;
    }

    /**
     * Narrow down your search by a single where clause:
     * [value,comparison,check], for example:
     * ['name','=','berry'] or ['name','IN',['berry','john']]
     * 
     * @param {any} args
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public where(args):someSQL_Instance {
        this._query.push({type:'where',args:args});
        return this;
    }

    /**
     * An array of where statements, identical to chaining multiple where statements.
     * [whereStatement,whereStatement,whereStatement]
     * 
     * @param {any} args
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public andWhere(args):someSQL_Instance {
        this._query.push({type:'andWhere',args:args});
        return this;
    }

    /**
     * An array of where statements that do an OR comparison instead of AND.
     * 
     * @param {any} args
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public orWhere(args):someSQL_Instance {
        this._query.push({type:'orWhere',args:args});
        return this;
    }

    /**
     * Order the results by specific values
     * Args is an array of maps, where each map represents a column to sort by and it's order.
     * 
     * @param {any} args Example: [{"name":"asc"},{"age":"desc"}]
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public orderBy(args):someSQL_Instance {
        this._query.push({type:'orderby',args:args});
        return this;
    }

    /**
     * Limits the result to a specific amount.
     * 
     * 
     * @param {any} args A number representing the current limit amount
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public limit(args):someSQL_Instance {
        this._query.push({type:'limit',args:args});
        return this;
    }

    /**
     * Offsets the results by a specific amount from the beginning.
     * 
     * @param {any} args A number representing the desired offset
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public offset(args):someSQL_Instance {
        this._query.push({type:'offset',args:args});
        return this;
    }

    /**
     * Executes the current pending query to the db engine.
     * 
     * @returns {tsPromise<any>}
     * 
     * @memberOf someSQL_Instance
     */
    public exec():tsPromise<any> {
        //trigger events
        let t = this;
        let _t = t._selectedTable;
        t._triggerEvents = [];
        this._query.map((q) => {
            switch(q.type) {
                case "select":return [q.type];
                case "delete":
                case "upsert":
                case "drop":return [q.type,'change'];
                default:return []
            }
        }).forEach((events) => {
            events.forEach((event) => {
                t._triggerEvents.push(event);
            });
        });

        return new someSQL_Promise(this, (res, rej) => {  
            t._backend.exec(_t, t._query,function(rows) {
                t._triggerEvents.forEach((e) => {
                    t._callbacks[_t][e].concat(t._callbacks['*'][e]).forEach((cb) => {
                        cb({
                            type:e,
                            table:_t,
                            query:t._query,
                            time:new Date().getTime(),
                            result:rows
                        });
                    });
                });
                res(rows);
            });
        });
    }

    /**
     * Plugin system, allows the db engine to support any custom functionality as needed.
     * 
     * @param {string} argType
     * @param {*} args
     * @returns {tsPromise<any>}
     * 
     * @memberOf someSQL_Instance
     */
    public custom(argType:string, args:any):tsPromise<any> {
        let t = this;
        return new someSQL_Promise(t, (res, rej) => {
            if(t._backend.custom) {
                t._backend.custom(argType, args, res)
            } else {
                res();
            }
        });
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
     * @returns {tsPromise<any>}
     * 
     * @memberOf someSQL_Instance
     */
    public loadJS(rows:Array<any>):tsPromise<any> {
        let t = this;
        return tsPromise.all( rows.map((row) => {
            return <any> t.init(t._selectedTable).query('upsert',row).exec();
        }));
    } 

    /**
     * Load a CSV file into the DB.
     * 
     * @param {string} csv
     * @returns {tsPromise<any>}
     * 
     * @memberOf someSQL_Instance
     */
    public loadCSV(csv:string):tsPromise<any> {
        let t = this;
        let fields = [];

        return new someSQL_Promise(t,(res, rej) => {
            tsPromise.all(csv.split('\n').map((v, k) => {
                return new someSQL_Promise(t,(resolve, reject) => {
                    if(k == 0) {
                        fields = v.split(',');
                        resolve();
                    } else {
                        let record = {};
                        let row = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g).map(str => str.replace(/^"(.+(?="$))"$/, '$1'));
                        fields.forEach((f,i) => {
                            if(row[i].indexOf('{') == 0 || row[i].indexOf('[') == 0) {
                                row[i] = JSON.parse(row[i].replace(/'/g,'"'));
                            }
                            record[f] = row[i];
                        });
                        t.init(t._selectedTable).query('upsert',row).exec().then(() => {
                            resolve();
                        });
                    }
                });
            })).then(function() {
                res();
            });
        });
    }

    /**
     * Export the current query to a CSV file.
     * 
     * @param {boolean} [headers]
     * @returns {tsPromise<any>}
     * 
     * @memberOf someSQL_Instance
     */
    public toCSV(headers?:boolean):tsPromise<any> {
        let t = this;
        return new someSQL_Promise(t,(res, rej) => {
            t.exec().then(function(json) {
                let header = t._query.filter((q) => {
                    return q.type == 'select';
                }).map((q) => {
                    return q.args ? q.args.map((m) => {
                        return t._models[t._selectedTable].filter((f) => f.key == m)[0]
                    }) : t._models[t._selectedTable];
                })[0];

                if(headers) {
                    json.unshift(header.map((h) => {
                        return h.key;
                    }));
                }

                res(json.map((row, i) => {
                    if(headers && i == 0) return row;
                    return header.filter((column) => {
                        return row[column.key] ? true : false;
                    }).map((column) => {
                        switch(column.type) {
                            case "map":return '"' + JSON.stringify(row[column.key]).replace(/"/g,"'") + '"';
                            case "array":return '"' + JSON.stringify(row[column.key]).replace(/"/g,"'") + '"';
                            default:return JSON.stringify(row[column.key]);
                        }
                    }).join(',');
                }).join('\n'));
            })
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
     * @memberOf someSQL_Instance
     */
    public static uuid(inputUUID?:string):string {
        return inputUUID ? inputUUID : (function() {
            return  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });   
        })();
    }
}

export interface someSQL_Backend {

    /**
     * Inilitize the database for use, async so you can connect to remote stuff as needed.
     * 
     * @param {*} models //Map of data models
     * @param {Function} onSuccess
     * @param {Function} [onFail]
     * 
     * @memberOf someSQL_Backend
     */
    connect(models:any, onSuccess:Function, onFail?:Function):void

    /**
     * Executes a specific query on the database with a specific table
     * 
     * @param {string} table
     * @param {Array<any>} query
     * @returns {(tsPromise<Array<any>|string>)}
     * 
     * @memberOf someSQL_Backend
     */
    exec(table:string, query:Array<any>, onSuccess:Function, onFail?:Function):void
    
    /**
     * Custom implimentations for this db type, can be literally anything.
     * 
     * @param {string} command
     * @param {*} args
     * @param {Function} callback
     * 
     * @memberOf someSQL_Backend
     */
    custom?(command:string, args:any, onSuccess:Function, onFail?:Function):void
}

/**
 * Extended classs of the promise to make sure the "Then" and "catch" functions maintain scope of the database "this" var.
 * 
 * @class someSQL_Promise
 * @extends {tsPromise<any>}
 */
class someSQL_Promise extends tsPromise<any> {
    private scope:someSQL_Instance;

    constructor(scope:someSQL_Instance, callBackFunc?:(res?:Function,rej?:Function) => void) {
        super(callBackFunc);
        this.scope = scope;
    }

    public then(onSuccess?:Function, onFail?:Function):tsPromise<any> {
        var parent = this;
        return new someSQL_Promise(parent.scope,(resolve, reject) => {
            parent.done(function (value) {
                if (typeof onSuccess === 'function') {
                    try {
                        value = onSuccess.apply(parent.scope,[value]);
                    } catch (e) {
                        reject(e);
                        return;
                    }
                }
                resolve(value);
            }, function (value) {
                if (typeof onFail === 'function') {
                    try {
                        value = onFail.apply(parent.scope,[value]);
                    } catch (e) {
                        reject(e);
                        return;
                    }
                    resolve(value);
                } else {
                    reject(value);
                }
            });
        });
    }
}

var someSQL_Selectedtableatic = new someSQL_Instance();
export function someSQL(table?:string):someSQL_Instance {
    return someSQL_Selectedtableatic.init(table);
}