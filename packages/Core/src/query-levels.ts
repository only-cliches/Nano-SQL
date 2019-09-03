/*
New proposed internal query classes.

The current query class is pretty bloated, complicated and not easy to maintain or follow.

New idea is this (WIP for sure)
1. Have 3 (or more) classes that handle different kinds of queries.
2. Each query is checked to see what is needed to complete it.
3. Simpler, faster queries are handed to the less complex query classes, while more complex queries are handed to the ones designed to handle it.

This way each class has a single query path (instead of multiple branching options) and will be easier to follow and maintain.
*/
import { InanoSQLInstance, InanoSQLQuery, _nanoSQLPreparedQuery, InanoSQLTableConfig, customQueryFilter, InanoSQLAdapter, conformRowFilter, IWhereType, InanoSQLForeignKey, InanoSQLFKActions, configTableFilter, InanoSQLDataModel, InanoSQLTableColumn, InanoSQLTable, InanoSQLIndex, configTableSystemFilter, IWhereCondition } from "./interfaces";
import { prepareQuery, _getQueryRecords, _diffUpdates, _getIndexValues, _updateIndex, _removeRowAndIndexes, _newRow, _updateRow, _tableID, _parseWhere, _where } from "./query-levels-utils";
import { adapterFilters, assign, chainAsync, allAsync, _nanoSQLQueue, deepGet, noop, blankTableDefinition, objectsEqual, deepSet, cast, buildQuery, resolvePath } from "./utilities";
import { resolveMode } from "./adapter-detect";
import { secondaryIndexQueue } from "./query";


