import {
    ActionArgs_alter_table,
    ActionArgs_clone,
    ActionArgs_conform,
    ActionArgs_create_table,
    ActionArgs_delete,
    ActionArgs_describe,
    ActionArgs_distinct,
    ActionArgs_drop_table,
    ActionArgs_filter_arr,
    ActionArgs_filter_fn,
    ActionArgs_functions,
    ActionArgs_graph,
    ActionArgs_group,
    ActionArgs_join,
    ActionArgs_order,
    ActionArgs_range,
    ActionArgs_rebuild_indexes,
    ActionArgs_select_arr,
    ActionArgs_select_compound,
    ActionArgs_select_external,
    ActionArgs_select_fn,
    ActionArgs_select_index,
    ActionArgs_select_pk,
    ActionArgs_show_tables,
    ActionArgs_total,
    ActionArgs_union,
    ActionArgs_upsert,
    customQueryFilter,
    InanoSQLActions,
    InanoSQLFunctionQuery,
    InanoSQLInstance, InanoSQLProcessedSort,
    InanoSQLQuery2,
    InanoSQLQueryActions,
    InanoSQLQueryAST,
    InanoSQLSortBy, InanoSQLWhereQuery, InanoSQLWhereStatement,
    IWhereCondition
} from "./interfaces";
import {QueryAST} from "./query2-ast";
import {QueryPrepare} from "./query2-prepare";
import {
    adapterFilters,
    allAsync, assign,
    callOnce,
    chainAsync,
    deepGet,
    execFunction,
    maybeDate,
    objectsEqual
} from "./utilities";


export interface nanoSQLQueryArgs {
    nSQL: InanoSQLInstance,
    pQuery: InanoSQLQueryAST,
    state: nanoSQLQueryState,
    inputRow: any,
    inputIndex: number,
    nextRow: (i: number, row?: any, err?: Error) => void
}

export interface nanoSQLQueryState {
    perf: {what: string|number, time: number, delta: number, total: number}[],
    savedTables: {[name: string]: any[]};
    distinctKeys: {[name: string]: boolean};
    orderByCache: any[];
    groupByCache: {[key: string]: any};
}

/**
 * Query Order:
 * 0. Process, Prepare then Execute
 * 1. Where / Index Select (possibly do indexed orderby and/or indexed offset/limit)
 * 2. Union, Join & Graph
 * 3. Group By, Functions & Distinct
 * 4. Apply AS
 * 5. OrderBy (if not done by index/pk)
 * 6. Having 
 * 7. Offset & Limit
 */

export const executeQuery = (nSQL: InanoSQLInstance, query: InanoSQLQuery2, progress: (row: any, i: number) => void, complete: (err?: Error) => void) => {
    
    try {
        // step 1, process query AST
        const queryAST = QueryAST.generate(nSQL, query);

        // step 2, prepare query
        const preparedQuery = QueryPrepare.prepare(nSQL, queryAST);

        let queryState: nanoSQLQueryState = {
            perf: [{what: "start", time: Date.now(), delta: 0, total: 0}],
            savedTables: {},
            distinctKeys: {},
            orderByCache: [],
            groupByCache: []
        };

        const once = callOnce(complete);

        let k = 0;

        // step 3, execute query
        nanoSQLQuery2._stepQuery(nSQL, queryState, queryAST, preparedQuery, 0, undefined, 0, (row, i) => {
            if (!once.finished) {
                progress(row, k);
                k++;
            }
        }, once.call);

    } catch (e) {
        complete(e);
    }
}

