import {
    InanoSQLInstance,
    InanoSQLQueryAST,
    InanoSQLProcessedSort,
    InanoSQLUnionArgs,
    InanoSQLFunctionQuery,
    InanoSQLGraphArgs,
    InanoSQLJoinArgs,
    InanoSQLProcessedWhere,
    InanoSQLTable,
    InanoSQLAdapter,
    customQueryFilter, InanoSQLWhereQuery, InanoSQLWhereStatement, InanoSQLDBConfig, InanoSQLIndex, InanoSQLWhereIndex
} from "./interfaces";
import {objectsEqual, QueryArguments, resolvePath} from "./utilities";

export enum InanoSQLActions {
    doWhere,
    customQuery,
    dropTable,
    createTable,
    alterTable,
    describe,
    show_tables,
    union, 
    graph, 
    join, 
    order,
    group, 
    selectFull, 
    selectIndex, 
    selectPK, 
    selectExternal,
    selectCompound,
    functions,
    range, 
    where, 
    distinct,
    upsert,
    delete, 
    conform, 
    rebuildIndexes, 
    clone,
    plugin,
    total
}

export interface InanoSQLQueryActions {
    do: InanoSQLActions,
    args: {
        selectMultiple?: (InanoSQLActions|string)[],
        table_str?: string;
        table_arr?: any[];
        table_prms?: () => Promise<any[]>;
        table_db?: {
            query: (args: QueryArguments, onRow: (row: any, i: number) => void, complete: (error?: Error) => void) => void, 
            args: QueryArguments
        },
        orderBy?: InanoSQLProcessedSort[],
        groupBy?: InanoSQLProcessedSort[],
        union?: InanoSQLUnionArgs;
        distinct?: (InanoSQLFunctionQuery | string)[];
        graph?: InanoSQLGraphArgs[];
        join?: InanoSQLJoinArgs[];
        reduce?: (InanoSQLFunctionQuery | string)[];
        select?: (InanoSQLFunctionQuery | string)[];
        where?: InanoSQLWhereQuery;
        whereFn?: (row: {[key: string]: any; }, i?: number) => boolean;
        singleWhere?: InanoSQLWhereStatement;
        range?: [number, number]
        rebuildTotal?: boolean;
        upsert?: any | any[];
        describeIndexes?: boolean;
        tableQuery?: InanoSQLTable,
        conformFn?: (oldRow: any) => any;
        clone?: {
            mode: string | InanoSQLAdapter,
            id?: string
            getAdapter?: (adapter: InanoSQLAdapter) => void;
        },
        customQueryArg?: any;
        reverse?: boolean;
    }
}

export class QueryPrepare {

