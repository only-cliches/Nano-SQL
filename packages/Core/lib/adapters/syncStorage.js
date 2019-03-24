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
var interfaces_1 = require("../interfaces");
var utilities_1 = require("../utilities");
var memoryIndex_1 = require("./memoryIndex");
var SyncStorage = /** @class */ (function (_super) {
    __extends(SyncStorage, _super);
    function SyncStorage(useLS) {
        var _this = _super.call(this, true, false) || this;
        _this.useLS = useLS;
        _this.plugin = {
            name: "Sync Storage Adapter",
            version: interfaces_1.VERSION
        };
        _this._index = {};
        _this._rows = {};
        _this._ai = {};
        _this._tableConfigs = {};
        return _this;
    }
    SyncStorage.prototype.connect = function (id, complete, error) {
        this._id = id;
        complete();
    };
    SyncStorage.prototype.createTable = function (tableName, tableData, complete, error) {
        this._index[tableName] = [];
        this._rows[tableName] = {};
        this._tableConfigs[tableName] = tableData;
        if (this.useLS) {
            var index = localStorage.getItem(this._id + "->" + tableName + "_idx");
            if (index) {
                this._index[tableName] = JSON.parse(index);
                this._ai[tableName] = parseFloat(localStorage.getItem(this._id + "->" + tableName + "_ai") || "0");
            }
        }
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
        pk = pk || utilities_1.generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);
        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }
        if (this._tableConfigs[table].ai) {
            this._ai[table] = Math.max(this._ai[table] || 0, pk);
        }
        if (this._index[table].indexOf(pk) === -1) {
            var loc = utilities_1.binarySearch(this._index[table], pk, false);
            this._index[table].splice(loc, 0, pk);
            if (this.useLS) {
                localStorage.setItem(this._id + "->" + table + "_idx", JSON.stringify(this._index[table]));
                localStorage.setItem(this._id + "->" + table + "_ai", String(this._ai[table]));
            }
        }
        utilities_1.deepSet(this._tableConfigs[table].pkCol, row, pk);
        if (this.useLS) {
            localStorage.setItem(this._id + "->" + table + "__" + pk, JSON.stringify(row));
            complete(pk);
        }
        else {
            this._rows[table][pk] = utilities_1.deepFreeze(row);
            complete(pk);
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
    SyncStorage.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var _this = this;
        var range = {
            "range": [offsetOrLow, limitOrHigh],
            "offset": [offsetOrLow, offsetOrLow + limitOrHigh],
            "all": []
        }[type];
        var idxArr = (function () {
            switch (type) {
                case "all":
                    return _this._index[table].slice();
                case "offset":
                    var l = _this._index[table].length - 1;
                    return reverse ? _this._index[table].slice(l - range[1], l - range[0]) : _this._index[table].slice(range[0], range[1]);
                case "range":
                    var lowIdx = utilities_1.binarySearch(_this._index[table], range[0], false);
                    var highIdx = utilities_1.binarySearch(_this._index[table], range[1], false);
                    while (_this._index[table][highIdx] > range[1]) {
                        highIdx--;
                    }
                    while (_this._index[table][lowIdx] < range[0]) {
                        lowIdx++;
                    }
                    return _this._index[table].slice(lowIdx, highIdx + 1);
            }
            return [];
        })();
        if (reverse) {
            idxArr.reverse();
        }
        idxArr.forEach(function (pk, i) {
            if (_this.useLS) {
                onRow(JSON.parse(localStorage.getItem(_this._id + "->" + table + "__" + pk) || "{}"), i);
            }
            else {
                onRow(_this._rows[table][pk], i);
            }
        });
        complete();
    };
    SyncStorage.prototype.getTableIndex = function (table, complete, error) {
        complete(this._index[table].slice());
    };
    SyncStorage.prototype.getTableIndexLength = function (table, complete, error) {
        complete(this._index[table].length);
    };
    return SyncStorage;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.SyncStorage = SyncStorage;
//# sourceMappingURL=syncStorage.js.map