var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("../utilities");
exports.err = new Error("Memory index doesn't support this action!");
var nanoSQLMemoryIndex = /** @class */ (function () {
    function nanoSQLMemoryIndex(assign, useCache) {
        this.assign = assign;
        this.useCache = useCache;
        this.indexes = {};
        this.indexLoaded = {};
        this.useCacheIndexes = {};
    }
    nanoSQLMemoryIndex.prototype.connect = function (id, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.disconnect = function (complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.createTable = function (tableName, tableData, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.dropTable = function (table, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.write = function (table, pk, row, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.read = function (table, pk, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.delete = function (table, pk, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.getTableIndex = function (table, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.getTableIndexLength = function (table, complete, error) {
        error(exports.err);
    };
    nanoSQLMemoryIndex.prototype.createIndex = function (tableId, index, type, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        this.createTable(indexName, __assign({}, utilities_1.blankTableDefinition, { pkType: type, pkCol: ["id"], isPkNum: ["float", "int", "number"].indexOf(type) !== -1 }), function () {
            if (_this.indexes[indexName]) {
                complete();
                return;
            }
            _this.indexes[indexName] = {};
            _this.indexLoaded[indexName] = false;
            _this.useCacheIndexes[indexName] = _this.useCache || false;
            complete();
            _this.nSQL.doFilter("loadIndexCache", { result: { load: _this.useCache || false }, index: indexName }, function (result) {
                _this.useCacheIndexes[indexName] = result.load;
                if (result.load) {
                    _this.readMulti(indexName, "all", undefined, undefined, false, function (row) {
                        if (!_this.indexes[indexName][row.id]) {
                            _this.indexes[indexName][row.id] = row.pks || [];
                        }
                    }, function () {
                        _this.indexLoaded[indexName] = true;
                    }, error);
                }
            }, error);
        }, error);
    };
    nanoSQLMemoryIndex.prototype.deleteIndex = function (tableId, index, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        delete this.indexes[indexName];
        delete this.indexLoaded[indexName];
        delete this.useCacheIndexes[indexName];
        this.dropTable(indexName, complete, error);
    };
    nanoSQLMemoryIndex.prototype.addIndexValue = function (tableId, index, key, value, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        if (!this.indexLoaded[indexName]) {
            this.read(indexName, value, function (row) {
                var pks = row ? row.pks : [];
                pks = _this.assign ? utilities_1.assign(pks) : pks;
                if (pks.length === 0) {
                    pks.push(key);
                }
                else {
                    var idx = utilities_1.binarySearch(pks, key, false);
                    pks.splice(idx, 0, key);
                }
                if (_this.useCacheIndexes[indexName]) {
                    _this.indexes[indexName][value] = pks;
                }
                _this.write(indexName, value, {
                    id: key,
                    pks: _this.assign ? utilities_1.assign(pks) : pks
                }, complete, error);
            }, error);
            return;
        }
        if (!this.indexes[indexName][value]) {
            this.indexes[indexName][value] = [];
            this.indexes[indexName][value].push(key);
        }
        else {
            var idx = utilities_1.binarySearch(this.indexes[indexName][value], key, false);
            this.indexes[indexName][value].splice(idx, 0, key);
        }
        this.write(indexName, value, {
            id: key,
            pks: this.assign ? utilities_1.assign(this.indexes[indexName][value]) : this.indexes[indexName][value]
        }, complete, error);
    };
    nanoSQLMemoryIndex.prototype.deleteIndexValue = function (tableId, index, key, value, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        if (!this.indexLoaded[indexName]) {
            this.read(indexName, value, function (row) {
                var pks = row ? row.pks : [];
                pks = _this.assign ? utilities_1.assign(pks) : pks;
                if (pks.length === 0) {
                    complete();
                    return;
                }
                else {
                    var idx = pks.length < 100 ? pks.indexOf(key) : utilities_1.binarySearch(pks, key, true);
                    if (idx === -1) {
                        complete();
                        return;
                    }
                    else {
                        pks.splice(idx, 1);
                    }
                }
                if (_this.useCacheIndexes[indexName]) {
                    _this.indexes[indexName][value] = pks;
                }
                _this.write(indexName, value, {
                    id: key,
                    pks: _this.assign ? utilities_1.assign(pks) : pks
                }, complete, error);
            }, error);
            return;
        }
        if (!this.indexes[indexName][value]) {
            complete();
        }
        else {
            var idx = this.indexes[indexName][value].length < 100 ? this.indexes[indexName][value].indexOf(key) : utilities_1.binarySearch(this.indexes[indexName][value], key, true);
            if (idx === -1) {
                complete();
            }
            else {
                this.indexes[indexName][value].splice(idx, 1);
                this.write(indexName, value, {
                    id: value,
                    pks: this.assign ? utilities_1.assign(this.indexes[indexName][value]) : this.indexes[indexName][value]
                }, complete, error);
            }
        }
    };
    nanoSQLMemoryIndex.prototype.readIndexKey = function (tableId, index, pk, onRowPK, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.read(indexName, pk, function (row) {
            if (!row) {
                complete();
                return;
            }
            row.pks.forEach(onRowPK);
            complete();
        }, error);
    };
    nanoSQLMemoryIndex.prototype.readIndexKeys = function (tableId, index, type, offsetOrLow, limitOrHigh, reverse, onRowPK, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.readMulti(indexName, type, offsetOrLow, limitOrHigh, reverse, function (index) {
            if (!index)
                return;
            index.pks.forEach(function (pk) {
                onRowPK(pk, index.id);
            });
        }, complete, error);
    };
    return nanoSQLMemoryIndex;
}());
exports.nanoSQLMemoryIndex = nanoSQLMemoryIndex;
//# sourceMappingURL=memoryIndex.js.map