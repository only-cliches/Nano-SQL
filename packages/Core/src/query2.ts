import {
    ActionArgs_alter_table, ActionArgs_clone, ActionArgs_conform,
    ActionArgs_create_table, ActionArgs_custom_query, ActionArgs_delete,
    ActionArgs_describe, ActionArgs_distinct,
    ActionArgs_drop_table, ActionArgs_filter_arr, ActionArgs_filter_fn,
    ActionArgs_functions,
    ActionArgs_graph,
    ActionArgs_group,
    ActionArgs_join,
    ActionArgs_order,
    ActionArgs_range, ActionArgs_rebuild_indexes,
    ActionArgs_select_arr,
    ActionArgs_select_compound,
    ActionArgs_select_external,
    ActionArgs_select_fn,
    ActionArgs_select_index,
    ActionArgs_select_pk,
    ActionArgs_show_tables,
    ActionArgs_total,
    ActionArgs_union, ActionArgs_upsert,
    InanoSQLActions,
    InanoSQLInstance,
    InanoSQLQuery2,
    InanoSQLQueryActions,
    InanoSQLQueryAST
} from "./interfaces";
import {QueryAST} from "./query2-ast";
import {QueryPrepare} from "./query2-prepare";
import {callOnce} from "./utilities";


export interface nanoSQLQueryArgs {
    nSQL: InanoSQLInstance,
    pQuery: InanoSQLQueryAST,
    state: nanoSQLQueryState,
    inputRow: any,
    inputIndex: number,
    nextRow: (row: any, i: number, err?: Error) => void
}

export interface nanoSQLQueryState {
    perf: {what: string|number, time: number, delta: number, total: number}[],
    savedTables: {[name: string]: any[]};
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
            savedTables: {}
        }

        // step 3, execute query
        nanoSQLQuery2.stepQuery(nSQL, queryState, queryAST, preparedQuery, 0, undefined, 0, progress, callOnce(complete));

    } catch (e) {
        complete(e);
    }
}

export class nanoSQLQuery2 {
    static stepQuery(nSQL: InanoSQLInstance, state: nanoSQLQueryState, pQuery: InanoSQLQueryAST, actions: InanoSQLQueryActions[], actionIndex: number, inputRow: any, inputIndex: number, onRow: (row: any, i: number) => void, complete: (err?:  Error) => void) {
        const action = actions[actionIndex];

        const nextAction = actions[actionIndex + 1];

        const nextRow = (row: any, i: number, err?: Error) => {
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
                } else {
                    nanoSQLQuery2.stepQuery(nSQL, state, pQuery,  actions, actionIndex + 1, row, i, onRow, complete);
                }
                return;
            }

