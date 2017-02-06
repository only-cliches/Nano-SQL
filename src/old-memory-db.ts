import { SomeSQLInstance, SomeSQLBackend, ActionOrView, QueryLine, DataModel, StdObject, DBConnect, DBExec } from "./index";
import { TSPromise } from "typescript-promise";

/**
 * In memory storage implimentation.
 * 
 * @export
 * @class SomeSQLMemDB
 * @implements {SomeSQLBackend}
 */
// tslint:disable-next-line
export class _SomeSQLMemDB implements SomeSQLBackend {

    /**
     * Holds the actual table data.
     * 
     * @internal
     * @type {StdObject<_memDB_Table>}
     * @memberOf SomeSQLMemDB
     */
    private _tables: StdObject<_memDB_Table>;

    /**
     * Holds a pointer to the current selected table.
     * 
     * @internal
     * @type {string}
     * @memberOf SomeSQLMemDB
     */
    private _selectedTable: string;

    /**
     * Holds a single query object of the current query actions.
     * 
     * @internal
     * @type {(StdObject<bject|Array<any>>)}
     * @memberOf SomeSQLMemDB
     */
    private _act: QueryLine|undefined;

    /**
     * Holds an array of the remaining query objects to modify the query in some way.
     * 
     * @internal
     * @type {(Array<StdObject<bject|Array<any>>>)}
     * @memberOf SomeSQLMemDB
     */
    private _mod: Array<QueryLine>;

    /**
     * Holds all possible filters
     * 
     * @internal
     * @type {StdObject<Function>}
     * @memberOf SomeSQLMemDB
     */
    private _filters: StdObject<Function>;

    /**
     * Temporary home for the current query cache key.
     * 
     * @internal
     * @type {number}
     * @memberOf SomeSQLMemDB
     */
    private _cacheKey: number;

    /**
     * An index of the contents of the immutable cache
     * 
     * @internal
     * @type {(StdObject<StdObject<Array<string | number>>>)}
     * @memberOf SomeSQLMemDB
     */
    private _cacheIndex: StdObject<StdObject<Array<string | number>>>;

    /**
     * An index of the immutable cache queries
     * 
     * @internal
     * @type {StdObject<Array<Object>>}
     * @memberOf SomeSQLMemDB
     */
    private _cacheQueryIndex: StdObject<Array<Object>>;

    /**
     * The actual immutable cache is stored here.
     * 
     * @internal
     * @type {StdObject<StdObject<_memDB_Table>>}
     * @memberOf SomeSQLMemDB
     */
    private _cache: StdObject<StdObject<_memDB_Table>>;

    /**
     * Push quries into this array if theres already a query running
     * 
     * @internal
     * @type {Array<DBExec>}
     * @memberOf SomeSQLMemDB
     */
    private _pendingQuerys: Array<DBExec>;

    constructor() {
        let t = this;
        t._filters = {};
        t._tables = {};
        t._cacheIndex = {};
        t._cache = {};
        t._cacheQueryIndex = {};
        t._pendingQuerys = [];
        t._initFilters();
    }

    /**
     * Creates all the tables and prepares the database for use.
     * 
     * @param {DBConnect} connectArgs
     * 
     * @memberOf _SomeSQLMemDB
     */
    public _connect(connectArgs: DBConnect): void {
        let t = this;
        for (let tableName in connectArgs._models) {
            t._newModel(tableName, connectArgs._models[tableName]);
        }

        t._filters = connectArgs._filters;

        connectArgs._onSuccess();
    }

    /**
     * Creats a new table in the database or clears and existing one.
     * 
     * @internal
     * @param {string} table
     * @param {Array<DataModel>} dataModel
     * 
     * @memberOf SomeSQLMemDB
     */
    private _newModel(table: string, dataModel: Array<DataModel>): void {
        this._cache[table] = {};
        this._cacheIndex[table] = {};
        this._tables[table] = new _memDB_Table(dataModel);
    }

    /**
     * Public exec option.  Organizes the query then sends it to the internal execution function.
     * 
     * @param {DBExec} execArgs
     * @returns {void}
     * 
     * @memberOf _SomeSQLMemDB
     */
    public _exec(execArgs: DBExec): void {

        let t = this;

        if (t._act !== undefined) {
            t._pendingQuerys.push(execArgs);
            return;
        }

        t._selectedTable = execArgs._table;
        t._mod = [];
        t._act = undefined;

        t._cacheKey = _SomeSQLMemDB._hash(JSON.stringify(execArgs._query));
        t._cacheQueryIndex[t._cacheKey] = execArgs._query; // working on smarter cache invalidation

        TSPromise.all(execArgs._query.map((q) => {
            return new TSPromise(function (resolve, reject) {
                t._query(q, resolve);
            });
        })).then(() => {
            t._execQuery((args: Array<Object>) => {
                execArgs._onSuccess(args);
                t._act = undefined;
                if (t._pendingQuerys.length) {
                    t._exec.apply(t, [t._pendingQuerys.pop()]);
                }
            });
        });
    }

