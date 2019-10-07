import {
    InanoSQLInstance,
    InanoSQLQueryAST,
    InanoSQLProcessedSort,
    InanoSQLUnionArgs,
    InanoSQLFunctionQuery, InanoSQLGraphArgs, InanoSQLJoinArgs, InanoSQLProcessedWhere, InanoSQLTable, InanoSQLAdapter
} from "./interfaces";
import { QueryArguments } from "./utilities";
import has = Reflect.has;

export enum InanoSQLActions {
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
        where?: InanoSQLProcessedWhere;
        range?: [number, number]
        rebuildTotal?: boolean;
        upsert?: any;
        describeIndexes?: boolean;
        tableQuery?: InanoSQLTable,
        conformFn?: (oldRow: any) => any;
        clone?: {
            mode: string | InanoSQLAdapter,
            id?: string
            getAdapter?: (adapter: InanoSQLAdapter) => void;
        }
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

        const queryMethods = queryWillSelect ? this.resolveSelectActions(nSQL, pQuery) : {actions: [], alreadyOrderBy: false, alreadyRange: false};


        if (queryWillSelect && isSelect) {

            const hasAggregateFn: boolean = this.hasAggrFn(nSQL, pQuery);

            if (pQuery.union) {
                queryMethods.actions.push({
                    do: InanoSQLActions.union,
                    args: {union: pQuery.union}
                })
            }

            if (pQuery.graph) {
                queryMethods.actions.push({
                    do: InanoSQLActions.graph,
                    args: {graph: pQuery.graph}
                })
            }

            if (pQuery.join) {
                queryMethods.actions.push({
                    do: InanoSQLActions.join,
                    args: {join: pQuery.join}
                });
            }

            if (pQuery.groupBy) {
                queryMethods.actions.push({
                    do: InanoSQLActions.group,
                    args: {groupBy: pQuery.groupBy, reduce: hasAggregateFn && pQuery.args.select ? pQuery.args.select.map(v => v.value) : undefined}
                })
            }

            if (pQuery.args.select && pQuery.args.select.length) {
                queryMethods.actions.push({
                    do: InanoSQLActions.functions,
                    args: {select: pQuery.args.select ? pQuery.args.select.map(v => v.value) : undefined}
                })
            }

            if (pQuery.distinct) {
                queryMethods.actions.push({
                    do: InanoSQLActions.distinct,
                    args: {distinct: pQuery.distinct}
                })
            }

            if (pQuery.orderBy && !queryMethods.alreadyOrderBy) {
                queryMethods.actions.push({
                    do: InanoSQLActions.order,
                    args: {orderBy: pQuery.orderBy}
                })
            }

            if (pQuery.having) {
                queryMethods.actions.push({
                    do: InanoSQLActions.where,
                    args: {where: pQuery.having}
                })
            }

            if (pQuery.range && pQuery.range.length && !queryMethods.alreadyRange) {
                queryMethods.actions.push({
                    do: InanoSQLActions.range,
                    args: {range: pQuery.range}
                })
            }
        }

        switch(pQuery.action) {
            case "select":
                // nothing to do, this is needed to prevent SELECT from doing default case
                break;
            case "total":
                queryMethods.actions.push({
                    do: InanoSQLActions.total,
                    args: {rebuildTotal: !!(pQuery.args.raw && pQuery.args.raw.rebuild)}
                });
                break;
            case "upsert":
                queryMethods.actions.push({
                    do: InanoSQLActions.upsert,
                    args: {upsert: pQuery.args.raw}
                });
                break;
            case "delete":
                queryMethods.actions.push({
                    do: InanoSQLActions.delete,
                    args: {}
                });
                break;
            case "show tables":
                queryMethods.actions.push({
                    do: InanoSQLActions.show_tables,
                    args: {}
                });
                break;
            case "describe":
                queryMethods.actions.push({
                    do: InanoSQLActions.describe,
                    args: {}
                });
                break;
            case "describe indexes":
                queryMethods.actions.push({
                    do: InanoSQLActions.describe,
                    args: {describeIndexes: true}
                });
                break;
            case "drop":
            case "drop table":
                queryMethods.actions.push({
                    do: InanoSQLActions.dropTable,
                    args: {}
                });
                break;
            case "create table":
            case "create table if not exists":
                queryMethods.actions.push({
                    do: InanoSQLActions.createTable,
                    args: {tableQuery: pQuery.args.raw}
                });
                break;
            case "alter table":
                queryMethods.actions.push({
                    do: InanoSQLActions.alterTable,
                    args: {tableQuery: pQuery.args.raw}
                });
                break;
            case "rebuild indexes":
                queryMethods.actions.push({
                    do: InanoSQLActions.rebuildIndexes,
                    args: {}
                });
                break;
            case "conform rows":
                queryMethods.actions.push({
                    do: InanoSQLActions.conform,
                    args: {conformFn: pQuery.args.raw}
                });
                break;
            case "clone":
                queryMethods.actions.push({
                    do: InanoSQLActions.clone,
                    args: {clone: pQuery.args.raw}
                });
                break;
            default:
                // custom query

        }

        return queryMethods.actions;
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

        }
    }

    private static hasAggrFn(nSQL: InanoSQLInstance, pQuery: InanoSQLQueryAST): boolean {
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