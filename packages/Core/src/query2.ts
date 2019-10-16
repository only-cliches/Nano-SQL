import { InanoSQLQuery2, InanoSQLInstance, InanoSQLDBConfig, TableQueryResult, InanoSQLGraphArgs, InanoSQLJoinArgs, InanoSQLUnionArgs } from "./interfaces";
import { QueryAST } from "./query2-ast";
import { QueryPrepare } from "./query2-prepare";

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

        // step 3, execute query


    } catch (e) {
        complete(e);
    }
}