    /**
     * Puts the query from the someSQL Instance into query actions and mofidiers to make execution easier.
     * 
     * @internal
     * @param {(StdObject<umber|Object|Array<any>>)} queryArg
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
     * @internal
     * 
     * @memberOf SomeSQLMemDB
     */
    private _initFilters(): void {
        let t = this;
        t._filters = {
            sum: (rows: Array<StdObject<any>>) => {
                return [{"sum": rows.map((r: StdObject<any>) => {
                        return t._act ? r[t._act.args[0]] : 0;
                    }).reduce((a, b) => a + b, 0)}];
            },
            first: (rows: Array<StdObject<any>>) => {
                return [rows[0]];
            },
            last: (rows: Array<StdObject<any>>) => {
                return [rows.pop()];
            },
            min: (rows: Array<StdObject<any>>) => {
                return [{min: rows.map((r: StdObject<any>) => {
                        return t._act ? r[t._act.args[0]] : 0;
                    }).sort((a, b) => a < b ? -1 : 1)[0]}];
            },
            max: (rows: Array<StdObject<any>>) => {
                return [{max: rows.map((r: StdObject<any>) => {
                        return t._act ? r[t._act.args[0]] : 0;
                    }).sort((a, b) => a > b ? -1 : 1)[0]}];
            },
            average: (rows: Array<StdObject<any>>) => {
                return [{average: t._doFilter("sum", rows)[0].sum / rows.length}];
            },
            count: (rows: Array<StdObject<any>>) => {
                return [{count: rows.length}];
            }
        };
    }

    /**
     * Execute filter on a given set of rows
     * 
     * @internal
     * @param {string} filterName
     * @param {*} filterArgs
     * @param {Array<Object>} rows
     * @returns {*}
     * 
     * @memberOf SomeSQLMemDB
     */
    private _doFilter(filterName: string, rows: Array<Object>, filterArgs?: any): any {
        return this._filters[filterName].apply(this, [rows, filterArgs]);
    }

    /**
     * Run filters on the database
     * 
     * @internal
     * @param {Array<Object>} dbRows
     * @returns {*}
     * 
     * @memberOf SomeSQLMemDB
     */
    private _runFilters(dbRows: Array<Object>): any {
        let t = this;
        let filters = t._mod.filter((m) => (<string>m.type).indexOf("filter-") === 0);
        return filters.length ? filters.reduce((prev, cur, i) => {
            return t._doFilter((<string>filters[i].type).replace("filter-", ""), prev, filters[i].args);
        }, dbRows) : dbRows;
    }

    /**
     * Clean up the cache based on an array of primary keys
     * 
     * @internal
     * @param {(Array<number | string>)} affectedKeys
     * 
     * @memberOf SomeSQLMemDB
     */
    private _removeCacheFromKeys(affectedKeys: Array<number | string>): void {
        let t = this;
        t._cache[t._selectedTable] = {};
        t._cacheIndex[t._selectedTable] = {};
    }

