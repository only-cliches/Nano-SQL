import { INanoSQLQuery, ISelectArgs, IWhereArgs, IWhereType, INanoSQLIndex, IWhereCondition, INanoSQLSortBy, INanoSQLTableConfig, createTableFilter, INanoSQLDataModel, INanoSQLTableColumn, INanoSQLJoinArgs, INanoSQLQueryExec, INanoSQLInstance, customQueryFilter, IGraphArgs, INanoSQLTable } from "./interfaces";
import { deepGet, chainAsync, objectsEqual, hash, resolvePath, setFast, allAsync, _maybeAssign, _assign, cast, buildQuery, deepSet, NanoSQLBuffer, noop } from "./utilities";

// tslint:disable-next-line
export class _NanoSQLQuery implements INanoSQLQueryExec {

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

    public _orderBy: INanoSQLSortBy;
    public _groupBy: INanoSQLSortBy;
    public upsertPath: string[];
    private _TableCache: {
        [id: number]: any[];
    } = {};
    private _TableCacheLoading: {
        [id: number]: boolean;
    } = {};
    public _graphTableCache: {
        [key: string]: any[];
    } = {};
    private _graphTableCacheLoading: {
        [id: number]: boolean;
    } = {};

    constructor(
        public nSQL: INanoSQLInstance,
        public query: INanoSQLQuery,
        public progress: (row: any, i: number) => void,
        public complete: () => void,
        public error: (err: any) => void
    ) {
        this.query.state = "processing";
        const action = query.action.toLowerCase().trim();
        this._orderByRows = this._orderByRows.bind(this);
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

        const requireAction = (cb: () => void) => {
            if (typeof this.query.table !== "string") {
                this.query.state = "error";
                this.error(`${this.query.action} query requires a string table argument!`);
                return;
            }
            if (!this.query.actionArgs) {
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
            case "drop":
            case "drop table":
                this._dropTable(this.query.table as string, finishQuery, this.error);
                break;
            case "create table":
            case "create table if not exists":
                requireAction(() => {
                    this._createTable(this.query.actionArgs as INanoSQLTableConfig, finishQuery, this.error);
                });
                break;
            case "alter table":
                requireAction(() => {
                    this._alterTable(this.query.actionArgs as INanoSQLTableConfig, finishQuery, this.error);
                });
                break;
            case "rebuild indexes":
                requireAction(() => {
                    this._rebuildIndexes(this.progress, finishQuery, this.error);
                });
                break;
            default:
                this.nSQL.doFilter<customQueryFilter, null>("customQuery", { result: undefined, query: this, onRow: progress, complete: complete, error: error }).then(() => {
                    this.query.state = "error";
                    this.error(`Query type "${query.action}" not supported!`);
                }).catch((err) => {
                    this.query.state = "error";
                    this.error(err);
                });

        }
    }

    public _getTableCache(cacheKey: string, table: any, callback: (joinTable: any) => void) {
        if (typeof table === "function") {
            if (this._TableCache[cacheKey]) {
                if (this._TableCacheLoading[cacheKey]) {
                    setTimeout(() => {
                        this._getTableCache(cacheKey, table, callback);
                    }, 10);
                } else {
                    callback(this._TableCache[cacheKey]);
                }
                return;
            }
            this._TableCacheLoading[cacheKey] = true;
            this._TableCache[cacheKey] = [];
            table().then((rows) => {
                this._TableCache[cacheKey] = rows;
                this._TableCacheLoading[cacheKey] = false;
                callback(rows);
            }).catch((err) => {
                this.query.state = "error";
                this.error(err);
            });
        } else {
            callback(table);
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
    public _maybeJoin(joinData: INanoSQLJoinArgs[], leftRow: any, onRow: (rowData: any) => void, complete: () => void): void {

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

            const joinBuffer = new NanoSQLBuffer((rData, i, rDone, err) => {

                if (!joinData[joinIdx + 1]) { // no more joins, send joined row
                    onRow(rData);
                    rDone();
                } else { // more joins, nest on!
                    doJoin(rData, joinIdx + 1, rDone);
                }
            }, this.error, joinDone);


            const withPK = typeof join.with.table === "string" ? this.nSQL.tables[join.with.table].pkCol : "";
            const rightTable = String(join.with.as || join.with.table);
            const leftTable = String(this.query.tableAS || this.query.table);

            this._getTableCache(String("J-" + joinIdx), join.with.table, (joinTable) => {

                const queryTable = this.query.tableAS || this.query.table as string;

                this.nSQL.triggerQuery({
                    ...buildQuery(joinTable, "select"),
                    tableAS: join.with.as,
                    where: join.on && join.type !== "cross" ? this._buildCombineWhere(join.on, join.with.as || join.with.table as string, queryTable, rowData) : undefined,
                    skipQueue: true
                }, (row) => {
                    joinRowCount++;
                    if (join.type === "right" || join.type === "outer") {
                        // keep track of which right side rows have been joined
                        rightHashes.push(withPK ? row[withPK] : hash(JSON.stringify(row)));
                    }
                    joinBuffer.newItem({
                        ...rowData,
                        [rightTable]: row
                    });
                }, () => {

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
                                ...buildQuery(join.with.table, "select"),
                                skipQueue: true,
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

                }, (err) => {
                    this.query.state = "error";
                    this.error(err);
                });
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
                            const newRow = this._streamAS(row);
                            const keep = this.query.having ? this._where(newRow, this._havingArgs.slowWhere as any[]) : true;
                            return keep ? newRow : undefined;
                        }).filter(f => f));
                    } else {
                        rows.forEach((row, i) => {
                            const newRow = this._streamAS(row);
                            const keep = this.query.having ? this._where(newRow, this._havingArgs.slowWhere as any[]) : true;
                            if (!keep) {
                                return;
                            }
                            if (doRange) {
                                if (count >= range[0] && count < range[1]) {
                                    this.progress(this._streamAS(row), count);
                                }
                            } else {
                                this.progress(this._streamAS(row), count);
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
                complete();
            });
            return;
        }

        const joinData: INanoSQLJoinArgs[] = Array.isArray(this.query.join) ? this.query.join : [this.query.join as any];

        let joinedRows = 0;

        const graphBuffer = new NanoSQLBuffer((gRow, ct, nextGraph, err) => {
            let keepRow = true;
            if (this.query.having) {
                keepRow = this._where(this._streamAS(gRow), this._havingArgs.slowWhere as any[]);
            }
            
            if (keepRow) {
                if (this.query.graph) {
                    
                    this._graph(this.query.graph || [], this.query.tableAS || this.query.table as string, gRow, rowCounter, (graphRow, j) => {
                        this.progress(this._streamAS(graphRow), j);
                        rowCounter++;
                        nextGraph();
                    }, 0);
                } else {
                    this.progress(this._streamAS(gRow), rowCounter);
                    rowCounter++;
                    nextGraph();
                }
            } else {
                nextGraph();
            }
        }, this._onError, () => {
            complete();
        });

        let rowCounter = 0;
        const selectBuffer = new NanoSQLBuffer((row, ct, next, err) => {
            row = _maybeAssign(row);
            
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
                this._graph(this.query.graph || [],this.query.tableAS || this.query.table as string, row, i, next, 0);
            }).then((newBuffer) => {
                this._queryBuffer = newBuffer;
                // Group by, functions and AS
                this._groupByRows();

                if (this.query.having) { // having
                    this._queryBuffer = this._queryBuffer.filter(row => {
                        return this._where(row, this._havingArgs.slowWhere as any[]);
                    });
                }

                if (this.query.orderBy) { // order by
                    this._queryBuffer.sort(this._orderByRows);
                }

                if (doRange) { // limit / offset
                    this._queryBuffer = this._queryBuffer.slice(range[0], range[1]);
                }

                this._queryBuffer.forEach((row, i) => {
                    this.progress(row, range[0] + i);
                });
                complete();
            });
        });

        const tableIsString = typeof this.query.table === "string";
        // query path start
        this._getRecords((row, i) => { // SELECT rows
            selectBuffer.newItem(row);
            if (tableIsString) {
                this.nSQL.triggerEvent({
                    target: this.query.table as string,
                    path: "_all_",
                    events: ["select", "*"],
                    time: Date.now(),
                    result: row,
                    query: this.query
                });
            }
        }, () => {
            selectBuffer.finished();
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

            const groupByKey = this._groupBy.sort.map(k => String(deepGet(k.path, val))).join(".");

            if (this._sortGroupKeys[groupByKey] === undefined) {
                this._sortGroupKeys[groupByKey] = this._sortGroups.length;
            }

            const key = this._sortGroupKeys[groupByKey];

            if (!this._sortGroups[key]) {
                this._sortGroups.push([]);
            }

            this._sortGroups[key].push(val);
        });

        this._queryBuffer = [];
        if (this._hasAggrFn) {
            // loop through the groups
            this._sortGroups.forEach((group) => {
                // find aggregate functions
                let resultFns: { aggr: any, args: string[], name: string, idx: number }[] = this._selectArgs.reduce((p, c, i) => {
                    if (this.nSQL.functions[c.value] && this.nSQL.functions[c.value].type === "A") {
                        p[i] = {
                            idx: i,
                            name: c.value,
                            aggr: _assign(this.nSQL.functions[c.value].aggregateStart),
                            args: c.args
                        };
                    }
                    return p;
                }, [] as any[]);

                let firstFn = resultFns.filter(f => f)[0];

                // calculate aggregate functions
                group.forEach((row, i) => {
                    resultFns.forEach((fn, i) => {
                        if (!fn) return;
                        resultFns[i].aggr = this.nSQL.functions[fn.name].call(this.query, row, resultFns[i].aggr, ...resultFns[i].args);
                    });
                });

                // calculate simple functions and AS back into buffer
                this._queryBuffer.push(this._selectArgs.reduce((prev, cur, i) => {
                    const col = cur.isFn ? `${cur.value}(${(cur.args || []).join(", ")})` : cur.value;
                    prev[cur.as || col] = cur.isFn && resultFns[i] ? resultFns[i].aggr.result : (cur.isFn ? this.nSQL.functions[cur.value].call(this.query, resultFns[firstFn.idx].aggr.row, {} as any, ...(cur.args || [])) : deepGet(cur.value, resultFns[firstFn.idx].aggr.row));
                    return prev;
                }, {}));

            });
        } else {
            this._sortGroups.forEach((group) => {
                group.forEach((row) => {
                    this._queryBuffer.push(this._streamAS(row));
                });
            });
        }
    }

