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
    private _query:Array<tsMap<string,Object|Array<any>>>; 

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
    private _callbacks:tsMap<string,tsMap<string,Array<Function>>>;

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
    private _views:tsMap<string,Object>; //Views

    /**
     * A map containing the actions
     * 
     * @internal
     * @type {*}
     * @memberOf someSQL_Instance
     */
    private _actions:tsMap<string,Object>; //Actions

    /**
     * A map containing the models
     * 
     * @internal
     * @type {*}
     * @memberOf someSQL_Instance
     */
    private _models:tsMap<string,Array<Object>>; //Models

    /**
     * An array containing a temporary list of events to trigger
     * 
     * @internal
     * @type {Array<string>}
     * @memberOf someSQL_Instance
     */
    private _triggerEvents:Array<string>;

    constructor() {
        let t = this;
        t._callbacks = new tsMap<string,tsMap<string,Array<Function>>>();
        t._callbacks.set("*",new tsMap<string,Array<Function>>());

        t._actions = new tsMap<string,Object>();
        t._views = new tsMap<string,Object>();
        t._models = new tsMap<string,Array<Object>>();
        t._query = [];

        t._events = ['change','delete','upsert','drop','select'];  
        t._events.forEach((e) => {
            t._callbacks.get("*").set(e,[]);
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
    public connect(backend?:someSQL_Backend):tsPromise<Object|string> {
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
            this._callbacks.get(this._selectedTable).get(a).push(callBack);
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
    public model(dataModel:Array<Object>):someSQL_Instance {
        let t = this;
        let l = t._selectedTable;
        t._callbacks.set(l,new tsMap<string,Array<Function>>());
        t._events.forEach((v) => {
            t._callbacks.get("*").set(v,[]);
        });
        t._models.set(l,dataModel);
        t._views.set(l,{});
        t._actions.set(l,{});
        return this;
    }

    /**
     * Set views for the current selected table.
     * 
     * @param {any} viewMap
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public views(viewMap:Object):someSQL_Instance {
        this._views.set(this._selectedTable,viewMap);
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
    public getView(viewName:string, viewArgs:Object):tsPromise<Object|string> {
        let t = this;
        let l = t._selectedTable;
        let v = t._views.get(l)[viewName];
        return v[1].apply(t,[t._cleanArgs(v[0], viewArgs)]);
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
    private _cleanArgs(argDeclarations:Array<string>, args:Object):Object {
        let t = this;
        let l = t._selectedTable;
        let a = {};
        argDeclarations.forEach((k) => {
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
    private _cast(type:string, val:any):any {
        switch(['string','int','float','array','map'].indexOf(type)) {
            case 0:return String(val);
            case 1:return parseInt(val);
            case 2:return parseFloat(val);
            case 3:
            case 4:return JSON.parse(JSON.stringify(val));
            default:return "";//Nullify the variable if it isn't castable
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
    public actions(actionMap:Object):someSQL_Instance {
        this._actions.set(this._selectedTable,actionMap);
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
    public doAction(actionName:string, actionArgs:Object):tsPromise<Object|string> {
        let t = this;
        let l = t._selectedTable;
        let a = t._actions.get(l)[actionName];
        return a[1].apply(t,[t._cleanArgs(a[0], actionArgs)]);
    }

    /**
     * Start a query into the current selected table.
     * 
     * @param {string} action
     * @param {Object} [args]
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public query(action:string, args?:Object):someSQL_Instance {
        this._query = [];
        let a = action.toLowerCase();
        if(['select','upsert','delete','drop'].indexOf(a) != -1) {
            this._query.push(new tsMap<string, Object|Array<any>>([['type',a],['args',args]]));
        }
        return this;
    }

    /**
     * Narrow down your search by a single where clause:
     * [value,comparison,check], for example:
     * 
     * @param {Array<any>} args ['name','=','berry'] or ['name','IN',['berry','john']]
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public where(args:Array<any>):someSQL_Instance {
        this._addCmd('where',args);
        return this;
    }

    /**
     * An array of where statements, identical to chaining multiple where statements.
     * 
     * @param {Array<Array<any>>} args [whereStatement,whereStatement,whereStatement]
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public andWhere(args:Array<Array<any>>):someSQL_Instance {
        this._addCmd('andWhere',args);
        return this;
    }

    /**
     * An array of where statements that do an OR comparison instead of AND.
     * 
     * @param {Array<Array<any>>} args [whereStatement,whereStatement,whereStatement]
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public orWhere(args:Array<Array<any>>):someSQL_Instance {
        this._addCmd('orWhere',args);
        return this;
    }

    /**
     * Order the results by specific values
     * Args is an array of maps, where each map represents a column to sort by and it's order.
     * 
     * @param {Array<Object>} args Array of objects for each column to sort, Example: [{name:'desc'},{age:'asc'}]
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public orderBy(args:Array<Object>):someSQL_Instance {
        this._addCmd('orderby',args);
        return this;
    }

    /**
     * Limits the result to a specific amount.
     * 
     * @param {number} args How many items to limit to?
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public limit(args:number):someSQL_Instance {
        this._addCmd('limit',args);
        return this;
    }

    /**
     * Offsets the results by a specific amount from the beginning.
     * 
     * @param {number} args What's the offset length?
     * @returns {someSQL_Instance}
     * 
     * @memberOf someSQL_Instance
     */
    public offset(args:number):someSQL_Instance {
        this._addCmd('offset',args);
        return this;
    }

    /**
     * Used to add a command to the query
     * 
     * @internal
     * @param {string} type Command name
     * @param {(Array<any>|Object)} args Command arguments
     * 
     * @memberOf someSQL_Instance
     */
    private _addCmd(type:string,args:Array<any>|Object):void {
        this._query.push(new tsMap<string, Object|Array<any>>([['type',type],['args',args]]));
    }

    /**
     * Executes the current pending query to the db engine.
     * 
     * @returns {tsPromise<Object|string>}
     * 
     * @memberOf someSQL_Instance
     */
    public exec():tsPromise<Array<Object|string>> {
        //trigger events
        let t = this;
        let _t = t._selectedTable;
        t._triggerEvents = [];
        this._query.map((q) => {
            switch(q.get('type')) {
                case "select":return [q.get('type')];
                case "delete":
                case "upsert":
                case "drop":return [q.get('type'),'change'];
                default:return []
            }
        }).forEach((events) => {
            events.forEach((event:string) => {
                t._triggerEvents.push(event);
            });
        });

        return new someSQL_Promise(this, (res, rej) => {  
            t._backend.exec(_t, t._query,function(rows) {
                t._triggerEvents.forEach((e) => {
                    t._callbacks.get(_t).get(e).concat(t._callbacks.get('*').get(e)).forEach((cb) => {
                        cb.apply(t,[{
                            type:e,
                            table:_t,
                            query:t._query,
                            time:new Date().getTime(),
                            result:rows
                        }]);
                    });
                });
                res(rows);
            },(err) => {
                rej(err);
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
                t._backend.custom(argType, args, res, rej)
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
    public loadJS(rows:Array<Object>):tsPromise<Object|string> {
        let t = this;
        return tsPromise.all(rows.map((row) => {
            return t.init(t._selectedTable).query('upsert',row).exec();
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
    public loadCSV(csv:string):tsPromise<Object|string> {
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
    public toCSV(headers?:boolean):tsPromise<string> {
        let t = this;
        return new someSQL_Promise(t,(res, rej) => {

            t.exec().then(function(json:Array<Object>) {
                let header = t._query.filter((q) => {
                    return q.get('type') == 'select';
                }).map((q) => {
                    return q.get('args') ? (<Array<any>> q.get('args')).map((m) => {
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
    connect(models:tsMap<string,Array<Object>>, onSuccess:Function, onFail?:Function):void

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