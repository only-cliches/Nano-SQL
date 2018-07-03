import { NanoSQLInstance, ORMArgs, JoinArgs, DBRow, DatabaseEvent } from "../index";
import { _assign, StdObject, uuid, cast, Promise, timeid, fastCHAIN, fastALL, hash } from "../utilities";
import { NanoSQLPlugin } from "nano-sql";

export interface IdbQuery extends IdbQueryBase {
    table: string | any[];
    action: string;
    actionArgs: any;
    state: string;
    result: DBRow[];
    comments: string[];
}

export interface IdbQueryBase {
    queryID?: string;
    transaction?: boolean;
    where?: (row: DBRow, idx: number) => boolean | any[];
    range?: number[];
    ormSync?: string[];
    orm?: (string | ORMArgs)[];
    orderBy?: { [column: string]: "asc" | "desc" };
    groupBy?: { [column: string]: "asc" | "desc" };
    having?: any[];
    join?: JoinArgs | JoinArgs[];
    limit?: number;
    offset?: number;
    on?: any[];
    debounce?: number;
    trie?: { column: string, search: string };
    extend?: any[];
}

export interface IdbQueryExec extends IdbQueryBase {
    table?: string | any[];
    action?: string;
    actionArgs?: any;
    state?: string;
    comments?: string[];
    result?: DBRow[];
}

const blankRow = { affectedRowPKS: [], affectedRows: [] };


const runQuery = (self: _NanoSQLQuery, complete: (result: any) => void, error: (err: Error) => void) => {

    if (self._db.plugins.length === 1 && !self._db.hasAnyEvents) {
        // fast query path, only used if there's a single plugin and no event listeners
        (self._db.plugins[0] as any).doExec(self._query, (newQ) => {
            self._query = newQ;
            if (self._db.hasPK[self._query.table as string]) {
                complete(self._query.result);
            } else {
                complete(self._query.result.map(r => ({ ...r, _id_: undefined })));
            }

        }, error);
    } else {
        fastCHAIN(self._db.plugins, (p: NanoSQLPlugin, i, nextP, pluginErr) => {
            if (p.doExec) {
                p.doExec(self._query as any, (newQ) => {
                    self._query = newQ || self._query;
                    nextP();
                }, pluginErr);
            } else {
                nextP();
            }
        }).then(() => {

            if (self._db.hasPK[self._query.table as string]) {
                complete(self._query.result);
            } else {
                complete(self._query.result.map(r => ({ ...r, _id_: undefined })));
            }

            if (self._db.hasAnyEvents || self._db.pluginHasDidExec) {

                const eventTypes: ("change" | "delete" | "upsert" | "drop" | "select" | "error" | "transaction")[] = (() => {
                    switch (self._query.action) {
                        case "select": return [self._query.action];
                        case "delete":
                        case "upsert":
                        case "drop": return [self._query.action, "change"];
                        default: return [] as any[];
                    }
                })();

                const hasLength = self._query.result && self._query.result.length;


                let event: DatabaseEvent = {
                    table: self._query.table as string,
                    query: self._query,
                    time: Date.now(),
                    result: self._query.result,
                    notes: [],
                    types: eventTypes,
                    actionOrView: self._AV,
                    transactionID: self._query.transaction ? self._query.queryID : undefined,
                    affectedRowPKS: hasLength ? (self._query.result[0] || blankRow).affectedRowPKS : [],
                    affectedRows: hasLength ? (self._query.result[0] || blankRow).affectedRows : [],
                };

                fastCHAIN(self._db.plugins, (p, i, nextP) => {
                    if (p.didExec) {
                        p.didExec(event, (newE) => {
                            event = newE;
                            nextP();
                        });
                    } else {
                        nextP();
                    }
                }).then(() => {
                    self._db.triggerEvent(event);
                });
            }
        }).catch(error);
    }
};

let debounceTimers: {
    [key: string]: any;
} = {};

// tslint:disable-next-line
export class _NanoSQLQuery {

    public _db: NanoSQLInstance;

    public _error: string;

    public _AV: string;

    public _query: IdbQuery;

    public static execMap: any;

    constructor(db: NanoSQLInstance, table: string | any[], queryAction: string, queryArgs?: any, actionOrView?: string) {
        this._db = db;

        this._AV = actionOrView || "";
        this._query = {
            table: table,
            comments: [],
            state: "pending",
            queryID: Date.now() + "." + this._db.fastRand().toString(16),
            action: queryAction,
            actionArgs: queryArgs,
            result: []
        };
    }

