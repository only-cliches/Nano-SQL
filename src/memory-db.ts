import { SomeSQLInstance, SomeSQLBackend, ActionOrView, QueryLine } from "./index";
import { TSPromise } from "typescript-promise";
import { TSMap } from "typescript-map";

/**
 * In memory storage implimentation.
 * 
 * @export
 * @class SomeSQLMemDB
 * @implements {SomeSQLBackend}
 */
export class SomeSQLMemDB implements SomeSQLBackend {

    /**
     * Holds the actual table data.
     * 
     * @private
     * @type {TSMap<string,Array<Object>>}
     * @memberOf SomeSQLMemDB
     */
    private _tables: TSMap<string, _memDB_Table>;

    /**
     * Holds a pointer to the current selected table.
     * 
     * @private
     * @type {string}
     * @memberOf SomeSQLMemDB
     */
    private _selectedTable: string;

    /**
     * Holds a single query object of the current query actions.
     * 
     * @private
     * @type {(TSMap<string,Object|Array<any>>)}
     * @memberOf SomeSQLMemDB
     */
    private _act: QueryLine;

    /**
     * Holds an array of the remaining query objects to modify the query in some way.
     * 
     * @private
     * @type {(Array<TSMap<string,Object|Array<any>>>)}
     * @memberOf SomeSQLMemDB
     */
    private _mod: Array<QueryLine>;


    private _filters: TSMap<string, Function>;

    private _cacheKey: string;
    private _cacheIndex: TSMap<string, TSMap<string, Array<string | number>>>;
    private _cacheQueryIndex: TSMap<string, Array<Object>>;
    private _cache: TSMap<string, TSMap<string, _memDB_Table>>;
    private _pendingQuerys: Array<Array<any>>;

    constructor() {
        let t = this;
        t._filters = new TSMap<string, Function>();
        t._tables = new TSMap<string, _memDB_Table>();
        t._cacheIndex = new TSMap<string, TSMap<string, Array<string | number>>>();
        t._cache = new TSMap<string, TSMap<string, _memDB_Table>>();
        t._cacheQueryIndex = new TSMap<string, Array<Object>>();
        t._pendingQuerys = [];
        t._initFilters();
    }

