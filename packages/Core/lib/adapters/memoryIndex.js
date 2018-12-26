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
var NanoSQLMemoryIndex = /** @class */ (function () {
    function NanoSQLMemoryIndex(assign) {
        this.assign = assign;
        this.indexes = {};
    }
    NanoSQLMemoryIndex.prototype.connect = function (id, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.disconnect = function (complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.createTable = function (tableName, tableData, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.dropTable = function (table, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.disconnectTable = function (table, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.write = function (table, pk, row, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.read = function (table, pk, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.delete = function (table, pk, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.getTableIndex = function (table, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.getTableIndexLength = function (table, complete, error) {
        error(exports.err);
    };
    NanoSQLMemoryIndex.prototype.createIndex = function (indexName, type, complete, error) {
        var _this = this;
        this.createTable(indexName, __assign({}, utilities_1.blankTableDefinition, { pkType: type, pkCol: "id", isPkNum: ["float", "int", "number"].indexOf(type) !== -1 }), function () {
            _this.indexes[indexName] = {};
            _this.readMulti(indexName, "all", undefined, undefined, false, function (row) {
                _this.indexes[indexName][row.id] = row.pks || [];
            }, complete, error);
        }, error);
    };
    NanoSQLMemoryIndex.prototype.deleteIndex = function (indexName, complete, error) {
        delete this.indexes[indexName];
        this.dropTable(indexName, complete, error);
    };
    NanoSQLMemoryIndex.prototype.addIndexValue = function (indexName, key, value, complete, error) {
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
            pks: this.assign ? utilities_1._assign(this.indexes[indexName][value]) : this.indexes[indexName][value]
        }, complete, error);
    };
    NanoSQLMemoryIndex.prototype.deleteIndexValue = function (indexName, key, value, complete, error) {
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
                    pks: this.assign ? utilities_1._assign(this.indexes[indexName][value]) : this.indexes[indexName][value]
                }, complete, error);
            }
        }
    };
    NanoSQLMemoryIndex.prototype.readIndexKey = function (table, pk, onRowPK, complete, error) {
        this.read(table, pk, function (row) {
            if (!row) {
                complete();
                return;
            }
            row.pks.forEach(onRowPK);
            complete();
        }, error);
    };
    NanoSQLMemoryIndex.prototype.readIndexKeys = function (table, type, offsetOrLow, limitOrHigh, reverse, onRowPK, complete, error) {
        this.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, function (index) {
            if (!index)
                return;
            index.pks.forEach(function (pk) {
                onRowPK(pk, index.id);
            });
        }, complete, error);
    };
    return NanoSQLMemoryIndex;
}());
exports.NanoSQLMemoryIndex = NanoSQLMemoryIndex;
//# sourceMappingURL=memoryIndex.js.map