    /**
     * Used to select specific rows based on a set of conditions.
     * You can pass in a single array with a conditional statement or an array of arrays seperated by "and", "or" for compound selects.
     * A single where statement has the column name on the left, an operator in the middle, then a comparison on the right.
     *
     * Where Examples:
     *
     * ```ts
     * .where(['username','=','billy'])
     * .where(['balance','>',20])
     * .where(['catgory','IN',['jeans','shirts']])
     * .where([['name','=','scott'],'and',['balance','>',200]])
     * .where([['id','>',50],'or',['postIDs','IN',[12,20,30]],'and',['name','LIKE','Billy']])
     * ```
     *
     * @param {(Array<any|Array<any>>)} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public where(args: any[] | any): _NanoSQLQuery {
        this._query.where = args;
        return this;
    }

    /**
     * Query to get a specific range of rows very efficiently.
     *
     * @param {number} limit
     * @param {number} offset
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    public range(limit: number, offset: number): _NanoSQLQuery {
        this._query.range = [limit, offset];
        return this;
    }

    /**
     * When using "from" features specific what primary keys to update.
     *
     * @param {any[]} primaryKeys
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    public on(primaryKeys: any[]): _NanoSQLQuery {
        this._query.on = primaryKeys;
        return this;
    }

    /**
     * Debounce aggregate function calls.
     *
     * @param {number} ammt
     * @memberof _NanoSQLQuery
     */
    public debounce(ms?: number): _NanoSQLQuery {
        this._query.debounce = ms || 250;
        return this;
    }

    /**
     * Trigge ORM queries for all result rows.
     *
     * @param {((string|ORMArgs)[])} [ormArgs]
     * @returns {_NanoSQLQuery}
     *
     * @memberof _NanoSQLQuery
     */
    public orm(ormArgs?: (string | ORMArgs)[]): _NanoSQLQuery {
        this._query.orm = ormArgs;
        return this;
    }

    /**
     * Order the results by a given column or columns.
     *
     * Examples:
     *
     * ```ts
     * .orderBy({username:"asc"}) // order by username column, ascending
     * .orderBy({balance:"desc",lastName:"asc"}) // order by balance descending, then lastName ascending.
     * ```
     *
     * @param {Object} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public orderBy(args: { [key: string]: "asc" | "desc" }): _NanoSQLQuery {
        this._query.orderBy = args;
        return this;
    }

    /**
     * Group By command, typically used with an aggregate function.
     *
     * Example:
     *
     * ```ts
     * nSQL("users").query("select",["favoriteColor","count(*)"]).groupBy({"favoriteColor":"asc"}).exec();
     * ```
     *
     * This will provide a list of all favorite colors and how many each of them are in the db.
     *
     * @param {({[key: string]:"asc"|"desc"})} columns
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public groupBy(columns: { [key: string]: "asc" | "desc" }): _NanoSQLQuery {
        this._query.groupBy = columns;
        return this;
    }

    /**
     * Having statement, used to filter Group BY statements. Syntax is identical to where statements.
     *
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public having(args: Array<any | Array<any>>): _NanoSQLQuery {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Having condition requires an array!";
        }
        this._query.having = args;
        return this;
    }

    /**
     * Join command.
     *
     * Example:
     *
     * ```ts
     *  nSQL("orders")
     *  .query("select", ["orders.id","orders.title","users.name"])
     *  .where(["orders.status","=","complete"])
     *  .orderBy({"orders.date":"asc"})
     *  .join({
     *      type:"inner",
     *      table:"users",
     *      where:["orders.customerID","=","user.id"]
     *  }).exec();
     *```
     * A few notes on the join command:
     * 1. You muse use dot notation with the table names in all "where", "select", "orderby", and "groupby" arguments.
     * 2. Possible join types are `inner`, `left`, `right`, and `outer`.
     * 3. The "table" argument lets you determine the data on the right side of the join.
     * 4. The "where" argument lets you set what conditions the tables are joined on.
     *
     *
     *
     * @param {JoinArgs} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public join(args: JoinArgs | JoinArgs[]): _NanoSQLQuery {
        if (Array.isArray(this._query.table)) {
            throw new Error("Can't JOIN with instance table!");
        }
        const err = "Join commands requires table and type arguments!";
        if (Array.isArray(args)) {
            args.forEach((arg) => {
                if (!arg.table || !arg.type) {
                    this._error = err;
                }
            });
        } else {
            if (!args.table || !args.type) {
                this._error = err;
            }
        }

        this._query.join = args;
        return this;
    }

    /**
     * Limits the result to a specific amount.  Example:
     *
     * ```ts
     * .limit(20) // Limit to the first 20 results
     * ```
     *
     * @param {number} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public limit(args: number): _NanoSQLQuery {
        this._query.limit = args;
        return this;
    }

    /**
     * Perform a trie search on a trie column.
     *
     * @param {string} stringToSearch
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public trieSearch(column: string, stringToSearch: string): _NanoSQLQuery {
        this._query.trie = { column: column, search: stringToSearch };
        return this;
    }

    /**
     * Pass comments along with the query.
     * These comments will be emitted along with the other query datay by the event system, useful for tracking queries.
     *
     * @param {string} comment
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    public comment(comment: string): _NanoSQLQuery {
        this._query.comments.push(comment);
        return this;
    }

    /**
     * Perform custom actions supported by plugins.
     *
     * @param {...any[]} args
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    public extend(...args: any[]): _NanoSQLQuery {
        this._query.extend = args;
        return this;
    }

    /**
     * Offsets the results by a specific amount from the beginning.  Example:
     *
     * ```ts
     * .offset(10) // Skip the first 10 results.
     * ```
     *
     * @param {number} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public offset(args: number): _NanoSQLQuery {
        this._query.offset = args;
        return this;
    }

    /**
     * Export the built query object.
     *
     * @returns {IdbQueryExec}
     * @memberof _NanoSQLQuery
     */
    public emit(): IdbQueryExec {
        return this._query;
    }


