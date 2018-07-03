var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var lie_ts_1 = require("lie-ts");
var utilities_1 = require("nano-sql/lib/utilities");
var mysql = require("mysql");
var SQLResult = (function () {
    function SQLResult(rows) {
        var _this = this;
        this.rowData = rows;
        this.rows = {
            item: function (idx) {
                return _this.rowData[idx];
            },
            length: this.rowData.length
        };
    }
    return SQLResult;
}());
exports.SQLResult = SQLResult;
var MySQLAdapter = (function () {
    function MySQLAdapter(connectArgs) {
        this.connectArgs = connectArgs;
        this._pkKey = {};
        this._pkType = {};
        this._doAI = {};
    }
    MySQLAdapter.prototype.setID = function (id) {
        this._id = id;
    };
    MySQLAdapter.prototype.connect = function (complete) {
        var _this = this;
        this._db = mysql.createPool(__assign({ connectionLimit: 20 }, this.connectArgs));
        this._db.getConnection(function (err, connection) {
            if (err) {
                throw err;
            }
            connection.release();
            utilities_1.fastALL(Object.keys(_this._pkKey), function (table, i, nextKey) {
                var stmt = _this._doAI[table] ?
                    "CREATE TABLE IF NOT EXISTS " + _this._chkTable(table) + " (id Integer AUTO_INCREMENT PRIMARY KEY , data BLOB)" :
                    "CREATE TABLE IF NOT EXISTS " + _this._chkTable(table) + " (id VARCHAR(36) PRIMARY KEY, data BLOB)";
                _this._sql(true, stmt, [], function () {
                    nextKey();
                });
            }).then(function () {
                complete();
            });
        });
    };
    MySQLAdapter.prototype._chkTable = function (table) {
        if (Object.keys(this._pkType).indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        }
        else {
            return "DB" + "_" + this._id + "_" + table;
        }
    };
    MySQLAdapter.prototype.makeTable = function (tableName, dataModels) {
        var _this = this;
        dataModels.forEach(function (d) {
            if (d.props && utilities_1.intersect(["pk", "pk()"], d.props)) {
                _this._pkType[tableName] = d.type;
                _this._pkKey[tableName] = d.key;
                if (d.type === "int" && utilities_1.intersect(["ai", "ai()"], d.props)) {
                    _this._doAI[tableName] = true;
                }
            }
        });
    };
    MySQLAdapter.prototype._sql = function (allowWrite, sql, args, complete, getPK) {
        var _this = this;
        this._db.getConnection(function (err, db) {
            if (err) {
                throw err;
            }
            ;
            db.query(mysql.format(sql, args), function (err, rows, fields) {
                if (err) {
                    throw err;
                }
                ;
                if (getPK) {
                    db.query("SELECT LAST_INSERT_ID() FROM " + _this._chkTable(getPK), function (err, result, fields) {
                        db.release();
                        complete(result);
                    });
                }
                else {
                    db.release();
                    complete(new SQLResult(rows || []));
                }
            });
        });
    };
    MySQLAdapter.prototype.write = function (table, pk, data, complete, error) {
        var _this = this;
        if (!this._doAI[table]) {
            pk = pk || utilities_1.generateID(this._pkType[table], 0);
            if (!pk) {
                throw new Error("Can't add a row without a primary key!");
            }
        }
        var r = __assign({}, data, (_a = {}, _a[this._pkKey[table]] = pk, _a));
        if (this._doAI[table] && !pk) {
            this._sql(true, "INSERT into " + this._chkTable(table) + " (data) VALUES (?)", [JSON.stringify(r)], function (result) {
                var r2 = __assign({}, r, (_a = {}, _a[_this._pkKey[table]] = result[0]['LAST_INSERT_ID()'], _a));
                _this._sql(true, "UPDATE " + _this._chkTable(table) + " SET data = ? WHERE id = ?", [JSON.stringify(r2), result[0]['LAST_INSERT_ID()']], function () {
                    complete(r2);
                });
                var _a;
            }, table);
        }
        else {
            var json = JSON.stringify(r);
            this._sql(true, "INSERT into " + this._chkTable(table) + " (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?", [pk, json, json], function (result) {
                complete(r);
            });
        }
        var _a;
    };
    MySQLAdapter.prototype.delete = function (table, pk, complete) {
        this._sql(true, "DELETE FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function () {
            complete();
        });
    };
    MySQLAdapter.prototype.read = function (table, pk, callback) {
        this._sql(false, "SELECT data FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function (result) {
            if (result.rows.length) {
                callback(JSON.parse(result.rows.item(0).data));
            }
            else {
                callback(undefined);
            }
        });
    };
    MySQLAdapter.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
        var usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        var stmnt = "SELECT data from " + this._chkTable(table);
        var args = [];
        if (usefulValues && usePK) {
            args = [from, to];
            stmnt += " WHERE id BETWEEN ? AND ?";
        }
        stmnt += " ORDER BY id ASC";
        if (usefulValues && !usePK) {
            args = [(to - from) + 1, from];
            stmnt += " LIMIT ? OFFSET ?";
        }
        this._sql(false, stmnt, args, function (result) {
            var i = 0;
            var getRow = function () {
                if (result.rows.length > i) {
                    rowCallback(JSON.parse(result.rows.item(i).data), i, function () {
                        i++;
                        i % 500 === 0 ? lie_ts_1.setFast(getRow) : getRow();
                    });
                }
                else {
                    complete();
                }
            };
            getRow();
        });
    };
    MySQLAdapter.prototype.drop = function (table, callback) {
        this._sql(true, "DELETE FROM " + this._chkTable(table), [], function (rows) {
            callback();
        });
    };
    MySQLAdapter.prototype.getIndex = function (table, getLength, complete) {
        if (getLength) {
            this._sql(false, "SELECT COUNT(*) AS length FROM " + this._chkTable(table), [], function (result) {
                complete(result.rows.item(0).length);
            });
        }
        else {
            this._sql(false, "SELECT id FROM " + this._chkTable(table) + " ORDER BY id ASC", [], function (result) {
                var idx = [];
                var i = result.rows.length;
                while (i--) {
                    idx.unshift(result.rows.item(i).id);
                }
                complete(idx);
            });
        }
    };
    MySQLAdapter.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._pkKey), function (table, i, done) {
            _this._sql(true, "DROP TABLE " + _this._chkTable(table), [], function () {
                done();
            });
        }).then(complete);
    };
    return MySQLAdapter;
}());
exports.MySQLAdapter = MySQLAdapter;
