Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("../utilities");
var SyncStorage = /** @class */ (function () {
    function SyncStorage(useLS) {
        this.useLS = useLS;
        this.plugin = {
            name: "Sync Storage Adapter",
            version: 2.0,
            dependencies: {
                core: [2.0]
            }
        };
        this._index = {};
        this._rows = {};
        this._ai = {};
    }
    SyncStorage.prototype.connect = function (id, complete, error) {
        this._id = this.nSQL.config.id;
        complete();
    };
    SyncStorage.prototype.createAndInitTable = function (tableName, tableData, complete, error) {
        this._index[tableName] = [];
        this._rows[tableName] = {};
        if (this.useLS) {
            var index = localStorage.getItem(this._id + "->" + tableName + "_idx");
            if (index) {
                this._index[tableName] = JSON.parse(index);
                this._ai[tableName] = parseFloat(localStorage.getItem(this._id + "->" + tableName + "_ai") || "0");
            }
        }
        complete();
    };
    SyncStorage.prototype.disconnectTable = function (table, complete, error) {
        delete this._index[table];
        delete this._rows[table];
        complete();
    };
    SyncStorage.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        this._index[table].forEach(function (pk) {
            if (_this.useLS) {
                localStorage.removeItem(_this._id + "->" + table + "__" + pk);
            }
            else {
                delete _this._rows[table][pk];
            }
        });
        if (this.useLS) {
            localStorage.removeItem(this._id + "->" + table + "_idx");
        }
        delete this._index[table];
        delete this._rows[table];
        complete();
    };
    SyncStorage.prototype.disconnect = function (complete, error) {
        complete();
    };
    SyncStorage.prototype.write = function (table, pk, row, complete, error) {
        pk = pk || utilities_1.generateID(this.nSQL.tables[table].pkType, this.nSQL.tables[table].ai ? this._ai[table] + 1 : 0);
        if (this.nSQL.tables[table].ai) {
            this._ai[table] = utilities_1.cast("int", Math.max(this._ai[table] || 0, pk));
        }
        if (this._index[table].indexOf(pk) === -1) {
            var loc = utilities_1.binarySearch(this._index[table], pk);
            this._index[table].splice(loc, 0, pk);
            if (this.useLS) {
                localStorage.setItem(this._id + "->" + table + "_idx", JSON.stringify(this._index[table]));
                localStorage.setItem(this._id + "->" + table + "_ai", String(utilities_1.cast("int", Math.max(this._ai[table] || 0, pk))));
            }
        }
        row[this.nSQL.tables[table].pkCol] = pk;
        if (this.useLS) {
            localStorage.setItem(this._id + "->" + table + "__" + pk, JSON.stringify(row));
            complete(row[this.nSQL.tables[table].pkCol]);
        }
        else {
            this._rows[table][pk] = utilities_1.deepFreeze(row);
            complete(row[this.nSQL.tables[table].pkCol]);
        }
    };
    SyncStorage.prototype.read = function (table, pk, complete, error) {
        if (this.useLS) {
            var item = localStorage.getItem(this._id + "->" + table + "__" + pk);
            complete(item ? JSON.parse(item) : undefined);
        }
        else {
            complete(this._rows[table][pk]);
        }
    };
    SyncStorage.prototype.delete = function (table, pk, complete, error) {
        var idx = this._index[table].indexOf(pk);
        if (idx !== -1) {
            this._index[table].splice(idx, 1);
            if (this.useLS) {
                localStorage.setItem(this._id + "->" + table + "_idx", JSON.stringify(this._index[table].keys()));
            }
        }
        if (this.useLS) {
            localStorage.removeItem(this._id + "->" + table + "__" + pk);
        }
        else {
            delete this._rows[table][pk];
        }
        complete();
    };
    SyncStorage.prototype.readMulti = function (table, type, offsetOrLow, limitOrHeigh, reverse, onRow, complete, error) {
        this.readMultiAbstract(false, table, type, offsetOrLow, limitOrHeigh, reverse, onRow, complete, error);
    };
    SyncStorage.prototype.readMultiPK = function (table, type, offsetOrLow, limitOrHeigh, reverse, onPK, complete, error) {
        this.readMultiAbstract(true, table, type, offsetOrLow, limitOrHeigh, reverse, onPK, complete, error);
    };
    SyncStorage.prototype.readMultiAbstract = function (pkOnly, table, type, offsetOrLow, limitOrHeigh, reverse, onValue, complete, error) {
        var _this = this;
        var doCheck = offsetOrLow || limitOrHeigh;
        var range = {
            "range": [offsetOrLow, limitOrHeigh],
            "offset": [offsetOrLow, offsetOrLow + limitOrHeigh],
            "all": false
        }[type];
        this._index[table].forEach(function (pk, i) {
            var read = !range ? true : (type === "range" ? pk >= range[0] && pk < range[1] : i >= range[0] && i < range[1]);
            if (read) {
                if (pkOnly) {
                    onValue(pk, i);
                }
                else {
                    if (_this.useLS) {
                        onValue(JSON.parse(localStorage.getItem(_this._id + "->" + table + "__" + pk) || "{}"), i);
                    }
                    else {
                        onValue(_this._rows[table][pk], i);
                    }
                }
            }
        });
        complete();
    };
    SyncStorage.prototype.getIndex = function (table, complete, error) {
        complete(this._index[table].slice());
    };
    SyncStorage.prototype.getNumberOfRecords = function (table, complete, error) {
        complete(this._index[table].length);
    };
    return SyncStorage;
}());
exports.SyncStorage = SyncStorage;
//# sourceMappingURL=syncStorage.js.map