export class nanoSQLQuery2 {
    static _stepQuery(nSQL: InanoSQLInstance, state: nanoSQLQueryState, pQuery: InanoSQLQueryAST, actions: InanoSQLQueryActions[], actionIndex: number, inputRow: any, inputIndex: number, onRow: (row: any, i: number) => void, complete: (err?:  Error) => void) {
        const action = actions[actionIndex];

        const nextAction = actions[actionIndex + 1];

        const nextRow = (i: number, row?: any, err?: Error) => {
            if (err) {
                complete(err);
                return;
            }

            if (i === -1) {
                const now = Date.now();
                const lastTime = state.perf[state.perf.length - 1].time;
                const firstTime = state.perf[0].time;
                state.perf.push({what: action.name, time: now, delta: now - lastTime, total: now - firstTime});

                if (!nextAction) {
                    complete();
                    return;
                }
            }

            if (nextAction) {
                nanoSQLQuery2._stepQuery(nSQL, state, pQuery, actions, actionIndex + 1, row, i, onRow, complete);
            } else {
                onRow(row, i);
            }
        };

        const queryArgs = {
            nSQL,
            pQuery,
            inputRow,
            inputIndex,
            nextRow,
            state
        };

        switch(action.do) {
            case InanoSQLActions.select_arr:
                nanoSQLQuery2._select_arr(queryArgs, action.args);
                break;
            case InanoSQLActions.select_fn:
                nanoSQLQuery2._select_fn(queryArgs, action.args);
                break;
            case InanoSQLActions.select_index:
                nanoSQLQuery2._select_index(queryArgs, action.args);
                break;
            case InanoSQLActions.select_pk:
                nanoSQLQuery2._select_pk(queryArgs, action.args);
                break;
            case InanoSQLActions.select_external:
                nanoSQLQuery2._select_external(queryArgs, action.args);
                break;
            case InanoSQLActions.select_compound:
                nanoSQLQuery2._select_compound(queryArgs, action.args);
                break;
            case InanoSQLActions.total:
                nanoSQLQuery2._total(queryArgs, action.args);
                break;
            case InanoSQLActions.filter_arr:
                nanoSQLQuery2._filter_arr(queryArgs, action.args);
                break;
            case InanoSQLActions.filter_fn:
                nanoSQLQuery2._filter_fn(queryArgs, action.args);
                break;
            case InanoSQLActions.union:
                nanoSQLQuery2._union(queryArgs, action.args);
                break;
            case InanoSQLActions.graph:
                nanoSQLQuery2._graph(queryArgs, action.args);
                break;
            case InanoSQLActions.join:
                nanoSQLQuery2._join(queryArgs, action.args);
                break;
            case InanoSQLActions.order:
                nanoSQLQuery2._order(queryArgs, action.args);
                break;
            case InanoSQLActions.group:
                nanoSQLQuery2._group(queryArgs, action.args);
                break;
            case InanoSQLActions.functions:
                nanoSQLQuery2._functions(queryArgs, action.args);
                break;
            case InanoSQLActions.range:
                nanoSQLQuery2._range(queryArgs, action.args);
                break;
            case InanoSQLActions.distinct:
                nanoSQLQuery2._distinct(queryArgs, action.args);
                break;
            case InanoSQLActions.drop_table:
                nanoSQLQuery2._drop_table(queryArgs, action.args);
                break;
            case InanoSQLActions.create_table:
                nanoSQLQuery2._create_table(queryArgs, action.args);
                break;
            case InanoSQLActions.alter_table:
                nanoSQLQuery2._alter_table(queryArgs, action.args);
                break;
            case InanoSQLActions.describe:
                nanoSQLQuery2._describe(queryArgs, action.args);
                break;
            case InanoSQLActions.show_tables:
                nanoSQLQuery2._show_tables(queryArgs, action.args);
                break;
            case InanoSQLActions.upsert:
                nanoSQLQuery2._upsert(queryArgs, action.args);
                break;
            case InanoSQLActions.delete:
                nanoSQLQuery2._delete(queryArgs, action.args);
                break;
            case InanoSQLActions.conform:
                nanoSQLQuery2._conform(queryArgs, action.args);
                break;
            case InanoSQLActions.rebuild_indexes:
                nanoSQLQuery2._rebuild_indexes(queryArgs, action.args);
                break;
            case InanoSQLActions.clone:
                nanoSQLQuery2._clone(queryArgs, action.args);
                break;
            case InanoSQLActions.custom_query:
                nSQL.doFilter<customQueryFilter>(pQuery.dbId, "customQuery", { res: undefined, query: pQuery, onRow: onRow, complete: () => { complete() }, error: (err) => { complete(err) } }, () => {
                    complete(Error(`nSQL: Query type ${pQuery.action} not supported!`));
                }, (err) => {
                    complete(err instanceof Error ? err : Error(err));
                });
                break;
            default:
                complete(Error("nSQL: Uknonwn action requested!"));
        }

    }


