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
exports.getMode = function () {
    if (typeof cordova !== "undefined" && window["sqlitePlugin"]) {
        if (window["device"] && window["device"].platform && window["device"].platform !== "browser") {
            return new SQLiteCordova();
        }
        else {
            return "PERM";
        }
    }
    else {
        return "PERM";
    }
};
var SQLiteCordova = /** @class */ (function (_super) {
    __extends(SQLiteCordova, _super);
    function SQLiteCordova() {
        var _this = _super.call(this, false, false) || this;
        _this.plugin = {
            name: "SQLite Cordova Adapter",
            version: 2.06
        };
        if (!window["sqlitePlugin"]) {
            throw Error("SQLite plugin not installed or nanoSQL plugin called before device ready!");
        }
        _this._ai = {};
        _this._query = _this._query.bind(_this);
        _this._tableConfigs = {};
        _this._sqlite = webSQL_1.SQLiteAbstract(_this._query, 500);
        return _this;
    }
    SQLiteCordova.prototype.connect = function (id, complete, error) {
        console.log("nanoSQL \"" + id + "\" using SQLite.");
        try {
            this._db = window["sqlitePlugin"].openDatabase({ name: id, location: "default" });
            complete();
        }
        catch (e) {
            error(e);
        }
    };
    SQLiteCordova.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    };
    SQLiteCordova.prototype._query = function (allowWrite, sql, args, onRow, complete, error) {
        this._db.executeSql(sql, args, function (result) {
            var rows = [];
            for (var i = 0; i < result.rows.length; i++) {
                onRow(result.rows.item(i), i);
            }
            complete();
        }, function (err) {
            error(err);
        });
    };
    SQLiteCordova.prototype.dropTable = function (table, complete, error) {
        this._sqlite.dropTable(table, complete, error);
    };
    SQLiteCordova.prototype.disconnect = function (complete, error) {
        complete();
    };
    SQLiteCordova.prototype.write = function (table, pk, row, complete, error) {
        this._sqlite.write(this._tableConfigs[table].pkType, this._tableConfigs[table].pkCol, table, pk, row, this._tableConfigs[table].ai, this._ai, complete, error);
    };
    SQLiteCordova.prototype.read = function (table, pk, complete, error) {
        this._sqlite.read(table, pk, complete, error);
    };
    SQLiteCordova.prototype.delete = function (table, pk, complete, error) {
        this._sqlite.remove(table, pk, complete, error);
    };
    SQLiteCordova.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        this._sqlite.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error);
    };
    SQLiteCordova.prototype.getTableIndex = function (table, complete, error) {
        this._sqlite.getIndex(table, complete, error);
    };
    SQLiteCordova.prototype.getTableIndexLength = function (table, complete, error) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    };
    return SQLiteCordova;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.SQLiteCordova = SQLiteCordova;
//# sourceMappingURL=index.js.map