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
;
exports.getMode = function () {
    return typeof cordova !== "undefined" && window["sqlitePlugin"] ? new SQLiteStore() : "PERM";
};
var SQLiteStore = (function () {
    function SQLiteStore() {
        this._pkKey = {};
        this._dbIndex = {};
    }
    SQLiteStore.prototype.setID = function (id) {
        this._id = id;
    };
    SQLiteStore.prototype.connect = function (complete) {
        var _this = this;
        if (!window["sqlitePlugin"]) {
            throw Error("SQLite plugin not installed or nanoSQL plugin called before device ready!");
        }
        console.log("NanoSQL \"" + this._id + "\" using SQLite.");
        this._db = window["sqlitePlugin"].openDatabase({ name: this._id + "_db", location: "default" });
        utilities_1.fastALL(Object.keys(this._pkKey), function (table, i, nextKey) {
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
    };
    SQLiteStore.prototype._chkTable = function (table) {
        if (Object.keys(this._dbIndex).indexOf(table) === -1) {
            throw Error("No table " + table + " found!");
        }
        else {
            return table;
        }
    };
    SQLiteStore.prototype.makeTable = function (tableName, dataModels) {
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
    SQLiteStore.prototype._sql = function (allowWrite, sql, args, complete) {
        this._db.executeSql(sql, args, function (result) {
            complete(result);
        }, function (err) {
            console.error(sql, args, err);
            return false;
        });
    };
    SQLiteStore.prototype.write = function (table, pk, data, complete) {
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
        var _a, _b;
    };
    SQLiteStore.prototype.delete = function (table, pk, complete) {
        var pos = this._dbIndex[table].indexOf(pk);
        if (pos !== -1) {
            this._dbIndex[table].remove(pk);
        }
        this._sql(true, "DELETE FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function () {
            complete();
        });
    };
    SQLiteStore.prototype.read = function (table, pk, callback) {
        this._sql(false, "SELECT data FROM " + this._chkTable(table) + " WHERE id = ?", [pk], function (result) {
            if (result.rows.length) {
                callback(JSON.parse(result.rows.item(0).data));
            }
            else {
                callback(undefined);
            }
        });
    };
    SQLiteStore.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
        var _this = this;
        var keys = this._dbIndex[table].keys();
        var usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        var ranges = usefulValues ? [from, to] : [];
        if (!keys.length) {
            complete();
            return;
        }
        if (!(usePK && usefulValues) && this._dbIndex[table].sortIndex === false) {
            keys = keys.sort();
        }
        if (usePK && usefulValues) {
            ranges = ranges.map(function (r) { return _this._dbIndex[table].getLocation(r); });
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
            stmnt += " WHERE id IN (" + getKeys.map(function (k) { return "?"; }).join(", ") + ")";
        }
        stmnt += " ORDER BY id";
        this._sql(false, stmnt, getKeys.map(function (p) { return typeof p === "string" ? "'" + p + "'" : p; }), function (result) {
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
    SQLiteStore.prototype.batchRead = function (table, pks, callback) {
        this._sql(false, "SELECT data from " + this._chkTable(table) + " WHERE id IN (" + pks.map(function (p) { return "?"; }).join(", ") + ") ORDER BY id", pks.map(function (p) { return typeof p === "string" ? "'" + p + "'" : p; }), function (result) {
            var i = result.rows.length;
            var rows = [];
            while (i--) {
                rows.unshift(JSON.parse(result.rows.item(i).data));
            }
            callback(rows);
        });
    };
    SQLiteStore.prototype.drop = function (table, callback) {
        var idx = new db_idx_1.DatabaseIndex();
        idx.doAI = this._dbIndex[table].doAI;
        this._dbIndex[table] = idx;
        this._sql(true, "DELETE FROM " + this._chkTable(table), [], function (rows) {
            callback();
        });
    };
    SQLiteStore.prototype.getIndex = function (table, getLength, complete) {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    };
    SQLiteStore.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            _this.drop(table, done);
        }).then(complete);
    };
    return SQLiteStore;
}());
exports.SQLiteStore = SQLiteStore;