    /**
     * Builds an optimized list of actions for the query engine to perform.
     * 
     * Once the list is built, we can execute the query.
     * @static
     * @param {InanoSQLInstance} nSQL
     * @param {InanoSQLQueryAST} pQuery
     * @returns {InanoSQLQueryActions[]}
     * @memberof PrepareQuery
     */
    static prepare(nSQL: InanoSQLInstance, pQuery: InanoSQLQueryAST): InanoSQLQueryActions[] {

        const queryWillSelect = ["select", "upsert", "delete", "rebuild indexes", "conform rows", "clone"].indexOf(pQuery.action) !== -1;
        const isSelect = pQuery.action === "select";

        const queryProcess = queryWillSelect ? this.resolveSelectActions(nSQL, pQuery) : {actions: [], alreadyOrderBy: false, alreadyRange: false};

        if (queryWillSelect) {

            const hasAggregateFn: boolean = this.hasAggrFn(nSQL, pQuery);

            if (isSelect) {
                if (pQuery.union) {
                    queryProcess.actions.push({
                        do: InanoSQLActions.union,
                        args: {union: pQuery.union}
                    })
                }

                if (pQuery.graph) {
                    queryProcess.actions.push({
                        do: InanoSQLActions.graph,
                        args: {graph: pQuery.graph}
                    })
                }

                if (pQuery.join) {
                    queryProcess.actions.push({
                        do: InanoSQLActions.join,
                        args: {join: pQuery.join}
                    });
                }

                if (pQuery.groupBy) {
                    queryProcess.actions.push({
                        do: InanoSQLActions.group,
                        args: {
                            groupBy: pQuery.groupBy,
                            reduce: hasAggregateFn && pQuery.args.select ? pQuery.args.select.map(v => v.value) : undefined
                        }
                    })
                }

                if (pQuery.args.select && pQuery.args.select.length) {
                    queryProcess.actions.push({
                        do: InanoSQLActions.functions,
                        args: {select: pQuery.args.select ? pQuery.args.select.map(v => v.value) : undefined}
                    })
                }

                if (pQuery.distinct) {
                    queryProcess.actions.push({
                        do: InanoSQLActions.distinct,
                        args: {distinct: pQuery.distinct}
                    })
                }

                if (pQuery.orderBy && !queryProcess.alreadyOrderBy) {
                    queryProcess.actions.push({
                        do: InanoSQLActions.order,
                        args: {orderBy: pQuery.orderBy}
                    })
                }
            }

            if (pQuery.having) {
                queryProcess.actions.push({
                    do: InanoSQLActions.where,
                    args: {
                        where: pQuery.having.type === "arr" ? pQuery.having.arr : undefined,
                        whereFn: pQuery.having.type === "fn" ? pQuery.having.eval : undefined
                    }
                })
            }

            if (pQuery.range && pQuery.range.length && !queryProcess.alreadyRange) {
                queryProcess.actions.push({
                    do: InanoSQLActions.range,
                    args: {range: pQuery.range}
                });
            }
        }

        switch(pQuery.action) {
            case "select":
                // nothing to do, this is needed to prevent SELECT from doing default case
                break;
            case "total":
                queryProcess.actions.push({
                    do: InanoSQLActions.total,
                    args: {rebuildTotal: !!(pQuery.args.raw && pQuery.args.raw.rebuild)}
                });
                break;
            case "upsert":
                queryProcess.actions.push({
                    do: InanoSQLActions.upsert,
                    args: {upsert: pQuery.args.raw}
                });
                break;
            case "delete":
                queryProcess.actions.push({
                    do: InanoSQLActions.delete,
                    args: {}
                });
                break;
            case "show tables":
                queryProcess.actions.push({
                    do: InanoSQLActions.show_tables,
                    args: {}
                });
                break;
            case "describe":
                queryProcess.actions.push({
                    do: InanoSQLActions.describe,
                    args: {}
                });
                break;
            case "describe indexes":
                queryProcess.actions.push({
                    do: InanoSQLActions.describe,
                    args: {describeIndexes: true}
                });
                break;
            case "drop":
            case "drop table":
                queryProcess.actions.push({
                    do: InanoSQLActions.dropTable,
                    args: {}
                });
                break;
            case "create table":
            case "create table if not exists":
                queryProcess.actions.push({
                    do: InanoSQLActions.createTable,
                    args: {tableQuery: pQuery.args.raw}
                });
                break;
            case "alter table":
                queryProcess.actions.push({
                    do: InanoSQLActions.alterTable,
                    args: {tableQuery: pQuery.args.raw}
                });
                break;
            case "rebuild indexes":
                queryProcess.actions.push({
                    do: InanoSQLActions.rebuildIndexes,
                    args: {}
                });
                break;
            case "conform rows":
                queryProcess.actions.push({
                    do: InanoSQLActions.conform,
                    args: {conformFn: pQuery.args.raw}
                });
                break;
            case "clone":
                queryProcess.actions.push({
                    do: InanoSQLActions.clone,
                    args: {clone: pQuery.args.raw}
                });
                break;
            default:
                // custom query
                queryProcess.actions.push({
                    do: InanoSQLActions.customQuery,
                    args: {customQueryArg: pQuery.args.raw}
                })
        }

        return queryProcess.actions;
    }

