import { InanoSQLQuery, InanoSQLInstance, InanoSQLDBConfig, TableQueryResult, InanoSQLGraphArgs, InanoSQLJoinArgs, InanoSQLUnionArgs } from "./interfaces";
import { _generateAST } from "./query2-ast";
import { _prepareQuery } from "./query2-prepare";

/**
 * Query Order:
 * 0. Process, Prepare then Execute
 * 1. Where / Index Select (possibly do indexed orderby)
 * 2. Union, Join & Graph
 * 3. Group By, Functions & Distinct
 * 4. Apply AS
 * 5. OrderBy (if not done by index/pk)
 * 6. Having 
 * 7. Offset & Limit
 */

export const executeQuery = (nSQL: InanoSQLInstance, query: InanoSQLQuery, progress: (row: any, i: number) => void, complete: (err?: string) => void) => {
    
    try {
        // step 1, process query AST
        const queryAST = _generateAST(query);

        // step 2, prepare query
        const preparedQuery = _prepareQuery(nSQL, queryAST);

        // step 3, execute query

    } catch (e) {
        complete(e);
    }
}


