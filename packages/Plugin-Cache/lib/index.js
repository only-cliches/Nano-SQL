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
exports.RedisIndex = function (connectArgs, getClient) {
    var _db;
    var _tableConfigs = {};
    var id;
    var key = function (tableName, key) {
        return id + "." + tableName + "." + key;
    };
    var maybeMapIndex = function (table, index) {
        if (_tableConfigs[table].isPkNum)
            return index.map(function (i) { return parseFloat(i); });
        return index;
    };
    var getTableIndex = function (table, complete, error) {
        _db.zrangebyscore(key("_index_", table), "-inf", "+inf", function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete(maybeMapIndex(table, result));
        });
    };
    var readZIndex = function (table, type, offsetOrLow, limitOrHigh, reverse, complete, error) {
        switch (type) {
            case "offset":
                if (reverse) {
                    _db.zrevrange(key("_index_", table), offsetOrLow + 1, offsetOrLow + limitOrHigh, function (err, results) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                }
                else {
                    _db.zrange(key("_index_", table), offsetOrLow, offsetOrLow + limitOrHigh - 1, function (err, results) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                }
                break;
            case "all":
                getTableIndex(table, function (index) {
                    if (reverse) {
                        complete(index.reverse());
                    }
                    else {
                        complete(index);
                    }
                }, error);
                break;
            case "range":
                if (_tableConfigs[table].isPkNum) {
                    _db.zrangebyscore(key("_index_", table), offsetOrLow, limitOrHigh, function (err, result) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(reverse ? result.reverse() : result);
                    });
                }
                else {
                    _db.zrangebylex(key("_index_", table), "[" + offsetOrLow, "[" + limitOrHigh, function (err, result) {
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
    return {
        name: "Redis Index",
        version: 2.00,
        filters: [
            {
                name: "adapterConnect",
                priority: 1000,
                call: function (inputArgs, complete, cancel) {
                    id = inputArgs.res.id;
                    _db = redis.createClient(connectArgs);
                    _db.on("ready", function () {
                        if (getClient) {
                            getClient(_db);
                        }
                        complete(inputArgs);
                    });
                    _db.on("error", cancel);
                }
            },
            {
                name: "adapterCreateIndex",
                priority: 1000,
                call: function (inputArgs, complete, cancel) {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    var indexName = "_idx_" + inputArgs.res.table + "_" + inputArgs.res.indexName;
                    _tableConfigs[indexName] = __assign({}, utilities_1.blankTableDefinition, { pkType: inputArgs.res.type, pkCol: ["id"], isPkNum: ["float", "int", "number"].indexOf(inputArgs.res.type) !== -1 });
                    inputArgs.res.complete();
                }
            },
            {
                name: "adapterDeleteIndex",
                priority: 1000,
                call: function (inputArgs, complete, cancel) {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    var indexName = "_idx_" + inputArgs.res.table + "_" + inputArgs.res.indexName;
                    var ptr = "0";
                    var getNextPage = function () {
                        _db.zscan(key("_index_", indexName), ptr, function (err, result) {
                            if (err) {
                                inputArgs.res.error(err);
                                return;
                            }
                            if (!result[1].length && result[0] !== "0") {
                                ptr = result[0];
                                getNextPage();
                                return;
                            }
                            var PKS = (result[1] || []).filter(function (v, i) { return i % 2 === 0; });
                            utilities_1.chainAsync(PKS, function (pk, i, next, err) {
                                // clear table contents
                                _db.del(key(indexName, pk), function (delErr) {
                                    if (delErr) {
                                        err(delErr);
                                        return;
                                    }
                                    next();
                                });
                            }).then(function () {
                                if (result[0] === "0") {
                                    // done reading index, delete it
                                    _db.del(key("_index_", indexName), function (delErr) {
                                        if (delErr) {
                                            inputArgs.res.error(delErr);
                                            return;
                                        }
                                        inputArgs.res.complete();
                                    });
                                }
                                else {
                                    ptr = result[0];
                                    getNextPage();
                                }
                            }).catch(inputArgs.res.error);
                        });
                    };
                    getNextPage();
                }
            },
            {
                name: "adapterAddIndexValue",
                priority: 1000,
                call: function (inputArgs, complete, cancel) {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    var indexName = "_idx_" + inputArgs.res.table + "_" + inputArgs.res.indexName;
                    // key = rowID
                    // value = indexKey
                    return utilities_1.allAsync(["_index_", "_table_"], function (item, i, next, err) {
                        switch (item) {
                            case "_index_": // update index
                                _db.zadd(key("_index_", indexName), _tableConfigs[indexName].isPkNum ? parseFloat(inputArgs.res.value) : 0, inputArgs.res.value, function (error) {
                                    if (error) {
                                        err(error);
                                        return;
                                    }
                                    next();
                                });
                                break;
                            case "_table_": // update row value
                                var rowID = inputArgs.res.key;
                                var isNum = typeof rowID === "number";
                                _db.zadd(key(indexName, inputArgs.res.value), 0, (isNum ? "num:" : "") + rowID, function (error, result) {
                                    if (error) {
                                        err(error);
                                        return;
                                    }
                                    next();
                                });
                                break;
                        }
                    }).then(inputArgs.res.complete).catch(inputArgs.res.error);
                }
            },
            {
                name: "adapterDeleteIndexValue",
                priority: 1000,
                call: function (inputArgs, complete, cancel) {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    var indexName = "_idx_" + inputArgs.res.table + "_" + inputArgs.res.indexName;
                    // key = rowID
                    // value = indexKey
                    var rowID = inputArgs.res.key;
                    var isNum = typeof rowID === "number";
                    _db.zrem(key(indexName, inputArgs.res.value), (isNum ? "num:" : "") + rowID, function (err, result) {
                        if (err) {
                            inputArgs.res.error(err);
                            return;
                        }
                        inputArgs.res.complete();
                    });
                }
            },
            {
                name: "adapterReadIndexKey",
                priority: 1000,
                call: function (inputArgs, complete, cancel) {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    var indexName = "_idx_" + inputArgs.res.table + "_" + inputArgs.res.indexName;
                    _db.zrangebylex(key(indexName, inputArgs.res.pk), "-", "+", function (err, result) {
                        if (err) {
                            inputArgs.res.error(err);
                            return;
                        }
                        if (!result) {
                            inputArgs.res.complete();
                            return;
                        }
                        result.forEach(function (value, i) {
                            inputArgs.res.onRowPK(value.indexOf("num:") === 0 ? parseFloat(value.replace("num:", "")) : value);
                        });
                        inputArgs.res.complete();
                    });
                }
            },
            {
                name: "adapterReadIndexKeys",
                priority: 1000,
                call: function (inputArgs, complete, cancel) {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    var indexName = "_idx_" + inputArgs.res.table + "_" + inputArgs.res.indexName;
                    readZIndex(indexName, inputArgs.res.type, inputArgs.res.offsetOrLow, inputArgs.res.limitOrHigh, inputArgs.res.reverse, function (primaryKeys) {
                        utilities_1.chainAsync(primaryKeys, function (indexKey, i, pkNext, pkErr) {
                            _db.zrangebylex(key(indexName, indexKey), "-", "+", function (err, result) {
                                if (err) {
                                    inputArgs.res.error(err);
                                    return;
                                }
                                if (!result) {
                                    pkNext();
                                    return;
                                }
                                result.forEach(function (value, i) {
                                    inputArgs.res.onRowPK(value.indexOf("num:") === 0 ? parseFloat(value.replace("num:", "")) : value, i);
                                });
                                pkNext();
                            });
                        }).then(function () {
                            inputArgs.res.complete();
                        });
                    }, inputArgs.res.error);
                }
            }
        ]
    };
};
//# sourceMappingURL=index.js.map