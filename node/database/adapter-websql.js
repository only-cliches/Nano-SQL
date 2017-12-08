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
var utilities_1 = require("../utilities");
var db_idx_1 = require("./db-idx");
var _WebSQLStore = (function () {
    function _WebSQLStore(size) {
        this._pkKey = {};
        this._pkType = {};
        this._dbIndex = {};
        this._size = (size || 0) * 1000 * 1000;
    }
    _WebSQLStore.prototype.setID = function (id) {
        this._id = id;
    };
    _WebSQLStore.prototype.connect = function (complete) {
        var _this = this;
        this._db = window.openDatabase(this._id, "1.0", this._id, this._size || utilities_1.isAndroid ? 5000000 : 1);
        new utilities_1.ALL(Object.keys(this._pkKey).map(function (table) {
            return function (nextKey) {
                _this._sql(true, "CREATE TABLE IF NOT EXISTS " + table + " (id BLOB PRIMARY KEY UNIQUE, data TEXT)", [], function () {
                    _this._sql(false, "SELECT id FROM " + table, [], function (result) {
                        var idx = [];
                        for (var i = 0; i < result.rows.length; i++) {
                            idx.push(result.rows.item(i).id);
                        }
                        idx = idx.sort();
                        _this._dbIndex[table].set(idx);
                        nextKey();
                    });
                });
            };
        })).then(function () {
            complete();
        });
    };
    _WebSQLStore.prototype._chkTable = function (table) {
        if (Object.keys(this._pkType).indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        }
        else {
            return table;
        }
    };
    _WebSQLStore.prototype.makeTable = function (tableName, dataModels) {
        var _this = this;
        this._dbIndex[tableName] = new db_idx_1.DatabaseIndex();
        dataModels.forEach(function (d) {
            if (d.props && d.props.indexOf("pk") > -1) {
                _this._pkType[tableName] = d.type;
                _this._pkKey[tableName] = d.key;
            }
            if (d.props && d.props.indexOf("ai") > -1 && d.props.indexOf("pk") > -1 && d.type === "int") {
                _this._dbIndex[tableName].doAI = true;
            }
        });
    };
    _WebSQLStore.prototype._sql = function (allowWrite, sql, args, complete) {
        var doTransaction = function (tx) {
            tx.executeSql(sql, args, function (tx2, result) {
                complete(result);
            }, function (tx, err) {
                console.error(sql, args, err);
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
    _WebSQLStore.prototype.write = function (table, pk, data, complete, skipReadBeforeWrite) {
        var _this = this;
        pk = pk || utilities_1.generateID(this._pkType[table], this._dbIndex[table].ai);
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
            var w_1 = function (oldData) {
                var r = __assign({}, oldData, data, (_a = {}, _a[_this._pkKey[table]] = pk, _a));
                _this._sql(true, "UPDATE " + _this._chkTable(table) + " SET data = ? WHERE id = ?", [JSON.stringify(r), pk], function () {
                    complete(r);
                });
                var _a;
            };
            if (skipReadBeforeWrite) {
                w_1({});
            }
            else {
                this.read(table, pk, function (row) {
                    w_1(row);
                });
            }
        }
        var _a;
    };
    _WebSQLStore.prototype.delete = function (table, pk, complete) {
        var pos = this._dbIndex[table].indexOf(pk);
        if (pos !== -1) {
            this._dbIndex[table].remove(pk);
        }
        this._sql(true, "DELETE FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function () {
            complete();
        });
    };
    _WebSQLStore.prototype.read = function (table, pk, callback) {
        this._sql(false, "SELECT data FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function (result) {
            if (result.rows.length) {
                callback(JSON.parse(result.rows.item(0).data));
            }
            else {
                callback(undefined);
            }
        });
    };
    _WebSQLStore.prototype.rangeRead = function (table, rowCallback, complete, fromIdx, toIdx) {
        var keys = this._dbIndex[table].keys();
        var ranges = [typeof fromIdx, typeof toIdx].indexOf("undefined") === -1 ? [fromIdx, toIdx] : [];
        if (!keys.length) {
            complete();
            return;
        }
        var idx = ranges[0] || 0;
        var getKeys = [];
        var startIDX = ranges[0];
        var stmnt = "SELECT data from " + this._chkTable(table);
        if (ranges.length) {
            var t = typeof keys[startIDX] === "number";
            while (startIDX <= ranges[1]) {
                getKeys.push(t ? keys[startIDX] : "\"" + keys[startIDX] + "\"");
                startIDX++;
            }
            stmnt += " WHERE id IN (" + getKeys.join(", ") + ")";
        }
        stmnt += " ORDER BY id";
        this._sql(false, stmnt, [], function (result) {
            var i = 0;
            var getRow = function () {
                if (result.rows.length > i) {
                    rowCallback(JSON.parse(result.rows.item(i).data), idx, function () {
                        idx++;
                        i++;
                        i > 200 ? lie_ts_1.setFast(getRow) : getRow();
                    });
                }
                else {
                    complete();
                }
            };
            getRow();
        });
    };
    _WebSQLStore.prototype.drop = function (table, callback) {
        var idx = new db_idx_1.DatabaseIndex();
        idx.doAI = this._dbIndex[table].doAI;
        this._dbIndex[table] = idx;
        this._sql(true, "DELETE FROM " + this._chkTable(table), [], function (rows) {
            callback();
        });
    };
    _WebSQLStore.prototype.indexOfPK = function (table, pk, complete) {
        complete(this._dbIndex[table].getLocation(pk));
    };
    _WebSQLStore.prototype.getIndex = function (table, getIdx, complete) {
        complete(getIdx ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    };
    _WebSQLStore.prototype.destroy = function (complete) {
        var _this = this;
        new utilities_1.ALL(Object.keys(this._dbIndex).map(function (table) {
            return function (done) {
                _this.drop(table, done);
            };
        })).then(complete);
    };
    return _WebSQLStore;
}());
exports._WebSQLStore = _WebSQLStore;
