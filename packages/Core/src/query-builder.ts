import { InanoSQLQueryBuilder, InanoSQLObserverQuery, InanoSQLInstance, InanoSQLQuery, InanoSQLJoinArgs, InanoSQLGraphArgs, TableQueryResult } from "./interfaces";
import { buildQuery, uuid, noop, throttle, objectsEqual, resolvePath, assign, _nanoSQLQueue, fastID } from "./utilities";
import * as equal from "fast-deep-equal";

// tslint:disable-next-line
export class _nanoSQLQueryBuilder implements InanoSQLQueryBuilder {

    public _db: InanoSQLInstance;

    public _error: string;

    public _AV: string;

    public _query: InanoSQLQuery;

    public static execMap: any;

    constructor(public databaseID: string, db: InanoSQLInstance, table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>), queryAction: string | ((nSQL: InanoSQLInstance) => InanoSQLQuery), queryArgs?: any, actionOrView?: string) {
        this._db = db;

        this._AV = actionOrView || "";

        if (typeof queryAction === "string") {
            this._query = {
                ...buildQuery(databaseID, db, table, queryAction),
                comments: [],
                state: "pending",
                action: queryAction,
                actionArgs: queryArgs,
                result: []
            };
        } else {
            this._query = {
                ...queryAction(db),
                state: "pending",
                result: []
            };
        }
    }

    /**
     * Selects a collection of rows from the database based on provided conditions.
     * 
     *
     * @param {(any[] | ((row: { [key: string]: any }, i?: number) => boolean))} args
     * @returns {_nanoSQLQueryBuilder}
     * @memberof _nanoSQLQueryBuilder
     */
    public where(args: any[] | ((row: { [key: string]: any }, i?: number) => boolean)): _nanoSQLQueryBuilder {
        this._query.where = args;
        return this;
    }


    public orderBy(columns: string[] | {[col: string]: string}): _nanoSQLQueryBuilder {
        if (Array.isArray(columns)) {
            this._query.orderBy = columns;
        } else {
            this._query.orderBy = Object.keys(columns).map((col) => `${col} ${String(columns[col]).toUpperCase()}`);
        }
        return this;
    }

    public distinct(columns: string[]): _nanoSQLQueryBuilder {
        this._query.distinct = columns;
        return this;
    }

    public groupBy(columns: string[] | {[col: string]: string}): _nanoSQLQueryBuilder {
        if (Array.isArray(columns)) {
            this._query.groupBy = columns;
        } else {
            this._query.groupBy = Object.keys(columns).map((col) => `${col} ${String(columns[col]).toUpperCase()}`);
        }
        return this;
    }

    public having(args: any[] | ((row: { [key: string]: any }, i?: number) => boolean)): _nanoSQLQueryBuilder {
        this._query.having = args;
        return this;
    }


    public join(args: InanoSQLJoinArgs | InanoSQLJoinArgs[]): _nanoSQLQueryBuilder {
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


    public limit(args: number): _nanoSQLQueryBuilder {
        this._query.limit = args;
        return this;
    }

    public updateImmutable(rowData: {[key: string]: any}): _nanoSQLQueryBuilder {
        this._query.updateImmutable = rowData;
        return this;
    } 

    public comment(comment: string): _nanoSQLQueryBuilder {
        this._query.comments.push(comment);
        return this;
    }

    public tag(tag: string): _nanoSQLQueryBuilder {
        this._query.tags.push(tag);
        return this;
    }

    public extend(scope: string, ...args: any[]): _nanoSQLQueryBuilder {
        this._query.extend.push({ scope: scope, args: args });
        return this;
    }

    public union(queries: (() => Promise<any[]>)[], unionAll?: boolean): _nanoSQLQueryBuilder {
        this._query.union = {
            queries: queries,
            type: unionAll ? "all" : "distinct"
        };
        return this;
    }

    public offset(args: number): _nanoSQLQueryBuilder {
        this._query.offset = args;
        return this;
    }

    public emit(): InanoSQLQuery {
        return this._query;
    }

    public ttl(seconds: number = 60, cols?: string[]): _nanoSQLQueryBuilder {
        if (this._query.action !== "upsert") {
            throw new Error("nSQL: Can only do ttl on upsert queries!");
        }
        this._query.ttl = seconds;
        this._query.ttlCols = cols || [];
        return this;
    }

    public graph(ormArgs: InanoSQLGraphArgs[]): _nanoSQLQueryBuilder {
        this._query.graph = ormArgs;
        return this;
    }

    public from(tableObj: {
        table: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
        as?: string
    } | string | any[]): _nanoSQLQueryBuilder {
        if (typeof tableObj === "string" || Array.isArray(tableObj)) {
            this._query.table = tableObj;
        } else {
            this._query.table = tableObj.table;
            this._query.tableAS = tableObj.as;
        }
        return this;
    }

    public into(table: string): _nanoSQLQueryBuilder {
        this._query.table = table;
        return this;
    }

    public on(table: string): _nanoSQLQueryBuilder {
        this._query.table = table;
        return this;
    }

    public toCSV(headers?: boolean): Promise<string> {
        return this.exec().then((json: any[]) => Promise.resolve(this._db.JSONtoCSV(json, headers)));
    }

    public copyTo(table: string, mutate?: (row: any) => any): _nanoSQLQueryBuilder {
        this._query.copyTo = {
            table: table, 
            mutate: mutate || ((r) => r)
        };
        return this;
    }

    public exec(returnEvents?: boolean): Promise<any[]> {

        return new Promise((res, rej) => {
            let buffer: any[] = [];
            this.stream((row) => {
                if (row) {
                    buffer.push(row);
                }
            }, () => {
                res(buffer);
            }, rej, returnEvents);
        });
    }

    public listen(args?: {debounce?: number, unique?: boolean, compareFn?: (rowsA: any[], rowsB: any[]) => boolean}): _nanoSQLObserverQuery {
        return new _nanoSQLObserverQuery(this.databaseID, this._query, args && args.debounce, args && args.unique, args && args.compareFn);
    }

    public stream(onRow: (row: any) => void, complete?: () => void, err?: (error: any) => void, events?: boolean): void {
        this._query.returnEvent = events;
        if (this._db.dbs[this.databaseID] && this._db.getDB(this.databaseID).state.exportQueryObj) {

            onRow(this._query);

            if (complete) complete();

        } else {

            const copyQ = this._query.copyTo ? new _nanoSQLQueue((item, cnt, next, qerr) => {
                this._query.parent.triggerQuery(this.databaseID, {
                    ...buildQuery(this.databaseID, this._query.parent, this._query.copyTo && this._query.copyTo.table || "", "upsert"),
                    actionArgs: this._query.copyTo && this._query.copyTo.mutate(item)
                }, noop, () => {
                    onRow(item);
                    next();
                }, qerr);
            }, err, () => {
                if (complete) complete();
            }) : undefined;

            this._db.triggerQuery(this.databaseID, this._query, (row) => {
                if (copyQ) {
                    copyQ.newItem(row);
                } else {
                    onRow(row);
                }
            }, () => {
                if (copyQ) {
                    copyQ.finished();
                } else {
                    if (complete) complete();
                }
            }, err || noop);
        }
    }

    public cache(cacheReady: (cacheId: string, recordCount: number) => void, error: (error: any) => void, streamPages?: {pageSize: number, onPage: (page: number, rows: any[]) => void, doNotCache?: boolean}): void {
        const id = fastID();
        let buffer: any[] = [];
        let didPage: boolean = false;
        let pageNum = 0;
        const streamObj = streamPages || {pageSize: 0, onPage: noop};
        this.stream((row) => {
            buffer.push(row);
            if (streamObj.pageSize && streamObj.onPage && buffer.length % streamObj.pageSize === 0) {
                didPage = true;
                streamObj.onPage(pageNum, buffer.slice(buffer.length - streamObj.pageSize));
                pageNum++;
                if (streamObj.doNotCache) {
                    buffer = [];
                }
            }
        }, () => {
            if (streamObj.pageSize && streamObj.onPage) {
                if (!didPage || streamObj.doNotCache) { // didn't make it to the page size in total records
                    streamObj.onPage(0, buffer.slice());
                } else { // grab the remaining records
                    streamObj.onPage(pageNum, buffer.slice(pageNum * streamObj.pageSize));
                }
            }
            if (!streamObj.doNotCache) {
                this._db.getDB(this.databaseID)._queryCache[id] = buffer;
                cacheReady(id, buffer.length);
            } else {
                buffer = [];
                cacheReady("", 0);
            }
        }, error)
    }
}

