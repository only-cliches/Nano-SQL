var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = require("../interfaces");
var utilities_1 = require("../utilities");
var memoryIndex_1 = require("./memoryIndex");
exports.SQLiteAbstract = function (_query, _batchSize) {
    var tables = [];
    var tableConfigs = {};
    var checkTable = function (table) {
        if (tables.indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        }
        else {
            return "\"" + table + "\"";
        }
    };
    return {
        createAI: function (complete, error) {
            _query(true, "CREATE TABLE IF NOT EXISTS \"_ai\" (id TEXT PRIMARY KEY UNIQUE, inc BIGINT)", [], utilities_1.noop, complete, error);
        },
        createTable: function (table, tableData, ai, complete, error) {
            tables.push(table);
            tableConfigs[table] = tableData;
            _query(true, "CREATE TABLE IF NOT EXISTS \"" + table + "\" (id " + (tableData.isPkNum ? "REAL" : "TEXT") + " PRIMARY KEY UNIQUE, data TEXT)", [], utilities_1.noop, function () {
                if (tableData.ai) {
                    var rows_1 = [];
                    _query(false, "SELECT \"inc\" FROM \"_ai\" WHERE id = ?", [table], function (result) {
                        rows_1.push(result);
                    }, function () {
                        if (!rows_1.length) {
                            ai[table] = 0;
                            _query(true, "INSERT into \"_ai\" (id, inc) VALUES (?, ?)", [table, 0], utilities_1.noop, complete, error);
                        }
                        else {
                            ai[table] = parseInt(rows_1[0].inc);
                            complete();
                        }
                    }, error);
                }
                else {
                    complete();
                }
            }, error);
        },
        dropTable: function (table, complete, error) {
            _query(true, "DROP TABLE IF EXISTS " + checkTable(table), [], utilities_1.noop, function () {
                _query(true, "UPDATE \"_ai\" SET inc = ? WHERE id = ?", [0, table], utilities_1.noop, function () {
                    tables.splice(tables.indexOf(table), 1);
                    complete();
                }, error);
            }, error);
        },
        write: function (pkType, pkCol, table, pk, row, doAI, ai, complete, error) {
            pk = pk || utilities_1.generateID(pkType, ai[table] + 1);
            if (typeof pk === "undefined") {
                error(new Error("Can't add a row without a primary key!"));
                return;
            }
            if (doAI)
                ai[table] = Math.max(pk, ai[table]);
            utilities_1.deepSet(pkCol, row, pk);
            var rowStr = JSON.stringify(row);
            var afterWrite = function () {
                if (doAI && pk >= ai[table]) {
                    _query(true, "UPDATE \"_ai\" SET inc = ? WHERE id = ?", [ai[table], table], utilities_1.noop, function () {
                        complete(pk);
                    }, error);
                }
                else {
                    complete(pk);
                }
            };
            var rows = [];
            _query(false, "SELECT id FROM " + checkTable(table) + " WHERE id = ?", [pk], function (result) {
                rows.push(result);
            }, function () {
                if (rows.length) {
                    _query(true, "UPDATE " + checkTable(table) + " SET data = ? WHERE id = ?", [rowStr, pk], utilities_1.noop, afterWrite, error);
                }
                else {
                    _query(true, "INSERT INTO " + checkTable(table) + " (id, data) VALUES (?, ?)", [pk, rowStr], utilities_1.noop, afterWrite, error);
                }
            }, error);
        },
        read: function (table, pk, complete, error) {
            var rows = [];
            _query(false, "SELECT data FROM " + checkTable(table) + " WHERE id = ?", [pk], function (result) {
                rows.push(result);
            }, function () {
                if (rows.length) {
                    complete(JSON.parse(rows[0].data));
                }
                else {
                    complete(undefined);
                }
            }, error);
        },
        remove: function (table, pk, complete, error) {
            _query(true, "DELETE FROM " + checkTable(table) + " WHERE id = ?", [pk], utilities_1.noop, function () {
                complete();
            }, error);
        },
        getIndex: function (table, complete, error) {
            var idx = [];
            _query(false, "SELECT id FROM " + checkTable(table) + " ORDER BY id", [], function (row) {
                idx.push(row.id);
            }, function () {
                complete(idx);
            }, error);
        },
        getNumberOfRecords: function (table, complete, error) {
            var rows = [];
            _query(false, "SELECT COUNT(*) FROM " + checkTable(table), [], function (result) {
                rows.push(result);
            }, function () {
                complete(rows[0]["COUNT(*)"]);
            }, error);
        },
        readMulti: function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
            var stmnt = "SELECT data FROM " + checkTable(table);
            if (type === "range") {
                stmnt += " WHERE id BETWEEN ? AND ?";
            }
            if (reverse) {
                stmnt += " ORDER BY id DESC";
            }
            else {
                stmnt += " ORDER BY id";
            }
            var query = stmnt;
            if (type === "offset") {
                var lower = reverse ? offsetOrLow + 1 : offsetOrLow;
                var higher = limitOrHigh;
                query += " LIMIT " + higher + " OFFSET " + lower;
            }
            _query(false, query, type === "range" ? [offsetOrLow, limitOrHigh] : [], function (row, i) {
                onRow(JSON.parse(row.data), i);
            }, function () {
                complete();
            }, error);
        }
    };
};
var WebSQL = /** @class */ (function (_super) {
    __extends(WebSQL, _super);
    function WebSQL(size, batchSize) {
        var _this = _super.call(this, false, false) || this;
        _this.plugin = {
            name: "WebSQL Adapter",
            version: interfaces_1.VERSION
        };
        _this._size = (size || 0) * 1000 * 1000;
        _this._ai = {};
        _this._query = _this._query.bind(_this);
        _this._tableConfigs = {};
        _this._sqlite = exports.SQLiteAbstract(_this._query, batchSize || 500);
        return _this;
    }
    WebSQL.prototype.connect = function (id, complete, error) {
        var _this = this;
        this._id = id;
        try {
            this._db = window.openDatabase(this._id, String(this.nSQL.config.version) || "1.0", this._id, (utilities_1.isAndroid ? 5000000 : this._size));
        }
        catch (e) {
            error(e);
        }
        utilities_1.setFast(function () {
            _this._sqlite.createAI(complete, error);
        });
    };
    WebSQL.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    };
    WebSQL.prototype._query = function (allowWrite, sql, args, onRow, complete, error) {
        var doTransaction = function (tx) {
            tx.executeSql(sql, args, function (tx2, result) {
                for (var i = 0; i < result.rows.length; i++) {
                    onRow(result.rows.item(i), i);
                }
                complete();
            }, function (tx, err) {
                error(err);
                return false;
            });
        };
        if (allowWrite) {
            this._db.transaction(doTransaction);
        }
        else {
            this._db.readTransaction(doTransaction);
        }
    };
    WebSQL.prototype.dropTable = function (table, complete, error) {
        this._sqlite.dropTable(table, complete, error);
    };
    WebSQL.prototype.disconnect = function (complete, error) {
        complete();
    };
    WebSQL.prototype.write = function (table, pk, row, complete, error) {
        this._sqlite.write(this._tableConfigs[table].pkType, this._tableConfigs[table].pkCol, table, pk, row, this._tableConfigs[table].ai, this._ai, complete, error);
    };
    WebSQL.prototype.read = function (table, pk, complete, error) {
        this._sqlite.read(table, pk, complete, error);
    };
    WebSQL.prototype.delete = function (table, pk, complete, error) {
        this._sqlite.remove(table, pk, complete, error);
    };
    WebSQL.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        this._sqlite.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error);
    };
    WebSQL.prototype.getTableIndex = function (table, complete, error) {
        this._sqlite.getIndex(table, complete, error);
    };
    WebSQL.prototype.getTableIndexLength = function (table, complete, error) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    };
    return WebSQL;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.WebSQL = WebSQL;
//# sourceMappingURL=webSQL.js.map