    static _select_arr(query: nanoSQLQueryArgs, args: ActionArgs_select_arr) {

        const rows = args.table;
        let i = 0;
        while(i < rows.length) {
            query.nextRow(i, rows[i]);
            i++;
        }
        query.nextRow(-1);

    }

    static _select_fn(query: nanoSQLQueryArgs, args: ActionArgs_select_fn) {
        if (args.as.length && query.state.savedTables[args.as]) {
            const rows = query.state.savedTables[args.as];
            let i = 0;
            while(i < rows.length) {
                query.nextRow(i, rows[i]);
                i++;
            }
            query.nextRow(-1);
        } else {
            args.table().then((rows) => {

                if (!Array.isArray(rows)) {
                    query.nextRow(-1, undefined, Error("nSQL: Promise table did not return array!"));
                    return;
                }

                if (args.as && args.as.length) {
                    query.state.savedTables[args.as] = rows;
                }

                let i = 0;
                while(i < rows.length) {
                    query.nextRow(i, rows[i]);
                    i++;
                }
                query.nextRow(-1);

            }).catch((err) => {
                query.nextRow(-1, undefined, err);
            })
        }
    }

    static _select_external(query: nanoSQLQueryArgs, args: ActionArgs_select_external) {
        args.query(args.queryArgs, (row, i) => {
            query.nextRow(i, row);
        }, (err) => {
            query.nextRow(-1, undefined, err);
        });
    }

