import { IdbQuery } from "../query/std-query";
import { NanoSQLInstance } from "../index";
import { _NanoSQLStorage, DBRow } from "./storage";
export interface SearchRowIndex {
    wrd: string;
    rows: {
        id: any;
        l: number;
        i: number[];
    }[];
}
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
    doQuery(query: IdbQuery, next: (q: IdbQuery) => void, error: (err: Error) => void): void;
    private _hash;
    private _updateORMRows;
    private _syncORM;
    _tokenizer(column: string, value: string): {
        o: string;
        w: string;
        i: number;
    }[];
    private _clearFromSearchIndex;
    private _updateSearchIndex;
    /**
     * For each updated row, update view columns from remote records that are related.
     *
     * @private
     * @param {any[]} rows
     * @param {() => void} complete
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    private _updateRowViews;
    /**
     * Go to tables that have views pointing to this one, and update their records.
     *
     * @private
     * @param {any[]} updatedRows
     * @param {() => void} complete
     * @memberof _NanoSQLStorageQuery
     */
    private _updateRemoteViews;
    private _doAfterQuery;
    _uniqueColCheck(updatingRow: any, inputData: any, err: (e: Error) => void): (col: string, i: number, nextCol: (result?: any) => void) => void;
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
    _executeQueryArguments(inputRows: DBRow[], callback: (rows: DBRow[]) => void, error: (err: Error) => void): void;
}
/**
 * Selects the needed rows from the storage system.
 * Uses the fastes possible method to get the rows.
 *
 * @export
 * @class _RowSelection
 */
export declare class _RowSelection {
    qu: _NanoSQLStorageQuery;
    q: IdbQuery;
    s: _NanoSQLStorage;
    constructor(qu: _NanoSQLStorageQuery, q: IdbQuery, s: _NanoSQLStorage, callback: (rows: DBRow[]) => void, error: (e: Error) => void);
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
    private _isSubOptimizedWhere;
}
/**
 * Select rows from an instance table. Supports RANGE and WHERE statements.
 *
 * @export
 * @class InstanceSelection
 */
export declare class InstanceSelection {
    q: IdbQuery;
    p: NanoSQLInstance;
    constructor(q: IdbQuery, p: NanoSQLInstance);
    getRows(onRows: (rows: DBRow[]) => void, error: (e: Error) => void): void;
}