export const executeQuery = (nSQL: InanoSQLInstance, query: InanoSQLQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {

    const startTime = Date.now();

    const prepared = prepareQuery(nSQL, query);

    query.state = "processing";
    const action = query.action.toLowerCase().trim();

    if (["select", "clone", "create table", "create table if not exists", "show tables"].indexOf(action) === -1 && typeof query.table !== "string") {
        query.state = "error";
        query.error = `Only "select", "clone", "create table" & "show tables" queries are available for this resource!`
        error(query.error);
        return;
    }

    if (typeof query.table === "string" && (!query.databaseID || !nSQL.getDB(query.databaseID).state.connected)) {
        query.state = "error";
        query.error = `Can't execute query before the database has connected!`;
        error(query.error);
        return;
    }

    const requireQueryOpts = (requireAction: boolean, cb: () => void) => {
        if (typeof query.table !== "string" || !query.table) {
            query.state = "error";
            query.error = `${query.action} query requires a table argument!`;
            error(query.error);
            return;
        }
        if (requireAction && !query.actionArgs) {
            query.state = "error";
            query.error = `${query.action} query requires an additional argument!`;
            error(query.error);
            return;
        }
        cb();
    };

    if (!query.cacheID) {
        query.cacheID = query.queryID;
    }

    switch (action) {
        case "select":
            switch (prepared.selectType) {
                case 1:
                    _nanoSQLSelectQueryFast(nSQL, prepared, progress, complete, error);
                    break;
                case 2:
                    _nanoSQLSelectQueryMedium(nSQL, prepared, progress, complete, error);
                    break;
                case 3:
                    _nanoSQLSelectQueryComplete(nSQL, prepared, progress, complete, error);
                    break;
            }
            break;
        case "upsert":
            requireQueryOpts(true, () => {
                _upsertQuery(nSQL, prepared, progress, complete, error);
            });
            break;
        case "clone":
            requireQueryOpts(true, () => {
                _cloneQuery(nSQL, prepared, progress, complete, error);
            });
            break;
        case "delete":
            requireQueryOpts(false, () => {
                _deleteQuery(nSQL, prepared, progress, complete, error);
            });
            break;
        case "rebuild indexes":
            requireQueryOpts(false, () => {
                _rebuildIndexesQuery(nSQL, prepared, progress, complete, error);
            });
            break;
        case "conform rows":
            requireQueryOpts(false, () => {
                _conformRowsQuery(nSQL, prepared, progress, complete, error, startTime);
            });
            break;
        case "create table":
        case "create table if not exists":
            requireQueryOpts(true, () => {
                _createTable(nSQL, prepared, prepared.query.actionArgs as InanoSQLTableConfig, false, progress, complete, error);
            });
            break;
        case "alter table":
            requireQueryOpts(true, () => {
                _createTable(nSQL, prepared, prepared.query.actionArgs as InanoSQLTableConfig, true, progress, complete, error);
            });
            break;
        case "drop":
        case "drop table":
            _dropTable(nSQL, prepared, prepared.query.table as string, complete, error);
            break;
        case "total":
            requireQueryOpts(false, () => {
                _totalQuery(nSQL, prepared, progress, complete, error);
            });
            break;
        case "show tables":
            _showTablesQuery(nSQL, prepared, progress, complete, error);
            break;
        case "describe":
            requireQueryOpts(false, () => {
                _describeQuery("table", nSQL, prepared, progress, complete, error);
            });
            break;
        case "describe indexes":
            requireQueryOpts(false, () => {
                _describeQuery("idx", nSQL, prepared, progress, complete, error);
            });
            break;
        default:
            nSQL.doFilter<customQueryFilter>(query.databaseID, "customQuery", { res: undefined, query: query, onRow: progress, complete: complete, error: error }, () => {
                query.state = "error";
                error(`Query "${query.action}" not supported!`);
            }, (err) => {
                query.state = "error";
                error(err);
            });
    }
}

/**
 * possible query params:
 * 1. orderBy
 * 2. groupBy
 * 3. functions/select mutate
 * 4. having
 * 5. join
 * 6. graph
 * 7. join
 * 8. limit
 * 9. offset
 * 10. union
 * 11. distinct
 */

 /** 
  * Query order:
  * 1. Index / Where Select
  * 2. Graph, Join & Distinct
  * 3. Group By & Functions
  * 4. Apply AS
  * 5. Having
  * 6. OrderBy
  * 7. Offset & Limit
 */

/**
 * The fastest and simplest query method.
 * These query parameters are NOT handled:
 * 1. orderBy on non indexed columns
 * 2. join
 * 3. graph
 * 4. distinct
 * 5. select arguments
 * 6. groupBy
 *
 * @param {InanoSQLInstance} nSQL
 * @param {_nanoSQLPreparedQuery} pQuery
 * @param {(row: any, i: number) => void} progress
 * @param {() => void} complete
 * @param {(err: any) => void} error
 */
export const _nanoSQLSelectQueryFast = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {
    let k = 0;
    const range = [(pQuery.query.offset || 0), (pQuery.query.offset || 0) + (pQuery.query.limit || 0)];;
    const doRange = range[0] + range[1] > 0;

    const { didOrderBy, didRange } = _getQueryRecords(nSQL, pQuery, (row, i) => {
        
        if (pQuery.query.having) {
            const inRange = !didRange && doRange ? (k >= range[0] && k < range[1]) : true;
            const keepRow = inRange ? _where(pQuery.query, row, pQuery.havingArgs.slowWhere as IWhereCondition[]) : false;
            if (keepRow) {
                progress(row, i);
            }
            k++;
        } else {
            const inRange = !didRange && doRange ? (i >= range[0] && i < range[1]) : true;
            if (inRange) {
                progress(row, i);
            }
        }
    }, complete, error);
}

/**
 * Still pretty fast, results are streamed and more complicated conditions are handled.
 * These query parameters are NOT handled:
 * 1. orderBy on non indexed columns
 *
 * @param {InanoSQLInstance} nSQL
 * @param {_nanoSQLPreparedQuery} pQuery
 * @param {(row: any, i: number) => void} progress
 * @param {() => void} complete
 * @param {(err: any) => void} error
 */
export const _nanoSQLSelectQueryMedium = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {
    const { didOrderBy, didRange } = _getQueryRecords(nSQL, pQuery, (row, i) => {


        
    }, complete, error);
}

/**
 * All query conditions are handled.
 * Results must be loaded entirely into memory, mutated, then fed to the client.
 * Pretty expensive memory wise.
 *
 * @param {InanoSQLInstance} nSQL
 * @param {_nanoSQLPreparedQuery} pQuery
 * @param {(row: any, i: number) => void} progress
 * @param {() => void} complete
 * @param {(err: any) => void} error
 */
export const _nanoSQLSelectQueryComplete = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {

    // generate new query object with no ordering or offset/limit
    const nonOrderedQuery: _nanoSQLPreparedQuery = {
        ...pQuery,
        orderBy: {sort: [], index: ""},
        pkOrderBy: false,
        idxOrderBy: false,
        query: {
            ...pQuery.query,
            limit: undefined,
            offset: undefined,
            orderBy: undefined
        }
    }

    const rowCache: any[] = [];

    // grab a streamable version of this query
    _nanoSQLSelectQueryMedium(nSQL, nonOrderedQuery, (row, i) => {
        rowCache.push(row);
    }, () => {
        // handle order by, then offset/limit

    }, error);
}


export const _rebuildIndexesQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row, i) => void, complete: () => void, error: (err: any) => void) => {
    const rebuildTables = pQuery.query.table as string;

    const database = nSQL.getDB(pQuery.query.databaseID);

    if (!database._tables[rebuildTables]) {
        error(new Error(`Table ${rebuildTables} not found for rebuilding indexes!`));
        return;
    }

    if (pQuery.query.where) { // rebuild only select rows (cant clean/remove index tables)

        const readQueue = new _nanoSQLQueue((item, i, complete, error) => {
            _removeRowAndIndexes(nSQL, pQuery.query, pQuery.indexes, database._tables[rebuildTables], item, () => {
                _newRow(nSQL, pQuery.query, pQuery.indexes, [], item, complete, error);
                progress(item, i);
            }, error);
        }, error, () => {
            complete();
        });

        _getQueryRecords(nSQL, pQuery, (row) => {
            readQueue.newItem(row);
        }, () => {
            readQueue.finished();
        }, error);
    } else { // empty indexes and start from scratch
        const indexes = Object.keys(database._tables[rebuildTables].indexes);

        allAsync(indexes, (indexName, j, nextIndex, indexErr) => {
            adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).deleteIndex(rebuildTables, indexName, () => {
                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).createIndex(rebuildTables, indexName, database._tables[rebuildTables].indexes[indexName].type, () => {
                    nextIndex(null);
                }, indexErr);
            }, indexErr);
        }).then(() => {

            // indexes are now empty
            const readQueue = new _nanoSQLQueue((row, i, complete, err) => {
                const tableData = database._tables[rebuildTables];
                const indexValues = _getIndexValues(nSQL, tableData.indexes, row);
                const rowPK = deepGet(tableData.pkCol, row);
                allAsync(Object.keys(indexValues), (indexName, jj, nextIdx, errIdx) => {
                    const idxValue = indexValues[indexName];
                    if (tableData.indexes[indexName].isArray) {
                        const arrayOfValues = indexValues[indexName] || [];
                        allAsync(arrayOfValues, (value, i, nextArr) => {
                            _updateIndex(nSQL, pQuery.query, pQuery.query.table as string, indexName, value, rowPK, true, () => {
                                nextArr(null);
                            }, errIdx);
                        }).then(() => {
                            nextIdx();
                        }).catch(errIdx);
                    } else {
                        _updateIndex(nSQL, pQuery.query, rebuildTables, indexName, idxValue, rowPK, true, () => {
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

            _getQueryRecords(nSQL, pQuery, (row) => {
                readQueue.newItem(row);
            }, () => {
                readQueue.finished();
            }, error);

        }).catch(error);
    }

}

export const _describeQuery = (type: "table" | "idx" | "fks" = "table", nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {
    if (typeof pQuery.query.table !== "string") {
        pQuery.query.state = "error";
        pQuery.query.error = "Can't call describe on that!";
        error(pQuery.query.error);
        return;
    }
    if (!nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table]) {
        pQuery.query.state = "error";
        pQuery.query.error = `Table ${pQuery.query.table} not found!`;
        error(pQuery.query.error);
        return;
    }
    switch (type) {
        case "table":
            nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table].columns.forEach((col, i) => {
                progress(assign(col), i);
            });
            break;
        case "idx":
            Object.keys(nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table].indexes).forEach((idx, i) => {
                const index = nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].indexes[idx];
                progress(assign(index), i);
            })
            break;
    }

    complete();
}

export const _showTablesQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {
    Object.keys(nSQL.getDB(pQuery.query.databaseID)._tables).forEach((table, i) => {
        progress({ table: table, id: nSQL.getDB(pQuery.query.databaseID)._tableIds[table] }, i);
    });
    complete();
}

export const _totalQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {
    const args = pQuery.query.actionArgs;
    if (args && args.rebuild) {
        try {
            adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).getTableIndexLength(pQuery.query.table as string, (count) => {

                nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].count = count;

                nSQL.saveCount(pQuery.query.databaseID || "", pQuery.query.table as string, (err) => {
                    if (err) {
                        error(err);
                    } else {
                        progress({ total: count }, 0);
                        complete();
                    }
                });
            }, error);
        } catch (e) {
            error(e);
        }
    } else {
        try {
            const total = nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].count;
            progress({ total: total }, 0);
            complete();
        } catch (e) {
            error(e);
        }
    }
}

