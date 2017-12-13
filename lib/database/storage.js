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
var adapter_levelDB_1 = require("./adapter-levelDB");
var _NanoSQLStorage = (function () {
    function _NanoSQLStorage(parent, args) {
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
            var detect = this._detectStorageMethod();
            var modes = {
                IDB: "Indexed DB",
                IDB_WW: "Indexed DB (Web Worker)",
                WSQL: "WebSQL",
                LS: "Local Storage",
                TEMP: "memory"
            };
            this._mode = this._mode === "PERM" ? detect : this._mode;
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
                case "LVL":
                    this._adapter = new adapter_levelDB_1._LevelStore(args.dbPath, args.writeCache, args.readCache);
                    break;
                case "TEMP":
                    this._adapter = new adapter_sync_1._SyncStore(false);
                    break;
            }
        }
        else {
            this._adapter = this._mode;
        }
    }
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
            new utilities_1.ALL(Object.keys(_this._trieIndexes).map(function (table) {
                return function (tableDone) {
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
                };
            })).then(function () {
                complete(_this.models);
            });
        });
    };
    _NanoSQLStorage.prototype.rebuildIndexes = function (table, complete) {
        var _this = this;
        var start = new Date().getTime();
        new utilities_1.ALL(Object.keys(this.tableInfo).map(function (ta) {
            return function (tableDone) {
                if ((table !== "_ALL_" && table !== ta) || ta.indexOf("_") === 0) {
                    tableDone();
                    return;
                }
                var secondIndexes = _this.tableInfo[ta]._secondaryIndexes;
                new utilities_1.ALL(secondIndexes.map(function (column) {
                    return function (idxDone) {
                        var idxTable = "_" + ta + "_idx_" + column;
                        var pk = _this.tableInfo[ta]._pk;
                        _this._drop(idxTable, function () {
                            _this._read(ta, function (row, idx, done) {
                                _this._setSecondaryIndexes(ta, row[pk], row, [], function () {
                                    done(false);
                                });
                            }, idxDone);
                        });
                    };
                })).then(tableDone);
            };
        })).then(function () {
            complete(new Date().getTime() - start);
        });
    };
    _NanoSQLStorage.prototype._secondaryIndexKey = function (value) {
        if (utilities_1.isObject(value) || Array.isArray(value)) {
            return JSON.stringify(value).substr(0, 12);
        }
        if (typeof value === "number") {
            return value;
        }
        return String(value).substr(0, 32);
    };
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
            return "LS";
        }
    };
    _NanoSQLStorage.prototype._secondaryIndexRead = function (table, column, search, callback) {
        var _this = this;
        this._adapter.read("_" + table + "_idx_" + column, this._secondaryIndexKey(search), function (row) {
            if (row !== undefined) {
                _this._read(table, (row["rows"] || []), callback);
            }
            else {
                callback([]);
            }
        });
    };
    _NanoSQLStorage.prototype._rangeReadIDX = function (table, fromIdx, toIdx, complete) {
        var rows = [];
        this._adapter.rangeRead(table, function (row, idx, next) {
            rows.push(row);
            next();
        }, function () {
            complete(rows);
        }, fromIdx, toIdx);
    };
    _NanoSQLStorage.prototype._rangeReadPKs = function (table, fromPK, toPK, complete) {
        var rows = [];
        this._adapter.rangeRead(table, function (row, idx, next) {
            rows.push(row);
            next();
        }, function () {
            complete(rows);
        }, fromPK, toPK, true);
    };
    _NanoSQLStorage.prototype._read = function (table, query, callback) {
        var _this = this;
        if (Array.isArray(query)) {
            new utilities_1.ALL(query.map(function (q) {
                return function (result) {
                    _this._adapter.read(table, q, result);
                };
            })).then(function (rows) {
                callback(rows.filter(function (r) { return r; }));
            });
            return;
        }
        var rows = [];
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
    _NanoSQLStorage.prototype._trieRead = function (table, column, search, callback) {
        var _this = this;
        var words = this._trieIndexes[table][column].getPrefix(search);
        new utilities_1.ALL(words.map(function (w) {
            return function (result) {
                _this._secondaryIndexRead(table, column, w, result);
            };
        })).then(function (arrayOfRows) {
            callback([].concat.apply([], arrayOfRows));
        });
    };
    _NanoSQLStorage.prototype._clearSecondaryIndexes = function (table, pk, rowData, skipColumns, complete) {
        var _this = this;
        new utilities_1.ALL(this.tableInfo[table]._secondaryIndexes.filter(function (idx) { return skipColumns.indexOf(idx) === -1; }).map(function (idx) {
            return function (done) {
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
            };
        })).then(complete);
    };
    _NanoSQLStorage.prototype._setSecondaryIndexes = function (table, pk, rowData, skipColumns, complete) {
        var _this = this;
        new utilities_1.ALL(this.tableInfo[table]._secondaryIndexes.filter(function (idx) { return skipColumns.indexOf(idx) === -1; }).map(function (idx) {
            return function (done) {
                var column = _this._secondaryIndexKey(rowData[idx]);
                if (_this._trieIndexes[table][idx]) {
                    _this._trieIndexes[table][idx].addWord(String(rowData[idx]));
                }
                var idxTable = "_" + table + "_idx_" + idx;
                _this._adapter.read(idxTable, column, function (row) {
                    var indexRow = row ? Object.isFrozen(row) ? utilities_1._assign(row) : row : { id: column, rows: [] };
                    indexRow.rows.push(pk);
                    indexRow.rows.sort();
                    indexRow.rows = utilities_1.removeDuplicates(indexRow.rows);
                    _this._adapter.write(idxTable, column, indexRow, done, true);
                });
            };
        })).then(complete);
    };
    _NanoSQLStorage.prototype._write = function (table, pk, oldRow, newRow, complete) {
        var _this = this;
        if (!oldRow) {
            this._adapter.write(table, pk, newRow, function (row) {
                _this._setSecondaryIndexes(table, row[_this.tableInfo[table]._pk], newRow, [], function () {
                    complete(row);
                });
            }, true);
        }
        else {
            var setRow_1 = __assign({}, oldRow, newRow, (_a = {}, _a[this.tableInfo[table]._pk] = pk, _a));
            var sameKeys_1 = Object.keys(setRow_1).filter(function (key) {
                return setRow_1[key] === oldRow[key];
            });
            this._clearSecondaryIndexes(table, pk, oldRow, sameKeys_1, function () {
                _this._setSecondaryIndexes(table, pk, setRow_1, sameKeys_1, function () {
                    _this._adapter.write(table, pk, setRow_1, complete, true);
                });
            });
        }
        var _a;
    };
    _NanoSQLStorage.prototype._delete = function (table, pk, complete) {
        var _this = this;
        if (!pk) {
            throw new Error("Can't delete without a primary key!");
        }
        else {
            this._adapter.read(table, pk, function (row) {
                _this._clearSecondaryIndexes(table, pk, row, [], function () {
                    _this._adapter.delete(table, pk, function () {
                        complete(row);
                    });
                });
            });
        }
    };
    _NanoSQLStorage.prototype._drop = function (table, complete) {
        var _this = this;
        new utilities_1.ALL(this.tableInfo[table]._secondaryIndexes.map(function (idx) {
            return function (done) {
                _this._adapter.drop("_" + table + "_idx_" + idx, done);
            };
        })).then(function () {
            _this._trieIndexes[table] = {};
            _this.tableInfo[table]._trieColumns.forEach(function (co) {
                _this._trieIndexes[table][co] = new prefix_trie_ts_1.Trie([]);
            });
            _this._adapter.drop(table, complete);
        });
    };
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
        var i = this.models[tableName].length;
        while (i--) {
            var p = this.models[tableName][i];
            this.tableInfo[tableName]._keys.unshift(p.key);
            this.tableInfo[tableName]._defaults[i] = p.default;
            if (p.props && p.props.indexOf("pk") > -1) {
                this.tableInfo[tableName]._pk = p.key;
                this.tableInfo[tableName]._pkType = p.type;
            }
            if (p.props && (p.props.indexOf("idx") > -1 || p.props.indexOf("trie") > -1)) {
                this.tableInfo[tableName]._secondaryIndexes.push(p.key);
            }
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