    static _select_index(query: nanoSQLQueryArgs, args: ActionArgs_select_index, onlyPKs?: boolean) {

        const indexQuery = (() => {

            if (!args.where) return {type: "all", keys: []}; // get all values for this index

            if (args.index.isArray) { // array index query
                switch (args.where[1]) {
                    case "INCLUDES":
                        return {
                            type: "single",
                            lower: args.where[2],
                            keys: []
                        };
                    case "INCLUDES LIKE":
                        return {
                            type: "range",
                            lower: args.where[2].replace(/\%/gmi, "") + "0",
                            higher: args.where[2].replace(/\%/gmi, "") + "Z",
                            keys: []
                        };
                    case "INCLUDES BETWEEN":
                        return {
                            type: "range",
                            lower: args.where[2][0],
                            higher: args.where[2][1],
                            keys: []
                        };
                    case "INTERSECT":
                    case "INTERSECT ANY":
                        return {
                            type: "multi",
                            keys: args.where[2]
                        };
                    case "INTERSECT ALL":
                        return {
                            type: "multi",
                            keys: args.where[2],
                            intersectAll: true
                        };

                }
            } else { // normal index query
                switch(args.where[1]) {
                    case "LIKE":
                        return {
                            type: "range",
                            lower: args.where[2].replace(/\%/gmi, "") + "0",
                            higher: args.where[2].replace(/\%/gmi, "") + "Z",
                        }
                    case "BETWEEN":
                        return {
                            type: "range",
                            lower: args.where[2][0],
                            higher: args.where[2][1],
                        }
                    case "=":
                        return {
                            type: "single",
                            lower: args.where[2]
                        }
                    case "IN":
                        return {
                            type: "multi",
                            keys: args.where[2]
                        }
                }
            }

            return {type: "all", keys: []}; // get all values for this index

        })();

        const tableID = query.pQuery.db ? query.pQuery.db._tableIds[query.pQuery.table.str || ""] : "";

        if (!tableID) {
            query.nextRow(-1, undefined, Error(`nSQL: Table "${query.pQuery.table.str}" not found!`));
            return;
        }

        if (indexQuery.type === "single" || indexQuery.type === "multi") {

            const isIntersectAll = indexQuery.intersectAll || false;

            const getValues: any[] = indexQuery.keys ? indexQuery.keys : [indexQuery.lower];
            let j = 0;

            let pkObj: {[key: string]: number} = {};

            chainAsync(getValues, (indexValue, kk, nextI, errI) => {

                let pks: any[] = [];
                adapterFilters(query.pQuery.dbId, query.nSQL, query.pQuery).readIndexKey(tableID, args.index.id, indexValue, (rowPK) => {
                    if (isIntersectAll) {
                        if (!pkObj[rowPK]) {
                            pkObj[rowPK] = 1;
                        } else {
                            pkObj[rowPK]++;
                        }
                    } else {
                        if (onlyPKs) {
                            query.nextRow(j, rowPK);
                            j++;
                        } else {
                            pks.push(rowPK);
                        }
                    }

                }, () => {
                    if (pks.length) {
                        chainAsync(pks, (pk, i, next, err) => {
                            adapterFilters(query.pQuery.dbId, query.nSQL, query.pQuery).read(tableID, pk, (row) => {
                                query.nextRow(j, row);
                                j++;
                                next();
                            }, err);
                        }).then(() => {
                            nextI();
                        }).catch(errI);
                    } else {
                        nextI();
                    }

                }, errI);

            }).then(() => {

                if (isIntersectAll) {

                    let pks: any[] = [];
                    let k = 0;
                    Object.keys(pkObj).forEach((pk) => {
                        if (pkObj[pk] === getValues.length) {
                            if (onlyPKs) {
                                query.nextRow(k, pk as any);
                                k++;
                            } else {
                                pks.push(pk);
                            }
                        }
                    });

                    if (pks.length) {
                        chainAsync(pks, (pk, i, next, err) => {
                            adapterFilters(query.pQuery.dbId, query.nSQL, query.pQuery).read(tableID, pk, (row) => {
                                query.nextRow(k, row);
                                k++;
                                next();
                            }, err);
                        }).then(() => {
                            query.nextRow(-1);
                        }).catch((err) => {
                            query.nextRow(-1, undefined, Error(err));
                        });
                    } else {
                        query.nextRow(-1);
                    }
                } else {
                    query.nextRow(-1);
                }

            }).catch((err) => {
                query.nextRow(-1, undefined, Error(err));
            })

        } else {

            let pks: any[] = [];
            let pkObj: any = {};
            let i = 0;

            adapterFilters(query.pQuery.dbId, query.nSQL, query.pQuery).readIndexKeys(tableID, args.index.id, indexQuery.type as any, indexQuery.lower, indexQuery.higher, args.reverse || false, (primaryKey, id) => {

                if (pkObj[primaryKey]) return;

                if (onlyPKs) {
                    query.nextRow(i, primaryKey);
                    i++;
                } else {
                    pks.push(primaryKey);
                }

                pkObj[primaryKey] = true;

            }, () => {

                pkObj = {};

                if (onlyPKs) {

                    query.nextRow(-1);

                } else {

                    chainAsync(pks, (pk, i, next, err) => {
                        adapterFilters(query.pQuery.dbId, query.nSQL, query.pQuery).read(tableID, pk, (row) => {
                            query.nextRow(i, row);
                            i++;
                            next();
                        }, err);
                    }).then(() => {
                        query.nextRow(-1);
                    }).catch((err) => {
                        query.nextRow(-1, undefined, Error(err));
                    });
                }
            }, (err) => {
                query.nextRow(-1, undefined, Error(err));
            })
        }
    }

