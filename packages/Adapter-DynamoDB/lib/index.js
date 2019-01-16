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
var AWS = require("aws-sdk");
var memoryIndex_1 = require("@nano-sql/core/lib/adapters/memoryIndex");
exports.copy = function (e) { return e; };
var DynamoDB = /** @class */ (function (_super) {
    __extends(DynamoDB, _super);
    function DynamoDB(connectArgs, args) {
        var _this = _super.call(this, false, false) || this;
        _this.plugin = {
            name: "DynamoDB Adapter",
            version: 2.06
        };
        _this.config = __assign({ filterDrop: exports.copy, filterDelete: exports.copy, filterSchema: exports.copy, filterUpdate: exports.copy, filterGet: exports.copy, filterQuery: exports.copy, filterScan: exports.copy }, (args || {}));
        _this._connectArgs = connectArgs || {};
        _this._tableConfigs = {};
        return _this;
    }
    DynamoDB.prototype.connect = function (id, complete, error) {
        this._id = id;
        this._db = new AWS.DynamoDB(this._connectArgs);
        this._client = new AWS.DynamoDB.DocumentClient();
        this.createTable("_ai_store", {
            id: "_ai_store",
            model: {},
            columns: [],
            indexes: {},
            actions: [],
            views: [],
            pkType: "string",
            pkCol: [],
            isPkNum: false,
            ai: false
        }, complete, error);
    };
    DynamoDB.prototype.table = function (tableName) {
        return this._id + "." + tableName;
    };
    DynamoDB.prototype.createTable = function (tableName, tableData, complete, error) {
        var _this = this;
        this._tableConfigs[tableName] = tableData;
        this._db.listTables().promise().then(function (tables) {
            var exists = (tables.TableNames || []).filter(function (t) { return t === _this.table(tableName); }).length > 0;
            if (exists) { // table already exists
                complete();
                return;
            }
            var schema = {
                TableName: _this.table(tableName),
                KeySchema: [
                    { AttributeName: "tname", KeyType: "HASH" },
                    { AttributeName: "id", KeyType: "RANGE" }
                ],
                AttributeDefinitions: [
                    { AttributeName: "tname", AttributeType: "S" },
                    { AttributeName: "id", AttributeType: tableData.isPkNum ? "N" : "S" },
                ],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 2,
                    WriteCapacityUnits: 2
                }
            };
            _this._db.createTable(_this.config.filterSchema(schema), function (err, data) {
                if (err) {
                    error(err);
                    return;
                }
                if (!tableData.ai) {
                    complete();
                    return;
                }
                _this._client.update(_this.config.filterUpdate({
                    TableName: _this.table("_ai_store"),
                    Key: {
                        "tname": tableName,
                        "id": tableName
                    },
                    UpdateExpression: "set #d = :val",
                    ExpressionAttributeNames: {
                        "#d": "data"
                    },
                    ExpressionAttributeValues: {
                        ":val": 0
                    }
                }), function (err) {
                    if (err) {
                        error(err);
                        return;
                    }
                    complete();
                });
            });
        });
    };
    DynamoDB.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        this._db.deleteTable(this.config.filterDrop({ TableName: this.table(table) }), function (err) {
            if (err) {
                error(err);
                return;
            }
            if (!_this._tableConfigs[table].ai) {
                complete();
                return;
            }
            _this._client.delete(_this.config.filterDelete({
                TableName: _this.table("_ai_store"),
                Key: {
                    "tname": table,
                    "id": table
                }
            }), function (err) {
                if (err) {
                    error(err);
                    return;
                }
                complete();
            });
        });
    };
    DynamoDB.prototype.disconnect = function (complete, error) {
        complete();
    };
    DynamoDB.prototype.write = function (table, pk, row, complete, error) {
        var _this = this;
        (function () {
            return new Promise(function (res, rej) {
                if (_this._tableConfigs[table].ai) {
                    _this._client.get(_this.config.filterGet({
                        TableName: _this.table("_ai_store"),
                        Key: {
                            "tname": table,
                            "id": table
                        }
                    }), function (err, item) {
                        if (err) {
                            error(err);
                            return;
                        }
                        var ai = parseInt(item.Item ? item.Item["data"] : 0);
                        res(ai);
                    });
                }
                else {
                    res(0);
                }
            });
        })().then(function (ai) {
            pk = pk || utilities_1.generateID(_this._tableConfigs[table].pkType, ai + 1);
            if (typeof pk === "undefined") {
                error(new Error("Can't add a row without a primary key!"));
                return;
            }
            utilities_1.deepSet(_this._tableConfigs[table].pkCol, row, pk);
            var updateRow = function () {
                _this._client.update(_this.config.filterUpdate({
                    TableName: _this.table(table),
                    Key: {
                        "tname": table,
                        "id": pk
                    },
                    UpdateExpression: "set #d = :d",
                    ExpressionAttributeNames: {
                        "#d": "data"
                    },
                    ExpressionAttributeValues: {
                        ":d": JSON.stringify(row)
                    }
                }), function (err) {
                    if (err) {
                        error(err);
                        return;
                    }
                    complete(pk);
                });
            };
            if (_this._tableConfigs[table].ai && ai < pk) {
                // update ai counter
                _this._client.update(_this.config.filterUpdate({
                    TableName: _this.table("_ai_store"),
                    Key: {
                        "tname": table,
                        "id": table
                    },
                    UpdateExpression: "set #d = #d + :val",
                    ExpressionAttributeNames: {
                        "#d": "data"
                    },
                    ExpressionAttributeValues: {
                        ":val": 1
                    }
                }), function (err) {
                    if (err) {
                        error(err);
                        return;
                    }
                    updateRow();
                });
            }
            else {
                updateRow();
            }
        });
    };
    DynamoDB.prototype.read = function (table, pk, complete, error) {
        this._client.get(this.config.filterGet({
            TableName: this.table(table),
            Key: {
                "tname": table,
                "id": pk
            }
        }), function (err, item) {
            if (err) {
                error(err);
                return;
            }
            complete(item.Item ? JSON.parse(item.Item["data"]) : undefined);
        });
    };
    DynamoDB.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var _this = this;
        if (type === "offset" || type === "all") {
            var count_1 = 0;
            var LastEvaluatedKey_1;
            var low_1 = offsetOrLow;
            var high_1 = offsetOrLow + limitOrHigh;
            var cache_1 = [];
            var done_1 = function () {
                if (reverse) {
                    cache_1.forEach(function (row) {
                        onRow(row[0], row[1]);
                    });
                    cache_1 = [];
                    complete();
                }
                else {
                    complete();
                }
            };
            var read_1 = function () {
                _this._client.scan(_this.config.filterScan({
                    TableName: _this.table(table),
                    ExclusiveStartKey: LastEvaluatedKey_1
                }), function (err, item) {
                    if (err) {
                        error(err);
                        return;
                    }
                    if (!item.Items) {
                        done_1();
                        return;
                    }
                    (item.Items || []).forEach(function (item) {
                        if (type === "offset") {
                            if (!reverse && count_1 >= low_1 && count_1 < high_1) {
                                onRow(item ? JSON.parse(item["data"]) : undefined, count_1);
                            }
                            if (reverse) {
                                cache_1.unshift([item ? JSON.parse(item["data"]) : undefined, count_1]);
                            }
                        }
                        else {
                            if (reverse) {
                                cache_1.unshift([item ? JSON.parse(item["data"]) : undefined, count_1]);
                            }
                            else {
                                onRow(item ? JSON.parse(item["data"]) : undefined, count_1);
                            }
                        }
                        count_1++;
                    });
                    if (type === "offset") {
                        if (reverse) {
                            cache_1 = cache_1.splice(low_1 + 1, limitOrHigh);
                            if (item.LastEvaluatedKey) {
                                LastEvaluatedKey_1 = item.LastEvaluatedKey;
                                utilities_1.setFast(read_1);
                            }
                            else {
                                done_1();
                            }
                        }
                        else {
                            if (count_1 < high_1 && item.LastEvaluatedKey) {
                                LastEvaluatedKey_1 = item.LastEvaluatedKey;
                                utilities_1.setFast(read_1);
                            }
                            else {
                                done_1();
                            }
                        }
                    }
                    else {
                        if (item.LastEvaluatedKey) {
                            LastEvaluatedKey_1 = item.LastEvaluatedKey;
                            utilities_1.setFast(read_1);
                            return;
                        }
                        done_1();
                    }
                });
            };
            read_1();
        }
        else {
            var LastEvaluatedKey_2;
            var count_2 = 0;
            var read_2 = function () {
                _this._client.query(_this.config.filterQuery({
                    TableName: _this.table(table),
                    ScanIndexForward: !reverse,
                    KeyConditionExpression: "#table = :table AND #id BETWEEN :low AND :high",
                    ExpressionAttributeNames: {
                        "#table": "tname",
                        "#id": "id"
                    },
                    ExpressionAttributeValues: {
                        ":table": table,
                        ":low": offsetOrLow,
                        ":high": limitOrHigh,
                    },
                    ExclusiveStartKey: LastEvaluatedKey_2
                }), function (err, item) {
                    if (err) {
                        error(err);
                        return;
                    }
                    if (!item.Items) {
                        complete();
                        return;
                    }
                    (item.Items || []).forEach(function (item) {
                        onRow(item ? JSON.parse(item["data"]) : undefined, count_2);
                        count_2++;
                    });
                    if (item.LastEvaluatedKey) {
                        LastEvaluatedKey_2 = item.LastEvaluatedKey;
                        utilities_1.setFast(read_2);
                        return;
                    }
                    complete();
                });
            };
            read_2();
        }
    };
    DynamoDB.prototype.delete = function (table, pk, complete, error) {
        this._client.delete(this.config.filterDelete({
            TableName: this.table(table),
            Key: {
                "tname": table,
                "id": pk
            }
        }), function (err) {
            if (err) {
                error(err);
                return;
            }
            complete();
        });
    };
    DynamoDB.prototype.getTableIndex = function (table, complete, error) {
        var _this = this;
        var index = [];
        var LastEvaluatedKey;
        var read = function () {
            _this._client.scan(_this.config.filterScan({
                TableName: _this.table(table),
                ExclusiveStartKey: LastEvaluatedKey
            }), function (err, item) {
                if (err) {
                    error(err);
                    return;
                }
                (item.Items || []).forEach(function (item) {
                    index.push(item["id"]);
                });
                if (item.LastEvaluatedKey) {
                    LastEvaluatedKey = item.LastEvaluatedKey;
                    utilities_1.setFast(read);
                    return;
                }
                complete(index);
            });
        };
        read();
    };
    DynamoDB.prototype.getTableIndexLength = function (table, complete, error) {
        var _this = this;
        var count = 0;
        var LastEvaluatedKey;
        var read = function () {
            _this._client.scan(_this.config.filterScan({
                TableName: _this.table(table),
                ExclusiveStartKey: LastEvaluatedKey
            }), function (err, item) {
                if (err) {
                    error(err);
                    return;
                }
                count += item.Count || 0;
                if (item.LastEvaluatedKey) {
                    LastEvaluatedKey = item.LastEvaluatedKey;
                    utilities_1.setFast(read);
                    return;
                }
                complete(count);
            });
        };
        read();
    };
    return DynamoDB;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.DynamoDB = DynamoDB;
//# sourceMappingURL=index.js.map