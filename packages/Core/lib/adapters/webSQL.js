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
var tables = [];
exports.SQLiteAbstract = function (_query, _batchSize) {
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
            _query(true, "CREATE TABLE IF NOT EXISTS \"_ai\" (id TEXT PRIMARY KEY UNIQUE, inc BIGINT)", [], complete, error);
        },
        createTable: function (table, tableData, ai, complete, error) {
            tables.push(table);
            _query(true, "CREATE TABLE IF NOT EXISTS \"" + table + "\" (id " + (tableData.isPkNum ? "REAL" : "TEXT") + " PRIMARY KEY UNIQUE, data TEXT)", [], function () {
                if (tableData.ai) {
                    _query(false, "SELECT \"inc\" FROM \"_ai\" WHERE id = ?", [table], function (result) {
                        if (!result.rows.length) {
                            ai[table] = 0;
                            _query(true, "INSERT into \"_ai\" (id, inc) VALUES (?, ?)", [table, 0], function () {
                                complete();
                            }, error);
                        }
                        else {
                            ai[table] = parseInt(result.rows.item(0).inc);
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
            _query(true, "DROP TABLE IF EXISTS " + checkTable(table), [], function () {
                _query(true, "UPDATE \"_ai\" SET inc = ? WHERE id = ?", [0, table], function () {
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
            row[pkCol] = pk;
            var rowStr = JSON.stringify(row);
            _query(false, "SELECT id FROM " + checkTable(table) + " WHERE id = ?", [pk], function (result) {
                if (result.rows.length) {
                    _query(true, "UPDATE " + checkTable(table) + " SET data = ? WHERE id = ?", [rowStr, pk], function () {
                        if (doAI && pk === ai[table]) {
                            _query(true, "UPDATE \"_ai\" SET inc = ? WHERE id = ?", [ai[table], table], function () {
                                complete(pk);
                            }, error);
                        }
                        else {
                            complete(pk);
                        }
                    }, error);
                }
                else {
                    _query(true, "INSERT INTO " + checkTable(table) + " (id, data) VALUES (?, ?)", [pk, rowStr], function () {
                        if (doAI && pk === ai[table]) {
                            _query(true, "UPDATE \"_ai\" SET inc = ? WHERE id = ?", [ai[table], table], function () {
                                complete(pk);
                            }, error);
                        }
                        else {
                            complete(pk);
                        }
                    }, error);
                }
            }, error);
        },
        read: function (table, pk, complete, error) {
            _query(false, "SELECT data FROM " + checkTable(table) + " WHERE id = ?", [pk], function (result) {
                if (result.rows.length) {
                    complete(JSON.parse(result.rows.item(0).data));
                }
                else {
                    complete(undefined);
                }
            }, error);
        },
        remove: function (table, pk, complete, error) {
            _query(true, "DELETE FROM " + checkTable(table) + " WHERE id = ?", [pk], function () {
                complete();
            }, error);
        },
        getIndex: function (table, complete, error) {
            _query(false, "SELECT id FROM " + checkTable(table) + " ORDER BY id", [], function (result) {
                var idx = [];
                for (var i = 0; i < result.rows.length; i++) {
                    idx.push(result.rows.item(i).id);
                }
                complete(idx);
            }, error);
        },
        getNumberOfRecords: function (table, complete, error) {
            _query(false, "SELECT COUNT(*) FROM " + checkTable(table), [], function (result) {
                complete(result.rows.item(0)["COUNT(*)"]);
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
            // get rows in batches to prevent from filling JS memory
            var batchNum = 0;
            var nextBatch = function () {
                var query = stmnt;
                if (type === "offset") {
                    if (limitOrHigh <= _batchSize) {
                        query += " LIMIT " + limitOrHigh + " OFFSET " + offsetOrLow;
                    }
                    else {
                        var actualLimit = Math.min(_batchSize, limitOrHigh - (batchNum * _batchSize));
                        var actualOffset = offsetOrLow + (batchNum * _batchSize);
                        if (actualLimit <= 0) {
                            complete();
                            return;
                        }
                        query += " LIMIT " + actualLimit + " OFFSET " + actualOffset;
                    }
                }
                else {
                    query += " LIMIT " + _batchSize + " OFFSET " + batchNum * _batchSize;
                }
                _query(false, query, type === "range" ? [offsetOrLow, limitOrHigh] : [], function (result) {
                    if (!result.rows.length) {
                        complete();
                        return;
                    }
                    for (var i = 0; i < result.rows.length; i++) {
                        onRow(JSON.parse(result.rows.item(i).data), (batchNum * _batchSize) + i);
                    }
                    if (result.rows.length === _batchSize) {
                        batchNum++;
                        nextBatch();
                    }
                    else {
                        complete();
                    }
                }, error);
            };
            nextBatch();
        }
    };
};
var WebSQL = /** @class */ (function (_super) {
    __extends(WebSQL, _super);
    function WebSQL(size, batchSize) {
        var _this = _super.call(this) || this;
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
        var isCompleting = false;
        this._db = window.openDatabase(this._id, String(this.nSQL.config.version) || "1.0", this._id, (utilities_1.isAndroid ? 5000000 : this._size));
        utilities_1.setFast(function () {
            _this._sqlite.createAI(complete, error);
        });
    };
    WebSQL.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    };
    WebSQL.prototype._query = function (allowWrite, sql, args, complete, error) {
        var doTransaction = function (tx) {
            tx.executeSql(sql, args, function (tx2, result) {
                complete(result);
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
    WebSQL.prototype.disconnectTable = function (table, complete, error) {
        complete();
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
}(memoryIndex_1.NanoSQLMemoryIndex));
exports.WebSQL = WebSQL;
//# sourceMappingURL=webSQL.js.map