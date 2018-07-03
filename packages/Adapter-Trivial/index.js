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
var db_idx_1 = require("nano-sql/lib/database/db-idx");
var trivialdb = require('trivialdb');
var lie_ts_1 = require("lie-ts");
;
var TrivialAdapter = (function () {
    function TrivialAdapter(nameSpaceOpts, dbOpts) {
        this.nameSpaceOpts = nameSpaceOpts;
        this.dbOpts = dbOpts;
        this._pkKey = {};
        this._dbIndex = {};
    }
    TrivialAdapter.prototype.setID = function (id) {
        this._id = id;
        this._dbs = {};
    };
    TrivialAdapter.prototype.connect = function (complete) {
        var _this = this;
        this.ns = trivialdb.ns(this._id, this.nameSpaceOpts);
        utilities_1.fastCHAIN(Object.keys(this._dbIndex), function (tableName, i, next) {
            _this._dbs[tableName] = _this.ns.db(tableName, __assign({ pk: _this._pkKey[tableName] }, _this.dbOpts));
            _this._dbs[tableName].loading.then(function () {
                _this._dbs[tableName].filter(function (val, key) {
                    _this._dbIndex[tableName].add(key);
                    return false;
                });
                next();
            }).catch(function (err) {
                throw new Error(err);
            });
        }).then(complete);
    };
    TrivialAdapter.prototype.makeTable = function (tableName, dataModels) {
        var _this = this;
        this._dbIndex[tableName] = new db_idx_1.DatabaseIndex();
        dataModels.forEach(function (d) {
            if (d.props && utilities_1.intersect(["pk", "pk()"], d.props)) {
                _this._dbIndex[tableName].pkType = d.type;
                _this._pkKey[tableName] = d.key;
                if (d.props && utilities_1.intersect(["ai", "ai()"], d.props) && (d.type === "int" || d.type === "number")) {
                    _this._dbIndex[tableName].doAI = true;
                }
            }
        });
    };
    TrivialAdapter.prototype.write = function (table, pk, newData, complete) {
        pk = pk || utilities_1.generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai);
        if (!pk) {
            throw new Error("nSQL: Can't add a row without a primary key!");
        }
        if (this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
        }
        var r = __assign({}, newData, (_a = {}, _a[this._pkKey[table]] = pk, _a));
        this._dbs[table].save(pk, r).then(function () {
            complete(r);
        }).catch(function (err) {
            throw new Error(err);
        });
        var _a;
    };
    TrivialAdapter.prototype.delete = function (table, pk, complete) {
        var idx = this._dbIndex[table].indexOf(pk);
        if (idx !== -1) {
            this._dbIndex[table].remove(pk);
        }
        this._dbs[table].remove((_a = {}, _a[this._pkKey[table]] = pk, _a)).then(function (removedIds) {
            complete();
        }).catch(function (err) {
            throw new Error(err);
        });
        var _a;
    };
    TrivialAdapter.prototype.read = function (table, pk, callback) {
        this._dbs[table].load(pk).then(callback).catch(function (err) {
            callback(undefined);
        });
    };
    TrivialAdapter.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
        var _this = this;
        var keys = this._dbIndex[table].keys();
        var usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        var ranges = usefulValues ? [from, to] : [0, keys.length - 1];
        if (!keys.length) {
            complete();
            return;
        }
        if (this._dbIndex[table].sortIndex === false) {
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
            i % 500 === 0 ? lie_ts_1.setFast(getRow) : getRow();
        };
        var getRow = function () {
            if (idx <= ranges[1]) {
                _this._dbs[table].load(keys[idx]).then(function (row) {
                    rowCallback(row, idx, rowDone);
                }).catch(function (err) {
                    throw new Error(err);
                });
            }
            else {
                complete();
            }
        };
        getRow();
    };
    TrivialAdapter.prototype.drop = function (table, callback) {
        var _this = this;
        this._dbs[table].clear().then(function () {
            var idx = new db_idx_1.DatabaseIndex();
            idx.doAI = _this._dbIndex[table].doAI;
            idx.sortIndex = _this._dbIndex[table].sortIndex;
            _this._dbIndex[table] = idx;
            callback();
        }).catch(function (err) {
            throw new Error(err);
        });
    };
    TrivialAdapter.prototype.getIndex = function (table, getLength, complete) {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    };
    TrivialAdapter.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            _this.drop(table, done);
        }).then(complete);
    };
    return TrivialAdapter;
}());
exports.TrivialAdapter = TrivialAdapter;