    static _select_pk(query: nanoSQLQueryArgs, args: ActionArgs_select_pk, onlyPKs?: boolean) {

        const tableID = query.pQuery.db ? query.pQuery.db._tableIds[query.pQuery.table.str || ""] : "";

        if (!tableID) {
            query.nextRow(-1, {}, Error(`nSQL: Table "${query.pQuery.table.str}" not found!`));
            return;
        }

        if (args.where && (args.where[1] === "=" || args.where[1] === "IN")) { // IN or =

            const pks = (args.where[1] === "=" ? [args.where[2]] : args.where[2] as any[]).map(v => nanoSQLQueryUtils._maybeResolveFunction(query.nSQL, query.pQuery, v));

            if (onlyPKs) {
                let i = 0;
                while(i < pks.length) {
                    query.nextRow(i, pks[i]);
                    i++;
                }
                query.nextRow(-1, undefined);

            } else {
                chainAsync(pks, (pk, i, next, error) => {
                    adapterFilters(query.pQuery.dbId, query.nSQL, query.pQuery).read(tableID, pk, (row) => {
                        query.nextRow(i,  row);
                        next();
                    }, (err) => {
                        error(err);
                    });
                }).then(() => {
                    query.nextRow(-1, undefined);
                }).catch((err) => {
                    query.nextRow(-1, {}, err);
                })
            }
        } else {

            const rangeArgs = (() => {
                if (args.where && args.where[1] === "LIKE") { // LIKE
                    return {
                        type: "range" as any,
                        lower: args.where[2].replace(/\%/gmi, "") + "0",
                        higher: args.where[2].replace(/\%/gmi, "") + "Z",
                    }
                } else if (args.where && args.where[1] === "BETWEEN") { // BETWEEN
                    return {
                        type: "range" as any,
                        lower: args.where[2][0],
                        higher: args.where[2][1],
                    }
                } else { // full table scan
                    return {
                        type: "all" as any,
                        lower: undefined,
                        higher: undefined,
                    }
                }
            })();

            let i = 0;
            const readRows = onlyPKs ? adapterFilters(query.pQuery.dbId, query.nSQL, query.pQuery).readMultiIndex : adapterFilters(query.pQuery.dbId, query.nSQL, query.pQuery).readMulti;

            readRows(tableID, rangeArgs.type, rangeArgs.lower, rangeArgs.higher, args.reverse || false, (row) => {
                query.nextRow(i, row);
                i++;
            }, () => {
                query.nextRow(-1);
            }, (err) => {
                query.nextRow(-1, undefined, err);
            });
        }

    }

    static _select_compound(query: nanoSQLQueryArgs, args: ActionArgs_select_compound) {

        let pks: {[pk: string]: number} = {};
        let max = 0;

        /*
        const tableID = query.pQuery.db ? query.pQuery.db._tableIds[query.pQuery.table.str || ""] : "";

        if (!tableID) {
            query.nextRow(-1, {}, Error(`nSQL: Table "${query.pQuery.table.str}" not found!`));
            return;
        }

        const tableConfig = query.pQuery.db ? query.pQuery.db._tables[tableID] : undefined;

        if (!tableConfig) {
            query.nextRow(-1, {}, Error(`nSQL: Table "${query.pQuery.table.str}" not found!`));
            return;
        }*/

        allAsync(args.where, (where, i, next, error) => {
            if (typeof where === "string") { // AND
                next();
            } else {
                max++;
                const select = where.do === InanoSQLActions.select_index ? this._select_index : this._select_pk;

                select({
                    ...query,
                    nextRow: (i, pk: any, err) => {
                        if (err) {
                            error(err);
                            return;
                        }

                        if (i === -1) {
                            next();
                            return;
                        }

                        if (!pks[pk]) {
                            pks[pk] = 1;
                        } else {
                            pks[pk]++;
                        }
                    }
                }, where.args as any, true);

            }
        }).then(() => {
            const getPKs: any[] = [];
            const allPks = Object.keys(pks);
            let i = allPks.length;
            while(i--) {
                const k = allPks[i];
                if (pks[k] === max) {
                    getPKs.unshift(k);
                }
            }

            this._select_pk(query, {
                as: args.as,
                table: args.table,
                where: ["", "IN", getPKs]
            });

        }).catch((err) => {
            query.nextRow(-1, undefined, Error(err));
        })
    }

    static _total(query: nanoSQLQueryArgs, args: ActionArgs_total) {
        const doRebuild = args.doRebuild;

        if (!query.pQuery.db) {
            query.nextRow(-1, undefined, Error(`nSQL: Database "${query.pQuery.dbId}" not found!`));
            return;
        }

        const tableID = query.pQuery.db ? query.pQuery.db._tableIds[query.pQuery.table.str || ""] : "";

        if (!tableID) {
            query.nextRow(-1, undefined, Error(`nSQL: Table "${query.pQuery.table.str}" not found!`));
            return;
        }

        if (doRebuild) {
            adapterFilters(query.pQuery.dbId, query.nSQL, query.pQuery).getTableIndexLength(args.table, (count) => {

                if (query.pQuery.db) {
                    query.pQuery.db._tables[tableID].count = count;
                    query.nSQL.saveCount(query.pQuery.dbId || "", args.table, (err) => {
                        if (err) {
                            query.nextRow(-1, undefined, Error(err));
                        } else {
                            query.nextRow(0, {total: count},);
                            query.nextRow(-1);
                        }
                    });
                }

            }, (err) => {
                query.nextRow(-1, undefined, Error(err));
            });
        } else {

            try {
                const total = query.pQuery.db._tables[tableID].count;

                query.nextRow(0, {total: total},);
                query.nextRow(-1);
            } catch (e) {
                query.nextRow(-1, undefined, Error(e));
            }

        }
    }

