import { InanoSQLInstance } from "./interfaces";
import { InanoSQLQueryAST } from "./query2-ast";

export enum InanoSQLActions {
    union, 
    graph, 
    join, 
    order, 
    group, 
    selectFull, 
    selectIndex, 
    selectPK, 
    range, 
    where, 
    distinct, 
    update,
    upsert,
    delete, 
    conform, 
    rebuildIndexes, 
    clone
}

export interface InanoSQLQueryActions {
    do: InanoSQLActions,
    args: {

    }
}

/**
 * Builds an optimized list of actions for the query engine to perform.
 * 
 * Once the list is built, we can execute the query.
 *
 * @param {InanoSQLInstance} nSQL
 * @param {InanoSQLQueryAST} pQuery
 * @returns {InanoSQLQueryActions[]}
 */
export const _prepareQuery = (nSQL: InanoSQLInstance, pQuery: InanoSQLQueryAST): InanoSQLQueryActions[]  => {

    let queryWillSelect = true;
    if (["select", "upsert", "delete"].indexOf(pQuery.action)) {

    }


    return []
}