    static resolveSelectActions(nSQL: InanoSQLInstance, pQuery: InanoSQLQueryAST): {actions: InanoSQLQueryActions[], alreadyOrderBy: boolean, alreadyRange: boolean} {

        if(pQuery.table.arr || pQuery.table.prms) { // async tables or array tables

            const actions: InanoSQLQueryActions[] = [];

            actions.push({
                do: InanoSQLActions.selectFull,
                args: {
                    table_arr: pQuery.table.arr,
                    table_prms: pQuery.table.prms
                }
            });

            if (pQuery.where) {
                actions.push({
                    do: InanoSQLActions.doWhere,
                    args: {
                        where: pQuery.where.type === "arr" ? pQuery.where.arr : undefined,
                        whereFn: pQuery.where.type === "fn" ? pQuery.where.eval : undefined
                    }
                })
            }
            
            return {
                actions: actions,
                alreadyOrderBy: false,
                alreadyRange: false
            };

        } else if (pQuery.table.db) { // external database reference

            const actions: InanoSQLQueryActions[] = [];

            actions.push({
                do: InanoSQLActions.selectExternal,
                args: {
                    table_db: {query: pQuery.table.db.query, args: new QueryArguments(
                        pQuery.table.db.as, 
                        pQuery.originalWhere, 
                        pQuery.range ? pQuery.range[0] : undefined,
                        pQuery.range ? pQuery.range[0] - pQuery.range[1] : undefined,
                        pQuery.orderBy ? pQuery.orderBy.map(v => `${v.value} ${v.dir}`) : undefined
                    )}
                }
            });
            
            return {
                actions: actions,
                alreadyRange: true,
                alreadyOrderBy: true
            }

        } else { // local database

            const actions: InanoSQLQueryActions[] = [];

            // step 1, see if we have a WHERE statement

            let whereIndexes: InanoSQLWhereIndex[] = [];

            const fullTableScan = (didSort?: boolean, reverse?: boolean, range?: [number, number]) => {
                actions.push({
                    do: InanoSQLActions.selectFull,
                    args: {
                        table_str: pQuery.table as string,
                        reverse: reverse,
                        range: range
                    }
                });

                if (pQuery.where) {
                    actions.push({
                        do: InanoSQLActions.doWhere,
                        args: {
                            where: pQuery.where.type === "arr" ? pQuery.where.arr : undefined,
                            whereFn: pQuery.where.type === "fn" ? pQuery.where.eval : undefined
                        }
                    });
                }

                return {actions: actions, alreadyOrderBy: didSort || false, alreadyRange: range ? true : false};
            }

            if (pQuery.where) {
                if (pQuery.where.type === "fn") { // function WHERE, full table scan

                    return fullTableScan();

                } else { // array where, need to figure out fastest select method

                    const whereStatements = pQuery.where.arr as InanoSQLWhereQuery;

                    if (whereStatements.STMT) { // single where
                        whereIndexes = [this.findWhereIndexes(whereStatements.STMT, nSQL, pQuery)];
                    } else if(whereStatements.NESTED) { // compound where
                        whereStatements.NESTED.forEach((val, i) => {
                            if (val.STMT) {
                                whereIndexes.push(this.findWhereIndexes(val.STMT, nSQL, pQuery));
                            } else if (val.NESTED) { // nested array WHERE will not be evaluated
                                whereIndexes.push({type: "null", value: [], where: ["", "", ""]});
                            } else if (val.ANDOR) {
                                whereIndexes.push({type: "andor", value: [val.ANDOR], where: ["", "", ""]});
                            }
                        });
                    }

                    // if the first WHERE isn't an index/primary key we do full table scan
                    if (["pk", "idx"].indexOf(whereIndexes[0].type) === -1) {
                        return fullTableScan();
                    }

                    let didOrderBy = false;
                    let didRange = false;

                    if (whereIndexes.length === 1) { // single where statement

                        const pkAction: InanoSQLQueryActions  = {
                            do: whereIndexes[0].type === "pk" ? InanoSQLActions.selectPK : InanoSQLActions.selectIndex,
                            args: {singleWhere: whereIndexes[0].where}
                        };

                        if (pQuery.orderBy && pQuery.orderBy.length === 1) {
                            if (typeof pQuery.orderBy[0].value === "string") {
                                const col = resolvePath(pQuery.orderBy[0].value);
                                if (objectsEqual(col, whereIndexes[0].value)) {
                                    didOrderBy = true;
                                    if (pQuery.orderBy[0].dir === "desc") {
                                        pkAction.args.reverse = true;
                                    }
                                }
                            }
                        } else if (!pQuery.orderBy) {
                            didOrderBy = true;
                        }

                        if (didOrderBy && !pQuery.groupBy && pQuery.range) {
                            didRange = true;
                            pkAction.args.range = pQuery.range;
                        }

                        return {actions: [pkAction], alreadyRange: didRange, alreadyOrderBy: didOrderBy};

                    } else { // compound where statement

                        const compoundAction: InanoSQLQueryActions = {do: InanoSQLActions.selectCompound, args: {selectMultiple: []}}

                        whereIndexes.forEach((whereIndex, i) => {
                            if (i % 1 === 1) {

                            } else if (["pk", "idx"].indexOf(whereIndex.type) !== -1) {
                                (compoundAction.args.selectMultiple as any).push({
                                    do: whereIndex.type === "pk" ? InanoSQLActions.selectPK : InanoSQLActions.selectIndex,
                                    args: {singleWhere: whereIndex.where}
                                });
                                if (i === 0) {

                                }
                            }
                        });
                    }
                }
            } else {
                // no WHERE statement
                if (!pQuery.groupBy && pQuery.range) {

                }
            }
        }
    }

