import { INanoSQLQuery, ISelectArgs, IWhereArgs, IWhereType, INanoSQLIndex, IWhereCondition, INanoSQLSortBy, INanoSQLTableConfig, createTableFilter, INanoSQLDataModel, INanoSQLTableColumn, INanoSQLJoinArgs, INanoSQLQueryExec, INanoSQLInstance } from "./interfaces";
import { objQuery, chainAsync, compareObjects, hash, resolveObjPath, setFast, allAsync, _maybeAssign, _assign, cast, buildQuery } from "./utilities";

// tslint:disable-next-line
export class _NanoSQLQuery implements INanoSQLQueryExec {

    public _buffer: any[] = [];
    public _stream: boolean = true;
    public _selectArgs: ISelectArgs[] = [];
    public _whereArgs: IWhereArgs;
    public _havingArgs: IWhereArgs;
    public _pkOrderBy: boolean = false;
    public _idxOrderBy: boolean = false;
    public _sortGroups: {
        [groupKey: string]: any[];
    } = {};
    public _groupByColumns: string[];

    public _orderBy: INanoSQLSortBy;
    public _groupBy: INanoSQLSortBy;

    constructor(
        public nSQL: INanoSQLInstance,
        public query: INanoSQLQuery,
        public progress: (row: any, i: number) => void,
        public complete: () => void,
        public error: (err: any) => void
    ) {
        this.query.state = "processing";
        const action = query.action.toLowerCase().trim();
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
                this._upsert(this.progress, this.complete);
                break;
            case "delete":
                this._delete(this.progress, this.complete);
                break;
            case "show tables":
                this._showTables();
                break;
            case "describe":
                this._describe();
                break;
            case "drop":
            case "drop table":
                this.dropTable(this.query.table as string, finishQuery, this.error);
                break;
            case "create table":
            case "create table if not exists":
                requireAction(() => {
                    this.createTable(this.query.actionArgs as INanoSQLTableConfig, finishQuery, this.error);
                });
                break;
            case "alter table":
                requireAction(() => {
                    this.alterTable(this.query.actionArgs as INanoSQLTableConfig, finishQuery, this.error);
                });
                break;
            case "create relation":
                requireAction(() => {
                    this._registerRelation(this.query.table as string, this.query.actionArgs as any, finishQuery, this.error);
                });
                break;
            case "drop relation":
                this._destroyRelation(this.query.table as string, finishQuery, this.error);
                break;
            case "rebuild index":
                this._rebuildIndexes(this.query.table as string, finishQuery, this.error);
                break;
            default:
                this.query.state = "error";
                this.error(`Query type "${query.action}" not supported!`);
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
            let pendingNestedJoins: number = 0;

            if (join.type !== "cross" && !join.on) {
                this.query.state = "error";
                this.error("Non 'cross' joins require an 'on' parameter!");
                return;
            }

            const noJoinAS = "Must use 'AS' when joining temporary tables!";

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

            // combine the joined data into a row record
            const combineRows = (rData: any) => {
                return Object.keys(rData).reduce((prev, cur) => {
                    const row = rData[cur];
                    if (!row) return prev;
                    Object.keys(row).forEach((k) => {
                        prev[cur + "." + k] = row[k];
                    });
                    return prev;
                }, {});
            };

            // turn the "on" clause into a where statement we can pass into
            // a where query on the right side table
            const getWhere = (joinWhere: any[]): any[] => {
                return (typeof joinWhere[0] === "string" ? [joinWhere] : joinWhere).map(j => {
                    if (Array.isArray(j[0])) return getWhere(j); // nested where
                    if (j === "AND" || j === "OR") return j;

                    const leftWhere: any[] = resolveObjPath(j[0]);
                    const rightWhere: any[] = resolveObjPath(j[2]);
                    const swapWhere = leftWhere[0] === (this.query.tableAS || this.query.table);
                    // swapWhere = true [leftTable.column, =, rightTable.column] => [rightWhere, =, objQuery(leftWhere)]
                    // swapWhere = false [rightTable.column, =, leftTable.column] => [leftWhere, =, objQuery(rightWhere)]

                    return [
                        swapWhere ? rightWhere.slice(1).join(".") : leftWhere.slice(1).join("."),
                        swapWhere ? (j[1].indexOf(">") !== -1 ? j[1].replace(">", "<") : j[1].replace("<", ">")) : j[1],
                        objQuery(swapWhere ? leftWhere : rightWhere, rowData)
                    ];
                });
            };

            // found row to join, perform additional joins for this row or respond with the final joined row if no futher joins are needed.
            const maybeJoinRow = (rData) => {
                if (!joinData[joinIdx + 1]) { // no more joins, send joined row
                    onRow(combineRows(rData));
                } else { // more joins, nest on!
                    pendingNestedJoins++;
                    doJoin(rData, joinIdx + 1, () => {
                        pendingNestedJoins--;
                        maybeDone();
                    });
                }
            };

            const maybeDone = () => {
                if (!pendingNestedJoins) {
                    joinDone();
                }
            };

            const withPK = typeof join.with.table === "string" ? this.nSQL.tables[join.with.table].pkCol : "";
            const rightTable = String(join.with.as || join.with.table);
            const leftTable = String(this.query.tableAS || this.query.table);

            this.nSQL.triggerQuery({
                ...buildQuery(join.with.table, "select"),
                tableAS: join.with.as,
                where: join.on && join.type !== "cross" ? getWhere(join.on) : undefined,
                skipQueue: true
            }, (row) => {
                joinRowCount++;
                if (join.type === "right" || join.type === "outer") {
                    // keep track of which right side rows have been joined
                    rightHashes.push(withPK ? row[withPK] : hash(JSON.stringify(row)));
                }

                maybeJoinRow({
                    ...rowData,
                    [rightTable]: row
                });
            }, () => {

                switch (join.type) {
                    case "left":
                        if (joinRowCount === 0) {
                            maybeJoinRow({
                                ...rowData,
                                [rightTable]: undefined
                            });
                        }
                        maybeDone();
                        break;
                    case "inner":
                    case "cross":
                        maybeDone();
                        break;
                    case "outer":
                    case "right":
                        if (joinRowCount === 0 && join.type === "outer") {
                            maybeJoinRow({
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
                                maybeJoinRow({
                                    ...rowData,
                                    [leftTable]: undefined,
                                    [rightTable]: row
                                });
                            }
                        }, () => {
                            maybeDone();
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

        if ([this.query.orm, this.query.join, this.query.union].filter(l => l).length > 1) {
            this.query.state = "error";
            onError("Can only have one of orm, join or union!");
            return;
        }

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
                            return this._where(r, this._whereArgs.slowWhere as any[], false);
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
                        this._buffer = this._buffer.concat(rows.map(row => {
                            const newRow = this._streamAS(row, false);
                            const keep = this.query.having ? this._where(newRow, this._havingArgs.slowWhere as any[], false) : true;
                            return keep ? newRow : undefined;
                        }).filter(f => f));
                    } else {
                        rows.forEach((row, i) => {
                            const newRow = this._streamAS(row, false);
                            const keep = this.query.having ? this._where(newRow, this._havingArgs.slowWhere as any[], false) : true;
                            if (!keep) {
                                return;
                            }
                            if (doRange) {
                                if (count >= range[0] && count < range[1]) {
                                    this.progress(this._streamAS(row, false), count);
                                }
                            } else {
                                this.progress(this._streamAS(row, false), count);
                            }
                            count++;
                        });
                    }
                    next();
                });
            }).then(() => {
                if (this.query.orderBy) {
                    const sorted = this._buffer.sort(this._orderByRows);
                    (doRange ? sorted.slice(range[0], range[1]) : sorted).forEach(this.progress);
                }
                complete();
            });
            return;
        }

