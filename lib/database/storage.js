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
        this._size = args.size || 5;
        this.adapters = [];
        this.models = {};
        this.tableInfo = {};
        this._trieIndexes = {};
        this._tableNames = [];
        this._doCache = typeof args.cache !== "undefined" ? args.cache : true;
        this._cache = {};
        this.adapters[0] = {
            adapter: null,
            waitForWrites: true
        };
        if (typeof this._mode === "string") {
            if (this._mode === "PERM") {
                /*const modes = {
                    IDB: "Indexed DB",
                    IDB_WW: "Indexed DB (Web Worker)",
                    WSQL: "WebSQL",
                    LS: "Local Storage",
                    TEMP: "memory"
                };*/
                this._mode = this._detectStorageMethod() || this._mode;
            }
            switch (this._mode) {
                case "IDB":
                case "IDB_WW":
                    this.adapters[0].adapter = new adapter_indexedDB_1._IndexedDBStore();
                    break;
                case "WSQL":
                    this.adapters[0].adapter = new adapter_websql_1._WebSQLStore(this._size);
                    break;
                case "LS":
                    this.adapters[0].adapter = new adapter_sync_1._SyncStore(true);
                    break;
                /* NODE-START */
                case "LVL":
                    this.adapters[0].adapter = new adapter_levelDB_1._LevelStore(args.dbPath, args.writeCache, args.readCache);
                    break;
                /* NODE-END */
                case "TEMP":
                    this.adapters[0].adapter = new adapter_sync_1._SyncStore(false);
                    break;
            }
        }
        else {
            this.adapters[0].adapter = this._mode;
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
        this.models = this._createIndexTables(dataModels);
        this._tableNames = Object.keys(this.models);
        this.adapters.forEach(function (a) {
            a.adapter.setID(_this._id);
        });
        this._tableNames.forEach(function (table) {
            _this._newTable(table, dataModels[table]);
        });
        this._relFromTable = {};
        this._relToTable = {};
        this._relationColumns = {};
        this._columnsAreTables = {};
        this._tableNames.forEach(function (table) {
            // finish views data
            // gets a list of tables that need to be checked on each row update of this table
            _this.tableInfo[table]._viewTables = Object.keys(_this.tableInfo).reduce(function (prev, cur) {
                if (cur === table)
                    return prev;
                var vTables = Object.keys(_this.tableInfo[cur]._views);
                if (vTables.indexOf(table) !== -1) {
                    prev.push({ table: cur, column: _this.tableInfo[cur]._views[table].pkColumn });
                }
                return prev;
            }, []);
            // finish ORM and other stuff
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
                            // old format ref=>column or ref=>column[]
                            if (p.indexOf("ref=>") !== -1) {
                                mapTo_1 = p.replace("ref=>", "");
                            }
                            // new format orm(column) or orm(column[])
                            if (p.indexOf("orm(") === 0) {
                                mapTo_1 = p.replace(/orm\((.*)\)/gmi, "$1");
                            }
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
        utilities_1.fastALL(this.adapters, function (a, i, done) {
            a.adapter.connect(function () {
                if (a.adapter.setNSQL) {
                    a.adapter.setNSQL(_this._nsql);
                }
                done();
            });
        }).then(function () {
            // populate trie data
            utilities_1.fastALL(Object.keys(_this._trieIndexes), function (table, i, tableDone) {
                var trieColumns = _this._trieIndexes[table];
                if (Object.keys(trieColumns).length) {
                    utilities_1.fastALL(Object.keys(trieColumns), function (column, ii, nextColumn) {
                        var idxTable = "_" + table + "_idx_" + column;
                        _this.adapters[0].adapter.getIndex(idxTable, false, function (index) {
                            index.forEach(function (value) {
                                _this._trieIndexes[table][column].addWord(String(value));
                            });
                            nextColumn();
                        });
                    }).then(tableDone);
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
                var indexGroups = {};
                secondIndexes.forEach(function (column) {
                    indexGroups[column] = {};
                });
                _this._read(ta, function (row, idx, done) {
                    if (!row[pk]) {
                        done(false);
                        return;
                    }
                    secondIndexes.forEach(function (column) {
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
                }, function () {
                    utilities_1.fastALL(secondIndexes, function (item, i, done) {
                        var idxTable = "_" + ta + "_idx_" + item;
                        utilities_1.fastALL(Object.keys(indexGroups[item]), function (rowKey, i, next) {
                            _this.adapterWrite(idxTable, rowKey, {
                                id: rowKey,
                                rows: indexGroups[item][rowKey].sort()
                            }, next);
                        }).then(done);
                    }).then(function () {
                        tableDone();
                    });
                });
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
        // NodeJS
        if (typeof window === "undefined") {
            return "LVL";
        }
        // Browser
        // Safari / iOS always gets WebSQL (mobile and desktop)
        if (utilities_1.isSafari) {
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
    };
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
    _NanoSQLStorage.prototype._secondaryIndexRead = function (table, condition, column, search, callback) {
        var _this = this;
        switch (condition) {
            case "=":
                this.adapters[0].adapter.read("_" + table + "_idx_" + column, this._secondaryIndexKey(search), function (row) {
                    if (row !== undefined && row !== null) {
                        _this._read(table, (row["rows"] || []), callback);
                    }
                    else {
                        callback([]);
                    }
                });
                break;
            default:
                this.adapters[0].adapter.getIndex("_" + table + "_idx_" + column, false, function (index) {
                    var searchVal = _this._secondaryIndexKey(search);
                    var getPKs = index.filter(function (val) {
                        switch (condition) {
                            case ">": return searchVal > val;
                            case ">=": return searchVal >= val;
                            case "<": return searchVal < val;
                            case "<=": return searchVal <= val;
                        }
                        return false;
                    });
                    if (!getPKs.length) {
                        callback([]);
                        return;
                    }
                    _this._read("_" + table + "_idx_" + column, getPKs, function (rows) {
                        var rowPKs = [].concat.apply([], rows.map(function (r) { return r.rows; }));
                        if (!rowPKs.length) {
                            callback([]);
                            return;
                        }
                        _this._read(table, rowPKs, callback);
                    });
                });
        }
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
        this.adapters[0].adapter.rangeRead(table, function (row, idx, next) {
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
        if (Array.isArray(query)) { // select by array of primary keys
            var batchRead = this.adapters[0].adapter.batchRead;
            if (batchRead) {
                batchRead.apply(this.adapters[0].adapter, [table, query, callback]);
            }
            else {
                // possibly (but not always) slower fallback
                utilities_1.fastALL(query, function (q, i, result) {
                    _this.adapters[0].adapter.read(table, q, result);
                }).then(function (rows) {
                    callback(rows.filter(function (r) { return r; }));
                });
            }
            return;
        }
        var rows = [];
        // full table scan
        if (typeof query === "function") { // iterate through entire db, returning rows that return true on the function
            this.adapters[0].adapter.rangeRead(table, function (row, idx, nextRow) {
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
            _this._secondaryIndexRead(table, "=", column, w, result);
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
            _this.adapters[0].adapter.read(idxTable, column, function (row) {
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
                _this.adapterWrite(idxTable, newRow.id, newRow, done);
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
            if (!column) {
                done();
                return;
            }
            if (_this._trieIndexes[table][idx]) {
                _this._trieIndexes[table][idx].addWord(String(rowData[idx]));
            }
            var idxTable = "_" + table + "_idx_" + idx;
            _this.adapters[0].adapter.read(idxTable, column, function (row) {
                var indexRow = row ? (Object.isFrozen(row) ? utilities_1._assign(row) : row) : { id: column, rows: [] };
                indexRow.rows.push(pk);
                indexRow.rows.sort();
                indexRow.rows = utilities_1.removeDuplicates(indexRow.rows);
                _this.adapterWrite(idxTable, column, indexRow, done);
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
        if (!oldRow) { // new row
            this.adapterWrite(table, pk, newRow, function (row) {
                if (_this.tableInfo[table]._secondaryIndexes.length) {
                    _this._setSecondaryIndexes(table, row[_this.tableInfo[table]._pk], newRow, [], function () {
                        complete(row);
                    });
                }
                else {
                    complete(row);
                }
            });
        }
        else { // existing row
            var setRow_1 = __assign({}, oldRow, newRow, (_a = {}, _a[this.tableInfo[table]._pk] = pk, _a));
            var sameKeys_1 = Object.keys(setRow_1).filter(function (key) {
                return setRow_1[key] === oldRow[key];
            });
            if (this.tableInfo[table]._secondaryIndexes.length) {
                this._clearSecondaryIndexes(table, pk, oldRow, sameKeys_1, function () {
                    _this._setSecondaryIndexes(table, pk, setRow_1, sameKeys_1, function () {
                        _this.adapterWrite(table, pk, setRow_1, complete);
                    });
                });
            }
            else {
                this.adapterWrite(table, pk, setRow_1, complete);
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
            throw new Error("nSQL: Can't delete without a primary key!");
        }
        else {
            // update secondary indexes
            this.adapters[0].adapter.read(table, pk, function (row) {
                _this._clearSecondaryIndexes(table, pk, row, [], function () {
                    // do the delete
                    _this.adapterDelete(table, pk, function () {
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
        // drop token and hash search cache
        var tablesToDrop = Object.keys(this.tableInfo[table]._searchColumns).map(function (t) { return "_" + table + "_search_tokens_" + t; });
        tablesToDrop = tablesToDrop.concat(Object.keys(this.tableInfo[table]._searchColumns).map(function (t) { return "_" + table + "_search_" + t; }));
        tablesToDrop = tablesToDrop.concat(Object.keys(this.tableInfo[table]._searchColumns).map(function (t) { return "_" + table + "_search_fuzzy_" + t; }));
        // drop secondary indexes
        tablesToDrop = tablesToDrop.concat(this.tableInfo[table]._secondaryIndexes.map(function (t) { return "_" + table + "_idx_" + t; }));
        utilities_1.fastALL(tablesToDrop, function (table, i, done) {
            _this.adapterDrop(table, done);
        }).then(function () {
            _this._trieIndexes[table] = {};
            _this.tableInfo[table]._trieColumns.forEach(function (co) {
                _this._trieIndexes[table][co] = new prefix_trie_ts_1.Trie([]);
            });
            _this.adapterDrop(table, complete);
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
    _NanoSQLStorage.prototype._createIndexTables = function (dataModels) {
        Object.keys(dataModels).forEach(function (table) {
            var hasIDX = false;
            var hasSearch = false;
            var pkType = "";
            dataModels[table].forEach(function (model) {
                if (model.props && model.props.length) {
                    if (utilities_1.intersect(["pk", "pk()"], model.props)) {
                        pkType = model.key;
                    }
                    if (utilities_1.intersect(["trie", "idx", "idx()", "trie()"], model.props)) {
                        hasIDX = true;
                        var isNumber = ["number", "float", "int"].indexOf(model.type) !== -1;
                        dataModels["_" + table + "_idx_" + model.key] = [
                            { key: "id", type: isNumber ? model.type : "string", props: ["pk"] },
                            { key: "rows", type: "any[]" }
                        ];
                    }
                    model.props.forEach(function (prop) {
                        if (prop.indexOf("search(") !== -1) {
                            hasSearch = true;
                            dataModels["_" + table + "_search_" + model.key] = [
                                { key: "wrd", type: "string", props: ["pk", "ns()"] },
                                { key: "rows", type: "any[]" }
                            ];
                            dataModels["_" + table + "_search_fuzzy_" + model.key] = [
                                { key: "wrd", type: "string", props: ["pk", "ns()"] },
                                { key: "rows", type: "any[]" }
                            ];
                            dataModels["_" + table + "_search_tokens_" + model.key] = [
                                { key: "id", type: pkType, props: ["pk", "ns()"] },
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
        var _this = this;
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
        this.adapters.forEach(function (a) {
            a.adapter.makeTable(tableName, dataModels);
        });
        // Discover primary keys for each table
        var i = this.models[tableName].length;
        var _loop_2 = function () {
            var p = this_1.models[tableName][i];
            this_1.tableInfo[tableName]._keys.unshift(p.key);
            if (p.default !== undefined) {
                this_1.tableInfo[tableName]._defaults[p.key] = p.default;
                this_1.tableInfo[tableName]._hasDefaults = true;
            }
            if (p.props && p.props.length) {
                var is2ndIndex_1 = false;
                p.props.forEach(function (prop) {
                    if (prop.indexOf("from=>") !== -1) {
                        _this._hasViews = true;
                        var table = p.type;
                        if (prop !== "from=>GHOST" && prop !== "from=>LIVE") {
                            // prop is "from=>table.column"
                            table = prop.replace("from=>", "").split(".").shift();
                        }
                        if (!_this.tableInfo[tableName]._views[table]) {
                            _this.tableInfo[tableName]._views[table] = {
                                pkColumn: "",
                                mode: "",
                                columns: []
                            };
                        }
                        if (prop === "from=>GHOST" || prop === "from=>LIVE") {
                            is2ndIndex_1 = true;
                            _this.tableInfo[tableName]._views[table].pkColumn = p.key;
                            _this.tableInfo[tableName]._views[table].mode = prop.replace("from=>", "");
                        }
                        else {
                            _this.tableInfo[tableName]._views[table].columns.push({
                                thisColumn: p.key,
                                otherColumn: prop.replace("from=>", "").split(".").pop()
                            });
                        }
                    }
                    if (prop.indexOf("search(") === 0) {
                        _this.tableInfo[tableName]._searchColumns[p.key] = prop.replace(/search\((.*)\)/gmi, "$1").split(",").map(function (c) { return c.trim(); });
                    }
                });
                // Check for primary key
                if (utilities_1.intersect(["pk", "pk()"], p.props)) {
                    this_1.tableInfo[tableName]._pk = p.key;
                    this_1.tableInfo[tableName]._pkType = p.type;
                }
                // Check for secondary indexes
                if (utilities_1.intersect(["trie", "idx", "idx()", "trie()"], p.props) || is2ndIndex_1) {
                    this_1.tableInfo[tableName]._secondaryIndexes.push(p.key);
                }
                // Check for trie indexes
                if (utilities_1.intersect(["trie", "trie()"], p.props)) {
                    this_1.tableInfo[tableName]._trieColumns.push(p.key);
                    this_1._trieIndexes[tableName][p.key] = new prefix_trie_ts_1.Trie([]);
                }
            }
        };
        var this_1 = this;
        while (i--) {
            _loop_2();
        }
        return tableName;
    };
    _NanoSQLStorage.prototype.adapterWrite = function (table, pk, data, complete, error) {
        var result;
        utilities_1.fastALL(this.adapters, function (a, i, done) {
            if (a.waitForWrites) {
                a.adapter.write(table, pk, data, function (row) {
                    result = row;
                    done();
                });
            }
            else {
                done();
                a.adapter.write(table, pk, data, function (row) { });
            }
        }).then(function () {
            complete(result);
        }).catch(function (err) {
            if (error)
                error(err);
        });
    };
    _NanoSQLStorage.prototype.adapterDelete = function (table, pk, complete, error) {
        utilities_1.fastALL(this.adapters, function (a, i, done) {
            if (a.waitForWrites) {
                a.adapter.delete(table, pk, function () {
                    done();
                });
            }
            else {
                done();
                a.adapter.delete(table, pk, function () { });
            }
        }).then(function () {
            complete();
        }).catch(function (err) {
            if (error)
                error(err);
        });
    };
    _NanoSQLStorage.prototype.adapterDrop = function (table, complete, error) {
        utilities_1.fastALL(this.adapters, function (a, i, done) {
            if (a.waitForWrites) {
                a.adapter.drop(table, function () {
                    done();
                });
            }
            else {
                done();
                a.adapter.drop(table, function () { });
            }
        }).then(function () {
            complete();
        }).catch(function (err) {
            if (error)
                error(err);
        });
    };
    return _NanoSQLStorage;
}());
exports._NanoSQLStorage = _NanoSQLStorage;
