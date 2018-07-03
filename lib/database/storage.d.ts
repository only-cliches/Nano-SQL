import { DataModel, NanoSQLInstance, NanoSQLConfig, NanoSQLBackupAdapter } from "../index";
import { StdObject } from "../utilities";
export interface DBRow {
    [key: string]: any;
}
export interface DBKey {
    string: any;
    number: any;
}
export interface QueryQ {
    add: (table: string, cb: (done: () => void) => void) => void;
    qs: {
        [table: string]: any;
    };
}
/**
 * Storage class uses one of these to attach to the actual database backend.
 *
 * @export
 * @interface NanoSQLStorageAdapter
 */
export interface NanoSQLStorageAdapter {
    /**
     * Sent before connect(), sends data models and other info.
     * makeTable() will be called everytime the database backend is connected, so make sure
     * it's setup where you don't accidentally overwrite or destroy existing tables with the same name.
     *
     * @param {string} tableName
     * @param {DataModel[]} dataModels
     * @memberof NanoSQLStorageAdapter
     */
    makeTable(tableName: string, dataModels: DataModel[]): void;
    /**
     * Set the database ID, called before connect() and makeTable() commands get called
     *
     * @param {string} id
     * @memberof NanoSQLStorageAdapter
     */
    setID(id: string): void;
    /**
     * Called when it's time for the backend to be initilized.
     * Do all the backend setup work here, then call complete() when you're done.
     *
     * @param {() => void} complete
     * @memberof NanoSQLStorageAdapter
     */
    connect(complete: () => void, error?: (err: Error) => void): void;
    /**
     * Called to disconnect the database and do any clean up that's needed
     *
     * @param {() => void} complete
     * @param {(err: Error) => void} [error]
     * @memberof NanoSQLStorageAdapter
     */
    disconnect?(complete: () => void, error?: (err: Error) => void): void;
    /**
     * Write a single row to the database backend.
     * Primary key will be provided if it's known before the insert, otherwise it will be null and up to the database backend to make one.
     * It's also intirely possible for a primary key to be provided for a non existent row, the backend should handle this gracefully.
     *
     * @param {string} table
     * @param {(DBKey|null)} pk
     * @param {DBRow} data
     * @param {(finalRow: DBRow) => void} complete
     * @param {boolean} skipReadBeforeWrite
     * @memberof NanoSQLStorageAdapter
     */
    write(table: string, pk: DBKey | null, data: DBRow, complete: (finalRow: DBRow) => void, error?: (err: Error) => void): void;
    /**
     * Read a single row from the database
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {(row: DBRow ) => void} callback
     * @memberof NanoSQLStorageAdapter
     */
    read(table: string, pk: DBKey, callback: (row: DBRow) => void, error?: (err: Error) => void): void;
    /**
     * Read a range of primary keys from a given table.
     * Each row is read asyncrounosuly, so make sure the front end can incriment through the rows quickly.
     *
     * If pkRange is true, the from and to values will be primary keys.  Even if the provided keys don't exist, the backend should gracefully provide all keys between the two keys given.
     * If pkRange is false, the from and to values will be numbers indicating a range of rows to get, regardless of the primary key values.
     *
     * @param {string} table
     * @param {(row: DBRow, idx: number, nextRow: () => void) => void} rowCallback
     * @param {() => void} complete
     * @param {DBKey} [from]
     * @param {DBKey} [to]
     * @memberof NanoSQLStorageAdapter
     */
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, pkRange?: boolean, error?: (err: Error) => void): void;
    /**
     * Delete a row from the backend given a table and primary key.
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {() => void} complete
     * @memberof NanoSQLStorageAdapter
     */
    delete(table: string, pk: DBKey, complete: () => void, error?: (err: Error) => void): void;
    /**
     * Drop an entire table from the backend. (Delete all rows)
     *
     * @param {string} table
     * @param {() => void} complete
     * @memberof NanoSQLStorageAdapter
     */
    drop(table: string, complete: () => void, error?: (err: Error) => void): void;
    /**
     * Get the number of rows in a table or the table index;
     *
     * @param {string} table
     * @param {(count: number) => void} complete
     * @memberof NanoSQLStorageAdapter
     */
    getIndex(table: string, getLength: boolean, complete: (index: any[] | number) => void, error?: (err: Error) => void): void;
    /**
     * Completely delete/destroy the entire database. (Used by testing system)
     *
     * @param {() => void} complete
     * @memberof NanoSQLStorageAdapter
     */
    destroy(complete: () => void, error?: (err: Error) => void): void;
    /**
     * Given an arbitrary list of primary keys and a table, get all primary keys.
     * This method is optional, if it isn't provided then .read() will be called in parallel to perform these kinds of queries.
     *
     * @param {string} table
     * @param {DBKey[]} pks
     * @param {(rows: DBRow[]) => void} callback
     * @param {(err: Error) => void} [error]
     * @memberof NanoSQLStorageAdapter
     */
    batchRead?(table: string, pks: DBKey[], callback: (rows: DBRow[]) => void, error?: (err: Error) => void): void;
    /**
     * If a where statement is sent to nanoSQL that can't be optimized and requires a full table scan, this query can be sent
     * to the data store adapter to perform the conditional checks instead.
     *
     * This method is optional and should only be usd if you can cover all conditions in the _compare method found inside the query.ts file.
     * The default behavior for unoptimized reads is to grab the whole table and check each row for the conditional statements.
     * If you use this method it should return results much faster than the default beavhior can.
     *
     * @param {string} table
     * @param {any[]} where
     * @param {(rows: DBRow[]) => void} rowCallback
     * @memberof NanoSQLStorageAdapter
     */
    whereRead?(table: string, where: any[], rowCallback: (rows: DBRow[]) => void): void;
    /**
     * Called by the system after the adapter connects to allow access to the parent nanosql instance.
     *
     * @param {NanoSQLInstance} nSQL
     * @memberof NanoSQLStorageAdapter
     */
    setNSQL?(nSQL: NanoSQLInstance): void;
}
/**
 * Holds the general abstractions to connect the query module to the storage adapters.
 * Takes care of indexing, tries, secondary indexes and adapter management.
 *
 * @export
 * @class _NanoSQLStorage
 */
