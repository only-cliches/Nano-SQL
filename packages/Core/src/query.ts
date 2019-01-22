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
    InanoSQLFunctionResult,
    addRowEventFilter,
    deleteRowEventFilter,
    updateRowEventFilter,
    updateIndexFilter,
    InanoSQLupdateIndex
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
    uuid, 
    adapterFilters, 
    throttle,
    nan,
    execFunction,
    cast,
    random16Bits,
} from "./utilities";

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
    private _indexesUsed: any[];

    constructor(
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
        if (action !== "select" && typeof query.table !== "string") {
            this.query.state = "error";
            this.error(`Only "select" queries are available for this resource!`);
            return;
        }

        if (typeof query.table === "string" && !this.nSQL.state.connected) {
            this.query.state = "error";
            this.error(`Can't execute query before the database has connected!`);
            return;
        }

        const requireQueryOpts = (requreiAction: boolean, cb: () => void) => {
            if (typeof this.query.table !== "string") {
                this.query.state = "error";
                this.error(`${this.query.action} query requires a string table argument!`);
                return;
            }
            if (requreiAction && !this.query.actionArgs) {
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
            case "upsert":
                this._upsert(this.progress, this.complete, this.error);
                break;
            case "delete":
                this._delete(this.progress, this.complete, this.error);
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
                requireQueryOpts(true, () => {
                    this._createTable(this.query.actionArgs as InanoSQLTableConfig, false, finishQuery, this.error);
                });
                break;
            case "alter table":
                requireQueryOpts(true, () => {
                    this._createTable(this.query.actionArgs as InanoSQLTableConfig, true, finishQuery, this.error);
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
            default:
                this.nSQL.doFilter<customQueryFilter>("customQuery", { res: undefined, query: this.query, onRow: progress, complete: complete, error: error }, () => {
                    this.query.state = "error";
                    this.error(`Query type "${query.action}" not supported!`);
                }, (err) => {
                    this.query.state = "error";
                    this.error(err);
                });

        }
    }

    public _conform(progress: (row: any, i: number) => void, finished: () => void, error: (err: any) => void) {
        const conformTable = this.query.table as string;
        const conformFilter = this.query.actionArgs || function(r) { return r};

        if (!this.nSQL._tables[conformTable]) {
            error(new Error(`Table ${conformTable} not found for conforming!`));
            return;
        }
        let count = 0;
        const conformQueue = new _nanoSQLQueue((item, i, done, err) => {
            const newRow = this.nSQL.default(item, conformTable);
            this.nSQL.doFilter<conformRowFilter>("conformRow", { res: newRow, oldRow: item, query: this.query }, (setRow) => {
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
                    if (this.nSQL.state.hasAnyEvents) {
                        this.nSQL.triggerEvent(changeEvent);
                        Object.keys(this.nSQL.eventFNs[this.query.table as string]).forEach((path) => {
                            if (path !== "*") {
                                if (!objectsEqual(deepGet(path, item), deepGet(path, setRow.res))) {
                                    this.nSQL.triggerEvent({
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
        });

    }

    public _getTable(tableName: string, whereCond: any[] | ((row: { [key: string]: any; }, i?: number) => boolean) | undefined, table: any, callback: (result: TableQueryResult) => void) {
        const cacheID = this.query.cacheID as string;

        if (typeof table === "function") {
            if (!globalTableCache[cacheID]) {
                globalTableCache[cacheID] = {};
            }

            if (!globalTableCache[cacheID][tableName]) { // first load
                globalTableCache[cacheID][tableName] = {loading: true, rows: [], cache: true};
                table(whereCond).then((result: TableQueryResult) => {
                    const doCache = (result.cache && !result.filtered) || false;
                    globalTableCache[cacheID][tableName] = {loading: false, rows: doCache ? result.rows : [] as any, cache: doCache};
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
                callback({filtered: false, rows: globalTableCache[cacheID][tableName].rows, cache: true});
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


            const withPK = typeof join.with.table === "string" ? this.nSQL._tables[join.with.table].pkCol : [];
            const rightTable = String(join.with.as || join.with.table);
            const leftTable = String(this.query.tableAS || this.query.table);

            const queryTable = this.query.tableAS || this.query.table as string;
            const whereCond = join.on && join.type !== "cross" ? this._buildCombineWhere(join.on, join.with.as || join.with.table as string, queryTable, rowData) : [];

            this._getTable(queryTable, whereCond, join.with.table, (joinTable) => {

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
                            this.nSQL.triggerQuery({
                                ...buildQuery(this.nSQL, join.with.table, "select"),
                                skipQueue: true,
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

                if (joinTable.filtered) {
                    (joinTable.rows as any).forEach(eachRow);
                    rowsDone();
                } else {
                    this.nSQL.triggerQuery({
                        ...buildQuery(this.nSQL, joinTable.rows, "select"),
                        tableAS: join.with.as,
                        cacheID: this.query.cacheID,
                        where: join.on && join.type !== "cross" ? this._buildCombineWhere(join.on, join.with.as || join.with.table as string, queryTable, rowData) : undefined,
                        skipQueue: true
                    }, eachRow, rowsDone, (err) => {
                        this.query.state = "error";
                        this.error(err);
                    });
                }
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

        let distinctKeys: {[key: string]: boolean} = {};
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
                            if (doRange) {
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
                    const sorted = this._queryBuffer.sort(this._orderByRows);
                    (doRange ? sorted.slice(range[0], range[1]) : sorted).forEach(this.progress);
                }
                if (this.query.cacheID && this.query.cacheID === this.query.queryID) {
                    delete globalTableCache[this.query.cacheID];
                }
                complete();
            });
            return;
        }

        const joinData: InanoSQLJoinArgs[] = Array.isArray(this.query.join) ? this.query.join : [this.query.join as any];

        let joinedRows = 0;
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
                    if (doRange ? (rowCounter >= range[0] && rowCounter < range[1]) : true) {
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
                // Group by, functions and AS
                this._groupByRows();

                if (this.query.having) { // having
                    this._queryBuffer = this._queryBuffer.filter(row => {
                        return this._where(row, this._havingArgs.slowWhere as any[]);
                    });
                }

                if (this.query.orderBy && !this._hasOrdered) { // order by
                    this._queryBuffer.sort(this._orderByRows);
                }

                if (doRange) { // limit / offset
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
                        this.progress(row, i);
                    }
                });

                if (this.query.cacheID && this.query.cacheID === this.query.queryID) {
                    delete globalTableCache[this.query.cacheID];
                }
                complete();
            });
        });

        const tableIsString = typeof this.query.table === "string";
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
                this.nSQL.triggerEvent(selectEvent);
            }

            if (this.query.returnEvent) {
                this.progress(selectEvent, i);
            } else {
                selectBuffer.newItem(row);
            }
        }, () => {
            if (this.query.returnEvent) {
                complete();
            } else {
                selectBuffer.finished();
            }
        });
    }

    public _groupByRows() {

        if (!this.query.groupBy && !this._hasAggrFn) {
            this._queryBuffer = this._queryBuffer.map(b => this._streamAS(b));
            return;
        }


        this._queryBuffer.sort((a: any, b: any) => {
            return this._sortObj(a, b, this._groupBy);
        }).forEach((val, idx) => {

            const groupByKey = this._groupBy.sort.map(k => {
                return String(k.fn ? execFunction(this.query, k.fn, val, {result: undefined}).result : deepGet(k.path, val)) 
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
            // loop through the groups
            this._sortGroups.forEach((group) => {
                // find aggregate functions
                let resultFns: { aggr: any, name: string, idx: number }[] = this._selectArgs.reduce((p, c, i) => {
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

                let firstFn = resultFns.filter(f => f)[0];

                // calculate aggregate functions
                group.reverse().forEach((row, i) => {
                    resultFns.forEach((fn, i) => {
                        if (!fn) return;
                        resultFns[i].aggr = execFunction(this.query, resultFns[i].name, row, resultFns[i].aggr);
                    });
                });

                // calculate simple functions and AS back into buffer
                this._queryBuffer.push(this._selectArgs.reduce((prev, cur, i) => {
                    const col = cur.value;
                    prev[cur.as || col] = cur.isFn && resultFns[i] ? resultFns[i].aggr.result : (cur.isFn ? execFunction(this.query, cur.value, resultFns[firstFn.idx].aggr.row, {result: undefined}).result : deepGet(cur.value, resultFns[firstFn.idx].aggr.row));
                    return prev;
                }, {}));

            });
        } else {
            this._sortGroups.forEach((group) => {
                this._queryBuffer.push(this._streamAS(group.shift()));
            });
        }
    }

    public _buildCombineWhere(graphWhere: any, graphTable: string, rowTable: string, rowData: any): any {
        if (typeof graphWhere === "function") {
            return (compareRow) => {
                return graphWhere(compareRow, rowData);
            };
        }
        return (typeof graphWhere[0] === "string" ? [graphWhere] : graphWhere).map(j => {
            if (Array.isArray(j[0])) return this._buildCombineWhere(j, graphTable, rowTable, rowData); // nested where
            if (j === "AND" || j === "OR") return j;

            const leftWhere: any[] = resolvePath(j[0]);
            const rightWhere: any[] = resolvePath(j[2]);
            const swapWhere = leftWhere[0] === rowTable;

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

            const whereCond = this._buildCombineWhere(graph.on, graph.with.as || graph.with.table as string, topTable, { [topTable]: row });

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
                    this.nSQL.triggerQuery({
                        ...buildQuery(this.nSQL, graphTable.rows, "select"),
                        tableAS: graph.with.as,
                        actionArgs: graph.select,
                        where: whereCond,
                        limit: graph.limit,
                        offset: graph.offset,
                        orderBy: graph.orderBy,
                        groupBy: graph.groupBy,
                        graph: graph.graph,
                        skipQueue: true,
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
            error("Can't upsert without records!");
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

        const table = this.nSQL._tables[this.query.table as string];

        if (this._whereArgs.type === IWhereType.none) { // insert/update records directly

            allAsync(upsertRecords, (row, i, next, error) => {
                const pkVal = deepGet(table.pkCol, row);

                if (pkVal) {
                    adapterFilters(this.nSQL, this.query).read(this.query.table as string, pkVal, (oldRow) => {
                        if (oldRow) {
                            this._updateRow(row, oldRow, (eventOrNewRow) => {
                                onRow(eventOrNewRow, i);
                                next(null);
                            }, error);
                        } else {
                            this._newRow(row, () => {
                                onRow({oldRow: undefined, newRow: row}, i);
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
                complete();
            }).catch(this._onError);
        } else { // find records and update them
            if (upsertRecords.length > 1) {
                this.query.state = "error";
                error("Cannot upsert multiple records with where condition!");
                return;
            }

            let updatedRecords = 0;
            const upsertBuffer = new _nanoSQLQueue((row, i, done, err) => {
                updatedRecords++;
                this._updateRow(upsertRecords[0], row, (evOrRow) => {
                    onRow(evOrRow, i);
                    done();
                }, err);
            }, error, () => {
                complete();
            });
            this._getRecords((row, i) => {
                upsertBuffer.newItem(row);
            }, () => {
                upsertBuffer.finished();
            });
        }
    }

    public _updateRow(newData: any, oldRow: any, complete: (row: any) => void, error: (err: any) => void) {
        this.nSQL.doFilter<updateRowFilter>("updateRow", { res: newData, row: oldRow, query: this.query }, (upsertData) => {

            let finalRow = this.nSQL.default(this.upsertPath ? deepSet(this.upsertPath, maybeAssign(oldRow), upsertData.res) : {
                ...oldRow,
                ...upsertData.res
            }, this.query.table as string);

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

                this.nSQL.doFilter<updateRowEventFilter>("updateRowEvent", {res: changeEvent, query: this.query}, (event) => {
                    if (typeof this.query.table === "string") {
                        this.nSQL.triggerEvent(event.res);

                        if (this.nSQL.eventFNs[this.query.table as string]) {
                            Object.keys(this.nSQL.eventFNs[this.query.table as string]).forEach((path) => {
                                if (path !== "*") {
                                    if (!objectsEqual(deepGet(path, oldRow), deepGet(path, finalRow))) {
                                        this.nSQL.triggerEvent({
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
                    }
                    complete(this.query.returnEvent ? event.res : finalRow);
                }, error);
            }, error);
        }, error);
    }

    private _checkUniqueIndexes(table: string, pk: any, oldRow: any, newIndexValues: {[index: string]: any}, done: () => void, error: (err: any) => void) {
        allAsync(Object.keys(newIndexValues), (index, i, next, err) => {
            const indexProps = this.nSQL._tables[this.query.table as any].indexes[index].props || {};
            if (indexProps && indexProps.unique) { // check for unique
                let indexPKs: any[] = [];
                adapterFilters(this.nSQL, this.query).readIndexKey(table, index, newIndexValues[index], (rowPK) => {
                    if (rowPK !== pk) indexPKs.push(rowPK);
                }, () => {
                    if (indexPKs.length > 0) {
                        err({error: "Unique Index Collision!", row: oldRow, query: this.query});
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
        const newIndexValues = this._getIndexValues(this.nSQL._tables[this.query.table as any].indexes, finalRow);
        const oldIndexValues = this._getIndexValues(this.nSQL._tables[this.query.table as any].indexes, oldRow);
        const table = this.nSQL._tables[queryTable];

        this._checkUniqueIndexes(queryTable, deepGet(table.pkCol, oldRow), oldRow, newIndexValues, () => {

            allAsync(Object.keys(oldIndexValues).concat(["__pk__"]), (indexName: string, i, next, err) => {
                if (indexName === "__pk__") { // main row
                    adapterFilters(this.nSQL, this.query).write(queryTable, deepGet(table.pkCol, finalRow), finalRow, (pk) => {
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
                            allAsync(["rm", "add"], (job, i, nextJob) => {
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

    private _updateIndex(table: string, indexName: string, value: any, pk: any, addToIndex: boolean, done: () => void, err: (error) => void) {

        const newItem: InanoSQLupdateIndex = { table, indexName, value, pk, addToIndex, done, err, query: this.query, nSQL: this.nSQL };

        this.nSQL.doFilter<updateIndexFilter>("updateIndex", {res: newItem, query: this.query}, (update) => {
            secondaryIndexQueue[this.nSQL.state.id + this.query.table].newItem(update.res, (item: InanoSQLupdateIndex, done, error) => {
                const fn = item.addToIndex ? adapterFilters(item.nSQL, item.query).addIndexValue : adapterFilters(item.nSQL, item.query).deleteIndexValue;
                fn(item.table, item.indexName, item.pk, item.value, () => {
                    item.done();
                    done();
                }, (err) => {
                    item.err(err);
                    done();
                });
            });
        }, err);


    }

    public _newRow(newRow: any, complete: (row: any) => void, error: (err: any) => void) {

        this.nSQL.doFilter<addRowFilter>("addRow", { res: newRow, query: this.query }, (rowToAdd) => {
            const table = this.nSQL._tables[this.query.table as string];

            rowToAdd.res = this.nSQL.default(maybeAssign(this.upsertPath ? deepSet(this.upsertPath, {}, rowToAdd.res) : rowToAdd.res), this.query.table as string);
            
            const indexValues = this._getIndexValues(this.nSQL._tables[this.query.table as any].indexes, rowToAdd.res);

            this._checkUniqueIndexes(this.query.table as string, deepGet(table.pkCol, rowToAdd.res), rowToAdd.res, indexValues, () => {

                adapterFilters(this.nSQL, this.query).write(this.query.table as string, deepGet(table.pkCol, rowToAdd.res), rowToAdd.res, (pk) => {
                    deepSet(table.pkCol, rowToAdd.res, pk)

                    allAsync(Object.keys(indexValues), (indexName: string, i, next, err) => {
                        // const idxTable = "_idx_" + this.nSQL.tableIds[this.query.table as string] + "_" + indexName;
                        if (table.indexes[indexName].isArray) {
                            const arrayOfValues = indexValues[indexName] || [];
                            allAsync(arrayOfValues, (value, i, nextArr) => {
                                this._updateIndex(this.query.table as string, indexName, value, deepGet(table.pkCol, rowToAdd.res), true, () => {
                                    nextArr(null);
                                }, err);
                            }).then(() => {
                                next(null);
                            }).catch(err);
                        } else {
                            this._updateIndex(this.query.table as string, indexName, indexValues[indexName], deepGet(table.pkCol, rowToAdd.res), true, () => {
                                next(null);
                            }, err);
                        }
                    }).then(() => {

                        const changeEvent: InanoSQLDatabaseEvent = {
                            target: this.query.table as string,
                            path: "*",
                            events: ["upsert", "*"],
                            time: Date.now(),
                            performance: Date.now() - this._startTime,
                            result: rowToAdd.res,
                            oldRow: undefined,
                            query: this.query,
                            indexes: this._indexesUsed
                        };

                        this.nSQL.doFilter<addRowEventFilter>("addRowEvent", {res: changeEvent, query: this.query}, (event) => {
                            if (typeof this.query.table === "string") {
                                this.nSQL.triggerEvent(event.res);
                            }
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

        let delRows: number = 0;

        const table = this.nSQL._tables[this.query.table as string];

        const deleteBuffer = new _nanoSQLQueue((row, i, done, err) => {
            this._removeRowAndIndexes(table, row, (delRowOrEvent) => {
                onRow(delRowOrEvent, i);
                done();
            }, err);
        }, error, () => {
            complete();
        });

        this._getRecords((row, i) => {
            deleteBuffer.newItem(row);
        }, () => {
            deleteBuffer.finished();
        });

    }

    public _removeRowAndIndexes(table: InanoSQLTable, row: any, complete: (rowOrEv: any) => void, error: (err: any) => void) {

        const indexValues = this._getIndexValues(table.indexes, row);

        this.nSQL.doFilter<deleteRowFilter>("deleteRow", { res: row, query: this.query }, (delRow) => {

            allAsync(Object.keys(indexValues).concat(["__del__"]), (indexName: string, i, next) => {
                if (indexName === "__del__") { // main row
                    adapterFilters(this.nSQL, this.query).delete(this.query.table as string, deepGet(table.pkCol, delRow.res), () => {
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
                this.nSQL.doFilter<deleteRowEventFilter>("deleteRowEvent", {res: delEvent, query: this.query}, (event) => {
                    if (typeof this.query.table === "string") {
                        this.nSQL.triggerEvent(event.res);
                    }
                    complete(this.query.returnEvent ? event.res : delRow.res);
                }, error);
                
            }).catch(error);
        }, error);
    }

    public _getIndexValues(indexes: {[id: string]: InanoSQLIndex}, row: any): { [indexName: string]: any } {
        
        return Object.keys(indexes).reduce((prev, cur) => {
            const value = deepGet(indexes[cur].path, row);
            const type = indexes[cur].type;
            prev[cur] = indexes[cur].isArray ? (Array.isArray(value) ? value : []).map(v => this.nSQL.indexTypes[type](v)) : this.nSQL.indexTypes[type](value);
            return prev;
        }, {});
    }

    public _showTables() {
        this.progress({
            tables: Object.keys(this.nSQL._tables)
        }, 0);
        Object.keys(this.nSQL._tables).forEach((table, i) => {
            this.progress({table: table}, i);
        });
        this.complete();
    }

    public _describe(type: "table" | "idx" | "fks" = "table") {
        if (typeof this.query.table !== "string") {
            this.query.state = "error";
            this.error({error: "Can't call describe on that!", query: this.query});
            return;
        }
        if (!this.nSQL._tables[this.query.table]) {
            this.query.state = "error";
            this.error({error: `Table ${this.query.table} not found!`, query: this.query});
            return;
        }
        switch (type) {
            case "table":
                this.nSQL._tables[this.query.table].columns.forEach((col, i) => {
                    this.progress(assign(col), i);
                });
            break;
            case "idx":
                Object.keys(this.nSQL._tables[this.query.table].indexes).forEach((idx, i) => {
                    const index = this.nSQL._tables[this.query.table as string].indexes[idx];
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

    public _streamAS(row: any): any {
        const distinctArgs = (this.query.distinct || []).map(s => ({ isFn: false, value: s}))
        const selectArgs = (this._selectArgs || []).concat(distinctArgs);
        if (selectArgs.length) {
            let result = {};
            selectArgs.forEach((arg) => {
                if (arg.isFn) {
                    result[arg.as || arg.value] = execFunction(this.query, arg.value, row, {} as any).result;
                } else {
                    result[arg.as || arg.value] = deepGet(arg.value, row);
                }
            });
            return this.query.join ? this._combineRows(result) : result;
        }
        return this.query.join ? this._combineRows(row) : row;
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
        const id = typeof this.query.table === "string" ? this.nSQL._tables[this.query.table as any].pkCol : [];
        const A_id = id.length ? deepGet(id, objA) : false;
        const B_id = id.length ? deepGet(id, objB) : false;
        return columns.sort.reduce((prev, cur) => {
            let A = cur.fn ? execFunction(this.query, cur.fn, objA, {result: undefined}).result : deepGet(cur.path, objA);
            let B = cur.fn ? execFunction(this.query, cur.fn, objB, {result: undefined}).result : deepGet(cur.path, objB);
            if (!prev) {
                if (A === B) return A_id === B_id ? 0 : (A_id > B_id ? 1 : -1);
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

    public _createTable(table: InanoSQLTableConfig, alterTable: boolean, complete: () => void, error: (err: any) => void): void {
        
        const tableID = this.nSQL._tableIds[this.query.table as string] || this._tableID();

        // table already exists, set to alter table query
        if (!alterTable && Object.keys(this.nSQL._tables).indexOf(table.name) !== -1) {
            alterTable = true;
        }
        
        new Promise((res, rej) => {
            let hasError = false;

            const l = table.name;
            if (!table._internal && (l.indexOf("_") === 0 || l.match(/\s/g) !== null || l.match(/[\(\)\]\[\.]/g) !== null)) {
                rej({error: `Invalid Table Name ${table.name}! https://docs.nanosql.io/setup/data-models`, query: this.query});
                return;
            }

            Object.keys(table.model).forEach((col) => {
                const modelData = col.replace(/\s+/g, "-").split(":"); // [key, type];
                if (modelData.length === 1) {
                    modelData.push("any");
                }
                if (!modelData[0] || modelData[0].match(/[\(\)\]\[\.]/g) !== null || modelData[0].indexOf("_") === 0) {
                    hasError = true;
                    rej({error: `Invalid Data Model at ${table.name + "." + col}! https://docs.nanosql.io/setup/data-models`, query: this.query});
                }
            });

            if (hasError) return;

            res();
            
        }).then(() => {
            return new Promise((res, rej) => {
                this.nSQL.doFilter<configTableFilter>("configTable", { res: table, query: this.query }, res, rej);
            });
        }).then((table: configTableFilter) => {

            const setModels = (dataModel: InanoSQLDataModel | string, level: number): InanoSQLDataModel|undefined => {
                let model: InanoSQLDataModel = {};
                if (typeof dataModel === "string") {
                    let foundModel = false;
                    const isArray = dataModel.indexOf("[]") !== -1;
                    const type = dataModel.replace(/\[\]/gmi, "");
                    if (level === 0 && isArray) {
                        throw new Error(`Can't use array types as table definition.`);
                    }
                    
                    model = Object.keys(this.nSQL.config.types || {}).reduce((prev, cur) => {
                        if (cur === type[1]) {
                            foundModel = true;
                            return (this.nSQL.config.types || {})[cur]
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
                            default: {lat: 0, lon: 0},
                            model: {
                                "lat:float": {max: 90, min: -90},
                                "lon:float": {max: 180, min: -180}
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

            const tablePKType = table.res.primaryKey ? table.res.primaryKey.split(":")[1] : pkType(table.res.model);

            let newConfig: InanoSQLTable = {
                id: tableID,
                model: computedDataModel,
                columns: generateColumns(computedDataModel),
                filter: table.res.filter,
                actions: table.res.actions || [],
                views: table.res.views || [],
                queries: table.res.queries || {},
                indexes: Object.keys(indexes).map(i => ({
                    id: resolvePath(i.split(":")[0]).join("."),
                    type: (i.split(":")[1] || "string").replace(/\[\]/gmi, ""),
                    isArray: (i.split(":")[1] || "string").indexOf("[]") !== -1,
                    path: resolvePath(i.split(":")[0]),
                    props: indexes[i]
                })).reduce((p, c) => {
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
                            props: {offset: 180}
                        }
                        p[c.id + ".lat"] = {
                            id: c.id + ".lat",
                            type: "float",
                            isArray: false,
                            path: c.path.concat(["lat"]),
                            props: {offset: 90}
                        }
                    } else {
                        p[c.id] = c;
                    }
                    return p;
                }, {} as {[id: string]: InanoSQLIndex}),
                pkType: tablePKType,
                pkCol: table.res.primaryKey ? resolvePath(table.res.primaryKey.split(":")[0])  : getPK([], table.res.model),
                isPkNum: ["number", "int", "float"].indexOf(tablePKType) !== -1,
                ai: ai
            };

            // no primary key found, set one
            if (newConfig.pkCol.length === 0) {
                newConfig.pkCol = ["_id"];
                newConfig.pkType = "uuid";
                newConfig.model["_id:uuid"] = {pk: true};
                newConfig.columns = generateColumns(setModels(newConfig.model, 0) as InanoSQLDataModel);
            }

            if (error && error.length) return Promise.reject(error);

            const oldIndexes = alterTable ? Object.keys(this.nSQL._tables[this.query.table as string].indexes) : [];
            const newIndexes = Object.keys(newConfig.indexes); 

            const addIndexes = newIndexes.filter(v => oldIndexes.indexOf(v) === -1);

            let addTables = [table.res.name].concat(addIndexes);

            secondaryIndexQueue[this.nSQL.state.id + table.res.name] = new _nanoSQLQueue();

            return chainAsync(addTables, (tableOrIndexName, i, next, err) => {
                if (i === 0) { // table
                    const newTable = { name: tableOrIndexName, conf: newConfig };
                    this.nSQL._tableIds[newTable.name] = tableID;
                    if (alterTable) {
                        delete this.nSQL._tableIds[this.query.table as string];
                        const removeIndexes = oldIndexes.filter(v => newIndexes.indexOf(v) === -1);
                        allAsync(removeIndexes, (indexName, i, nextIndex, indexError) => {
                            adapterFilters(this.nSQL, this.query).deleteIndex(tableOrIndexName, indexName, () => {
                                nextIndex(null);
                            }, indexError);
                        }).then(() => {
                            this.nSQL._tables[newTable.name] = newTable.conf;
                            next(null);
                        }).catch(err);
                    } else {
                        adapterFilters(this.nSQL, this.query).createTable(newTable.name, newTable.conf, () => {
                            this.nSQL._tables[newTable.name] = newTable.conf;
                            next(null);
                        }, err as any);
                    }

                } else { // indexes
                    const index = newConfig.indexes[tableOrIndexName];
                    adapterFilters(this.nSQL, this.query).createIndex(table.res.name, index.id, index.type, () => {
                        next(null);
                    }, err as any);

                }
            });
        }).then(() => {
            if (this.query.table as string === "_util") {
                return Promise.resolve();
            }
            return this.nSQL._saveTableIds();
        }).then(() => {
            complete();
        }).catch(error);

    }

    public _dropTable(table: string, complete: () => void, error: (err: any) => void): void {

        let tablesToDrop = [table];
        Object.keys(this.nSQL._tables[table].indexes).forEach((indexName) => {
            tablesToDrop.push(indexName);
        });

        allAsync(tablesToDrop, (dropTable, i, next, err) => {
            if (i === 0) {
                adapterFilters(this.nSQL, this.query).dropTable(dropTable, () => {
                    delete this.nSQL._tables[dropTable];
                    delete this.nSQL._tableIds[dropTable];
                    this.nSQL._saveTableIds().then(() => {
                        next(dropTable);
                    }).catch(err);
                }, err);
            } else {
                adapterFilters(this.nSQL, this.query).deleteIndex(table, dropTable, next as any, err);
            }
        }).then(() => {
            complete();
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
        const pkCol = this.nSQL._tables[this.query.table as string].pkCol;
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
                    adapterFilters(this.nSQL, this.query).read(this.query.table as string, pkOrRow, (row) => {
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
                case "INCLUDES":
                    let pks: any[] = [];
                    adapterFilters(this.nSQL, this.query).readIndexKey(this.query.table as string, fastWhere.index as string, fastWhere.value, (pk) => {
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
                        adapterFilters(this.nSQL, this.query).readIndexKey(this.query.table as string, fastWhere.index as string, pk, (rowPK) => {
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
                            adapterFilters(this.nSQL, this.query).read(this.query.table as string, fastWhere.value, (row) => {
                                indexBuffer.newItem(row);
                                indexBuffer.finished();
                            }, this.error);
                        } else {
                            adapterFilters(this.nSQL, this.query).readIndexKey(this.query.table as string, fastWhere.index as string, fastWhere.value, (readPK) => {
                                indexBuffer.newItem(readPK);
                            }, () => {
                                indexBuffer.finished();
                            }, this.error);
                        }
                    }
                    break;
                case "BETWEEN":
                    if (isPKquery) {
                        adapterFilters(this.nSQL, this.query).readMulti(this.query.table as string, "range", fastWhere.value[0], fastWhere.value[1], isReversed, (row, i) => {
                            indexBuffer.newItem(row);
                        }, () => {
                            indexBuffer.finished();
                        }, this._onError);
                    } else {
                        adapterFilters(this.nSQL, this.query).readIndexKeys(this.query.table as string, fastWhere.index as string, "range", fastWhere.value[0], fastWhere.value[1], isReversed, (row) => {
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
                        chainAsync(PKS, (pkRead, ii, nextPK) => {
                            if (isPKquery) {
                                adapterFilters(this.nSQL, this.query).read(this.query.table as string, pkRead, (row) => {
                                    indexBuffer.newItem(row);
                                    nextPK();
                                }, this.error);
                            } else {
                                adapterFilters(this.nSQL, this.query).readIndexKey(this.query.table as string, fastWhere.index as string, pkRead, (readPK) => {
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
                    this._resolveFastWhere(true, fastWhere, false, addIndexBuffer, next);
                }).then(() => {

                    let getPKs: any[] = [];
                    Object.keys(indexBuffer).forEach((PK) => {
                        if (indexBuffer[PK] === maxI) {
                            getPKs.push(PK);
                        }
                    });

                    this._resolveFastWhere(false, {
                        index: "_pk_",
                        col: this.nSQL._tables[this.query.table as string].pkCol.join("."),
                        comp: "IN",
                        value: getPKs
                    }, false, onRow, complete);
                });
            }
        }
    }

    public _getRecords(onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

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
                    this._fastQuery(onRow, complete);
                    break;
                // primary key or secondary index followed by slow query
                case IWhereType.medium:
                    this._fastQuery((row, i) => {
                        if (this._where(row, this._whereArgs.slowWhere as any)) {
                            onRow(row, i);
                        }
                    }, complete);
                    break;
                // full table scan
                case IWhereType.slow:
                case IWhereType.none:
                case IWhereType.fn:
                    const isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";

                    adapterFilters(this.nSQL, this.query).readMulti(this.query.table, "all", undefined, undefined, isReversed, (row, i) => {

                        if (this._whereArgs.type === IWhereType.slow) {
                            if (this._where(row, this._whereArgs.slowWhere as any)) {
                                onRow(row, i);
                            }
                        } else if (this._whereArgs.type === IWhereType.fn && this._whereArgs.whereFn) {
                            if (this._whereArgs.whereFn(row, i)) {
                                onRow(row, i);
                            }
                        } else {
                            onRow(row, i);
                        }
                    }, () => {
                        complete();
                    }, this._onError);
                    break;
            }

        } else if (typeof this.query.table === "function") { // promise that returns array
            this._getTable(this.query.tableAS || (this.query.table as any), this.query.where, this.query.table, (result) => {
                scanRecords(result.rows as any);
            });
        } else if (Array.isArray(this.query.table)) { // array
            scanRecords(this.query.table);
        }
    }

    public _rebuildIndexes(progress: (row, i) => void, complete: () => void, error: (err: any) => void) {
        const rebuildTables = this.query.table as string;

        if (!this.nSQL._tables[rebuildTables]) {
            error(new Error(`Table ${rebuildTables} not found for rebuilding indexes!`));
            return;
        }

        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: IWhereType.none };
        
        // .map(r => "_idx_" + this.nSQL.tableIds[rebuildTables] + "_" + r);
        if (this.query.where) { // rebuild only select rows (cant clean/remove index tables)

            const readQueue = new _nanoSQLQueue((item, i, complete, error) => {
                this._removeRowAndIndexes(this.nSQL._tables[rebuildTables], item, () => {
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
            });
        } else { // empty indexes and start from scratch
            const indexes = Object.keys(this.nSQL._tables[rebuildTables].indexes);

            allAsync(indexes, (indexName, j, nextIndex, indexErr) => {
                adapterFilters(this.nSQL, this.query).deleteIndex(rebuildTables, indexName, () => {
                    adapterFilters(this.nSQL, this.query).createIndex(rebuildTables, indexName, this.nSQL._tables[rebuildTables].indexes[indexName].type, () => {
                        nextIndex(null);
                    }, indexErr);
                }, indexErr);
            }).then(() => {

                // indexes are now empty
                const readQueue = new _nanoSQLQueue((row, i, complete, err) => {
                    const indexValues = this._getIndexValues(this.nSQL._tables[rebuildTables].indexes, row);
                    const rowPK = deepGet(this.nSQL._tables[rebuildTables].pkCol, row);
                    allAsync(Object.keys(indexValues), (indexName, jj, nextIdx, errIdx) => {
                        const idxValue = indexValues[indexName];
                        this._updateIndex(rebuildTables, indexName, idxValue, rowPK, true, () => {
                            progress(row, i);
                            nextIdx();
                        }, errIdx);
                    }).then(complete).catch(err);
                }, error, () => {
                    complete();
                });
                this._getRecords((row) => {
                    readQueue.newItem(row);
                }, () => {
                    readQueue.finished();
                });

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

                    if (Array.isArray(wArg[0])) { // nested where
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
            _nanoSQLQuery.likeCache[givenValue] = new RegExp(givenValue.split("").map(s => {
                if (prevChar === "\\") {
                    prevChar = s;
                    return s;
                }
                prevChar = s;
                if (s === "%") return ".*";
                if (s === "_") return ".";
                return s;
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
        if (where.fnString) {
            return execFunction(this.query, where.fnString, wholeRow, { result: undefined }).result;
        } else {
            return deepGet(where.col as string, wholeRow);
        }
    }

    /**
     * Compare function used by WHERE to determine if a given value matches a given condition.
     *
     * Accepts single where arguments (compound arguments not allowed).
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
                this.query.error(`WHERE "${compare}" comparison requires an array value!`);
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


    public static _sortMemoized: {
        [key: string]: InanoSQLSortBy;
    } = {};

    public _parseSort(sort: string[], checkforIndexes: boolean): InanoSQLSortBy {
        const key = sort && sort.length ? hash(JSON.stringify(sort)) : "";
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
            const pkKey: string[] = typeof this.query.table === "string" ? this.nSQL._tables[this.query.table].pkCol : [];
            if (result[0].path[0].length && objectsEqual(result[0].path, pkKey)) {
                index = "_pk_";
            } else {
                const indexKeys = Object.keys(this.nSQL._tables[this.query.table as string].indexes);
                let i = indexKeys.length;
                while (i-- && !index) {
                    if (objectsEqual(this.nSQL._tables[this.query.table as string].indexes[indexKeys[i]], result[0].path)) {
                        index = this.nSQL._tables[this.query.table as string].indexes[indexKeys[i]].id;
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

    public static _selectArgsMemoized: {
        [key: string]: {
            hasAggrFn: boolean;
            args: ISelectArgs[]
        }
    } = {};

    public _hasAggrFn: boolean;

    public _parseSelect() {
        const selectArgsKey = this.query.actionArgs && this.query.actionArgs.length ? JSON.stringify(this.query.actionArgs) : "";

        this._orderBy = this._parseSort(this.query.orderBy || [], typeof this.query.table === "string");
        this._groupBy = this._parseSort(this.query.groupBy || [], false);

        if (selectArgsKey) {
            if (_nanoSQLQuery._selectArgsMemoized[selectArgsKey]) {
                this._hasAggrFn = _nanoSQLQuery._selectArgsMemoized[selectArgsKey].hasAggrFn;
                this._selectArgs = _nanoSQLQuery._selectArgsMemoized[selectArgsKey].args;
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
                            if (this.nSQL.functions[fnName].type === "A") {
                                this._hasAggrFn = true;
                            }
                        }
                    } else {
                        this._selectArgs.push({ isFn: false, value: splitVal[0], as: splitVal[1] });
                    }
                });
                if (this.query.state !== "error") {
                    _nanoSQLQuery._selectArgsMemoized[selectArgsKey] = { hasAggrFn: this._hasAggrFn, args: this._selectArgs };
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

    public static _whereMemoized: {
        [key: string]: IWhereArgs;
    } = {};



    public _parseWhere(qWhere: any[] | ((row: { [key: string]: any }) => boolean), ignoreIndexes?: boolean): IWhereArgs {
        const where = qWhere || [];
        const key = JSON.stringify(where, (key, value) => {
            return value && value.constructor && value.constructor.name === "RegExp" ? value.toString() : value;
        }) + (ignoreIndexes ? "0" : "1");

        if (_nanoSQLQuery._whereMemoized[key]) {
            return _nanoSQLQuery._whereMemoized[key];
        }

        if (typeof where === "function") {
            return { type: IWhereType.fn, whereFn: where };
        } else if (!where.length) {
            _nanoSQLQuery._whereMemoized[key] = { type: IWhereType.none };
            return _nanoSQLQuery._whereMemoized[key];
        }

        const indexes: InanoSQLIndex[] = typeof this.query.table === "string" ? Object.keys(this.nSQL._tables[this.query.table].indexes).map(k => this.nSQL._tables[this.query.table as string].indexes[k]) : [];
        const pkKey: string[] = typeof this.query.table === "string" ? this.nSQL._tables[this.query.table].pkCol : [];

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
                                parsedFn: {name: fnName, args: fnArgs},
                                comp: w[1],
                                value: w[2]
                            });
                        }

                    } else { // column select

                        let isIndexCol = false;
                        const path = doIndex ? resolvePath(w[0]) : [];

                        if (["=", "BETWEEN", "IN"].indexOf(w[1]) !== -1 && doIndex) {
                            // primary key select
                            if (objectsEqual(path, pkKey)) {
                                isIndexCol = true;
                                this._indexesUsed.push(assign(w));
                                p.push({
                                    index: "_pk_",
                                    col: w[0],
                                    comp: w[1],
                                    value: w[2]
                                });
                            } else { // check if we can use any index
                                indexes.forEach((index) => {
                                    if (isIndexCol === false && objectsEqual(index.path, path) && index.isArray === false) {
                                        isIndexCol = true;
                                        this._indexesUsed.push(assign(w));
                                        p.push({
                                            index: index.id,
                                            col: w[0],
                                            comp: w[1],
                                            value: w[2]
                                        });
                                    }
                                });
                            }
                        }

                        if (doIndex && !isIndexCol && ["INCLUDES", "INTERSECT", "INTERSECT ALL"].indexOf(w[1]) !== -1) {
                            indexes.forEach((index) => {
                                if (objectsEqual(index.path, path) && index.isArray === true) {
                                    isIndexCol = true;
                                    this._indexesUsed.push(assign(w));
                                    p.push({
                                        index: index.id,
                                        indexArray: true,
                                        col: w[0],
                                        comp: w[1],
                                        value: w[2]
                                    });
                                }
                            });
                        }

                        if (!isIndexCol) {
                            p.push({
                                col: w[0],
                                comp: w[1],
                                value: w[2]
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