        const joinData: INanoSQLJoinArgs[] = Array.isArray(this.query.join) ? this.query.join : [this.query.join as any];

        let fastQuery = false;
        let joinedRows = 0;
        if (this._stream && !this.query.join && !this.query.orderBy && !this.query.having && !this.query.groupBy) {
            fastQuery = true;
        }

        const maybeScanComplete = () => {
            if (joinedRows === 0) {
                if (fastQuery || this._stream) {
                    complete();
                    return;
                }

                // use buffer
                // Group by, functions and AS
                this._groupByRows();

                if (this.query.having) { // having
                    this._buffer = this._buffer.filter(row => {
                        return this._where(row, this._havingArgs.slowWhere as any[], this.query.join !== undefined);
                    });
                }

                if (this.query.orderBy) { // order by
                    this._buffer.sort(this._orderByRows);
                }

                if (doRange) { // limit / offset
                    this._buffer = this._buffer.slice(range[0], range[1]);
                }

                this._buffer.forEach((row, i) => {
                    this.progress(row, range[0] + i);
                });
                complete();
            }
        };

        // standard query path
        this._getRecords((row, i) => { // SELECT rows
            if (fastQuery) { // nothing fancy to do, just feed the rows to the client
                if (doRange) {
                    if (i >= range[0] && i < range[1]) {
                        this.progress(this._selectArgs.length ? this._streamAS(row, false) : row, i);
                    }
                } else {
                    this.progress(this._selectArgs.length ? this._streamAS(row, false) : row, i);
                }
                return;
            }

            row = _maybeAssign(row);
            let count = 0;
            joinedRows++;
            this._maybeJoin(joinData, row, (row2) => { // JOIN as needed
                if (this._stream) {
                    // continue streaming results
                    // skipping group by, order by and aggregate functions
                    let keepRow = true;
                    row2 = this._selectArgs.length ? this._streamAS(row2, this.query.join !== undefined) : row2;
                    if (this.query.having) {
                        keepRow = this._where(row2, this._havingArgs.slowWhere as any[], this.query.join !== undefined);
                    }
                    if (keepRow && doRange) {
                        keepRow = count >= range[0] && count < range[1];
                    }
                    if (keepRow) {
                        this.progress(row2, count);
                    }
                    count++;
                } else {
                    this._buffer.push(row2);
                }
            }, () => {
                joinedRows--;
                maybeScanComplete();
            });
        }, maybeScanComplete);
    }

    public _groupByRows() {

        if (!this.query.groupBy) {
            this._buffer = this._buffer.map(b => this._streamAS(b, this.query.join !== undefined));
            return;
        }


        this._buffer.sort((a: any, b: any) => {
            return this._sortObj(a, b, this._groupBy);
        }).forEach((val, idx) => {
            const groupByKey = this._groupBy.sort.map(k => String(objQuery(k.path, val, this.query.join !== undefined))).join(".");

            if (!this._sortGroups[groupByKey]) {
                this._sortGroups[groupByKey] = [];
            }

            this._sortGroups[groupByKey].push(val);
        });

        this._buffer = [];
        if (this._hasAggrFn) {
            // loop through the groups
            Object.keys(this._sortGroups).forEach((groupKey) => {
                // find aggregate functions
                let resultFns = this._selectArgs.reduce((p, c) => {
                    if (this.nSQL.functions[c.value].type === "A") {
                        p[c.value] = {
                            aggr: this.nSQL.functions[c.value].aggregateStart,
                            args: c.args
                        };
                    }
                    return p;
                }, {});

                let firstFn = Object.keys(resultFns)[0];

                // calculate aggregate functions
                this._sortGroups[groupKey].forEach((row, i) => {
                    Object.keys(resultFns).forEach((fn) => {
                        resultFns[fn].aggr = this.nSQL.functions[fn].call(this.query, row, this.query.join !== undefined, resultFns[fn].aggr, ...resultFns[fn].args);
                    });
                });

                // calculate simple functions and AS back into buffer
                this._buffer.push(this._selectArgs.reduce((prev, cur) => {
                    prev[cur.as || cur.value] = cur.isFn && resultFns[cur.value] ? resultFns[cur.value].aggr.result : (cur.isFn ? this.nSQL.functions[cur.value].call(this.query, resultFns[firstFn].aggr.row, this.query.join !== undefined, {} as any, ...(cur.args || [])) : objQuery(cur.value, resultFns[firstFn].aggr.row));
                    return prev;
                }, {}));

            });
        } else {
            Object.keys(this._sortGroups).forEach((groupKey) => {
                this._sortGroups[groupKey].forEach((row) => {
                    this._buffer.push(this._streamAS(row, this.query.join !== undefined));
                });
            });
        }
    }

    public _upsert(onRow: (row: any, i: number) => void, complete: () => void) {
        if (!this.query.actionArgs) {
            this.error("Can't upsert without records!");
            this.query.state = "error";
        }
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: IWhereType.none };
        if (this.query.state === "error") return;
        let upsertRecords = Array.isArray(this.query.actionArgs) ? this.query.actionArgs : [this.query.actionArgs];

        const table = this.nSQL.tables[this.query.table as string];

        upsertRecords = upsertRecords.map(r => this.nSQL.default(r, this.query.table as string));

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
                onRow({result: `${upsertRecords.length} row(s) upserted`}, 0);
                complete();
            });
        } else { // find records and update them
            if (upsertRecords.length > 1) {
                this.query.state = "error";
                this.error("Cannot upsert multiple records with where condition!");
                return;
            }
            const maybeDone = () => {
                if (completed && updatingRecords === 0) {
                    onRow({result: `${updatedRecords} row(s) upserted`}, 0);
                    complete();
                }
            };
            let updatingRecords = 0;
            let updatedRecords = 0;
            let completed = false;
            this._getRecords((row, i) => {
                updatingRecords++;
                updatedRecords++;
                this._updateRow(upsertRecords[0], row, () => {
                    updatingRecords--;
                    maybeDone();
                }, (err) => {
                    this.query.state = "error";
                    this.error(err);
                });
            }, () => {
                completed = true;
                maybeDone();
            });
        }
    }

    public _updateRow(newData: any, oldRow: any, complete: (row: any) => void, error: (err: any) => void) {
        this.nSQL.doFilter("updateRow", {result: newData, row: oldRow, query: this.query}).then((upsertData) => {
            let finalRow = {
                ...oldRow,
                ...upsertData
            };
            const newIndexes = this._getIndexValues(this.nSQL.tables[this.query.string as any].indexes, finalRow);
            const oldIndexes = this._getIndexValues(this.nSQL.tables[this.query.string as any].indexes, oldRow);
            const table = this.nSQL.tables[this.query.table as string];
            const blankIndex = (id: any) => ({id: id, pks: []});
            allAsync(Object.keys(oldIndexes).concat(["__pk__"]), (indexName: string, i, next, err) => {
                if (indexName === "__pk__") { // main row
                    this.nSQL.adapter.write(this.query.table as string, finalRow[table.pkCol], finalRow, (pk) => {
                        finalRow[table.pkCol] = pk;
                        next(null);
                    }, err);
                } else { // indexes
                    const idxTable = "_idx_" + this.query.table + "_" + indexName;
                    if (newIndexes[indexName] !== oldIndexes[indexName]) { // only update changed index values
                        allAsync(["rm", "add"], (job, i, nextJob) => {
                            switch (job) {
                                case "add": // add new index value
                                    this.nSQL.adapter.read(idxTable, newIndexes[indexName], (idxRow) => {
                                        idxRow = _maybeAssign(idxRow || blankIndex(newIndexes[indexName]));
                                        idxRow.pks.push(finalRow[table.pkCol]);
                                        this.nSQL.adapter.write(idxTable, newIndexes[indexName], idxRow, () => {
                                            nextJob(null);
                                        }, () => {
                                            nextJob(null);
                                        });
                                    }, (err) => {
                                        nextJob(null);
                                    });
                                break;
                                case "rm": // remove old index value
                                    this.nSQL.adapter.read(idxTable, oldIndexes[indexName], (idxRow) => {
                                        idxRow = _maybeAssign(idxRow);
                                        const idxOf = idxRow.pks.indexOf(finalRow[table.pkCol]);
                                        if (idxOf !== -1) {
                                            (idxRow.pks || []).splice(idxOf, 1);
                                            this.nSQL.adapter.write(idxTable, oldIndexes[indexName], idxRow, () => {
                                                nextJob(null);
                                            }, () => {
                                                nextJob(null);
                                            });
                                        } else {
                                            nextJob(null);
                                        }
                                    }, (err) => {
                                        nextJob(null);
                                    });
                                break;
                            }
                        }).then(next);
                    } else {
                        next(null);
                    }
                }
            }).then(() => {
                this.nSQL.doFilter("updatedRow", {result: finalRow, new: false});
                complete(finalRow);
            });
        }).catch(error);
    }

    public _newRow(newRow: any, complete: (row: any) => void, error: (err: any) => void) {
        this.nSQL.doFilter("addRow", {result: newRow, query: this.query}).then((rowToAdd) => {
            const indexes = this._getIndexValues(this.nSQL.tables[this.query.string as any].indexes, rowToAdd);
            const table = this.nSQL.tables[this.query.table as string];
            const blankIndex = (id: any) => ({id: id, pks: []});

            allAsync(Object.keys(indexes).concat(["__pk__"]), (indexName: string, i, next, err) => {
                if (indexName === "__pk__") { // main row
                    this.nSQL.adapter.write(this.query.table as string, rowToAdd[table.pkCol], rowToAdd, (pk) => {
                        rowToAdd[table.pkCol] = pk;
                        next(null);
                    }, err);
                } else { // indexes
                    const idxTable = "_idx_" + this.query.table + "_" + indexName;
                    this.nSQL.adapter.read(idxTable, indexes[indexName], (idxRow) => {
                        idxRow = _maybeAssign(idxRow || blankIndex(indexes[indexName]));
                        idxRow.pks.push(rowToAdd[table.pkCol]);
                        this.nSQL.adapter.write(idxTable, indexes[indexName], idxRow, () => {
                            next(null);
                        }, () => {
                            next(null);
                        });
                    }, (err) => {
                        next(null);
                    });
                }
            }).then(() => {
                this.nSQL.doFilter("updatedRow", {result: rowToAdd, new: true});
                complete(rowToAdd);
            });
        }).catch(error);
    }

    public _delete(onRow: (row: any, i: number) => void, complete: () => void) {
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: IWhereType.none };
        if (this.query.state === "error") return;

        if (this._whereArgs.type === IWhereType.none) { // no records selected, nothing to delete!
            this.query.state = "error";
            this.error("Can't do delete query without where condition!");
        } else { // find records and delete them
            let pendingRows: number = 0;
            let delRows: number = 0;
            let completed: boolean = false;
            const table = this.nSQL.tables[this.query.table as string];
            const maybeDone = () => {
                if (completed && pendingRows === 0) {
                    onRow({result: `${delRows} row(s) deleted`}, 0);
                    complete();
                }
            };
            this._getRecords((row, i) => {
                pendingRows++;
                this.nSQL.doFilter("deleteRow", {result: row, query: this.query}).then((delRow) => {

                    const indexes = this._getIndexValues(table.indexes, row);

                    allAsync(Object.keys(indexes).concat(["__del__"]), (indexName: string, i, next) => {
                        if (indexName === "__del__") { // main row
                            this.nSQL.adapter.delete(this.query.table as string, delRow[table.pkCol], () => {
                                next(null);
                            }, (err) => {
                                this.query.state = "error";
                                this.error(err);
                            });
                        } else { // secondary indexes
                            const idxTable = "_idx_" + this.query.table + "_" + indexName;
                            this.nSQL.adapter.read(idxTable, indexes[indexName], (idxRow) => {
                                idxRow = _maybeAssign(idxRow);
                                const idxOf = idxRow.pks.indexOf(row[table.pkCol]);
                                if (idxOf !== -1) {
                                    idxRow.pks.splice(idxOf, 1);
                                    this.nSQL.adapter.write(idxTable, indexes[indexName], idxRow, () => {
                                        next(null);
                                    }, () => {
                                        next(null);
                                    });
                                } else {
                                    next(null);
                                }
                            }, (err) => {
                                next(null);
                            });
                        }
                    }).then(() => {
                        pendingRows--;
                        delRows++;
                        maybeDone();
                    }).catch((err) => {
                        this.query.state = "error";
                        this.error(err);
                    });

                }).catch(() => {
                    pendingRows--;
                    maybeDone();
                });
            }, () => {
                completed = true;
                maybeDone();
            });
        }
    }

    public _getIndexValues(indexes: {[name: string]: INanoSQLIndex}, row: any): {[indexName: string]: any} {
        return Object.keys(indexes).reduce((prev, cur) => {
            prev[cur] = cast(indexes[cur].type, objQuery(indexes[cur].path, row));
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

    public _registerRelation(name: string, relation: [string, "<=" | "<=>" | "=>", string], complete: () => void, error: (err: any) => void) {
        new Promise((res, rej) => {
            return this.nSQL.doFilter("registerRelation", { result: { name: name, rel: relation } });
        }).then((result: { name: string, rel: string[] }) => {
            return new Promise((res, rej) => {
                const relation = {
                    left: resolveObjPath(result.rel[0]),
                    sync: result.rel[1] as any,
                    right: resolveObjPath(result.rel[2])
                };
                if (["<=", "<=>", "=>"].indexOf(relation.sync) === -1 || relation.left.length < 2 || relation.right.length < 2) {
                    rej("Invalid relation!");
                    return;
                }
                const tables = Object.keys(this.nSQL.tables);
                if (tables.indexOf(relation.left[0]) === -1) {
                    rej(`Relation error, can't find table ${relation.left[0]}!`);
                    return;
                }
                if (tables.indexOf(relation.right[0]) === -1) {
                    rej(`Relation error, can't find table ${relation.right[0]}!`);
                    return;
                }
                this.nSQL.relations[result.name] = relation;
                res(this.nSQL.relations[result.name]);
            });
        }).then(complete).catch(error);
    }

    public _destroyRelation(name: string, complete: () => void, error: (err: any) => void) {
        new Promise((res, rej) => {
            return this.nSQL.doFilter("destroyRelation", { result: name });
        }).then((result: string) => {
            return new Promise((res, rej) => {
                if (!this.nSQL.relations[result]) {
                    rej(`Relation ${result} not found!`);
                    return;
                }
                delete this.nSQL.relations[result];
                res(result);
            });
        }).then(complete).catch(error);
    }

    public _streamAS(row: any, isJoin: boolean): any {
        if (this._selectArgs.length) {
            let result = {};
            this._selectArgs.forEach((arg) => {
                if (!this.nSQL.functions[arg.value]) {
                    this.query.state = "error";
                    this.error(`Function ${arg.value} not found!`);
                }
                if (arg.isFn) {
                    result[arg.as || arg.value] = this.nSQL.functions[arg.value].call(this.query, row, isJoin, {} as any, ...(arg.args || []));
                } else {
                    result[arg.as || arg.value] = objQuery(arg.value, row, isJoin);
                }
            });
            return result;
        }
        return row;
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
            let A = objQuery(cur.path, objA);
            let B = objQuery(cur.path, objB);
            if (!prev) {
                if (A === B) return 0;
                return (A > B ? 1 : -1) * (cur.dir === "DESC" ? -1 : 1);
            } else {
                return prev;
            }
        }, 0);
    }

    public createTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void {
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
                name: k.key.replace(/\s+/g, "-")
            }));

            if (hasError) return;
            res();
        }).then(() => {
            return this.nSQL.doFilter<createTableFilter, INanoSQLTableConfig>("createTable", { result: table });
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

                this.nSQL.tables[table.name] = {
                    model: computedDataModel,
                    columns: generateColumns(computedDataModel),
                    actions: table.actions || [],
                    views: table.views || [],
                    indexes: (table.indexes || []).map(i => ({
                        name: i.name.split(":")[0],
                        type: i.name.split(":")[1] || "string",
                        path: resolveObjPath(i.path)
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
                            p[c.name] = p;
                        }
                        return p;
                    }, {}),
                    pkType: table.model.reduce((p, c) => {
                        if (c.props && c.props.indexOf("pk()") !== -1) return c.key.split(":")[1];
                        return p;
                    }, ""),
                    pkCol: table.model.reduce((p, c) => {
                        if (c.props && c.props.indexOf("pk()") !== -1) return c.key.split(":")[0];
                        return p;
                    }, ""),
                    ai: table.model.reduce((p, c) => {
                        if (c.props && c.props.indexOf("pk()") !== -1 && c.props.indexOf("ai()") !== -1) return true;
                        return p;
                    }, false)
                };

                // no primary key found, set one
                if (this.nSQL.tables[table.name].pkCol === "") {
                    this.nSQL.tables[table.name].pkCol = "_id_";
                    this.nSQL.tables[table.name].pkType = "uuid";
                    this.nSQL.tables[table.name].model.unshift({ key: "_id_:uuid", props: ["pk()"] });
                    this.nSQL.tables[table.name].columns = generateColumns(this.nSQL.tables[table.name].model);
                }

                if (hasError) return;

                let addTables = [table.name];
                Object.keys(this.nSQL.tables[table.name].indexes).forEach((k, i) => {
                    const index = this.nSQL.tables[table.name].indexes[k];
                    const indexName = "_idx_" + table.name + "_" + index.name;
                    addTables.push(indexName);
                    this.nSQL.tables[indexName] = {
                        model: [
                            { key: `id:${index.type || "uuid"}`, props: ["pk()"] },
                            { key: `pks:${this.nSQL.tables[table.name].pkType}[]` }
                        ],
                        columns: [
                            { key: "id", type: index.type || "uuid" },
                            { key: "pks", type: `${this.nSQL.tables[table.name].pkType}[]` }
                        ],
                        actions: [],
                        views: [],
                        indexes: {},
                        pkType: index.type,
                        pkCol: "id",
                        ai: false
                    };
                });

                allAsync(addTables, (table, i, next, err) => {
                    this.nSQL.adapter.createTable(table, this.nSQL.tables[table], next as any, err);
                }).then(res).catch(rej);
            }).then(complete).catch(error);
        });

    }

    public alterTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void {
        this.nSQL.doFilter("alterTable", { result: table }).then((alteredTable: INanoSQLTableConfig) => {
            let tablesToAlter = [alteredTable.name];
            Object.keys(this.nSQL.tables[table.name].indexes).forEach((indexName) => {
                tablesToAlter.push("_idx_" + alteredTable.name + "_" + indexName);
            });

            allAsync(tablesToAlter, (dropTable, i, next, err) => {
                this.nSQL.adapter.disconnectTable(alteredTable.name, next as any, err);
            }).then(() => {
                this.createTable(alteredTable, complete, error);
            }).catch(error);

        }).catch(error);
    }

    public dropTable(table: string, complete: () => void, error: (err: any) => void): void {
        this.nSQL.doFilter("destroyTable", { result: [table] }).then((destroyTables: string[]) => {
            let tablesToDrop = destroyTables;
            destroyTables.forEach((table) => {
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

    public _getByPKs(onlyPKs: boolean, table: string, fastWhere: IWhereCondition, isReversed: boolean, orderByPK: boolean, onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

        switch (fastWhere.comp) {
            case "=":
                if (onlyPKs) {
                    onRow(fastWhere.value as any, 0);
                    complete();
                } else {
                    this.nSQL.adapter.read(table, fastWhere.value, (row) => {
                        onRow(row, 0);
                        complete();
                    }, this._onError);
                }
                break;
            case "BETWEEN":
                (onlyPKs ? this.nSQL.adapter.readMultiPK : this.nSQL.adapter.readMulti)(table, "range", fastWhere.value[0], fastWhere.value[1], isReversed, (row, i) => {
                    onRow(row, i);
                }, complete, this._onError);
                break;
            case "IN":

                const PKS = orderByPK ? (isReversed ? (fastWhere.value as any[]).sort((a, b) => a < b ? 1 : -1) : (fastWhere.value as any[]).sort((a, b) => a > b ? 1 : -1)) : fastWhere.value as any[];
                if (onlyPKs) {
                    PKS.forEach((pk, i) => {
                        onRow(pk as any, i);
                    });
                    complete();
                } else {
                    chainAsync(PKS, (pk, i, next) => {
                        this.nSQL.adapter.read(table, pk, (row) => {
                            onRow(row, i);
                            next();
                        }, this._onError);
                    }).then(complete);
                }

                break;
        }
    }

    public _fastQuery(onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {
        if (this._whereArgs.fastWhere) {
            if (this._whereArgs.fastWhere.length === 1) { // single where

                const fastWhere = this._whereArgs.fastWhere[0] as IWhereCondition;
                const isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";

                // function
                if (fastWhere.index && fastWhere.fnName) {
                    (this.nSQL.functions[fastWhere.fnName].queryIndex as any)(this.nSQL, this, fastWhere, false, onRow, complete);
                    // primary key
                } else if (fastWhere.col === this.nSQL.tables[this.query.table as string].pkCol) {
                    this._getByPKs(false, this.query.table as string, fastWhere, isReversed, this._pkOrderBy, onRow, complete);
                    // index
                } else {
                    this._readIndex(false, fastWhere, onRow, complete);
                }
            } else {  // multiple conditions
                let indexBuffer: any = {};
                let maxI = 0;
                chainAsync(this._whereArgs.fastWhere, (fastWhere, i, next) => {

                    if (i % 2 === 1) { // should be AND
                        next();
                        return;
                    }

                    maxI = i;

                    const addIndexBuffer = (pk) => {
                        indexBuffer[pk] = i;
                    };
                    // function
                    if (fastWhere.index && fastWhere.fnName) {
                        (this.nSQL.functions[fastWhere.fnName].queryIndex as any)(this.nSQL, this, fastWhere, true, addIndexBuffer, next);
                        // primary key
                    } else if (fastWhere.col === this.nSQL.tables[this.query.table as string].pkCol) {
                        this._getByPKs(true, this.query.table as string, fastWhere, false, false, addIndexBuffer, next);
                        // index
                    } else {
                        this._readIndex(true, fastWhere, addIndexBuffer, next);
                    }
                }).then(() => {
                    let getPKs: any[] = [];
                    Object.keys(indexBuffer).forEach((PK) => {
                        if (indexBuffer[PK] === maxI) {
                            getPKs.push(PK);
                        }
                    });
                    this._getByPKs(false, this.query.table as string, {
                        index: "_pk_",
                        col: this.nSQL.tables[this.query.table as string].pkCol,
                        comp: "IN",
                        value: getPKs
                    }, false, false, (row, i) => {
                        onRow(row, i);
                    }, complete);
                });
            }
        }
    }


    public _readIndex(onlyPKs: boolean, fastWhere: IWhereCondition, onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

        const useIndex = this.nSQL.tables[this.query.table as string].indexes[fastWhere.index as string];
        if (!useIndex) {
            this._onError(`Index not found!`);
            return;
        }

        let queryComplete: boolean = false;
        let bufferStarted: boolean = false;
        let counter = 0;
        let processing = 0;
        const processBuffer = () => {

            if (!indexBuffer.length) {
                if (queryComplete) { // buffer is empty and query is done, we're finshed
                    complete();
                } else { // wait for next row to come into the buffer
                    setFast(() => {
                        processing++;
                        if (processing > 1000) {
                            // waiting literally forever for the next row
                            setTimeout(processBuffer, Math.min(processing / 10, 1000));
                        } else {
                            processBuffer();
                        }
                    });
                }
                return;
            }

            // execute rows in the buffer
            this._getByPKs(false, this.query.table as string, {
                index: "_pk_",
                col: this.nSQL.tables[this.query.table as string].pkCol,
                comp: "IN",
                value: (indexBuffer.shift() as any).pks
            }, false, false, (row) => {
                onRow(row, counter);
                counter++;
            }, () => {
                counter % 100 === 0 ? setFast(processBuffer) : processBuffer();
            });
        };

        const table = "_idx_" + this.query.table + "_" + fastWhere.index;
        let indexBuffer: { id: any, pks: any[] }[] = [];
        let indexPKs: any[] = [];
        const isReversed = this._idxOrderBy && this._orderBy.sort[0].dir === "DESC";
        this._getByPKs(false, table, fastWhere, isReversed, this._idxOrderBy, (row) => {
            if (onlyPKs) {
                indexPKs = indexPKs.concat(row.pks || []);
            } else {
                indexBuffer.push(row as any);
                if (!bufferStarted) {
                    bufferStarted = true;
                    processBuffer();
                }
            }

        }, () => {
            queryComplete = true;
            if (onlyPKs) {
                let i = 0;
                while (i < indexPKs.length) {
                    onRow(indexPKs[i], i);
                    i++;
                }
                complete();
            }
        });

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
                        if (this._where(rows[i], this._whereArgs.slowWhere as any, this.query.join !== undefined)) {
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
                        if (this._where(row, this._whereArgs.slowWhere as any, false)) {
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
                            if (this._where(row, this._whereArgs.slowWhere as any, false)) {
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

    public _rebuildIndexes(table: string, complete: () => void, error: (err: any) => void) {

    }


    /**
     * Handles WHERE statements, combining multiple compared statements aginst AND/OR as needed to return a final boolean value.
     * The final boolean value is wether the row matches the WHERE conditions or not.
     *
     * @param {*} singleRow
     * @param {any[]} where
     * @param {number} rowIDX
     * @param {boolean} [ignoreFirstPath]
     * @returns {boolean}
     */
    public _where(singleRow: any, where: (IWhereCondition | string | (IWhereCondition | string)[])[], ignoreFirstPath: boolean): boolean {

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
                        compareResult = this._where(singleRow, wArg as any, ignoreFirstPath || false);
                    } else {
                        compareResult = this._compare(wArg as IWhereCondition, singleRow, ignoreFirstPath || false);
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
            }
            return matches;

        } else { // single where statement
            return this._compare(where[0] as IWhereCondition, singleRow, ignoreFirstPath || false);
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

    public _getColValue(where: IWhereCondition, wholeRow: any, isJoin: boolean): any {
        if (where.fnName) {
            return this.nSQL.functions[where.fnName].call(this.query, wholeRow, isJoin, this.nSQL.functions[where.fnName].aggregateStart || { result: undefined }, ...(where.fnArgs || []));
        } else {
            return objQuery(where.col as string, wholeRow, isJoin);
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
    public _compare(where: IWhereCondition, wholeRow: any, isJoin: boolean): boolean {


        const columnValue = this._getColValue(where, wholeRow, isJoin);
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
            case "=": return compareObjects(givenValue, columnValue);
            // if column not equal to given value. Supports arrays, objects and primitives
            case "!=": return !compareObjects(givenValue, columnValue);
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
    };

    public _parseSort(sort: string[], checkforIndexes: boolean): INanoSQLSortBy {
        const key = sort && sort.length ? hash(JSON.stringify(sort)) : "";
        if (!key) return { sort: [], index: "" };
        if (_NanoSQLQuery._sortMemoized[key]) return _NanoSQLQuery._sortMemoized[key];

        const result: { path: string[], dir: string }[] = sort.map(o => o.split(" ").map(s => s.trim())).reduce((p, c) => { return p.push({ path: resolveObjPath(c[0]), dir: (c[1] || "asc").toUpperCase() }), p; }, [] as any[]);

        let index = "";
        if (checkforIndexes && result.length === 1) {
            const pkKey: string = typeof this.query.table === "string" ? this.nSQL.tables[this.query.table].pkCol : "";
            if (result[0].path[0].length && result[0].path[0] === pkKey) {
                index = "_pk_";
            } else {
                const indexKeys = Object.keys(this.nSQL.tables[this.query.table as string].indexes);
                let i = indexKeys.length;
                while (i-- && !index) {
                    if (compareObjects(this.nSQL.tables[this.query.table as string].indexes[indexKeys[i]], result[0].path)) {
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
            canUseOrderByIndex = this._orderBy.index.length && this._whereArgs.fastWhere && compareObjects((this._whereArgs.fastWhere[0] as IWhereCondition).col, this._orderBy.sort[0].path) ? true : false;
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
    };

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

                        if (["=", "BETWEEN", "IN"].indexOf(w[1]) && doIndex) {
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
                                const path = resolveObjPath(w[0]);
                                indexes.forEach((index) => {
                                    if (compareObjects(index.path, path)) {
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
                    lastFastIndx = count;
                }
            } else {
                if (Array.isArray((parsedWhere[count] as any)) || !(parsedWhere[count] as any).index) {
                    isIndex = false;
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