    /**
     * Execute commands on the databse to retrieve or modify data as desired.
     * 
     * @internal
     * @param {Function} callBack
     * 
     * @memberOf SomeSQLMemDB
     */
    private _execQuery(callBack: Function): void {
        let t = this;

        let _hasWhere = t._mod.filter((v) => {
            return v.type === "where";
        });
        let _whereStatement = _hasWhere.length ? _hasWhere[0].args : undefined;

        if (!t._act) throw Error("No action specified!");

        let qArgs: any = t._act.args;

        let ta = t._tables[t._selectedTable];

        let msg: number = 0;

        let whereTable: _memDB_Table;

        switch (t._act.type) {
            case "upsert":

                if (_whereStatement) { // Upserting existing rows
                    whereTable = t._newWhere(ta, <any>_whereStatement);
                    let affectedKeys: Array<any> = [];
                    whereTable._index.forEach((idx) => {
                        for (let key in qArgs) {
                            ta._rows[<string> idx][key] = qArgs[key];
                        }
                        affectedKeys.push(idx);
                        msg++;
                    });

                    t._removeCacheFromKeys(affectedKeys);

                } else { // Adding new rows

                    ta._add(qArgs);
                    msg++;

                    // remove cache for entire current table
                    // This is a very naive approach, a future implimentation would have all the cache
                    // queries running again and updating only the cache entries affected.
                    t._cache[t._selectedTable] = {};
                    t._cacheIndex[t._selectedTable] = {};
                }
                callBack([{result: msg + " row(s) upserted"}]);

                break;
            case "select":

                // Return immutable cache if it's there.
                if (t._cache[t._selectedTable][t._cacheKey]) {
                    callBack(t._cache[t._selectedTable][t._cacheKey]);
                    return;
                }

                if (_whereStatement) {
                    whereTable = t._newWhere(ta, <any>_whereStatement);
                } else {
                    whereTable = ta._clone();
                }

                let mods: Array<any> = ["or", "of", "lm", "cl"];

                let getMod = (name: string): QueryLine|undefined => {
                    return t._mod.filter((v) => v.type === name).pop();
                };

                let result = mods.reduce((prev, cur, i) => {
                    switch (mods[i]) {
                        case "or":
                            let orderMod = getMod("orderby");
                            if (orderMod) {
                                let orderArgs = orderMod.args;
                                return prev.sort((a: StdObject<any>, b: StdObject<any>) => {
                                    let keys: Array<any> = [];
                                    for (let key in orderArgs) {
                                        keys.push(key);
                                    }

                                    return keys.reduce((prev, cur, i) => {
                                        let column = keys[i];
                                        if (a[column] === b[column]) {
                                            return 0 + (<number>prev);
                                        } else {
                                            return ((a[column] > b[column] ? 1 : -1) * (orderArgs[column] === "asc" ? 1 : -1)) + (<number>prev);
                                        }
                                    }, 0);
                                });
                            }
                        case "of":
                            let offsetMod = getMod("offset");
                            if (offsetMod) {
                                let offset = offsetMod.args;
                                return prev.filter((row: StdObject<any>, index: number) => {
                                    return index >= offset;
                                });
                            }
                        case "lm":
                            let limitMod = getMod("limit");
                            if (limitMod) {
                                let limit = limitMod.args;
                                return prev.filter((row: StdObject<any>, index: number) => {
                                    return index < limit;
                                });
                            }
                        case "cl":
                            if (qArgs) {
                                let columns = ta._model.map((model) => {
                                    return model.key;
                                }).filter((col) => {
                                    return qArgs.indexOf(col) === -1;
                                });
                                return prev.map((row: StdObject<any>) => {
                                    columns.forEach((col) => delete row[col]);
                                    return row;
                                });
                            }
                        default: return prev;
                    }
                }, whereTable._table());

                // Set the immutable cache
                let filterEffect = t._runFilters(result);

                t._cache[t._selectedTable][t._cacheKey] = filterEffect;
                t._cacheIndex[t._selectedTable][t._cacheKey] = result.map((row: StdObject<any>) => {
                    return row[whereTable._primaryKey];
                });

                callBack(filterEffect);

                break;
            case "delete":

                if (_whereStatement) {
                    let affectedKeys: Array<any> = [];
                    let whereTable = t._newWhere(ta, <any>_whereStatement);

                    whereTable._index.forEach((index) => {
                        ta._remove(index);
                        affectedKeys.push(index);
                    });

                    t._removeCacheFromKeys(affectedKeys);
                    callBack([{result: whereTable.length + " row(s) deleted"}]);
                } else {
                    t._newModel(t._selectedTable, t._tables[t._selectedTable]._model);
                    callBack([{result: "Table Dropped"}]);
                }

                break;
            case "drop":

                t._newModel(t._selectedTable, t._tables[t._selectedTable]._model);
                callBack([{result: "Table Dropped"}]);

                break;
        }
    }

    /**
     * Handle history implemintation
     * 
     * @param {SomeSQLInstance} db
     * @param {("back"|"forward")} command
     * @returns
     * 
     * @memberOf _SomeSQLMemDB
     */
    public extend(db: SomeSQLInstance, command: "back"|"forward") {

        switch (command) {
            case "back":

            break;
            case "forward":

            break;
        }

        return db;
    }