export const _cloneQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {
    const mode = pQuery.query.actionArgs && pQuery.query.actionArgs.mode;
    const adapterCB: (adapter: InanoSQLAdapter) => void = pQuery.query.actionArgs && pQuery.query.actionArgs.getAdapter;
    const id = pQuery.query.actionArgs && pQuery.query.actionArgs.id || nSQL.getDB(pQuery.query.databaseID).state.id;
    if (!id || !mode) {
        error(`Id & Mode required for clone query!`);
        return;
    }
    const adapter = resolveMode(mode);
    // query.parent.getDB(databaseID)._tables
    const tables: string[] = pQuery.query.table !== "*" ? [pQuery.query.table as string] : Object.keys(nSQL.getDB(pQuery.query.databaseID)._tables);
    let i = 0;
    let setIds: { [tableName: string]: string } = {};
    // 1. connect to secondary adapter
    adapter.connect(id, () => {

        chainAsync(tables, (tableName, i, nextTable, errTable) => {
            const table = nSQL.getDB(pQuery.query.databaseID)._tables[tableName];
            if (!table) {
                errTable(`Table ${table} not found!`);
                return;
            }
            // 2. create copy of table in secondary adapter
            adapter.createTable(nSQL.getDB(pQuery.query.databaseID)._tableIds[table.name], table, () => {
                setIds[table.name] = nSQL.getDB(pQuery.query.databaseID)._tableIds[table.name];
                // 3. create copy of indexes in secondary adapter
                allAsync(Object.keys(table.indexes), (index, i, next, err) => {
                    const idx = table.indexes[index];
                    adapter.createIndex(nSQL.getDB(pQuery.query.databaseID)._tableIds[table.name], index, idx.type, next, err);
                }).then(() => {
                    const writeQueue = new _nanoSQLQueue((item, i, complete, error) => {
                        progress({ target: table.name, targetId: nSQL.getDB(pQuery.query.databaseID)._tableIds[table.name], object: item }, i);
                        i++;
                        adapter.write(nSQL.getDB(pQuery.query.databaseID)._tableIds[table.name], deepGet(table.pkCol, item), item, complete, error);
                    }, error, () => {
                        // 5. copy indexes to new adapter table
                        chainAsync(Object.keys(table.indexes), (indexName, i, nextIndex, indexErr) => {
                            const index = table.indexes[indexName];
                            adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKeys(table.name, indexName, "all", undefined, undefined, false, (rowId, key) => {
                                progress({ target: nSQL.getDB(pQuery.query.databaseID)._tableIds[table.name] + "." + indexName, targetId: table.name + "." + indexName, object: { key, rowId } }, i);
                                i++;
                                adapter.addIndexValue(nSQL.getDB(pQuery.query.databaseID)._tableIds[table.name], indexName, rowId, key, noop, indexErr);
                            }, nextIndex, indexErr);
                        }).then(() => {
                            // 6. Done
                            nextTable();
                        }).catch(error);
                    });
                    // 4. Copy rows to new adapter table
                    adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readMulti(table.name, "all", undefined, undefined, false, (row, i) => {
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
                            complete();
                        } else {
                            adapter.disconnect(() => {
                                complete();
                            }, error);
                        }
                    }, error);
                }, error);
            }, error);
        }).catch(error);
    }, error);
}



