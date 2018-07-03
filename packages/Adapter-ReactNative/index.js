var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("nano-sql/lib/utilities");
var react_native_1 = require("react-native");
var db_idx_1 = require("nano-sql/lib/database/db-idx");
var ReactNativeAdapter = (function () {
    function ReactNativeAdapter() {
        this._pkKey = {};
        this._writeIdx = {};
        this._dbIndex = {};
    }
    ReactNativeAdapter.prototype.setID = function (id) {
        this._id = id;
    };
    ReactNativeAdapter.prototype.key = function (table, id) {
        return this._id + "::" + table + "::" + String(id);
    };
    ReactNativeAdapter.prototype.connect = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            react_native_1.AsyncStorage.getItem(_this.key(table, "_idx_")).then(function (result) {
                _this._dbIndex[table].set(JSON.parse(result || "[]") || []);
                done();
            }).catch(function (err) {
                throw err;
            });
        }).then(complete);
    };
    ReactNativeAdapter.prototype.makeTable = function (tableName, dataModels) {
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
    ReactNativeAdapter.prototype.writeIndex = function (table) {
        var _this = this;
        if (this._writeIdx[table]) {
            clearTimeout(this._writeIdx[table]);
        }
        this._writeIdx[table] = setTimeout(function () {
            react_native_1.AsyncStorage.setItem(_this.key(table, "_idx_"), JSON.stringify(_this._dbIndex[table].keys()));
        }, 1000);
    };
    ReactNativeAdapter.prototype.write = function (table, pk, newData, complete) {
        pk = pk || utilities_1.generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai);
        if (!pk) {
            throw new Error("Can't add a row without a primary key!");
        }
        if (this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
            this.writeIndex(table);
        }
        var row = __assign({}, newData, (_a = {}, _a[this._pkKey[table]] = pk, _a));
        react_native_1.AsyncStorage.setItem(this.key(table, pk), JSON.stringify(row)).then(function () {
            complete(row);
        }).catch(function (err) {
            throw err;
        });
        var _a;
    };
    ReactNativeAdapter.prototype.delete = function (table, pk, complete) {
        var _this = this;
        react_native_1.AsyncStorage.removeItem(this.key(table, pk)).then(function () {
            _this._dbIndex[table].remove(pk);
            _this.writeIndex(table);
            complete();
        }).catch(function (err) {
            throw err;
        });
    };
    ReactNativeAdapter.prototype.batchRead = function (table, pks, callback) {
        var _this = this;
        react_native_1.AsyncStorage.multiGet(pks.map(function (pk) { return _this.key(table, pk); })).then(function (rows) {
            callback(rows.map(function (r) { return JSON.parse(r[1]); }));
        }).catch(function (err) {
            throw err;
        });
    };
    ReactNativeAdapter.prototype.read = function (table, pk, callback) {
        react_native_1.AsyncStorage.getItem(this.key(table, pk)).then(function (row) {
            callback(JSON.parse(row));
        }).catch(function (err) {
            throw err;
        });
    };
    ReactNativeAdapter.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
        var _this = this;
        var keys = this._dbIndex[table].keys();
        var usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        var ranges = usefulValues ? [from, to] : [0, keys.length - 1];
        if (!keys.length) {
            complete();
            return;
        }
        var pks = [];
        if (usePK && usefulValues) {
            if (this._dbIndex[table].sortIndex) {
                ranges = ranges.map(function (r) { return _this._dbIndex[table].getLocation(r); });
            }
            else {
                keys.sort().forEach(function (key) {
                    if (key >= ranges[0] && key <= ranges[1]) {
                        pks.push(key);
                    }
                });
            }
        }
        else {
            var idx = ranges[0];
            if (!this._dbIndex[table].sortIndex) {
                keys = keys.sort();
            }
            while (idx <= ranges[1]) {
                pks.push(keys[idx]);
                idx++;
            }
        }
        react_native_1.AsyncStorage.multiGet(pks.map(function (pk) { return _this.key(table, pk); })).then(function (rows) {
            utilities_1.fastCHAIN(rows.map(function (r) { return JSON.parse(r[1]); }), function (row, i, next) {
                rowCallback(row, i, next);
            }).then(complete);
        });
    };
    ReactNativeAdapter.prototype.drop = function (table, callback) {
        var _this = this;
        react_native_1.AsyncStorage.multiRemove(this._dbIndex[table].keys().map(function (k) { return _this.key(table, k); })).then(function () {
            var idx = new db_idx_1.DatabaseIndex();
            idx.doAI = _this._dbIndex[table].doAI;
            _this._dbIndex[table] = idx;
            _this.writeIndex(table);
            callback();
        }).catch(function (err) {
            throw err;
        });
    };
    ReactNativeAdapter.prototype.getIndex = function (table, getLength, complete) {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    };
    ReactNativeAdapter.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            _this.drop(table, done);
        }).then(complete);
    };
    ReactNativeAdapter.prototype.setNSQL = function (nsql) {
    };
    return ReactNativeAdapter;
}());
exports.ReactNativeAdapter = ReactNativeAdapter;
