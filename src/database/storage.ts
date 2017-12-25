import { Trie } from "prefix-trie-ts";
import { IdbQuery } from "../query/std-query";
import { DataModel, NanoSQLInstance } from "../index";
import { StdObject, hash, fastALL, fastCHAIN, deepFreeze, uuid, timeid, _assign, generateID, isSafari, isMSBrowser, isObject, removeDuplicates } from "../utilities";
import { _SyncStore } from "./adapter-sync";
import { _IndexedDBStore } from "./adapter-indexedDB";
import { _WebSQLStore } from "./adapter-websql";

/* NODE-START */
import { _LevelStore } from "./adapter-levelDB";
/* NODE-END */

export interface DBRow {
    [key: string]: any;
}

export interface DBKey {
    string;
    number;
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
    connect(complete: () => void): void;

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
    write(table: string, pk: DBKey | null, data: DBRow, complete: (finalRow: DBRow) => void, skipReadBeforeWrite: boolean): void;

    /**
     * Read a single row from the database
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {(row: DBRow ) => void} callback
     * @memberof NanoSQLStorageAdapter
     */
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;

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
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, pkRange?: boolean): void;

    /**
     * Delete a row from the backend given a table and primary key.
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {() => void} complete
     * @memberof NanoSQLStorageAdapter
     */
    delete(table: string, pk: DBKey, complete: () => void): void;

    /**
     * Drop an entire table from the backend. (Delete all rows)
     *
     * @param {string} table
     * @param {() => void} complete
     * @memberof NanoSQLStorageAdapter
     */
    drop(table: string, complete: () => void): void;

    /**
     * Get the number of rows in a table or the table index;
     *
     * @param {string} table
     * @param {(count: number) => void} complete
     * @memberof NanoSQLStorageAdapter
     */
    getIndex(table: string, getLength: boolean, complete: (index: any[] | number) => void): void;

    /**
     * Completely delete/destroy the entire database.
     *
     * @param {() => void} complete
     * @memberof NanoSQLStorageAdapter
     */
    destroy(complete: () => void);
}


/**
 * Holds the general abstractions to connect the query module to the storage adapters.
 * Takes care of indexing, tries, secondary indexes and adapter management.
 *
 * @export
 * @class _NanoSQLStorage
 */
// tslint:disable-next-line
export class _NanoSQLStorage {

    public _mode: string | NanoSQLStorageAdapter; // mode or adapater the system uses.

    public _id: string; // database ID

    public _adapter: NanoSQLStorageAdapter; // The storage adapter used by the system.

    public tableInfo: {
        [tableName: string]: {
            _pk: string // Primary Key Column
            _pkType: string // Primary Key Type
            _name: string // table name
            _secondaryIndexes: string[] // secondary index columns
            _trieColumns: string[] // trie columns
            _keys: string[] // array of columns
            _defaults: any[] // array of default values
        }
    };

    /**
     * Wether ORM values exist in the data models or not.
     *
     * @type {boolean}
     * @memberof _NanoSQLStorage
     */
    public _hasORM: boolean;

    /**
     * Stores in memory Trie values to do Trie queries.
     *
     * @internal
     * @type {{
     *         [tableName: string]: {
     *             [column: string]: Trie
     *         }
     *     }}
     * @memberof _NanoSQLStorage
     */
    private _trieIndexes: {
        [tableName: string]: {
            [column: string]: Trie
        }
    };

    /**
     * Stores a copy of all the data models
     *
     * @type {{
     *         [tableName: string]: DataModel[];
     *     }}
     * @memberof _NanoSQLStorage
     */
    public models: {
        [tableName: string]: DataModel[];
    };

    /**
     * Array of table names
     *
     * @internal
     * @type {string[]}
     * @memberof _NanoSQLStorage
     */
    private _tableNames: string[] = [];

    /**
     * Do we cache select queries or no?
     *
     * @type {boolean}
     * @memberof _NanoSQLStorage
     */
    public _doCache: boolean;

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
    public _cache: {
        [table: string]: {
            [queryHash: number]: any[];
        }
    };

