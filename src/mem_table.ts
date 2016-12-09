import { someSQL_Instance, someSQL_Backend } from "./index";
import { tsPromise } from "typescript-promise";

export class someSQL_MemDB extends someSQL_Backend {

    private _tables:any; //Tables object
    private _models:any; //Modles object
    private _sT:string; //Selected table
    private _act:any; //Query action
    private _mod:Array<any>; //Query modifiers
    private _cacheKey:any; //Cache key for current query
    private _tIndex:any; //Table index
    private _tCacheI:any; //Table cache index
    private _immu:any; //Immutable cache store
    private _i:any; //Auto incriment holder

    constructor(p:someSQL_Instance) {
        super(p);

        let t = this;
        t._tables = {};
        t._tIndex = {};
        t._models = {};
        t._tCacheI = {};
        t._immu = {};
        t._i = {};
    }

    public newModel(table:string, args:any) {
        this._models[table] = args;
        this._tables[table] = {};
        this._tIndex[table] = [];
        this._i[table] = 1;
    }

    public exec(table:string, query:Array<any>, callback:Function):void {
        let t = this;
        t._sT = table;
        t._mod = [];
        t._act = null;
        t._cacheKey = t._hash(JSON.stringify(query));

        //return new tsPromise((res, rej) => {
            tsPromise.all(query.map((q) => {
                return new tsPromise(function(resolve, reject) {
                    t._query(q, resolve);
                });
            })).then(function() {
                t._exec(callback);
            });
        //});
    }
    
    /**
     * Hash Function
     */
    private _hash(str:string):string {
        var hash = 5381;
        for (let i = 0; i < str.length; i++) {
            let char = str.charCodeAt(i);
            hash = ((hash << 5) + hash) + char; /* hash * 33 + c */
        }
        return String(hash);
    }

    private _query(queryArg, resolve) {
        if(['upsert','select','delete','drop'].indexOf(queryArg.type) != -1) {
            this._act = queryArg;
        }
        if(['where','orderby','limit','offset','andWhere','orWhere'].indexOf(queryArg.type) != -1) {
            this._mod.push(queryArg);
        }
        resolve();
    }