    static _drop_table(query: nanoSQLQueryArgs, args: ActionArgs_drop_table) {

    }

    static _create_table(query: nanoSQLQueryArgs, args: ActionArgs_create_table) {

    }

    static _alter_table(query: nanoSQLQueryArgs, args: ActionArgs_alter_table) {

    }

    static _describe(query: nanoSQLQueryArgs, args: ActionArgs_describe) {
        const tableConfig = query.pQuery.db ? query.pQuery.db._tables[query.pQuery.table.str || ""] : undefined;

        if (args) { // describe indexes
            if (query.pQuery.db && tableConfig) {
                Object.keys(tableConfig.indexes).forEach((idx, i) => {
                    query.nextRow(i, tableConfig[idx]);
                });
                query.nextRow(-1);
            }
        } else { // describe table
            if (query.pQuery.db && tableConfig) {
                Object.keys(tableConfig.columns).forEach((idx, i) => {
                    query.nextRow(i, tableConfig[idx]);
                });
                query.nextRow(-1);
            }
        }
    }

    static _show_tables(query: nanoSQLQueryArgs, args: ActionArgs_show_tables) {
        Object.keys(query.pQuery.db ? query.pQuery.db._tables : {}).forEach((table, i) => {
            query.nextRow(i, { table: table, id: query.pQuery.db ? query.pQuery.db._tableIds[table] : undefined });
        });
        query.nextRow(-1);
    }

    static _union(query: nanoSQLQueryArgs, args: ActionArgs_union) {

    }

    static _graph(query: nanoSQLQueryArgs, args: ActionArgs_graph) {

    }

    static _join(query: nanoSQLQueryArgs, args: ActionArgs_join) {

    }

    static _order(query: nanoSQLQueryArgs, args: ActionArgs_order) {
        if (!query.pQuery.orderBy) return;

        if (query.inputIndex !== -1) { // load rows before complete
            query.state.orderByCache.push(query.inputRow);
        } else { // on complete do orderBy
            const sorted = nanoSQLQueryUtils.quickSort(query.nSQL, query.pQuery, query.state.orderByCache, args);

            let i = 0;
            while(i < sorted.length) {
                query.nextRow(i, sorted[i]);
                i++;
            }

            query.state.orderByCache = [];

            query.nextRow(-1);
        }
    }

    static _group(query: nanoSQLQueryArgs, args: ActionArgs_group) {

        if (query.inputIndex !== -1) { // load rows before complete
            query.state.orderByCache.push(query.inputRow);
        } else { // on complete do orderBy
            const sorted = nanoSQLQueryUtils.quickSort(query.nSQL, query.pQuery, query.state.orderByCache, args.groupBy);

            let i = 0;
            while(i < sorted.length) {
                query.nextRow(i, sorted[i]);
                i++;
            }

            query.state.orderByCache = [];

            query.nextRow(-1);
        }

    }

    static _functions(query: nanoSQLQueryArgs, args: ActionArgs_functions) {

    }

    static _range(query: nanoSQLQueryArgs, args: ActionArgs_range) {

        if (query.inputIndex === -1) {
            query.nextRow(-1);
            return;
        }

        if (query.inputIndex >= args[0] && query.inputIndex < args[1]) {
            query.nextRow(query.inputIndex - args[0], query.inputRow);
        }
    }