enum observerType {
    stream, exec
}

class _nanoSQLObserverQuery implements InanoSQLObserverQuery {

    private _listenTables: string[] = [];

    private _mode: observerType;

    private _active: boolean = true;

    private _throttleTrigger: () => void;

    private _oldValues: any[];

    private _cbs: {
        stream: [(row: any) => void, () => void, (err: any) => void, boolean],
        exec: [(rows: any[], error?: any) => void, boolean]
    }
    
    constructor(public databaseID: string, public query: InanoSQLQuery, public debounce: number = 500, public unique: boolean = false, public compareFn: (rowsA: any[], rowsB: any[]) => boolean = equal) {
        this.trigger = this.trigger.bind(this);
        this._doQuery = this._doQuery.bind(this);
        this._throttleTrigger = this._doQuery.bind(this);

        this._cbs = {
            stream: [noop, noop, noop, false],
            exec: [noop, false]
        };

        if (typeof query.table !== "string") {
            throw new Error("Can't listen on dynamic tables!");
        }
        if (query.action !== "select") {
            throw new Error("Can't listen to this kind of query!");
        }

        // detect tables to listen for
        this._listenTables.push(query.table as string);
        if (query.join) {
            const join = Array.isArray(query.join) ? query.join : [query.join];
            this._listenTables.concat(this._getTables(join));
        }
        if (query.graph) {
            const graph = Array.isArray(query.graph) ? query.graph : [query.graph];
            this._listenTables.concat(this._getTables(graph));
        }
        // remove duplicate tables
        this._listenTables = this._listenTables.filter((v, i, s) => s.indexOf(v) === i);

        this._throttleTrigger = throttle(this, this._doQuery, debounce);
        this._listenTables.forEach((table) => {
            query.parent.on("change", this._throttleTrigger, table);
        });
    }