    static findWhereIndexes(where: InanoSQLWhereStatement, nSQL: InanoSQLInstance, pQuery: InanoSQLQueryAST): InanoSQLWhereIndex {

        // if there is no database selected, then no query optizations are possible.
        if (!pQuery.db || pQuery.table !== "string") return {type: "null", value: [], where: ["", "", ""]};

        const tableId = (pQuery.db as InanoSQLDBConfig)._tableIds[pQuery.table as string];
        const tableCnfg = (pQuery.db as InanoSQLDBConfig)._tables[tableId];

        const supportedMatches = ["LIKE", "BETWEEN", "=", "IN", ">=", "<=", "<", ">"];
        const supportedMatchesArr = ["INCLUDES", "INTERSECT ALL", "INTERSECT", "INCLUDES LIKE"];

        if (typeof where[0] === "string") {
            const objectPath = resolvePath(where[0]);
            const objectMatchType = where[1];
            if (objectsEqual(objectPath, tableCnfg.pkCol)) {
                return {type: "pk", value: objectPath, where: where};
            }
            const index = Object.keys(tableCnfg.indexes).reduce((prev, index) => {
                const idx = tableCnfg.indexes[index];
                if (objectsEqual(objectPath, idx.path)) {
                    if (idx.isArray) {
                        if (supportedMatchesArr.indexOf(objectMatchType) !== -1) {
                            return {type: "idx", value: objectPath, index: idx, where: where};
                        }
                    } else {
                        if (supportedMatches.indexOf(objectMatchType) !== -1) {
                            return {type: "idx", value: objectPath, index: idx, where: where};
                        }
                    }
                }
                return prev;
            }, undefined);
            if (index) return (index as any);
        } else {
            // where statement with function on left side isn't supported for indexing
            // TODO: evaluate arguments/functions recursively to discover if we can resolve to index or primary key
            return {type: "null", value: [], where: ["", "", ""]};
        }


        return {type: "null", value: [], where: ["", "", ""]};
    }


    static hasAggrFn(nSQL: InanoSQLInstance, pQuery: InanoSQLQueryAST): boolean {
        if (pQuery.args.select && pQuery.args.select.length) {

            // only checks top level of SELECT arguments
            let hasAggr = false;

            let i = 0;
            while(i < pQuery.args.select.length && hasAggr === false) {
                const selectArg = pQuery.args.select[i];
                if (typeof selectArg.value !== "string") { // function in SELECT
                    const fnName = selectArg.value.name;
                    const fnOpts = nSQL.functions[fnName];
                    if (!fnOpts) {
                        throw new Error(`Function ${fnName} not found!`);
                    }
                    if (fnOpts.type === "A") {
                        hasAggr = true;
                    }
                }
                i++;
            }

            return hasAggr;


        } else {
            return false;
        }
    }

}