    /**
     * Creates all the tables and prepares the database for use.
     * 
     * @param {TSMap<string,Array<Object>>} models
     * @param {TSMap<string,Object>} actions
     * @param {TSMap<string,Object>} views
     * @param {Function} callback
     * 
     * @memberOf SomeSQLMemDB
     */
    public connect(models: TSMap<string, Array<Object>>, actions: TSMap<string, Array<ActionOrView>>, views: TSMap<string, Array<ActionOrView>>, filters: TSMap<string, Function>, callback: Function): void {
        let t = this;
        models.forEach((model, table) => {
            t._newModel(table, model);
        });

        filters.forEach((func, name) => {
            t._filters.set(name, func);
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
     * @memberOf SomeSQLMemDB
     */
    private _newModel(table: string, args: Array<Object>): void {
        this._cache.set(table, new TSMap<string, _memDB_Table>());
        this._cacheIndex.set(table, new TSMap<string, Array<string | number>>());
        this._tables.set(table, new _memDB_Table(args));
    }

    /**
     * Public exec option.  Organizes the query then sends it to the internal execution function.
     * 
     * @param {string} table
     * @param {(Array<TSMap<string,Object|Array<any>>>)} query
     * @param {string} viewOrAction
     * @param {Function} onSuccess
     * @param {Function} [onFail]
     * 
     * @memberOf SomeSQLMemDB
     */
    public exec(table: string, query: Array<QueryLine>, viewOrAction: string, onSuccess: Function, onFail?: Function): void {
        let t = this;

        if (t._act != null) {
            t._pendingQuerys.push([table, query, viewOrAction, onSuccess, onFail]);
            return;
        }

        t._selectedTable = table;
        t._mod = [];
        t._act = null;

        t._cacheKey = SomeSQLInstance.hash(JSON.stringify(query));
        t._cacheQueryIndex.set(t._cacheKey, query); // working on smarter cache invalidation

        TSPromise.all(query.map((q) => {
            return new TSPromise(function (resolve, reject) {
                t._query(q, resolve);
            });
        })).then(function () {
            t._exec(function (args) {
                onSuccess(args);
                t._act = null;
                if (t._pendingQuerys.length) {
                    t.exec.apply(t, t._pendingQuerys.pop());
                }
            });
        });
    }

    /**
     * Puts the query from the someSQL Instance into query actions and mofidiers to make execution easier.
     * 
     * @private
     * @param {(TSMap<string,number|Object|Array<any>>)} queryArg
     * @param {Function} resolve
     * 
     * @memberOf SomeSQLMemDB
     */
    private _query(queryArg: QueryLine, resolve: Function): void {
        if (["upsert", "select", "delete", "drop"].indexOf(<string>queryArg.type) !== -1) {
            this._act = queryArg;
        } else {
            this._mod.push(queryArg);
        }
        resolve();
    }

    /**
     * Declare built in filters
     * 
     * @private
     * 
     * @memberOf SomeSQLMemDB
     */
    private _initFilters() {
        let t = this;
        let f = t._filters;
        f.set("sum", (rows: Array<Object>) => {
            return rows.map((r) => r[t._act.args[0]]).reduce((a, b) => a + b, 0);
        });
        f.set("first", (rows: Array<Object>) => {
            return rows[0];
        });
        f.set("last", (rows: Array<Object>) => {
            return rows.pop();
        });
        f.set("min", (rows: Array<Object>) => {
            return rows.map((r) => r[t._act.args[0]]).sort((a, b) => a < b ? -1 : 1)[0];
        });
        f.set("max", (rows: Array<Object>) => {
            return rows.map((r) => r[t._act.args[0]]).sort((a, b) => a > b ? -1 : 1)[0];
        });
        f.set("average", (rows: Array<Object>) => {
            return t._doFilter("sum", rows) / rows.length;
        });
        f.set("count", (rows: Array<Object>) => {
            return rows.length;
        });
    }

    /**
     * Execute on a given set of rows
     * 
     * @private
     * @param {string} filterName
     * @param {*} filterArgs
     * @param {Array<Object>} rows
     * @returns {*}
     * 
     * @memberOf SomeSQLMemDB
     */
    private _doFilter(filterName: string, rows: Array<Object>, filterArgs?: any): any {
        return this._filters.get(filterName).apply(this, [rows, filterArgs]);
    }

    private _runFilters(dbRows: Array<Object>): any {
        let t = this;
        let filters = t._mod.filter((m) => (<string>m.type).indexOf("filter-") === 0);
        return filters.length ? filters.reduce((prev, cur, i) => {
            return t._doFilter((<string>filters[i].type).replace("filter-", ""), prev, filters[i].args);
        }, dbRows) : dbRows;
    }

    private _removeCacheFromKeys(affectedKeys: Array<number | string>): void {
        let t = this;
        affectedKeys.forEach((key) => {
            t._cacheIndex.get(t._selectedTable).forEach((queryIndex, key) => {
                if (queryIndex.indexOf(key) !== -1) {
                    t._cacheIndex.get(t._selectedTable).delete(key);
                    t._cache.get(t._selectedTable).delete(key);
                }
            });
        });
    }

    /**
     * Execute commands on the databse to retrieve or modify data as desired.
     * 
     * @private
     * @param {Function} callBack
     * 
     * @memberOf SomeSQLMemDB
     */
    private _exec(callBack: Function): void {
        let t = this;

        let _hasWhere = t._mod.filter((v) => {
            return v.type === "where";
        });
        let _whereStatement = _hasWhere.length ? _hasWhere[0].args : undefined;

        let qArgs: any = t._act.args;

        let ta = t._tables.get(t._selectedTable);

        let msg: number = 0;

        let whereTable: _memDB_Table;

        switch (t._act.type) {
            case "upsert":

                if (_whereStatement) { // Upserting existing rows
                    whereTable = t._newWhere(ta, <any>_whereStatement);
                    let affectedKeys = [];

                    whereTable._forEach((v, k) => {
                        for (let key in qArgs) {
                            ta._get(k)[key] = qArgs[key];
                        }
                        affectedKeys.push(k);
                        msg++;
                    });


                    t._removeCacheFromKeys(affectedKeys);

                } else { // Adding new rows
                    ta._add(qArgs);
                    msg++;

                    // remove cache for entire current table
                    // This is a very naive approach, a future implimentation would have all the cache
                    // queries running again and updating only the cache entries affected.
                    t._cache.set(t._selectedTable, new TSMap<string, _memDB_Table>());
                    t._cacheIndex.set(t._selectedTable, new TSMap<string, Array<string | number>>());
                }

                callBack(msg + " row(s) upserted");

                break;
            case "select":

                // Return immutable cache if it's there.
                if (t._cache.get(t._selectedTable).has(t._cacheKey)) {
                    callBack(t._cache.get(t._selectedTable).get(t._cacheKey));
                    return;
                }

                if (_whereStatement) {
                    whereTable = t._newWhere(ta, <any>_whereStatement);
                } else {
                    whereTable = ta._clone();
                }

                let mods: Array<any> = ["ordr", "ofs", "lmt", "clms"];

                let getMod = function (name): QueryLine {
                    return t._mod.filter((v) => v.type === name).pop();
                };

                let result = mods.reduce((prev, cur, i) => {
                    switch (mods[i]) {
                        case "ordr":
                            if (getMod("orderby")) {
                                let orderBy = new TSMap();
                                orderBy.fromJSON(getMod("orderby").args);
                                return prev.sort((a, b) => {
                                    return orderBy.keys().reduce((prev, cur, i) => {
                                        let column = <string>orderBy.keys()[i];
                                        if (a[column] === b[column]) {
                                            return 0 + (<number>prev);
                                        } else {
                                            return ((a[column] > b[column] ? 1 : -1) * (orderBy.get(column) === "asc" ? 1 : -1)) + (<number>prev);
                                        }
                                    }, 0);
                                });
                            }
                        case "ofs":
                            if (getMod("offset")) {
                                let offset = getMod("offset").args;
                                return prev.filter((row, index) => {
                                    return index >= offset;
                                });
                            }
                        case "lmt":
                            if (getMod("limit")) {
                                let limit = getMod("limit").args;
                                return prev.filter((row, index) => {
                                    return index < limit;
                                });
                            }
                        case "clms":
                            if (qArgs) {
                                let columns = ta._model.map((model) => {
                                    return model["key"];
                                }).filter((col) => {
                                    return qArgs.indexOf(col) === -1;
                                });
                                return prev.map((row) => {
                                    columns.forEach((col) => delete row[col]);
                                    return row;
                                });
                            }
                        default: return prev;
                    }
                }, whereTable._table);

                // Set the immutable cache
                let filterEffect = t._runFilters(result);

                t._cache.get(t._selectedTable).set(t._cacheKey, filterEffect);
                t._cacheIndex.get(t._selectedTable).set(t._cacheKey, result.map((row) => {
                    return row[whereTable._primaryKey];
                }));

                callBack(filterEffect);

                break;
            case "delete":

                if (_whereStatement) {
                    let affectedKeys = [];
                    let whereTable = t._newWhere(ta, <any>_whereStatement);

                    whereTable._forEach((value, index) => {
                        ta._remove(index);
                        affectedKeys.push(index);
                    });

                    t._removeCacheFromKeys(affectedKeys);
                    callBack(whereTable.length + " row(s) deleted");
                } else {
                    t._newModel(t._selectedTable, t._tables.get(t._selectedTable)._model);
                    callBack("Table dropped.");
                }

                break;
            case "drop":

                t._newModel(t._selectedTable, t._tables.get(t._selectedTable)._model);
                callBack("Table dropped.");

                break;
        }
    }

    private _newWhere(table: _memDB_Table, whereStatement: Array<Array<string> | string>): _memDB_Table {
        let t = this;

        if (whereStatement && whereStatement.length) {
            if (typeof (whereStatement[0]) === "string") {
                // Single where statement like ['name','=','billy']
                return t._singleWhereResolve(table._clone(), <any>whereStatement);
            } else {
                // nested where statement like [['name','=','billy'],'or',['name','=','bill']]
                let ptr = 0;
                let compare = null;
                return whereStatement.map((statement) => {
                    return t._singleWhereResolve(table._clone(), <any>statement);
                }).reduce((prev, cur, i) => {
                    if (i === 0) return cur;
                    if (ptr === 0) return compare = whereStatement[i], ptr = 1, prev;
                    if (ptr === 1) {
                        ptr = 0;
                        switch (compare) {
                            case "and": return prev._join("inner", cur);
                            case "or": return prev._join("outer", cur);
                            default: return prev;
                        }
                    }
                });
            }
        } else {
            return table._clone();
        }
    }

    private _singleWhereResolve(table: _memDB_Table, whereStatement: Array<string>): _memDB_Table {
        let t = this;
        let left = whereStatement[0];
        let operator = whereStatement[1];
        let right = whereStatement[2];
        return table._filter((row) => {
            return t._compare(right, operator, row[left]) === 0;
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
     * @memberOf SomeSQLMemDB
     */
    private _compare(val1: any, compare: string, val2: any): number {
        switch (compare) {
            case "=": return val2 === val1 ? 0 : 1;
            case ">": return val2 > val1 ? 0 : 1;
            case "<": return val2 < val1 ? 0 : 1;
            case "<=": return val2 <= val1 ? 0 : 1;
            case ">=": return val2 >= val1 ? 0 : 1;
            case "IN": return val1.indexOf(val2) === -1 ? 1 : 0;
            case "NOT IN": return val1.indexOf(val2) === -1 ? 0 : 1;
            case "REGEX":
            case "LIKE": return val2.search(val1) === -1 ? 1 : 0;
            default: return 0;
        }
    }
}


/**
 * Internal class used to hold an organized memory table data
 * 
 * @class _memDB_Table
 */
// tslint:disable-next-line
class _memDB_Table {
    public _index: Array<string | number>;
    public _table: Array<Object>;
    public _model: Array<Object>;
    public _primaryKey: string;
    public _pkType: string;
    public length: number;
    private _incriment: number;

    constructor(model: Array<Object>, index?: Array<string>, table?: Array<Object>) {
        let t = this;
        t._model = model;
        t._index = index || [];
        t._table = table || [];
        t._incriment = 1;
        t.length = 0;
        t._primaryKey = <any>t._model.reduce((prev, cur) => {
            if (cur["props"] && cur["props"].indexOf("pk") !== -1) {
                t._pkType = cur["type"];
                return cur["key"];
            } else {
                return prev;
            }
        }, "");
    }

    public static _detach(input: Object): Object {
        return JSON.parse(JSON.stringify(input));
    }

    public _get(index: string | number): Object {
        return this._table[this._index.indexOf(index)];
    }

    public _set(index: string | number, value: Object): void {
        this._table[this._index.indexOf(index)] = value;
    }

    public _add(data: Object): void {
        let t = this;
        data = JSON.parse(JSON.stringify(data));
        if (!data[t._primaryKey]) {
            switch (t._pkType) {
                case "int": data[t._primaryKey] = t._incriment; t._incriment++;
                    break;
                case "uuid": data[t._primaryKey] = SomeSQLInstance.uuid();
                    break;
            }
            t._index.push(data[t._primaryKey]);
            t._table.push(data);
            t.length = t._index.length;
        } else {
            t._set(data[t._primaryKey], data);
        }
    }

    public _filter(func: (value: Object, index?: string | number) => Boolean): _memDB_Table {
        let t = this;
        t._index.forEach((idx) => {
            if (!func.apply(t, [t._get(idx), idx])) t._remove(idx);
        });
        t.length = t._index.length;
        return this;
    }

    public _forEach(func: (value: Object, index?: string | number) => void): _memDB_Table {
        let t = this;
        t._index.forEach((idx) => {
            func.apply(t, [t._get(idx), idx]);
        });
        return t;
    }

    public _sort(func: (value: Object, value2: Object) => number): _memDB_Table {
        let t = this;
        let r = [];
        let i = -1;
        t._index.sort((a, b) => {
            let result = func.apply(t, [t._get(a), t._get(b)]);
            r.push(result);
            return result;
        });
        t._table.sort((a, b) => {
            i++;
            return r[i];
        });
        return t;
    }

    public _join(type: string, table: _memDB_Table, joinKeys?: Array<string | number>, mergeRowData?: Boolean): _memDB_Table {
        let t = this;

        let joinKs = [];

        if (!joinKeys) { joinKs = [t._primaryKey, table._primaryKey]; } else { joinKs = joinKeys; }

        let tables = [this, table];

        if (type === "inner") {
            tables.sort((a, b) => {
                return a.length > b.length ? -1 : 1;
            });
        }

        // N^2, YAY!
        tables[0]._forEach((row, idx) => {
            let found;
            tables[1]._forEach((row2, idx2) => {
                if (found === undefined) {
                    if (row[joinKs[0]] === row2[joinKs[1]]) found = row2;
                }
            });
            if (found === undefined) {
                switch (type) {
                    case "inner": tables[0]._remove(idx);  // remove any elements that aren't common to both tables
                        break;
                    case "outer": tables[1]._add(found);  // Add new rows and combine existing ones.
                        break;
                }
            }
        });

        if (type === "outer") {
            tables[0]._sort((a, b) => {
                return a[tables[0]._primaryKey] > b[tables[0]._primaryKey] ? 1 : -1;
            });
        }

        return tables[0];
    }

    public _remove(index: string | number): void {
        let t = this;
        let f = t._index.indexOf(index);
        t._index.splice(f, 1);
        t._table.splice(f, 1);
        t.length = t._index.length;
    }

    public _clone(): _memDB_Table {
        let ta = new _memDB_Table(this._model, <any>_memDB_Table._detach(this._index), <any>_memDB_Table._detach(this._table));
        ta._incriment = this._incriment;
        ta.length = this.length;
        return ta;
    }
}