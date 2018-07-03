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
var lie_ts_1 = require("lie-ts");
/* NODE-START */
var adapter_levelDB_1 = require("./adapter-levelDB");
/* NODE-END */
var queue = require("queue");
var newQueryQ = function (_this) {
    return {
        qs: {},
        add: function (table, cb) {
            if (!_this.queue.qs[table]) {
                _this.queue.qs[table] = queue({ autostart: true, concurrency: 1 });
            }
            _this.queue.qs[table].push(function (done) {
                lie_ts_1.setFast(function () { return cb(done); });
            });
        }
    };
};
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
        var _this = this;
        /**
         * Array of table names
         *
         * @internal
         * @type {string[]}
         * @memberof _NanoSQLStorage
         */
        this._tableNames = [];
        this._secondaryIndexes = {};
        this._secondaryIndexUpdates = {};
        this._nsql = parent;
        this._mode = args.persistent ? "PERM" : args.mode || "TEMP";
        this._id = args.id;
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
            var prevTable = parent.sTable;
            parent.table("*").on("peer-change", function (ev) {
                _this._cache[ev.table] = {};
            });
            parent.table(prevTable);
        }
        this.adapters[0] = {
            adapter: null,
            waitForWrites: true
        };
        if (typeof this._mode === "string") {
            if (this._mode === "PERM") {
                this._mode = this._detectStorageMethod() || this._mode;
            }
            switch (this._mode) {
                case "IDB":
                case "IDB_WW":
                    this.adapters[0].adapter = new adapter_indexedDB_1._IndexedDBStore(args.idbVersion);
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
    _NanoSQLStorage.prototype._flushIndexes = function () {
        var _this = this;
        if (this._doCache && !this._isFlushing && Object.keys(this._secondaryIndexUpdates).length) {
            this._isFlushing = true;
            var indexes_1 = utilities_1._assign(this._secondaryIndexUpdates);
            this._secondaryIndexUpdates = {};
            utilities_1.fastALL(Object.keys(indexes_1), function (table, i, done) {
                var PKs = indexes_1[table];
                utilities_1.fastALL(PKs, function (pk, ii, nextRow) {
                    _this.adapterWrite(table, pk, utilities_1._assign(_this._secondaryIndexes[table].rows[pk]), nextRow, function (err) {
                    });
                }).then(done);
            }).then(function () {
                // flush indexes to database no more than every 100ms.
                setTimeout(function () {
                    _this._isFlushing = false;
                    _this._flushIndexes();
                }, 100);
            });
        }
    };
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
                // populate cached secondary indexes from persistent storage
                if (_this._doCache) {
                    utilities_1.fastALL(Object.keys(_this.tableInfo), function (table, i, next) {
                        utilities_1.fastALL(_this.tableInfo[table]._secondaryIndexes, function (column, ii, nextCol) {
                            var idxTable = "_" + table + "_idx_" + column;
                            _this.adapters[0].adapter.getIndex(idxTable, false, function (index) {
                                _this._secondaryIndexes[idxTable].idx = index;
                                _this.adapters[0].adapter.rangeRead(idxTable, function (row, i, nextRow) {
                                    _this._secondaryIndexes[idxTable].rows[row.id] = row;
                                    nextRow();
                                }, nextCol);
                            });
                        }).then(next);
                    }).then(function () {
                        complete(_this.models);
                    });
                }
                else {
                    complete(_this.models);
                }
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
        utilities_1.fastALL(Object.keys(this.tableInfo), function (ta, k, tableDone, tableErr) {
            if ((table !== "_ALL_" && table !== ta) || ta.indexOf("_") === 0) {
                tableDone();
                return;
            }
            var secondIndexes = _this.tableInfo[ta]._secondaryIndexes;
            utilities_1.fastALL(secondIndexes, function (column, j, idxDone) {
                var idxTable = "_" + ta + "_idx_" + column;
                _this._secondaryIndexes[idxTable].idx = [];
                _this._secondaryIndexes[idxTable].rows = {};
                _this._secondaryIndexUpdates[idxTable] = [];
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
                        if (_this._doCache) {
                            Object.keys(indexGroups[item]).forEach(function (rowKey, i) {
                                _this._secondaryIndexUpdates[idxTable].push(rowKey);
                                _this._secondaryIndexes[idxTable].idx.push(rowKey);
                                _this._secondaryIndexes[idxTable].rows[rowKey] = { id: rowKey, rows: indexGroups[item][rowKey] };
                            });
                            done();
                        }
                        else {
                            utilities_1.fastALL(Object.keys(indexGroups[item]), function (rowKey, i, next, err) {
                                _this.adapterWrite(idxTable, rowKey, {
                                    id: rowKey,
                                    rows: indexGroups[item][rowKey].sort()
                                }, next, err);
                            }).then(done).catch(tableErr);
                        }
                    }).then(function () {
                        tableDone();
                    }).catch(tableErr);
                });
            });
        }).then(function () {
            if (_this._doCache) {
                _this._flushIndexes();
            }
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
        var getSecondaryIndex = function (table, pks, cb) {
            if (_this._doCache) {
                cb(pks.map(function (pk) { return _this._secondaryIndexes[table].rows[pk]; }).filter(function (r) { return r; }));
            }
            else {
                if (pks.length === 1) {
                    _this.adapters[0].adapter.read(table, pks[0], function (row) {
                        cb([row]);
                    });
                }
                else {
                    _this._read(table, pks, function (rows) {
                        cb(rows);
                    });
                }
            }
        };
        var getSecondaryIndexKeys = function (table, cb) {
            if (_this._doCache) {
                cb(_this._secondaryIndexes[table].idx);
            }
            else {
                _this.adapters[0].adapter.getIndex(table, false, cb);
            }
        };
        switch (condition) {
            case "=":
                getSecondaryIndex("_" + table + "_idx_" + column, [this._secondaryIndexKey(search)], function (rows) {
                    if (rows[0] !== undefined && rows[0] !== null) {
                        _this._read(table, (rows[0]["rows"] || []), function (rows) {
                            callback(rows);
                        });
                    }
                    else {
                        callback([]);
                    }
                });
                break;
            default:
                getSecondaryIndexKeys("_" + table + "_idx_" + column, function (index) {
                    var searchVal = _this._secondaryIndexKey(search);
                    var getPKs = index.filter(function (val) {
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
                    getSecondaryIndex("_" + table + "_idx_" + column, getPKs, function (rows) {
                        var rowPKs = [].concat.apply([], rows.map(function (r) { return r.rows; }));
                        if (!rowPKs.length) {
                            callback([]);
                            return;
                        }
                        _this._read(table, rowPKs, function (rows) {
                            callback(rows);
                        });
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
    _NanoSQLStorage.prototype._clearSecondaryIndexes = function (table, pk, rowData, doColumns, complete) {
        var _this = this;
        if (this._doCache) {
            doColumns.forEach(function (idx) {
                var idxTable = "_" + table + "_idx_" + idx;
                var column = _this._secondaryIndexKey(rowData[idx]);
                if (!_this._secondaryIndexUpdates[idxTable]) {
                    _this._secondaryIndexUpdates[idxTable] = [];
                }
                if (_this._secondaryIndexUpdates[idxTable].indexOf(column) === -1) {
                    _this._secondaryIndexUpdates[idxTable].push(column);
                }
                var index = _this._secondaryIndexes[idxTable].rows[column];
                if (!index) {
                    return;
                }
                var i = index.rows.indexOf(pk);
                if (i === -1) {
                    return;
                }
                var newRow = index || { id: column, rows: [] };
                newRow.rows.splice(i, 1);
                _this._secondaryIndexes[idxTable].rows[column] = newRow;
            });
            this._flushIndexes();
            complete();
        }
        else {
            utilities_1.fastALL(doColumns, function (idx, k, done, error) {
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
                    var newRow = row ? Object.isFrozen(row) ? utilities_1._assign(row) : row : { id: column, rows: [] };
                    newRow.rows.splice(i, 1);
                    // newRow.rows = removeDuplicates(newRow.rows);
                    _this.adapterWrite(idxTable, newRow.id, newRow, done, error);
                });
            }).then(complete);
        }
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
    _NanoSQLStorage.prototype._setSecondaryIndexes = function (table, pk, rowData, doColumns, complete) {
        var _this = this;
        if (this._doCache) {
            doColumns.forEach(function (col, i) {
                var column = _this._secondaryIndexKey(rowData[col]);
                if (typeof column === "undefined") {
                    return;
                }
                if (typeof column === "string" && !column.length) {
                    return;
                }
                if (_this._trieIndexes[table][col]) {
                    _this._trieIndexes[table][col].addWord(String(rowData[col]));
                }
                var idxTable = "_" + table + "_idx_" + col;
                if (!_this._secondaryIndexUpdates[idxTable]) {
                    _this._secondaryIndexUpdates[idxTable] = [];
                }
                if (_this._secondaryIndexUpdates[idxTable].indexOf(column) === -1) {
                    _this._secondaryIndexUpdates[idxTable].push(column);
                }
                var indexRow = _this._secondaryIndexes[idxTable].rows[column];
                if (!indexRow) {
                    indexRow = { id: column, rows: [] };
                    if (_this._secondaryIndexes[idxTable].sortIdx) {
                        var pos = utilities_1.binarySearch(_this._secondaryIndexes[idxTable].idx, column);
                        _this._secondaryIndexes[idxTable].idx.splice(pos, 0, column);
                    }
                    else {
                        _this._secondaryIndexes[idxTable].idx.push(column);
                    }
                }
                indexRow.rows.push(pk);
                _this._secondaryIndexes[idxTable].rows[column] = indexRow;
            });
            this._flushIndexes();
            if (complete)
                complete();
        }
        else {
            utilities_1.fastALL(doColumns, function (col, i, done, error) {
                var column = _this._secondaryIndexKey(rowData[col]);
                if (typeof column === "undefined") {
                    done();
                    return;
                }
                if (typeof column === "string" && !column.length) {
                    done();
                    return;
                }
                if (_this._trieIndexes[table][col]) {
                    _this._trieIndexes[table][col].addWord(String(rowData[col]));
                }
                var idxTable = "_" + table + "_idx_" + col;
                _this.adapters[0].adapter.read(idxTable, column, function (row) {
                    var indexRow = row ? (Object.isFrozen(row) ? utilities_1._assign(row) : row) : { id: column, rows: [] };
                    indexRow.rows.push(pk);
                    // indexRow.rows.sort();
                    // indexRow.rows = removeDuplicates(indexRow.rows);
                    _this.adapterWrite(idxTable, column, indexRow, done, error);
                });
            }).then(function () {
                if (complete)
                    complete();
            });
        }
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
    _NanoSQLStorage.prototype._write = function (table, pk, oldRow, newRow, complete, error) {
        var _this = this;
        if (!oldRow) { // new row
            this.adapterWrite(table, pk, newRow, function (row) {
                if (_this.tableInfo[table]._secondaryIndexes.length) {
                    _this._setSecondaryIndexes(table, row[_this.tableInfo[table]._pk], newRow, _this.tableInfo[table]._secondaryIndexes, function () {
                        complete(row);
                    });
                }
                else {
                    complete(row);
                }
            }, error);
        }
        else { // existing row
            var setRow_1 = __assign({}, oldRow, newRow, (_a = {}, _a[this.tableInfo[table]._pk] = pk, _a));
            var doColumns_1 = this.tableInfo[table]._secondaryIndexes.filter(function (col) { return Object.keys(setRow_1).filter(function (key) {
                return setRow_1[key] === oldRow[key];
            }).indexOf(col) === -1; });
            if (this.tableInfo[table]._secondaryIndexes.length) {
                utilities_1.fastALL([0, 1, 2], function (idx, i, next, err) {
                    switch (idx) {
                        case 0:
                            _this._clearSecondaryIndexes(table, pk, oldRow, doColumns_1, next);
                            break;
                        case 1:
                            _this._setSecondaryIndexes(table, pk, setRow_1, doColumns_1, next);
                            break;
                        case 2:
                            _this.adapterWrite(table, pk, setRow_1, next, err);
                            break;
                    }
                }).then(function (results) {
                    complete(results[2]);
                }).catch(error);
            }
            else {
                this.adapterWrite(table, pk, setRow_1, function (row) {
                    complete(row);
                }, error);
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
                utilities_1.fastALL([0, 1], function (job, ii, next) {
                    switch (job) {
                        case 0:
                            _this._clearSecondaryIndexes(table, pk, row, _this.tableInfo[table]._secondaryIndexes, next);
                            break;
                        case 1:
                            _this.adapterDelete(table, pk, next);
                            break;
                    }
                }).then(function () {
                    complete(row);
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
        var secondaryIdxs = this.tableInfo[table]._secondaryIndexes.map(function (t) { return "_" + table + "_idx_" + t; });
        tablesToDrop = tablesToDrop.concat(secondaryIdxs);
        if (this._doCache) {
            secondaryIdxs.forEach(function (idxTable) {
                _this._secondaryIndexes[idxTable].idx = [];
                _this._secondaryIndexes[idxTable].rows = {};
            });
        }
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
                            { key: "id", type: isNumber ? model.type : "string", props: ["pk()"] },
                            { key: "rows", type: "any[]" }
                        ];
                    }
                    model.props.forEach(function (prop) {
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
                    this_1._secondaryIndexes["_" + tableName + "_idx_" + p.key] = { idx: [], rows: [], sortIdx: ["number", "int", "float"].indexOf(p.type) !== -1 };
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
    _NanoSQLStorage.prototype.adapterRead = function (table, pk, complete, queue) {
        this.adapters[0].adapter.read(table, pk, function (row) {
            complete(row);
        });
    };
    _NanoSQLStorage.prototype.adapterWrite = function (table, pk, data, complete, error) {
        var result;
        utilities_1.fastCHAIN(this.adapters, function (a, i, done, writeErr) {
            if (a.waitForWrites) {
                a.adapter.write(table, pk, data, function (row) {
                    result = row;
                    done();
                }, writeErr);
            }
            else {
                done();
                a.adapter.write(table, pk, data, function (row) { }, writeErr);
            }
        }).then(function () {
            complete(result);
        }).catch(error);
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
//# sourceMappingURL=storage.js.map