    private _getTables(objects: (InanoSQLGraphArgs | InanoSQLJoinArgs)[]): string[] {
        let tables: string[] = [];
        objects.forEach((j) => {
            if (j.with && j.with.table && typeof j.with.table === "string") {
                tables.push(j.with.table);
            }
            const nestedGraph = (j as InanoSQLGraphArgs).graph;
            if (nestedGraph) {
                const graph = Array.isArray(nestedGraph) ? nestedGraph : [nestedGraph];
                tables.concat(this._getTables(graph));
            }
        });
        return tables;
    }

    private _doQuery() {
        if (!this._active || typeof this._mode === "undefined") return;

        switch(this._mode) {
            case observerType.stream:
                this.query.returnEvent = this._cbs.stream[3];
                this.query.parent.triggerQuery(this.databaseID, this.query, this._cbs.stream[0], this._cbs.stream[1], this._cbs.stream[2]);
            break;
            case observerType.exec: 
                this.query.returnEvent = this._cbs.exec[1];
                let rows: any[] = [];
                this.query.parent.triggerQuery(this.databaseID, this.query, (row) => {
                    rows.push(row);
                }, () => {
                    if (this.unique) {
                        let trigger: boolean = false;
                        if (!this._oldValues) { // if no previous values, show results
                            trigger = true;
                        } else {
                            if (this._oldValues.length !== rows.length) { // if the query length is different, show results
                                trigger = true;
                            } else {
                                trigger = !this.compareFn(this._oldValues, rows); // finally, deep equality check (slow af)
                            }
                        }

                        if (trigger) {
                            this._oldValues = rows;
                            this._cbs.exec[0](assign(rows));
                        }
                    } else {
                        this._cbs.exec[0](rows);
                    }
                    
                }, (err) => {
                    this._cbs.exec[0]([], err);
                });
            break;
        }
        
    }

    private _maybeError() {
        if (typeof this._mode !== "undefined") {
            throw new Error("Listen can't have multiple exports!");
        }
    }

    trigger() {
        this._throttleTrigger();
    }

    stream(onRow: (row: any) => void, complete: () => void, error: (err: any) => void, events?: boolean) {
        if (this.unique) {
            throw new Error("Can't use unique with stream listener!");
        }
        this._maybeError();
        this._mode = observerType.stream;
        this._cbs.stream = [onRow, complete, error, events || false];
        this._doQuery();
    }

    exec(callback: (rows: any[], error?: any) => void, events?: boolean) {
        this._maybeError();
        this._mode = observerType.exec;
        this._cbs.exec = [callback, events || false];
        this._doQuery();
    }

    unsubscribe() {
        this._active = false;
        this._listenTables.forEach((table) => {
            this.query.parent.off("change", this._throttleTrigger, table);
        });
    }
}