    static _filter_arr(query: nanoSQLQueryArgs, args: ActionArgs_filter_arr) {

        if (query.inputIndex === -1) {
            query.nextRow(-1);
            return;
        }

        if (nanoSQLQueryUtils._where(query.nSQL, query.pQuery, query.inputRow, args)) {
            query.nextRow(query.inputIndex, query.inputRow);
        }
    }

    static _filter_fn(query: nanoSQLQueryArgs, args: ActionArgs_filter_fn) {

        if (query.inputIndex === -1) {
            query.nextRow(-1);
            return;
        }

        if (args(query.inputRow, query.inputIndex)) {
            query.nextRow(query.inputIndex, query.inputRow);
        }
    }

    static _distinct(query: nanoSQLQueryArgs, args: ActionArgs_distinct) {

        if (query.inputIndex === -1) {
            query.nextRow(-1);
            return;
        }

        const key = nanoSQLQueryUtils._generateDistinctKey(query.nSQL, query.pQuery, query.inputRow, args);

        if (!query.state.distinctKeys[key]) {
            query.nextRow(query.inputIndex, query.inputRow);
            query.state.distinctKeys[key] = true;
        }

    }

    static _upsert(query: nanoSQLQueryArgs, args: ActionArgs_upsert) {

    }

    static _delete(query: nanoSQLQueryArgs, args: ActionArgs_delete) {

    }

    static _conform(query: nanoSQLQueryArgs, args: ActionArgs_conform) {

    }

    static _rebuild_indexes(query: nanoSQLQueryArgs, args: ActionArgs_rebuild_indexes) {

    }

    static _clone(query: nanoSQLQueryArgs, args: ActionArgs_clone) {

    }

}

export class nanoSQLQueryUtils {

    static _indexLocks: {
        [lockID: string]: {
            [indexValue: string]: boolean;
        }
    } = {};

    static _maybeResolveFunction(nSQL: InanoSQLInstance, query: InanoSQLQueryAST, fn: any | InanoSQLFunctionQuery) {
        if (fn && fn.name && fn.args) { // function
            const useFn = nSQL.functions[fn.name];
            if (!useFn) return fn;
            const fnReturn = useFn.call(query, fn.args[0], {result: undefined}, ...fn.args.slice(1));
            if (fnReturn.result) return fnReturn.result;
            return fnReturn;
        } else { // not a function
            return fn;
        }

    }

