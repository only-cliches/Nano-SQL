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
/**
 * Handles WebSQL persistent storage
 *
 * @export
 * @class _SyncStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
var _WebSQLStore = /** @class */ (function () {
    function _WebSQLStore(size) {
        this._pkKey = {};
        this._dbIndex = {};
        this._size = (size || 0) * 1000 * 1000;
    }
    _WebSQLStore.prototype.setID = function (id) {
        this._id = id;
    };
    _WebSQLStore.prototype.connect = function (complete) {
        var _this = this;
        this._db = window.openDatabase(this._id, "1.0", this._id, this._size || utilities_1.isAndroid ? 5000000 : 1);
        utilities_1.fastALL(Object.keys(this._pkKey), function (table, i, nextKey) {
            _this._sql(true, "CREATE TABLE IF NOT EXISTS " + table + " (id BLOB PRIMARY KEY UNIQUE, data TEXT)", [], function () {
                _this._sql(false, "SELECT id FROM " + table, [], function (result) {
                    var idx = [];
                    for (var i_1 = 0; i_1 < result.rows.length; i_1++) {
                        idx.push(result.rows.item(i_1).id);
                    }
                    // SQLite doesn't sort primary keys, but the system depends on sorted primary keys
                    if (_this._dbIndex[table].sortIndex) {
                        idx = idx.sort(function (a, b) { return a > b ? 1 : -1; });
                    }
                    _this._dbIndex[table].set(idx);
                    nextKey();
                });
            });
        }).then(complete);
    };
    /**
     * Table names can't be escaped easily in the queries.
     * This function gaurantees any provided table is a valid table name being used by the system.
     *
     * @private
     * @param {string} table
     * @returns {string}
     * @memberof _WebSQLStore
     */
    _WebSQLStore.prototype._chkTable = function (table) {
        if (Object.keys(this._dbIndex).indexOf(table) === -1) {
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
    _WebSQLStore.prototype.write = function (table, pk, data, complete, error) {
        pk = pk || utilities_1.generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai);
        if (!pk) {
            error(new Error("nSQL: Can't add a row without a primary key!"));
            return;
        }
        var newRow = false;
        if (!this._dbIndex[table].exists(pk)) {
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
    _WebSQLStore.prototype.batchRead = function (table, pks, callback) {
        this._sql(false, "SELECT data from " + this._chkTable(table) + " WHERE id IN (" + pks.map(function (p) { return "?"; }).join(", ") + ") ORDER BY id", pks, function (result) {
            var i = result.rows.length;
            var rows = [];
            while (i--) {
                rows.unshift(JSON.parse(result.rows.item(i).data));
            }
            callback(rows);
        });
    };
    _WebSQLStore.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
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
        // SQLite doesn't handle BETWEEN statements gracefully with primary keys, always doing a full table scan.
        // So we take the index of the table (which is in js memory) and convert it into an IN statement meaning SQLite
        // can go directly to the rows we need without a full table scan.
        if (ranges.length) {
            var t = typeof keys[startIDX] === "number";
            while (startIDX <= ranges[1]) {
                getKeys.push(keys[startIDX]);
                startIDX++;
            }
            stmnt += " WHERE id IN (" + getKeys.map(function (k) { return "?"; }).join(", ") + ")";
        }
        stmnt += " ORDER BY id";
        this._sql(false, stmnt, getKeys, function (result) {
            var i = 0;
            var getRow = function () {
                if (result.rows.length > i) {
                    rowCallback(JSON.parse(result.rows.item(i).data), idx, function () {
                        idx++;
                        i++;
                        i % 500 === 0 ? lie_ts_1.setFast(getRow) : getRow(); // handle maximum call stack error
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
        this._dbIndex[table] = this._dbIndex[table].clone();
        this._sql(true, "DELETE FROM " + this._chkTable(table), [], function (rows) {
            callback();
        });
    };
    _WebSQLStore.prototype.getIndex = function (table, getLength, complete) {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    };
    _WebSQLStore.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            _this.drop(table, done);
        }).then(complete);
    };
    _WebSQLStore.prototype.setNSQL = function (nSQL) {
        db_idx_1.syncPeerIndex(nSQL, this._dbIndex);
    };
    return _WebSQLStore;
}());
exports._WebSQLStore = _WebSQLStore;
//# sourceMappingURL=adapter-websql.js.map