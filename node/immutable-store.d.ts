import { SomeSQLBackend, DBConnect, DBExec } from "./index";
/**
 * The main class for the immutable database, holds the indexes, data and primary methods.
 *
 * @export
 * @class _SomeSQLImmuDB
 * @implements {SomeSQLBackend}
 */
export declare class _SomeSQLImmuDB implements SomeSQLBackend {
    constructor();
    /**
     * Called once to init the database, prep all the needed variables and data models
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf _SomeSQLImmuDB
     */
    _connect(connectArgs: DBConnect): void;
    /**
     * Called by SomeSQL to execute queries on this database.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf _SomeSQLImmuDB
     */
    _exec(execArgs: DBExec): void;
    /**
     * Utility function to remove duplicates from an array.
     *
     * @interal
     * @param {Array<any>} sortedArray
     * @returns {Array<any>}
     *
     * @memberOf _SomeSQLImmuDB
     */
    _removeDupes(sortedArray: Array<any>): Array<any>;
}
