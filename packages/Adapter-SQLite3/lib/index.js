var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var memoryIndex_1 = require("@nano-sql/core/lib/adapters/memoryIndex");
var webSQL_1 = require("@nano-sql/core/lib/adapters/webSQL");
exports.sqlite3 = require('sqlite3');
var SQLiteResult = /** @class */ (function () {
    function SQLiteResult(rows) {
        var _this = this;
        this.rowData = rows;
        this.rows = {
            item: function (idx) {
                return _this.rowData[idx];
            },
            length: this.rowData.length
        };
    }
    return SQLiteResult;
}());
exports.SQLiteResult = SQLiteResult;
var SQLite = /** @class */ (function (_super) {
    __extends(SQLite, _super);
    function SQLite(fileName, mode, batchSize) {
        var _this = _super.call(this, false, false) || this;
        _this.plugin = {
            name: "SQLite Adapter",
            version: 2.03
        };
        _this._ai = {};
        _this._query = _this._query.bind(_this);
        _this._filename = fileName || ":memory:";
        _this._mode = mode || (exports.sqlite3.OPEN_READWRITE | exports.sqlite3.OPEN_CREATE);
        _this._tableConfigs = {};
        _this._sqlite = webSQL_1.SQLiteAbstract(_this._query, batchSize || 500);
        return _this;
    }
    SQLite.prototype.connect = function (id, complete, error) {
        var _this = this;
        this._id = id;
        this._db = new exports.sqlite3.Database(this._filename, this._mode || (exports.sqlite3.OPEN_READWRITE | exports.sqlite3.OPEN_CREATE), function (err) {
            if (err) {
                error(err);
                return;
            }
            _this._sqlite.createAI(complete, error);
        });
    };
    SQLite.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    };
    SQLite.prototype._query = function (allowWrite, sql, args, complete, error) {
        if (allowWrite) {
            this._db.run(sql, args, function (err) {
                if (err) {
                    error(err);
                    return;
                }
                complete(new SQLiteResult([]));
            });
        }
        else {
            var rows_1 = [];
            this._db.each(sql, args, function (err, row) {
                rows_1.push(row);
            }, function (err) {
                if (err) {
                    error(err);
                    return;
                }
                complete(new SQLiteResult(rows_1));
            });
        }
    };
    SQLite.prototype.dropTable = function (table, complete, error) {
        this._sqlite.dropTable(table, complete, error);
    };
    SQLite.prototype.disconnect = function (complete, error) {
        complete();
    };
    SQLite.prototype.write = function (table, pk, row, complete, error) {
        this._sqlite.write(this._tableConfigs[table].pkType, this._tableConfigs[table].pkCol, table, pk, row, this._tableConfigs[table].ai, this._ai, complete, error);
    };
    SQLite.prototype.read = function (table, pk, complete, error) {
        this._sqlite.read(table, pk, complete, error);
    };
    SQLite.prototype.delete = function (table, pk, complete, error) {
        this._sqlite.remove(table, pk, complete, error);
    };
    SQLite.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        this._sqlite.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error);
    };
    SQLite.prototype.getTableIndex = function (table, complete, error) {
        this._sqlite.getIndex(table, complete, error);
    };
    SQLite.prototype.getTableIndexLength = function (table, complete, error) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    };
    return SQLite;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.SQLite = SQLite;
//# sourceMappingURL=index.js.map