export declare class _NanoSQLStorage {
    _mode: string | NanoSQLStorageAdapter;
    _id: string;
    queue: QueryQ;
    tableInfo: {
        [tableName: string]: {
            _pk: string;
            _pkType: string;
            _name: string;
            _secondaryIndexes: string[];
            _searchColumns: {
                [column: string]: string[];
            };
            _trieColumns: string[];
            _keys: string[];
            _defaults: {
                [column: string]: any;
            };
            _hasDefaults: boolean;
            _views: {
                [table: string]: {
                    pkColumn: string;
                    mode: string;
                    columns: {
                        thisColumn: string;
                        otherColumn: string;
                    }[];
                };
            };
            _viewTables: {
                table: string;
                column: string;
            }[];
        };
    };
    /**
     * Wether ORM values exist in the data models or not.
     *
     * @type {boolean}
     * @memberof _NanoSQLStorage
     */
    _hasORM: boolean;
    /**
     * Wether views exist the data model or not.
     *
     * @type {boolean}
     * @memberof _NanoSQLStorage
     */
    _hasViews: boolean;
    /**
     * Stores a copy of all the data models
     *
     * @type {{
     *         [tableName: string]: DataModel[];
     *     }}
     * @memberof _NanoSQLStorage
     */
    models: {
        [tableName: string]: DataModel[];
    };
    /**
     * Do we cache select queries or no?
     *
     * @type {boolean}
     * @memberof _NanoSQLStorage
     */
    _doCache: boolean;
    /**
     * The actual select query cache.
     *
     * @type {{
     *         [table: string]: {
     *             [queryHash: number]: any[];
     *         }
     *     }}
     * @memberof _NanoSQLStorage
     */
    _cache: {
        [table: string]: {
            [queryHash: number]: any[];
        };
    };
    /**
     * Parent instance of NanoSQL
     *
     * @type {NanoSQLInstance}
     * @memberof _NanoSQLStorage
     */
    _nsql: NanoSQLInstance;
    private _size;
    /**
     * Given a table, keep track of all ORM references pointing FROM that table.
     *
     * @type {({
     *         [tableName: string]: { // Relations with this table
     *             _table: string // other table
     *             _key: string // this column
     *             _mapTo: string // other column
     *             _type: "array" | "single" // type of relation
     *         }[];
     *     })}
     * @memberof NanoSQLInstance
     */
    _relFromTable: {
        [tableName: string]: {
            [thisColmn: string]: {
                _toTable: string;
                _toColumn: string;
                _toType: "array" | "single";
                _thisType: "array" | "single";
            };
        };
    };
    /**
     * Used by the .orm() queries to find what records to get.
     *
     * @type {({
     *         [tableName: string]: {
     *             [thisColmn: string]: { // Relations with this table
     *                 _toTable: string // other table
     *                 _thisType: "array" | "single" // type of relation,
     *             };
     *         }
     *     })}
     * @memberof _NanoSQLStorage
     */
    _columnsAreTables: {
        [tableName: string]: {
            [thisColmn: string]: {
                _toTable: string;
                _thisType: "array" | "single";
            };
        };
    };
    /**
     * Given a table, keep track of all ORM references pointing TO that table.
     *
     * @type {({
     *         [tableName: string]: {
     *             thisColumn: string;
     *             fromTable: string;
     *             fromColumn: string;
     *             fromType: "array" | "single"
     *         }[]
     *     })}
     * @memberof NanoSQLInstance
     */
    _relToTable: {
        [tableName: string]: {
            _thisColumn: string;
            _thisType: "array" | "single";
            _fromTable: string;
            _fromColumn: string;
            _fromType: "array" | "single";
        }[];
    };
    /**
     * Stores which columns are used for ORM stuff.
     *
     * @type {{
     *         [tableName: string]: string[];
     *     }}
     * @memberof NanoSQLInstance
     */
    _relationColumns: {
        [tableName: string]: string[];
    };
    _secondaryIndexes: {
        [table: string]: {
            idx: any[];
            rows: any;
            sortIdx: boolean;
        };
    };
    _secondaryIndexUpdates: {
        [table: string]: any[];
    };
    adapters: NanoSQLBackupAdapter[];
    constructor(parent: NanoSQLInstance, args: NanoSQLConfig);
    _isFlushing: boolean;
    _flushIndexes(): void;
    /**
     * Initilize the storage adapter and get ready to rumble!
     *
     * @param {StdObject<DataModel[]>} dataModels
     * @param {(newModels: StdObject<DataModel[]>) => void} complete
     * @memberof _NanoSQLStorage
     */
    init(dataModels: StdObject<DataModel[]>, complete: (newModels: StdObject<DataModel[]>) => void): void;
    /**
     * Rebuild secondary indexes of a given table.
     * Pass "_ALL_" as table to rebuild all indexes.
     *
     * @param {(time: number) => void} complete
     * @memberof _NanoSQLStorage
     */
    rebuildIndexes(table: string, complete: (time: number) => void): void;
    /**
     * Use variouse methods to detect the best persistent storage method for the environment NanoSQL is in.
     *
     * @returns {string}
     * @memberof _NanoSQLStorage
     */
    _detectStorageMethod(): string;
    /**
     * Get rows from a table given the column and secondary index primary key to read from.
     *
     * valid conditions are: =, <, <=, >, >=
     *
     *
     * @param {string} table
     * @param {string} column
     * @param {string} search
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _NanoSQLStorage
     */
    _secondaryIndexRead(table: string, condition: string, column: string, search: string, callback: (rows: DBRow[]) => void): void;
    /**
     * Get a range of rows from a given table.
     * If usePKs is false the range is in limit/offset form where the from and to values are numbers indicating a range of rows to get.
     * Otherwise the from and to values should be primary key values to get everything in between.
     *
     * @param {string} table
     * @param {DBKey} from
     * @param {DBKey} to
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _NanoSQLStorage
     */
    _rangeRead(table: string, from: any, to: any, usePKs: boolean, complete: (rows: DBRow[]) => void): void;
    /**
     * Full table scan if a function is passed in OR read an array of primary keys.
     *
     * @param {string} table
     * @param {(row: DBRow, idx: number, toKeep: (result: boolean) => void) => void} query
     * @param {(rows: DBRow[]) => void} callback
     * @returns
     * @memberof _NanoSQLStorage
     */
    _read(table: string, query: (row: DBRow, idx: number, toKeep: (result: boolean) => void) => void | any[], callback: (rows: DBRow[]) => void): void;
    /**
     * Get all values in a table where the column value matches against the given trie search value.
     *
     * @param {string} table
     * @param {string} column
     * @param {string} search
     * @param {(rows: DBRow[] ) => void} callback
     * @memberof _NanoSQLStorage
     */
    _trieRead(table: string, column: string, search: string, callback: (rows: DBRow[]) => void): void;
    /**
     * Write a row to the database
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {*} oldRow
     * @param {DBRow} newRow
     * @param {(row: DBRow) => void} complete
     * @memberof _NanoSQLStorage
     */
    _write(table: string, pk: DBKey, oldRow: any, newRow: DBRow, complete: (row: DBRow) => void, error: (erro: Error) => void): void;
    /**
     * Delete a specific row from the database.
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {(row: DBRow) => void} complete
     * @memberof _NanoSQLStorage
     */
    _delete(table: string, pk: DBKey, complete: (row: DBRow) => void): void;
    /**
     * Drop entire table from the database.
     *
     * @param {string} table
     * @param {() => void} complete
     * @memberof _NanoSQLStorage
     */
    _drop(table: string, complete: () => void): void;
    adapterRead(table: string, pk: DBKey, complete: (row: DBRow) => void, queue?: boolean): void;
    adapterWrite(table: string, pk: DBKey | null, data: DBRow, complete: (finalRow: DBRow) => void, error: (err: Error) => void): void;
    adapterDelete(table: string, pk: DBKey, complete: () => void, error?: (err: Error) => void): void;
    adapterDrop(table: string, complete: () => void, error?: (err: Error) => void): void;
}