    /**
     * Handle where statements
     * 
     * @internal
     * @param {_memDB_Table} table
     * @param {(Array<Array<string> | string>)} whereStatement
     * @returns {_memDB_Table}
     * 
     * @memberOf SomeSQLMemDB
     */
    private _newWhere(table: _memDB_Table, whereStatement: Array<Array<string> | string>): _memDB_Table {
        let t = this;

        if (whereStatement && whereStatement.length) {
            if (typeof (whereStatement[0]) === "string") {
                // Single where statement like ['name','=','billy']
                return t._singleWhereResolve(table._clone(), <any>whereStatement);
            } else {
                // nested where statement like [['name','=','billy'],'or',['name','=','bill']]
                let ptr = 0;
                let compare: any;
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
                    return prev;
                });
            }
        } else {
            return table._clone();
        }
    }

    /**
     * Single where statement resolver.
     * 
     * @internal
     * @param {_memDB_Table} table
     * @param {Array<string>} whereStatement
     * @returns {_memDB_Table}
     * 
     * @memberOf SomeSQLMemDB
     */
    private _singleWhereResolve(table: _memDB_Table, whereStatement: Array<string>): _memDB_Table {
        let t = this;
        let left = whereStatement[0];
        let operator = whereStatement[1];
        let right = whereStatement[2];
        table._index = table._index.filter((v) => {
            return t._compare(right, operator, table._rows[v][whereStatement[0]]) === 0 ? true : false;
        });

        return table;
    }

    private static _hash(key: string): number {
        return Math.abs(key.split("").reduce(function (prev, next, i) {
            return (((prev << 5) + prev) + key.charCodeAt(i));
        }, 0));
    }

    /**
     * Accepts two values and something to comapre them against, returns a boolean that can be used in an array FILTER function.
     * 
     * @internal
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
 * Internal class used to hold and organized memory table data
 * 
 * @class _memDB_Table
 */
// tslint:disable-next-line
class _memDB_Table {
    public _index: Array<string | number>;
    public _rows: StdObject<StdObject<any>>;
    public _model: Array<DataModel>;
    public _primaryKey: string;
    public _pkType: string;
    public length: number;
    private _incriment: number;

    constructor(model: Array<DataModel>, index?: Array<string>, table?: Array<StdObject<any>>) {
        let t = this;
        t._model = model;
        t._index = index || [];
        t._rows = {};
        t._incriment = 1;
        t.length = 0;
        t._primaryKey = <any>t._model.reduce((prev, cur) => {
            if (cur.props && cur.props.indexOf("pk") !== -1) {
                t._pkType = cur["type"];
                return cur["key"];
            } else {
                return prev;
            }
        }, "");
        if (table) {
            table.forEach((row) => {
                t._rows[row[t._primaryKey]] = row;
            });
        }
    }

    public _table(): Array<any> {
        let t = this;
        return t._index.map((i) => {
            return t._rows[i];
        });
    }

    public static _detach(input: Object): Object {
        return JSON.parse(JSON.stringify(input));
    }

    public _add(data: StdObject<any>): void {
        let t = this;
        data = JSON.parse(JSON.stringify(data));
        t._model.forEach((model) => {
            data[model.key] = data[model.key] || model.default || undefined;
        });

        if (!data[t._primaryKey]) {
            switch (t._pkType) {
                case "int": data[t._primaryKey] = t._incriment; t._incriment++;
                    break;
                /*case "uuid": data[t._primaryKey] = SomeSQLInstance.uuid();
                    break;*/
            }
            t._index.push(data[t._primaryKey]);
            t._rows[data[t._primaryKey]] = data;
            t.length = t._index.length;
        } else {
            t._rows[data[t._primaryKey]] = data;
        }
    }

    public _remove(index: string|number): void {
        this._index.splice(this._index.indexOf(index), 1);
    }

    public _join(type: string, table: _memDB_Table, joinKeys?: Array<string | number>, mergeRowData?: Boolean): _memDB_Table {
        let t = this;

        let joinKs: Array<any> = [];

        if (!joinKeys) { joinKs = [t._primaryKey, table._primaryKey]; } else { joinKs = joinKeys; }

        let tables = [this, table];

        if (type === "inner") {
            tables.sort((a, b) => {
                return a.length > b.length ? -1 : 1;
            });
        }

        // N^2, YAY!
        tables[0]._index.forEach((idx) => {
            let found: StdObject<any>|undefined;

            tables[1]._index.forEach((idx2) => {
                if (found === undefined) {
                    if (tables[0]._rows[idx][joinKs[0]] === tables[1]._rows[idx][joinKs[1]])
                        found = tables[1]._rows[idx];
                }
            });
            if (found === undefined) {
                switch (type) {
                    case "inner": tables[0]._remove(idx);  // remove any elements that aren't common to both tables
                        break;
                }
            } else {
                switch (type) {
                    case "outer": tables[1]._add(found);  // Add new rows and combine existing ones.
                        break;
                }
            }
        });

        if (type === "outer") {
            tables[0]._index.sort((a, b) => {
                return a > b ? 1 : -1;
            });
        }

        return tables[0];
    }

    public _clone(): _memDB_Table {
        let ta = new _memDB_Table(this._model, <any>_memDB_Table._detach(this._index), <any>_memDB_Table._detach(this._table()));
        ta._incriment = this._incriment;
        ta.length = this.length;
        return ta;
    }
}