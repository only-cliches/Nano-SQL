import { someSQL_Instance, someSQL_Backend } from "./index.ts";
import { tsPromise } from "typescript-promise";
import { tsMap } from "typescript-map";

export class someSQL_MemDB implements someSQL_Backend {

    /**
     * Holds the actual table data.
     * 
     * @private
     * @type {tsMap<string,Array<Object>>}
     * @memberOf someSQL_MemDB
     */
    private _tables:tsMap<string,Array<Object>>; //Tables object

    /**
     * Holds the data models for each table
     * 
     * @private
     * @type {tsMap<string,Array<Object>>}
     * @memberOf someSQL_MemDB
     */
    private _models:tsMap<string,Array<Object>>; //Modles object

    /**
     * Holds a pointer to the current selected table.
     * 
     * @private
     * @type {string}
     * @memberOf someSQL_MemDB
     */
    private _selectedTable:string; //Selected table

    /**
     * Holds a single query object of the current query actions.
     * 
     * @private
     * @type {(tsMap<string,Object|Array<any>>)}
     * @memberOf someSQL_MemDB
     */
    private _act:tsMap<string,Object|Array<any>>; //Query action

    /**
     * Holds an array of the remaining query objects to modify the query in some way.
     * 
     * @private
     * @type {(Array<tsMap<string,Object|Array<any>>>)}
     * @memberOf someSQL_MemDB
     */
    private _mod:Array<tsMap<string,Object|Array<any>>>; //Query modifiers

    private _cacheKey:string; //Cache key for current query
    private _tIndex:tsMap<string,Array<number>>; //Table index
    private _tCacheI:tsMap<string,Array<number>>; //Table cache index
    private _immu:tsMap<string,Object>; //Immutable cache store
    private _i:tsMap<string,number>; //Auto incriment holder

    constructor() {
        let t = this;
        t._tables = new tsMap<string,Array<Object>>();
        t._tIndex = new tsMap<string,Array<number>>();
        t._models = new tsMap<string,Array<Object>>();
        t._tCacheI = new tsMap<string,Array<number>>();
        t._immu = new tsMap<string,Object>();
        t._i = new tsMap<string,number>();
    }

    /**
     * Creates all the tables and prepares the database for use.
     * 
     * @param {tsMap<string,Array<Object>>} models
     * @param {tsMap<string,Object>} actions
     * @param {tsMap<string,Object>} views
     * @param {Function} callback
     * 
     * @memberOf someSQL_MemDB
     */
    public connect(models:tsMap<string,Array<Object>>, actions:tsMap<string,Object>, views:tsMap<string,Object>, callback:Function):void {
        let t = this;
        models.forEach((model, table) => {
            t._newModel(table, model);
        });
        callback();
    }

    /**
     * Creats a new table in the database or clears and existing one.
     * 
     * @private
     * @param {string} table
     * @param {Array<Object>} args
     * 
     * @memberOf someSQL_MemDB
     */
    private _newModel(table:string, args:Array<Object>):void {
        this._models.set(table, args);
        this._tables.set(table, []);
        this._tIndex.set(table, []);
        this._i.set(table,1);
    }

    /**
     * Public exec option.  Organizes the query then sends it to the internal execution function.
     * 
     * @param {string} table
     * @param {(Array<tsMap<string,Object|Array<any>>>)} query
     * @param {string} viewOrAction
     * @param {Function} onSuccess
     * @param {Function} [onFail]
     * 
     * @memberOf someSQL_MemDB
     */
    public exec(table:string, query:Array<tsMap<string,Object|Array<any>>>, viewOrAction:string, onSuccess:Function, onFail?:Function):void {
        let t = this;
        t._selectedTable = table;
        t._mod = [];
        t._act = null;
        t._cacheKey = someSQL_Instance.hash(JSON.stringify(query));
        tsPromise.all(query.map((q) => {
            return new tsPromise(function(resolve, reject) {
                t._query(q, resolve);
            });
        })).then(function() {
            t._exec(onSuccess);
        });
    }

    /**
     * Puts the query from the someSQL Instance into query actions and mofidiers to make execution easier.
     * 
     * @private
     * @param {(tsMap<string,number|Object|Array<any>>)} queryArg
     * @param {Function} resolve
     * 
     * @memberOf someSQL_MemDB
     */
    private _query(queryArg:tsMap<string,number|Object|Array<any>>, resolve:Function):void {
        if(['upsert','select','delete','drop'].indexOf(<string> queryArg.get("type")) != -1) {
            this._act = queryArg;
        }
        if(['where','orderby','limit','offset','andWhere','orWhere'].indexOf(<string> queryArg.get("type")) != -1) {
            this._mod.push(queryArg);
        }
        resolve();
    }

