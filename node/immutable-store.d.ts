/// <reference types="websql" />
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
     * Holds the database data.
     *
     * @type {_NanoSQL_Storage}
     * @memberOf _NanoSQLImmuDB
     */
    _store: _NanoSQL_Storage;
    constructor();
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
     * @memberOf _NanoSQLImmuDB
     */
    _extend(db: NanoSQLInstance, command: string): Promise<any>;
}
export declare class _NanoSQL_Storage {
    _mode: any;
    _indexedDB: IDBDatabase;
    _parent: _NanoSQLImmuDB;
    /**
     * Utility data for each table, including holding the primary key, name, incriment number and primary keys
     *
     * @type {{
     *         [tableHash: number]: {
     *             _pk: string // Table primary key
     *             _pkType: string; // Primary key data type
     *             _name: string // Table name
     *             _incriment: number; // Table incriment counter
     *             _index: string[]; // The table index of row IDs in this table
     *             _keys: string[]; // Array of column keys
     *             _defaults: any[]; // Array of column defaults
     *             _rows: { // If memory mode is enabled, row data is stored here.
     *                 [key: string]: DBRow
     *             }
     *         }
     *     }}
     * @memberOf _NanoSQL_Storage
     */
    _tables: {
        [tableHash: number]: {
            _pk: string;
            _pkType: string;
            _name: string;
            _incriment: number;
            _index: string[];
            _keys: string[];
            _defaults: any[];
            _rows: {
                [key: string]: DBRow | null;
            };
        };
    };
    /**
     * Mirror of active tables, contains all the row modifications
     *
     * @type {{
     *         [tableHash: number]}
     * @memberOf _NanoSQLImmuDB
     */
    /**
     * Need to store an auto incriment style counter for history data tables.
     *
     * @type {{
     *         [tableHash: number]: number;
     *     }}
     * @memberOf _NanoSQL_Storage
     */
    /**
     * Contains the records needed to keep track of and adjust the row histories.
     *
     * Only used if the memory database is enabled.
     *
     * @type {{
     *         [tableHash: number]: {
     *             [rowKey: string]: {
     *                 _pointer: number,
     *                 _historyDataRowIDs: number[]
     *             }
     *         }
     *     }}
     * @memberOf _NanoSQLImmuDB
     */
    /**
     * Utility table to store misc data.
     *
     * This is populated regardless of the memory db setting.
     *
     * @type {{
     *         [key: string]: {
     *             key: string,
     *             value: any;
     *         }
     *     }}
     * @memberOf _NanoSQL_Storage
     */
    _utilityTable: {
        [key: string]: {
            key: string;
            value: any;
        };
    };
    /**
     * Keeps track of how many total history points we have
     *
     * @type {number}
     * @memberOf _NanoSQLImmuDB
     */
    _historyLength: number;
    /**
     * Flag to indicate the state of transactions
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    _doingTransaction: boolean;
    /**
     * Wether to enable the persistent storage system or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    _persistent: boolean;
    /**
     * Flag to store wether history is enabled or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    _doHistory: boolean;
    /**
     * Flag to store wether tables are stored in memory or not.
     *
     * @type {boolean}
     * @memberOf _NanoSQLImmuDB
     */
    _storeMemory: boolean;
    /**
     * Save the connect args so we can re init the store on command.
     *
     * @type {DBConnect}
     * @memberOf _NanoSQL_Storage
     */
    _savedArgs: DBConnect;
    /**
     * WebSQL database object.
     *
     * @type {Database}
     * @memberOf _NanoSQL_Storage
     */
    _webSQL: Database;
    /**
     * Level Up store variable.
     *
     * @type {{
     *         [key: string]: any;
     *     }}
     * @memberOf _NanoSQL_Storage
     */
    _levelDBs: {
        [key: string]: any;
    };
    constructor(database: _NanoSQLImmuDB, args: DBConnect);
    /**
     * Setup persistent storage engine and import any existing data into memory.
     *
     * @static
     * @param {_NanoSQLImmuDB} database
     * @param {DBConnect} args
     * @returns {boolean}
     *
     * @memberOf _NanoSQL_Persistent
     */
    init(database: _NanoSQLImmuDB, args: DBConnect): void;
    _clearHistory(complete: Function): void;
    _delete(tableName: string, rowID: string | number, callBack?: (success: boolean) => void): void;
    _upsert(tableName: string, rowID: string | number | null, value: any, callBack?: (rowID: number | string) => void): void;
    _read(tableName: string, row: string | number | Function, callBack: (rows: any[]) => void): void;
    _clearAll(callBack: Function): void;
    /**
     * Write or access utility options.
     *
     * @param {("r"|"w")} type
     * @param {string} key
     * @param {*} [value]
     * @returns
     *
     * @memberOf _NanoSQLImmuDB
     */
    _utility(type: "r" | "w", key: string, value?: any): any;
    /**
     * Get the current selected table
     *
     * @returns
     *
     * @memberOf _NanoSQL_Storage
     */
    _getTable(): {
        _pk: string;
        _pkType: string;
        _name: string;
        _incriment: number;
        _index: string[];
        _keys: string[];
        _defaults: any[];
        _rows: {
            [key: string]: DBRow;
        };
    };
    /**
     * Setup a new table.
     *
     * @param {string} tableName
     * @param {DataModel[]} dataModels
     * @returns {string}
     *
     * @memberOf _NanoSQL_Storage
     */
    _newTable(tableName: string, dataModels: DataModel[]): string;
    /**
     * User agent sniffing to discover if we're running in Safari
     *
     * @returns
     *
     * @memberOf _NanoSQLImmuDB
     */
    _safari(): boolean;
    /**
     * User agent sniffing to discover if we're on an iOS device.
     *
     * @returns {boolean}
     *
     * @memberOf _NanoSQLImmuDB
     */
    _iOS(): boolean;
}
