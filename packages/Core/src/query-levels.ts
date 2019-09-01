/*
New proposed internal query classes.

The current query class is pretty bloated, complicated and not easy to maintain or follow.

New idea is this (WIP for sure)
1. Have 3 (or more) classes that handle different kinds of queries.
2. Each query is checked to see what is needed to complete it.
3. Simpler, faster queries are handed to the less complex query classes, while more complex queries are handed to the ones designed to handle it.

This way each class has a single query path (instead of multiple branching options) and will be easier to follow and maintain.
*/
import { InanoSQLInstance, InanoSQLQuery, _nanoSQLPreparedQuery, InanoSQLTableConfig, customQueryFilter, InanoSQLAdapter, conformRowFilter } from "./interfaces";
import { prepareQuery, _getQueryRecords, _diffUpdates } from "./query-levels-utils";
import { adapterFilters, assign, chainAsync, allAsync, _nanoSQLQueue, deepGet, noop, blankTableDefinition, objectsEqual, deepSet } from "./utilities";
import { resolveMode } from "./adapter-detect";


export const executeQuery = (nSQL: InanoSQLInstance, query: InanoSQLQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {

    const startTime = Date.now();

    const prepared = prepareQuery(nSQL, query);

    query.state = "processing";
    const action = query.action.toLowerCase().trim();

    if (["select", "clone", "create table", "create table if not exists", "show tables"].indexOf(action) === -1 && typeof query.table !== "string") {
        query.state = "error";
        query.error = `Only "select", "clone" & "create table" queries are available for this resource!`
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
            switch (prepared.type) {
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
                _nanoSQLMutationQuery(nSQL, prepared, progress, complete, error);
            });
            break;
        case "clone":
            requireQueryOpts(true, () => {
                _cloneQuery(nSQL, prepared, progress, complete, error);
            });
            break;
        case "delete":
        case "rebuild indexes":
            requireQueryOpts(false, () => {
                _nanoSQLMutationQuery(nSQL, prepared, progress, complete, error);
            });
            break;
        case "conform rows":
            requireQueryOpts(false, () => {
                _conformQuery(nSQL, prepared, progress, complete, error, startTime);
            });
            break;
        case "drop":
        case "drop table":
        case "alter table":
        case "create table":
        case "create table if not exists":
            requireQueryOpts(true, () => {
                _modifyTablesQuery(nSQL, prepared, progress, complete, error);
            });
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
 * Handles queries that modify the database data.
 *
 * @param {InanoSQLInstance} nSQL
 * @param {_nanoSQLPreparedQuery} query
 * @param {(row: any, i: number) => void} progress
 * @param {() => void} complete
 * @param {(err: any) => void} error
 */
export const _nanoSQLMutationQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {

}

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
    _getQueryRecords(nSQL, pQuery, (row, i) => {

    }, complete, error);
}

/**
 * Still pretty fast, results are streamed and more complicated conditions are handled.
 * These query parameters are NOT handled:
 * 1. orderBy on non indexed columns
 * 2. groupBy
 * 3. distinct
 *
 * @param {InanoSQLInstance} nSQL
 * @param {_nanoSQLPreparedQuery} pQuery
 * @param {(row: any, i: number) => void} progress
 * @param {() => void} complete
 * @param {(err: any) => void} error
 */
export const _nanoSQLSelectQueryMedium = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {
    _getQueryRecords(nSQL, pQuery, (row, i) => {

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
    _getQueryRecords(nSQL, pQuery, (row, i) => {

    }, complete, error);
}

export const _modifyTablesQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {

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



export const _conformQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void, startTime) => {
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