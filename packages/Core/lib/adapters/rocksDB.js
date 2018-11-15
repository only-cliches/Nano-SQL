Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = require("../interfaces");
var utilities_1 = require("../utilities");
var RocksDB = /** @class */ (function () {
    function RocksDB(path) {
        var _this = this;
        this.path = path;
        this.plugin = {
            name: "RocksDB Adapter",
            version: interfaces_1.VERSION
        };
        this._levelDBs = {};
        this._ai = {};
        if (typeof this.path === "string" || typeof this.path === "undefined") {
            this._lvlDown = (function (dbId, tableName) {
                var basePath = (_this.path || ".") + "/db_" + dbId;
                if (!global._fs.existsSync(basePath)) {
                    global._fs.mkdirSync(basePath);
                }
                return {
                    lvld: global._rocks(global._path.join(basePath, tableName)),
                    args: {
                        cacheSize: 64 * 1024 * 1024,
                        writeBufferSize: 64 * 1024 * 1024
                    }
                };
            });
        }
        else {
            this._lvlDown = this.path;
        }
    }
    RocksDB.prototype.connect = function (id, complete, error) {
        var _this = this;
        this._id = id;
        var tableName = "_ai_store_";
        var lvlDown = this._lvlDown(this._id, tableName);
        global._levelup(lvlDown.lvld, lvlDown.args, function (err, db) {
            if (err) {
                error(err);
                return;
            }
            _this._levelDBs[tableName] = db;
            complete();
        });
    };
    RocksDB.prototype.createAndInitTable = function (tableName, tableData, complete, error) {
        var _this = this;
        if (this._levelDBs[tableName]) {
            error(new Error("Table " + tableName + " already exists and is open!"));
            return;
        }
        var lvlDown = this._lvlDown(this._id, tableName);
        global._levelup(lvlDown.lvld, lvlDown.args, function (err, db) {
            if (err) {
                error(err);
                return;
            }
            _this._levelDBs[tableName] = db;
            _this._levelDBs["_ai_store_"].get(tableName, function (err, value) {
                _this._ai[tableName] = value || 1;
                complete();
            });
        });
    };
    RocksDB.prototype.disconnectTable = function (table, complete, error) {
        var _this = this;
        this._levelDBs[table].close(function (err) {
            if (err) {
                error(err);
            }
            else {
                delete _this._levelDBs[table];
                complete();
            }
        });
    };
    RocksDB.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        var del = new utilities_1._NanoSQLQueue(function (item, i, next, err) {
            // remove all records
            _this._levelDBs[table].del(item).then(next).catch(err);
        }, error, function () {
            // delete auto increment
            _this._levelDBs["_ai_store_"].del(table).then(function () {
                // disconnect
                _this.disconnectTable(table, complete, error);
            }).catch(error);
        });
        this._levelDBs[table].createReadStream({ values: false })
            .on("data", function (data) {
            del.newItem(data.key);
        })
            .on("error", function (err) {
            error(err);
            del.finished();
        })
            .on("end", function () {
            del.finished();
        });
    };
    RocksDB.prototype.disconnect = function (complete, error) {
        var _this = this;
        utilities_1.allAsync(Object.keys(this._levelDBs), function (table, i, next, err) {
            _this.disconnectTable(table, next, err);
        }).then(complete).catch(error);
    };
    RocksDB.prototype.write = function (table, pk, row, complete, error) {
        var _this = this;
        pk = pk || utilities_1.generateID(this.nSQL.tables[table].pkType, this._ai[table] + 1);
        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }
        this._ai[table] = Math.max(pk, this._ai[table]);
        row[this.nSQL.tables[table].pkCol] = pk;
        this._levelDBs[table].put(this.nSQL.tables[table].isPkNum ? new global._Int64BE(pk).toBuffer() : pk, JSON.stringify(row), function (err) {
            if (err) {
                error(err);
            }
            else {
                if (_this.nSQL.tables[table].ai) {
                    _this._levelDBs["_ai_store_"].put(table, _this._ai[table]).then(function () {
                        complete(pk);
                    }).catch(error);
                }
                else {
                    complete(pk);
                }
            }
        });
    };
    RocksDB.prototype.read = function (table, pk, complete, error) {
        this._levelDBs[table].get(this.nSQL.tables[table].isPkNum ? new global._Int64BE(pk).toBuffer() : pk, function (err, row) {
            if (err) {
                complete(undefined);
            }
            else {
                complete(JSON.parse(row));
            }
        });
    };
    RocksDB.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var isPkNum = this.nSQL.tables[table].isPkNum;
        var i = 0;
        this._levelDBs[table]
            .createValueStream({
            gte: type === "range" ? (isPkNum ? new global._Int64BE(offsetOrLow).toBuffer() : offsetOrLow) : undefined,
            lte: type === "range" ? (isPkNum ? new global._Int64BE(limitOrHigh).toBuffer() : limitOrHigh) : undefined,
            reverse: reverse,
            limit: type === "offset" ? offsetOrLow + limitOrHigh : undefined
        })
            .on("data", function (data) {
            if (type === "offset" && i < offsetOrLow) {
                return;
            }
            onRow(JSON.parse(data), i - offsetOrLow);
            i++;
        })
            .on("end", function () {
            complete();
        })
            .on("error", error);
    };
    RocksDB.prototype.delete = function (table, pk, complete, error) {
        this._levelDBs[table].del(this.nSQL.tables[table].isPkNum ? new global._Int64BE(pk).toBuffer() : pk, function (err) {
            if (err) {
                throw Error(err);
            }
            else {
                complete();
            }
        });
    };
    RocksDB.prototype.getIndex = function (table, complete, error) {
        var _this = this;
        var index = [];
        this._levelDBs[table]
            .createKeyStream()
            .on("data", function (pk) {
            index.push(_this.nSQL.tables[table].isPkNum ? new global._Int64BE(pk).toBuffer() : pk);
        })
            .on("end", function () {
            complete(index);
        })
            .on("error", error);
    };
    RocksDB.prototype.getNumberOfRecords = function (table, complete, error) {
        var count = 0;
        this._levelDBs[table]
            .createKeyStream()
            .on("data", function (pk) {
            count++;
        })
            .on("end", function () {
            complete(count);
        })
            .on("error", error);
    };
    return RocksDB;
}());
exports.RocksDB = RocksDB;
//# sourceMappingURL=rocksDB.js.map