    /**
     * Execute commands on the databse to retrieve or modify data as desired.
     * 
     * @private
     * @param {Function} callBack
     * 
     * @memberOf someSQL_MemDB
     */
    private _exec(callBack:Function):void {
        let t = this;

        let hasWhere = t._mod.filter((v) => {
            return ['where','andWhere','orWhere'].indexOf(<string> v.get('type')) == -1 ? false : true;
        });

        let qArgs:any = t._act.get('args');

        switch(t._act.get('type')) {
            case "upsert": 
                let msg = 0;
                let cacheInvalidate = (rowIndex:string|number) => {
                    t._tCacheI.forEach((v, key2) => {
                        if(v && v.indexOf(<any> rowIndex) != -1) {
                            t._tCacheI.delete(key2);
                            t._immu.delete(key2);
                        }
                    });
                };

                if(hasWhere.length) {
                    let rows = t._where(t._tIndex.get(t._selectedTable));
                    let ta = t._tables.get(t._selectedTable);
                    rows.forEach((v,k) => {
                        //Perform the upsert
                        for(var key in qArgs) {
                            ta[v][key] = qArgs[key];
                        }
                        //Invalidate Cache
                        cacheInvalidate(k);
                        msg++;
                    });
                } else {
                    let key = "";
                    t._models.get(t._selectedTable).forEach((m) => {
                        //Gemerate new UUIDs as needed
                        if(m['type'] == 'uuid' && !qArgs[m['key']]) {
                            qArgs[m['key']] = someSQL_Instance.uuid();
                        }
                        //Find primary key
                        if(m['props'] && m['props'].indexOf('pk') != -1) {
                            key = m['key'];
                            if(m['props'].indexOf('ai') != -1 && !qArgs[m['key']]) {
                                qArgs[m['key']] = t._i.get(t._selectedTable);
                                t._i.set(t._selectedTable,t._i.get(t._selectedTable)+1);
                            }
                        }
                    });
                    //set Index
                    let i = qArgs[key];
                    if(t._tIndex.get(t._selectedTable).indexOf(i) == -1) { 
                        //Add index to the table
                        t._tIndex.get(t._selectedTable).push(i); 
                    } else {
                        //Invalidate immutable cache as needed
                        cacheInvalidate(i);
                    }

                    //Set data into table.  Data is stored in a mutable state.
                    t._tables.get(t._selectedTable)[i] = qArgs;     
                    msg++;
                }
                callBack(msg + " row(s) upserted");
            break;
            case "select":

                //if(!t._immu.has(t._cacheKey)) {

                    //TODO: Fix the query caching to get the immutable magic back
                    let table = t._tables.get(t._selectedTable);
     
                    t._tCacheI.set(t._cacheKey,[]);
                    t._immu.set(t._cacheKey, JSON.parse(JSON.stringify(t._where(t._tIndex.get(t._selectedTable)) //WHERE
                        .sort((a, b) => { //Handle Order By
                            return t._mod.filter((v) => {
                                return v.get('type') == 'orderby'
                            }).map((v) => {
                                for (var prop in v.get('args')) {
                                    if(table[a][prop] == table[b][prop]) return 0;
                                    let result = table[a][prop] > table[b][prop] ? 1 : -1;
                                    return v.get('args')[prop] == 'asc' ? result : -result;
                                } 
                            }).reduce((c, d) => c + d, 0) || 0;
                        })
                        .filter((rowIndex, whereIndex) => { //Handle offset/limit
                            let os = 0;//offset
                            return !t._mod.filter((f) => {
                                return ['limit','offset'].indexOf(<string> f.get('type')) != -1;
                            }).sort((a, b) => {
                                //force offset commands first
                                return a.get('type') < b.get('type') ? 1 : -1;
                            }).map((f, i) => {
                                switch(f.get('type')) {
                                    case"offset":os=<number> f.get('args');return whereIndex >= f.get('args') ? 0 : 1; 
                                    case"limit":return whereIndex < (os+(<number> f.get('args'))) ? 0 : 1;
                                }
                            }).reduce((c, d) => c + d, 0);
                        })
                        .map((rowIndex, whereIndex) => { //Select specific columns
                            //t._tCacheI.get(t._cacheKey).push(rowIndex);
                            if(qArgs && qArgs.length) {
                                let obj = {};
                                t._models.get(t._selectedTable).forEach((m) => {
                                    if(qArgs.indexOf(m['key']) != -1) {
                                        obj[m['key']] = table[rowIndex][m['key']];
                                    }
                                });
                                return obj;
                            } else {
                                return table[rowIndex]; 
                            }
                    }))));
                //}
                callBack(t._immu.get(t._cacheKey));
            break;
            case "delete":
                if(hasWhere.length) {
                    let rows = t._where(t._tIndex.get(t._selectedTable));
                    let ta = t._tables.get(t._selectedTable);
                    rows.forEach((rowIndex,whereIndex) => {
                        delete ta[rowIndex];
                        t._tIndex.get(t._selectedTable).splice(t._tIndex.get(t._selectedTable).indexOf(<number> rowIndex),1);
                        /*t._tCacheI.forEach((val, key2) => {
                            if(val && val.indexOf(<number> v) != -1) {
                                t._tCacheI.delete(key2);
                                t._immu.delete(key2);
                            }
                        });*/
                    });
                    callBack(rows.length + " row(s) deleted");  
                } else {
                    t._newModel(t._selectedTable, t._models.get(t._selectedTable));
                    callBack('Table dropped.');
                }
            break;
            case "drop":
                t._newModel(t._selectedTable, t._models.get(t._selectedTable));
                callBack('Table dropped.');
            break;
        }
    }

