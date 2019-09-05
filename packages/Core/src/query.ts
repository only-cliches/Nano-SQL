import {
    InanoSQLQuery,
    ISelectArgs,
    IWhereArgs,
    IWhereType,
    InanoSQLIndex,
    IWhereCondition,
    InanoSQLSortBy,
    InanoSQLTableConfig,
    configTableFilter,
    InanoSQLDataModel,
    InanoSQLTableColumn,
    InanoSQLJoinArgs,
    InanoSQLQueryExec,
    InanoSQLInstance,
    customQueryFilter,
    InanoSQLGraphArgs,
    InanoSQLTable,
    conformRowFilter,
    deleteRowFilter,
    addRowFilter,
    updateRowFilter,
    TableQueryResult,
    InanoSQLDatabaseEvent,
    addRowEventFilter,
    deleteRowEventFilter,
    updateRowEventFilter,
    updateIndexFilter,
    InanoSQLupdateIndex,
    InanoSQLFKActions,
    InanoSQLForeignKey,
    configTableSystemFilter,
    InanoSQLAdapter
} from "./interfaces";

import {
    deepGet,
    chainAsync,
    objectsEqual,
    hash,
    resolvePath,
    allAsync,
    maybeAssign,
    assign,
    buildQuery,
    deepSet,
    _nanoSQLQueue,
    adapterFilters,
    execFunction,
    cast,
    random16Bits,
    noop,
    mutateRowTypes,
    maybeDate,
    blankTableDefinition,
    fastID,
} from "./utilities";
import { resolveMode } from "./adapter-detect";

export const secondaryIndexQueue: { [idAndTable: string]: _nanoSQLQueue } = {};

const globalTableCache: {
    [cacheID: string]: {
        [table: string]: {
            loading: boolean;
            cache: boolean;
            rows: any[];
        }
    }
} = {};



// tslint:disable-next-line
export class _nanoSQLQuery implements InanoSQLQueryExec {

    public _queryBuffer: any[] = [];
    public _stream: boolean = true;
    public _selectArgs: ISelectArgs[] = [];
    public _whereArgs: IWhereArgs;
    public _havingArgs: IWhereArgs;
    public _pkOrderBy: boolean = false;
    public _idxOrderBy: boolean = false;
    public _sortGroups: any[][] = [];
    public _sortGroupKeys: {
        [groupKey: string]: number;
    } = {};
    public _groupByColumns: string[];

    public _orderBy: InanoSQLSortBy;
    public _groupBy: InanoSQLSortBy;
    public upsertPath: string[];
    private _hasOrdered: boolean;
    private _startTime: number;
    public _indexesUsed: string[];

    public static _whereMemoized: {
        [key: string]: IWhereArgs;
    } = {};

    public static _sortMemoized: {
        [key: string]: InanoSQLSortBy;
    } = {};

    public static _selectArgsMemoized: {
        [key: string]: {
            hasFn: boolean;
            hasAggrFn: boolean;
            args: ISelectArgs[];
        }
    } = {};

    public _hasAggrFn: boolean;
    public _hasFn: boolean;

    public _didRangeAlready: boolean;