    static quickSort(nSQL: InanoSQLInstance, query: InanoSQLQueryAST, arr: any[], columns: InanoSQLProcessedSort[]): any[] {

        // if just 1 column to sort by, we can do standard javascript sort
        if (columns.length <= 1) return arr.sort((a, b) => {
            const colVal = columns[0];
            if (typeof colVal.value !== "string") {
                const a1 = this._doFunction(nSQL, query, colVal.value, a);
                const b1 = this._doFunction(nSQL, query, colVal.value, b);
                if (a1 === b1) return 0;
                return (a1 > b1 ? 1 : -1) * (colVal.dir === "desc" ? -1 : 1);
            } else {
                const a1 = deepGet(colVal.value as string, a);
                const b1 = deepGet(colVal.value as string, b);
                if (a1 === b1) return 0;
                return (a1 > b1 ? 1 : -1) * (colVal.dir === "desc" ? -1 : 1);
            }
        });

        // if more than 1 column, need to do quick sort algorithm to get consistent results

        if (arr.length < 2) return arr;

        const pivotPoint = Math.floor(Math.random() * arr.length);

        const getValues = (row): {v: any, d: "ASC"|"DESC"}[] => {
            return columns.reduce((prev, cur) => {
                if (typeof cur.value !== "string" && cur.value._nSQL) { // function on orderby column
                    prev.push({
                        d: cur.dir,
                        v: this._doFunction(nSQL, query, cur.value, row)
                    })
                } else { // not a function
                    prev.push({
                        d: cur.dir,
                        v: deepGet(cur.value as string, row)
                    })
                }

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

        return this.quickSort(nSQL, query, left, columns).concat(equal).concat(this.quickSort(nSQL, query, right, columns));
    }

    static _where(nSQL: InanoSQLInstance, query: InanoSQLQueryAST, singleRow: any, where: InanoSQLWhereQuery): boolean {

        if (where.STMT) { // bottom of nested WHERE
            return this._compare(nSQL, query, where.STMT, singleRow);
        } else if (where.NESTED) {
            let prevCondition: string = "AND";
            let idx = 0;
            let matches = true;

            while(idx < where.NESTED.length) {
                if (idx % 2 === 1) { // AND/OR
                    prevCondition = where.NESTED[idx].ANDOR as string;
                } else {
                    let compareResult = false;

                    if (where.NESTED[idx].NESTED) { // further nesting
                        compareResult = this._where(nSQL, query, singleRow, where.NESTED[idx]);
                    } else {
                        compareResult = this._compare(nSQL, query, where.NESTED[idx].STMT as InanoSQLWhereStatement, singleRow);
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
        }

        return false;
    }

    static _generateDistinctKey = (nSQL: InanoSQLInstance, query: InanoSQLQueryAST, row: any, arg: ActionArgs_distinct): string => {
        return arg.reduce((prev, cur) => {
            if (typeof cur === "string") {
                return prev + JSON.stringify(deepGet(cur, row) || {});
            } else {
                return prev + JSON.stringify(nanoSQLQueryUtils._doFunction(nSQL, query, cur, row) || {});
            }
        }, "") as string;
    }

    static _doFunction(nSQL: InanoSQLInstance, query: InanoSQLQueryAST, call: InanoSQLFunctionQuery, row: any) {
        const fn = nSQL.functions[call.name];
        if (!fn) {
            throw new Error(`nSQL: Function ${call.name} not found!`);
        }
        return fn.call(query, row, fn.aggregateStart as any, ...call.args);
    }

    static _likeCache: { [likeQuery: string]: RegExp } = {};

    static _processLIKE(columnValue: string, givenValue: string): boolean {
        if (!this._likeCache[givenValue]) {
            let prevChar = "";
            const len = givenValue.split("").length - 1;
            this._likeCache[givenValue] = new RegExp(givenValue.split("").map((s, i) => {
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
                return String(columnValue).match(this._likeCache[givenValue]) !== null;
            } else {
                return JSON.stringify(columnValue).match(this._likeCache[givenValue]) !== null;
            }
        }
        return columnValue.match(this._likeCache[givenValue]) !== null;
    }

    static _compare(nSQL: InanoSQLInstance, query: InanoSQLQueryAST, where: InanoSQLWhereStatement, wholeRow: any): boolean {

        const columnValue = typeof where[0] === "string" ? deepGet(where[0], wholeRow) : this._doFunction(nSQL, query, where[0], wholeRow);

        const givenValue = (() => {
            // function call
            if (where[2] && where[2]._nSQL && where[2]._nSQL === nSQL) return this._doFunction(nSQL, query, where[2], wholeRow);
            if (where[2] && Array.isArray(where[2])) {
                return where[2].map(v => {
                    if (v && v._nSQL && v._nSQL === nSQL) return this._doFunction(nSQL, query, v, wholeRow);
                    return v;
                });
            }
            return where[2];
        })();

        const compare = where[1];

        if (givenValue === "NULL" || givenValue === "NOT NULL") {
            const isNull = [undefined, null, ""].indexOf(columnValue) !== -1;
            const isEqual = compare === "=" || compare === "LIKE";
            switch (givenValue) {
                case "NULL": return isEqual ? isNull : !isNull;
                case "NOT NULL": return isEqual ? !isNull : isNull;
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
            // if values in array column are between given values
            case "INCLUDES BETWEEN": return (columnValue || []).filter(v => givenValue[0] <= v && givenValue[1] >= v).length > 0;
            // if single value does not exist in array column
            case "NOT INCLUDES":
            case "DOES NOT INCLUDE": return (columnValue || []).indexOf(givenValue) === -1;
            // if array of values intersects with array column
            case "INTERSECT":
            case "INTERSECT ANY": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length > 0;
            // if every value in the provided array exists in the array column
            case "INTERSECT ALL": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length === givenValue.length;
            // if array of values does not intersect with array column
            case "NOT INTERSECT":
            case "INTERSECT NONE": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length === 0;
            default: return false;
        }
    }
}