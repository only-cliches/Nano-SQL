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
var db_idx_1 = require("nano-sql/lib/database/db-idx");
exports.sqlite3 = require('sqlite3');
var SQLiteResult = (function () {
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
var nSQLiteAdapter = (function () {
    function nSQLiteAdapter(filename, mode) {
        this._pkKey = {};
        this._dbIndex = {};
        this._filename = filename;
        this._mode = mode;
    }
    nSQLiteAdapter.prototype.setID = function (id) {
        this._id = id;
    };
    nSQLiteAdapter.prototype.connect = function (complete) {
        var _this = this;
        this._db = new exports.sqlite3.Database(this._filename, this._mode || (exports.sqlite3.OPEN_READWRITE | exports.sqlite3.OPEN_CREATE), function (err) {
            if (err) {
                throw err;
            }
            utilities_1.fastALL(Object.keys(_this._pkKey), function (table, i, nextKey) {
                _this._sql(true, "CREATE TABLE IF NOT EXISTS " + table + " (id BLOB PRIMARY KEY UNIQUE, data TEXT)", [], function () {
                    _this._sql(false, "SELECT id FROM " + table, [], function (result) {
                        var idx = [];
                        for (var i_1 = 0; i_1 < result.rows.length; i_1++) {
                            idx.push(result.rows.item(i_1).id);
                        }
                        idx = idx.sort();
                        _this._dbIndex[table].set(idx);
                        nextKey();
                    });
                });
            }).then(complete);
        });
    };
    nSQLiteAdapter.prototype._chkTable = function (table) {
        if (Object.keys(this._dbIndex).indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        }
        else {
            return table;
        }
    };
    nSQLiteAdapter.prototype.makeTable = function (tableName, dataModels) {
        var _this = this;
        this._dbIndex[tableName] = new db_idx_1.DatabaseIndex();
        dataModels.forEach(function (d) {
            if (d.props && utilities_1.intersect(["pk", "pk()"], d.props)) {
                _this._dbIndex[tableName].pkType = d.type;
                _this._pkKey[tableName] = d.key;
                if (d.props && utilities_1.intersect(["ai", "ai()"], d.props) && (d.type === "int" || d.type === "number")) {
                    _this._dbIndex[tableName].doAI = true;
                }
                if (d.props && utilities_1.intersect(["ns", "ns()"], d.props) || ["uuid", "timeId", "timeIdms"].indexOf(_this._dbIndex[tableName].pkType) !== -1) {
                    _this._dbIndex[tableName].sortIndex = false;
                }
            }
        });
    };
    nSQLiteAdapter.prototype._sql = function (allowWrite, sql, args, complete) {
        if (allowWrite) {
            this._db.run(sql, args, function (err) {
                if (err)
                    throw err;
                complete(new SQLiteResult([]));
            });
        }
        else {
            var rows_1 = [];
            this._db.each(sql, args, function (err, row) {
                rows_1.push(row);
            }, function (err) {
                if (err)
                    throw err;
                complete(new SQLiteResult(rows_1));
            });
        }
    };
    nSQLiteAdapter.prototype.write = function (table, pk, data, complete) {
        var _a, _b;
        pk = pk || utilities_1.generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai);
        if (!pk) {
            throw new Error("Can't add a row without a primary key!");
        }
        var newRow = false;
        if (this._dbIndex[table].indexOf(pk) === -1) {
            newRow = true;
            this._dbIndex[table].add(pk);
        }
        if (newRow) {
            var r_1 = __assign({}, data, (_a = {}, _a[this._pkKey[table]] = pk, _a));
            this._sql(true, "INSERT into " + this._chkTable(table) + " (id, data) VALUES (?, ?)", [pk, JSON.stringify(r_1)], function (result) {
                complete(r_1);
            });
        }
        else {
            var r_2 = __assign({}, data, (_b = {}, _b[this._pkKey[table]] = pk, _b));
            this._sql(true, "UPDATE " + this._chkTable(table) + " SET data = ? WHERE id = ?", [JSON.stringify(r_2), pk], function () {
                complete(r_2);
            });
        }
    };
    nSQLiteAdapter.prototype.delete = function (table, pk, complete) {
        var pos = this._dbIndex[table].indexOf(pk);
        if (pos !== -1) {
            this._dbIndex[table].remove(pk);
        }
        this._sql(true, "DELETE FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function () {
            complete();
        });
    };
    nSQLiteAdapter.prototype.read = function (table, pk, callback) {
        this._sql(false, "SELECT data FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function (result) {
            if (result.rows.length) {
                callback(JSON.parse(result.rows.item(0).data));
            }
            else {
                callback(undefined);
            }
        });
    };
    nSQLiteAdapter.prototype.batchRead = function (table, pks, callback) {
        var _this = this;
        var useKeys = utilities_1.splitArr(pks, 500);
        var rows = [];
        utilities_1.fastCHAIN(useKeys, function (keys, i, next) {
            _this._sql(false, "SELECT data from " + _this._chkTable(table) + " WHERE id IN (" + keys.map(function (p) { return "?"; }).join(", ") + ") ORDER BY id", keys, function (result) {
                var i = result.rows.length;
                while (i--) {
                    rows.push(JSON.parse(result.rows.item(i).data));
                }
                next();
            });
        }).then(function () {
            callback(rows);
        });
    };
    nSQLiteAdapter.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
        var _this = this;
        var keys = this._dbIndex[table].keys();
        var usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        var ranges = usefulValues ? [from, to] : [];
        if (!keys.length) {
            complete();
            return;
        }
        if (usePK && usefulValues) {
            ranges = ranges.map(function (r) { return _this._dbIndex[table].getLocation(r); });
        }
        if (!(usePK && usefulValues) && this._dbIndex[table].sortIndex === false) {
            keys = keys.sort();
        }
        var idx = ranges[0] || 0;
        var getKeys = [];
        var startIDX = ranges[0];
        var stmnt = "SELECT data from " + this._chkTable(table);
        if (ranges.length) {
            var t = typeof keys[startIDX] === "number";
            while (startIDX <= ranges[1]) {
                getKeys.push(keys[startIDX]);
                startIDX++;
            }
        }
        stmnt += " ORDER BY id";
        if (getKeys.length) {
            this.batchRead(this._chkTable(table), getKeys, function (result) {
                var i = 0;
                var getRow = function () {
                    if (result.length > i) {
                        rowCallback(result[i], idx, function () {
                            idx++;
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
        }
        else {
            this._sql(false, stmnt, [], function (result) {
                var i = 0;
                var getRow = function () {
                    if (result.rows.length > i) {
                        rowCallback(JSON.parse(result.rows.item(i).data), idx, function () {
                            idx++;
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
        }
    };
    nSQLiteAdapter.prototype.drop = function (table, callback) {
        var idx = new db_idx_1.DatabaseIndex();
        idx.doAI = this._dbIndex[table].doAI;
        this._dbIndex[table] = idx;
        this._sql(true, "DELETE FROM " + this._chkTable(table), [], function (rows) {
            callback();
        });
    };
    nSQLiteAdapter.prototype.getIndex = function (table, getLength, complete) {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    };
    nSQLiteAdapter.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            _this.drop(table, done);
        }).then(complete);
    };
    return nSQLiteAdapter;
}());
exports.nSQLiteAdapter = nSQLiteAdapter;
