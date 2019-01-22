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
var redis = require("redis");
var noClient = "No Redis client!";
var Redis = /** @class */ (function () {
    function Redis(connectArgs, getClient) {
        this.connectArgs = connectArgs;
        this.getClient = getClient;
        this.plugin = {
            name: "Redis Adapter",
            version: 2.05
        };
        this.connectArgs = this.connectArgs || {};
        this._tableConfigs = {};
    }
    Redis.prototype.connect = function (id, complete, error) {
        var _this = this;
        this._db = redis.createClient(this.connectArgs);
        this._db.on("ready", function () {
            if (!_this._db) {
                error(noClient);
                return;
            }
            if (_this.getClient) {
                _this.getClient(_this._db);
            }
            complete();
        });
        this._db.on("error", error);
    };
    Redis.prototype.key = function (tableName, key) {
        return this._id + "." + tableName + "." + key;
    };
    Redis.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        complete();
    };
    Redis.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        if (!this._db) {
            error(noClient);
            return;
        }
        this._db.del(this.key("_ai_", table), function () {
            var ptr = "0";
            var getNextPage = function () {
                if (!_this._db) {
                    error(noClient);
                    return;
                }
                _this._db.zscan(_this.key("_index_", table), ptr, function (err, result) {
                    if (err) {
                        error(err);
                        return;
                    }
                    if (!result[1].length && result[0] !== "0") {
                        ptr = result[0];
                        getNextPage();
                        return;
                    }
                    var PKS = (result[1] || []).filter(function (v, i) { return i % 2 === 0; });
                    utilities_1.chainAsync(PKS, function (pk, i, next, err) {
                        if (!_this._db) {
                            error(noClient);
                            return;
                        }
                        // clear table contents
                        _this._db.del(_this.key(table, pk), function (delErr) {
                            if (delErr) {
                                err(delErr);
                                return;
                            }
                            next();
                        });
                    }).then(function () {
                        if (result[0] === "0") {
                            if (!_this._db) {
                                error(noClient);
                                return;
                            }
                            // done reading index, delete it
                            _this._db.del(_this.key("_index_", table), function (delErr) {
                                if (delErr) {
                                    error(delErr);
                                    return;
                                }
                                complete();
                            });
                        }
                        else {
                            ptr = result[0];
                            getNextPage();
                        }
                    }).catch(error);
                });
            };
            getNextPage();
        });
    };
    Redis.prototype.disconnect = function (complete, error) {
        var _this = this;
        if (!this._db) {
            error(noClient);
            return;
        }
        this._db.on("end", function () {
            _this._db = undefined;
            complete();
        });
        this._db.quit();
    };
    Redis.prototype.write = function (table, pk, row, complete, error) {
        var _this = this;
        new Promise(function (res, rej) {
            if (!_this._db) {
                error(noClient);
                return;
            }
            if (_this._tableConfigs[table].ai) {
                _this._db.get(_this.key("_ai_", table), function (err, result) {
                    if (err) {
                        rej(err);
                        return;
                    }
                    res(parseInt(result) || 0);
                });
            }
            else {
                res(0);
            }
        }).then(function (AI) {
            pk = pk || utilities_1.generateID(_this._tableConfigs[table].pkType, AI + 1);
            return new Promise(function (res, rej) {
                if (!_this._db) {
                    error(noClient);
                    return;
                }
                if (typeof pk === "undefined") {
                    rej(new Error("Can't add a row without a primary key!"));
                    return;
                }
                if (_this._tableConfigs[table].ai && pk > AI) { // need to increment ai to database
                    _this._db.incr(_this.key("_ai_", table), function (err, result) {
                        if (err) {
                            rej(err);
                            return;
                        }
                        res(result || 0);
                    });
                }
                else {
                    res(pk);
                }
            });
        }).then(function (primaryKey) {
            utilities_1.deepSet(_this._tableConfigs[table].pkCol, row, primaryKey);
            return utilities_1.allAsync(["_index_", "_table_"], function (item, i, next, err) {
                if (!_this._db) {
                    error(noClient);
                    return;
                }
                switch (item) {
                    case "_index_": // update index
                        _this._db.zadd(_this.key("_index_", table), _this._tableConfigs[table].isPkNum ? parseFloat(primaryKey) : 0, primaryKey, function (error) {
                            if (error) {
                                err(error);
                                return;
                            }
                            next(primaryKey);
                        });
                        break;
                    case "_table_": // update row value
                        _this._db.set(_this.key(table, String(primaryKey)), JSON.stringify(row), function (error) {
                            if (error) {
                                err(error);
                                return;
                            }
                            next(primaryKey);
                        });
                        break;
                }
            });
        }).then(function (result) {
            complete(result[0]);
        }).catch(error);
    };
    Redis.prototype.read = function (table, pk, complete, error) {
        if (!this._db) {
            error(noClient);
            return;
        }
        this._db.get(this.key(table, String(pk)), function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete(result ? JSON.parse(result) : undefined);
        });
    };
    Redis.prototype.readZIndex = function (table, type, offsetOrLow, limitOrHigh, reverse, complete, error) {
        if (!this._db) {
            error(noClient);
            return;
        }
        switch (type) {
            case "offset":
                if (reverse) {
                    this._db.zrevrange(this.key("_index_", table), offsetOrLow + 1, offsetOrLow + limitOrHigh, function (err, results) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                }
                else {
                    this._db.zrange(this.key("_index_", table), offsetOrLow, offsetOrLow + limitOrHigh - 1, function (err, results) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                }
                break;
            case "all":
                this.getTableIndex(table, function (index) {
                    if (reverse) {
                        complete(index.reverse());
                    }
                    else {
                        complete(index);
                    }
                }, error);
                break;
            case "range":
                if (this._tableConfigs[table].isPkNum) {
                    this._db.zrangebyscore(this.key("_index_", table), offsetOrLow, limitOrHigh, function (err, result) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(reverse ? result.reverse() : result);
                    });
                }
                else {
                    this._db.zrangebylex(this.key("_index_", table), "[" + offsetOrLow, "[" + limitOrHigh, function (err, result) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(reverse ? result.reverse() : result);
                    });
                }
                break;
        }
    };
    Redis.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var _this = this;
        this.readZIndex(table, type, offsetOrLow, limitOrHigh, reverse, function (primaryKeys) {
            var page = 0;
            // get the records in batches so we don't block redis
            var getPage = function () {
                if (!_this._db) {
                    error(noClient);
                    return;
                }
                var PKS = primaryKeys.slice((page * 100), (page * 100) + 100);
                if (!PKS.length) {
                    complete();
                    return;
                }
                _this._db.mget(PKS.map(function (pk) { return _this.key(table, pk); }), function (err, rows) {
                    if (err) {
                        error(err);
                        return;
                    }
                    rows.forEach(function (row, i) {
                        onRow(JSON.parse(row), i + (page * 500));
                    });
                    page++;
                    getPage();
                });
            };
            getPage();
        }, error);
    };
    Redis.prototype.delete = function (table, pk, complete, error) {
        var _this = this;
        utilities_1.allAsync(["_index_", "_table_"], function (item, i, next, err) {
            if (!_this._db) {
                error(noClient);
                return;
            }
            switch (item) {
                case "_index_": // update index
                    _this._db.zrem(_this.key("_index_", table), pk, function (error) {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                    break;
                case "_table_": // remove row value
                    _this._db.del(_this.key(table, String(pk)), function (error) {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                    break;
            }
        }).then(complete).catch(error);
    };
    Redis.prototype.maybeMapIndex = function (table, index) {
        if (this._tableConfigs[table].isPkNum)
            return index.map(function (i) { return parseFloat(i); });
        return index;
    };
    Redis.prototype.getTableIndex = function (table, complete, error) {
        var _this = this;
        var ptr = "0";
        var index = [];
        if (!this._db) {
            error(noClient);
            return;
        }
        var cb = function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete(_this.maybeMapIndex(table, result));
        };
        this._db.zrangebyscore(this.key("_index_", table), "-inf", "+inf", cb);
    };
    Redis.prototype.getTableIndexLength = function (table, complete, error) {
        var count = 0;
        if (!this._db) {
            error(noClient);
            return;
        }
        this._db.zcount(this.key("_index_", table), "-inf", "+inf", function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete(result);
        });
    };
    Redis.prototype.createIndex = function (tableId, index, type, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.createTable(indexName, __assign({}, utilities_1.blankTableDefinition, { pkType: type, pkCol: ["id"], isPkNum: ["float", "int", "number"].indexOf(type) !== -1 }), function () {
            complete();
        }, error);
    };
    Redis.prototype.deleteIndex = function (tableId, index, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.dropTable(indexName, complete, error);
    };
    Redis.prototype.addIndexValue = function (tableId, index, rowID, indexKey, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        if (!this._db) {
            error(noClient);
            return;
        }
        return utilities_1.allAsync(["_index_", "_table_"], function (item, i, next, err) {
            if (!_this._db) {
                error(noClient);
                return;
            }
            switch (item) {
                case "_index_": // update index
                    _this._db.zadd(_this.key("_index_", indexName), _this._tableConfigs[indexName].isPkNum ? parseFloat(indexKey) : 0, indexKey, function (error) {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                    break;
                case "_table_": // update row value
                    var isNum = typeof rowID === "number";
                    _this._db.zadd(_this.key(indexName, indexKey), 0, (isNum ? "num:" : "") + rowID, function (error, result) {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                    break;
            }
        }).then(complete).catch(error);
    };
    Redis.prototype.deleteIndexValue = function (tableId, index, rowID, indexKey, complete, error) {
        if (!this._db) {
            error(noClient);
            return;
        }
        var indexName = "_idx_" + tableId + "_" + index;
        var isNum = typeof rowID === "number";
        this._db.zrem(this.key(indexName, indexKey), (isNum ? "num:" : "") + rowID, function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete();
        });
    };
    Redis.prototype.readIndexKey = function (tableId, index, indexKey, onRowPK, complete, error) {
        if (!this._db) {
            error(noClient);
            return;
        }
        var indexName = "_idx_" + tableId + "_" + index;
        this._db.zrangebylex(this.key(indexName, indexKey), "-", "+", function (err, result) {
            if (err) {
                error(err);
                return;
            }
            if (!result) {
                complete();
                return;
            }
            result.forEach(function (value, i) {
                onRowPK(value.indexOf("num:") === 0 ? parseFloat(value.replace("num:", "")) : value);
            });
            complete();
        });
    };
    Redis.prototype.readIndexKeys = function (tableId, index, type, offsetOrLow, limitOrHigh, reverse, onRowPK, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        this.readZIndex(indexName, type, offsetOrLow, limitOrHigh, reverse, function (primaryKeys) {
            var page = 0;
            if (!_this._db) {
                error(noClient);
                return;
            }
            utilities_1.chainAsync(primaryKeys, function (indexKey, i, pkNext, pkErr) {
                if (!_this._db) {
                    error(noClient);
                    return;
                }
                _this._db.zrangebylex(_this.key(indexName, indexKey), "-", "+", function (err, result) {
                    if (err) {
                        error(err);
                        return;
                    }
                    if (!result) {
                        pkNext();
                        return;
                    }
                    result.forEach(function (value, i) {
                        onRowPK(value.indexOf("num:") === 0 ? parseFloat(value.replace("num:", "")) : value, i);
                    });
                    pkNext();
                });
            }).then(function () {
                complete();
            });
        }, error);
    };
    return Redis;
}());
exports.Redis = Redis;
//# sourceMappingURL=index.js.map