    /**
     * Export the current query to a CSV file, use in place of "exec()";
     *
     * Example:
     * nSQL("users").query("select").toCSV(true).then(function(csv, db) {
     *   console.log(csv);
     *   // Returns something like:
     *   id,name,pass,postIDs
     *   1,"scott","1234","[1,2,3,4]"
     *   2,"jeb","5678","[5,6,7,8]"
     * });
     *
     * @param {boolean} [headers]
     * @returns {Promise<string>}
     *
     * @memberOf NanoSQLInstance
     */
    public toCSV(headers?: boolean): any {
        let t = this;
        return new Promise((res, rej) => {

            t.exec().then((json: any[]) => {
                const useHeaders = typeof this._query.table === "string" ? this._db.dataModels[this._query.table as string].map(k => k.key) : undefined;
                res(t._db.JSONtoCSV(json, headers || false, useHeaders));
            });
        });
    }

    /**
     * Pass in a query object to manually execute a query against the system.
     *
     * @param {IdbQuery} query
     * @param {(err: any, result: any[]) => void} [complete]
     * @returns {Promise<any>}
     * @memberof _NanoSQLQuery
     */
    public manualExec(query: IdbQueryExec): Promise<any> {
        this._query = {
            ...this._query,
            ...query
        };
        return this.exec();
    }

    /**
     * Handle denormalization requests.
     *
     * @param {string} action
     * @returns
     * @memberof _NanoSQLQuery
     */
    public denormalizationQuery(action: string) {
        return new Promise((res, rej) => {

            switch (action) {
                case "tocolumn":
                    let fnsToRun: {
                        [column: string]: any[];
                    } = {};
                    if (this._query.actionArgs && this._query.actionArgs.length) {
                        Object.keys(this._db.toColRules[this._query.table as string]).filter(c => this._query.actionArgs.indexOf(c) !== -1).forEach((col) => {
                            fnsToRun[col] = this._db.toColRules[this._query.table as string][col];
                        });
                    } else {
                        fnsToRun = this._db.toColRules[this._query.table as string];
                    }

                    this._query.action = "select";
                    this._query.actionArgs = undefined;
                    const columns = Object.keys(fnsToRun);

                    runQuery(this, (rows) => {
                        fastCHAIN(rows, (row, i, done) => {
                            if (Object.isFrozen(row)) {
                                row = _assign(row);
                            }
                            fastALL(columns, (col, i, next) => {
                                const fn = this._db.toColFns[this._query.table as string][fnsToRun[col][0]];
                                if (!fn) {
                                    next();
                                    return;
                                }
                                fn.apply(null, [row[col], (newValue) => {
                                    row[col] = newValue;
                                    next();
                                }].concat(fnsToRun[col].filter((v, i) => i > 0).map(c => row[c])));
                            }).then(() => {
                                this._db.query("upsert", row).manualExec({ table: this._query.table }).then(done).catch(done);
                            });
                        }).then(() => {
                            res({ msg: `${rows.length} rows modified` });
                        });
                    }, rej);
                    break;
                case "torow":

                    const fnKey = (this._query.actionArgs || "").replace("()", "");

                    if (this._db.toRowFns[this._query.table as string] && this._db.toRowFns[this._query.table as string][fnKey]) {

                        const fn: (primaryKey: any, existingRow: any, callback: (newRow: any) => void) => void = this._db.toRowFns[this._query.table as string][fnKey];
                        const PK = this._db.tablePKs[this._query.table as string];

                        if (this._query.on && this._query.on.length) {
                            fastALL(this._query.on, (pk, i, done) => {
                                fn(pk, {}, (newRow) => {
                                    newRow[PK] = pk;
                                    this._db.query("upsert", newRow).manualExec({ table: this._query.table }).then(done).catch(done);
                                });
                            }).then(() => {
                                res([{ msg: `${(this._query.on || []).length} rows modified or added.` }]);
                            });
                            return;
                        }

                        this._query.action = "select";
                        this._query.actionArgs = undefined;

                        runQuery(this, (rows) => {
                            fastALL(rows, (row, i, done) => {
                                if (Object.isFrozen(row)) {
                                    row = _assign(row);
                                }
                                fn(row[PK], row, (newRow) => {
                                    newRow[PK] = row[PK];
                                    this._db.query("upsert", newRow).manualExec({ table: this._query.table }).then(done).catch(done);
                                });
                            }).then(() => {
                                res({ msg: `${rows.length} rows modified` });
                            });
                        }, rej);
                    } else {
                        rej(`No function ${this._query.actionArgs} found to perform updates!`);
                        return;
                    }
                    break;
            }
        });
    }

