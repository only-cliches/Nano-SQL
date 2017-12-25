import { NanoSQLInstance, ORMArgs, JoinArgs, DBRow, DatabaseEvent } from "../index";
import { _assign, StdObject, uuid, cast, Promise, timeid, fastCHAIN, fastALL } from "../utilities";

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
    join?: JoinArgs;
    limit?: number;
    offset?: number;
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


const runQuery = (self: _NanoSQLQuery, complete: (result: any) => void) => {

    if (self._db._plugins.length === 1 && !self._db.hasAnyEvents) {
        // fast query path, only used if there's a single plugin and no event listeners
        (self._db._plugins[0] as any).doExec(self._query, (newQ) => {
            self._query = newQ;
            complete(self._query.result);
        });
    } else {
        fastCHAIN(self._db._plugins, (p, i, nextP) => {
            if (p.doExec) {
                p.doExec(self._query, (newQ) => {
                    self._query = newQ || self._query;
                    nextP();
                });
            } else {
                nextP();
            }
        }).then(() => {

            complete(self._query.result);

            if (self._db.hasAnyEvents || self._db.pluginsDoHasExec) {

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

                fastCHAIN(self._db._plugins, (p, i, nextP) => {
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
        });
    }
};

// tslint:disable-next-line
export class _NanoSQLQuery {

    public _db: NanoSQLInstance;

    public _error: string;

    public _AV: string;

    public _query: IdbQuery;

    public static execMap: any;

    constructor(db: NanoSQLInstance) {
        this._db = db;
    }

    public set(table: string | any[], queryAction: string, queryArgs?: any, actionOrView?: string) {

        this._AV = actionOrView || "";
        this._query = {
            table: table,
            comments: [],
            state: "pending",
            queryID: Date.now() + "." + this._db.fastRand(),
            action: queryAction,
            actionArgs: queryArgs,
            result: []
        };
        return this;
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
     * NanoSQL("users").query("select",["favoriteColor","count(*)"]).groupBy({"favoriteColor":"asc"}).exec();
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
     *  NanoSQL("orders")
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
    public join(args: JoinArgs): _NanoSQLQuery {
        if (Array.isArray(this._query.table)) {
            throw Error("Can't JOIN with instance table!");
        }
        if (!args.table || !args.type) {
            this._error = "Join command requires table and type arguments!";
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
     * If this query results in revision(s) being generated, this will add a comment to those revisions.
     *
     * @param {object} comment
     * @returns {_NanoSQLQuery}
     *
     * @memberof _NanoSQLQuery
     */
    /*public revisionComment(comment: {[key: string]: any}): _NanoSQLQuery {
        return this._addCmd("comment", comment);
    }*/
    public comment(comment: string): _NanoSQLQuery {
        this._query.comments.push(comment);
        return this;
    }

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
     * Export the current query to a CSV file, use in place of "exec()";
     *
     * Example:
     * NanoSQL("users").query("select").toCSV(true).then(function(csv, db) {
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

                let csv: string[] = [];
                if (!json.length) {
                    res("", t);
                }
                if (headers) {
                    csv.push(Object.keys(json[0]).join(","));
                }

                json.forEach((row) => {
                    csv.push(Object.keys(row).map((k) => {
                        if (row[k] === null || row[k] === undefined) {
                            return "";
                        }
                        // tslint:disable-next-line
                        return typeof row[k] === "object" ? '"' + JSON.stringify(row[k]).replace(/\"/g, '\'') + '"' : row[k];
                    }).join(","));
                });
                res(csv.join("\n"), t);
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
     * Executes the current pending query to the db engine, returns a promise with the rows as objects in an array.
     * The second argument of the promise is always the NanoSQL variable, allowing you to chain commands.
     *
     * Example:
     * NanoSQL("users").query("select").exec().then(function(rows, db) {
     *     console.log(rows) // <= [{id:1,username:"Scott",password:"1234"},{id:2,username:"Jeb",password:"1234"}]
     *     return db.query("upsert",{password:"something more secure"}).where(["id","=",1]).exec();
     * }).then(function(rows, db) {
     *  ...
     * })...
     *
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public exec(): any {

        let t = this;

        const a = this._query.action.toLowerCase();
        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) > -1) {

            let newArgs = this._query.actionArgs || (a === "select" || a === "delete" ? [] : {});

            if (a === "upsert") {

                // Cast row types and remove columns that don't exist in the data model
                let inputArgs = {};
                const models = this._db._models[this._query.table as string];
                let k = 0;
                while (k < models.length) {
                    if (newArgs[models[k].key] !== undefined) {
                        inputArgs[models[k].key] = cast(models[k].type, newArgs[models[k].key]);
                    }
                    k++;
                }
                newArgs = inputArgs;
            }

            this._query.action = a;
            this._query.actionArgs = this._query.actionArgs ? newArgs : undefined;
        } else {
            throw Error("No valid database action!");
        }

        return new Promise((res, rej) => {

            // handle instance queries
            if (Array.isArray(this._query.table)) {
                if (this._db._instanceBackend.doExec) {
                    this._db._instanceBackend.doExec(this._query, (q) => {
                        res(q.result);
                    });
                }
                return;
            }

            if (!t._db._plugins.length) {
                t._error = "No plugins, nothing to do!";
            }

            if (t._error) {
                rej(t._error, this._db);
                return;
            }


            if (this._db._queryMod) {
                this._db._queryMod(this._query, (newQ) => {
                    this._query = newQ;
                    runQuery(this, res);
                });
            } else {
                runQuery(this, res);
            }

        });
    }
}