            if (nextAction) {
                nanoSQLQuery2.stepQuery(nSQL, state, pQuery, actions, actionIndex + 1, row, i, onRow, complete);
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
                nanoSQLQuery2.select_arr(queryArgs, action.args);
                break;
            case InanoSQLActions.select_fn:
                nanoSQLQuery2.select_fn(queryArgs, action.args);
                break;
            case InanoSQLActions.select_index:
                nanoSQLQuery2.select_index(queryArgs, action.args);
                break;
            case InanoSQLActions.select_pk:
                nanoSQLQuery2.select_pk(queryArgs, action.args);
                break;
            case InanoSQLActions.select_external:
                nanoSQLQuery2.select_external(queryArgs, action.args);
                break;
            case InanoSQLActions.select_compound:
                nanoSQLQuery2.select_compound(queryArgs, action.args);
                break;
            case InanoSQLActions.total:
                nanoSQLQuery2.total(queryArgs, action.args);
                break;
            case InanoSQLActions.filter_arr:
                nanoSQLQuery2.filter_arr(queryArgs, action.args);
                break;
            case InanoSQLActions.filter_fn:
                nanoSQLQuery2.filter_fn(queryArgs, action.args);
                break;
            case InanoSQLActions.union:
                nanoSQLQuery2.union(queryArgs, action.args);
                break;
            case InanoSQLActions.graph:
                nanoSQLQuery2.graph(queryArgs, action.args);
                break;
            case InanoSQLActions.join:
                nanoSQLQuery2.join(queryArgs, action.args);
                break;
            case InanoSQLActions.order:
                nanoSQLQuery2.order(queryArgs, action.args);
                break;
            case InanoSQLActions.group:
                nanoSQLQuery2.group(queryArgs, action.args);
                break;
            case InanoSQLActions.functions:
                nanoSQLQuery2.functions(queryArgs, action.args);
                break;
            case InanoSQLActions.range:
                nanoSQLQuery2.range(queryArgs, action.args);
                break;
            case InanoSQLActions.distinct:
                nanoSQLQuery2.distinct(queryArgs, action.args);
                break;
            case InanoSQLActions.drop_table:
                nanoSQLQuery2.drop_table(queryArgs, action.args);
                break;
            case InanoSQLActions.create_table:
                nanoSQLQuery2.create_table(queryArgs, action.args);
                break;
            case InanoSQLActions.alter_table:
                nanoSQLQuery2.alter_table(queryArgs, action.args);
                break;
            case InanoSQLActions.describe:
                nanoSQLQuery2.describe(queryArgs, action.args);
                break;
            case InanoSQLActions.show_tables:
                nanoSQLQuery2.show_tables(queryArgs, action.args);
                break;
            case InanoSQLActions.upsert:
                nanoSQLQuery2.upsert(queryArgs, action.args);
                break;
            case InanoSQLActions.delete:
                nanoSQLQuery2.delete(queryArgs, action.args);
                break;
            case InanoSQLActions.conform:
                nanoSQLQuery2.conform(queryArgs, action.args);
                break;
            case InanoSQLActions.rebuild_indexes:
                nanoSQLQuery2.rebuild_indexes(queryArgs, action.args);
                break;
            case InanoSQLActions.clone:
                nanoSQLQuery2.clone(queryArgs, action.args);
                break;
            case InanoSQLActions.custom_query:
                nanoSQLQuery2.custom_query(queryArgs, action.args);
                break;
            default:
                complete(Error("Uknonwn action requested!"));
        }

    }


    static select_arr(query: nanoSQLQueryArgs, args: ActionArgs_select_arr) {

    }

    static select_fn(query: nanoSQLQueryArgs, args: ActionArgs_select_fn) {

    }

    static select_index(query: nanoSQLQueryArgs, args: ActionArgs_select_index) {

    }

    static select_pk(query: nanoSQLQueryArgs, args: ActionArgs_select_pk) {

    }

    static select_external(query: nanoSQLQueryArgs, args: ActionArgs_select_external) {

    }

    static select_compound(query: nanoSQLQueryArgs, args: ActionArgs_select_compound) {

    }

    static total(query: nanoSQLQueryArgs, args: ActionArgs_total) {

    }

    static drop_table(query: nanoSQLQueryArgs, args: ActionArgs_drop_table) {

    }

    static create_table(query: nanoSQLQueryArgs, args: ActionArgs_create_table) {

    }

    static alter_table(query: nanoSQLQueryArgs, args: ActionArgs_alter_table) {

    }

    static describe(query: nanoSQLQueryArgs, args: ActionArgs_describe) {

    }

    static show_tables(query: nanoSQLQueryArgs, args: ActionArgs_show_tables) {

    }

    static union(query: nanoSQLQueryArgs, args: ActionArgs_union) {

    }

    static graph(query: nanoSQLQueryArgs, args: ActionArgs_graph) {

    }

    static join(query: nanoSQLQueryArgs, args: ActionArgs_join) {

    }

    static order(query: nanoSQLQueryArgs, args: ActionArgs_order) {

    }

    static group(query: nanoSQLQueryArgs, args: ActionArgs_group) {

    }

    static functions(query: nanoSQLQueryArgs, args: ActionArgs_functions) {

    }

    static range(query: nanoSQLQueryArgs, args: ActionArgs_range) {

    }

    static filter_arr(query: nanoSQLQueryArgs, args: ActionArgs_filter_arr) {

    }

    static filter_fn(query: nanoSQLQueryArgs, args: ActionArgs_filter_fn) {

    }

    static distinct(query: nanoSQLQueryArgs, args: ActionArgs_distinct) {

    }

    static upsert(query: nanoSQLQueryArgs, args: ActionArgs_upsert) {

    }

    static delete(query: nanoSQLQueryArgs, args: ActionArgs_delete) {

    }

    static conform(query: nanoSQLQueryArgs, args: ActionArgs_conform) {

    }

    static rebuild_indexes(query: nanoSQLQueryArgs, args: ActionArgs_rebuild_indexes) {

    }

    static clone(query: nanoSQLQueryArgs, args: ActionArgs_clone) {

    }

    static custom_query(query: nanoSQLQueryArgs, args: ActionArgs_custom_query) {

    }

}
