var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("../utilities");
exports.err = new Error("Memory index doesn't support this action!");
var nanoSQLMemoryIndex = /** @class */ (function () {
    function nanoSQLMemoryIndex(assign, useCache) {
        this.assign = assign;
        this.useCache = useCache;
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
        var indexName = "_idx_" + tableId + "_" + index;
        this.createTable(indexName, __assign({}, utilities_1.blankTableDefinition, { pkType: type, pkCol: ["id"], isPkNum: ["float", "int", "number"].indexOf(type) !== -1 }), function () {
            complete();
        }, error);
    };
    nanoSQLMemoryIndex.prototype.deleteIndex = function (tableId, index, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.dropTable(indexName, complete, error);
    };
    nanoSQLMemoryIndex.prototype.addIndexValue = function (tableId, index, key, value, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
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
            _this.write(indexName, value, {
                id: key,
                pks: _this.assign ? utilities_1.assign(pks) : pks
            }, complete, error);
        }, error);
    };
    nanoSQLMemoryIndex.prototype.deleteIndexValue = function (tableId, index, key, value, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        this.read(indexName, value, function (row) {
            var pks = row ? row.pks : [];
            pks = _this.assign ? utilities_1.assign(pks) : pks;
            if (pks.length === 0) {
                complete();
                return;
            }
            else {
                var idx = pks.length < 100 ? pks.indexOf(key) : utilities_1.binarySearch(pks, key, true);
                if (idx !== -1) {
                    pks.splice(idx, 1);
                }
            }
            if (pks.length) {
                _this.write(indexName, value, {
                    id: key,
                    pks: _this.assign ? utilities_1.assign(pks) : pks
                }, complete, error);
            }
            else {
                _this.delete(indexName, value, complete, error);
            }
        }, error);
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