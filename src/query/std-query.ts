import { NanoSQLInstance, ORMArgs, JoinArgs, DBRow, DatabaseEvent } from "../index";
import { CHAIN, _assign, StdObject, uuid, cast } from "../utilities";
import { Promise, setFast } from "lie-ts";

export interface IdbQuery {
    table: string|any[];
    action: string;
    actionArgs: any;
    state: string;
    queryID?: string;
    transaction?: boolean;
    where?: (row: DBRow, idx: number) => boolean|any[];
    range?: number[];
    ormSync?: string[];
    orm?: (string | ORMArgs)[];
    orderBy?: { [column: string]: "asc" | "desc" };
    groupBy?: { [column: string]: "asc" | "desc" };
    having?: any[];
    join?: JoinArgs;
    limit?: number;
    offset?: number;
    trie?: {column: string, search: string};
    comments: string[];
    extend?: any[];
    result: DBRow[];
}


// tslint:disable-next-line
export class _NanoSQLQuery {

    private _db: NanoSQLInstance;

    public _error: string;

    public _AV: string;

    private _query: IdbQuery;

    constructor(table: string|any[], db: NanoSQLInstance, queryAction: string, queryArgs?: any, actionOrView?: string, bypassORMPurge?: boolean) {
        this._db = db;
        this._AV = actionOrView || "";
        this._query = {
            table: table,
            comments: [],
            state: "pending",
            queryID: new Date().getTime() + "-" + Math.round(Math.random() * 100),
            action: queryAction,
            actionArgs: queryArgs,
            result: []
        };

        if (Array.isArray(this._query.table)) {
            return;
        }

        const a = queryAction.toLowerCase();
        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) > -1) {

            let newArgs = queryArgs || (a === "select" || a === "delete" ? [] : {});

            // Purge ORM columns from the delete arguments
            /*if (["delete", "upsert"].indexOf(a) > -1 && !bypassORMPurge && this._db.relationColumns[this._db.sTable as string].length) {
                let inputArgs = {};
                this._db.relationColumns[this._db.sTable as string].forEach((column) => {
                    newArgs[column] = undefined;
                });
                newArgs = inputArgs;
            }*/

            if (a === "upsert") {

                // Cast row types and remove columns that don't exist in the data model
                let inputArgs = {};

                this._db._models[this._db.sTable as string].forEach((model) => {
                    // Cast known columns and purge uknown columns
                    if (newArgs[model.key] !== undefined) {
                        inputArgs[model.key] = cast(model.type, newArgs[model.key]);
                    }
                });
                newArgs = inputArgs;
            }

            this._query.action = a;
            this._query.actionArgs = queryArgs ? newArgs : undefined;
        } else {
            throw Error("No valid database action!");
        }
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
    public where(args: any[]|any): _NanoSQLQuery {
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
            throw Error ("Can't JOIN with instance table!");
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
        this._query.trie = {column: column, search: stringToSearch};
        return this;
    }

    /**
     * Track changes to the ORM system in this query.
     *
     * @returns
     * @memberof _NanoSQLQuery
     */
    public ormSync(columns?: string[]) {
        this._query.ormSync = columns || [];
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
    public toCSV(headers?: boolean): Promise<string> {
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
                        return typeof row[k] === "object" ? '"' + JSON.stringify(row[k]).replace(/\"/g,'\'') + '"' : row[k]; 
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
    public manualExec(query: IdbQuery, complete?: (err: any, result: any[]) => void): Promise<any> {
        this._query = {
            ...query,
            ...this._query
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
    public exec(): Promise<(object | NanoSQLInstance)[]> {

        let t = this;

        return new Promise((res, rej) => {

            if (!t._db._plugins.length) {
                t._error = "No plugins, nothing to do!";
            }

            if (t._error) {
                rej(t._error);
                return;
            }

            let rows: any[] = [];

            new CHAIN(t._db._plugins.map((p, i) => {
                return (nextP) => {
                    if (p.doExec) {
                        p.doExec(this._query, (newQ) => {
                            this._query = newQ || this._query;
                            nextP();
                        });
                    } else {
                        nextP();
                    }
                };
            })).then(() => {



                // instance databases do not cause events to emit
                if (Array.isArray(t._query.table)) {
                    res(this._query.result, this._db);
                    return;
                }

                const eventTypes: ("change" | "delete" | "upsert" | "drop" | "select" | "error" | "transaction")[] = (() => {
                    switch (t._query.action) {
                        case "select": return [t._query.action];
                        case "delete":
                        case "upsert":
                        case "drop": return [t._query.action, "change"];
                        default: return [] as any[];
                    }
                })();
                const hasLength = this._query.result && this._query.result.length;
                const row = { affectedRowPKS: [], affectedRows: []};

                let event: DatabaseEvent = {
                    table: t._query.table as string,
                    query: t._query,
                    time: new Date().getTime(),
                    result: rows,
                    notes: [],
                    types: eventTypes,
                    actionOrView: t._AV,
                    transactionID: t._query.transaction ? t._query.queryID : undefined,
                    affectedRowPKS: hasLength ? (this._query.result[0] || row).affectedRowPKS : [],
                    affectedRows: hasLength ? (this._query.result[0] || row).affectedRows : [],
                };

                res(this._query.result, this._db);

                new CHAIN(t._db._plugins.map((p) => {
                    return (nextP) => {
                        if (p.didExec) {
                            p.didExec(event, (newE) => {
                                event = newE;
                                nextP();
                            });
                        } else {
                            nextP();
                        }
                    };
                })).then(() => {
                    t._db.triggerEvent(event);
                });

            });
        });
    }
}