export const _conformRowsQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void, startTime) => {
    const conformTable = pQuery.query.table as string;
    const conformFilter = pQuery.query.actionArgs || function (r) { return r };

    if (!pQuery.query.databaseID || !nSQL.getDB(pQuery.query.databaseID)._tables[conformTable]) {
        error(new Error(`Table ${conformTable} not found for conforming!`));
        return;
    }
    let count = 0;
    const conformQueue = new _nanoSQLQueue((item, i, done, err) => {
        const newRow = nSQL.default(pQuery.query.databaseID || "", item, conformTable);
        nSQL.doFilter<conformRowFilter>(pQuery.query.databaseID, "conformRow", { res: newRow, oldRow: item, query: pQuery.query }, (setRow) => {
            _diffUpdates(nSQL, pQuery.query, item, setRow.res, () => {
                const changeEvent = {
                    target: conformTable,
                    path: "*",
                    events: ["upsert", "change", "*"],
                    time: Date.now(),
                    performance: Date.now() - startTime,
                    result: setRow.res,
                    oldRow: item,
                    query: pQuery.query.query,
                    indexes: pQuery.whereArgs ? pQuery.whereArgs.indexesUsed : []
                };
                if (nSQL.getDB(pQuery.query.databaseID).state.hasAnyEvents) {
                    nSQL.triggerEvent(pQuery.query.databaseID || "", changeEvent);
                    Object.keys(nSQL.events[pQuery.query.databaseID || ""][pQuery.query.table as string]).forEach((path) => {
                        if (path !== "*") {
                            if (!objectsEqual(deepGet(path, item), deepGet(path, setRow.res))) {
                                nSQL.triggerEvent(pQuery.query.databaseID || "", {
                                    target: pQuery.query.table as string,
                                    path: path,
                                    events: ["upsert", "change", "*"],
                                    time: Date.now(),
                                    performance: Date.now() - startTime,
                                    result: setRow.res,
                                    oldRow: item,
                                    query: pQuery.query,
                                    indexes: pQuery.whereArgs ? pQuery.whereArgs.indexesUsed : []
                                }, true);
                            }
                        }
                    });
                }
                // _startTime = Date.now();
                progress(pQuery.query.returnEvent ? changeEvent : setRow.res, i);
                count++;
                done();
            }, err);
        }, error);

    }, error, () => {
        complete();
    });

    _getQueryRecords(nSQL, pQuery, (row, i) => {
        conformQueue.newItem(conformFilter(row));
    }, () => {
        conformQueue.finished();
    }, error);
}

