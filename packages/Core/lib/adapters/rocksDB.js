Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = require("../interfaces");
var utilities_1 = require("../utilities");
exports.rimraf = function (dir_path) {
    if (global._fs.existsSync(dir_path)) {
        global._fs.readdirSync(dir_path).forEach(function (entry) {
            var entry_path = global._path.join(dir_path, entry);
            if (global._fs.lstatSync(entry_path).isDirectory()) {
                exports.rimraf(entry_path);
            }
            else {
                global._fs.unlinkSync(entry_path);
            }
        });
        global._fs.rmdirSync(dir_path);
    }
};
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
            this._lvlDown = (function (dbId, tableName, tableData) {
                var basePath = global._path.join(_this.path || ".", "db_" + dbId);
                if (!global._fs.existsSync(basePath)) {
                    global._fs.mkdirSync(basePath);
                }
                var keyEncoding = {
                    "int": global._lexint
                }[tableData.pkType] || "binary";
                return {
                    lvld: global._encode(global._rocks(global._path.join(basePath, tableName)), { valueEncoding: "json", keyEncoding: keyEncoding }),
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
        var lvlDown = this._lvlDown(this._id, tableName, {
            model: {},
            columns: [],
            indexes: {},
            pkOffset: 0,
            actions: [],
            views: [],
            pkType: "string",
            pkCol: "",
            isPkNum: true,
            ai: true
        });
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
        var lvlDown = this._lvlDown(this._id, tableName, tableData);
        global._levelup(lvlDown.lvld, lvlDown.args, function (err, db) {
            if (err) {
                error(err);
                return;
            }
            _this._levelDBs[tableName] = db;
            _this._levelDBs["_ai_store_"].get(Buffer.from(tableName, "utf-8"), function (err, value) {
                _this._ai[tableName] = value ? value.ai || 0 : 0;
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
                try {
                    exports.rimraf(global._path.join((_this.path || "."), "db_" + _this._id, table));
                }
                catch (e) {
                }
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
            _this._levelDBs["_ai_store_"].del(Buffer.from(table, "utf-8")).then(function () {
                // disconnect
                _this.disconnectTable(table, complete, error);
            }).catch(error);
        });
        this._levelDBs[table].createReadStream({ values: false })
            .on("data", function (data) {
            del.newItem(data);
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
        if (this.nSQL.tables[table].ai) {
            this._ai[table] = Math.max(pk, this._ai[table]);
        }
        row[this.nSQL.tables[table].pkCol] = pk;
        this._levelDBs[table].put(this._encodePk(table, pk), row, function (err) {
            if (err) {
                error(err);
            }
            else {
                if (_this.nSQL.tables[table].ai) {
                    _this._levelDBs["_ai_store_"].put(Buffer.from(table, "utf-8"), { ai: _this._ai[table] }).then(function () {
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
        this._levelDBs[table].get(this._encodePk(table, pk), function (err, row) {
            if (err) {
                complete(undefined);
            }
            else {
                complete(row);
            }
        });
    };
    RocksDB.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var i = 0;
        this._levelDBs[table]
            .createValueStream(type === "range" ? {
            gte: type === "range" ? this._encodePk(table, offsetOrLow) : undefined,
            lte: type === "range" ? this._encodePk(table, limitOrHigh) : undefined,
            reverse: reverse
        } : type === "offset" ? {
            reverse: reverse,
            limit: type === "offset" ? (offsetOrLow + limitOrHigh) : undefined
        } : {
            reverse: reverse,
        })
            .on("data", function (data) {
            i++;
            if (type === "offset" && i < offsetOrLow + 1) {
                return;
            }
            onRow(data, i);
        })
            .on("end", function () {
            complete();
        })
            .on("error", error);
    };
    RocksDB.prototype._writeNumberBuffer = function (table, num) {
        switch (this.nSQL.tables[table].pkType) {
            case "int":
                return num;
            // case "float":
            // case "number":
            default:
                return Buffer.from(String(num), "utf-8");
        }
    };
    RocksDB.prototype._readNumberBuffer = function (table, buff) {
        switch (this.nSQL.tables[table].pkType) {
            case "int":
                return buff;
            // case "float":
            // case "number":
            default:
                var buffer = new Buffer(buff);
                return parseFloat(buffer.toString("utf-8"));
        }
    };
    RocksDB.prototype._encodePk = function (table, pk) {
        return this.nSQL.tables[table].isPkNum ? this._writeNumberBuffer(table, pk) : Buffer.from(pk, "utf-8");
    };
    RocksDB.prototype._decodePK = function (table, pk) {
        return this.nSQL.tables[table].isPkNum ? this._readNumberBuffer(table, pk) : new Buffer(pk).toString("utf-8");
    };
    RocksDB.prototype.delete = function (table, pk, complete, error) {
        this._levelDBs[table].del(this._encodePk(table, pk), function (err) {
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
            index.push(_this._decodePK(table, pk));
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