    private _exec(callBack:Function):void {
        let t = this;

        switch(t._act.type) {
            case "upsert": 
                let msg;
                let hasWhere = t._mod.filter((v) => {
                    return ['where','andWhere','orWhere'].indexOf(v.type) == -1 ? false : true;
                });
                if(hasWhere.length) {
                    msg = [];
                    let rows = t._where(t._tIndex[t._sT]);
                    let ta = t._tables[t._sT];
                    rows.forEach((v,k) => {
                        for(var key in t._act.args) {
                            ta[v][key] = t._act.args[key];
                            msg.push(JSON.parse(JSON.stringify(t._act.args[key])));
                        }
                        for (var key2 of t._tCacheI) {
                            if(t._tCacheI[key2] && t._tCacheI[key2].indexOf(k) != -1) {
                                delete t._tCacheI[key2];
                                delete t._immu[key2];
                            }
                        }
                    });
                } else {
                    let key = "";
                    t._models[t._sT].forEach((m) => {
                        //Gemerate new UUIDs as needed
                        if(m.type == 'uuid' && !t._act.args[m.key]) {
                            t._act.args[m.key] = t.parent.uuid();
                        }
                        //Find primary key
                        if(m.props && m.props.indexOf('pk') != -1) {
                            key = m.key;
                            if(m.props.indexOf('ai') != -1 && !t._act.args[m.key]) {
                                t._act.args[m.key] = t._i[t._sT];
                                t._i[t._sT]++;
                            }
                        }
                    });
                    //set Index
                    let i = t._act.args[key];
                    if(t._tIndex[t._sT].indexOf(i) == -1) { 
                        //Add index to the table
                        t._tIndex[t._sT].push(i); 
                    } else {
                        //Invalidate immutable cache as needed
                        for (var k of t._tCacheI) {
                            if(t._tCacheI[k] && t._tCacheI[k].indexOf(i) != -1) {
                                delete t._tCacheI[k];
                                delete t._immu[k];
                            }
                        }
                    }
                    //Set data into table.  Data is stored in a mutable state.
                    t._tables[t._sT][i] = t._act.args;     
                    msg = [JSON.parse(JSON.stringify(t._act.args))];
                }
                callBack(msg);
            break;
            case "select":
                if(!t._immu[t._cacheKey]) {
                    let ta = t._tables[t._sT];
                    t._tCacheI[t._cacheKey] = [];
                    t._immu[t._cacheKey] = JSON.parse(JSON.stringify(t._where(t._tIndex[t._sT]) //WHERE
                    .sort((a, b) => { //Handle Order By
                        return t._mod.filter((v) => {
                            return v.type == 'orderby'
                        }).map((v) => {
                            for (var prop in v.args) {
                                if(ta[a][prop] == ta[b][prop]) return 0;
                                let result = ta[a][prop] > ta[b][prop] ? 1 : -1;
                                return v.args[prop] == 'asc' ? result : -result;
                            } 
                        }).reduce((c, d) => c + d, 0) || 0;
                    })
                    .filter((v, k) => { //Handle offset/limit
                        let os = 0;//offset
                        return !t._mod.filter((f) => {
                            return ['limit','offset'].indexOf(f.type) != -1;
                        }).sort((a, b) => {
                            //force offset commands first
                            return a.type < b.type ? 1 : -1;
                        }).map((f, i) => {
                            switch(f.type) {
                                case"offset":os=f.args;return k >= f.args ? 0 : 1; 
                                case"limit":return k < (os+f.args) ? 0 : 1;
                            }
                        }).reduce((c, d) => c + d, 0);
                    })
                    .map((v, k) => { //Select specific columns
                        t._tCacheI[t._cacheKey].push(k);
                        if(t._act.args && t._act.args.length) {
                            let obj = JSON.parse(JSON.stringify(ta[v]));
                            t._models[t._sT].forEach((m) => {
                                if(t._act.args.indexOf(m.key) == -1) {
                                    delete obj[m.key];
                                }
                            })
                            return obj;
                        } else {
                            return ta[v]; 
                        }
                    })));
                }
                callBack(t._immu[t._cacheKey]);
            break;
            case "delete":
                let rows = t._where(t._tIndex[t._sT]);
                let ta = t._tables[t._sT];
                rows.forEach((v,k) => {
                    delete ta[v];
                    t._tIndex[t._sT].splice(t._tIndex[t._sT].indexOf(v),1);
                    for (var key2 of t._tCacheI) {
                        if(t._tCacheI[key2] && t._tCacheI[key2].indexOf(v) != -1) {
                            delete t._tCacheI[key2];
                            delete t._immu[key2];
                        }
                    }
                });
                callBack(rows.length + " row(s) deleted");      
            break;
            case "drop":
                t._tables[t._sT] = {};
                t._tIndex[t._sT] = [];
                t._i[t._sT] = 1;
                callBack('Success');
            break;
        }
    }

    private _where(tableArray:Array<any>):Array<any> {
        let t = this;
        let ta = t._tables[t._sT];
        return tableArray.filter((v, k) => {//Handle WHERE/ and WHERE statements
            let andWhere = [];
            t._mod.filter((f) => {
                return f.type == 'andWhere';
            }).forEach((f) => {
                f.args.forEach((f2) => {
                    andWhere.push({
                        type:'where',
                        args:f2
                    });
                });
            });

            return t._mod.filter((f) => {
                return f.type == 'where';
            }).concat(andWhere).map((f) => {
                return t._models[t._sT].map((m) => {
                    return m.key == f.args[0] ? t._compare(f.args[2], f.args[1], ta[v][m.key]) : 0;
                }).reduce((a, b) => a + b, 0);
            }).reduce((a, b) => a + b, 0) == 0 ? true : false;
        }).filter((index) => {//Handle or WHERE statements
            let ors = [];
            t._mod.map((mo) => {
                if(mo.type == 'orWhere') {
                    mo.args.forEach((a) => {
                        ors.push(a);
                    })
                }
            });

            if(ors.length == 0) return true;

            return t._models[t._sT].map((m) => {
                return ors.filter((arg) => {
                    return t._compare(arg[2], arg[1], ta[index][m.key]) == 1 ? false : true;
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