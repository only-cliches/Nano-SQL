import { Trie } from "prefix-trie-ts";
import { IdbQuery } from "../query/std-query";
import { DataModel, NanoSQLInstance, NanoSQLConfig, NanoSQLBackupAdapter } from "../index";
import { StdObject, hash, fastALL, fastCHAIN, deepFreeze, uuid, intersect, timeid, _assign, generateID, isSafari, isMSBrowser, isObject, removeDuplicates, random16Bits, Promise, binarySearch } from "../utilities";
import { _SyncStore } from "./adapter-sync";
import { _IndexedDBStore } from "./adapter-indexedDB";
import { _WebSQLStore } from "./adapter-websql";
import { setFast } from "lie-ts";
/* NODE-START */
import { _LevelStore } from "./adapter-levelDB";
import { DatabaseIndex } from "./db-idx";
/* NODE-END */
const queue = require("queue");

export interface DBRow {
    [key: string]: any;
}

export interface DBKey {
    string;
    number;
}


export interface QueryQ {
    add: (table: string, cb: (done: () => void) => void) => void;
    qs: { [table: string]: any };
}

const newQueryQ = (_this: _NanoSQLStorage): QueryQ => {
    return {
        qs: {},
        add: (table: string, cb: (done: () => void) => void): void => {

            if (!_this.queue.qs[table]) {
                _this.queue.qs[table] = queue({ autostart: true, concurrency: 1 });
            }

            _this.queue.qs[table].push((done) => {
                setFast(() => cb(done));
            });

        }
    };
};

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

    // Optional methods

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
// tslint:disable-next-line
export class _NanoSQLStorage {

    public _mode: string | NanoSQLStorageAdapter; // mode or adapater the system uses.

    public _id: string; // database ID

    public queue: QueryQ;

    // public _adapter: NanoSQLStorageAdapter; // The storage adapter used by the system.

