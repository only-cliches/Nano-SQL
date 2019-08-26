/*
New proposed internal query classes.

The current query class is pretty bloated, complicated and not easy to maintain or follow.

New idea is this (WIP for sure)
1. Have 3 (or more) classes that handle different kinds of queries.
2. Each query is checked to see what is needed to complete it.
3. Simpler, faster queries are handed to the less complex query classes, while more complex queries are handed to the ones designed to handle it.

This way each class has a single query path (instead of multiple branching options) and will be easier to follow and maintain.
*/
import { InanoSQLInstance, InanoSQLQuery, _nanoSQLPreparedQuery } from "./interfaces";


/**
 * Handles queries that modify the database data.
 *
 * @export
 * @class _nanoSQLMutationQuery
 */
export class _nanoSQLMutationQuery {
    constructor(
        public databaseID: string|undefined,
        public nSQL: InanoSQLInstance,
        public query: _nanoSQLPreparedQuery,
        public progress: (row: any, i: number) => void,
        public complete: () => void,
        public error: (err: any) => void
    ) {

    }
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
 * Results are captured and streamed to the client
 *
 * @export
 * @class _nanoSQLSelectQueryFast
 */
export class _nanoSQLSelectQueryFast {
    constructor(
        public databaseID: string|undefined,
        public nSQL: InanoSQLInstance,
        public query: _nanoSQLPreparedQuery,
        public progress: (row: any, i: number) => void,
        public complete: () => void,
        public error: (err: any) => void
    ) {

    }
}

/**
 * Still pretty fast, results are streamed and more complicated conditions are handled.
 * These query parameters are NOT handled:
 * 1. orderBy on non indexed columns
 * 2. groupBy
 * 3. distinct
 *
 * @export
 * @class _nanoSQLSelectQueryMedium
 */
export class _nanoSQLSelectQueryMedium {
    constructor(
        public databaseID: string|undefined,
        public nSQL: InanoSQLInstance,
        public query: _nanoSQLPreparedQuery,
        public progress: (row: any, i: number) => void,
        public complete: () => void,
        public error: (err: any) => void
    ) {

    }
}


/**
 * All query conditions are handled.
 * Results must be loaded entirely into memory, mutated, then fed to the client.
 * Pretty expensive memory wise.
 *
 * @export
 * @class _nanoSQLSelectQueryComplete
 */
export class _nanoSQLSelectQueryComplete {
    constructor(
        public databaseID: string|undefined,
        public nSQL: InanoSQLInstance,
        public query: InanoSQLQuery,
        public progress: (row: any, i: number) => void,
        public complete: () => void,
        public error: (err: any) => void
    ) {

    }
}