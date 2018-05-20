import { NanoSQLInstance, ORMArgs, JoinArgs, DBRow } from "../index";
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
    orderBy?: {
        [column: string]: "asc" | "desc";
    };
    groupBy?: {
        [column: string]: "asc" | "desc";
    };
    having?: any[];
    join?: JoinArgs | JoinArgs[];
    limit?: number;
    offset?: number;
    on?: any[];
    debounce?: number;
    trie?: {
        column: string;
        search: string;
    };
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
export declare class _NanoSQLQuery {
    _db: NanoSQLInstance;
    _error: string;
    _AV: string;
    _query: IdbQuery;
    static execMap: any;
    constructor(db: NanoSQLInstance, table: string | any[], queryAction: string, queryArgs?: any, actionOrView?: string);
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
    where(args: any[] | any): _NanoSQLQuery;
    /**
     * Query to get a specific range of rows very efficiently.
     *
     * @param {number} limit
     * @param {number} offset
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    range(limit: number, offset: number): _NanoSQLQuery;
    /**
     * When using "from" features specific what primary keys to update.
     *
     * @param {any[]} primaryKeys
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    on(primaryKeys: any[]): _NanoSQLQuery;
    /**
     * Debounce aggregate function calls.
     *
     * @param {number} ammt
     * @memberof _NanoSQLQuery
     */
    debounce(ms?: number): _NanoSQLQuery;
    /**
     * Trigge ORM queries for all result rows.
     *
     * @param {((string|ORMArgs)[])} [ormArgs]
     * @returns {_NanoSQLQuery}
     *
     * @memberof _NanoSQLQuery
     */
    orm(ormArgs?: (string | ORMArgs)[]): _NanoSQLQuery;
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
    orderBy(args: {
        [key: string]: "asc" | "desc";
    }): _NanoSQLQuery;
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
    groupBy(columns: {
        [key: string]: "asc" | "desc";
    }): _NanoSQLQuery;
    /**
     * Having statement, used to filter Group BY statements. Syntax is identical to where statements.
     *
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    having(args: Array<any | Array<any>>): _NanoSQLQuery;
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
    join(args: JoinArgs | JoinArgs[]): _NanoSQLQuery;
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
    limit(args: number): _NanoSQLQuery;
    /**
     * Perform a trie search on a trie column.
     *
     * @param {string} stringToSearch
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    trieSearch(column: string, stringToSearch: string): _NanoSQLQuery;
    /**
     * Pass comments along with the query.
     * These comments will be emitted along with the other query datay by the event system, useful for tracking queries.
     *
     * @param {string} comment
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    comment(comment: string): _NanoSQLQuery;
    /**
     * Perform custom actions supported by plugins.
     *
     * @param {...any[]} args
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    extend(...args: any[]): _NanoSQLQuery;
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
    offset(args: number): _NanoSQLQuery;
    /**
     * Export the built query object.
     *
     * @returns {IdbQueryExec}
     * @memberof _NanoSQLQuery
     */
    emit(): IdbQueryExec;
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
    toCSV(headers?: boolean): any;
    /**
     * Pass in a query object to manually execute a query against the system.
     *
     * @param {IdbQuery} query
     * @param {(err: any, result: any[]) => void} [complete]
     * @returns {Promise<any>}
     * @memberof _NanoSQLQuery
     */
    manualExec(query: IdbQueryExec): Promise<any>;
    /**
     * Handle denormalization requests.
     *
     * @param {string} action
     * @returns
     * @memberof _NanoSQLQuery
     */
    denormalizationQuery(action: string): any;
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
    exec(): any;
}
