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
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("@nano-sql/core/lib/utilities");
var memoryIndex_1 = require("@nano-sql/core/lib/adapters/memoryIndex");
var react_native_1 = require("react-native");
exports.binaryInsert = function (arr, value, remove, startVal, endVal) {
    var start = startVal || 0;
    var end = endVal || arr.length;
    if (arr[start] >= value) {
        if (!remove)
            arr.unshift(value);
        return remove ? false : true;
    }
    if (arr[end] <= value) {
        if (!remove)
            arr.push(value);
        return remove ? false : true;
    }
    var m = Math.floor((start + end) / 2);
    if (value == arr[m]) { // already in array
        if (remove)
            arr.splice(m, 1);
        return remove ? true : false;
    }
    if (end - 1 == start) {
        if (!remove)
            arr.splice(end, 0, value);
        return remove ? false : true;
    }
    if (value > arr[m])
        return exports.binaryInsert(arr, value, remove, m, end);
    if (value < arr[m])
        return exports.binaryInsert(arr, value, remove, start, m);
    if (!remove)
        arr.splice(end, 0, value);
    return remove ? false : true;
};
var NativeStorage = /** @class */ (function (_super) {
    __extends(NativeStorage, _super);
    function NativeStorage(cacheIndexes) {
        var _this = _super.call(this, false, false) || this;
        _this.cacheIndexes = cacheIndexes;
        _this.plugin = {
            name: "React Native Adapter",
            version: 2.04
        };
        _this._tableConfigs = {};
        return _this;
    }
    NativeStorage.prototype.connect = function (id, complete, error) {
        this._id = id;
        this._indexes = {};
        this._ai = {};
        complete();
    };
    NativeStorage.prototype.key = function (table, pk) {
        return this._id + "_" + table + "_" + String(pk);
    };
    NativeStorage.prototype.getIndex = function (table) {
        var _this = this;
        return new Promise(function (res, rej) {
            if (_this._indexes[table]) {
                res(_this._indexes[table]);
                return;
            }
            react_native_1.AsyncStorage.getItem(_this.key(table, "__IDX__"), function (err, result) {
                if (err) {
                    rej(err);
                    return;
                }
                if (_this.cacheIndexes) {
                    _this._indexes[table] = JSON.parse(result || "[]");
                    res(_this._indexes[table]);
                }
                else {
                    res(JSON.parse(result || "[]"));
                }
            });
        });
    };
    NativeStorage.prototype.createTable = function (tableName, tableData, complete, error) {
        var _this = this;
        this._tableConfigs[tableName] = tableData;
        react_native_1.AsyncStorage.getItem(this.key(tableName, "__IDX__"), function (err, result) {
            if (err) {
                error(err);
                return;
            }
            if (result) {
                react_native_1.AsyncStorage.getItem(_this.key(tableName, "__AI__"), function (err, ai) {
                    if (err) {
                        error(err);
                        return;
                    }
                    _this._ai[tableName] = ai ? parseInt(ai) : 0;
                    complete();
                });
            }
            else {
                _this._ai[tableName] = 0;
                react_native_1.AsyncStorage.setItem(_this.key(tableName, "__IDX__"), "[]", function (err) {
                    if (err) {
                        error(err);
                        return;
                    }
                    react_native_1.AsyncStorage.setItem(_this.key(tableName, "__AI__"), "0", function (err) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete();
                    });
                });
            }
        });
    };
    NativeStorage.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        this.getIndex(table).then(function (pks) {
            react_native_1.AsyncStorage.multiRemove(pks.map(function (s) { return _this.key(table, s); }), function (err) {
                if (err) {
                    error(err);
                    return;
                }
                react_native_1.AsyncStorage.removeItem(_this.key(table, "__IDX__"), function (err) {
                    if (err) {
                        error(err);
                        return;
                    }
                    react_native_1.AsyncStorage.removeItem(_this.key(table, "__AI__"), function (err) {
                        if (err) {
                            error(err);
                            return;
                        }
                        delete _this._indexes[table];
                        _this._ai[table] = 0;
                        complete();
                    });
                });
            });
        });
    };
    NativeStorage.prototype.disconnect = function (complete, error) {
        complete();
    };
    NativeStorage.prototype.write = function (table, pk, row, complete, error) {
        var _this = this;
        pk = pk || utilities_1.generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);
        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }
        if (this._tableConfigs[table].ai) {
            this._ai[table] = Math.max(pk, this._ai[table]);
        }
        var json = JSON.stringify(utilities_1.deepSet(this._tableConfigs[table].pkCol, row, pk));
        this.getIndex(table).then(function (index) {
            var didUpdate = exports.binaryInsert(index, pk, false);
            return utilities_1.allAsync([0, 1, 2], function (idx, i, next, err) {
                switch (idx) {
                    case 0:
                        react_native_1.AsyncStorage.setItem(_this.key(table, pk), json, function (queryError) {
                            if (queryError) {
                                error(queryError);
                                return;
                            }
                            next();
                        });
                        break;
                    case 1:
                        if (didUpdate) {
                            react_native_1.AsyncStorage.setItem(_this.key(table, "__IDX__"), JSON.stringify(index), function (queryError) {
                                if (queryError) {
                                    err(queryError);
                                    return;
                                }
                                next();
                            });
                        }
                        else {
                            next();
                        }
                        break;
                    case 2:
                        if (_this._tableConfigs[table].ai) {
                            react_native_1.AsyncStorage.setItem(_this.key(table, "__AI__"), String(_this._ai[table]), function (queryError) {
                                if (queryError) {
                                    err(queryError);
                                    return;
                                }
                                next();
                            });
                        }
                        else {
                            next();
                        }
                        break;
                }
            });
        }).then(function () {
            complete(pk);
        }).catch(error);
    };
    NativeStorage.prototype.read = function (table, pk, complete, error) {
        react_native_1.AsyncStorage.getItem(this.key(table, pk), function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete(result ? JSON.parse(result) : undefined);
        });
    };
    NativeStorage.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var _this = this;
        var range = {
            "range": [offsetOrLow, limitOrHigh],
            "offset": [offsetOrLow, offsetOrLow + limitOrHigh],
            "all": []
        }[type];
        this.getIndex(table).then(function (index) {
            return new Promise(function (res, rej) {
                switch (type) {
                    case "all":
                        res(index.slice());
                        break;
                    case "offset":
                        var l = index.length - 1;
                        res(reverse ? index.slice(l - range[1], l - range[0]) : index.slice(range[0], range[1]));
                        break;
                    case "range":
                        var lowIdx = utilities_1.binarySearch(index, range[0], false);
                        var highIdx = utilities_1.binarySearch(index, range[1], false);
                        while (index[highIdx] > range[1]) {
                            highIdx--;
                        }
                        while (index[lowIdx] < range[0]) {
                            lowIdx++;
                        }
                        res(index.slice(lowIdx, highIdx + 1));
                        break;
                    default:
                        res([]);
                }
            });
        }).then(function (getPKs) {
            return utilities_1.chainAsync(reverse ? getPKs.reverse() : getPKs, function (pk, i, next, err) {
                _this.read(table, pk, function (row) {
                    onRow(row || {}, i);
                    next();
                }, err);
            });
        }).then(function () {
            complete();
        }).catch(error);
    };
    NativeStorage.prototype.delete = function (table, pk, complete, error) {
        var _this = this;
        this.getIndex(table).then(function (index) {
            var didUpdate = exports.binaryInsert(index, pk, true);
            utilities_1.allAsync([0, 1], function (item, i, next, err) {
                switch (item) {
                    case 0:
                        if (didUpdate) {
                            react_native_1.AsyncStorage.setItem(_this.key(table, "__IDX__"), JSON.stringify(index), function (queryError) {
                                if (queryError) {
                                    err(queryError);
                                    return;
                                }
                                next();
                            });
                        }
                        else {
                            next();
                        }
                        break;
                    case 1:
                        react_native_1.AsyncStorage.removeItem(_this.key(table, pk), function (queryError) {
                            if (queryError) {
                                err(queryError);
                                return;
                            }
                            next();
                        });
                        break;
                }
            }).then(function () {
                complete();
            }).catch(error);
        }).catch(error);
    };
    NativeStorage.prototype.getTableIndex = function (table, complete, error) {
        this.getIndex(table).then(complete).catch(error);
    };
    NativeStorage.prototype.getTableIndexLength = function (table, complete, error) {
        this.getIndex(table).then(function (index) {
            complete(index.length);
        }).catch(error);
    };
    return NativeStorage;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.NativeStorage = NativeStorage;
//# sourceMappingURL=index.js.map