import { someSQL_Instance, someSQL_Backend } from "./index.ts";
import { tsPromise } from "typescript-promise";
import { tsMap } from "typescript-map";

export class someSQL_MemDB implements someSQL_Backend {

    private _tables:tsMap<string,Array<Object>>; //Tables object
    private _models:tsMap<string,Array<Object>>; //Modles object
    private _sT:string; //Selected table
    private _act:tsMap<string,any>; //Query action
    private _mod:Array<tsMap<string,any>>; //Query modifiers
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

    public connect(models:tsMap<string,Array<Object>>,callback:Function):void {
        let t = this;
        models.forEach((model, table) => {
            t._newModel(table, model);
        });
        callback();
    }

    private _newModel(table:string, args:Array<Object>):void {
        this._models.set(table, args);
        this._tables.set(table, []);
        this._tIndex.set(table, []);
        this._i.set(table,1);
    }

    public exec(table:string, query:Array<tsMap<string,Object|Array<any>>>, onSuccess:Function, onFail?:Function):void {
        let t = this;
        t._sT = table;
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


    private _query(queryArg:tsMap<string,number|Object|Array<any>>, resolve:Function):void {
        if(['upsert','select','delete','drop'].indexOf(<string> queryArg.get("type")) != -1) {
            this._act = queryArg;
        }
        if(['where','orderby','limit','offset','andWhere','orWhere'].indexOf(<string> queryArg.get("type")) != -1) {
            this._mod.push(queryArg);
        }
        resolve();
    }

    private _exec(callBack:Function):void {
        let t = this;

        switch(t._act.get('type')) {
            case "upsert": 
                let msg = 0;
                let cacheInvalidate = (index:string|number) => {
                    t._tCacheI.forEach((v, key2) => {
                        if(v && v.indexOf(<any> index) != -1) {
                            t._tCacheI.delete(key2);
                            t._immu.delete(key2);
                        }
                    });
                };
                let hasWhere = t._mod.filter((v) => {
                    return ['where','andWhere','orWhere'].indexOf(<string> v.get('type')) == -1 ? false : true;
                });
                if(hasWhere.length) {
                    let rows = t._where(t._tIndex.get(t._sT));
                    let ta = t._tables.get(t._sT);
                    rows.forEach((v,k) => {
                        //Perform the upsert
                        for(var key in t._act.get('args')) {
                            ta[v][key] = t._act.get('args')[key];
                        }
                        //Invalidate Cache
                        cacheInvalidate(k);
                        msg++;
                    });
                } else {
                    let key = "";
                    t._models.get(t._sT).forEach((m) => {
                        //Gemerate new UUIDs as needed
                        if(m['type'] == 'uuid' && !t._act.get('args')[m['key']]) {
                            t._act.get('args')[m['key']] = someSQL_Instance.uuid();
                        }
                        //Find primary key
                        if(m['props'] && m['props'].indexOf('pk') != -1) {
                            key = m['key'];
                            if(m['props'].indexOf('ai') != -1 && !t._act.get('args')[m['key']]) {
                                t._act.get('args')[m['key']] = t._i.get(t._sT);
                                t._i.set(t._sT,t._i.get(t._sT)+1);
                            }
                        }
                    });
                    //set Index
                    let i = t._act.get('args')[key];
                    if(t._tIndex.get(t._sT).indexOf(i) == -1) { 
                        //Add index to the table
                        t._tIndex.get(t._sT).push(i); 
                    } else {
                        //Invalidate immutable cache as needed
                        cacheInvalidate(i);
                    }

                    //Set data into table.  Data is stored in a mutable state.
                    t._tables.get(t._sT)[i] = t._act.get('args');     
                    msg++;
                }
                callBack(msg + " row(s) upserted");
            break;
            case "select":

                if(!t._immu.has(t._cacheKey)) {
                    let ta = t._tables.get(t._sT);
                    t._tCacheI.set(t._cacheKey,[]);
                    t._immu.set(t._cacheKey, JSON.parse(JSON.stringify(t._where(t._tIndex.get(t._sT)) //WHERE
                        .sort((a, b) => { //Handle Order By
                            return t._mod.filter((v) => {
                                return v['type'] == 'orderby'
                            }).map((v) => {
                                for (var prop in v.get('args')) {
                                    if(ta[a][prop] == ta[b][prop]) return 0;
                                    let result = ta[a][prop] > ta[b][prop] ? 1 : -1;
                                    return v.get('args')[prop] == 'asc' ? result : -result;
                                } 
                            }).reduce((c, d) => c + d, 0) || 0;
                        })
                        .filter((v, k) => { //Handle offset/limit
                            let os = 0;//offset
                            return !t._mod.filter((f) => {
                                return ['limit','offset'].indexOf(f['type']) != -1;
                            }).sort((a, b) => {
                                //force offset commands first
                                return a['type'] < b['type'] ? 1 : -1;
                            }).map((f, i) => {
                                switch(f['type']) {
                                    case"offset":os=f.get('args');return k >= f.get('args') ? 0 : 1; 
                                    case"limit":return k < (os+f.get('args')) ? 0 : 1;
                                }
                            }).reduce((c, d) => c + d, 0);
                        })
                        .map((v, k) => { //Select specific columns
                            t._tCacheI.get(t._cacheKey).push(k);
                            if(t._act.get('args') && t._act.get('args').length) {
                                let obj = JSON.parse(JSON.stringify(ta[v]));
                                t._models.get(t._sT).forEach((m) => {
                                    if(t._act.get('args').indexOf(m['key']) == -1) {
                                        delete obj[m['key']];
                                    }
                                })
                                return obj;
                            } else {
                                return ta[v]; 
                            }
                    }))));
                }
                callBack(t._immu.get(t._cacheKey));
            break;
            case "delete":
                let rows = t._where(t._tIndex.get(t._sT));
                let ta = t._tables.get(t._sT);
                rows.forEach((v,k) => {
                    delete ta[v];
                    t._tIndex.get(t._sT).splice(t._tIndex.get(t._sT).indexOf(<number> v),1);
                    t._tCacheI.forEach((val, key2) => {
                        if(val && val.indexOf(<number> v) != -1) {
                            t._tCacheI.delete(key2);
                            t._immu.delete(key2);
                        }
                    });
                });
                callBack(rows.length + " row(s) deleted");      
            break;
            case "drop":
                t._tables.set(t._sT,[]);
                t._tIndex.set(t._sT,[]);
                t._i.set(t._sT,1);
                callBack('Success');
            break;
        }
    }

    private _where(tableIndexes:Array<string|number>):Array<number|string> {
        let t = this;
        let ta = t._tables.get(t._sT);
        return tableIndexes.filter((v, k) => {//Handle WHERE/ and WHERE statements
            let andWhere = [];
            //Put all the andWheres together with the wheres
            t._mod.filter((f) => {
                return f.get('type') == 'andWhere';
            }).forEach((f) => {
                f.get('args').forEach((f2) => {
                    andWhere.push({
                        type:'where',
                        args:f2
                    });
                });
            });

            return t._mod.filter((f) => {
                return f.get('type') == 'where';
            }).concat(andWhere).map((f) => {
                return t._models.get(t._sT).map((m) => {
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

            return t._models.get(t._sT).map((m) => {
                return ors.filter((arg) => {
                    return t._compare(arg[2], arg[1], ta[<string> index][m['key']]) == 1 ? false : true;
                }).length
            }).filter(f => f > 0).length > 0 ? true : false
        });
    }

    private _compare(val1, compare, val2) {
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