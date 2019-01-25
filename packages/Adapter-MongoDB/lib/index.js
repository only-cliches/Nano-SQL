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
var mongodb_1 = require("mongodb");
// import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
var nan = function (input) {
    return isNaN(input) || input === null ? 0 : parseFloat(input);
};
var MongoDB = /** @class */ (function () {
    function MongoDB(connectURL, databaseOptions) {
        this.connectURL = connectURL;
        this.databaseOptions = databaseOptions;
        this.plugin = {
            name: "MongoDB Adapter",
            version: 2.01
        };
        this._tableConfigs = {};
    }
    MongoDB.prototype.connect = function (id, complete, error) {
        var _this = this;
        this._id = id;
        mongodb_1.MongoClient.connect(this.connectURL, function (err, client) {
            if (err) {
                error(err);
                return;
            }
            _this._client = client;
            _this._db = client.db(_this._id, _this.databaseOptions);
            _this.createTable("_ai_", __assign({}, utilities_1.blankTableDefinition, { model: {
                    "table:string": { pk: true },
                    "ai:int": {}
                }, pkType: "string", pkCol: ["table"], isPkNum: false }), complete, error);
        });
    };
    MongoDB.prototype.createTable = function (tableName, tableData, complete, error) {
        var _this = this;
        this._tableConfigs[tableName] = tableData;
        this._db.listCollections().toArray(function (err, result) {
            if (err) {
                error(err);
                return;
            }
            var tables = result.map(function (t) { return t.name; });
            if (tables.indexOf(tableName) === -1) {
                _this._db.createCollection(tableName);
                setTimeout(function () {
                    complete();
                }, 10);
            }
            else {
                complete();
            }
        });
    };
    MongoDB.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        delete this._tableConfigs[table];
        this._db.dropCollection(table).then(function () {
            return _this._db.collection("_ai_").deleteOne({ _id: table });
        }).catch(error).then(complete);
    };
    MongoDB.prototype.disconnect = function (complete, error) {
        this._client.close(true).then(complete).catch(error);
    };
    MongoDB.prototype.write = function (table, pk, row, complete, error) {
        var _this = this;
        new Promise(function (res, rej) {
            if (_this._tableConfigs[table].ai === true) {
                _this._db.collection("_ai_").findOne({ _id: table }).then(function (result) {
                    var AI = nan(result ? result.ai : 0);
                    if (!pk || AI < pk) {
                        pk = Math.max(nan(pk), AI + 1);
                        _this._db.collection("_ai_").updateOne({ _id: table }, { $set: { ai: pk } }, { upsert: true }).then(function () {
                            res(pk);
                        }).catch(error);
                    }
                    else {
                        res(pk);
                    }
                }).catch(error);
            }
            else {
                res(pk || utilities_1.generateID(_this._tableConfigs[table].pkType, 0));
            }
        }).then(function (primaryKey) {
            if (typeof primaryKey === "undefined") {
                error(new Error("Can't add a row without a primary key!"));
                return;
            }
            utilities_1.deepSet(_this._tableConfigs[table].pkCol, row, primaryKey);
            _this._db.collection(table).updateOne({ _id: primaryKey }, { $set: { data: row } }, { upsert: true }).then(function () {
                complete(primaryKey);
            }).catch(error);
        });
    };
    MongoDB.prototype.read = function (table, pk, complete, error) {
        this._db.collection(table).findOne({ _id: pk }).then(function (result) {
            complete(result ? result.data : undefined);
        }).catch(error);
    };
    MongoDB.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var query = this._db.collection(table);
        new Promise(function (res, rej) {
            switch (type) {
                case "range":
                    res(query.find({ _id: { $gte: offsetOrLow, $lte: limitOrHigh } }).sort({ _id: reverse ? -1 : 1 }).stream());
                    break;
                case "offset":
                    res(query.find().skip(reverse ? offsetOrLow + 1 : offsetOrLow).limit(limitOrHigh).sort({ _id: reverse ? -1 : 1 }).stream());
                    break;
                case "all":
                    res(query.find().sort({ _id: reverse ? -1 : 1 }).stream());
                    break;
            }
        }).then(function (stream) {
            stream.on("error", error);
            var i = 0;
            stream.on("data", function (row) {
                onRow(row.data, i);
                i++;
            });
            stream.on("end", function () {
                complete();
            });
        });
    };
    MongoDB.prototype.delete = function (table, pk, complete, error) {
        this._db.collection(table).deleteOne({ _id: pk }).then(complete).catch(error);
    };
    MongoDB.prototype.getTableIndex = function (table, complete, error) {
        this._db.collection(table)
            .find()
            .project({ _id: 1 })
            .map(function (x) { return x._id; })
            .toArray().then(complete).catch(error);
    };
    MongoDB.prototype.getTableIndexLength = function (table, complete, error) {
        this._db.collection(table).countDocuments().then(complete).catch(error);
    };
    MongoDB.prototype.createIndex = function (tableId, index, type, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.createTable(indexName, __assign({}, utilities_1.blankTableDefinition, { pkType: type, pkCol: ["id"], isPkNum: ["float", "int", "number"].indexOf(type) !== -1 }), complete, error);
    };
    MongoDB.prototype.deleteIndex = function (tableId, index, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.dropTable(indexName, complete, error);
    };
    MongoDB.prototype.addIndexValue = function (tableId, index, key, value, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        this.read(indexName, value, function (row) {
            var pks = row ? row.pks : [];
            if (pks.length === 0) {
                pks.push(key);
            }
            else {
                var idx = utilities_1.binarySearch(pks, key, false);
                pks.splice(idx, 0, key);
            }
            _this.write(indexName, value, {
                id: key,
                pks: pks
            }, complete, error);
        }, error);
    };
    MongoDB.prototype.deleteIndexValue = function (tableId, index, key, value, complete, error) {
        var _this = this;
        var indexName = "_idx_" + tableId + "_" + index;
        this.read(indexName, value, function (row) {
            var pks = row ? row.pks : [];
            if (pks.length === 0) {
                complete();
                return;
            }
            else {
                var idx = pks.length < 100 ? pks.indexOf(key) : utilities_1.binarySearch(pks, key, true);
                if (idx === -1) {
                    complete();
                    return;
                }
                else {
                    pks.splice(idx, 1);
                }
            }
            if (pks.length) {
                _this.write(indexName, value, {
                    id: key,
                    pks: pks
                }, complete, error);
            }
            else {
                _this.delete(indexName, value, complete, error);
            }
        }, error);
    };
    MongoDB.prototype.readIndexKey = function (tableId, index, pk, onRowPK, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.read(indexName, pk, function (row) {
            if (!row) {
                complete();
                return;
            }
            row.pks.forEach(onRowPK);
            complete();
        }, error);
    };
    MongoDB.prototype.readIndexKeys = function (tableId, index, type, offsetOrLow, limitOrHigh, reverse, onRowPK, complete, error) {
        var indexName = "_idx_" + tableId + "_" + index;
        this.readMulti(indexName, type, offsetOrLow, limitOrHigh, reverse, function (index) {
            if (!index)
                return;
            index.pks.forEach(function (pk) {
                onRowPK(pk, index.id);
            });
        }, complete, error);
    };
    return MongoDB;
}());
exports.MongoDB = MongoDB;
//# sourceMappingURL=index.js.map