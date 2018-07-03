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
 * Handles all available syncronous versions of storage (memory and localstorage)
 *
 * @export
 * @class _SyncStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
var _SyncStore = /** @class */ (function () {
    function _SyncStore(useLocalStorage) {
        this._pkKey = {};
        this._rows = {};
        this._dbIndex = {};
        this._ls = useLocalStorage || false;
    }
    _SyncStore.prototype.connect = function (complete) {
        complete();
    };
    _SyncStore.prototype.setID = function (id) {
        this._id = id;
    };
    _SyncStore.prototype.makeTable = function (tableName, dataModels) {
        var _this = this;
        this._rows[tableName] = {};
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
                if (_this._ls) {
                    var index = localStorage.getItem(_this._id + "*" + tableName + "_idx");
                    if (index) {
                        _this._dbIndex[tableName].set(JSON.parse(index));
                    }
                }
            }
        });
    };
    _SyncStore.prototype.write = function (table, pk, data, complete, error) {
        pk = pk || utilities_1.generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai);
        if (!pk) {
            error(new Error("nSQL: Can't add a row without a primary key!"));
            return;
        }
        if (this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
            if (this._ls) {
                localStorage.setItem(this._id + "*" + table + "_idx", JSON.stringify(this._dbIndex[table].keys()));
            }
        }
        if (this._ls) {
            var r = __assign({}, data, (_a = {}, _a[this._pkKey[table]] = pk, _a));
            localStorage.setItem(this._id + "*" + table + "__" + pk, JSON.stringify(r));
            complete(r);
        }
        else {
            var r = __assign({}, data, (_b = {}, _b[this._pkKey[table]] = pk, _b));
            this._rows[table][pk] = utilities_1.deepFreeze(r);
            complete(r);
        }
        var _a, _b;
    };
    _SyncStore.prototype.delete = function (table, pk, complete) {
        var idx = this._dbIndex[table].indexOf(pk);
        if (idx !== -1) {
            this._dbIndex[table].remove(pk);
            if (this._ls) {
                localStorage.setItem(this._id + "*" + table + "_idx", JSON.stringify(this._dbIndex[table].keys()));
            }
        }
        if (this._ls) {
            localStorage.removeItem(this._id + "*" + table + "__" + pk);
        }
        else {
            delete this._rows[table][pk];
        }
        complete();
    };
    _SyncStore.prototype.read = function (table, pk, callback) {
        if (this._ls) {
            var r = localStorage.getItem(this._id + "*" + table + "__" + pk);
            callback(r ? JSON.parse(r) : undefined);
        }
        else {
            callback(this._rows[table][pk]);
        }
    };
    _SyncStore.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
        var _this = this;
        var keys = this._dbIndex[table].keys();
        var usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        var ranges = usefulValues ? [from, to] : [0, keys.length - 1];
        if (!keys.length) {
            complete();
            return;
        }
        if (!(usePK && usefulValues) && this._dbIndex[table].sortIndex === false) {
            keys = keys.sort();
        }
        if (usePK && usefulValues) {
            ranges = ranges.map(function (r) {
                var idxOf = _this._dbIndex[table].indexOf(r);
                return idxOf !== -1 ? idxOf : _this._dbIndex[table].getLocation(r);
            });
        }
        var idx = ranges[0];
        var i = 0;
        var rowDone = function () {
            idx++;
            i++;
            i % 500 === 0 ? lie_ts_1.setFast(getRow) : getRow(); // handle maximum call stack error
        };
        var getRow = function () {
            if (idx <= ranges[1]) {
                if (_this._ls) {
                    var r = localStorage.getItem(_this._id + "*" + table + "__" + keys[idx]);
                    rowCallback(r ? JSON.parse(r) : undefined, idx, rowDone);
                }
                else {
                    rowCallback(_this._rows[table][keys[idx]], idx, rowDone);
                }
            }
            else {
                complete();
            }
        };
        getRow();
    };
    _SyncStore.prototype.drop = function (table, callback) {
        var _this = this;
        if (this._ls) {
            localStorage.setItem(this._id + "*" + table + "_idx", JSON.stringify([]));
            this._dbIndex[table].keys().forEach(function (key) {
                localStorage.removeItem(_this._id + "*" + table + "__" + key);
            });
        }
        else {
            this._rows[table] = {};
        }
        this._dbIndex[table] = this._dbIndex[table].clone();
        callback();
    };
    _SyncStore.prototype.getIndex = function (table, getLength, complete) {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    };
    _SyncStore.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            _this.drop(table, done);
        }).then(complete);
    };
    _SyncStore.prototype.setNSQL = function (nSQL) {
        db_idx_1.syncPeerIndex(nSQL, this._dbIndex);
    };
    return _SyncStore;
}());
exports._SyncStore = _SyncStore;
//# sourceMappingURL=adapter-sync.js.map