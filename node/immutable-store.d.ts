import { NanoSQLInstance, NanoSQLBackend, DBRow, DataModel, DBConnect, DBExec } from "./index";
import { Promise } from "lie-ts";
/**
 * The main class for the immutable database, holds the indexes, data and primary methods.
 *
 * A majority of data moving around for select statements and the like is indexes, not the actual data.
 *
 * @export
 * @class _NanoSQLImmuDB
 * @implements {NanoSQLBackend}
 */
export declare class _NanoSQLImmuDB implements NanoSQLBackend {
    /**
     * Holds references to the indexed DB object.
     *
     * @type {IDBDatabase}
     * @memberOf _NanoSQLImmuDB
     */
    _indexedDB: IDBDatabase;
    /**
     * Flag to disable history and caching to incrase performance for lage imports
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    _disableHistoryAndCache: boolean;
    /**
     * Wether to store data to indexed DB or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    _persistent: boolean;
    constructor();
    /**
     * Get a row object from the store based on the current history markers.
     *
     * @public
     * @param {number} rowID
     * @returns {(DBRow|null)}
     *
     * @memberOf _NanoSQLQuery
     */
    _getRow(tableID: number, primaryKey: string): DBRow | null;
    _getTable(): {
        _pk: string;
        _pkType: string;
        _name: string;
        _incriment: number;
        _index: string[];
        _keys: string[];
        _defaults: any[];
        _rows: {
            [key: string]: DBRow[];
        };
        _historyPointers: {
            [key: string]: number;
        };
    };
    _newTable(tableName: string, dataModels: DataModel[]): string;
    /**
     * Called once to init the database, prep all the needed variables and data models
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf _NanoSQLImmuDB
     */
    _connect(connectArgs: DBConnect): void;
    /**
     * Called by NanoSQL to execute queries on this database.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf _NanoSQLImmuDB
     */
    _exec(execArgs: DBExec): void;
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
     * @memberOf _NanoSQLImmuDB
     */
    _extend(db: NanoSQLInstance, command: "<" | ">" | "?" | "flush_db" | "disable" | "before_import" | "after_import"): Promise<any>;
}
