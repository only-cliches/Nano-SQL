var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var memoryIndex_1 = require("@nano-sql/core/lib/adapters/memoryIndex");
var webSQL_1 = require("@nano-sql/core/lib/adapters/webSQL");
var NSSQLite = require("nativescript-sqlite");
var NativeSQLite = /** @class */ (function (_super) {
    __extends(NativeSQLite, _super);
    function NativeSQLite(fileName) {
        var _this = _super.call(this, false, true) || this;
        _this.plugin = {
            name: "NativeScript SQLite Adapter",
            version: 2.00
        };
        _this._ai = {};
        _this._query = _this._query.bind(_this);
        _this._filename = fileName || ":memory:";
        _this._tableConfigs = {};
        _this._sqlite = webSQL_1.SQLiteAbstract(_this._query, 500);
        return _this;
    }
    NativeSQLite.prototype.connect = function (id, complete, error) {
        var _this = this;
        this._id = id;
        new NSSQLite(this._filename, function (err, db) {
            if (err) {
                error(err);
                return;
            }
            _this._db = db;
            _this._sqlite.createAI(function () {
                _this._db.resultType(NSSQLite.RESULTSASOBJECT);
                complete();
            }, error);
        });
    };
    NativeSQLite.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    };
    NativeSQLite.prototype._query = function (allowWrite, sql, args, onRow, complete, error) {
        if (allowWrite) {
            this._db.execSQL(sql, args, function (err) {
                if (err) {
                    error(err);
                    return;
                }
                complete();
            });
        }
        else {
            var count_1 = 0;
            this._db.each(sql, args, function (err, row) {
                if (err) {
                    error(err);
                    return;
                }
                onRow(row, count_1);
                count_1++;
            }, function (err) {
                if (err) {
                    error(err);
                    return;
                }
                complete();
            });
        }
    };
    NativeSQLite.prototype.dropTable = function (table, complete, error) {
        this._sqlite.dropTable(table, complete, error);
    };
    NativeSQLite.prototype.disconnect = function (complete, error) {
        complete();
    };
    NativeSQLite.prototype.write = function (table, pk, row, complete, error) {
        this._sqlite.write(this._tableConfigs[table].pkType, this._tableConfigs[table].pkCol, table, pk, row, this._tableConfigs[table].ai, this._ai, complete, error);
    };
    NativeSQLite.prototype.read = function (table, pk, complete, error) {
        this._sqlite.read(table, pk, complete, error);
    };
    NativeSQLite.prototype.delete = function (table, pk, complete, error) {
        this._sqlite.remove(table, pk, complete, error);
    };
    NativeSQLite.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        this._sqlite.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error);
    };
    NativeSQLite.prototype.getTableIndex = function (table, complete, error) {
        this._sqlite.getIndex(table, complete, error);
    };
    NativeSQLite.prototype.getTableIndexLength = function (table, complete, error) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    };
    return NativeSQLite;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.NativeSQLite = NativeSQLite;
//# sourceMappingURL=index.js.map