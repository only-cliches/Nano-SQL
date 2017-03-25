import { NanoSQLInstance, NanoSQLBackend, DBConnect, DBExec } from "./index";
import { Promise } from "lie-ts";
import { _NanoSQL_Storage } from "./db-storage";
/**
 * The main class for the immutable database, holds the indexes, data and primary methods.
 *
 * A majority of data moving around for select statements and the like is indexes, not the actual data.
 *
 * @export
 * @class _NanoSQLDB
 * @implements {NanoSQLBackend}
 */
export declare class _NanoSQLDB implements NanoSQLBackend {
    /**
     * Holds the database data.
     *
     * @type {_NanoSQL_Storage}
     * @memberOf _NanoSQLDB
     */
    _store: _NanoSQL_Storage;
    constructor();
    /**
     * Called once to init the database, prep all the needed variables and data models
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf _NanoSQLDB
     */
    _connect(connectArgs: DBConnect): void;
    /**
     * Called by NanoSQL to execute queries on this database.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf _NanoSQLDB
     */
    _exec(execArgs: DBExec): void;
    _transaction(type: "start" | "end"): boolean;
    /**
     * Undo & Redo logic.
     *
     * ### Undo
     * Reverse the state of the database by one step into the past.
     * Usage: `NanoSQL().extend("<")`;
     *
     * ### Redo
     * Step the database state forward by one.
     * Usage: `NanoSQL().extend(">")`;
     *
     * ### Query
     * Discover the state of the history system
     * ```ts
     * NanoSQL().extend("?").then(function(state) {
     *  console.log(state[0]) // <= length of history records
     *  console.log(state[1]) // <= current history pointer position
     * });
     * ```
     *
     * The history point is zero by default, perforing undo shifts the pointer backward while redo shifts it forward.
     *
     * @param {NanoSQLInstance} db
     * @param {("<"|">"|"?")} command
     * @returns {Promise<any>}
     *
     * @memberOf _NanoSQLDB
     */
    _extend(db: NanoSQLInstance, command: string): Promise<any>;
}