    /**
     * Executes the current pending query to the db engine, returns a promise with the rows as objects in an array.
     *
     * Example:
     * nSQL("users").query("select").exec().then(function(rows) {
     *     console.log(rows) // <= [{id:1,username:"Scott",password:"1234"},{id:2,username:"Jeb",password:"1234"}]
     *     return nSQL().query("upsert",{password:"something more secure"}).where(["id","=",1]).exec();
     * }).then(function(rows) {
     *  ...
     * })...
     *
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public exec(): any {

        // handle instance queries
        if (Array.isArray(this._query.table)) {
            return new Promise((res, rej) => {
                if (this._db.iB.doExec) {
                    this._db.iB.doExec(this._query, (q) => {
                        res(q.result);
                    }, rej);
                }
            });
        }



        if (this._query.table === "*") return;

        let t = this;

        const a = (this._query.action || "").toLowerCase().trim();

        if (["tocolumn", "torow"].indexOf(a) > -1) {
            if (this._query.debounce) {
                const denormalizationKey = hash(JSON.stringify([this._query.table, a, this._query.actionArgs, this._query.on, this._query.where].filter(r => r)));
                return new Promise((res, rej) => {
                    if (debounceTimers[denormalizationKey]) {
                        clearTimeout(debounceTimers[denormalizationKey]);
                    }
                    debounceTimers[denormalizationKey] = setTimeout(() => {
                        this.denormalizationQuery(a).then(res);
                    }, this._query.debounce);
                });
            }
            return this.denormalizationQuery(a);
        }

        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) > -1) {

            let newArgs = this._query.actionArgs || (a === "select" ? [] : {});
            let setArgs: any = [];
            if (a === "upsert") {

                if (Array.isArray(newArgs)) {
                    setArgs = newArgs;
                } else {
                    setArgs = [newArgs];
                }

                setArgs.forEach((nArgs, i) => {
                    // Do Row Filter
                    if (this._db.rowFilters[this._query.table as string]) {
                        setArgs[i] = this._db.rowFilters[this._query.table as string](setArgs[i]);
                    }

                    // Cast row types and remove columns that don't exist in the data model
                    let inputArgs = {};
                    const models = this._db.dataModels[this._query.table as string];

                    let k = 0;
                    while (k < models.length) {
                        if (setArgs[i][models[k].key] !== undefined) {
                            inputArgs[models[k].key] = cast(models[k].type, setArgs[i][models[k].key]);
                        }
                        k++;
                    }

                    // insert wildcard columns
                    if (this._db.skipPurge[this._query.table as string]) {
                        const modelColumns = models.map(m => m.key);
                        const columns = Object.keys(setArgs[i]).filter(c => modelColumns.indexOf(c) === -1); // wildcard columns
                        columns.forEach((col) => {
                            inputArgs[col] = setArgs[i][col];
                        });
                    }

                    setArgs[i] = inputArgs;
                });


            } else {
                setArgs = this._query.actionArgs;
            }

            this._query.action = a;
            this._query.actionArgs = this._query.actionArgs ? setArgs : undefined;
        } else {
            throw Error("nSQL: No valid database action!");
        }

        return new Promise((res, rej) => {

            const runExec = () => {
                if (!t._db.plugins.length) {
                    t._error = "nSQL: No plugins, nothing to do!";
                }

                if (t._error) {
                    rej(t._error);
                    return;
                }

                if (this._db.queryMod) {
                    this._db.queryMod(this._query, (newQ) => {
                        this._query = newQ;
                        runQuery(this, res, rej);
                    });
                } else {
                    runQuery(this, res, rej);
                }
            };

            if (this._db.isConnected || (this._query.table as string).indexOf("_") === 0) {
                runExec();
            } else {
                this._db.onConnected(runExec);
            }

        });
    }
}