    public _buildCombineWhere(graphWhere: any, graphTable: string, rowTable: string, rowData: any): any {
        if (typeof graphWhere === "function") {
            return (compareRow) => {
                return graphWhere({
                    [graphTable]: compareRow,
                    ...rowData
                });
            }
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

    public _graph(gArgs: IGraphArgs | IGraphArgs[], topTable: string, row: any, index: number, onRow: (row: any, i: number) => void, level: number) {
        
        const graphArgs = Array.isArray(gArgs) ? gArgs : [gArgs];
        if (!graphArgs || graphArgs.length === 0) {
            onRow(row, index);
            return;
        }

        allAsync(graphArgs, (graph: IGraphArgs, i, next) => {
            const noGraphAs = new Error("Must use 'AS' when graphing temporary tables!");
            row[graph.key] = [];

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

            const graphBuffer = new NanoSQLBuffer((graphRow, i, done, err) => {
                if (graph.graph) { // nested graph
                    this._graph(graph.graph, graph.with.as || graph.with.table as string, graphRow, i, (finishedGraphRow) => {
                        row[graph.key].push(finishedGraphRow);
                        done();
                    }, level + 1);
                } else { // not nested
                    row[graph.key].push(graphRow);
                    done();
                }
            }, this._onError, () => {
                next(null);
            });

            const tableIdx = JSON.stringify([level, i]);

            this._getTableCache(String("G-" + tableIdx), graph.with.table, (graphTable) => {
                this.nSQL.triggerQuery({
                    ...buildQuery(graphTable, "select"),
                    actionArgs: graph.select,
                    where: this._buildCombineWhere(graph.on, graph.with.as || graph.with.table as string, topTable, {[topTable]: row}),
                    limit: graph.limit,
                    offset: graph.offset,
                    orderBy: graph.orderBy,
                    groupBy: graph.groupBy,
                    skipQueue: true
                }, (row) => {
                    graphBuffer.newItem(row);
                }, () => {
                    graphBuffer.finished();
                }, this._onError);
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

        const table = this.nSQL.tables[this.query.table as string];;

        if (this._whereArgs.type === IWhereType.none) { // insert/update records directly
            allAsync(upsertRecords, (row, i, next, error) => {
                if (row[table.pkCol]) {
                    this.nSQL.adapter.read(this.query.table as string, row[table.pkCol], (oldRow) => {
                        if (oldRow) {
                            this._updateRow(row, oldRow, next, error);
                        } else {
                            this._newRow(row, next, error);
                        }
                    }, (err) => {
                        this._newRow(row, next, error);
                    });
                } else {
                    this._newRow(row, next, error);
                }
            }).then(() => {
                onRow({ result: `${upsertRecords.length} row(s) upserted` }, 0);
                complete();
            });
        } else { // find records and update them
            if (upsertRecords.length > 1) {
                this.query.state = "error";
                error("Cannot upsert multiple records with where condition!");
                return;
            }

            let updatedRecords = 0;
            const upsertBuffer = new NanoSQLBuffer((row, i, done, err) => {
                updatedRecords++;
                this._updateRow(upsertRecords[0], row, done, err);
            }, error, () => {
                onRow({ result: `${updatedRecords} row(s) upserted` }, 0);
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
        this.nSQL.doFilter("updateRow", { result: newData, row: oldRow, query: this.query }).then((upsertData) => {

            let finalRow = this.nSQL.default(this.upsertPath ? deepSet(this.upsertPath, _maybeAssign(oldRow), upsertData) : {
                ...oldRow,
                ...upsertData
            }, this.query.table as string);

            if (typeof this.query.table === "string") {
                this.nSQL.triggerEvent({
                    target: this.query.table as string,
                    path: "*",
                    events: ["upsert", "change", "*"],
                    time: Date.now(),
                    result: finalRow,
                    oldRow: oldRow,
                    query: this.query
                });
                Object.keys(this.nSQL.eventFNs[this.query.table as string]).forEach((path) => {
                    if (path !== "*") {
                        if (!objectsEqual(deepGet(path, oldRow), deepGet(path, finalRow))) {
                            this.nSQL.triggerEvent({
                                target: this.query.table as string,
                                path: path,
                                events: ["upsert", "change", "*"],
                                time: Date.now(),
                                result: finalRow,
                                oldRow: oldRow,
                                query: this.query
                            }, true);
                        }
                    }
                });
            }


            const newIndexValues = this._getIndexValues(this.nSQL.tables[this.query.table as any].indexes, finalRow);
            const oldIndexValues = this._getIndexValues(this.nSQL.tables[this.query.table as any].indexes, oldRow);
            const table = this.nSQL.tables[this.query.table as string];

            allAsync(Object.keys(oldIndexValues).concat(["__pk__"]), (indexName: string, i, next, err) => {
                if (indexName === "__pk__") { // main row
                    this.nSQL.adapter.write(this.query.table as string, finalRow[table.pkCol], finalRow, (pk) => {
                        finalRow[table.pkCol] = pk;
                        next(null);
                    }, err);
                } else { // indexes
                    const idxTable = "_idx_" + this.query.table + "_" + indexName;
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
                                    this._updateIndex(idxTable, value, finalRow[table.pkCol], j === 0, () => {
                                        nextArr(null);
                                    }, err);
                                }).then(nextValues);
                            }).then(next);
                        } else {
                            allAsync(["rm", "add"], (job, i, nextJob) => {
                                switch (job) {
                                    case "add": // add new index value
                                        this._updateIndex(idxTable, newIndexValues[indexName], finalRow[table.pkCol], true, () => {
                                            nextJob(null);
                                        }, err);
                                        break;
                                    case "rm": // remove old index value
                                        this._updateIndex(idxTable, oldIndexValues[indexName], finalRow[table.pkCol], false, () => {
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
            }).then(() => {
                this.nSQL.doFilter("updatedRow", { newRow: finalRow, oldRow: oldRow, query: this.query }).then(() => {
                    complete(finalRow);
                });
            });
        }).catch(error);
    }

    private _updateIndex(indexTable: string, value: any, pk: any, addToIndex: boolean, done: () => void, err: (error) => void) {
        const blankIndex = (id: any) => ({ id: id, pks: [] });

        this.nSQL.adapter.read(indexTable, value, (idxRow) => {
            const idxRowSet = _maybeAssign(idxRow || blankIndex(value));
            const position = idxRowSet.pks.indexOf(pk);
            if (addToIndex) {
                if (position === -1) {
                    idxRowSet.pks.push(pk);
                }
            } else {
                if (position === -1) {
                    done();
                    return
                }
                idxRowSet.pks.splice(position, 1);
            }
            this.nSQL.adapter.write(indexTable, value, idxRowSet, done, err);
        }, err);
    }

    public _newRow(newRow: any, complete: (row: any) => void, error: (err: any) => void) {

        this.nSQL.doFilter("addRow", { result: newRow, query: this.query }).then((rowToAdd) => {

            const table = this.nSQL.tables[this.query.table as string];

            rowToAdd = this.nSQL.default(_maybeAssign(this.upsertPath ? deepSet(this.upsertPath, {}, rowToAdd) : rowToAdd), this.query.table as string);
            const indexValues = this._getIndexValues(this.nSQL.tables[this.query.table as any].indexes, rowToAdd);

            this.nSQL.adapter.write(this.query.table as string, rowToAdd[table.pkCol], rowToAdd, (pk) => {
                rowToAdd[table.pkCol] = pk;
                allAsync(Object.keys(indexValues), (indexName: string, i, next, err) => {
                    const idxTable = "_idx_" + this.query.table + "_" + indexName;
                    if (table.indexes[indexName].isArray) {
                        const arrayOfValues = indexValues[indexName] || [];
                        allAsync(arrayOfValues, (value, i, nextArr) => {
                            this._updateIndex(idxTable, value, rowToAdd[table.pkCol], true, () => {
                                next(null);
                            }, err);
                        }).then(next);
                    } else {
                        this._updateIndex(idxTable, indexValues[indexName], rowToAdd[table.pkCol], true, () => {
                            next(null);
                        }, err);
                    }
                }).then(() => {
                    this.nSQL.doFilter("updatedRow", { newRow: rowToAdd, query: this.query }).then(() => {
                        complete(rowToAdd);
                    })
                });
            }, error);

        }).catch(error);
    }

    public _delete(onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) {
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: IWhereType.none };
        if (this.query.state === "error") return;

        let delRows: number = 0;

        const table = this.nSQL.tables[this.query.table as string];
        const deleteBuffer = new NanoSQLBuffer((row, i, done, err) => {
            delRows++;
            this.nSQL.doFilter("deleteRow", { result: row, query: this.query }).then((delRow) => {

                const indexValues = this._getIndexValues(table.indexes, row);

                if (typeof this.query.table === "string") {
                    this.nSQL.triggerEvent({
                        target: this.query.table as string,
                        path: "_all_",
                        events: ["change", "delete", "*"],
                        time: Date.now(),
                        result: row,
                        query: this.query
                    });
                }

                allAsync(Object.keys(indexValues).concat(["__del__"]), (indexName: string, i, next) => {
                    if (indexName === "__del__") { // main row
                        this.nSQL.adapter.delete(this.query.table as string, delRow[table.pkCol], () => {
                            next(null);
                        }, (err) => {
                            this.query.state = "error";
                            error(err);
                        });
                    } else { // secondary indexes
                        const idxTable = "_idx_" + this.query.table + "_" + indexName;

                        if (table.indexes[indexName].isArray) {
                            const arrayOfValues = indexValues[indexName] || [];
                            allAsync(arrayOfValues, (value, i, nextArr) => {
                                this._updateIndex(idxTable, value, row[table.pkCol], false, () => {
                                    nextArr(null);
                                }, error);
                            }).then(next);
                        } else {
                            this._updateIndex(idxTable, indexValues[indexName], row[table.pkCol], false, () => {
                                next(null);
                            }, (err) => {
                                this.query.state = "error";
                                error(err);
                            });
                        }
                    }
                }).then(done).catch(err);
            }).catch(err);
        }, error, () => {
            onRow({ result: `${delRows} row(s) deleted` }, 0);
            complete();
        });


        this._getRecords((row, i) => {
            deleteBuffer.newItem(row);
        }, () => {
            deleteBuffer.finished();
        });

    }

    public _getIndexValues(indexes: { [name: string]: INanoSQLIndex }, row: any): { [indexName: string]: any } {
        return Object.keys(indexes).reduce((prev, cur) => {
            const value = deepGet(indexes[cur].path, row);
            const type = indexes[cur].type;
            prev[cur] = indexes[cur].isArray ? (Array.isArray(value) ? value : []).map(v => this.nSQL.indexTypes[type](v)) : this.nSQL.indexTypes[type](value);
            return prev;
        }, {});
    }


    public _showTables() {
        this.progress({
            tables: Object.keys(this.nSQL.tables)
        }, 0);
        this.complete();
    }

    public _describe() {
        if (typeof this.query.table !== "string") {
            this.query.state = "error";
            this.error("Can't call describe on that!");
            return;
        }
        if (!this.nSQL.tables[this.query.table]) {
            this.query.state = "error";
            this.error(`Table ${this.query.table} not found!`);
            return;
        }
        this.progress({
            describe: _assign(this.nSQL.tables[this.query.table].columns)
        }, 0);
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
    };

    public _streamAS(row: any): any {
        if (this._selectArgs.length) {
            let result = {};
            this._selectArgs.forEach((arg) => {
                if (arg.isFn) {
                    if (!this.nSQL.functions[arg.value]) {
                        this.query.state = "error";
                        this.error(`Function ${arg.value} not found!`);
                        return;
                    }
                    result[arg.as || arg.value] = this.nSQL.functions[arg.value].call(this.query, row, {} as any, ...(arg.args || [])).result;
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
     * @param NanoSQLSortBy columns
     * @param {boolean} resolvePaths
     * @returns {number}
     * @memberof _MutateSelection
     */
    public _sortObj(objA: any, objB: any, columns: INanoSQLSortBy): number {
        return columns.sort.reduce((prev, cur) => {
            let A = deepGet(cur.path, objA);
            let B = deepGet(cur.path, objB);
            if (!prev) {
                if (A === B) return 0;
                return (A > B ? 1 : -1) * (cur.dir === "DESC" ? -1 : 1);
            } else {
                return prev;
            }
        }, 0);
    }

    public _createTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void {
        new Promise((res, rej) => {
            let hasError = false;

            const l = table.name;
            if (!table._internal && (l.indexOf("_") === 0 || l.match(/\s/g) !== null || l.match(/[\(\)\]\[\.]/g) !== null)) {
                rej(`nSQL: Invalid Table Name ${table.name}! https://docs.nanosql.io/setup/data-models`);
                return;
            }

            table.model.forEach((model) => {
                const modelData = model.key.split(":"); // [key, type];
                if (modelData.length === 1) {
                    modelData.push("any");
                }
                if (!modelData[0] || modelData[0].match(/[\(\)\]\[\.]/g) !== null || modelData[0].indexOf("_") === 0) {
                    hasError = true;
                    rej(`nSQL: Invalid Data Model at ${table.name}, ${JSON.stringify(model)}! https://docs.nanosql.io/setup/data-models`);
                }
            });
            // replace white space in column names with dashes
            table.model = table.model.map(k => ({
                ...k,
                key: k.key.replace(/\s+/g, "-")
            }));


            if (hasError) return;
            res();
        }).then(() => {
            return this.nSQL.doFilter<createTableFilter, INanoSQLTableConfig>("createTable", { result: table, query: this.query });
        }).then((table: INanoSQLTableConfig) => {

            return new Promise((res, rej) => {

                const setModels = (dataModels: INanoSQLDataModel[]): INanoSQLDataModel[] => {
                    return dataModels.map(d => {
                        const type = d.key.split(":")[1] || "any";
                        if (type.indexOf("geo") === 0) {
                            d.model = [
                                { key: "lat:float", default: 0 },
                                { key: "lon:float", default: 0 }
                            ];
                        }
                        if (d.model) {
                            d.model = setModels(d.model);
                        }
                        return d;
                    });
                };

                const generateColumns = (dataModels: INanoSQLDataModel[]): INanoSQLTableColumn[] => {
                    return dataModels.filter(d => d.key !== "*").map(d => ({
                        key: d.key.split(":")[0],
                        type: d.key.split(":")[1] || "any",
                        default: d.default || null,
                        notNull: d.props && d.props.indexOf("not_null()") !== -1 ? true : false,
                        model: d.model ? generateColumns(d.model) : undefined
                    }));
                };

                let hasError = false;
                const computedDataModel = setModels(table.model);

                let newConfigs: {[table: string]: INanoSQLTable} = {};

                const pkType = table.model.reduce((p, c) => {
                    if (c.props && c.props.indexOf("pk()") !== -1) return c.key.split(":")[1];
                    return p;
                }, "");

                newConfigs[table.name] = {
                    model: computedDataModel,
                    columns: generateColumns(computedDataModel),
                    actions: table.actions || [],
                    views: table.views || [],
                    indexes: (table.indexes || []).map(i => ({
                        name: i.name.replace(/\W/g, '').replace(/\s+/g, "-").toLowerCase(),
                        type: (i.key.split(":")[1] || "string").replace(/\[\]/gmi, ""),
                        isArray: (i.key.split(":")[1] || "string").indexOf("[]") !== -1,
                        path: resolvePath(i.key.split(":")[0])
                    })).reduce((p, c) => {
                        const allowedTypes = Object.keys(this.nSQL.indexTypes);
                        if (allowedTypes.indexOf(c.type) === -1) {
                            hasError = true;
                            rej(`Index "${c.name}" does not have a valid type!`);
                            return p;
                        }

                        if (c.type.indexOf("geo") !== -1) {
                            p[c.name + "-lat"] = { name: c.name + "-lat", type: "float", path: c.path.concat(["lat"]) };
                            p[c.name + "-lon"] = { name: c.name + "-lon", type: "float", path: c.path.concat(["lon"]) };
                        } else {
                            p[c.name] = c;
                        }
                        return p;
                    }, {}),
                    pkType: pkType,
                    pkCol: table.model.reduce((p, c) => {
                        if (c.props && c.props.indexOf("pk()") !== -1) return c.key.split(":")[0];
                        return p;
                    }, ""),
                    isPkNum: ["number", "int", "float"].indexOf(pkType) !== -1,
                    ai: table.model.reduce((p, c) => {
                        if (c.props && c.props.indexOf("pk()") !== -1 && c.props.indexOf("ai()") !== -1) return true;
                        return p;
                    }, false)
                };

                // no primary key found, set one
                if (newConfigs[table.name].pkCol === "") {
                    newConfigs[table.name].pkCol = "_id_";
                    newConfigs[table.name].pkType = "uuid";
                    newConfigs[table.name].model.unshift({ key: "_id_:uuid", props: ["pk()"] });
                    newConfigs[table.name].columns = generateColumns(newConfigs[table.name].model);
                }

                if (hasError) return;

                let addTables = [table.name];
                Object.keys(newConfigs[table.name].indexes).forEach((k, i) => {
                    const index = newConfigs[table.name].indexes[k];
                    const indexName = "_idx_" + table.name + "_" + index.name;
                    addTables.push(indexName);
                    newConfigs[indexName] = {
                        model: [
                            { key: `id:${index.type || "string"}`, props: ["pk()"] },
                            { key: `pks:${newConfigs[table.name].pkType}[]` }
                        ],
                        columns: [
                            { key: "id", type: index.type || "string" },
                            { key: "pks", type: `${newConfigs[table.name].pkType}[]` }
                        ],
                        actions: [],
                        views: [],
                        indexes: {},
                        isPkNum: ["number", "int", "float"].indexOf(index.type || "string") !== -1,
                        pkType: index.type,
                        pkCol: "id",
                        ai: false
                    };
                });

                allAsync(addTables, (table, i, next, err) => {
                    this.nSQL.adapter.createAndInitTable(table, this.nSQL.tables[table], next as any, err);
                }).then(() => {
                    Object.keys(newConfigs).forEach((tableName) => {
                        this.nSQL.tables[tableName] = newConfigs[tableName];
                    })
                    res();
                }).catch(rej);
            }).then(complete).catch(error);
        });

    }

    public _alterTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void {
        this.nSQL.doFilter("alterTable", { result: table, query: this.query }).then((alteredTable: INanoSQLTableConfig) => {
            let tablesToAlter = [alteredTable.name];
            Object.keys(this.nSQL.tables[table.name].indexes).forEach((indexName) => {
                tablesToAlter.push("_idx_" + alteredTable.name + "_" + indexName);
            });

            allAsync(tablesToAlter, (dropTable, i, next, err) => {
                this.nSQL.adapter.disconnectTable(alteredTable.name, next as any, err);
            }).then(() => {
                this._createTable(alteredTable, complete, error);
            }).catch(error);

        }).catch(error);
    }

    public _dropTable(table: string, complete: () => void, error: (err: any) => void): void {
        this.nSQL.doFilter("destroyTable", { result: table, query: this.query }).then((destroyTable: string) => {
            let tablesToDrop = [destroyTable];
            tablesToDrop.forEach((table) => {
                Object.keys(this.nSQL.tables[table].indexes).forEach((indexName) => {
                    tablesToDrop.push("_idx_" + table + "_" + indexName);
                });
            });

            allAsync(tablesToDrop, (dropTable, i, next, err) => {
                this.nSQL.adapter.dropTable(dropTable, () => {
                    delete this.nSQL.tables[dropTable];
                    next(dropTable);
                }, err);
            }).then(complete).catch(error);
        });
    }

    public _onError(err: any) {
        this.query.state = "error";
        this.error(err);
    }

    public _resolveFastWhere(onlyGetPKs: any, fastWhere: IWhereCondition, isReversed: boolean, onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

        // function
        if (fastWhere.index && fastWhere.fnName) {
            (this.nSQL.functions[fastWhere.fnName].queryIndex as any)(this.nSQL, this, fastWhere, onlyGetPKs, onRow, complete, this._onError);
            return;
        }

        // primary key or secondary index
        const isPKquery = fastWhere.index === "_pk_";
        const pkCol = this.nSQL.tables[this.query.table as string].pkCol;
        const indexTable = `_idx_${this.query.table as string}_${fastWhere.index}`;

        let results = 0;
        let count = 0;
        let isComplete = false;
        const maybeComplete = () => {
            if (isComplete && results === 0) {
                complete();
            }
        }

        const onIndexRow = (row, finished) => {
            if (!row) {
                finished();
                return;
            }
            if (isPKquery) { // primary key select
                onRow(onlyGetPKs ? row[pkCol] : row, 0);
                finished();
            } else { // secondary index
                if (onlyGetPKs) {
                    (row.pks || []).forEach((pk, i) => {
                        onRow(pk, count);
                        count++;
                    });
                    finished();
                } else {
                    allAsync(row.pks, (pk, j, next) => {
                        this.nSQL.adapter.read(this.query.table as string, pk, (row) => {
                            if (row) {
                                onRow(row, count);
                                count++;
                            }
                            next(null);
                        }, this.error);
                    }).then(finished);
                }
            }
        }

        if (fastWhere.indexArray) {
            // Primary keys cannot be array indexes

            switch (fastWhere.comp) {
                case "INCLUDES":
                    this.nSQL.adapter.read(indexTable, fastWhere.value, (row) => {
                        onIndexRow(row, complete);
                    }, this.error);
                    break;
                case "INTERSECT ALL":
                case "INTERSECT":
                    let PKS: { [key: string]: number } = {};
                    let maxI = 0;
                    allAsync((fastWhere.value as any || []), (pk, j, next) => {
                        this.nSQL.adapter.read(indexTable, pk, (row) => {
                            maxI = j + 1;
                            if (row) {
                                (row.pks || []).forEach((rowPK) => {
                                    PKS[rowPK] = (PKS[rowPK] || 0) + 1;
                                });
                            }
                            next(null);
                        }, this.error);
                    }).then(() => {
                        onIndexRow({
                            pks: fastWhere.comp === "INTERSECT" ? Object.keys(PKS) : Object.keys(PKS).filter(k => PKS[k] === maxI)
                        }, complete);
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
                        this.nSQL.adapter.read(isPKquery ? this.query.table as string : indexTable, fastWhere.value, (row) => {
                            onIndexRow(row, complete);
                        }, this.error);
                    }
                    break;
                case "BETWEEN":
                    this.nSQL.adapter.readMulti(isPKquery ? this.query.table as string : indexTable, "range", fastWhere.value[0], fastWhere.value[1], isReversed, (row, i) => {
                        results++;
                        onIndexRow(row, () => {
                            results--;
                            maybeComplete();
                        });
                    }, () => {
                        isComplete = true;
                        maybeComplete();
                    }, this._onError);
                    break;
                case "IN":

                    const PKS = (isReversed ? (fastWhere.value as any[]).sort((a, b) => a < b ? 1 : -1) : (fastWhere.value as any[]).sort((a, b) => a > b ? 1 : -1));
                    if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                        PKS.forEach((pk, i) => onRow(pk, i));
                        complete();
                    } else {
                        allAsync(PKS, (pkRead, ii, nextPK) => {
                            this.nSQL.adapter.read(isPKquery ? this.query.table as string : indexTable, pkRead, (row) => {
                                results++;
                                onIndexRow(row, () => {
                                    results--;
                                    maybeComplete();
                                    nextPK(null);
                                });
                            }, this.error);
                        }).then(() => {
                            isComplete = true;
                            maybeComplete();
                        })
                    }

            }
        }

    }

    public _fastQuery(onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

        if (this._whereArgs.fastWhere) {
            if (this._whereArgs.fastWhere.length === 1) { // single where

                const fastWhere = this._whereArgs.fastWhere[0] as IWhereCondition;
                const isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";

                this._resolveFastWhere(false, fastWhere, isReversed, onRow, complete);
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
                        col: this.nSQL.tables[this.query.table as string].pkCol,
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

            while (i < rows.length - 1) {
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
                    this.nSQL.adapter.readMulti(this.query.table, "all", undefined, undefined, isReversed, (row, i) => {

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
                    }, complete, (err) => {
                        this.query.state = "error";
                        this.error(err);
                    });
                    break;
            }

        } else if (typeof this.query.table === "function") { // promise that returns array
            this.query.table().then(scanRecords).catch((err) => {
                this.error(err);
            });
        } else if (Array.isArray(this.query.table)) { // array
            scanRecords(this.query.table);
        }
    }

    public _rebuildIndexes(progress: (row, i) => void, complete: () => void, error: (err: any) => void) {
        const rebuildTables = this.query.actionArgs ? (Array.isArray(this.query.actionArgs) ? this.query.actionArgs : [this.query.actionArgs]) : [this.query.table];
        if (rebuildTables.filter(s => typeof s !== "string").length > 0) {
            this.query.state = "error";
            error("No valid table found to rebuild indexes!");
            return;
        }
        
        allAsync(rebuildTables, (table, i, nextTable, err) => {
            if (!this.nSQL.tables[table]) {
                err(new Error(`Table ${table} not found for rebuilding indexes!`));
                return;
            }
            const indexes = Object.keys(this.nSQL.tables[table].indexes).map(r => "_idx_" + table + "_" + r);
            allAsync(indexes, (indexTable, j, nextIndex, indexErr) => {
                this.nSQL.adapter.dropTable(indexTable, () => {
                    this.nSQL.adapter.createAndInitTable(indexTable, this.nSQL.tables[indexTable], () => {
                        nextIndex(null);
                    }, indexErr);
                }, indexErr);
            }).then(() => {
                // indexes are now empty

                const readBuffer = new NanoSQLBuffer((row, i, complete, err) => {
                    this._newRow(row, (finishedRow) => {
                        progress({ table: table, row: finishedRow }, i);
                        complete();
                    }, err);
                }, error, () => {
                    nextTable(null);
                });
                this.nSQL.adapter.readMulti(table, "all", undefined, undefined, false, (row, i) => {
                    readBuffer.newItem(row);
                }, () => {
                    readBuffer.finished();
                }, err);
            }).catch(err);
        }).then(complete).catch(error);
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
        if (!_NanoSQLQuery.likeCache[givenValue]) {
            let prevChar = "";
            _NanoSQLQuery.likeCache[givenValue] = new RegExp(givenValue.split("").map(s => {
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
                return String(columnValue).match(_NanoSQLQuery.likeCache[givenValue]) !== null;
            } else {
                return JSON.stringify(columnValue).match(_NanoSQLQuery.likeCache[givenValue]) !== null;
            }
        }
        return columnValue.match(_NanoSQLQuery.likeCache[givenValue]) !== null;
    }

    public _getColValue(where: IWhereCondition, wholeRow: any): any {
        if (where.fnName) {
            return this.nSQL.functions[where.fnName].call(this.query, wholeRow, this.nSQL.functions[where.fnName].aggregateStart || { result: undefined }, ...(where.fnArgs || []));
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
            case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] > columnValue;
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
        [key: string]: INanoSQLSortBy;
    } = {};

    public _parseSort(sort: string[], checkforIndexes: boolean): INanoSQLSortBy {
        const key = sort && sort.length ? hash(JSON.stringify(sort)) : "";
        if (!key) return { sort: [], index: "" };
        if (_NanoSQLQuery._sortMemoized[key]) return _NanoSQLQuery._sortMemoized[key];

        const result: { path: string[], dir: string }[] = sort.map(o => o.split(" ").map(s => s.trim())).reduce((p, c) => { return p.push({ path: resolvePath(c[0]), dir: (c[1] || "asc").toUpperCase() }), p; }, [] as any[]);

        let index = "";
        if (checkforIndexes && result.length === 1) {
            const pkKey: string = typeof this.query.table === "string" ? this.nSQL.tables[this.query.table].pkCol : "";
            if (result[0].path[0].length && result[0].path[0] === pkKey) {
                index = "_pk_";
            } else {
                const indexKeys = Object.keys(this.nSQL.tables[this.query.table as string].indexes);
                let i = indexKeys.length;
                while (i-- && !index) {
                    if (objectsEqual(this.nSQL.tables[this.query.table as string].indexes[indexKeys[i]], result[0].path)) {
                        index = this.nSQL.tables[this.query.table as string].indexes[indexKeys[i]].name;
                    }
                }
            }
        }
        _NanoSQLQuery._sortMemoized[key] = {
            sort: result,
            index: index
        };
        return _NanoSQLQuery._sortMemoized[key];
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
            if (_NanoSQLQuery._selectArgsMemoized[selectArgsKey]) {
                this._hasAggrFn = _NanoSQLQuery._selectArgsMemoized[selectArgsKey].hasAggrFn;
                this._selectArgs = _NanoSQLQuery._selectArgsMemoized[selectArgsKey].args;
            } else {
                (this.query.actionArgs || []).forEach((val: string) => {
                    const splitVal = val.split(/\s+as\s+/i).map(s => s.trim());
                    if (splitVal[0].indexOf("(") !== -1) {
                        const fnArgs = splitVal[0].split("(")[1].replace(")", "").split(",").map(v => v.trim());
                        const fnName = splitVal[0].split("(")[0].trim().toUpperCase();
                        this._selectArgs.push({ isFn: true, value: fnName, as: splitVal[1], args: fnArgs });
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
                    _NanoSQLQuery._selectArgsMemoized[selectArgsKey] = { hasAggrFn: this._hasAggrFn, args: this._selectArgs };
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
        const key = JSON.stringify(where) + (ignoreIndexes ? "0" : "1");

        if (_NanoSQLQuery._whereMemoized[key]) {
            return _NanoSQLQuery._whereMemoized[key];
        }

        if (typeof where === "function") {
            return { type: IWhereType.fn, whereFn: where };
        } else if (!where.length) {
            _NanoSQLQuery._whereMemoized[key] = { type: IWhereType.none };
            return _NanoSQLQuery._whereMemoized[key];
        }

        const indexes: INanoSQLIndex[] = typeof this.query.table === "string" ? Object.keys(this.nSQL.tables[this.query.table].indexes).map(k => this.nSQL.tables[this.query.table as string].indexes[k]) : [];
        const pkKey: string = typeof this.query.table === "string" ? this.nSQL.tables[this.query.table].pkCol : "";

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
                        if (doIndex && this.nSQL.functions[fnName] && this.nSQL.functions[fnName].whereIndex) {
                            const indexFn = (this.nSQL.functions[fnName].whereIndex as any)(this.nSQL, this.query, fnArgs, w);
                            if (indexFn) {
                                hasIndex = true;
                                p.push(indexFn);
                            }
                        }

                        if (!hasIndex) {
                            p.push({
                                fnName: fnName,
                                fnArgs: fnArgs,
                                comp: w[1],
                                value: w[2]
                            });
                        }

                    } else { // column select
                        let isIndexCol = false;
                        const path = doIndex ? resolvePath(w[0]) : [];

                        if (["=", "BETWEEN", "IN"].indexOf(w[1]) !== -1 && doIndex) {
                            // primary key select
                            if (w[0] === pkKey) {
                                isIndexCol = true;
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
                                        p.push({
                                            index: index.name,
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
                                    p.push({
                                        index: index.name,
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
                        return p;
                    }
                }
            }, [] as any[]);
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
            _NanoSQLQuery._whereMemoized[key] = {
                type: slowWhere.length ? IWhereType.medium : IWhereType.fast,
                slowWhere: slowWhere,
                fastWhere: parsedWhere.slice(0, lastFastIndx)
            };
        } else {
            _NanoSQLQuery._whereMemoized[key] = {
                type: IWhereType.slow,
                slowWhere: parsedWhere
            };
        }
        return _NanoSQLQuery._whereMemoized[key];
    }
}