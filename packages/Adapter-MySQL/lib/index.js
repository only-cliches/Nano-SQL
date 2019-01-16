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
var utilities_1 = require("@nano-sql/core/lib/utilities");
var memoryIndex_1 = require("@nano-sql/core/lib/adapters/memoryIndex");
var mysql = require("mysql");
/*
export interface mySQLConnection {
    query: (sql: string, callback: (err: Error, results: any, fields: any) => void) => void;
    release: () => void;
}*/
var MySQL = /** @class */ (function (_super) {
    __extends(MySQL, _super);
    function MySQL(connectArgs) {
        var _this = _super.call(this, false, false) || this;
        _this.connectArgs = connectArgs;
        _this.plugin = {
            name: "MySQL Adapter",
            version: 2.00
        };
        _this._tableConfigs = {};
        return _this;
    }
    MySQL.prototype.connect = function (id, complete, error) {
        this._id = id;
        this._db = mysql.createPool(__assign({ connectionLimit: 20 }, this.connectArgs));
        this._db.getConnection(function (err, connection) {
            if (err) {
                error(err);
                return;
            }
            connection.release();
            complete();
        });
    };
    MySQL.prototype._chkTable = function (table) {
        if (Object.keys(this._tableConfigs).indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        }
        else {
            return this._id + "_" + table;
        }
    };
    MySQL.prototype._sql = function (sql, args, complete, error) {
        this._db.getConnection(function (err, db) {
            if (err) {
                error(err);
                return;
            }
            ;
            db.query(mysql.format(sql, args), function (err, result, fields) {
                if (err) {
                    error(err);
                    return;
                }
                ;
                db.release();
                complete(result);
            });
        });
    };
    MySQL.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        this._sql("CREATE TABLE IF NOT EXISTS " + this._chkTable(tableName) + " (id " + (tableData.isPkNum ? (tableData.pkType === "int" ? "INT" : "DOUBLE") : "VARCHAR(36)") + " " + (tableData.ai ? "AUTO_INCREMENT" : "") + " PRIMARY KEY UNIQUE, data BLOB)", [], function (rows) {
            complete();
        }, error);
    };
    MySQL.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        this._sql("DROP TABLE " + this._chkTable(table) + ";", [], function (rows) {
            delete _this._tableConfigs[table];
            complete();
        }, error);
    };
    MySQL.prototype.disconnect = function (complete, error) {
        this._db.end(function (err) {
            if (err) {
                error(err);
                return;
            }
            complete();
        });
    };
    MySQL.prototype.write = function (table, pk, row, complete, error) {
        var _this = this;
        pk = this._tableConfigs[table].ai ? pk : pk || utilities_1.generateID(this._tableConfigs[table].pkType, 0);
        if (this._tableConfigs[table].ai && !pk) {
            this._sql("INSERT into " + this._chkTable(table) + " (data) VALUES (?)", [JSON.stringify(row)], function (result) {
                utilities_1.deepSet(_this._tableConfigs[table].pkCol, row, result.insertId);
                _this._sql("UPDATE " + _this._chkTable(table) + " SET data = ? WHERE id = ?", [JSON.stringify(row), result.insertId], function () {
                    complete(result.insertId);
                }, error);
            }, error);
        }
        else {
            if (!pk) {
                error("Can't add a row without a primary key!");
                return;
            }
            var json = JSON.stringify(utilities_1.deepSet(this._tableConfigs[table].pkCol, row, pk));
            this._sql("INSERT into " + this._chkTable(table) + " (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?", [pk, json, json], function (result) {
                complete(pk);
            }, error);
        }
    };
    MySQL.prototype.read = function (table, pk, complete, error) {
        this._sql("SELECT * FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function (rows) {
            if (rows.length) {
                complete(JSON.parse(rows[0].data.toString('utf8')));
            }
            else {
                complete(undefined);
            }
        }, error);
    };
    MySQL.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var stmnt = "SELECT data FROM " + this._chkTable(table);
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
        var count = 0;
        this._db.query(query, type === "range" ? [offsetOrLow, limitOrHigh] : []).on('error', function (err) {
            error(err);
        }).on('result', function (row) {
            onRow(JSON.parse(row.data.toString('utf8')), count);
            count++;
        }).on('end', function () {
            complete();
        });
    };
    MySQL.prototype.delete = function (table, pk, complete, error) {
        this._sql("DELETE FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function () {
            complete();
        }, error);
    };
    MySQL.prototype.getTableIndex = function (table, complete, error) {
        this._sql("SELECT id FROM " + this._chkTable(table) + " ORDER BY id", [], function (rows) {
            var idx = [];
            for (var i = 0; i < rows.length; i++) {
                idx.push(rows[i].id);
            }
            complete(idx);
        }, error);
    };
    MySQL.prototype.getTableIndexLength = function (table, complete, error) {
        this._sql("SELECT COUNT(*) FROM " + this._chkTable(table), [], function (rows) {
            complete(rows[0]["COUNT(*)"]);
        }, error);
    };
    return MySQL;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.MySQL = MySQL;
//# sourceMappingURL=index.js.map