var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = require("../interfaces");
var utilities_1 = require("../utilities");
var memoryIndex_1 = require("./memoryIndex");
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
var RocksDB = /** @class */ (function (_super) {
    __extends(RocksDB, _super);
    function RocksDB(path) {
        var _this = _super.call(this, false, true) || this;
        _this.path = path;
        _this.plugin = {
            name: "RocksDB Adapter",
            version: interfaces_1.VERSION,
            filters: [
                {
                    name: "postConnect",
                    priority: 1000,
                    call: function (args, complete, cancel) {
                        if (typeof args.result.queue === "undefined") {
                            args.result.queue = false;
                        }
                        complete(args);
                    }
                }
            ]
        };
        _this._levelDBs = {};
        _this._ai = {};
        _this._tableConfigs = {};
        if (typeof _this.path === "string" || typeof _this.path === "undefined") {
            _this._lvlDown = (function (dbId, tableName, tableData) {
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
            _this._lvlDown = _this.path;
        }
        return _this;
    }
    RocksDB.prototype.connect = function (id, complete, error) {
        var _this = this;
        this._id = id;
        var tableName = "_ai_store_";
        var lvlDownAI = this._lvlDown(this._id, tableName, __assign({}, utilities_1.blankTableDefinition, { pkType: "string" }));
        global._levelup(lvlDownAI.lvld, lvlDownAI.args, function (err, db) {
            if (err) {
                error(err);
                return;
            }
            _this._levelDBs[tableName] = db;
            complete();
        });
    };
    RocksDB.prototype.createTable = function (tableName, tableData, complete, error) {
        var _this = this;
        if (this._levelDBs[tableName]) {
            error(new Error("Table " + tableName + " already exists and is open!"));
            return;
        }
        this._tableConfigs[tableName] = tableData;
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
                return;
            }
            delete _this._levelDBs[table];
            complete();
        });
    };
    RocksDB.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        this._levelDBs["_ai_store_"].del(Buffer.from(table, "utf-8")).then(function () {
            _this.disconnectTable(table, function () {
                try {
                    exports.rimraf(global._path.join((_this.path || "."), "db_" + _this._id, table));
                }
                catch (e) {
                    error(e);
                    return;
                }
                complete();
            }, error);
        }).catch(error);
    };
    RocksDB.prototype.disconnect = function (complete, error) {
        var _this = this;
        utilities_1.allAsync(Object.keys(this._levelDBs), function (table, i, next, err) {
            _this.disconnectTable(table, next, err);
        }).then(complete).catch(error);
    };
    RocksDB.prototype.write = function (table, pk, row, complete, error) {
        var _this = this;
        pk = pk || utilities_1.generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);
        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }
        if (this._tableConfigs[table].ai) {
            this._ai[table] = Math.max(pk, this._ai[table]);
        }
        row[this._tableConfigs[table].pkCol] = pk;
        this._levelDBs[table].put(this._encodePk(table, pk), row, function (err) {
            if (err) {
                error(err);
            }
            else {
                if (_this._tableConfigs[table].ai) {
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
            limit: type === "offset" ? (offsetOrLow + limitOrHigh + (reverse ? 1 : 0)) : undefined
        } : {
            reverse: reverse,
        })
            .on("data", function (data) {
            if (type === "offset" && (reverse ? i < offsetOrLow + 1 : i < offsetOrLow)) {
                i++;
                return;
            }
            onRow(data, i);
            i++;
        })
            .on("end", function () {
            complete();
        })
            .on("error", error);
    };
    RocksDB.prototype._writeNumberBuffer = function (table, num) {
        switch (this._tableConfigs[table].pkType) {
            case "int":
                return num;
            // case "float":
            // case "number":
            default:
                return Buffer.from(String(num), "utf-8");
        }
    };
    RocksDB.prototype._readNumberBuffer = function (table, buff) {
        switch (this._tableConfigs[table].pkType) {
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
        return this._tableConfigs[table].isPkNum ? this._writeNumberBuffer(table, pk) : Buffer.from(pk, "utf-8");
    };
    RocksDB.prototype._decodePK = function (table, pk) {
        return this._tableConfigs[table].isPkNum ? this._readNumberBuffer(table, pk) : new Buffer(pk).toString("utf-8");
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
    RocksDB.prototype.getTableIndex = function (table, complete, error) {
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
    RocksDB.prototype.getTableIndexLength = function (table, complete, error) {
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
}(memoryIndex_1.NanoSQLMemoryIndex));
exports.RocksDB = RocksDB;
//# sourceMappingURL=rocksDB.js.map