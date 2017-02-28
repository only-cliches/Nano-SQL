import { SomeSQLInstance, SomeSQLBackend, DBRow, DBConnect, DBExec } from "./index";
import { TSPromise } from "typescript-promise";
/**
 * The main class for the immutable database, holds the indexes, data and primary methods.
 *
 * A majority of data moving around for select statements and the like is indexes, not the actual data.
 *
 * @export
 * @class _SomeSQLImmuDB
 * @implements {SomeSQLBackend}
 */
export declare class _SomeSQLImmuDB implements SomeSQLBackend {
    /**
     * Holds references to the indexed DB object.
     *
     * @type {IDBDatabase}
     * @memberOf _SomeSQLImmuDB
     */
    _indexedDB: IDBDatabase;
    /**
     * Flag to keep track of when importing IndexeDB.
     *
     * @type {boolean}
     * @memberOf _SomeSQLImmuDB
     */
    isImporting: boolean;
    constructor();
    /**
     * Wether to store data to indexed DB or not.
     *
     * @type {boolean}
     * @memberOf _SomeSQLImmuDB
     */
    _persistent: boolean;
    /**
     * Get a row object from the store based on the current history markers.
     *
     * @public
     * @param {number} rowID
     * @returns {(DBRow|null)}
     *
     * @memberOf _SomeSQLQuery
     */
    _getRow(rowID: number): DBRow | null;
    /**
     * Get the IDs of the current history pointers for a given rowID.
     *
     * @public
     * @param {number} rowID
     * @returns
     *
     * @memberOf _SomeSQLQuery
     */
    _historyIDs(rowID: number): number;
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
     * Undo & Redo logic.
     *
     * ### Undo
     * Reverse the state of the database by one step into the past.
     * Usage: `SomeSQL().extend("<")`;
     *
     * ### Redo
     * Step the database state forward by one.
     * Usage: `SomeSQL().extend(">")`;
     *
     * ### Query
     * Discover the state of the history system
     * ```ts
     * SomeSQL().extend("?").then(function(state) {
     *  console.log(state[0]) // <= length of history records
     *  console.log(state[1]) // <= current history pointer position
     * });
     * ```
     *
     * The history point is zero by default, perforing undo shifts the pointer backward while redo shifts it forward.
     *
     * @param {SomeSQLInstance} db
     * @param {("<"|">"|"?")} command
     * @returns {TSPromise<any>}
     *
     * @memberOf _SomeSQLImmuDB
     */
    _extend(db: SomeSQLInstance, command: "<" | ">" | "?" | "flush_db"): TSPromise<any>;
}
