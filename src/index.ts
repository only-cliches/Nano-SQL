import { tsMap } from "typescript-map";
import { tsPromise } from "typescript-promise";
import { someSQL_MemDB } from "Some-SQL-Memory";

export class someSQL_Instance {

    private _selectedTable:string; //Selected Table
    private _query:Array<any>; //Query
    private _backend:someSQL_Backend; //System Backend/Plugin
    private _callbacks:any;//Event Callbacks
    private _events:Array<string>; //Event Types
    private _views:any; //Views
    private _actions:any; //Actions
    private _models:any; //Models
    private _triggerEvents:Array<string>;//Evens to trigger

    constructor(backend?:any) {
        let t = this;
        
        if(backend) {
            t.connect(backend);
        } else {
            t.connect(<any>new someSQL_MemDB(<any> t));
        }

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

    public init(table?:string):someSQL_Instance {
        this._selectedTable = table || '';
        return this;
    }

    /**
     * Plugin System
     */
    public connect(backend:someSQL_Backend):someSQL_Instance {
        this._backend = backend;
        return this;
    }

    /** 
     * Events
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
     * Table Editing Functions
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
        t._backend.newModel(l, dataModel);
        return t;
    }

    public views(viewMap):someSQL_Instance {
        this._views[this._selectedTable] = viewMap;
        return this;
    }

    public getView(viewName, viewArgs):tsPromise<any> {
        let t = this;
        let l = t._selectedTable;
        let v = t._views[l][viewName];
        return v[1](t.init(l), t._cleanArgs(v, viewArgs));
    }

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

    public actions(actionMap):someSQL_Instance {
        this._actions[this._selectedTable] = actionMap;
        return this;
    }

    public doAction(actionName, actionArgs):tsPromise<any> {
        let t = this;
        let l = t._selectedTable;
        let a = t._actions[l][actionName];
        return a[1](t.init(l), t._cleanArgs(a, actionArgs));
    }

    public query(action:string, args?:any):someSQL_Instance {
        this._query = [];
        let a = action.toLowerCase();
        if(['select','upsert','delete','drop'].indexOf(a) != -1) {
            this._query.push({type:a,args:args});
        }
        return this;
    }

    /**
     * Select Functions
     */
    public where(args):someSQL_Instance {
        this._query.push({type:'where',args:args});
        return this;
    }

    public andWhere(args):someSQL_Instance {
        this._query.push({type:'andWhere',args:args});
        return this;
    }

    public orWhere(args):someSQL_Instance {
        this._query.push({type:'orWhere',args:args});
        return this;
    }

    public orderBy(args):someSQL_Instance {
        this._query.push({type:'orderby',args:args});
        return this;
    }

    public limit(args):someSQL_Instance {
        this._query.push({type:'limit',args:args});
        return this;
    }

    public offset(args):someSQL_Instance {
        this._query.push({type:'offset',args:args});
        return this;
    }

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

    public uuid(inputUUID?:string):string {
        return inputUUID ? inputUUID : (function() {
            return  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });   
        })();
    }

    /**
     * Export Functions
     */
    public loadJS(rows:Array<any>):tsPromise<any> {
        let t = this;
        return tsPromise.all( rows.map((row) => {
            return <any> t.init(t._selectedTable).query('upsert',row).exec();
        }));
    } 

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
}

export interface someSQL_Backend {
    parent:someSQL_Instance;

    /**
     * Adds a table and it's data model to the database
     * 
     * @param {string} table
     * @param {*} args
     * 
     * @memberOf someSQL_Backend
     */
    newModel(table:string,args:any):void

    /**
     * Executes a specific query on the database with a specific table
     * 
     * @param {string} table
     * @param {Array<any>} query
     * @returns {(tsPromise<Array<any>|string>)}
     * 
     * @memberOf someSQL_Backend
     */
    exec(table:string, query:Array<any>, callback:Function):void
    
    /**
     * Custom implimentations for this db type, can be literally anything.
     * 
     * @param {string} command
     * @param {*} args
     * @param {Function} callback
     * 
     * @memberOf someSQL_Backend
     */
    custom(command:string, args:any, callback:Function):void
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