    /**
     * Accepts an array of table indexes to narrow down, then uses the current query to reduce the indexes down to the desired ones.
     * 
     * @private
     * @param {(Array<string|number>)} tableIndexes
     * @returns {(Array<number|string>)}
     * 
     * @memberOf someSQL_MemDB
     */
    private _where(tableIndexes:Array<string|number>):Array<number|string> {
        let t = this;
        let ta = t._tables.get(t._selectedTable);
        return tableIndexes.filter((v, k) => {//Handle WHERE/ and WHERE statements
            let andWhere = [];
            //Put all the andWheres together with the wheres
            t._mod.filter((f) => {
                return f.get('type') == 'andWhere';
            }).forEach((f) => {
                (<Array<any>> f.get('args')).forEach((f2) => {
                    andWhere.push({
                        type:'where',
                        args:f2
                    });
                });
            });
            return t._mod.filter((f) => {
                return f.get('type') == 'where'; //only where commands
            }).concat(andWhere).map((f) => {
                //perform comparison
                return t._models.get(t._selectedTable).map((m) => {
                    return m['key'] == f.get('args')[0] ? t._compare(f.get('args')[2], f.get('args')[1], ta[<string> v][m['key']]) : 0;
                }).reduce((a, b) => a + b, 0);
            }).reduce((a, b) => a + b, 0) == 0 ? true : false;
        }).filter((index) => {//Handle or WHERE statements
            let ors = [];
            t._mod.map((mo) => {
                if(mo['type'] == 'orWhere') {
                    mo['args'].forEach((a) => {
                        ors.push(a);
                    })
                }
            });

            if(ors.length == 0) return true;

            return t._models.get(t._selectedTable).map((m) => {
                return ors.filter((arg) => {
                    return t._compare(arg[2], arg[1], ta[<string> index][m['key']]) == 1 ? false : true;
                }).length
            }).filter(f => f > 0).length > 0 ? true : false
        });
    }

    /**
     * Accepts two values and something to comapre them against, returns a boolean that can be used in an array FILTER function.
     * 
     * @private
     * @param {*} val1
     * @param {string} compare
     * @param {*} val2
     * @returns {number}
     * 
     * @memberOf someSQL_MemDB
     */
    private _compare(val1:any, compare:string, val2:any):number {
        switch(compare) {
            case "=":return val2 == val1 ? 0 : 1;
            case ">":return val2 > val1 ? 0 : 1;
            case "<":return val2 < val1 ? 0 : 1;
            case "<=":return val2 <= val1 ? 0 : 1;
            case ">=":return val2 >= val1 ? 0 : 1;
            case "IN":return val1.indexOf(val2) == -1 ? 1 : 0;
            case "NOT IN":return val1.indexOf(val2) == -1 ? 0 : 1;
            case "LIKE":return val2.search(val1) == -1 ? 1 : 0;
            default:return 0;
        }       
    }
}