    constructor(
        public databaseID: string|undefined,
        public nSQL: InanoSQLInstance,
        public query: InanoSQLQuery,
        public progress: (row: any, i: number) => void,
        public complete: () => void,
        public error: (err: any) => void
    ) {
        this.query.state = "processing";
        this._indexesUsed = [];
        this._startTime = Date.now();
        const action = query.action.toLowerCase().trim();
        this._orderByRows = this._orderByRows.bind(this);
        this._onError = this._onError.bind(this);
        if (["select", "clone", "create table", "create table if not exists", "show tables"].indexOf(action) === -1 && typeof query.table !== "string") {
            this.query.state = "error";
            this.error(`Only "select", "clone" & "create table" queries are available for this resource!`);
            return;
        }

        if (typeof query.table === "string" && (!this.databaseID || !this.nSQL.getDB(this.databaseID).state.connected)) {
            this.query.state = "error";
            this.error(`Can't execute query before the database has connected!`);
            return;
        }

        const requireQueryOpts = (requireAction: boolean, cb: () => void) => {
            if (typeof this.query.table !== "string" || !this.query.table) {
                this.query.state = "error";
                this.error(`${this.query.action} query requires a table argument!`);
                return;
            }
            if (requireAction && !this.query.actionArgs) {
                this.query.state = "error";
                this.error(`${this.query.action} query requires an additional argument!`);
                return;
            }
            cb();
        };

        const finishQuery = () => {
            if (this.query.state !== "error") {
                this.query.state = "complete";
                this.complete();
            }
        };

        if (!this.query.cacheID) {
            this.query.cacheID = this.query.queryID;
        }

        switch (action) {
            case "select":
                this._select(finishQuery, this.error);
                break;
            case "total":
                requireQueryOpts(false, () => {
                    const args = this.query.actionArgs;
                    if (args && args.rebuild) {
                        try {
                            adapterFilters(this.databaseID, this.nSQL, this.query).getTableIndexLength(this.query.table as string, (count) => {

                                this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].count = count;

                                this.nSQL.saveCount(this.databaseID || "", this.query.table as string, (err) => {
                                    if (err) {
                                        this.error(err);
                                    } else {
                                        this.progress({total: count}, 0);
                                        this.complete();
                                    }
                                });
                            }, this.error);
                        } catch (e) {
                            this.error(e);
                        }
                    } else {
                        try {
                            const total = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].count;
                            this.progress({total: total}, 0);
                            this.complete();
                        } catch (e) {
                            this.error(e);
                        }
                    }
                });
                break;
            case "upsert":
                requireQueryOpts(true, () => {
                    this._upsert(this.progress, this.complete, this.error);
                });
                break;
            case "delete":
                requireQueryOpts(false, () => {
                    this._delete(this.progress, this.complete, this.error);
                });
                break;
            case "show tables":
                this._showTables();
                break;
            case "describe":
                this._describe();
                break;
            case "describe indexes":
                this._describe("idx");
                break;
            case "drop":
            case "drop table":
                this._dropTable(this.query.table as string, finishQuery, this.error);
                break;
            case "create table":
            case "create table if not exists":
                this._createTable(this.query.actionArgs as InanoSQLTableConfig, false, progress, finishQuery, this.error);
                break;
            case "alter table":
                requireQueryOpts(true, () => {
                    this._createTable(this.query.actionArgs as InanoSQLTableConfig, true, progress, finishQuery, this.error);
                });
                break;
            case "rebuild indexes":
                requireQueryOpts(false, () => {
                    this._rebuildIndexes(this.progress, finishQuery, this.error);
                });
                break;
            case "conform rows":
                requireQueryOpts(false, () => {
                    this._conform(this.progress, finishQuery, this.error);
                });
                break;
            case "clone":
                requireQueryOpts(true, () => {
                    this._clone(this.progress, finishQuery, this.error);
                });
                break;
            default:
                this.nSQL.doFilter<customQueryFilter>(this.databaseID, "customQuery", { res: undefined, query: this.query, onRow: progress, complete: complete, error: error }, () => {
                    this.query.state = "error";
                    this.error(`Query type "${query.action}" not supported!`);
                }, (err) => {
                    this.query.state = "error";
                    this.error(err);
                });
        }
    }

    public _clone(progress: (row: any, i: number) => void, finished: () => void, error: (err: any) => void) {
        const mode = this.query.actionArgs && this.query.actionArgs.mode;
        const adapterCB: (adapter: InanoSQLAdapter) => void = this.query.actionArgs && this.query.actionArgs.getAdapter;
        const id = this.query.actionArgs && this.query.actionArgs.id || this.query.parent.getDB(this.databaseID).state.id;
        if (!id || !mode) {
            error(`Id & Mode required for clone query!`);
            return;
        }
        const adapter = resolveMode(mode);
        // this.query.parent.getDB(this.databaseID)._tables
        const tables: string[] = this.query.table !== "*" ? [this.query.table as string] : Object.keys(this.nSQL.getDB(this.databaseID)._tables);
        let i = 0;
        let setIds: { [tableName: string]: string } = {};
        // 1. connect to secondary adapter
        adapter.connect(id, () => {

            chainAsync(tables, (tableName, i, nextTable, errTable) => {
                const table = this.query.parent.getDB(this.databaseID)._tables[tableName];
                if (!table) {
                    errTable(`Table ${table} not found!`);
                    return;
                }
                // 2. create copy of table in secondary adapter
                adapter.createTable(this.query.parent.getDB(this.databaseID)._tableIds[table.name], table, () => {
                    setIds[table.name] = this.query.parent.getDB(this.databaseID)._tableIds[table.name];
                    // 3. create copy of indexes in secondary adapter
                    allAsync(Object.keys(table.indexes), (index, i, next, err) => {
                        const idx = table.indexes[index];
                        adapter.createIndex(this.query.parent.getDB(this.databaseID)._tableIds[table.name], index, idx.type, next, err);
                    }).then(() => {
                        const writeQueue = new _nanoSQLQueue((item, i, complete, error) => {
                            progress({ target: table.name, targetId: this.query.parent.getDB(this.databaseID)._tableIds[table.name], object: item }, i);
                            i++;
                            adapter.write(this.query.parent.getDB(this.databaseID)._tableIds[table.name], deepGet(table.pkCol, item), item, complete, error);
                        }, error, () => {
                            // 5. copy indexes to new adapter table
                            chainAsync(Object.keys(table.indexes), (indexName, i, nextIndex, indexErr) => {
                                const index = table.indexes[indexName];
                                adapterFilters(this.databaseID, this.query.parent, this.query).readIndexKeys(table.name, indexName, "all", undefined, undefined, false, (rowId, key) => {
                                    progress({ target: this.query.parent.getDB(this.databaseID)._tableIds[table.name] + "." + indexName, targetId: table.name + "." + indexName, object: { key, rowId } }, i);
                                    i++;
                                    adapter.addIndexValue(this.query.parent.getDB(this.databaseID)._tableIds[table.name], indexName, rowId, key, noop, indexErr);
                                }, nextIndex, indexErr);
                            }).then(() => {
                                // 6. Done
                                nextTable();
                            }).catch(error);
                        });
                        // 4. Copy rows to new adapter table
                        adapterFilters(this.databaseID, this.query.parent, this.query).readMulti(table.name, "all", undefined, undefined, false, (row, i) => {
                            writeQueue.newItem(row);
                        }, () => {
                            writeQueue.finished();
                        }, error);
                    }).catch(error);
                }, error);
            }).then(() => {
                // set table ids
                adapter.createTable("_util", {
                    ...blankTableDefinition,
                    name: "_util",
                    model: {
                        "key:string": { pk: true },
                        "value:any": {}
                    }
                }, () => {
                    adapter.read("_util", "tableIds", (row) => {
                        const ids = {
                            ...(row && row.value || {}),
                            ...setIds
                        }
                        adapter.write("_util", "taleIds", { key: "tableIds", value: ids }, () => {
                            if (adapterCB) {
                                adapterCB(adapter);
                                finished();
                            } else {
                                adapter.disconnect(() => {
                                    finished();
                                }, error);
                            }
                        }, error);
                    }, error);
                }, error);
            }).catch(error);
        }, error);
    }

    public _conform(progress: (row: any, i: number) => void, finished: () => void, error: (err: any) => void) {
        const conformTable = this.query.table as string;
        const conformFilter = this.query.actionArgs || function (r) { return r };
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where, typeof this.query.table !== "string" || typeof this.query.union !== "undefined") : { type: IWhereType.none };

        if (!this.databaseID || !this.nSQL.getDB(this.databaseID)._tables[conformTable]) {
            error(new Error(`Table ${conformTable} not found for conforming!`));
            return;
        }
        let count = 0;
        const conformQueue = new _nanoSQLQueue((item, i, done, err) => {
            const newRow = this.nSQL.default(this.databaseID || "", item, conformTable);
            this.nSQL.doFilter<conformRowFilter>(this.databaseID, "conformRow", { res: newRow, oldRow: item, query: this.query }, (setRow) => {
                this._diffUpdates(this.query.table as string, item, setRow.res, () => {
                    const changeEvent = {
                        target: conformTable,
                        path: "*",
                        events: ["upsert", "change", "*"],
                        time: Date.now(),
                        performance: Date.now() - this._startTime,
                        result: setRow.res,
                        oldRow: item,
                        query: this.query,
                        indexes: this._indexesUsed
                    };
                    if (this.nSQL.getDB(this.databaseID).state.hasAnyEvents) {
                        this.nSQL.triggerEvent(this.databaseID || "", changeEvent);
                        Object.keys(this.nSQL.events[this.databaseID || ""][this.query.table as string]).forEach((path) => {
                            if (path !== "*") {
                                if (!objectsEqual(deepGet(path, item), deepGet(path, setRow.res))) {
                                    this.nSQL.triggerEvent(this.databaseID || "", {
                                        target: this.query.table as string,
                                        path: path,
                                        events: ["upsert", "change", "*"],
                                        time: Date.now(),
                                        performance: Date.now() - this._startTime,
                                        result: setRow.res,
                                        oldRow: item,
                                        query: this.query,
                                        indexes: this._indexesUsed
                                    }, true);
                                }
                            }
                        });
                    }
                    this._startTime = Date.now();
                    progress(this.query.returnEvent ? changeEvent : setRow.res, i);
                    count++;
                    done();
                }, err);
            }, error);

        }, error, () => {
            finished();
        });

        this._getRecords((row, i) => {
            conformQueue.newItem(conformFilter(row));
        }, () => {
            conformQueue.finished();
        }, error);

    }

    public _getTable(tableName: string, whereCond: any[] | ((row: { [key: string]: any; }, i?: number) => boolean) | undefined, table: any, callback: (result: TableQueryResult) => void) {
        const cacheID = this.query.cacheID as string;

        if (typeof table === "function") {
            if (!globalTableCache[cacheID]) {
                globalTableCache[cacheID] = {};
            }

            if (!globalTableCache[cacheID][tableName]) { // first load
                globalTableCache[cacheID][tableName] = { loading: true, rows: [], cache: true };
                table(whereCond).then((result: TableQueryResult) => {
                    const doCache = (result.cache && !result.filtered) || false;
                    globalTableCache[cacheID][tableName] = { loading: false, rows: doCache ? result.rows : [] as any, cache: doCache };
                    callback(result);
                }).catch(this._onError);
                return;
            }
            if (globalTableCache[cacheID][tableName].loading) {
                setTimeout(() => {
                    this._getTable(tableName, whereCond, table, callback);
                }, 10);
                return;
            }
            if (globalTableCache[cacheID][tableName].cache) {
                callback({ filtered: false, rows: globalTableCache[cacheID][tableName].rows, cache: true });
                return;
            }
            table(whereCond).then((result: TableQueryResult) => {
                callback(result);
            }).catch(this._onError);
        } else {
            callback({ rows: table, filtered: false, cache: false });
        }
    }

    /**
     * Peform a join command.
     *
     * @internal
     * @param {DBRow[]} rows
     * @param {(rows: DBRow[]) => void} complete
     * @returns {void}
     * @memberof _MutateSelection
     */
    public _maybeJoin(joinData: InanoSQLJoinArgs[], leftRow: any, onRow: (rowData: any) => void, complete: () => void): void {

        if (!joinData[0]) { // no join to perform, NEXT!
            onRow(leftRow);
            complete();
            return;
        }


        const doJoin = (rowData: { [table: string]: any }, joinIdx: number, joinDone: () => void) => {

            const join = joinData[joinIdx];
            let joinRowCount = 0;
            let rightHashes: any[] = [];

            if (join.type !== "cross" && !join.on) {
                this.query.state = "error";
                this.error(new Error("Non 'cross' joins require an 'on' parameter!"));
                return;
            }

            const noJoinAS = new Error("Must use 'AS' when joining temporary tables!");

            if (typeof join.with.table !== "string" && !join.with.as) {
                this.query.state = "error";
                this.error(noJoinAS);
                return;
            }

            if (typeof this.query.table !== "string" && !this.query.tableAS) {
                this.query.state = "error";
                this.error(noJoinAS);
                return;
            }

            const joinBuffer = new _nanoSQLQueue((rData, i, rDone, err) => {

                if (!joinData[joinIdx + 1]) { // no more joins, send joined row
                    onRow(rData);
                    rDone();
                } else { // more joins, nest on!
                    doJoin(rData, joinIdx + 1, rDone);
                }
            }, this.error, joinDone);


            const withPK = typeof join.with.table === "string" ? this.nSQL.getDB(this.databaseID)._tables[join.with.table].pkCol : [];
            const rightTable = String(join.with.as || join.with.table);
            const leftTable = String(this.query.tableAS || this.query.table);

            const eachRow = (row) => {
                joinRowCount++;
                if (join.type === "right" || join.type === "outer") {
                    // keep track of which right side rows have been joined
                    rightHashes.push(withPK ? deepGet(withPK, row) : hash(JSON.stringify(row)));
                }
                joinBuffer.newItem({
                    ...rowData,
                    [rightTable]: row
                });
            };

            const rowsDone = () => {

                switch (join.type) {
                    case "left":
                        if (joinRowCount === 0) {
                            joinBuffer.newItem({
                                ...rowData,
                                [rightTable]: undefined
                            });
                        }
                        joinBuffer.finished();
                        break;
                    case "inner":
                    case "cross":
                        joinBuffer.finished();
                        break;
                    case "outer":
                    case "right":
                        if (joinRowCount === 0 && join.type === "outer") {
                            joinBuffer.newItem({
                                ...rowData,
                                [rightTable]: undefined
                            });
                        }

                        // full table scan on right table :(
                        this.nSQL.triggerQuery(this.databaseID, {
                            ...buildQuery(this.databaseID, this.nSQL, join.with.table, "select"),
                            cacheID: this.query.cacheID,
                            where: withPK ? [withPK, "NOT IN", rightHashes] : undefined
                        }, (row) => {
                            if (withPK || rightHashes.indexOf(hash(JSON.stringify(row))) === -1) {
                                joinBuffer.newItem({
                                    ...rowData,
                                    [leftTable]: undefined,
                                    [rightTable]: row
                                });
                            }
                        }, () => {
                            joinBuffer.finished();
                        }, (err) => {
                            this.query.state = "error";
                            this.error(err);
                        });
                        break;
                }
            };

            this.nSQL.triggerQuery(this.databaseID, {
                ...buildQuery(this.databaseID, this.nSQL, join.with.table, "select"),
                tableAS: join.with.as,
                cacheID: this.query.cacheID,
                where: join.on && join.type !== "cross" ? this._buildCombineWhereJoin(join.on, join.with.as || join.with.table as string, rowData) : undefined
            }, eachRow, rowsDone, (err) => {
                this.query.state = "error";
                this.error(err);
            });

        };

        doJoin({ [String(this.query.tableAS || this.query.table)]: leftRow }, 0, complete);
    }

    public _select(complete: () => void, onError: (error: any) => void) {
        // Query order:
        // 1. Join / Index / Where Select
        // 2. Group By & Functions
        // 3. Apply AS
        // 4. Having
        // 5. OrderBy
        // 6. Offset
        // 7. Limit

        this._whereArgs = this.query.where ? this._parseWhere(this.query.where, typeof this.query.table !== "string" || typeof this.query.union !== "undefined") : { type: IWhereType.none };
        this._havingArgs = this.query.having ? this._parseWhere(this.query.having, true) : { type: IWhereType.none };

        this._parseSelect();
        if (this.query.state === "error") return;

        const range = [(this.query.offset || 0), (this.query.offset || 0) + (this.query.limit || 0)];
        const doRange = range[0] + range[1] > 0;

        let distinctKeys: { [key: string]: boolean } = {};
        const generateDistinctKey = (row: any) => {
            return (this.query.distinct || []).reduce((prev, cur) => {
                return prev + JSON.stringify(deepGet(cur, row) || {});
            }, "");
        }

        // UNION query
        if (this.query.union) {
            let hashes: any[] = [];
            let columns: string[] = [];
            let count = 0;
            chainAsync(this.query.union.queries, (query, k, next) => {
                query().then((rows) => {
                    if (!columns.length) {
                        columns = Object.keys(rows[0]);
                    }
                    if (this.query.where) {
                        rows = rows.filter((r, i) => {
                            return this._where(r, this._whereArgs.slowWhere as any[]);
                        });
                    }
                    rows = rows.map(r => {
                        if (this.query.union && this.query.union.type === "distinct") {
                            const rowHash = hash(JSON.stringify(r));
                            if (k === 0) {
                                hashes.push(rowHash);
                            } else {
                                if (hashes.indexOf(rowHash) !== -1) {
                                    return undefined;
                                } else {
                                    hashes.push(rowHash);
                                }
                            }
                        }
                        return Object.keys(r).reduce((p, c, i) => {
                            if (i < columns.length) {
                                p[columns[i]] = r[c];
                            }
                            return p;
                        }, {});
                    }).filter(f => f);

                    if (this.query.orderBy) {
                        this._queryBuffer = this._queryBuffer.concat(rows.map(row => {
                            let isDistinct = true;
                            if (this.query.distinct) {
                                const key = generateDistinctKey(row);
                                if (!distinctKeys[key]) {
                                    distinctKeys[key] = true;
                                } else {
                                    isDistinct = false;
                                }
                            }
                            const newRow = this._streamAS(row);
                            const keep = this.query.having ? this._where(newRow, this._havingArgs.slowWhere as any[]) : true;
                            return keep && isDistinct ? newRow : undefined;
                        }).filter(f => f));
                    } else {
                        rows.forEach((row, i) => {
                            let isDistinct = true;
                            if (this.query.distinct) {
                                const key = generateDistinctKey(row);
                                if (!distinctKeys[key]) {
                                    distinctKeys[key] = true;
                                } else {
                                    isDistinct = false;
                                }
                            }
                            if (!isDistinct) {
                                return;
                            }
                            const newRow = this._streamAS(row);
                            const keep = this.query.having ? this._where(newRow, this._havingArgs.slowWhere as any[]) : true;
                            if (!keep) {
                                return;
                            }
                            if (doRange && !this._didRangeAlready) {
                                if (count >= range[0] && count < range[1]) {
                                    this.progress(newRow, count);
                                }
                            } else {
                                this.progress(newRow, count);
                            }
                            count++;
                        });
                    }
                    next();
                });
            }).then(() => {

                if (this.query.orderBy) {
                    const sorted = this.quickSort(this._queryBuffer, this._orderBy);
                    (doRange && !this._didRangeAlready ? sorted.slice(range[0], range[1]) : sorted).forEach(this.progress);
                }
                if (this.query.cacheID && this.query.cacheID === this.query.queryID) {
                    delete globalTableCache[this.query.cacheID];
                }
                complete();
            });
            return;
        }

        const joinData: InanoSQLJoinArgs[] = Array.isArray(this.query.join) ? this.query.join : [this.query.join as any];

        let rowCounter2 = 0;
        const graphBuffer = new _nanoSQLQueue((gRow, ct, nextGraph, err) => {
            if (this.query.graph) {
                this._graph(this.query.graph || [], this.query.tableAS || this.query.table as string, gRow, rowCounter, (graphRow, j) => {

                    let isDistinct = true;
                    if (this.query.distinct) {
                        const key = generateDistinctKey(graphRow);
                        if (!distinctKeys[key]) {
                            distinctKeys[key] = true;
                        } else {
                            isDistinct = false;
                        }
                    }
                    if (!isDistinct) {
                        rowCounter2++;
                        nextGraph();
                        return;
                    }
                    const finalRow = this._streamAS(graphRow);
                    if (this.query.having) {
                        if (this._where(this._streamAS(gRow), this._havingArgs.slowWhere as any[])) {
                            this.progress(finalRow, rowCounter2);
                        }
                    } else {
                        this.progress(finalRow, rowCounter2);
                    }
                    rowCounter2++;
                    nextGraph();
                });
            } else {
                let isDistinct = true;
                if (this.query.distinct) {
                    const key = generateDistinctKey(gRow);
                    if (!distinctKeys[key]) {
                        distinctKeys[key] = true;
                    } else {
                        isDistinct = false;
                    }
                }
                if (!isDistinct) {
                    rowCounter2++;
                    nextGraph();
                    return;
                }
                this.progress(this._streamAS(gRow), rowCounter2);
                rowCounter2++;
                nextGraph();
            }
        }, this._onError, () => {
            if (this.query.cacheID && this.query.cacheID === this.query.queryID) {
                delete globalTableCache[this.query.cacheID];
            }
            complete();
        });

        let rowCounter = 0;
        const selectBuffer = new _nanoSQLQueue((row, ct, next, err) => {

            this._maybeJoin(joinData, row, (row2) => { // JOIN as needed
                if (this._stream) {
                    // continue streaming results
                    // skipping group by, order by and aggregate functions
                    if (doRange && !this._didRangeAlready ? (rowCounter >= range[0] && rowCounter < range[1]) : true) {
                        graphBuffer.newItem(row2);
                    }
                    rowCounter++;
                } else {
                    this._queryBuffer.push(row2);
                }
            }, next);
        }, this.error, () => {

            if (this._stream) {
                graphBuffer.finished();
                return;
            }

            // use buffer
            allAsync(this._queryBuffer, (row, i, next) => {
                this._graph(this.query.graph || [], this.query.tableAS || this.query.table as string, row, i, next);
            }).then((newBuffer) => {
                this._queryBuffer = newBuffer;
                // Group by & functions
                this._groupByRows();

                if (this.query.having) { // having
                    this._queryBuffer = this._queryBuffer.filter(row => {
                        return this._where(row, this._havingArgs.slowWhere as any[]);
                    });
                }

                if (this.query.orderBy && !this._hasOrdered) { // order by
                    if (this._orderBy.sort.length > 1) {
                        this._queryBuffer = this.quickSort(this._queryBuffer, this._orderBy);
                    } else {
                        this._queryBuffer.sort(this._orderByRows);
                    }
                }

                if (doRange && !this._didRangeAlready) { // limit / offset
                    this._queryBuffer = this._queryBuffer.slice(range[0], range[1]);
                }

                this._queryBuffer.forEach((row, i) => {
                    let isDistinct = true;
                    if (this.query.distinct) {
                        const key = generateDistinctKey(row);
                        if (!distinctKeys[key]) {
                            distinctKeys[key] = true;
                        } else {
                            isDistinct = false;
                        }
                    }
                    if (isDistinct) {
                        this.progress(this._streamAS(row, this._hasFn), i);
                    }
                });

                if (this.query.cacheID && this.query.cacheID === this.query.queryID) {
                    delete globalTableCache[this.query.cacheID];
                }
                complete();
            });
        });

        const tableIsString = typeof this.query.table === "string";

        // check to see if we can skip most of the query processing and export result right away
        let superFastQuery = !this.query.join && !this.query.distinct && !this.query.graph && !this.query.actionArgs && !this.query.having && !this.query.groupBy;
        if (superFastQuery && this.query.orderBy) {
            superFastQuery = this._pkOrderBy;
        }

        // query path start
        this._getRecords((row, i) => { // SELECT rows

            const selectEvent = {
                target: this.query.table as string,
                path: "_all_",
                events: ["select", "*"],
                time: Date.now(),
                performance: Date.now() - this._startTime,
                result: row,
                query: this.query,
                indexes: this._indexesUsed
            };

            if (tableIsString) {
                this.nSQL.triggerEvent(this.databaseID, selectEvent);
            }

            this._startTime = Date.now();

            if (this.query.returnEvent) { // return event (no mutation possible)
                if (doRange) {
                    if (i >= range[0] && i < range[1]) {
                        this.progress(selectEvent, i);
                    }
                } else {
                    this.progress(selectEvent, i);
                }
            } else if (superFastQuery) { // no mutations needed
                if (doRange && !this._didRangeAlready) {
                    if (i >= range[0] && i < range[1]) {
                        this.progress(row, i + range[0]);
                    }
                } else {
                    this.progress(row, i);
                }
            } else { // do needed query mutations
                selectBuffer.newItem(row);
            }
        }, () => {
            if (this.query.returnEvent || superFastQuery) {
                complete();
            } else {
                selectBuffer.finished();
            }
        }, onError);
    }

    public _groupByRows() {

        if (!this.query.groupBy && !this._hasAggrFn) {
            // this._queryBuffer = this._queryBuffer.map(b => this._streamAS(b));
            return;
        }

        const sortedRows = this._groupBy ? this._queryBuffer.sort((a: any, b: any) => {
            return this._sortObj(a, b, this._groupBy);
        }) : this._queryBuffer;

        sortedRows.forEach((val, idx) => {

            const groupByKey = this._groupBy.sort.map(k => {
                return String(k.fn ? execFunction(this.query, k.fn, val, { result: undefined }).result : deepGet(k.path, val))
            }).join(".");

            if (this._sortGroupKeys[groupByKey] === undefined) {
                this._sortGroupKeys[groupByKey] = this._sortGroups.length;
            }

            const key = this._sortGroupKeys[groupByKey];

            if (!this._sortGroups[key]) {
                this._sortGroups.push([]);
            }

            this._sortGroups[key].push(val);
        });

        if (this.query.orderBy) {
            this._hasOrdered = true;
            this._sortGroups = this._sortGroups.map((groupArr) => {
                return groupArr.sort((a, b) => this._sortObj(a, b, this._orderBy));
            });
        }

        this._queryBuffer = [];
        if (this._hasAggrFn) {

            const getResultFns = (): { aggr: any, name: string, idx: number }[] => {
                return this._selectArgs.reduce((p, c, i) => {
                    const fnName = c.value.split("(").shift() as string;
                    if (c.isFn && this.nSQL.functions[fnName] && this.nSQL.functions[fnName].type === "A") {
                        p[i] = {
                            idx: i,
                            name: c.value,
                            aggr: assign(this.nSQL.functions[fnName].aggregateStart),
                        };
                    }
                    return p;
                }, [] as any[]);
            }

            // loop through the groups
            this._sortGroups.forEach((group) => {

                // find aggregate functions
                const resultFns = getResultFns();
                const firstFn = resultFns.filter(f => f)[0];

                // calculate aggregate functions
                group.slice().reverse().forEach((row, i) => {
                    resultFns.forEach((fn, i) => {
                        if (!fn) return;
                        resultFns[i].aggr = execFunction(this.query, resultFns[i].name, row, resultFns[i].aggr);
                    });
                });

                // calculate simple functions and AS back into buffer
                this._queryBuffer.push(this._selectArgs.reduce((prev, cur, i) => {
                    const col = cur.value;
                    prev[cur.as || col] = cur.isFn && resultFns[i] ? resultFns[i].aggr.result : (cur.isFn ? execFunction(this.query, cur.value, resultFns[firstFn.idx].aggr.row, { result: undefined }).result : deepGet(cur.value, resultFns[firstFn.idx].aggr.row) || null);
                    return prev;
                }, {}));
            });

            if (!this._queryBuffer.length) {
                // find aggregate functions
                const resultFns = getResultFns();
                const firstFn = resultFns.filter(f => f)[0];

                this._queryBuffer.push(this._selectArgs.reduce((prev, cur, i) => {
                    const col = cur.value;
                    prev[cur.as || col] = cur.isFn && resultFns[i] ? resultFns[i].aggr.result : (cur.isFn ? execFunction(this.query, cur.value, resultFns[firstFn.idx].aggr.row, { result: undefined }).result : deepGet(cur.value, resultFns[firstFn.idx].aggr.row) || null);
                    return prev;
                }, {}));
            }
        } else {
            this._sortGroups.forEach((group) => {
                this._queryBuffer.push(group.shift());
            });
        }
    }


    public _buildCombineWhereJoin(graphWhere: any, graphTable: string, rowData: any): any {
        if (typeof graphWhere === "function") {
            return (compareRow) => {
                return graphWhere(compareRow, rowData);
            };
        }
        return (typeof graphWhere[0] === "string" ? [graphWhere] : graphWhere).map(j => {
            if (Array.isArray(j[0])) return this._buildCombineWhereJoin(j, graphTable, rowData); // nested where
            if (j === "AND" || j === "OR") return j;

            const leftWhere: any[] = resolvePath(j[0]);
            const rightWhere: any[] = resolvePath(j[2]);
            const swapWhere = leftWhere[0] !== graphTable;

            // swapWhere = true [leftTable.column, =, rightTable.column] => [rightWhere, =, objQuery(leftWhere)]
            // swapWhere = false [rightTable.column, =, leftTable.column] => [leftWhere, =, objQuery(rightWhere)]
            return [
                swapWhere ? rightWhere.slice(1).join(".") : leftWhere.slice(1).join("."),
                swapWhere ? (j[1].indexOf(">") !== -1 ? j[1].replace(">", "<") : j[1].replace("<", ">")) : j[1],
                deepGet(swapWhere ? leftWhere : rightWhere, rowData)
            ];
        });
    }

    public _graph(gArgs: InanoSQLGraphArgs | InanoSQLGraphArgs[], topTable: string, row: any, index: number, onRow: (row: any, i: number) => void) {

        const graphArgs = Array.isArray(gArgs) ? gArgs : [gArgs];

        if (!graphArgs || graphArgs.length === 0) {
            onRow(row, index);
            return;
        }

        allAsync(graphArgs, (graph: InanoSQLGraphArgs, i, next) => {
            const noGraphAs = new Error("Must use 'AS' when graphing temporary tables!");

            if (typeof graph.with.table !== "string" && !graph.with.as) {
                this.query.state = "error";
                this.error(noGraphAs);
                return;
            }

            if (typeof this.query.table !== "string" && !this.query.tableAS) {
                this.query.state = "error";
                this.error(noGraphAs);
                return;
            }

            row[graph.key] = [];

            const whereCond = this._buildCombineWhereJoin(graph.on, graph.with.as || graph.with.table as string, { [topTable]: row });

            this._getTable(graph.with.as || graph.with.table as string, whereCond, graph.with.table, (graphTable) => {
                if (graphTable.filtered) {
                    (graphTable.rows as any).forEach((graphRow) => {
                        if (graph.single) {
                            row[graph.key] = graphRow;
                        } else {
                            row[graph.key].push(graphRow);
                        }
                    });
                    next(null);
                } else {
                    this.nSQL.triggerQuery(this.databaseID, {
                        ...buildQuery(this.databaseID, this.nSQL, graphTable.rows, "select"),
                        tableAS: graph.with.as,
                        actionArgs: graph.select,
                        where: whereCond,
                        limit: graph.limit,
                        offset: graph.offset,
                        orderBy: graph.orderBy,
                        groupBy: graph.groupBy,
                        graph: graph.graph,
                        cacheID: this.query.cacheID
                    }, (graphRow) => {
                        if (graph.single) {
                            row[graph.key] = graphRow;
                        } else {
                            row[graph.key].push(graphRow);
                        }
                    }, () => {
                        next(null);
                    }, this._onError);
                }

            });

        }).then(() => {
            onRow(row, index);
        });

    }

    public _upsert(onRow: (row: any, i: number) => void, complete: () => void, error: (err) => void) {
        if (!this.query.actionArgs) {
            error("nSQL: Can't upsert without records!");
            this.query.state = "error";
        }
        
        // nested upsert
        if ((this.query.table as string).indexOf(".") !== -1 || (this.query.table as string).indexOf("[") !== -1) {
            const path = resolvePath(this.query.table as string);
            this.query.table = path.shift() as string;
            this.upsertPath = path;
        }

        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: IWhereType.none };
        if (this.query.state === "error") return;
        let upsertRecords = Array.isArray(this.query.actionArgs) ? this.query.actionArgs : [this.query.actionArgs];

        const table = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string];

        if (this._whereArgs.type === IWhereType.none) { // insert/update records directly

            allAsync(upsertRecords, (row, i, next, error) => {
                const pkVal = deepGet(table.pkCol, row);

                if (pkVal) {
                    adapterFilters(this.databaseID, this.nSQL, this.query).read(this.query.table as string, pkVal, (oldRow) => {
                        if (oldRow) {
                            this._updateRow(row, oldRow, (newRow) => {
                                onRow(newRow, i);
                                next(null);
                            }, error);
                        } else {
                            this._newRow(row, (newRow) => {
                                onRow(newRow, i);
                                next(null);
                            }, error);
                        }
                    }, error);
                } else {
                    this._newRow(row, (newRow) => {
                        onRow(newRow, i);
                        next(null);
                    }, error);

                }
            }).then(() => {
                this.nSQL.saveCount(this.databaseID || "", this.query.table as string);
                complete();
            }).catch(this._onError);
        } else { // find records and update them
            if (upsertRecords.length > 1) {
                this.query.state = "error";
                error("Cannot upsert multiple records with where condition!");
                return;
            }

            const upsertBuffer = new _nanoSQLQueue((row, i, done, err) => {

                const PKpath = this.nSQL.getDB(this.query.databaseID)._tables[this.query.table as string].pkCol;
                const PK = deepGet(PKpath, row);

                const checkLock = () => {
                    if (this.nSQL.getDB(this.query.databaseID)._tables[this.query.table as string].rowLocks[String(PK)]) {
                        setTimeout(checkLock, 10);
                    } else {
                        this.nSQL.getDB(this.query.databaseID)._tables[this.query.table as string].rowLocks[String(PK)] = true;
                        this._updateRow(upsertRecords[0], row, (evOrRow) => {
                            delete this.nSQL.getDB(this.query.databaseID)._tables[this.query.table as string].rowLocks[String(PK)];
                            onRow(evOrRow, i);
                            done();
                        }, err);
                    }
                }
                checkLock();

            }, error, () => {
                complete();
            });
            this._getRecords((row, i) => {
                upsertBuffer.newItem(row);
            }, () => {
                upsertBuffer.finished();
            }, error);
        }
    }

    public _updateRow(newData: any, oldRow: any, complete: (row: any) => void, error: (err: any) => void) {
        this.nSQL.doFilter<updateRowFilter>(this.databaseID, "updateRow", { res: newData, row: oldRow, query: this.query }, (upsertData) => {

            let finalRow = this.nSQL.default(this.databaseID, this.upsertPath ? deepSet(this.upsertPath, maybeAssign(oldRow), upsertData.res) : {
                ...oldRow,
                ...upsertData.res
            }, this.query.table as string);

            const filter = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].filter;

            if (filter) {
                finalRow = filter(finalRow);
            }

            const cols = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].columns;
            let k = cols.length;
            while(k--) {
                if (cols[k].immutable) {
                    delete finalRow[cols[k].key];
                }
            }

            if (this.query.updateImmutable) {
                finalRow = {
                    ...finalRow,
                    ...this.query.updateImmutable
                }
            }

            this._diffUpdates(this.query.table as string, oldRow, finalRow, () => {

                const changeEvent: InanoSQLDatabaseEvent = {
                    target: this.query.table as string,
                    path: "*",
                    events: ["upsert", "change", "*"],
                    time: Date.now(),
                    performance: Date.now() - this._startTime,
                    result: finalRow,
                    oldRow: oldRow,
                    query: this.query,
                    indexes: this._indexesUsed
                };

                this.nSQL.doFilter<updateRowEventFilter>(this.databaseID, "updateRowEvent", { res: changeEvent, query: this.query }, (event) => {
                    if (typeof this.query.table === "string") {
                        this.nSQL.triggerEvent(this.databaseID, event.res);

                        if (this.nSQL.events[this.databaseID || ""][this.query.table as string]) {
                            Object.keys(this.nSQL.events[this.databaseID || ""][this.query.table as string]).forEach((path) => {
                                if (path !== "*") {
                                    if (!objectsEqual(deepGet(path, oldRow), deepGet(path, finalRow))) {
                                        this.nSQL.triggerEvent(this.databaseID, {
                                            target: this.query.table as string,
                                            path: path,
                                            events: ["upsert", "change", "*"],
                                            time: Date.now(),
                                            performance: Date.now() - this._startTime,
                                            result: finalRow,
                                            oldRow: oldRow,
                                            query: this.query,
                                            indexes: this._indexesUsed
                                        }, true);
                                    }
                                }
                            });
                        }
                        this._startTime = Date.now();
                    }
                    complete(this.query.returnEvent ? event.res : finalRow);
                }, error);
            }, error);
        }, error);
    }

    private _checkUniqueIndexes(table: string, pk: any, oldRow: any, newIndexValues: { [index: string]: any }, done: () => void, error: (err: any) => void) {
        allAsync(Object.keys(newIndexValues), (index, i, next, err) => {
            const indexProps = this.nSQL.getDB(this.databaseID)._tables[this.query.table as any].indexes[index].props || {};
            if (indexProps && indexProps.unique) { // check for unique
                let indexPKs: any[] = [];
                adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKey(table, index, newIndexValues[index], (rowPK) => {
                    if (rowPK !== pk) indexPKs.push(rowPK);
                }, () => {
                    if (indexPKs.length > 0) {
                        err({ error: "Unique Index Collision!", row: oldRow, query: this.query });
                    } else {
                        next(null);
                    }
                }, err);
            } else { // no need to check for unique
                next(null);
            }
        }).then(done).catch(error);
    }

    private _diffUpdates(queryTable: string, oldRow: any, finalRow: any, done: () => void, error: (err: any) => void) {
        const newIndexValues = this._getIndexValues(this.nSQL.getDB(this.databaseID)._tables[this.query.table as any].indexes, finalRow);
        const oldIndexValues = this._getIndexValues(this.nSQL.getDB(this.databaseID)._tables[this.query.table as any].indexes, oldRow);
        const table = this.nSQL.getDB(this.databaseID)._tables[queryTable];

        this._checkUniqueIndexes(queryTable, deepGet(table.pkCol, oldRow), oldRow, newIndexValues, () => {

            allAsync(Object.keys(oldIndexValues).concat(["__pk__"]), (indexName: string, i, next, err) => {
                if (indexName === "__pk__") { // main row
                    adapterFilters(this.databaseID, this.nSQL, this.query).write(queryTable, deepGet(table.pkCol, finalRow), finalRow, (pk) => {
                        deepSet(table.pkCol, finalRow, pk);
                        next(null);
                    }, err);
                } else { // indexes
                    const tableName = this.query.table as string;
                    if (objectsEqual(newIndexValues[indexName], oldIndexValues[indexName]) === false) { // only update changed index values

                        if (table.indexes[indexName].isArray) {
                            let addValues: any[] = newIndexValues[indexName].filter((v, i, s) => oldIndexValues[indexName].indexOf(v) === -1);
                            let removeValues: any[] = oldIndexValues[indexName].filter((v, i, s) => newIndexValues[indexName].indexOf(v) === -1);
                            allAsync([addValues, removeValues], (arrayOfValues, j, nextValues) => {
                                if (!arrayOfValues.length) {
                                    nextValues(null);
                                    return;
                                }
                                allAsync(arrayOfValues, (value, i, nextArr) => {
                                    this._updateIndex(tableName, indexName, value, deepGet(table.pkCol, finalRow), j === 0, () => {
                                        nextArr(null);
                                    }, err);
                                }).then(nextValues);
                            }).then(next);
                        } else {
                            chainAsync(["rm", "add"], (job, i, nextJob) => {
                                switch (job) {
                                    case "add": // add new index value
                                        this._updateIndex(tableName, indexName, newIndexValues[indexName], deepGet(table.pkCol, finalRow), true, () => {
                                            nextJob(null);
                                        }, err);
                                        break;
                                    case "rm": // remove old index value
                                        this._updateIndex(tableName, indexName, oldIndexValues[indexName], deepGet(table.pkCol, finalRow), false, () => {
                                            nextJob(null);
                                        }, err);
                                        break;
                                }
                            }).then(next);
                        }
                    } else {
                        next(null);
                    }
                }
            }).then(done).catch(error);
        }, error);
    }

    private _indexLocks: {
        [lockID: string]: {
            [indexValue: string]: boolean;
        }
    } = {};

    private _updateIndex(table: string, indexName: string, value: any, pk: any, addToIndex: boolean, done: () => void, err: (error) => void) {
        const lockID = this.query.databaseID + table + indexName;
        if (!this._indexLocks[lockID]) {
            this._indexLocks[lockID] = {};
        }

        // the number zero is the only falsey value you can index
        if (!value && value !== 0) {
            done();
            return;
        }

        // 0 length strings cannot be indexed
        if (String(value).length === 0) {
            done();
            return;
        }

        const newItem: InanoSQLupdateIndex = { table, indexName, value, pk, addToIndex, done, err, query: this.query, nSQL: this.nSQL };

        this.nSQL.doFilter<updateIndexFilter>(this.databaseID, "updateIndex", { res: newItem, query: this.query }, (update) => {
            
            const item = update.res;
                
            const doUpdate = () => {
                if (this._indexLocks[lockID][String(item.value)]) {
                    setTimeout(doUpdate, 10);
                } else {
                    this._indexLocks[lockID][String(item.value)] = true;
                    const fn = item.addToIndex ? adapterFilters(this.databaseID, item.nSQL, item.query).addIndexValue : adapterFilters(this.databaseID, item.nSQL, item.query).deleteIndexValue;
                    fn(item.table, item.indexName, item.pk, item.value, () => {
                        delete this._indexLocks[lockID][String(item.value)];
                        item.done();
                        done();
                    }, (err) => {
                        delete this._indexLocks[lockID][String(item.value)];
                        item.err(err);
                        done();
                    });
                }
            }
            doUpdate();

        }, err);


    }

    public _newRow(newRow: any, complete: (row: any) => void, error: (err: any) => void) {

        const filter = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].filter;

        if (filter) {
            newRow = filter(newRow);
        }

        this.nSQL.doFilter<addRowFilter>(this.databaseID, "addRow", { res: newRow, query: this.query }, (rowToAdd) => {
            const table = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string];

            rowToAdd.res = this.nSQL.default(this.databaseID, maybeAssign(this.upsertPath ? deepSet(this.upsertPath, {}, rowToAdd.res) : rowToAdd.res), this.query.table as string);

            const rowPK = deepGet(table.pkCol, rowToAdd.res);

            const indexValues = this._getIndexValues(this.nSQL.getDB(this.databaseID)._tables[this.query.table as any].indexes, rowToAdd.res);

            this._checkUniqueIndexes(this.query.table as string, rowPK, rowToAdd.res, indexValues, () => {

                adapterFilters(this.databaseID, this.nSQL, this.query).write(this.query.table as string, rowPK, rowToAdd.res, (pk) => {
                    deepSet(table.pkCol, rowToAdd.res, pk)

                    allAsync(Object.keys(indexValues), (indexName: string, i, next, err) => {
                        // const idxTable = "_idx_" + this.nSQL.tableIds[this.query.table as string] + "_" + indexName;
                        if (table.indexes[indexName].isArray) {
                            const arrayOfValues = indexValues[indexName] || [];
                            allAsync(arrayOfValues, (value, i, nextArr) => {
                                this._updateIndex(this.query.table as string, indexName, value, rowPK, true, () => {
                                    nextArr(null);
                                }, err);
                            }).then(() => {
                                next(null);
                            }).catch(err);
                        } else {
                            this._updateIndex(this.query.table as string, indexName, indexValues[indexName], rowPK, true, () => {
                                next(null);
                            }, err);
                        }
                    }).then(() => {

                        const changeEvent: InanoSQLDatabaseEvent = {
                            target: this.query.table as string,
                            path: "*",
                            events: ["upsert", "change", "*"],
                            time: Date.now(),
                            performance: Date.now() - this._startTime,
                            result: rowToAdd.res,
                            oldRow: undefined,
                            query: this.query,
                            indexes: this._indexesUsed
                        };

                        this.nSQL.doFilter<addRowEventFilter>(this.databaseID, "addRowEvent", { res: changeEvent, query: this.query }, (event) => {
                            if (typeof this.query.table === "string") {
                                this.nSQL.triggerEvent(this.databaseID, event.res);
                            }
                            this._startTime = Date.now();
                            this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].count++;
                            complete(this.query.returnEvent ? event.res : rowToAdd.res);
                        }, error);
                    });
                }, error);
            }, error);
        }, error);
    }

    public _delete(onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) {
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: IWhereType.none };
        if (this.query.state === "error") return;

        const tableConfig = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string];

        const deleteBuffer = new _nanoSQLQueue((row, i, done, err) => {

            new Promise((res, rej) => {
                const table = this.query.table as string;

                if (this.nSQL.getDB(this.databaseID)._fkRels[table] && this.nSQL.getDB(this.databaseID)._fkRels[table].length) {
                    allAsync(this.nSQL.getDB(this.databaseID)._fkRels[table], (fkRestraint: InanoSQLForeignKey, i, next, err) => {
                        const rowValue = deepGet(fkRestraint.selfPath, row);
                        const rowPKs = cast(this.databaseID, "any[]", fkRestraint.selfIsArray ? rowValue : [rowValue]);
                        allAsync(rowPKs, (rowPK, iii, nextRow, rowErr) => {
                            switch (fkRestraint.onDelete) {
                                case InanoSQLFKActions.RESTRICT: // see if any rows are connected
                                    let count = 0;
                                    adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, (pk) => {
                                        count++;
                                    }, () => {
                                        if (count > 0) {
                                            rowErr(`Foreign key restraint error, can't delete!`);
                                        } else {
                                            nextRow();
                                        }
                                    }, err);
                                    break;
                                case InanoSQLFKActions.CASCADE:
                                    let deleteIDs: any[] = [];
                                    adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, (key) => {
                                        deleteIDs.push(key);
                                    }, () => {
                                        this.nSQL.triggerQuery(this.databaseID, {
                                            ...buildQuery(this.databaseID, this.nSQL, fkRestraint.childTable, "delete"),
                                            where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs]
                                        }, noop, nextRow, rowErr);
                                    }, err)
                                    break;
                                case InanoSQLFKActions.SET_NULL:
                                    let setIDs: any[] = [];
                                    adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, (key) => {
                                        setIDs.push(key);
                                    }, () => {
                                        this.nSQL.triggerQuery(this.databaseID, {
                                            ...buildQuery(this.databaseID, this.nSQL, fkRestraint.childTable, "upsert"),
                                            actionArgs: {
                                                [fkRestraint.childPath.join(".")]: null
                                            },
                                            where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs]
                                        }, noop, nextRow, rowErr);
                                    }, err)
                                    break;
                                default:
                                    next();
                            }
                        }).then(next).catch(err);
                    }).then(res).catch(rej);
                } else {
                    res();
                }
            }).then(() => {
                this._removeRowAndIndexes(tableConfig, row, (delRowOrEvent) => {
                    onRow(delRowOrEvent, i);
                    this.nSQL.getDB(this.databaseID)._tables[tableConfig.name].count--;
                    done();
                }, err);
            }).catch(err);
        }, error, () => {
            complete();
        });

        this._getRecords((row, i) => {
            deleteBuffer.newItem(row);
        }, () => {
            this.nSQL.saveCount(this.databaseID || "", tableConfig.name);
            deleteBuffer.finished();
        }, error);

    }

    public _removeRowAndIndexes(table: InanoSQLTable, row: any, complete: (rowOrEv: any) => void, error: (err: any) => void) {

        const indexValues = this._getIndexValues(table.indexes, row);

        this.nSQL.doFilter<deleteRowFilter>(this.databaseID, "deleteRow", { res: row, query: this.query }, (delRow) => {

            allAsync(Object.keys(indexValues).concat(["__del__"]), (indexName: string, i, next) => {
                if (indexName === "__del__") { // main row
                    adapterFilters(this.databaseID, this.nSQL, this.query).delete(this.query.table as string, deepGet(table.pkCol, delRow.res), () => {
                        next(null);
                    }, (err) => {
                        this.query.state = "error";
                        error(err);
                    });
                } else { // secondary indexes
                    if (table.indexes[indexName].isArray) {
                        const arrayOfValues = indexValues[indexName] || [];
                        allAsync(arrayOfValues, (value, i, nextArr) => {
                            this._updateIndex(this.query.table as string, indexName, value, deepGet(table.pkCol, delRow.res), false, () => {
                                nextArr(null);
                            }, error);
                        }).then(next);
                    } else {
                        this._updateIndex(this.query.table as string, indexName, indexValues[indexName], deepGet(table.pkCol, delRow.res), false, () => {
                            next(null);
                        }, this._onError);
                    }
                }
            }).then(() => {
                const delEvent = {
                    target: this.query.table as string,
                    path: "_all_",
                    events: ["change", "delete", "*"],
                    time: Date.now(),
                    performance: Date.now() - this._startTime,
                    result: delRow.res,
                    query: this.query,
                    indexes: this._indexesUsed
                };
                this.nSQL.doFilter<deleteRowEventFilter>(this.databaseID, "deleteRowEvent", { res: delEvent, query: this.query }, (event) => {
                    if (typeof this.query.table === "string") {
                        this.nSQL.triggerEvent(this.databaseID, event.res);
                    }
                    this._startTime = Date.now();
                    complete(this.query.returnEvent ? event.res : delRow.res);
                }, error);

            }).catch(error);
        }, error);
    }

    public _getIndexValues(indexes: { [id: string]: InanoSQLIndex }, row: any): { [indexName: string]: any } {

        return Object.keys(indexes).reduce((prev, cur) => {
            const value = deepGet(indexes[cur].path, row);
            const type = indexes[cur].isDate ? "string" : indexes[cur].type;
            prev[cur] = indexes[cur].isArray ? (Array.isArray(value) ? value : []).map(v => this.nSQL.indexTypes[type](v)) : this.nSQL.indexTypes[type](value);
            return prev;
        }, {});
    }

    public _showTables() {
        Object.keys(this.nSQL.getDB(this.databaseID)._tables).forEach((table, i) => {
            this.progress({ table: table, id: this.nSQL.getDB(this.databaseID)._tableIds[table] }, i);
        });
        this.complete();
    }

    public _describe(type: "table" | "idx" | "fks" = "table") {
        if (typeof this.query.table !== "string") {
            this.query.state = "error";
            this.error({ error: "Can't call describe on that!", query: this.query });
            return;
        }
        if (!this.nSQL.getDB(this.databaseID)._tables[this.query.table]) {
            this.query.state = "error";
            this.error({ error: `Table ${this.query.table} not found!`, query: this.query });
            return;
        }
        switch (type) {
            case "table":
                this.nSQL.getDB(this.databaseID)._tables[this.query.table].columns.forEach((col, i) => {
                    this.progress(assign(col), i);
                });
                break;
            case "idx":
                Object.keys(this.nSQL.getDB(this.databaseID)._tables[this.query.table].indexes).forEach((idx, i) => {
                    const index = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].indexes[idx];
                    this.progress(assign(index), i);
                })
                break;
        }

        this.complete();
    }

    public _combineRows(rData: any) {
        return Object.keys(rData).reduce((prev, cur) => {
            const row = rData[cur];
            if (!row) return prev;
            Object.keys(row).forEach((k) => {
                prev[cur + "." + k] = row[k];
            });
            return prev;
        }, {});
    }

    public _streamAS(row: any, ignoreFns?: boolean): any {
        const distinctArgs = (this.query.distinct || []).map(s => ({ isFn: false, value: s }))
        const selectArgs = (this._selectArgs || []).concat(distinctArgs);

        if (selectArgs.length) {
            let result = {};
            selectArgs.forEach((arg) => {
                if (arg.isFn) {
                    if (!ignoreFns) {
                        result[arg.as || arg.value] = execFunction(this.query, arg.value, row, {} as any).result;
                    } else {
                        result[arg.as || arg.value] = row[arg.as || arg.value];
                    }
                } else {
                    result[arg.as || arg.value] = deepGet(arg.value, row);
                }
            });
            return result;
        }
        return this.query.join ? this._combineRows(row) : row;
    }

    public quickSort(arr: any[], columns: InanoSQLSortBy): any[] {

        if (arr.length < 2) return arr;

        const pivotPoint = Math.floor(Math.random() * arr.length);

        const getValues = (row): {v: any, d: "ASC"|"DESC"}[] => {
            return columns.sort.reduce((prev, cur, i) => {
                const result = cur.fn ? execFunction(this.query, cur.fn, row, { result: undefined }).result : deepGet(cur.path, row);
                prev.push({v: result, d: String(cur.dir).toUpperCase()});
                return prev;
            }, [] as any[]);
        }

        const compare = (element1, element2) => {
            let value = 0;
            let i = 0;
            while(i < element1.length) {
                if (!value && element1[i].v !== element2[i].v) {
                    value = (element1[i].v > element2[i].v ? 1 : -1) * (element1[i].d === "DESC" ? -1 : 1);
                }
                i++;
            }
            return value;
        }

        const pivot = getValues(arr[pivotPoint]);

        let left: any[] = [];
        let equal: any[] = [];
        let right: any[] = [];

        for (let row of arr) {
            const element = getValues(row);
            const result = compare(element, pivot);
            if (result > 0) {
                right.push(row);
            } else if (result < 0) {
                left.push(row);
            } else {
                equal.push(row);
            }
        }

        return this.quickSort(left, columns).concat(equal).concat(this.quickSort(right, columns));
    }

    public _orderByRows(a: any, b: any): number {
        return this._sortObj(a, b, this._orderBy);
    }
    /**
     * Get the sort direction for two objects given the objects, columns and resolve paths.
     *
     * @internal
     * @param {*} objA
     * @param {*} objB
     * @param nanoSQLSortBy columns
     * @param {boolean} resolvePaths
     * @returns {number}
     * @memberof _MutateSelection
     */
    public _sortObj(objA: any, objB: any, columns: InanoSQLSortBy): number {
        return columns.sort.reduce((prev, cur) => {
            const A = cur.fn ? execFunction(this.query, cur.fn, objA, { result: undefined }).result : deepGet(cur.path, objA);
            const B = cur.fn ? execFunction(this.query, cur.fn, objB, { result: undefined }).result : deepGet(cur.path, objB);

            if (A === B) return 0;
            if (!prev) {
                return (A > B ? 1 : -1) * (cur.dir === "DESC" ? -1 : 1);
            } else {
                return prev;
            }
        }, 0);
    }

    public _tableID() {
        return [0, 1].map(() => {
            let id = random16Bits().toString(16);
            while (id.length < 4) {
                id = "0" + id
            }
            return id;
        }).join("-");
    }

    public _createTable(table: InanoSQLTableConfig, alterTable: boolean, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void {

        const tableID = this.nSQL.getDB(this.databaseID)._tableIds[table.name] || this._tableID();
        
        let tableQuery = this.query.table as string
        // table already exists, set to alter table query
        if (!alterTable && Object.keys(this.nSQL.getDB(this.databaseID)._tables).indexOf(table.name) !== -1) {
            alterTable = true;
            tableQuery = table.name
        }

        new Promise((res, rej) => {
            let hasError = false;

            const l = table.name;
            if (!table._internal && (l.indexOf("_") === 0 || l.match(/\s/g) !== null || l.match(/[\(\)\]\[\.]/g) !== null)) {
                rej({ error: `Invalid Table Name ${table.name}! https://docs.nanosql.io/setup/data-models`, query: this.query });
                return;
            }

            Object.keys(table.model).forEach((col) => {
                const modelData = col.replace(/\s+/g, "-").split(":"); // [key, type];
                if (modelData.length === 1) {
                    modelData.push("any");
                }
                if (!modelData[0] || modelData[0].match(/[\(\)\]\[\.]/g) !== null || modelData[0].indexOf("_") === 0) {
                    hasError = true;
                    rej({ error: `Invalid Data Model at ${table.name + "." + col}! https://docs.nanosql.io/setup/data-models`, query: this.query });
                }
            });

            if (hasError) return;

            res();

        }).then(() => {
            return new Promise((res, rej) => {
                this.nSQL.doFilter<configTableFilter>(this.databaseID,  "configTable", { res: table, query: this.query }, res, rej);
            });
        }).then((table: configTableFilter) => {

            const setModels = (dataModel: InanoSQLDataModel | string, level: number): InanoSQLDataModel | undefined => {
                let model: InanoSQLDataModel = {};
                if (typeof dataModel === "string") {
                    let foundModel = false;
                    const isArray = dataModel.indexOf("[]") !== -1;
                    const type = dataModel.replace(/\[\]/gmi, "");
                    if (level === 0 && isArray) {
                        throw new Error(`Can't use array types as table definition.`);
                    }

                    model = Object.keys(this.nSQL.getDB(this.databaseID).config.types || {}).reduce((prev, cur) => {
                        if (cur === type[1]) {
                            foundModel = true;
                            return (this.nSQL.getDB(this.databaseID).config.types || {})[cur]
                        }
                        return prev;
                    }, {});

                    if (foundModel === false) {
                        if (level === 0) {
                            throw new Error(`Type ${dataModel} not found!`);
                        }
                        return undefined;
                    }
                } else {
                    model = dataModel as InanoSQLDataModel;
                }

                return Object.keys(dataModel).reduce((p, d) => {
                    const type = d.split(":")[1] || "any";
                    if (type.indexOf("geo") === 0) {
                        p[d] = {
                            default: { lat: 0, lon: 0 },
                            model: {
                                "lat:float": { max: 90, min: -90 },
                                "lon:float": { max: 180, min: -180 }
                            }
                        };
                    } else if (dataModel[d].model) {
                        p[d] = {
                            ...dataModel[d],
                            model: setModels(dataModel[d].model, level + 1)
                        };
                    } else {
                        p[d] = dataModel[d];
                    }
                    return p;
                }, {});
            };


            const generateColumns = (dataModels: InanoSQLDataModel): InanoSQLTableColumn[] => {
                return Object.keys(dataModels).filter(d => d !== "*").map(d => ({
                    key: d.split(":")[0],
                    type: d.split(":")[1] || "any",
                    ai: dataModels[d].ai,
                    pk: dataModels[d].pk,
                    default: dataModels[d].default,
                    immutable: dataModels[d].immutalbe || false,
                    notNull: dataModels[d].notNull,
                    max: dataModels[d].max,
                    min: dataModels[d].min,
                    model: dataModels[d].model ? generateColumns(dataModels[d].model as any) : undefined
                }));
            };

            let error: string = "";
            const computedDataModel = setModels(table.res.model, 0) as InanoSQLDataModel;

            const pkType = (model: InanoSQLDataModel | string): string => {
                if (typeof model === "string") return "";
                return Object.keys(model).reduce((p, c) => {
                    if (model[c] && model[c].pk) {
                        return c.split(":")[1];
                    }
                    if (!p.length && model[c].model) return pkType(model[c].model as any);
                    return p;
                }, "");
            }

            let indexes = table.res.indexes || {};
            let ai: boolean = false;
            const getPK = (path: string[], model: InanoSQLDataModel | string): string[] => {
                if (typeof model === "string") return [];
                let foundPK = false;
                return Object.keys(model).reduce((p, c) => {
                    if (model[c] && model[c].pk) {
                        foundPK = true;
                        if (model[c].ai) {
                            ai = true;
                        }
                        p.push(c.split(":")[0]);
                        return p;
                    }
                    if (!foundPK && model[c].model) return getPK(path.concat([c.split(":")[0]]), model[c].model as any);
                    return p;
                }, path);
            }

            const generateTypes = (model: InanoSQLDataModel["model"]): any => {
                const useModel = model || {};
                return Object.keys(useModel).reduce((prev, cur) => {
                    const keyAndType = cur.split(":");
                    if (useModel[cur].model) {
                        prev[keyAndType[0]] = generateTypes(useModel[cur].model);
                    } else {
                        prev[keyAndType[0]] = keyAndType[1];
                    }
                    return prev;
                }, {});
            }

            const tablePKType = table.res.primaryKey ? table.res.primaryKey.split(":")[1] : pkType(table.res.model);


            let newConfig: InanoSQLTable = {
                id: tableID,
                name: table.res.name,
                rowLocks: {},
                count: 0,
                mode: table.res.mode ? resolveMode(table.res.mode) : undefined,
                model: computedDataModel,
                columns: generateColumns(computedDataModel),
                filter: table.res.filter,
                select: table.res.select,
                actions: table.res.actions || [],
                views: table.res.views || [],
                queries: (table.res.queries || []).reduce((prev, query) => {
                    prev[query.name] = query;
                    return prev;
                }, {}),
                indexes: Object.keys(indexes).map(i => {
                    const type = (i.split(":")[1] || "string").replace(/\[\]/gmi, "");
                    return {
                        id: resolvePath(i.split(":")[0]).join("."),
                        type: type === "date" ? "int" : type,
                        isArray: (i.split(":")[1] || "string").indexOf("[]") !== -1,
                        path: resolvePath(i.split(":")[0]),
                        props: indexes[i],
                        isDate: type === "date"
                    };
                }).reduce((p, c) => {
                    const allowedTypes = Object.keys(this.nSQL.indexTypes);
                    if (allowedTypes.indexOf(c.type) === -1) {
                        error = `Index "${c.id}" does not have a valid type!`;
                        return p;
                    }

                    if (c.type.indexOf("geo") !== -1) {
                        p[c.id + ".lon"] = {
                            id: c.id + ".lon",
                            type: "float",
                            isArray: false,
                            path: c.path.concat(["lon"]),
                            props: { offset: 180 },
                            isDate: false
                        }
                        p[c.id + ".lat"] = {
                            id: c.id + ".lat",
                            type: "float",
                            isArray: false,
                            path: c.path.concat(["lat"]),
                            props: { offset: 90 },
                            isDate: false
                        }
                    } else {
                        p[c.id] = c;
                    }
                    return p;
                }, {} as { [id: string]: InanoSQLIndex }),
                pkType: tablePKType,
                pkCol: table.res.primaryKey ? resolvePath(table.res.primaryKey.split(":")[0]) : getPK([], table.res.model),
                isPkNum: ["number", "int", "float", "date"].indexOf(tablePKType) !== -1,
                ai: ai
            };

            // no primary key found, set one
            if (newConfig.pkCol.length === 0) {
                newConfig.pkCol = ["_id"];
                newConfig.pkType = "uuid";
                newConfig.model["_id:uuid"] = { pk: true };
                newConfig.columns = generateColumns(setModels(newConfig.model, 0) as InanoSQLDataModel);
            }

            if (error && error.length) return Promise.reject(error);

            return new Promise((res, rej) => {
                this.nSQL.doFilter<configTableSystemFilter>(this.databaseID, "configTableSystem", { res: newConfig, query: this.query }, (result) => {
                    res(result.res);
                }, rej)
            })
        }).then((newConfig: InanoSQLTable) => {
            const oldMode = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string] && this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].mode;
            if (newConfig.mode || oldMode) {
                return new Promise((res, rej) => {
                    if (alterTable && newConfig.mode === oldMode) {
                        res(newConfig);
                    } else {
                        const connectAdapter = () => {
                            if ((newConfig.mode as InanoSQLAdapter)) {
                                (newConfig.mode as InanoSQLAdapter).connect(this.nSQL.getDB(this.databaseID).state.id, () => {
                                    res(newConfig);
                                }, rej);
                            } else {
                                res(newConfig);
                            }
                        }
                        if (oldMode) {
                            oldMode.disconnect(() => {
                                connectAdapter();
                            }, rej);
                        } else {
                            connectAdapter();
                        }
                    }
                });
            } else {
                return Promise.resolve(newConfig);
            }
        }).then((newConfig: InanoSQLTable) => {
            if (tableQuery === "_util") {
                return Promise.resolve(newConfig);
            }
            // get table size count from util table
            return new Promise((res, rej) => {
                if (alterTable) {
                    res(newConfig);
                    return;
                }
                this.nSQL.triggerQuery(this.databaseID, {
                    ...buildQuery(this.databaseID, this.nSQL, "_util", "select"),
                    where: ["key", "=", "total_" + newConfig.id]
                }, (row) => {
                    if (row.value) {
                        newConfig.count = row.value;
                    }
                }, () => {
                    res(newConfig);
                }, rej);
            })
        }).then((newConfig: InanoSQLTable) => {
            const oldIndexes = alterTable ? Object.keys(this.nSQL.getDB(this.databaseID)._tables[tableQuery].indexes) : [];
            const newIndexes = Object.keys(newConfig.indexes);

            const addIndexes = newIndexes.filter(v => oldIndexes.indexOf(v) === -1);

            let addTables = [newConfig.name].concat(addIndexes);

            onRow(newConfig, 0);

            return chainAsync(addTables, (tableOrIndexName, i, next, err) => {
                if (i === 0) { // table
                    const newTable = { name: tableOrIndexName, conf: newConfig };
                    this.nSQL.getDB(this.databaseID)._tableIds[newTable.name] = newConfig.id;
                    if (alterTable) {
                        const removeIndexes = oldIndexes.filter(v => newIndexes.indexOf(v) === -1);
                        allAsync(removeIndexes, (indexName, i, nextIndex, indexError) => {
                            adapterFilters(this.databaseID, this.nSQL, this.query).deleteIndex(tableOrIndexName, indexName, () => {
                                nextIndex(null);
                            }, indexError);
                        }).then(() => {
                            this.nSQL.getDB(this.databaseID)._tables[newTable.name] = newTable.conf;
                            next(null);
                        }).catch(err);
                    } else {
                        adapterFilters(this.databaseID, this.nSQL, this.query).createTable(newTable.name, newTable.conf, () => {
                            this.nSQL.getDB(this.databaseID)._tables[newTable.name] = newTable.conf;
                            next(null);
                        }, err as any);
                    }

                } else { // indexes
                    const index = newConfig.indexes[tableOrIndexName];
                    secondaryIndexQueue[this.nSQL.getDB(this.databaseID).state.id + index.id] = new _nanoSQLQueue();
                    adapterFilters(this.databaseID, this.nSQL, this.query).createIndex(newConfig.name, index.id, index.type, () => {
                        next(null);
                    }, err as any);

                }
            });
        }).then(() => {
            this.nSQL._rebuildFKs();
            if (tableQuery === "_util") {
                return Promise.resolve();
            }
            return this.nSQL._saveTableIds(this.databaseID || "");
        }).then(() => {
            complete();
        }).catch(error);

    }

    public _dropTable(table: string, complete: () => void, error: (err: any) => void): void {

        new Promise((res, rej) => {
            if (this.nSQL.getDB(this.databaseID)._fkRels[table] && this.nSQL.getDB(this.databaseID)._fkRels[table].length) {
                allAsync(this.nSQL.getDB(this.databaseID)._fkRels[table], (fkRestraint: InanoSQLForeignKey, i, next, err) => {

                    switch (fkRestraint.onDelete) {
                        case InanoSQLFKActions.RESTRICT: // see if any rows are connected
                            let count = 0;
                            adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "offset", 0, 1, false, (key, id) => {
                                count++;
                            }, () => {
                                if (count > 0) {
                                    err(`Foreign key restraint error, can't drop!`);
                                } else {
                                    next();
                                }
                            }, err)
                            break;
                        case InanoSQLFKActions.CASCADE:
                            let deleteIDs: any[] = [];
                            adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "all", 0, 0, false, (key, id) => {
                                deleteIDs.push(key);
                            }, () => {
                                this.nSQL.triggerQuery(this.databaseID, {
                                    ...buildQuery(this.databaseID, this.nSQL, fkRestraint.childTable, "delete"),
                                    where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs]
                                }, noop, next, err);
                            }, err)
                            break;
                        case InanoSQLFKActions.SET_NULL:
                            let setIDs: any[] = [];
                            adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "all", 0, 0, false, (key, id) => {
                                setIDs.push(key);
                            }, () => {
                                this.nSQL.triggerQuery(this.databaseID, {
                                    ...buildQuery(this.databaseID, this.nSQL, fkRestraint.childTable, "upsert"),
                                    actionArgs: {
                                        [fkRestraint.childPath.join(".")]: null
                                    },
                                    where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs]
                                }, noop, next, err);
                            }, err)
                            break;
                        default:
                            next();
                    }
                }).then(res).catch(rej);
            } else {
                res();
            }
        }).then(() => {

            let tablesToDrop: string[] = [];
            Object.keys(this.nSQL.getDB(this.databaseID)._tables[table].indexes).forEach((indexName) => {
                tablesToDrop.push(indexName);
            });
            tablesToDrop.push(table);

            return chainAsync(tablesToDrop, (dropTable, i, next, err) => {
                if (i === tablesToDrop.length - 1) {
                    adapterFilters(this.databaseID, this.nSQL, this.query).dropTable(dropTable, () => {
                        delete this.nSQL.getDB(this.databaseID)._tables[dropTable];
                        delete this.nSQL.getDB(this.databaseID)._tableIds[dropTable];
                        this.nSQL._saveTableIds(this.databaseID || "").then(() => {
                            next(dropTable);
                        }).catch(err);
                    }, err);
                } else {
                    adapterFilters(this.databaseID, this.nSQL, this.query).deleteIndex(table, dropTable, next as any, err);
                }
            }).then(() => {
                this.nSQL.getDB(this.databaseID)._tables[table].count = 0;
                this.nSQL.saveCount(this.databaseID || "", table);
                complete();
            })
        }).catch(error);


    }

    public _onError(err: any) {
        this.query.state = "error";
        this.error(err);
    }

    public _resolveFastWhere(onlyGetPKs: any, fastWhere: IWhereCondition, isReversed: boolean, onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

        // function
        if (fastWhere.index && fastWhere.parsedFn) {
            (this.nSQL.functions[fastWhere.parsedFn.name].queryIndex as any)(this.query, fastWhere, onlyGetPKs, onRow, complete, this._onError);
            return;
        }

        // primary key or secondary index
        const isPKquery = fastWhere.index === "_pk_";
        const pkCol = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].pkCol;
        // const indexTable = `_idx_${this.nSQL.tableIds[this.query.table as string]}_${fastWhere.index}`;

        let count = 0;

        const indexBuffer = new _nanoSQLQueue((pkOrRow, i, finished, err) => {
            if (!pkOrRow) {
                finished();
                return;
            }
            if (isPKquery) { // primary key select
                onRow(onlyGetPKs ? deepGet(pkCol, pkOrRow) : pkOrRow, 0);
                finished();
            } else { // secondary index
                if (onlyGetPKs) {
                    onRow(pkOrRow, count);
                    count++;
                    finished();
                } else {
                    adapterFilters(this.databaseID, this.nSQL, this.query).read(this.query.table as string, pkOrRow, (row) => {
                        if (row) {
                            onRow(row, count);
                        }
                        count++;
                        finished();
                    }, this.error);
                }
            }
        }, this._onError, complete);

        if (fastWhere.indexArray) {
            // Primary keys cannot be array indexes

            switch (fastWhere.comp) {
                case "INCLUDES LIKE":
                    adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKeys(this.query.table as string, fastWhere.index as string, "range", fastWhere.value.replace(/\%/gmi, "") + " ", fastWhere.value.replace(/\%/gmi, "") + "~", isReversed, (pk) => {
                        indexBuffer.newItem(pk);
                    }, () => {
                        indexBuffer.finished();
                    }, this._onError);
                    break;
                case "INCLUDES":
                    let pks: any[] = [];
                    adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKey(this.query.table as string, fastWhere.index as string, fastWhere.value, (pk) => {
                        indexBuffer.newItem(pk);
                    }, () => {
                        indexBuffer.finished();
                    }, this.error);
                    break;
                case "INTERSECT ALL":
                case "INTERSECT":
                    let PKS: { [key: string]: number } = {};
                    let maxI = 0;
                    allAsync((fastWhere.value as any || []), (pk, j, next) => {
                        adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKey(this.query.table as string, fastWhere.index as string, pk, (rowPK) => {
                            maxI = j + 1;
                            if (rowPK) {
                                PKS[rowPK] = (PKS[rowPK] || 0) + 1;
                            }
                        }, () => {
                            next(null);
                        }, this.error);
                    }).then(() => {
                        const getPKS = fastWhere.comp === "INTERSECT" ? Object.keys(PKS) : Object.keys(PKS).filter(k => PKS[k] === maxI);
                        getPKS.forEach((pk) => {
                            indexBuffer.newItem(pk);
                        });
                        indexBuffer.finished();
                    });
                    break;
            }

        } else {

            switch (fastWhere.comp) {
                case "=":
                    if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                        onRow(fastWhere.value as any, 0);
                        complete();
                    } else {
                        if (isPKquery) {
                            adapterFilters(this.databaseID, this.nSQL, this.query).read(this.query.table as string, fastWhere.value, (row) => {
                                indexBuffer.newItem(row);
                                indexBuffer.finished();
                            }, this.error);
                        } else {
                            adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKey(this.query.table as string, fastWhere.index as string, fastWhere.value, (readPK) => {
                                indexBuffer.newItem(readPK);
                            }, () => {
                                indexBuffer.finished();
                            }, this.error);
                        }
                    }
                    break;
                case "LIKE":
                    if (isPKquery) {
                        adapterFilters(this.databaseID, this.nSQL, this.query).readMulti(this.query.table as string, "range", fastWhere.value.replace(/\%/gmi, "") + "0", fastWhere.value.replace(/\%/gmi, "") + "Z", isReversed, (row, i) => {
                            indexBuffer.newItem(row);
                        }, () => {
                            indexBuffer.finished();
                        }, this._onError);
                    } else {
                        adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKeys(this.query.table as string, fastWhere.index as string, "range", fastWhere.value.replace(/\%/gmi, "") + " ", fastWhere.value.replace(/\%/gmi, "") + "~", isReversed, (row) => {
                            indexBuffer.newItem(row);
                        }, () => {
                            indexBuffer.finished();
                        }, this._onError);
                    }
                    break;
                case "BETWEEN":
                    if (isPKquery) {
                        adapterFilters(this.databaseID, this.nSQL, this.query).readMulti(this.query.table as string, "range", fastWhere.value[0], fastWhere.value[1], isReversed, (row, i) => {
                            indexBuffer.newItem(row);
                        }, () => {
                            indexBuffer.finished();
                        }, this._onError);
                    } else {
                        adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKeys(this.query.table as string, fastWhere.index as string, "range", fastWhere.value[0], fastWhere.value[1], isReversed, (row) => {
                            indexBuffer.newItem(row);
                        }, () => {
                            indexBuffer.finished();
                        }, this._onError);
                    }
                    break;
                case "IN":
                    const PKS = (isReversed ? (fastWhere.value as any[]).sort((a, b) => a < b ? 1 : -1) : (fastWhere.value as any[]).sort((a, b) => a > b ? 1 : -1));
                    if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                        PKS.forEach((pk, i) => onRow(pk, i));
                        complete();
                    } else {
                        allAsync(PKS, (pkRead, ii, nextPK) => {
                            if (isPKquery) {
                                adapterFilters(this.databaseID, this.nSQL, this.query).read(this.query.table as string, pkRead, (row) => {
                                    indexBuffer.newItem(row);
                                    nextPK();
                                }, this.error);
                            } else {
                                adapterFilters(this.databaseID, this.nSQL, this.query).readIndexKey(this.query.table as string, fastWhere.index as string, pkRead, (readPK) => {
                                    indexBuffer.newItem(readPK);
                                }, () => {
                                    nextPK();
                                }, this.error);
                            }
                        }).then(() => {
                            indexBuffer.finished();
                        });
                    }

            }
        }

    }

    public _fastQuery(onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

        if (this._whereArgs.fastWhere) {
            if (this._whereArgs.fastWhere.length === 1) { // single where

                const fastWhere = this._whereArgs.fastWhere[0] as IWhereCondition;
                const isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";

                this._resolveFastWhere(false, fastWhere, isReversed, (row, i) => {
                    onRow(row, i);
                }, complete);
            } else {  // multiple conditions
                let indexBuffer: { [pk: string]: number } = {};
                let maxI = 0;
                chainAsync(this._whereArgs.fastWhere, (fastWhere, i, next) => {

                    if (i % 2 === 1) { // should be AND
                        next();
                        return;
                    }

                    maxI = i;

                    const addIndexBuffer = (pk) => {
                        indexBuffer[pk] = (indexBuffer[pk] || 0) + 1;
                    };
                    this._resolveFastWhere(true, fastWhere as IWhereCondition, false, addIndexBuffer, next);
                }).then(() => {

                    let getPKs: any[] = [];
                    Object.keys(indexBuffer).forEach((PK) => {
                        if (indexBuffer[PK] === maxI) {
                            getPKs.push(PK);
                        }
                    });

                    this._resolveFastWhere(false, {
                        index: "_pk_",
                        col: this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].pkCol.join("."),
                        comp: "IN",
                        value: getPKs,
                        type: this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].pkType
                    }, false, onRow, complete);
                });
            }
        }
    }

    public _getRecords(onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void): void {

        const scanRecords = (rows: any[]) => {
            let i = 0;

            while (i < rows.length) {
                if (this._whereArgs.type !== IWhereType.none) {
                    if (this._whereArgs.whereFn) {
                        if (this._whereArgs.whereFn(rows[i], i)) {
                            onRow(rows[i], i);
                        }
                    } else {
                        if (this._where(rows[i], this._whereArgs.slowWhere as any)) {
                            onRow(rows[i], i);
                        }
                    }
                } else {
                    onRow(rows[i], i);
                }
                i++;
            }

            complete();
        };

        if (typeof this.query.table === "string") { // pull from local table, possibly use indexes

            switch (this._whereArgs.type) {
                // primary key or secondary index select
                case IWhereType.fast:
                    this._fastQuery((row, i) => {
                        onRow(mutateRowTypes(this.databaseID, row, this.query.table as string, this.nSQL), i);
                    }, complete);
                    break;
                // primary key or secondary index query followed by slow query
                case IWhereType.medium:
                    this._fastQuery((row, i) => {
                        if (this._where(row, this._whereArgs.slowWhere as any)) {
                            onRow(mutateRowTypes(this.databaseID, row, this.query.table as string, this.nSQL), i);
                        }
                    }, complete);
                    break;
                // full table scan
                case IWhereType.slow:
                case IWhereType.none:
                case IWhereType.fn:
                    if (this.query.action === "select" && this.query.databaseID && this.nSQL.getDB(this.query.databaseID) && this.nSQL.getDB(this.query.databaseID).config.warnOnSlowQuery) {
                        console.warn("Slow Query: Use secondary indexes or primary keys to perform SELECT.  Avoid full table scans!", this.query);
                    }
                    const isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";

                    const canDoOrderBy = this.query.orderBy ? this._pkOrderBy === true : true;

                    // see if we can do fast offset/limit query
                    if (canDoOrderBy && this._whereArgs.type === IWhereType.none && this.query.groupBy === undefined && this.query.limit !== undefined && this.query.offset !== undefined) {
                        this._didRangeAlready = true;
                        adapterFilters(this.databaseID, this.nSQL, this.query).readMulti(this.query.table, "offset", this.query.offset, this.query.limit, isReversed, (row, i) => {

                            onRow(mutateRowTypes(this.databaseID, row, this.query.table as string, this.nSQL), i);

                        }, () => {
                            complete();
                        }, this._onError);
                    } else {
                        // full table scan
                        adapterFilters(this.databaseID, this.nSQL, this.query).readMulti(this.query.table, "all", undefined, undefined, isReversed, (row, i) => {

                            if (this._whereArgs.type === IWhereType.slow) {
                                if (this._where(row, this._whereArgs.slowWhere as any)) {
                                    onRow(mutateRowTypes(this.databaseID, row, this.query.table as string, this.nSQL), i);
                                }
                            } else if (this._whereArgs.type === IWhereType.fn && this._whereArgs.whereFn) {
                                if (this._whereArgs.whereFn(row, i)) {
                                    onRow(mutateRowTypes(this.databaseID, row, this.query.table as string, this.nSQL), i);
                                }
                            } else {
                                onRow(mutateRowTypes(this.databaseID, row, this.query.table as string, this.nSQL), i);
                            }
                        }, () => {
                            complete();
                        }, this._onError);
                    }


                    break;
            }

        } else if (typeof this.query.table === "function") { // promise that returns array
            this._getTable(this.query.tableAS || fastID(),  this.query.where, this.query.table, (result) => {
                scanRecords(result.rows as any);
            });
        } else if (Array.isArray(this.query.table)) { // array
            scanRecords(this.query.table);
        } else if (this.query.table) {
            error(`Can't get selected table!`);
        }
    }

    public _rebuildIndexes(progress: (row, i) => void, complete: () => void, error: (err: any) => void) {
        const rebuildTables = this.query.table as string;

        if (!this.nSQL.getDB(this.databaseID)._tables[rebuildTables]) {
            error(new Error(`Table ${rebuildTables} not found for rebuilding indexes!`));
            return;
        }

        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: IWhereType.none };

        if (this.query.where) { // rebuild only select rows (cant clean/remove index tables)

            const readQueue = new _nanoSQLQueue((item, i, complete, error) => {
                this._removeRowAndIndexes(this.nSQL.getDB(this.databaseID)._tables[rebuildTables], item, () => {
                    this._newRow(item, complete, error);
                    progress(item, i);
                }, error);
            }, error, () => {
                complete();
            });

            this._getRecords((row) => {
                readQueue.newItem(row);
            }, () => {
                readQueue.finished();
            }, error);
        } else { // empty indexes and start from scratch
            const indexes = Object.keys(this.nSQL.getDB(this.databaseID)._tables[rebuildTables].indexes);

            allAsync(indexes, (indexName, j, nextIndex, indexErr) => {
                adapterFilters(this.databaseID, this.nSQL, this.query).deleteIndex(rebuildTables, indexName, () => {
                    adapterFilters(this.databaseID, this.nSQL, this.query).createIndex(rebuildTables, indexName, this.nSQL.getDB(this.databaseID)._tables[rebuildTables].indexes[indexName].type, () => {
                        nextIndex(null);
                    }, indexErr);
                }, indexErr);
            }).then(() => {

                // indexes are now empty
                const readQueue = new _nanoSQLQueue((row, i, complete, err) => {
                    const tableData = this.nSQL.getDB(this.databaseID)._tables[rebuildTables];
                    const indexValues = this._getIndexValues(tableData.indexes, row);
                    const rowPK = deepGet(tableData.pkCol, row);
                    allAsync(Object.keys(indexValues), (indexName, jj, nextIdx, errIdx) => {
                        const idxValue = indexValues[indexName];
                        if (tableData.indexes[indexName].isArray) {
                            const arrayOfValues = indexValues[indexName] || [];
                            allAsync(arrayOfValues, (value, i, nextArr) => {
                                this._updateIndex(this.query.table as string, indexName, value, rowPK, true, () => {
                                    nextArr(null);
                                }, errIdx);
                            }).then(() => {
                                nextIdx();
                            }).catch(errIdx);
                        } else {
                            this._updateIndex(rebuildTables, indexName, idxValue, rowPK, true, () => {
                                nextIdx();
                            }, errIdx);
                        }

                    }).then(() => {
                        progress(row, i);
                        complete();
                    }).catch(err);
                }, error, () => {
                    complete();
                });
                this._getRecords((row) => {
                    readQueue.newItem(row);
                }, () => {
                    readQueue.finished();
                }, error);

            }).catch(error);
        }

    }


    public _where(singleRow: any, where: (IWhereCondition | string | (IWhereCondition | string)[])[]): boolean {

        if (where.length > 1) { // compound where statements

            let prevCondition: string = "AND";
            let matches = true;
            let idx = 0;
            while (idx < where.length) {
                const wArg = where[idx];
                if (idx % 2 === 1) {
                    prevCondition = wArg as string;
                } else {

                    let compareResult = false;

                    if (Array.isArray(wArg)) { // nested where
                        compareResult = this._where(singleRow, wArg as any);
                    } else {
                        compareResult = this._compare(wArg as IWhereCondition, singleRow);
                    }

                    if (idx === 0) {
                        matches = compareResult;
                    } else {
                        if (prevCondition === "AND") {
                            matches = matches && compareResult;
                        } else {
                            matches = matches || compareResult;
                        }
                    }
                }
                idx++;
            }
            return matches;

        } else { // single where statement
            return this._compare(where[0] as IWhereCondition, singleRow);
        }
    }

    public static likeCache: { [likeQuery: string]: RegExp } = {};

    public _processLIKE(columnValue: string, givenValue: string): boolean {
        if (!_nanoSQLQuery.likeCache[givenValue]) {
            let prevChar = "";
            const len = givenValue.split("").length - 1;
            _nanoSQLQuery.likeCache[givenValue] = new RegExp(givenValue.split("").map((s, i) => {
                if (prevChar === "\\") {
                    prevChar = s;
                    return s;
                }
                prevChar = s;
                if (s === "%") return ".*";
                if (s === "_") return ".";
                return (i === 0 ? "^" + s : i === len ? s + "$" : s);
            }).join(""), "gmi");
        }
        if (typeof columnValue !== "string") {
            if (typeof columnValue === "number") {
                return String(columnValue).match(_nanoSQLQuery.likeCache[givenValue]) !== null;
            } else {
                return JSON.stringify(columnValue).match(_nanoSQLQuery.likeCache[givenValue]) !== null;
            }
        }
        return columnValue.match(_nanoSQLQuery.likeCache[givenValue]) !== null;
    }

    public _getColValue(where: IWhereCondition, wholeRow: any): any {
        const value = where.fnString ? execFunction(this.query, where.fnString, wholeRow, { result: undefined }).result : deepGet(where.col as string, wholeRow);
        return where.type === "date" ? (Array.isArray(value) ? value.map(s => maybeDate(s)) : maybeDate(value)) : value;
    }

    /**
     * Compare function used by WHERE to determine if a given value matches a given condition.
     *
     * Accepts single where arguments (compound arguments not handled).
     *
     *
     * @param {*} val1
     * @param {string} compare
     * @param {*} val2
     * @returns {boolean}
     */
    public _compare(where: IWhereCondition, wholeRow: any): boolean {

        const columnValue = this._getColValue(where, wholeRow);
        const givenValue = where.value as any;
        const compare = where.comp;

        if (givenValue === "NULL" || givenValue === "NOT NULL") {
            const isNull = [undefined, null, ""].indexOf(columnValue) !== -1;
            const isEqual = compare === "=" || compare === "LIKE";
            switch (givenValue) {
                case "NULL": return isEqual ? isNull : !isNull;
                case "NOT NULL": return isEqual ? !isNull : isNull;
            }
        }

        if (["IN", "NOT IN", "BETWEEN", "INTERSECT", "INTERSECT ALL", "NOT INTERSECT"].indexOf(compare) !== -1) {
            if (!Array.isArray(givenValue)) {
                this.query.state = "error";
                this.error(`WHERE "${compare}" comparison requires an array value!`);
                return false;
            }
        }

        switch (compare) {
            // if column equal to given value. Supports arrays, objects and primitives
            case "=": return objectsEqual(givenValue, columnValue);
            // if column not equal to given value. Supports arrays, objects and primitives
            case "!=": return !objectsEqual(givenValue, columnValue);
            // if column greather than given value
            case ">": return columnValue > givenValue;
            // if column less than given value
            case "<": return columnValue < givenValue;
            // if column less than or equal to given value
            case "<=": return columnValue <= givenValue;
            // if column greater than or equal to given value
            case ">=": return columnValue >= givenValue;
            // if column value exists in given array
            case "IN": return givenValue.indexOf(columnValue) !== -1;
            // if column does not exist in given array
            case "NOT IN": return givenValue.indexOf(columnValue) === -1;
            // regexp search the column
            case "REGEXP":
            case "REGEX": return (columnValue || "").match(givenValue) !== null;
            // if given value exists in column value
            case "LIKE": return this._processLIKE((columnValue || ""), givenValue);
            // if given value does not exist in column value
            case "NOT LIKE": return !this._processLIKE((columnValue || ""), givenValue);
            // if the column value is between two given numbers
            case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] >= columnValue;
            // if the column value is not between two given numbers
            case "NOT BETWEEN": return givenValue[0] >= columnValue || givenValue[1] <= columnValue;
            // if single value exists in array column
            case "INCLUDES": return (columnValue || []).indexOf(givenValue) !== -1;
            // if LIKE value exists in array column
            case "INCLUDES LIKE": return (columnValue || []).filter(v => this._processLIKE(v, givenValue)).length > 0;
            // if single value does not exist in array column
            case "NOT INCLUDES": return (columnValue || []).indexOf(givenValue) === -1;
            // if array of values intersects with array column
            case "INTERSECT": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length > 0;
            // if every value in the provided array exists in the array column
            case "INTERSECT ALL": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length === givenValue.length;
            // if array of values does not intersect with array column
            case "NOT INTERSECT": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length === 0;
            default: return false;
        }
    }


    public _parseSort(sort: string[], checkforIndexes: boolean): InanoSQLSortBy {
        const key = (sort && sort.length ? hash(JSON.stringify(sort)) : "") + (typeof this.query.table === "string" ? this.nSQL.getDB(this.databaseID).state.cacheId : "");
        if (!key) return { sort: [], index: "" };
        if (_nanoSQLQuery._sortMemoized[key]) return _nanoSQLQuery._sortMemoized[key];

        let isThereFn = false;
        const result: { path: string[], dir: string }[] = sort.map(o => o.split(" ").map(s => s.trim())).reduce((p, c) => {
            const hasFn = c[0].indexOf("(") !== -1;
            if (hasFn) {
                isThereFn = true;
            }
            /*
            const fnArgs: string[] = hasFn ? c[0].split("(")[1].replace(")", "").split(",").map(v => v.trim()).filter(a => a) : [];
            const fnName = hasFn ? c[0].split("(")[0].trim().toUpperCase() : undefined;
            if (fnName && !this.nSQL.functions[fnName]) {
                this.query.state = "error";
                this.error(`Function "${fnName}" not found!`);
            }*/
            p.push({
                path: hasFn ? [] : resolvePath(c[0]),
                fn: hasFn ? c[0] : undefined,
                dir: (c[1] || "asc").toUpperCase()
            });
            return p;
        }, [] as any[]);

        let index = "";
        if (checkforIndexes && isThereFn === false && result.length === 1) {
            const pkKey: string[] = typeof this.query.table === "string" ? this.nSQL.getDB(this.databaseID)._tables[this.query.table].pkCol : [];
            if (result[0].path[0].length && objectsEqual(result[0].path, pkKey)) {
                index = "_pk_";
            } else {
                const indexKeys = Object.keys(this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].indexes);
                let i = indexKeys.length;
                while (i-- && !index) {
                    if (objectsEqual(this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].indexes[indexKeys[i]], result[0].path)) {
                        index = this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].indexes[indexKeys[i]].id;
                    }
                }
            }
        }
        _nanoSQLQuery._sortMemoized[key] = {
            sort: result,
            index: index
        };
        return _nanoSQLQuery._sortMemoized[key];
    }

    public _parseSelect() {
        const selectArgsKey = (this.query.actionArgs && this.query.actionArgs.length ? JSON.stringify(this.query.actionArgs) : "") + (typeof this.query.table === "string" ? this.nSQL.getDB(this.databaseID).state.cacheId : "");

        this._orderBy = this._parseSort(this.query.orderBy || [], typeof this.query.table === "string");
        this._groupBy = this._parseSort(this.query.groupBy || [], false);

        if (selectArgsKey) {
            if (_nanoSQLQuery._selectArgsMemoized[selectArgsKey]) {
                this._hasAggrFn = _nanoSQLQuery._selectArgsMemoized[selectArgsKey].hasAggrFn;
                this._selectArgs = _nanoSQLQuery._selectArgsMemoized[selectArgsKey].args;
                this._hasFn = _nanoSQLQuery._selectArgsMemoized[selectArgsKey].hasFn;
            } else {
                (this.query.actionArgs || []).forEach((val: string) => {
                    const splitVal = val.split(/\s+as\s+/i).map(s => s.trim());
                    if (splitVal[0].indexOf("(") !== -1) {
                        // const fnArgs = splitVal[0].split("(")[1].replace(")", "").split(",").map(v => v.trim());
                        const fnName = splitVal[0].split("(")[0].trim().toUpperCase();
                        this._selectArgs.push({ isFn: true, value: splitVal[0], as: splitVal[1], args: undefined });
                        if (!this.nSQL.functions[fnName]) {
                            this.query.state = "error";
                            this.error(`Function "${fnName}" not found!`);
                        } else {
                            this._hasFn = true;
                            if (this.nSQL.functions[fnName].type === "A") {
                                this._hasAggrFn = true;
                            }
                        }
                    } else {
                        this._selectArgs.push({ isFn: false, value: splitVal[0], as: splitVal[1] });
                    }
                });
                if (this.query.state !== "error") {
                    _nanoSQLQuery._selectArgsMemoized[selectArgsKey] = { hasAggrFn: this._hasAggrFn, hasFn: this._hasFn, args: this._selectArgs };
                }
            }

        } else {
            this._selectArgs = [];
        }

        let canUseOrderByIndex: boolean = false;
        if (this._whereArgs.type === IWhereType.none) {
            canUseOrderByIndex = this._orderBy.index === "_pk_";
            if (canUseOrderByIndex) {
                this._pkOrderBy = true;
            }
        } else {
            canUseOrderByIndex = this._orderBy.index.length && this._whereArgs.fastWhere && objectsEqual((this._whereArgs.fastWhere[0] as IWhereCondition).col, this._orderBy.sort[0].path) ? true : false;
            if (canUseOrderByIndex) {
                this._idxOrderBy = true;
            }
        }

        if ((this._orderBy.sort.length && !canUseOrderByIndex) || this._groupBy.sort.length || this._hasAggrFn) {
            this._stream = false;
        }
    }



    public _parseWhere(qWhere: any[] | ((row: { [key: string]: any }) => boolean), ignoreIndexes?: boolean): IWhereArgs {
        const where = qWhere || [];
        const key = (JSON.stringify(where, (key, value) => {
            return value && value.constructor && value.constructor.name === "RegExp" ? value.toString() : value;
        }) + (ignoreIndexes ? "0" : "1")) + (typeof this.query.table === "string" ? this.nSQL.getDB(this.databaseID).state.cacheId : "");

        if (_nanoSQLQuery._whereMemoized[key]) {
            return _nanoSQLQuery._whereMemoized[key];
        }

        if (typeof where === "function") {
            return { type: IWhereType.fn, whereFn: where };
        } else if (!where.length) {
            _nanoSQLQuery._whereMemoized[key] = { type: IWhereType.none };
            return _nanoSQLQuery._whereMemoized[key];
        }

        const indexes: InanoSQLIndex[] = typeof this.query.table === "string" ? Object.keys(this.nSQL.getDB(this.databaseID)._tables[this.query.table].indexes).map(k => this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].indexes[k]) : [];
        const pkKey: string[] = typeof this.query.table === "string" ? this.nSQL.getDB(this.databaseID)._tables[this.query.table].pkCol : [];
        const pkType: string = typeof this.query.table === "string" ? this.nSQL.getDB(this.databaseID)._tables[this.query.table].pkType : "";

        // find indexes and functions
        const recursiveParse = (ww: any[], level: number): (IWhereCondition | string)[] => {

            const doIndex = !ignoreIndexes && level === 0;

            return ww.reduce((p, w, i) => {
                if (i % 2 === 1) { // AND or OR
                    if (typeof w !== "string") {
                        this.query.state = "error";
                        this.error("Malformed WHERE statement!");
                        return p;
                    }
                    p.push(w);
                    return p;
                } else { // where conditions

                    if (!Array.isArray(w)) {
                        this.query.state = "error";
                        this.error("Malformed WHERE statement!");
                        return p;
                    }
                    if (Array.isArray(w[0])) { // nested array
                        p.push(recursiveParse(w, level + 1));
                    } else if (w[0].indexOf("(") !== -1) { // function

                        const fnArgs: string[] = w[0].split("(")[1].replace(")", "").split(",").map(v => v.trim()).filter(a => a);
                        const fnName: string = w[0].split("(")[0].trim().toUpperCase();
                        let hasIndex = false;
                        if (!this.nSQL.functions[fnName]) {
                            this.query.state = "error";
                            this.error(`Function "${fnName}" not found!`);
                            return p;
                        }

                        if (doIndex && this.nSQL.functions[fnName] && this.nSQL.functions[fnName].checkIndex) {
                            const indexFn = (this.nSQL.functions[fnName].checkIndex as any)(this.query, fnArgs, w);

                            if (indexFn) {
                                this._indexesUsed.push(assign(w));
                                hasIndex = true;
                                p.push(indexFn);
                            }
                        }

                        if (!hasIndex) {
                            p.push({
                                fnString: w[0],
                                parsedFn: { name: fnName, args: fnArgs },
                                comp: w[1],
                                value: w[2]
                            });
                        }

                    } else { // column select

                        let isIndexCol = false;
                        const path = doIndex ? resolvePath(w[0]) : [];

                        // convert date strings to date numbers
                        // w[2] = Array.isArray(w[2]) ? w[2].map(w => maybeDate(w)) : maybeDate(w[2]);

                        if (["=", "BETWEEN", "IN", "LIKE"].indexOf(w[1]) !== -1 && doIndex) {

                            if (w[1] === "LIKE" && !w[2].match(/.*\%$/gmi)) {
                                // using LIKE but wrong format for fast query
                            } else {
                                // primary key select
                                if (objectsEqual(path, pkKey)) {
                                    if (w[1] === "LIKE" && pkType !== "string") {

                                    } else {
                                        // pk queries don't work with BETWEEN when using date type
                                        isIndexCol = true;
                                        this._indexesUsed.push(assign(w));
                                        p.push({
                                            index: "_pk_",
                                            col: w[0],
                                            comp: w[1],
                                            value: w[2],
                                            type: pkType
                                        });
                                    }
                                } else { // check if we can use any secondary index
                                    indexes.forEach((index) => {
                                        if (w[1] === "LIKE" && index.type !== "string") {

                                        } else {
                                            if (isIndexCol === false && objectsEqual(index.path, path) && index.isArray === false && w[2] !== "NOT NULL") {
                                                isIndexCol = true;
                                                this._indexesUsed.push(assign(w));
                                                p.push({
                                                    index: index.id,
                                                    col: w[0],
                                                    comp: w[1],
                                                    value: w[2],
                                                    type: this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].indexes[index.id].type
                                                });
                                            }
                                        }
                                    });
                                }
                            }
                        }

                        if (doIndex && !isIndexCol && ["INCLUDES", "INTERSECT", "INTERSECT ALL", "INCLUDES LIKE"].indexOf(w[1]) !== -1) {
                            indexes.forEach((index) => {
                                if (objectsEqual(index.path, path) && index.isArray === true) {
                                    if (w[1] === "INCLUDES LIKE" && index.type !== "string") {

                                    } else {
                                        isIndexCol = true;
                                        this._indexesUsed.push(assign(w));
                                        p.push({
                                            index: index.id,
                                            indexArray: true,
                                            col: w[0],
                                            comp: w[1],
                                            value: w[2],
                                            type: this.nSQL.getDB(this.databaseID)._tables[this.query.table as string].indexes[index.id].type
                                        });
                                    }
                                }
                            });
                        }

                        const findColumnType = (columns: InanoSQLTableColumn[], path: string[]): string => {
                            const getType = (pathIdx: number, cols: InanoSQLTableColumn[]) => {
                                const colData = cols.filter(c => c.key === path[pathIdx])[0];

                                if (!colData) return "";

                                if (!path[pathIdx + 1]) return colData.type;

                                if (!colData.model) return "";

                                return getType(pathIdx + 1, colData.model);
                            };
                            return getType(0, columns);
                        }

                        const type = typeof this.query.table === "string" ? findColumnType(this.nSQL.getDB(this.databaseID)._tables[this.query.table].columns, resolvePath(w[0])) : "";

                        if (!isIndexCol) {
                            p.push({
                                col: w[0],
                                comp: w[1],
                                value: type === "date" ? (Array.isArray(w[2]) ? w[2].map(s => maybeDate(s)) : maybeDate(w[2])) : w[2],
                                type: type
                            });
                        }
                    }
                    return p;
                }
            }, [] as IWhereCondition[]);
        };
        let parsedWhere = recursiveParse(typeof where[0] === "string" ? [where] : where, 0);
        // discover where we have indexes we can use
        // the rest is a full table scan OR a scan of the index results
        // fastWhere = index query, slowWhere = row by row/full table scan
        let isIndex = true;
        let count = 0;
        let lastFastIndx = -1;
        while (count < parsedWhere.length && isIndex) {
            if (count % 2 === 1) {
                if (parsedWhere[count] !== "AND") {
                    isIndex = false;
                } else {
                    lastFastIndx = count;
                }
            } else {
                if (Array.isArray((parsedWhere[count] as any)) || !(parsedWhere[count] as any).index) {
                    isIndex = false;
                } else {
                    lastFastIndx = count;
                }
            }
            count++;
        }

        // make sure lastFastIndx lands on an AND, OR or gets pushed off the end.
        if (lastFastIndx % 2 === 0) {
            lastFastIndx++;
        }
        // has at least some index values
        // "AND" or the end of the WHERE should follow the last index to use the indexes
        if (lastFastIndx !== -1 && (parsedWhere[lastFastIndx] === "AND" || !parsedWhere[lastFastIndx])) {
            const slowWhere = parsedWhere.slice(lastFastIndx + 1);
            _nanoSQLQuery._whereMemoized[key] = {
                type: slowWhere.length ? IWhereType.medium : IWhereType.fast,
                slowWhere: slowWhere,
                fastWhere: parsedWhere.slice(0, lastFastIndx)
            };
        } else {
            _nanoSQLQuery._whereMemoized[key] = {
                type: IWhereType.slow,
                slowWhere: parsedWhere
            };
        }

        return _nanoSQLQuery._whereMemoized[key];
    }
}

