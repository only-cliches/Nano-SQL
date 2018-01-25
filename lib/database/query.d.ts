import { IdbQuery } from "../query/std-query";
import { _NanoSQLStorage, DBRow } from "./storage";
/**
 * A new Storage Query class is inilitized for every query, performing the actions
 * against the storage class itself to get the desired outcome.
 *
 * @export
 * @class _NanoSQLStorageQuery
 */
export declare class _NanoSQLStorageQuery {
    _store: _NanoSQLStorage;
    constructor(_store: _NanoSQLStorage);
    /**
     * Execute the query against this class.
     *
     * @param {IdbQuery} query
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    doQuery(query: IdbQuery, next: (q: IdbQuery) => void): void;
    private _hash;
    private _setCache(rows);
    private _updateORMRows(relation, fromPKs, add, primaryKey, complete);
    private _syncORM(type, oldRows, newRows, complete);
}
/**
 * Takes a selection of rows and applys modifiers like orderBy, join and others to the rows.
 * Returns the affected rows updated in the way the query specified.
 *
 * @export
 * @class MutateSelection
 */
export declare class _MutateSelection {
    q: IdbQuery;
    s: _NanoSQLStorage;
    constructor(q: IdbQuery, s: _NanoSQLStorage);
    /**
     * Triggers the mutations in the order of operations.
     *
     * @param {DBRow[]} inputRows
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _MutateSelection
     */
    _executeQueryArguments(inputRows: DBRow[], callback: (rows: DBRow[]) => void): void;
}
/**
 * Selects the needed rows from the storage system.
 * Uses the fastes possible method to get the rows.
 *
 * @export
 * @class _RowSelection
 */
export declare class _RowSelection {
    q: IdbQuery;
    s: _NanoSQLStorage;
    constructor(q: IdbQuery, s: _NanoSQLStorage);
    /**
     * Discovers the fastest possible SELECT method, then uses it.
     *
     * @param {(rows: DBRow[]) => void} callback
     * @returns
     * @memberof _RowSelection
     */
    getRows(callback: (rows: DBRow[]) => void): void;
    /**
     * Given a compound where statement like [[value, =, key], AND, [something, =, something]]
     * Check if first where conditions are primary key/ secondary index followed by unoptimized/unindexed conditions
     *
     * In this case we can grab the primary key/secondary index query from the database and do a faster query on the smaller result set.
     *
     * Returns 0 if this isn't a suboptimized where condition.
     * Returns the index of the where array where the AND splits between optimized and unoptimized conditions otherwise.
     *
     * @private
     * @param {any[]} wArgs
     * @returns {number}
     * @memberof _RowSelection
     */
    private _isSubOptimizedWhere(wArgs);
}
/**
 * Select rows from an instance table. Supports RANGE and WHERE statements.
 *
 * @export
 * @class InstanceSelection
 */
export declare class InstanceSelection {
    q: IdbQuery;
    constructor(q: IdbQuery);
    getRows(callback: (rows: DBRow[]) => void): void;
}
