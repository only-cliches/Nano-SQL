import { INanoSQLQueryBuilder, INanoSQLInstance, INanoSQLQuery, INanoSQLJoinArgs, INanoSQLGraphArgs, TableQueryResult } from "./interfaces";
import { buildQuery, uuid } from "./utilities";

// tslint:disable-next-line
export class _NanoSQLQueryBuilder implements INanoSQLQueryBuilder {

    public _db: INanoSQLInstance;

    public _error: string;

    public _AV: string;

    public _query: INanoSQLQuery;

    public static execMap: any;

    constructor(db: INanoSQLInstance, table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>), queryAction: string | ((nSQL: INanoSQLInstance) => INanoSQLQuery), queryArgs?: any, actionOrView?: string) {
        this._db = db;

        this._AV = actionOrView || "";

        if (typeof queryAction === "string") {
            this._query = {
                ...buildQuery(table, queryAction),
                comments: [],
                state: "pending",
                action: queryAction,
                actionArgs: queryArgs,
                result: []
            };
        } else {
            this._query = {
                ...buildQuery(table, ""),
                ...queryAction(db),
                state: "pending"
            };
        }
    }

    public where(args: any[] | ((row: { [key: string]: any }, i?: number) => boolean)): _NanoSQLQueryBuilder {
        this._query.where = args;
        return this;
    }


    public orderBy(args: string[]): _NanoSQLQueryBuilder {
        this._query.orderBy = args;
        return this;
    }

    public groupBy(columns: string[]): _NanoSQLQueryBuilder {
        this._query.groupBy = columns;
        return this;
    }

    public having(args: any[] | ((row: { [key: string]: any }, i?: number) => boolean)): _NanoSQLQueryBuilder {
        this._query.having = args;
        return this;
    }


    public join(args: INanoSQLJoinArgs | INanoSQLJoinArgs[]): _NanoSQLQueryBuilder {
        const err = "Join commands requires table and type arguments!";
        if (Array.isArray(args)) {
            args.forEach((arg) => {
                if (!arg.with.table || !arg.type) {
                    this._error = err;
                }
            });
        } else {
            if (!args.with.table || !args.type) {
                this._error = err;
            }
        }

        this._query.join = args;
        return this;
    }


    public limit(args: number): _NanoSQLQueryBuilder {
        this._query.limit = args;
        return this;
    }

    public comment(comment: string): _NanoSQLQueryBuilder {
        this._query.comments.push(comment);
        return this;
    }

    public tag(tag: string): _NanoSQLQueryBuilder {
        this._query.tags.push(tag);
        return this;
    }

    public extend(scope: string, ...args: any[]): _NanoSQLQueryBuilder {
        this._query.extend.push({ scope: scope, args: args });
        return this;
    }

    public union(queries: (() => Promise<any[]>)[], unionAll?: boolean): _NanoSQLQueryBuilder {
        this._query.union = {
            queries: queries,
            type: unionAll ? "all" : "distinct"
        };
        return this;
    }

    public offset(args: number): _NanoSQLQueryBuilder {
        this._query.offset = args;
        return this;
    }

    public emit(): INanoSQLQuery {
        return this._query;
    }

    public ttl(seconds: number = 60, cols?: string[]): _NanoSQLQueryBuilder {
        if (this._query.action !== "upsert") {
            throw new Error("nSQL: Can only do ttl on upsert queries!");
        }
        this._query.ttl = seconds;
        this._query.ttlCols = cols || [];
        return this;
    }

    public graph(ormArgs: INanoSQLGraphArgs[]): _NanoSQLQueryBuilder {
        this._query.graph = ormArgs;
        return this;
    }

    public from(tableObj: {
        table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string
    }): _NanoSQLQueryBuilder {
        this._query.table = tableObj.table;
        this._query.tableAS = tableObj.as;
        return this;
    }

    public into(table: string): _NanoSQLQueryBuilder {
        this._query.table = table;
        return this;
    }

    public on(table: string): _NanoSQLQueryBuilder {
        this._query.table = table;
        return this;
    }

    public toCSV(headers?: boolean): any {
        let t = this;
        return t.exec().then((json: any[]) => Promise.resolve(t._db.JSONtoCSV(json, headers)));
    }

    public exec(): Promise<{ [key: string]: any }[]> {

        return new Promise((res, rej) => {
            let buffer: any[] = [];
            this.stream((row) => {
                if (row) {
                    buffer.push(row);
                }
            }, () => {
                res(buffer);
            }, rej);
        });
    }

    public stream(onRow: (row: any) => void, complete: () => void, err: (error: any) => void): void {
        this._db.triggerQuery(this._query, onRow, complete, err);
    }

    public cache(): Promise<{id: string, total: number}> {
        return new Promise((res, rej) => {
            const id = uuid();
            this.exec().then((rows) => {
                this._db._queryCache[id] = rows;
                res({
                    id: id,
                    total: rows.length
                });
            }).catch(rej);
        });
    }
}