export const _deleteQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {

    const database = nSQL.getDB(pQuery.query.databaseID);

    const tableConfig = nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string];

    const deleteBuffer = new _nanoSQLQueue((row, i, done, err) => {

        new Promise((res, rej) => {
            const table = pQuery.query.table as string;

            if (database._fkRels[table] && database._fkRels[table].length) {
                allAsync(database._fkRels[table], (fkRestraint: InanoSQLForeignKey, i, next, err) => {
                    const rowValue = deepGet(fkRestraint.selfPath, row);
                    const rowPKs = cast(pQuery.query.databaseID, "any[]", fkRestraint.selfIsArray ? rowValue : [rowValue]);
                    allAsync(rowPKs, (rowPK, iii, nextRow, rowErr) => {
                        switch (fkRestraint.onDelete) {
                            case InanoSQLFKActions.RESTRICT: // see if any rows are connected
                                let count = 0;
                                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, (pk) => {
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
                                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, (key) => {
                                    deleteIDs.push(key);
                                }, () => {
                                    nSQL.triggerQuery(pQuery.query.databaseID, {
                                        ...buildQuery(pQuery.query.databaseID, nSQL, fkRestraint.childTable, "delete"),
                                        where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs]
                                    }, noop, nextRow, rowErr);
                                }, err)
                                break;
                            case InanoSQLFKActions.SET_NULL:
                                let setIDs: any[] = [];
                                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKey(fkRestraint.childTable, fkRestraint.childIndex, rowPK, (key) => {
                                    setIDs.push(key);
                                }, () => {
                                    nSQL.triggerQuery(pQuery.query.databaseID, {
                                        ...buildQuery(pQuery.query.databaseID, nSQL, fkRestraint.childTable, "upsert"),
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
            _removeRowAndIndexes(nSQL, pQuery.query, pQuery.indexes, tableConfig, row, (delRowOrEvent) => {
                onRow(delRowOrEvent, i);
                database._tables[tableConfig.name].count--;
                done();
            }, err);
        }).catch(err);
    }, error, () => {
        complete();
    });

    _getQueryRecords(nSQL, pQuery, (row, i) => {
        deleteBuffer.newItem(row);
    }, () => {
        nSQL.saveCount(pQuery.query.databaseID || "", tableConfig.name);
        deleteBuffer.finished();
    }, error);

}

export const _upsertQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, onRow: (row: any, i: number) => void, complete: () => void, error: (err) => void) => {

    let upsertPath: string[] = [];

    // nested upsert
    if ((pQuery.query.table as string).indexOf(".") !== -1 || (pQuery.query.table as string).indexOf("[") !== -1) {
        const path = resolvePath(pQuery.query.table as string);
        pQuery.query.table = path.shift() as string;
        upsertPath = path;
    }

    const upsertRecords = Array.isArray(pQuery.query.actionArgs) ? pQuery.query.actionArgs : [pQuery.query.actionArgs];

    const table = nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string];

    if (pQuery.whereArgs.type === IWhereType.none) { // insert/update records directly

        allAsync(upsertRecords, (row, i, next, error) => {
            const pkVal = deepGet(table.pkCol, row);

            if (pkVal) {
                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).read(pQuery.query.table as string, pkVal, (oldRow) => {
                    if (oldRow) {
                        _updateRow(nSQL, pQuery.query, pQuery.indexes, upsertPath, row, oldRow, (newRow) => {
                            onRow(newRow, i);
                            next();
                        }, error);
                    } else {
                        _newRow(nSQL, pQuery.query, pQuery.indexes, upsertPath, row, (newRow) => {
                            onRow(newRow, i);
                            next();
                        }, error);
                    }
                }, error);
            } else {
                _newRow(nSQL, pQuery.query, pQuery.indexes, upsertPath, row, (newRow) => {
                    onRow(newRow, i);
                    next();
                }, error);

            }
        }).then(() => {
            nSQL.saveCount(pQuery.query.databaseID || "", pQuery.query.table as string);
            complete();
        }).catch(error);
    } else { // find records and update them
        if (upsertRecords.length > 1) {
            error("Cannot upsert multiple records with where condition!");
            return;
        }

        const upsertBuffer = new _nanoSQLQueue((row, i, done, err) => {

            const PKpath = nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].pkCol;
            const PK = deepGet(PKpath, row);

            const checkLock = () => {
                if (nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].rowLocks[String(PK)]) {
                    setTimeout(checkLock, 10);
                } else {
                    nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].rowLocks[String(PK)] = true;
                    _updateRow(nSQL, pQuery.query, pQuery.indexes, upsertPath, upsertRecords[0], row, (evOrRow) => {
                        delete nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].rowLocks[String(PK)];
                        onRow(evOrRow, i);
                        done();
                    }, err);
                }
            }
            checkLock();

        }, error, () => {
            complete();
        });
        _getQueryRecords(nSQL, pQuery, (row, i) => {
            upsertBuffer.newItem(row);
        }, () => {
            upsertBuffer.finished();
        }, error);
    }
}

export const _dropTable = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, table: string, complete: () => void, error: (err: any) => void): void => {

    const database = nSQL.getDB(pQuery.query.databaseID);

    new Promise((res, rej) => {
        if (database._fkRels[table] && database._fkRels[table].length) {
            allAsync(database._fkRels[table], (fkRestraint: InanoSQLForeignKey, i, next, err) => {

                switch (fkRestraint.onDelete) {
                    case InanoSQLFKActions.RESTRICT: // see if any rows are connected
                        let count = 0;
                        adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "offset", 0, 1, false, (key, id) => {
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
                        adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "all", 0, 0, false, (key, id) => {
                            deleteIDs.push(key);
                        }, () => {
                            nSQL.triggerQuery(pQuery.query.databaseID, {
                                ...buildQuery(pQuery.query.databaseID, nSQL, fkRestraint.childTable, "delete"),
                                where: [fkRestraint.childPath.join("."), fkRestraint.childIsArray ? "INCLUDES" : "IN", deleteIDs]
                            }, noop, next, err);
                        }, err)
                        break;
                    case InanoSQLFKActions.SET_NULL:
                        let setIDs: any[] = [];
                        adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKeys(fkRestraint.childTable, fkRestraint.childIndex, "all", 0, 0, false, (key, id) => {
                            setIDs.push(key);
                        }, () => {
                            nSQL.triggerQuery(pQuery.query.databaseID, {
                                ...buildQuery(pQuery.query.databaseID, nSQL, fkRestraint.childTable, "upsert"),
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
        Object.keys(database._tables[table].indexes).forEach((indexName) => {
            tablesToDrop.push(indexName);
        });
        tablesToDrop.push(table);

        return chainAsync(tablesToDrop, (dropTable, i, next, err) => {
            if (i === tablesToDrop.length - 1) {
                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).dropTable(dropTable, () => {
                    delete database._tables[dropTable];
                    delete database._tableIds[dropTable];
                    nSQL._saveTableIds(pQuery.query.databaseID || "").then(() => {
                        next(dropTable);
                    }).catch(err);
                }, err);
            } else {
                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).deleteIndex(table, dropTable, next as any, err);
            }
        }).then(() => {
            database._tables[table].count = 0;
            nSQL.saveCount(pQuery.query.databaseID || "", table);
            complete();
        })
    }).catch(error);
}

export const _createTable = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, table: InanoSQLTableConfig, alterTable: boolean, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void => {

    const tableID = nSQL.getDB(pQuery.query.databaseID)._tableIds[table.name] || _tableID();

    let tableQuery = pQuery.query.table as string
    // table already exists, set to alter table query
    if (!alterTable && Object.keys(nSQL.getDB(pQuery.query.databaseID)._tables).indexOf(table.name) !== -1) {
        alterTable = true;
        tableQuery = table.name
    }

    new Promise((res, rej) => {
        let hasError = false;

        const l = table.name;
        if (!table._internal && (l.indexOf("_") === 0 || l.match(/\s/g) !== null || l.match(/[\(\)\]\[\.]/g) !== null)) {
            rej({ error: `Invalid Table Name ${table.name}! https://docs.nanosql.io/setup/data-models`, query: pQuery.query });
            return;
        }

        Object.keys(table.model).forEach((col) => {
            const modelData = col.replace(/\s+/g, "-").split(":"); // [key, type];
            if (modelData.length === 1) {
                modelData.push("any");
            }
            if (!modelData[0] || modelData[0].match(/[\(\)\]\[\.]/g) !== null || modelData[0].indexOf("_") === 0) {
                hasError = true;
                rej({ error: `Invalid Data Model at ${table.name + "." + col}! https://docs.nanosql.io/setup/data-models`, query: pQuery.query });
            }
        });

        if (hasError) return;

        res();

    }).then(() => {
        return new Promise((res, rej) => {
            nSQL.doFilter<configTableFilter>(pQuery.query.databaseID, "configTable", { res: table, query: pQuery.query }, res, rej);
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

                model = Object.keys(nSQL.getDB(pQuery.query.databaseID).config.types || {}).reduce((prev, cur) => {
                    if (cur === type[1]) {
                        foundModel = true;
                        return (nSQL.getDB(pQuery.query.databaseID).config.types || {})[cur]
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
                const allowedTypes = Object.keys(nSQL.indexTypes);
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
            nSQL.doFilter<configTableSystemFilter>(pQuery.query.databaseID, "configTableSystem", { res: newConfig, query: pQuery.query }, (result) => {
                res(result.res);
            }, rej)
        })
    }).then((newConfig: InanoSQLTable) => {
        const oldMode = nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string] && nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].mode;
        if (newConfig.mode || oldMode) {
            return new Promise((res, rej) => {
                if (alterTable && newConfig.mode === oldMode) {
                    res(newConfig);
                } else {
                    const connectAdapter = () => {
                        if ((newConfig.mode as InanoSQLAdapter)) {
                            (newConfig.mode as InanoSQLAdapter).connect(nSQL.getDB(pQuery.query.databaseID).state.id, () => {
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
            nSQL.triggerQuery(pQuery.query.databaseID, {
                ...buildQuery(pQuery.query.databaseID, nSQL, "_util", "select"),
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
        const oldIndexes = alterTable ? Object.keys(nSQL.getDB(pQuery.query.databaseID)._tables[tableQuery].indexes) : [];
        const newIndexes = Object.keys(newConfig.indexes);

        const addIndexes = newIndexes.filter(v => oldIndexes.indexOf(v) === -1);

        let addTables = [newConfig.name].concat(addIndexes);

        onRow(newConfig, 0);

        return chainAsync(addTables, (tableOrIndexName, i, next, err) => {
            if (i === 0) { // table
                const newTable = { name: tableOrIndexName, conf: newConfig };
                nSQL.getDB(pQuery.query.databaseID)._tableIds[newTable.name] = newConfig.id;
                if (alterTable) {
                    delete nSQL.getDB(pQuery.query.databaseID)._tableIds[pQuery.query.query.table as string];
                    const removeIndexes = oldIndexes.filter(v => newIndexes.indexOf(v) === -1);
                    allAsync(removeIndexes, (indexName, i, nextIndex, indexError) => {
                        adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query.query).deleteIndex(tableOrIndexName, indexName, () => {
                            nextIndex(null);
                        }, indexError);
                    }).then(() => {
                        nSQL.getDB(pQuery.query.databaseID)._tables[newTable.name] = newTable.conf;
                        next(null);
                    }).catch(err);
                } else {
                    adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query.query).createTable(newTable.name, newTable.conf, () => {
                        nSQL.getDB(pQuery.query.databaseID)._tables[newTable.name] = newTable.conf;
                        next(null);
                    }, err as any);
                }

            } else { // indexes
                const index = newConfig.indexes[tableOrIndexName];
                secondaryIndexQueue[nSQL.getDB(pQuery.query.databaseID).state.id + index.id] = new _nanoSQLQueue();
                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query.query).createIndex(newConfig.name, index.id, index.type, () => {
                    next(null);
                }, err as any);

            }
        });
    }).then(() => {
        nSQL._rebuildFKs();
        if (tableQuery === "_util") {
            return Promise.resolve();
        }
        return nSQL._saveTableIds(pQuery.query.databaseID || "");
    }).then(() => {
        complete();
    }).catch(error);

}