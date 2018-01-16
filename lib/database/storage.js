var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var prefix_trie_ts_1 = require("prefix-trie-ts");
var utilities_1 = require("../utilities");
var adapter_sync_1 = require("./adapter-sync");
var adapter_indexedDB_1 = require("./adapter-indexedDB");
var adapter_websql_1 = require("./adapter-websql");
/* NODE-START */
var adapter_levelDB_1 = require("./adapter-levelDB");
/**
 * Holds the general abstractions to connect the query module to the storage adapters.
 * Takes care of indexing, tries, secondary indexes and adapter management.
 *
 * @export
 * @class _NanoSQLStorage
 */
// tslint:disable-next-line
var _NanoSQLStorage = /** @class */ (function () {
    function _NanoSQLStorage(parent, args) {
        /**
         * Array of table names
         *
         * @internal
         * @type {string[]}
         * @memberof _NanoSQLStorage
         */
        this._tableNames = [];
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
                var detect = this._detectStorageMethod();
                var modes = {
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
                    this._adapter = new adapter_indexedDB_1._IndexedDBStore(false);
                    break;
                case "IDB_WW":
                    this._adapter = new adapter_indexedDB_1._IndexedDBStore(true);
                    break;
                case "WSQL":
                    this._adapter = new adapter_websql_1._WebSQLStore(this._size);
                    break;
                case "LS":
                    this._adapter = new adapter_sync_1._SyncStore(true);
                    break;
                /* NODE-START */
                case "LVL":
                    this._adapter = new adapter_levelDB_1._LevelStore(args.dbPath, args.writeCache, args.readCache);
                    break;
                /* NODE-END */
                case "TEMP":
                    this._adapter = new adapter_sync_1._SyncStore(false);
                    break;
            }
        }
        else {
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
    _NanoSQLStorage.prototype.init = function (dataModels, complete) {
        var _this = this;
        if (!this._id) {
            this._id = utilities_1.hash(JSON.stringify(dataModels)).toString();
        }
        this._adapter.setID(this._id);
        this.models = this._createSecondaryIndexTables(dataModels);
        this._tableNames = Object.keys(this.models);
        this._tableNames.forEach(function (table) {
            _this._newTable(table, dataModels[table]);
        });
        this._relFromTable = {};
        this._relToTable = {};
        this._relationColumns = {};
        this._columnsAreTables = {};
        this._tableNames.forEach(function (table) {
            var i = _this.models[table].length;
            _this._relFromTable[table] = {};
            _this._relationColumns[table] = [];
            _this._relToTable[table] = [];
            _this._columnsAreTables[table] = {};
            var _loop_1 = function () {
                var p = _this.models[table][i];
                // Check for relations
                if (_this._tableNames.indexOf(p.type.replace("[]", "")) !== -1) {
                    var mapTo_1 = "";
                    _this._columnsAreTables[table][p.key] = {
                        _toTable: p.type.replace("[]", ""),
                        _thisType: p.type.indexOf("[]") === -1 ? "single" : "array"
                    };
                    if (p.props) {
                        p.props.forEach(function (p) {
                            if (p.indexOf("ref=>") !== -1)
                                mapTo_1 = p.replace("ref=>", "");
                        });
                        if (mapTo_1) {
                            _this._hasORM = true;
                            _this._relationColumns[table].push(p.key);
                            _this._relFromTable[table][p.key] = {
                                _toTable: p.type.replace("[]", ""),
                                _toColumn: mapTo_1.replace("[]", ""),
                                _toType: mapTo_1.indexOf("[]") === -1 ? "single" : "array",
                                _thisType: p.type.indexOf("[]") === -1 ? "single" : "array"
                            };
                        }
                    }
                }
            };
            while (i--) {
                _loop_1();
            }
        });
        Object.keys(this._relFromTable).forEach(function (table) {
            Object.keys(_this._relFromTable[table]).forEach(function (column) {
                var rel = _this._relFromTable[table][column];
                _this._relToTable[rel._toTable].push({
                    _thisColumn: rel._toColumn,
                    _thisType: rel._toType,
                    _fromTable: table,
                    _fromColumn: column,
                    _fromType: rel._thisType
                });
            });
        });
        this._adapter.connect(function () {
            // populate trie data
            utilities_1.fastALL(Object.keys(_this._trieIndexes), function (table, i, tableDone) {
                var trieColumns = _this._trieIndexes[table];
                if (Object.keys(trieColumns).length) {
                    _this._read(table, function (row, idx, toKeep) {
                        if (!row) {
                            toKeep(false);
                            return;
                        }
                        Object.keys(trieColumns).forEach(function (column) {
                            if (row[column] !== undefined) {
                                _this._trieIndexes[table][column].addWord(String(row[column]));
                            }
                        });
                        toKeep(false);
                    }, tableDone);
                }
                else {
                    tableDone();
                }
            }).then(function () {
                complete(_this.models);
            });
        });
    };
    /**
     * Rebuild secondary indexes of a given table.
     * Pass "_ALL_" as table to rebuild all indexes.
     *
     * @param {(time: number) => void} complete
     * @memberof _NanoSQLStorage
     */
    _NanoSQLStorage.prototype.rebuildIndexes = function (table, complete) {
        var _this = this;
        var start = new Date().getTime();
        utilities_1.fastALL(Object.keys(this.tableInfo), function (ta, k, tableDone) {
            if ((table !== "_ALL_" && table !== ta) || ta.indexOf("_") === 0) {
                tableDone();
                return;
            }
            var secondIndexes = _this.tableInfo[ta]._secondaryIndexes;
            utilities_1.fastALL(secondIndexes, function (column, j, idxDone) {
                var idxTable = "_" + ta + "_idx_" + column;
                _this._drop(idxTable, idxDone);
            }).then(function () {
                var pk = _this.tableInfo[ta]._pk;
                _this._read(ta, function (row, idx, done) {
                    _this._setSecondaryIndexes(ta, row[pk], row, [], function () {
                        done(false);
                    });
                }, tableDone);
            });
        }).then(function () {
            complete(new Date().getTime() - start);
        });
    };
    /**
     * Turn any js variable into a 32 character long primary key for secondary index tables.
     *
     * @internal
     * @param {*} value
     * @returns {(string|number)}
     * @memberof _NanoSQLStorage
     */
    _NanoSQLStorage.prototype._secondaryIndexKey = function (value) {
        if (utilities_1.isObject(value) || Array.isArray(value)) {
            return JSON.stringify(value).substr(0, 12);
        }
        if (typeof value === "number") {
            return value;
        }
        return String(value).substr(0, 32);
    };
    /**
     * Use variouse methods to detect the best persistent storage method for the environment NanoSQL is in.
     *
     * @returns {string}
     * @memberof _NanoSQLStorage
     */
    _NanoSQLStorage.prototype._detectStorageMethod = function () {
        if (typeof window === "undefined") {
            return "LVL";
        }
        else {
            if (utilities_1.isSafari) {
                return "WSQL";
            }
            if (utilities_1.isMSBrowser) {
                return typeof indexedDB !== "undefined" ? "IDB" : "LS";
            }
            // everyone else (FF + Chrome)
            // check for support for indexed db, web workers and blob
            if ([typeof Worker, typeof Blob, typeof indexedDB].indexOf("undefined") === -1 && window.URL && window.URL.createObjectURL) {
                try {
                    var w = new Worker(window.URL.createObjectURL(new Blob(["var t = 't';"])));
                    w.postMessage("");
                    w.terminate();
                    var idbID = "1234";
                    indexedDB.open(idbID, 1);
                    indexedDB.deleteDatabase(idbID);
                    return "IDB_WW";
                }
                catch (e) {
                    if (typeof indexedDB !== "undefined") {
                        return "IDB";
                    }
                }
            }
            // nothing else works, we gotta do local storage. :(
            return "LS";
        }
    };
    /**
     * Get rows from a table given the column and secondary index primary key to read from.
     *
     * @param {string} table
     * @param {string} column
     * @param {string} search
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _NanoSQLStorage
     */
    _NanoSQLStorage.prototype._secondaryIndexRead = function (table, column, search, callback) {
        var _this = this;
        this._adapter.read("_" + table + "_idx_" + column, this._secondaryIndexKey(search), function (row) {
            if (row !== undefined && row !== null) {
                _this._read(table, (row["rows"] || []), callback);
            }
            else {
                callback([]);
            }
        });
    };
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
    _NanoSQLStorage.prototype._rangeRead = function (table, from, to, usePKs, complete) {
        var rows = [];
        this._adapter.rangeRead(table, function (row, idx, next) {
            rows.push(row);
            next();
        }, function () {
            complete(rows);
        }, from, to, usePKs);
    };
    /**
     * Full table scan if a function is passed in OR read an array of primary keys.
     *
     * @param {string} table
     * @param {(row: DBRow, idx: number, toKeep: (result: boolean) => void) => void} query
     * @param {(rows: DBRow[]) => void} callback
     * @returns
     * @memberof _NanoSQLStorage
     */
    _NanoSQLStorage.prototype._read = function (table, query, callback) {
        var _this = this;
        if (Array.isArray(query)) {
            if (this._adapter.batchRead) {
                this._adapter.batchRead(table, query, callback);
            }
            else {
                // possibly (but not always) slower fallback
                utilities_1.fastALL(query, function (q, i, result) {
                    _this._adapter.read(table, q, result);
                }).then(function (rows) {
                    callback(rows.filter(function (r) { return r; }));
                });
            }
            return;
        }
        var rows = [];
        // full table scan
        if (typeof query === "function") {
            this._adapter.rangeRead(table, function (row, idx, nextRow) {
                query(row, idx, function (keep) {
                    if (keep) {
                        rows.push(row);
                    }
                    nextRow();
                });
            }, function () {
                callback(rows);
            });
            return;
        }
    };
    /**
     * Get all values in a table where the column value matches against the given trie search value.
     *
     * @param {string} table
     * @param {string} column
     * @param {string} search
     * @param {(rows: DBRow[] ) => void} callback
     * @memberof _NanoSQLStorage
     */
    _NanoSQLStorage.prototype._trieRead = function (table, column, search, callback) {
        var _this = this;
        var words = this._trieIndexes[table][column].getPrefix(search);
        utilities_1.fastALL(words, function (w, i, result) {
            _this._secondaryIndexRead(table, column, w, result);
        }).then(function (arrayOfRows) {
            callback([].concat.apply([], arrayOfRows));
        });
    };
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
    _NanoSQLStorage.prototype._clearSecondaryIndexes = function (table, pk, rowData, skipColumns, complete) {
        var _this = this;
        utilities_1.fastALL(this.tableInfo[table]._secondaryIndexes.filter(function (idx) { return skipColumns.indexOf(idx) === -1; }), function (idx, k, done) {
            var column = _this._secondaryIndexKey(rowData[idx]);
            var idxTable = "_" + table + "_idx_" + idx;
            _this._adapter.read(idxTable, column, function (row) {
                if (!row) {
                    done();
                    return;
                }
                var i = row.rows.indexOf(pk);
                if (i === -1) {
                    done();
                    return;
                }
                var newRow = row ? Object.isFrozen(row) ? utilities_1._assign(row) : row : { id: null, rows: [] };
                newRow.rows.splice(i, 1);
                newRow.rows.sort();
                newRow.rows = utilities_1.removeDuplicates(newRow.rows);
                _this._adapter.write(idxTable, newRow.id, newRow, done, true);
            });
        }).then(complete);
    };
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
    _NanoSQLStorage.prototype._setSecondaryIndexes = function (table, pk, rowData, skipColumns, complete) {
        var _this = this;
        utilities_1.fastALL(this.tableInfo[table]._secondaryIndexes.filter(function (idx) { return skipColumns.indexOf(idx) === -1; }), function (idx, i, done) {
            var column = _this._secondaryIndexKey(rowData[idx]);
            if (_this._trieIndexes[table][idx]) {
                _this._trieIndexes[table][idx].addWord(String(rowData[idx]));
            }
            var idxTable = "_" + table + "_idx_" + idx;
            _this._adapter.read(idxTable, column, function (row) {
                var indexRow = row ? (Object.isFrozen(row) ? utilities_1._assign(row) : row) : { id: column, rows: [] };
                indexRow.rows.push(pk);
                indexRow.rows.sort();
                indexRow.rows = utilities_1.removeDuplicates(indexRow.rows);
                _this._adapter.write(idxTable, column, indexRow, done, true);
            });
        }).then(complete);
    };
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
    _NanoSQLStorage.prototype._write = function (table, pk, oldRow, newRow, complete) {
        var _this = this;
        if (!oldRow) {
            this._adapter.write(table, pk, newRow, function (row) {
                if (_this.tableInfo[table]._secondaryIndexes.length) {
                    _this._setSecondaryIndexes(table, row[_this.tableInfo[table]._pk], newRow, [], function () {
                        complete(row);
                    });
                }
                else {
                    complete(row);
                }
            }, true);
        }
        else {
            var setRow_1 = __assign({}, oldRow, newRow, (_a = {}, _a[this.tableInfo[table]._pk] = pk, _a));
            var sameKeys_1 = Object.keys(setRow_1).filter(function (key) {
                return setRow_1[key] === oldRow[key];
            });
            if (this.tableInfo[table]._secondaryIndexes.length) {
                this._clearSecondaryIndexes(table, pk, oldRow, sameKeys_1, function () {
                    _this._setSecondaryIndexes(table, pk, setRow_1, sameKeys_1, function () {
                        _this._adapter.write(table, pk, setRow_1, complete, true);
                    });
                });
            }
            else {
                this._adapter.write(table, pk, setRow_1, complete, true);
            }
        }
        var _a;
    };
    /**
     * Delete a specific row from the database.
     *
     * @param {string} table
     * @param {DBKey} pk
     * @param {(row: DBRow) => void} complete
     * @memberof _NanoSQLStorage
     */
    _NanoSQLStorage.prototype._delete = function (table, pk, complete) {
        var _this = this;
        if (!pk) {
            throw new Error("Can't delete without a primary key!");
        }
        else {
            // update secondary indexes
            this._adapter.read(table, pk, function (row) {
                _this._clearSecondaryIndexes(table, pk, row, [], function () {
                    // do the delete
                    _this._adapter.delete(table, pk, function () {
                        complete(row);
                    });
                });
            });
        }
    };
    /**
     * Drop entire table from the database.
     *
     * @param {string} table
     * @param {() => void} complete
     * @memberof _NanoSQLStorage
     */
    _NanoSQLStorage.prototype._drop = function (table, complete) {
        var _this = this;
        utilities_1.fastALL(this.tableInfo[table]._secondaryIndexes, function (idx, i, done) {
            _this._adapter.drop("_" + table + "_idx_" + idx, done);
        }).then(function () {
            _this._trieIndexes[table] = {};
            _this.tableInfo[table]._trieColumns.forEach(function (co) {
                _this._trieIndexes[table][co] = new prefix_trie_ts_1.Trie([]);
            });
            _this._adapter.drop(table, complete);
        });
    };
    /**
     * Find secondary indexes and automatically generate an index table for each.
     *
     * @internal
     * @param {StdObject<DataModel[]>} dataModels
     * @returns
     * @memberof NanoSQLStorage
     */
    _NanoSQLStorage.prototype._createSecondaryIndexTables = function (dataModels) {
        Object.keys(dataModels).forEach(function (table) {
            var hasPK = false;
            var hasIDX = false;
            dataModels[table].forEach(function (model) {
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
    };
    /**
     * Generate the data needed to manage each table in the database
     *
     * @internal
     * @param {string} tableName
     * @param {DataModel[]} dataModels
     * @returns {string}
     * @memberof NanoSQLStorage
     */
    _NanoSQLStorage.prototype._newTable = function (tableName, dataModels) {
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
        var i = this.models[tableName].length;
        while (i--) {
            var p = this.models[tableName][i];
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
                this._trieIndexes[tableName][p.key] = new prefix_trie_ts_1.Trie([]);
            }
        }
        return tableName;
    };
    return _NanoSQLStorage;
}());
exports._NanoSQLStorage = _NanoSQLStorage;