    /**
     * The primary keys in each cache.
     *
     * @type {{
     *         [table: string]: {
     *             [queryHash: number]: {[primaryKey: any]: boolean};
     *         }
     *     }}
     * @memberof _NanoSQLStorage
     */
    public _cacheKeys: {
        [table: string]: {
            [queryHash: number]: any;
        }
    };

    /**
     * Parent instance of NanoSQL
     *
     * @type {NanoSQLInstance}
     * @memberof _NanoSQLStorage
     */
    public _nsql: NanoSQLInstance;

    private _size: number;

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
    public _relFromTable: {
        [tableName: string]: {
            [thisColmn: string]: { // Relations with this table
                _toTable: string // other table
                _toColumn: string // other column
                _toType: "array" | "single" // other column type
                _thisType: "array" | "single" // type of relation,
            };
        }
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
    public _columnsAreTables: {
        [tableName: string]: {
            [thisColmn: string]: { // Relations with this table
                _toTable: string // other table
                _thisType: "array" | "single" // type of relation,
            };
        }
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
    public _relToTable: {
        [tableName: string]: {
            _thisColumn: string;
            _thisType: "array" | "single";
            _fromTable: string;
            _fromColumn: string;
            _fromType: "array" | "single";
        }[]
    };

    /**
     * Stores which columns are used for ORM stuff.
     *
     * @type {{
     *         [tableName: string]: string[];
     *     }}
     * @memberof NanoSQLInstance
     */
    public _relationColumns: {
        [tableName: string]: string[];
    };

    constructor(parent: NanoSQLInstance, args: {
        mode: string | NanoSQLStorageAdapter; // pass in string or adapter class.
        id: string; // id of database
        dbPath: string; // path (used by LevelDB)
        writeCache: number; // writeCache (used by LevelDB)
        persistent: boolean; // depreciated, but still need to support it for now!
        readCache: number; // read cache (used by LevelDB)
        cache: boolean; // wether to cache select queries or not
        size: number; // size of WebSQL database
    }) {

        this._nsql = parent;
        this._mode = args.persistent ? "PERM" : args.mode || "TEMP";
        this._id = args.id;
        this._size = args.size;

        this.models = {};
        this.tableInfo = {};
        this._trieIndexes = {};
        this._tableNames = [];
        this._doCache = args.cache || true;
        this._cache = {};
        this._cacheKeys = {};

        if (typeof this._mode === "string") {
            if (this._mode === "PERM") {
                const detect = this._detectStorageMethod();
                const modes = {
                    IDB: "Indexed DB",
                    IDB_WW: "Indexed DB (Web Worker)",
                    WSQL: "WebSQL",
                    LS: "Local Storage",
                    TEMP: "memory"
                };
                this._mode = detect || this._mode;
            }

            switch (this._mode) {
                case "IDB":
                    this._adapter = new _IndexedDBStore(false);
                    break;
                case "IDB_WW":
                    this._adapter = new _IndexedDBStore(true);
                    break;
                case "WSQL":
                    this._adapter = new _WebSQLStore(this._size);
                    break;
                case "LS":
                    this._adapter = new _SyncStore(true);
                    break;
                /* NODE-START */
                case "LVL":
                    this._adapter = new _LevelStore(args.dbPath, args.writeCache, args.readCache);
                    break;
                /* NODE-END */
                case "TEMP":
                    this._adapter = new _SyncStore(false);
                    break;
            }
        } else {
            this._adapter = this._mode;
        }
    }

    /**
     * Initilize the storage adapter and get ready to rumble!
     *
     * @param {StdObject<DataModel[]>} dataModels
     * @param {(newModels: StdObject<DataModel[]>) => void} complete
     * @memberof _NanoSQLStorage
     */
    public init(dataModels: StdObject<DataModel[]>, complete: (newModels: StdObject<DataModel[]>) => void) {
        if (!this._id) {
            this._id = hash(JSON.stringify(dataModels)).toString();
        }

        this._adapter.setID(this._id);

        this.models = this._createSecondaryIndexTables(dataModels);

        this._tableNames = Object.keys(this.models);

        this._tableNames.forEach((table) => {
            this._newTable(table, dataModels[table]);
        });

        this._relFromTable = {};
        this._relToTable = {};
        this._relationColumns = {};
        this._columnsAreTables = {};

        this._tableNames.forEach((table) => {

            let i = this.models[table].length;
            this._relFromTable[table] = {};
            this._relationColumns[table] = [];
            this._relToTable[table] = [];
            this._columnsAreTables[table] = {};

            while (i--) {
                const p = this.models[table][i];

                // Check for relations
                if (this._tableNames.indexOf(p.type.replace("[]", "")) !== -1) {
                    let mapTo = "";


                    this._columnsAreTables[table][p.key] = {
                        _toTable: p.type.replace("[]", ""),
                        _thisType: p.type.indexOf("[]") === -1 ? "single" : "array"
                    };

                    if (p.props) {
                        p.props.forEach(p => {
                            if (p.indexOf("ref=>") !== -1) mapTo = p.replace("ref=>", "");
                        });

                        if (mapTo) {
                            this._hasORM = true;
                            this._relationColumns[table].push(p.key);

                            this._relFromTable[table][p.key] = {
                                _toTable: p.type.replace("[]", ""),
                                _toColumn: mapTo.replace("[]", ""),
                                _toType: mapTo.indexOf("[]") === -1 ? "single" : "array",
                                _thisType: p.type.indexOf("[]") === -1 ? "single" : "array"
                            };
                        }
                    }


                }
            }

        });

        Object.keys(this._relFromTable).forEach((table) => {
            Object.keys(this._relFromTable[table]).forEach((column) => {
                const rel = this._relFromTable[table][column];
                this._relToTable[rel._toTable].push({
                    _thisColumn: rel._toColumn,
                    _thisType: rel._toType,
                    _fromTable: table,
                    _fromColumn: column,
                    _fromType: rel._thisType
                });
            });
        });

        this._adapter.connect(() => {

            // populate trie data
            fastALL(Object.keys(this._trieIndexes), (table, i, tableDone) => {
                const trieColumns = this._trieIndexes[table];
                if (Object.keys(trieColumns).length) {
                    this._read(table, (row, idx, toKeep) => {
                        if (!row) {
                            toKeep(false);
                            return;
                        }
                        Object.keys(trieColumns).forEach((column) => {
                            if (row[column] !== undefined) {
                                this._trieIndexes[table][column].addWord(String(row[column]));
                            }
                        });
                        toKeep(false);
                    }, tableDone);
                } else {
                    tableDone();
                }
            }).then(() => {
                complete(this.models);
            });

        });
    }

    /**
     * Rebuild secondary indexes of a given table.
     * Pass "_ALL_" as table to rebuild all indexes.
     *
     * @param {(time: number) => void} complete
     * @memberof _NanoSQLStorage
     */
    public rebuildIndexes(table: string, complete: (time: number) => void) {
        const start = new Date().getTime();
        fastALL(Object.keys(this.tableInfo), (ta, k, tableDone) => {
            if ((table !== "_ALL_" && table !== ta) || ta.indexOf("_") === 0) {
                tableDone();
                return;
            }
            const secondIndexes = this.tableInfo[ta]._secondaryIndexes;
            fastALL(secondIndexes, (column, j, idxDone) => {
                const idxTable = "_" + ta + "_idx_" + column;
                const pk = this.tableInfo[ta]._pk;
                this._drop(idxTable, () => {
                    this._read(ta, (row, idx, done) => {
                        this._setSecondaryIndexes(ta, row[pk], row, [], () => {
                            done(false);
                        });
                    }, idxDone);
                });
            }).then(tableDone);
        }).then(() => {
            complete(new Date().getTime() - start);
        });
    }

    /**
     * Turn any js variable into a 32 character long primary key for secondary index tables.
     *
     * @internal
     * @param {*} value
     * @returns {(string|number)}
     * @memberof _NanoSQLStorage
     */
    private _secondaryIndexKey(value: any): string | number {
        if (isObject(value) || Array.isArray(value)) {
            return JSON.stringify(value).substr(0, 12);
        }
        if (typeof value === "number") {
            return value;
        }
        return String(value).substr(0, 32);
    }

    /**
     * Use variouse methods to detect the best persistent storage method for the environment NanoSQL is in.
     *
     * @returns {string}
     * @memberof _NanoSQLStorage
     */
    public _detectStorageMethod(): string {

        if (typeof window === "undefined") { // NodeJS
            return "LVL";
        } else { // Browser
            if (isSafari) { // Safari always gets WebSQL (mobile and desktop)
                return "WSQL";
            }

            if (isMSBrowser) { // IE and Edge don't support Indexed DB web workers, and may not support indexed db at all.
                return typeof indexedDB !== "undefined" ? "IDB" : "LS";
            }

            // everyone else (FF + Chrome)
            // check for support for indexed db, web workers and blob
            if ([typeof Worker, typeof Blob, typeof indexedDB].indexOf("undefined") === -1 && window.URL && window.URL.createObjectURL) {
                try {
                    const w = new Worker(window.URL.createObjectURL(new Blob(["var t = 't';"])));
                    w.postMessage("");
                    w.terminate();
                    const idbID = "1234";
                    indexedDB.open(idbID, 1);
                    indexedDB.deleteDatabase(idbID);
                    return "IDB_WW";
                } catch (e) { // worker, blob, or indexed DB failed
                    if (typeof indexedDB !== "undefined") { // fall back to indexed db if we can
                        return "IDB";
                    }
                }
            }

            // nothing else works, we gotta do local storage. :(
            return "LS";
        }
    }

    /**
     * Get rows from a table given the column and secondary index primary key to read from.
     *
     * @param {string} table
     * @param {string} column
     * @param {string} search
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _NanoSQLStorage
     */
    public _secondaryIndexRead(table: string, column: string, search: string, callback: (rows: DBRow[]) => void) {
        this._adapter.read("_" + table + "_idx_" + column, this._secondaryIndexKey(search) as any, (row) => {
            if (row !== undefined) {
                this._read(table, (row["rows"] || []), callback);
            } else {
                callback([]);
            }
        });
    }

    /**
     * Get a range of rows from a given table.
     * The range is in limit/offset form where the from and to values are numbers indicating a range of rows to get.
     *
     * @param {string} table
     * @param {DBKey} from
     * @param {DBKey} to
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _NanoSQLStorage
     */
    public _rangeReadIDX(table: string, fromIdx: number, toIdx: number, complete: (rows: DBRow[]) => void) {

        let rows: any[] = [];
        this._adapter.rangeRead(table, (row, idx, next) => {
            rows.push(row);
            next();
        }, () => {
            complete(rows);
        }, fromIdx, toIdx);
    }

    /**
     * Get a range fo rows from a given table.
     * The range is provided as the rows between two primary key values.
     *
     * @param {string} table
     * @param {*} fromPK
     * @param {*} toPK
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _NanoSQLStorage
     */
    public _rangeReadPKs(table: string, fromPK: any, toPK: any, complete: (rows: DBRow[]) => void) {

        let rows: any[] = [];
        this._adapter.rangeRead(table, (row, idx, next) => {
            rows.push(row);
            next();
        }, () => {
            complete(rows);
        }, fromPK, toPK, true);
    }

    /**
     * Full table scan if a function is passed in OR read an array of primary keys.
     *
     * @param {string} table
     * @param {(row: DBRow, idx: number, toKeep: (result: boolean) => void) => void} query
     * @param {(rows: DBRow[]) => void} callback
     * @returns
     * @memberof _NanoSQLStorage
     */
    public _read(table: string, query: (row: DBRow, idx: number, toKeep: (result: boolean) => void) => void | any[], callback: (rows: DBRow[]) => void) {

        if (Array.isArray(query)) { // select by array of primary keys
            fastALL(query, (q, i, result) => {
                this._adapter.read(table, q, result);
            }).then((rows) => {
                callback(rows.filter(r => r));
            });
            return;
        }

        let rows: any[] = [];

        if (typeof query === "function") { // iterate through entire db, returning rows that return true on the function
            this._adapter.rangeRead(table, (row, idx, nextRow) => {
                query(row, idx, (keep) => {
                    if (keep) {
                        rows.push(row);
                    }
                    nextRow();
                });
            }, () => {
                callback(rows);
            });
            return;
        }
    }

    /**
     * Get all values in a table where the column value matches against the given trie search value.
     *
     * @param {string} table
     * @param {string} column
     * @param {string} search
     * @param {(rows: DBRow[] ) => void} callback
     * @memberof _NanoSQLStorage
     */
    public _trieRead(table: string, column: string, search: string, callback: (rows: DBRow[]) => void) {
        const words = this._trieIndexes[table][column].getPrefix(search) as any[];

        fastALL(words, (w, i, result) => {
            this._secondaryIndexRead(table, column, w, result);
        }).then((arrayOfRows) => {
            callback([].concat.apply([], arrayOfRows));
        });
    }

    /**
     * Remove secondary index values of a specific row.
     *
     * @internal
     * @param {string} table
     * @param {DBKey} pk
     * @param {DBRow} rowData
     * @param {string[]} skipColumns
     * @param {() => void} complete
     * @memberof _NanoSQLStorage
     */
    private _clearSecondaryIndexes(table: string, pk: DBKey, rowData: DBRow, skipColumns: string[], complete: () => void): void {

        fastALL(this.tableInfo[table]._secondaryIndexes.filter(idx => skipColumns.indexOf(idx) === -1), (idx, k, done) => {

            const column = this._secondaryIndexKey(rowData[idx]) as any;

            const idxTable = "_" + table + "_idx_" + idx;
            this._adapter.read(idxTable, column, (row) => {
                if (!row) {
                    done();
                    return;
                }
                const i = row.rows.indexOf(pk);
                if (i === -1) {
                    done();
                    return;
                }
                let newRow = row ? Object.isFrozen(row) ? _assign(row) : row : { id: null, rows: [] };
                newRow.rows.splice(i, 1);
                newRow.rows.sort();
                newRow.rows = removeDuplicates(newRow.rows);
                this._adapter.write(idxTable, newRow.id, newRow, done, true);
            });
        }).then(complete);
    }

    /**
     * Add secondary index values for a specific row.
     *
     * @internal
     * @param {string} table
     * @param {DBKey} pk
     * @param {DBRow} rowData
     * @param {string[]} skipColumns
     * @param {() => void} complete
     * @memberof _NanoSQLStorage
     */
    private _setSecondaryIndexes(table: string, pk: DBKey, rowData: DBRow, skipColumns: string[], complete: () => void) {
        fastALL(this.tableInfo[table]._secondaryIndexes.filter(idx => skipColumns.indexOf(idx) === -1), (idx, i, done) => {

                const column = this._secondaryIndexKey(rowData[idx]) as any;
                if (this._trieIndexes[table][idx]) {
                    this._trieIndexes[table][idx].addWord(String(rowData[idx]));
                }

                const idxTable = "_" + table + "_idx_" + idx;
                this._adapter.read(idxTable, column, (row) => {
                    let indexRow: { id: DBKey, rows: any[] } = row ? Object.isFrozen(row) ? _assign(row) : row : { id: column, rows: [] };
                    indexRow.rows.push(pk);
                    indexRow.rows.sort();
                    indexRow.rows = removeDuplicates(indexRow.rows);
                    this._adapter.write(idxTable, column, indexRow, done, true);
                });
        }).then(complete);
    }

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
    public _write(table: string, pk: DBKey, oldRow: any, newRow: DBRow, complete: (row: DBRow) => void) {

        if (!oldRow) { // new row

            this._adapter.write(table, pk, newRow, (row) => {

                if (this.tableInfo[table]._secondaryIndexes.length) {
                    this._setSecondaryIndexes(table, row[this.tableInfo[table]._pk], newRow, [], () => {
                        complete(row);
                    });
                } else {
                    complete(row);
                }

            }, true);


        } else { // existing row

            const setRow = {
                ...oldRow,
                ...newRow,
                [this.tableInfo[table]._pk]: pk
            };

            const sameKeys = Object.keys(setRow).filter((key) => {
                return setRow[key] === oldRow[key];
            });

            if (this.tableInfo[table]._secondaryIndexes.length) {
                this._clearSecondaryIndexes(table, pk, oldRow, sameKeys, () => {
                    this._setSecondaryIndexes(table, pk, setRow, sameKeys, () => {
                        this._adapter.write(table, pk, setRow, complete, true);
                    });
                });
            } else {
                this._adapter.write(table, pk, setRow, complete, true);
            }
        }
    }

    /**
     * Delete a specific row from the database.
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {(row: DBRow) => void} complete
     * @memberof _NanoSQLStorage
     */
    public _delete(table: string, pk: DBKey, complete: (row: DBRow) => void) {
        if (!pk) {
            throw new Error("Can't delete without a primary key!");
        } else {

            // update secondary indexes
            this._adapter.read(table, pk, (row) => {
                this._clearSecondaryIndexes(table, pk, row, [], () => {
                    // do the delete
                    this._adapter.delete(table, pk, () => {
                        complete(row);
                    });
                });
            });
        }
    }

    /**
     * Drop entire table from the database.
     *
     * @param {string} table
     * @param {() => void} complete
     * @memberof _NanoSQLStorage
     */
    public _drop(table: string, complete: () => void) {
        fastALL(this.tableInfo[table]._secondaryIndexes, (idx, i, done) => {
            this._adapter.drop("_" + table + "_idx_" + idx, done);
        }).then(() => {
            this._trieIndexes[table] = {};
            this.tableInfo[table]._trieColumns.forEach((co) => {
                this._trieIndexes[table][co] = new Trie([]);
            });
            this._adapter.drop(table, complete);
        });
    }

    /**
     * Find secondary indexes and automatically generate an index table for each.
     *
     * @internal
     * @param {StdObject<DataModel[]>} dataModels
     * @returns
     * @memberof NanoSQLStorage
     */
    private _createSecondaryIndexTables(dataModels: StdObject<DataModel[]>) {

        Object.keys(dataModels).forEach((table) => {
            let hasPK = false;
            let hasIDX = false;
            dataModels[table].forEach((model) => {
                if (model.props && model.props.indexOf("pk") > -1) {
                    hasPK = true;
                }
                if (model.props && (model.props.indexOf("idx") > -1 || model.props.indexOf("trie") > -1)) {
                    hasIDX = true;
                    dataModels["_" + table + "_idx_" + model.key] = [
                        { key: "id", type: "string", props: ["pk"] },
                        { key: "rows", type: "any[]" }
                    ];
                }
            });
            if (hasIDX && !hasPK) {
                throw new Error("Tables with secondary indexes must have a primary key!");
            }
        });

        return dataModels;
    }

    /**
     * Generate the data needed to manage each table in the database
     *
     * @internal
     * @param {string} tableName
     * @param {DataModel[]} dataModels
     * @returns {string}
     * @memberof NanoSQLStorage
     */
    private _newTable(tableName: string, dataModels: DataModel[]): string {


        this.tableInfo[tableName] = {
            _pk: "",
            _pkType: "",
            _keys: [],
            _defaults: [],
            _secondaryIndexes: [],
            _trieColumns: [],
            _name: tableName,
        };

        this._cache[tableName] = {};
        this._cacheKeys[tableName] = {};

        this._trieIndexes[tableName] = {};

        this._adapter.makeTable(tableName, dataModels);

        // Discover primary keys for each table
        let i = this.models[tableName].length;
        while (i--) {
            const p = this.models[tableName][i];
            this.tableInfo[tableName]._keys.unshift(p.key);
            this.tableInfo[tableName]._defaults[i] = p.default;

            // Check for primary key
            if (p.props && p.props.indexOf("pk") > -1) {
                this.tableInfo[tableName]._pk = p.key;
                this.tableInfo[tableName]._pkType = p.type;
            }

            // Check for secondary indexes
            if (p.props && (p.props.indexOf("idx") > -1 || p.props.indexOf("trie") > -1)) {
                this.tableInfo[tableName]._secondaryIndexes.push(p.key);
            }

            // Check for trie indexes
            if (p.props && p.props.indexOf("trie") >= 0) {
                this.tableInfo[tableName]._trieColumns.push(p.key);
                this._trieIndexes[tableName][p.key] = new Trie([]);
            }
        }

        return tableName;
    }
}