    public tableInfo: {
        [tableName: string]: {
            _pk: string // Primary Key Column
            _pkType: string // Primary Key Type
            _name: string // table name
            _secondaryIndexes: string[] // secondary index columns
            _searchColumns: {
                [column: string]: string[];
            }
            _trieColumns: string[] // trie columns
            _keys: string[] // array of columns
            _defaults: { [column: string]: any };
            _hasDefaults: boolean;
            _views: { // views present on this table
                [table: string]: {
                    pkColumn: string;
                    mode: string; // GHOST or LIVE
                    columns: { thisColumn: string, otherColumn: string }[]
                }
            }
            _viewTables: { table: string, column: string }[] // other tables we need to check when rows are updated on this table
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
     * Wether views exist the data model or not.
     *
     * @type {boolean}
     * @memberof _NanoSQLStorage
     */
    public _hasViews: boolean;

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

    public _secondaryIndexes: {
        [table: string]: {
            idx: any[];
            rows: any;
            sortIdx: boolean;
        }
    };

    public _secondaryIndexUpdates: {
        [table: string]: any[];
    };

    public adapters: NanoSQLBackupAdapter[];

    constructor(parent: NanoSQLInstance, args: NanoSQLConfig) {
        this._secondaryIndexes = {};
        this._secondaryIndexUpdates = {};

        this._nsql = parent;
        this._mode = args.persistent ? "PERM" : args.mode || "TEMP" as any;
        this._id = args.id as any;
        this._size = args.size || 5;
        this.queue = newQueryQ(this);

        this.adapters = [];
        this.models = {};
        this.tableInfo = {};
        this._trieIndexes = {};
        this._tableNames = [];
        this._doCache = (typeof args.cache !== "undefined" ? args.cache : true);
        this._cache = {};

        if (this._doCache && args.peer && typeof window !== "undefined") {
            const prevTable = parent.sTable;
            parent.table("*").on("peer-change", (ev) => {
                this._cache[ev.table] = {};
            });
            parent.table(prevTable);
        }

        this.adapters[0] = {
            adapter: null as any,
            waitForWrites: true
        };

        if (typeof this._mode === "string") {
            if (this._mode === "PERM") {
                this._mode = this._detectStorageMethod() || this._mode;
            }

            switch (this._mode) {
                case "IDB":
                case "IDB_WW":
                    this.adapters[0].adapter = new _IndexedDBStore(args.idbVersion);
                    break;
                case "WSQL":
                    this.adapters[0].adapter = new _WebSQLStore(this._size);
                    break;
                case "LS":
                    this.adapters[0].adapter = new _SyncStore(true);
                    break;
                /* NODE-START */
                case "LVL":
                    this.adapters[0].adapter = new _LevelStore(args.dbPath, args.writeCache, args.readCache);
                    break;
                /* NODE-END */
                case "TEMP":
                    this.adapters[0].adapter = new _SyncStore(false);
                    break;
            }
        } else {
            this.adapters[0].adapter = this._mode;
        }
    }

    public _isFlushing: boolean;

    public _flushIndexes() {
        if (this._doCache && !this._isFlushing && Object.keys(this._secondaryIndexUpdates).length) {
            this._isFlushing = true;
            const indexes = _assign(this._secondaryIndexUpdates);
            this._secondaryIndexUpdates = {};
            fastALL(Object.keys(indexes), (table, i, done) => {
                const PKs = indexes[table];
                fastALL(PKs, (pk, ii, nextRow) => {
                    this.adapterWrite(table, pk, _assign(this._secondaryIndexes[table].rows[pk]), nextRow, (err) => {

                    });
                }).then(done);
            }).then(() => {
                // flush indexes to database no more than every 100ms.
                setTimeout(() => {
                    this._isFlushing = false;
                    this._flushIndexes();
                }, 100);
            });
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

        this.models = this._createIndexTables(dataModels);

        this._tableNames = Object.keys(this.models);

        this.adapters.forEach((a) => {
            a.adapter.setID(this._id);
        });

        this._tableNames.forEach((table) => {
            this._newTable(table, dataModels[table]);
        });

        this._relFromTable = {};
        this._relToTable = {};
        this._relationColumns = {};
        this._columnsAreTables = {};

        this._tableNames.forEach((table) => {
            // finish views data
            // gets a list of tables that need to be checked on each row update of this table
            this.tableInfo[table]._viewTables = Object.keys(this.tableInfo).reduce((prev, cur) => {
                if (cur === table) return prev;
                let vTables = Object.keys(this.tableInfo[cur]._views);
                if (vTables.indexOf(table) !== -1) {
                    prev.push({ table: cur, column: this.tableInfo[cur]._views[table].pkColumn });
                }
                return prev;
            }, [] as any[]);

            // finish ORM and other stuff
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
                            // old format ref=>column or ref=>column[]
                            if (p.indexOf("ref=>") !== -1) {
                                mapTo = p.replace("ref=>", "");
                            }
                            // new format orm(column) or orm(column[])
                            if (p.indexOf("orm(") === 0) {
                                mapTo = p.replace(/orm\((.*)\)/gmi, "$1");
                            }
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

        fastALL(this.adapters, (a: NanoSQLBackupAdapter, i, done) => {
            a.adapter.connect(() => {
                if (a.adapter.setNSQL) {
                    a.adapter.setNSQL(this._nsql);
                }
                done();
            });
        }).then(() => {

            // populate trie data
            fastALL(Object.keys(this._trieIndexes), (table, i, tableDone) => {
                const trieColumns = this._trieIndexes[table];
                if (Object.keys(trieColumns).length) {
                    fastALL(Object.keys(trieColumns), (column, ii, nextColumn) => {
                        const idxTable = "_" + table + "_idx_" + column;
                        this.adapters[0].adapter.getIndex(idxTable, false, (index: any[]) => {
                            index.forEach((value) => {
                                this._trieIndexes[table][column].addWord(String(value));
                            });
                            nextColumn();
                        });
                    }).then(tableDone);
                } else {
                    tableDone();
                }
            }).then(() => {
                // populate cached secondary indexes from persistent storage
                if (this._doCache) {
                    fastALL(Object.keys(this.tableInfo), (table, i, next) => {
                        fastALL(this.tableInfo[table]._secondaryIndexes, (column, ii, nextCol) => {
                            const idxTable = "_" + table + "_idx_" + column;
                            this.adapters[0].adapter.getIndex(idxTable, false, (index: any[]) => {
                                this._secondaryIndexes[idxTable].idx = index;
                                this.adapters[0].adapter.rangeRead(idxTable, (row, i, nextRow) => {
                                    this._secondaryIndexes[idxTable].rows[row.id] = row;
                                    nextRow();
                                }, nextCol);
                            });
                        }).then(next);
                    }).then(() => {
                        complete(this.models);
                    });
                } else {
                    complete(this.models);
                }
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
        fastALL(Object.keys(this.tableInfo), (ta, k, tableDone, tableErr) => {
            if ((table !== "_ALL_" && table !== ta) || ta.indexOf("_") === 0) {
                tableDone();
                return;
            }
            const secondIndexes = this.tableInfo[ta]._secondaryIndexes;
            fastALL(secondIndexes, (column, j, idxDone) => {
                const idxTable = "_" + ta + "_idx_" + column;

                this._secondaryIndexes[idxTable].idx = [];
                this._secondaryIndexes[idxTable].rows = {};
                this._secondaryIndexUpdates[idxTable] = [];

                this._drop(idxTable, idxDone);
            }).then(() => {
                const pk = this.tableInfo[ta]._pk;
                let indexGroups: {
                    [secondIndex: string]: {
                        [group: string]: any[] // rows
                    }
                } = {};
                secondIndexes.forEach((column) => {
                    indexGroups[column] = {};
                });

                this._read(ta, (row, idx, done) => {
                    if (!row[pk]) {
                        done(false);
                        return;
                    }
                    secondIndexes.forEach((column) => {
                        if (!row[column]) {
                            return;
                        }
                        if (!indexGroups[column][row[column]]) {
                            indexGroups[column][row[column]] = [];
                        }
                        indexGroups[column][row[column]].push(row[pk]);
                    });
                    done(false);

                    /*this._setSecondaryIndexes(ta, row[pk], row, [], () => {
                        done(false);
                    });*/
                }, () => {

                    fastALL(secondIndexes, (item, i, done) => {
                        const idxTable = "_" + ta + "_idx_" + item;
                        if (this._doCache) {
                            Object.keys(indexGroups[item]).forEach((rowKey, i) => {
                                this._secondaryIndexUpdates[idxTable].push(rowKey);
                                this._secondaryIndexes[idxTable].idx.push(rowKey);
                                this._secondaryIndexes[idxTable].rows[rowKey] = {id: rowKey, rows: indexGroups[item][rowKey]};
                            });
                            done();
                        } else {
                            fastALL(Object.keys(indexGroups[item]), (rowKey, i, next, err) => {
                                this.adapterWrite(idxTable, rowKey, {
                                    id: rowKey,
                                    rows: indexGroups[item][rowKey].sort()
                                }, next, err);
                            }).then(done).catch(tableErr);
                        }
                    }).then(() => {
                        tableDone();
                    }).catch(tableErr);
                });
            });
        }).then(() => {
            if (this._doCache) {
                this._flushIndexes();
            }
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

        // NodeJS
        if (typeof window === "undefined") {
            return "LVL";
        }

        // Browser

        // Safari / iOS always gets WebSQL (mobile and desktop)
        if (isSafari) {
            return "WSQL";
        }

        // everyone else (FF + Chrome + Edge + IE)
        // check for support for indexed db, web workers and blob
        if (typeof indexedDB !== "undefined") { // fall back to indexed db if we can
            return "IDB";
        }

        // Use WebSQL if it's there.
        if (typeof window !== "undefined" && typeof window.openDatabase !== "undefined") {
            return "WSQL";
        }

        // nothing else works, we gotta do local storage. :(
        return "LS";

    }

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
    public _secondaryIndexRead(table: string, condition: string, column: string, search: string, callback: (rows: DBRow[]) => void) {

        const getSecondaryIndex = (table: string, pks: any[], cb: (rows: {id: any, rows: any[]}[]) => void) => {
            if (this._doCache) {
                cb(pks.map(pk => this._secondaryIndexes[table].rows[pk]).filter(r => r));
            } else {
                if (pks.length === 1) {
                    this.adapters[0].adapter.read(table, pks[0], (row) => {
                        cb([row as any]);
                    });
                } else {
                    this._read(table, pks as any, (rows) => {
                        cb(rows as any);
                    });
                }
            }
        };

        const getSecondaryIndexKeys = (table: string, cb: (index: any[]) => void) => {
            if (this._doCache) {
                cb(this._secondaryIndexes[table].idx);
            } else {
                this.adapters[0].adapter.getIndex(table, false, cb);
            }
        };

        switch (condition) {
            case "=":
                getSecondaryIndex("_" + table + "_idx_" + column, [this._secondaryIndexKey(search) as any], (rows: any[]) => {
                    if (rows[0] !== undefined && rows[0] !== null) {
                        this._read(table, (rows[0]["rows"] || []) as any, (rows) => {
                            callback(rows);
                        });
                    } else {
                        callback([]);
                    }
                });
                break;
            default:

                getSecondaryIndexKeys("_" + table + "_idx_" + column, (index: any[]) => {
                    const searchVal = this._secondaryIndexKey(search);
                    const getPKs = index.filter((val) => {
                        switch (condition) {
                            case ">": return val > searchVal;
                            case ">=": return val >= searchVal;
                            case "<": return val < searchVal;
                            case "<=": return val <= searchVal;
                        }
                        return false;
                    });

                    if (!getPKs.length) {
                        callback([]);
                        return;
                    }
                    getSecondaryIndex("_" + table + "_idx_" + column, getPKs as any, (rows) => {
                        const rowPKs = [].concat.apply([], rows.map(r => r.rows));
                        if (!rowPKs.length) {
                            callback([]);
                            return;
                        }
                        this._read(table, rowPKs as any, (rows) => {
                            callback(rows);
                        });
                    });
                });
        }





    }

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
    public _rangeRead(table: string, from: any, to: any, usePKs: boolean, complete: (rows: DBRow[]) => void) {

        let rows: any[] = [];
        this.adapters[0].adapter.rangeRead(table, (row, idx, next) => {
            rows.push(row);
            next();
        }, () => {
            complete(rows);
        }, from, to, usePKs);
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

            const batchRead = this.adapters[0].adapter.batchRead;
            if (batchRead) {
                batchRead.apply(this.adapters[0].adapter, [table, query as any, callback]);
            } else {
                // possibly (but not always) slower fallback
                fastALL(query, (q, i, result) => {
                    this.adapters[0].adapter.read(table, q, result);
                }).then((rows) => {
                    callback(rows.filter(r => r));
                });
            }

            return;
        }

        let rows: any[] = [];
        // full table scan
        if (typeof query === "function") { // iterate through entire db, returning rows that return true on the function
            this.adapters[0].adapter.rangeRead(table, (row, idx, nextRow) => {
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
            this._secondaryIndexRead(table, "=", column, w, result);
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
    private _clearSecondaryIndexes(table: string, pk: DBKey, rowData: DBRow, doColumns: string[], complete: () => void): void {

        if (this._doCache) {
            doColumns.forEach((idx) => {
                const idxTable = "_" + table + "_idx_" + idx;
                const column = this._secondaryIndexKey(rowData[idx]) as any;
                if (!this._secondaryIndexUpdates[idxTable]) {
                    this._secondaryIndexUpdates[idxTable] = [];
                }
                if (this._secondaryIndexUpdates[idxTable].indexOf(column) === -1) {
                    this._secondaryIndexUpdates[idxTable].push(column);
                }
                const index = this._secondaryIndexes[idxTable].rows[column];
                if (!index) {
                    return;
                }
                const i = index.rows.indexOf(pk);
                if (i === -1) {
                    return;
                }
                let newRow = index || { id: column, rows: [] };
                newRow.rows.splice(i, 1);
                this._secondaryIndexes[idxTable].rows[column] = newRow;
            });
            this._flushIndexes();
            complete();
        } else {
            fastALL(doColumns, (idx, k, done, error) => {

                const column = this._secondaryIndexKey(rowData[idx]) as any;

                const idxTable = "_" + table + "_idx_" + idx;
                this.adapters[0].adapter.read(idxTable, column, (row) => {
                    if (!row) {
                        done();
                        return;
                    }
                    const i = row.rows.indexOf(pk);
                    if (i === -1) {
                        done();
                        return;
                    }
                    let newRow = row ? Object.isFrozen(row) ? _assign(row) : row : { id: column, rows: [] };
                    newRow.rows.splice(i, 1);
                    // newRow.rows = removeDuplicates(newRow.rows);
                    this.adapterWrite(idxTable, newRow.id, newRow, done, error);
                });
            }).then(complete);
        }

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
    private _setSecondaryIndexes(table: string, pk: DBKey, rowData: DBRow, doColumns: string[], complete?: () => void) {
        if (this._doCache) {

            doColumns.forEach((col, i) => {
                const column = this._secondaryIndexKey(rowData[col]) as any;

                if (typeof column === "undefined") {
                    return;
                }
                if (typeof column === "string" && !column.length) {
                    return;
                }
                if (this._trieIndexes[table][col]) {
                    this._trieIndexes[table][col].addWord(String(rowData[col]));
                }
                const idxTable = "_" + table + "_idx_" + col;
                if (!this._secondaryIndexUpdates[idxTable]) {
                    this._secondaryIndexUpdates[idxTable] = [];
                }
                if (this._secondaryIndexUpdates[idxTable].indexOf(column) === -1) {
                    this._secondaryIndexUpdates[idxTable].push(column);
                }
                let indexRow = this._secondaryIndexes[idxTable].rows[column];
                if (!indexRow) {
                    indexRow = { id: column, rows: [] };
                    if (this._secondaryIndexes[idxTable].sortIdx) {
                        const pos = binarySearch(this._secondaryIndexes[idxTable].idx, column);
                        this._secondaryIndexes[idxTable].idx.splice(pos, 0, column);
                    } else {
                        this._secondaryIndexes[idxTable].idx.push(column);
                    }
                }
                indexRow.rows.push(pk);
                this._secondaryIndexes[idxTable].rows[column] = indexRow;
            });
            this._flushIndexes();
            if (complete) complete();
        } else {
            fastALL(doColumns, (col, i, done, error) => {

                const column = this._secondaryIndexKey(rowData[col]) as any;
                if (typeof column === "undefined") {
                    done();
                    return;
                }
                if (typeof column === "string" && !column.length) {
                    done();
                    return;
                }

                if (this._trieIndexes[table][col]) {
                    this._trieIndexes[table][col].addWord(String(rowData[col]));
                }

                const idxTable = "_" + table + "_idx_" + col;
                this.adapters[0].adapter.read(idxTable, column, (row) => {
                    let indexRow: { id: DBKey, rows: any[] } = row ? (Object.isFrozen(row) ? _assign(row) : row) : { id: column, rows: [] };
                    indexRow.rows.push(pk);
                    // indexRow.rows.sort();
                    // indexRow.rows = removeDuplicates(indexRow.rows);
                    this.adapterWrite(idxTable, column, indexRow, done, error);
                });
            }).then(() => {
                if (complete) complete();
            });
        }

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
    public _write(table: string, pk: DBKey, oldRow: any, newRow: DBRow, complete: (row: DBRow) => void, error: (erro: Error) => void) {

        if (!oldRow) { // new row
            this.adapterWrite(table, pk, newRow, (row) => {
                if (this.tableInfo[table]._secondaryIndexes.length) {
                    this._setSecondaryIndexes(table, row[this.tableInfo[table]._pk], newRow, this.tableInfo[table]._secondaryIndexes, () => {
                        complete(row);
                    });
                } else {
                    complete(row);
                }
            }, error);

        } else { // existing row

            const setRow = {
                ...oldRow,
                ...newRow,
                [this.tableInfo[table]._pk]: pk
            };

            const doColumns = this.tableInfo[table]._secondaryIndexes.filter(col => Object.keys(setRow).filter((key) => {
                return setRow[key] === oldRow[key];
            }).indexOf(col) === -1);

            if (this.tableInfo[table]._secondaryIndexes.length) {
                fastALL([0, 1, 2], (idx, i, next, err) => {
                    switch (idx) {
                        case 0:
                            this._clearSecondaryIndexes(table, pk, oldRow, doColumns, next);
                            break;
                        case 1:
                            this._setSecondaryIndexes(table, pk, setRow, doColumns, next);
                            break;
                        case 2:
                            this.adapterWrite(table, pk, setRow, next, err);
                            break;
                    }
                }).then((results) => {
                    complete(results[2]);
                }).catch(error);

            } else {
                this.adapterWrite(table, pk, setRow, (row) => {
                    complete(row);
                }, error);
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
            throw new Error("nSQL: Can't delete without a primary key!");
        } else {

            // update secondary indexes
            this.adapters[0].adapter.read(table, pk, (row) => {
                fastALL([0, 1], (job, ii, next) => {
                    switch (job) {
                        case 0:
                            this._clearSecondaryIndexes(table, pk, row, this.tableInfo[table]._secondaryIndexes, next);
                            break;
                        case 1:
                            this.adapterDelete(table, pk, next);
                            break;
                    }
                }).then(() => {
                    complete(row);
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
        // drop token and hash search cache
        let tablesToDrop: string[] = Object.keys(this.tableInfo[table]._searchColumns).map(t => "_" + table + "_search_tokens_" + t);
        tablesToDrop = tablesToDrop.concat(Object.keys(this.tableInfo[table]._searchColumns).map(t => "_" + table + "_search_" + t));
        tablesToDrop = tablesToDrop.concat(Object.keys(this.tableInfo[table]._searchColumns).map(t => "_" + table + "_search_fuzzy_" + t));

        // drop secondary indexes
        const secondaryIdxs = this.tableInfo[table]._secondaryIndexes.map(t => "_" + table + "_idx_" + t);
        tablesToDrop = tablesToDrop.concat(secondaryIdxs);

        if (this._doCache) {
            secondaryIdxs.forEach((idxTable) => {
                this._secondaryIndexes[idxTable].idx = [];
                this._secondaryIndexes[idxTable].rows = {};
            });
        }

        fastALL(tablesToDrop, (table, i, done) => {
            this.adapterDrop(table, done);
        }).then(() => {

            this._trieIndexes[table] = {};
            this.tableInfo[table]._trieColumns.forEach((co) => {
                this._trieIndexes[table][co] = new Trie([]);
            });
            this.adapterDrop(table, complete);
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
    private _createIndexTables(dataModels: StdObject<DataModel[]>) {

        Object.keys(dataModels).forEach((table) => {
            let hasIDX = false;
            let hasSearch = false;
            let pkType: string = "";
            dataModels[table].forEach((model) => {

                if (model.props && model.props.length) {
                    if (intersect(["pk", "pk()"], model.props)) {
                        pkType = model.key;
                    }
                    if (intersect(["trie", "idx", "idx()", "trie()"], model.props)) {
                        hasIDX = true;
                        const isNumber = ["number", "float", "int"].indexOf(model.type) !== -1;
                        dataModels["_" + table + "_idx_" + model.key] = [
                            { key: "id", type: isNumber ? model.type : "string", props: ["pk()"] },
                            { key: "rows", type: "any[]" }
                        ];
                    }
                    model.props.forEach((prop) => {
                        if (prop.indexOf("search(") !== -1) {
                            hasSearch = true;
                            dataModels["_" + table + "_search_" + model.key] = [
                                { key: "wrd", type: "string", props: ["pk()", "ns()"] },
                                { key: "rows", type: "any[]" }
                            ];
                            dataModels["_" + table + "_search_fuzzy_" + model.key] = [
                                { key: "wrd", type: "string", props: ["pk()", "ns()"] },
                                { key: "rows", type: "any[]" }
                            ];
                            dataModels["_" + table + "_search_tokens_" + model.key] = [
                                { key: "id", type: pkType, props: ["pk()", "ns()"] },
                                { key: "hash", type: "string" },
                                { key: "tokens", type: "any[]" }
                            ];
                        }
                    });
                }
            });
            if ((hasIDX || hasSearch) && !pkType) {
                throw new Error("nSQL: Tables with secondary indexes or search() must have a primary key!");
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
            _hasDefaults: false,
            _trieColumns: [],
            _name: tableName,
            _views: {},
            _viewTables: [],
            _searchColumns: {}
        };

        this._cache[tableName] = {};

        this._trieIndexes[tableName] = {};

        this.adapters.forEach((a) => {
            a.adapter.makeTable(tableName, dataModels);
        });

        // Discover primary keys for each table
        let i = this.models[tableName].length;
        while (i--) {
            const p = this.models[tableName][i];
            this.tableInfo[tableName]._keys.unshift(p.key);
            if (p.default !== undefined) {
                this.tableInfo[tableName]._defaults[p.key] = p.default;
                this.tableInfo[tableName]._hasDefaults = true;
            }

            if (p.props && p.props.length) {

                let is2ndIndex = false;

                p.props.forEach((prop) => {
                    if (prop.indexOf("from=>") !== -1) {
                        this._hasViews = true;
                        let table = p.type;
                        if (prop !== "from=>GHOST" && prop !== "from=>LIVE") {
                            // prop is "from=>table.column"
                            table = prop.replace("from=>", "").split(".").shift();
                        }

                        if (!this.tableInfo[tableName]._views[table]) {
                            this.tableInfo[tableName]._views[table] = {
                                pkColumn: "",
                                mode: "",
                                columns: []
                            };
                        }
                        if (prop === "from=>GHOST" || prop === "from=>LIVE") {
                            is2ndIndex = true;
                            this.tableInfo[tableName]._views[table].pkColumn = p.key;
                            this.tableInfo[tableName]._views[table].mode = prop.replace("from=>", "");
                        } else {
                            this.tableInfo[tableName]._views[table].columns.push({
                                thisColumn: p.key,
                                otherColumn: prop.replace("from=>", "").split(".").pop()
                            });
                        }
                    }

                    if (prop.indexOf("search(") === 0) {
                        this.tableInfo[tableName]._searchColumns[p.key] = prop.replace(/search\((.*)\)/gmi, "$1").split(",").map(c => c.trim());
                    }
                });

                // Check for primary key
                if (intersect(["pk", "pk()"], p.props)) {
                    this.tableInfo[tableName]._pk = p.key;
                    this.tableInfo[tableName]._pkType = p.type;
                }

                // Check for secondary indexes
                if (intersect(["trie", "idx", "idx()", "trie()"], p.props) || is2ndIndex) {
                    this.tableInfo[tableName]._secondaryIndexes.push(p.key);
                    this._secondaryIndexes["_" + tableName + "_idx_" + p.key] = {idx: [], rows: [], sortIdx: ["number", "int", "float"].indexOf(p.type) !== -1};
                }

                // Check for trie indexes
                if (intersect(["trie", "trie()"], p.props)) {
                    this.tableInfo[tableName]._trieColumns.push(p.key);
                    this._trieIndexes[tableName][p.key] = new Trie([]);
                }
            }
        }

        return tableName;
    }

    public adapterRead(table: string, pk: DBKey, complete: (row: DBRow) => void, queue?: boolean): void {
        this.adapters[0].adapter.read(table, pk, (row) => {
            complete(row);
        });
    }


    public adapterWrite(table: string, pk: DBKey | null, data: DBRow, complete: (finalRow: DBRow) => void, error: (err: Error) => void): void {

        let result: any;
        fastCHAIN(this.adapters, (a: NanoSQLBackupAdapter, i, done, writeErr) => {
            if (a.waitForWrites) {
                a.adapter.write(table, pk, data, (row) => {
                    result = row;
                    done();
                }, writeErr);
            } else {
                done();
                a.adapter.write(table, pk, data, (row) => { }, writeErr);
            }
        }).then(() => {
            complete(result);
        }).catch(error);
    }

    public adapterDelete(table: string, pk: DBKey, complete: () => void, error?: (err: Error) => void): void {
        fastALL(this.adapters, (a: NanoSQLBackupAdapter, i, done) => {
            if (a.waitForWrites) {
                a.adapter.delete(table, pk, () => {
                    done();
                });
            } else {
                done();
                a.adapter.delete(table, pk, () => { });
            }
        }).then(() => {
            complete();
        }).catch((err) => {
            if (error) error(err);
        });
    }

    public adapterDrop(table: string, complete: () => void, error?: (err: Error) => void): void {
        fastALL(this.adapters, (a: NanoSQLBackupAdapter, i, done) => {
            if (a.waitForWrites) {
                a.adapter.drop(table, () => {
                    done();
                });
            } else {
                done();
                a.adapter.drop(table, () => { });
            }
        }).then(() => {
            complete();
        }).catch((err) => {
            if (error) error(err);
        });
    }
}