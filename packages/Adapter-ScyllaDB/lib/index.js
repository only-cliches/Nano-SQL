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
// import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
var Cassandra = require("cassandra-driver");
var redis = require("redis");
var copy = function (e) { return e; };
var Scylla = /** @class */ (function () {
    function Scylla(args, redisArgs, filters) {
        this.args = args;
        this.redisArgs = redisArgs;
        this.plugin = {
            name: "Scylla Adapter",
            version: 2.03
        };
        this._tableConfigs = {};
        this._filters = __assign({ createKeySpace: copy, createTable: copy, useKeySpace: copy, dropTable: copy, selectRow: copy, upsertRow: copy, deleteRow: copy, createIndex: copy, dropIndex: copy, addIndexValue: copy, deleteIndexValue: copy, readIndexValue: copy }, (filters || {}));
    }
    Scylla.prototype.scyllaTable = function (table) {
        return utilities_1.slugify(table).replace(/\-/gmi, "_");
    };
    Scylla.prototype.connect = function (id, complete, error) {
        var _this = this;
        this._id = id;
        this._client = new Cassandra.Client(this.args);
        this._client.connect().then(function () {
            _this._client.execute(_this._filters.createKeySpace("CREATE KEYSPACE IF NOT EXISTS \"" + _this.scyllaTable(id) + "\" WITH REPLICATION = { \n                'class' : 'SimpleStrategy', \n                'replication_factor' : 1\n               };"), [], function (err, result) {
                if (err) {
                    error(err);
                    return;
                }
                _this._client.execute(_this._filters.useKeySpace("USE \"" + _this.scyllaTable(id) + "\";"), [], function (err, result) {
                    if (err) {
                        error(err);
                        return;
                    }
                    _this._redis = redis.createClient(_this.redisArgs);
                    _this._redis.on("ready", function () {
                        complete();
                    });
                    _this._redis.on("error", error);
                });
            });
        }).catch(error);
    };
    Scylla.prototype.key = function (tableName, key) {
        return this._id + "." + tableName + "." + key;
    };
    Scylla.prototype.createTable = function (tableName, tableData, complete, error) {
        this._tableConfigs[tableName] = tableData;
        this._client.execute(this._filters.createTable("CREATE TABLE IF NOT EXISTS \"" + this.scyllaTable(tableName) + "\" (\n            id " + (tableData.isPkNum ? (tableData.pkType === "int" ? "bigint" : "double") : (tableData.pkType === "uuid" ? "uuid" : "text")) + " PRIMARY KEY,\n            data text\n        )"), [], function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete();
        });
    };
    Scylla.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        this._redis.del(this.key("_ai_", table), function () {
            // done reading index, delete it
            _this._redis.del(_this.key("_index_", table), function (delErr) {
                if (delErr) {
                    error(delErr);
                    return;
                }
                _this._client.execute(_this._filters.dropTable("DROP TABLE IF EXISTS \"" + _this.scyllaTable(table) + "\""), [], function (err, result) {
                    if (err) {
                        error(err);
                        return;
                    }
                    complete();
                });
            });
        });
    };
    Scylla.prototype.disconnect = function (complete, error) {
        var _this = this;
        this._redis.on("end", function () {
            _this._client.shutdown(function () {
                complete();
            });
        });
        this._redis.quit();
    };
    Scylla.prototype.write = function (table, pk, row, complete, error) {
        var _this = this;
        new Promise(function (res, rej) {
            if (_this._tableConfigs[table].ai) {
                _this._redis.get(_this.key("_ai_", table), function (err, result) {
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
                if (typeof pk === "undefined") {
                    rej(new Error("Can't add a row without a primary key!"));
                    return;
                }
                if (_this._tableConfigs[table].ai && pk > AI) { // need to increment ai to database
                    _this._redis.incr(_this.key("_ai_", table), function (err, result) {
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
                switch (item) {
                    case "_index_": // update index
                        _this._redis.zadd(_this.key("_index_", table), _this._tableConfigs[table].isPkNum ? parseFloat(primaryKey) : 0, primaryKey, function (error) {
                            if (error) {
                                err(error);
                                return;
                            }
                            next(primaryKey);
                        });
                        break;
                    case "_table_": // update row value
                        var long = Cassandra.types.Long;
                        var setPK = _this._tableConfigs[table].pkType === "int" ? long.fromNumber(pk) : pk;
                        _this._client.execute(_this._filters.upsertRow("UPDATE \"" + _this.scyllaTable(table) + "\" SET data = ? WHERE id = ?"), [JSON.stringify(row), setPK], function (err2, result) {
                            if (err2) {
                                err(err2);
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
    Scylla.prototype.read = function (table, pk, complete, error) {
        var _this = this;
        var long = Cassandra.types.Long;
        var setPK = this._tableConfigs[table].pkType === "int" ? long.fromNumber(pk) : pk;
        var retries = 0;
        var doRead = function () {
            _this._client.execute(_this._filters.selectRow("SELECT data FROM \"" + _this.scyllaTable(table) + "\" WHERE id = ?"), [setPK], function (err, result) {
                if (err) {
                    if (retries > 3) {
                        error(err);
                    }
                    else {
                        retries++;
                        setTimeout(doRead, 100 + (Math.random() * 100));
                    }
                    return;
                }
                if (result.rowLength > 0) {
                    var row = result.first() || { data: "[]" };
                    complete(JSON.parse(row.data));
                }
                else {
                    complete(undefined);
                }
            });
        };
        doRead();
    };
    Scylla.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var _this = this;
        this.readRedisIndex(table, type, offsetOrLow, limitOrHigh, reverse, function (primaryKeys) {
            var batchSize = 2000;
            var page = 0;
            var nextPage = function () {
                var getPKS = primaryKeys.slice(page * batchSize, (page * batchSize) + batchSize);
                if (getPKS.length === 0) {
                    complete();
                    return;
                }
                utilities_1.allAsync(getPKS, function (rowPK, i, rowData, onError) {
                    _this.read(table, rowPK, rowData, onError);
                }).then(function (rows) {
                    rows.forEach(onRow);
                    page++;
                    nextPage();
                }).catch(error);
            };
            nextPage();
        }, error);
    };
    Scylla.prototype.delete = function (table, pk, complete, error) {
        var _this = this;
        utilities_1.allAsync(["_index_", "_table_"], function (item, i, next, err) {
            switch (item) {
                case "_index_": // update index
                    _this._redis.zrem(_this.key("_index_", table), pk, function (error) {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                    break;
                case "_table_": // remove row value
                    var long = Cassandra.types.Long;
                    var setPK = _this._tableConfigs[table].pkType === "int" ? long.fromNumber(pk) : pk;
                    _this._client.execute(_this._filters.deleteRow("DELETE FROM \"" + _this.scyllaTable(table) + "\" WHERE id = ?"), [setPK], function (err2, result) {
                        if (err2) {
                            error(err2);
                            return;
                        }
                        next();
                    });
                    break;
            }
        }).then(complete).catch(error);
    };
    Scylla.prototype.readRedisIndex = function (table, type, offsetOrLow, limitOrHigh, reverse, complete, error) {
        switch (type) {
            case "offset":
                if (reverse) {
                    this._redis.zrevrange(this.key("_index_", table), offsetOrLow + 1, offsetOrLow + limitOrHigh, function (err, results) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                }
                else {
                    this._redis.zrange(this.key("_index_", table), offsetOrLow, offsetOrLow + limitOrHigh - 1, function (err, results) {
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
                    this._redis.zrangebyscore(this.key("_index_", table), offsetOrLow, limitOrHigh, function (err, result) {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(reverse ? result.reverse() : result);
                    });
                }
                else {
                    this._redis.zrangebylex(this.key("_index_", table), "[" + offsetOrLow, "[" + limitOrHigh, function (err, result) {
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
    Scylla.prototype.maybeMapIndex = function (table, index) {
        if (this._tableConfigs[table].isPkNum)
            return index.map(function (i) { return parseFloat(i); });
        return index;
    };
    Scylla.prototype.getTableIndex = function (table, complete, error) {
        var _this = this;
        this._redis.zrangebyscore(this.key("_index_", table), "-inf", "+inf", function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete(_this.maybeMapIndex(table, result));
        });
    };
    Scylla.prototype.getTableIndexLength = function (table, complete, error) {
        this._redis.zcount(this.key("_index_", table), "-inf", "+inf", function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete(result);
        });
    };
    Scylla.prototype.createIndex = function (tableId, index, type, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        var isPkNum = ["float", "int", "number"].indexOf(type) !== -1;
        this._tableConfigs[indexName] = __assign({}, utilities_1.blankTableDefinition, { pkType: type, pkCol: ["id"], isPkNum: isPkNum });
        var pksType = this._tableConfigs[tableId].isPkNum ? (this._tableConfigs[tableId].pkType === "int" ? "bigint" : "double") : (this._tableConfigs[tableId].pkType === "uuid" ? "uuid" : "text");
        this._client.execute(this._filters.createIndex("CREATE TABLE IF NOT EXISTS \"" + this.scyllaTable(indexName) + "\" (\n            id " + (isPkNum ? (type === "int" ? "bigint" : "double") : (type === "uuid" ? "uuid" : "text")) + " PRIMARY KEY,\n            pks set<" + pksType + ">\n        )"), [], function (err, result) {
            if (err) {
                error(err);
                return;
            }
            complete();
        });
    };
    Scylla.prototype.deleteIndex = function (tableId, index, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.dropTable(indexName, complete, error);
    };
    Scylla.prototype.addIndexValue = function (tableId, index, rowID, indexKey, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        return utilities_1.allAsync(["_index_", "_table_"], function (item, i, next, err) {
            switch (item) {
                case "_index_": // update index
                    _this._redis.zadd(_this.key("_index_", indexName), _this._tableConfigs[indexName].isPkNum ? parseFloat(indexKey) : 0, indexKey, function (error) {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                    break;
                case "_table_": // update row value
                    var long = Cassandra.types.Long;
                    var setIndexKey = _this._tableConfigs[indexName].pkType === "int" ? long.fromNumber(indexKey) : indexKey;
                    var setPK = _this._tableConfigs[tableId].pkType === "int" ? long.fromNumber(rowID) : rowID;
                    _this._client.execute(_this._filters.addIndexValue("UPDATE \"" + _this.scyllaTable(indexName) + "\" SET pks = pks + {" + (_this._tableConfigs[tableId].isPkNum || _this._tableConfigs[tableId].pkType === "uuid" ? setPK : "'" + setPK + "'") + "} WHERE id = ?"), [setIndexKey], function (err2, result) {
                        if (err2) {
                            err(err2);
                            return;
                        }
                        next();
                    });
                    break;
            }
        }).then(complete).catch(error);
    };
    Scylla.prototype.deleteIndexValue = function (tableId, index, rowID, indexKey, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        var long = Cassandra.types.Long;
        var setIndexKey = this._tableConfigs[indexName].pkType === "int" ? long.fromNumber(indexKey) : indexKey;
        var setPK = this._tableConfigs[tableId].pkType === "int" ? long.fromNumber(rowID) : rowID;
        this._client.execute(this._filters.deleteIndexValue("UPDATE \"" + this.scyllaTable(indexName) + "\" SET pks = pks - {" + (this._tableConfigs[tableId].isPkNum || this._tableConfigs[tableId].pkType === "uuid" ? setPK : "'" + setPK + "'") + "} WHERE id = ?"), [setIndexKey], function (err2, result) {
            if (err2) {
                error(err2);
                return;
            }
            complete();
        });
    };
    Scylla.prototype.readIndexKey = function (tableId, index, indexKey, onRowPK, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        var long = Cassandra.types.Long;
        var setIndexKey = this._tableConfigs[indexName].pkType === "int" ? long.fromNumber(indexKey) : indexKey;
        this._client.execute(this._filters.readIndexValue("SELECT pks FROM \"" + this.scyllaTable(indexName) + "\" WHERE id = ?"), [setIndexKey], function (err2, result) {
            if (err2) {
                error(err2);
                return;
            }
            if (!result.rowLength) {
                complete();
                return;
            }
            var row = result.first() || { pks: [] };
            row.pks.forEach(function (value, i) {
                onRowPK(_this._tableConfigs[tableId].isPkNum ? value.toNumber() : value.toString());
            });
            complete();
        });
    };
    Scylla.prototype.readIndexKeys = function (tableId, index, type, offsetOrLow, limitOrHigh, reverse, onRowPK, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        this.readRedisIndex(indexName, type, offsetOrLow, limitOrHigh, reverse, function (primaryKeys) {
            var pageSize = 2000;
            var page = 0;
            var count = 0;
            var getPage = function () {
                var keys = primaryKeys.slice(pageSize * page, (pageSize * page) + pageSize);
                if (!keys.length) {
                    complete();
                    return;
                }
                utilities_1.allAsync(keys, function (indexKey, i, pkNext, pkErr) {
                    _this.readIndexKey(tableId, index, indexKey, function (row) {
                        onRowPK(row, count);
                        count++;
                    }, pkNext, pkErr);
                }).then(function () {
                    page++;
                    getPage();
                });
            };
            getPage();
        }, error);
    };
    return Scylla;
}());
exports.Scylla = Scylla;
//# sourceMappingURL=index.js.map