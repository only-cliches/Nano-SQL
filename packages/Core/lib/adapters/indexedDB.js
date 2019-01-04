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
Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = require("../interfaces");
var utilities_1 = require("../utilities");
var memoryIndex_1 = require("./memoryIndex");
var IndexedDB = /** @class */ (function (_super) {
    __extends(IndexedDB, _super);
    function IndexedDB(version) {
        var _this = _super.call(this, false, false) || this;
        _this.version = version;
        _this.plugin = {
            name: "IndexedDB Adapter",
            version: interfaces_1.VERSION
        };
        _this._db = {};
        _this._ai = {};
        _this._tableConfigs = {};
        return _this;
    }
    IndexedDB.prototype.connect = function (id, complete, error) {
        this._id = id;
        complete();
    };
    IndexedDB.prototype.createTable = function (tableName, tableData, complete, error) {
        var _this = this;
        var version = 1;
        this._tableConfigs[tableName] = tableData;
        var dataModelHash = utilities_1.hash(JSON.stringify(tableData.columns));
        if (this.version) { // manually handled by developer
            version = this.version;
        }
        else { // automatically handled by nanoSQL
            version = parseInt(localStorage.getItem(this._id + "_" + tableName + "_idb_version") || "") || 1;
            var modelHash = localStorage.getItem(this._id + "_" + tableName + "_idb_hash") || dataModelHash;
            if (modelHash !== dataModelHash) {
                version++;
            }
            localStorage.setItem(this._id + "_" + tableName + "_idb_version", String(version));
            localStorage.setItem(this._id + "_" + tableName + "_idb_hash", dataModelHash);
        }
        var idb = indexedDB.open(this._id + "_" + tableName, version);
        this._ai[tableName] = parseInt(localStorage.getItem(this._id + "_" + tableName + "_idb_ai") || "0");
        idb.onerror = error;
        var isUpgrading = false;
        // Called only when there is no existing DB, creates the tables and data store.
        idb.onupgradeneeded = function (event) {
            _this._db[tableName] = event.target.result;
            if (!_this._db[tableName].objectStoreNames.contains(tableName)) {
                _this._db[tableName].createObjectStore(tableName, { keyPath: tableData.pkCol.join(".") });
            }
        };
        // Called once the database is connected
        idb.onsuccess = function (event) {
            _this._db[tableName] = event.target.result;
            complete();
        };
    };
    IndexedDB.prototype.disconnectTable = function (table, complete, error) {
        this._db[table].onerror = error;
        this._db[table].close();
        delete this._db[table];
        localStorage.removeItem(this._id + "_" + table + "_idb_version");
        localStorage.removeItem(this._id + "_" + table + "_idb_hash");
        localStorage.removeItem(this._id + "_" + table + "_idb_ai");
        complete();
    };
    IndexedDB.prototype.dropTable = function (table, complete, error) {
        var _this = this;
        // open a read/write db transaction, ready for clearing the data
        var tx = this._db[table].transaction(table, "readwrite");
        tx.onerror = error;
        var objectStoreRequest = tx.objectStore(table).clear();
        objectStoreRequest.onsuccess = function () {
            _this.disconnectTable(table, complete, error);
        };
    };
    IndexedDB.prototype.disconnect = function (complete, error) {
        complete();
    };
    IndexedDB.prototype.store = function (table, type, open, error) {
        var transaction = this._db[table].transaction(table, type);
        transaction.onabort = error;
        transaction.onerror = error;
        open(transaction, transaction.objectStore(table));
    };
    IndexedDB.prototype.write = function (table, pk, row, complete, error) {
        pk = pk || utilities_1.generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);
        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }
        this._ai[table] = Math.max(pk, this._ai[table]);
        if (this._tableConfigs[table].ai) {
            this._ai[table] = utilities_1.cast("int", Math.max(this._ai[table] || 0, pk));
            localStorage.setItem(this._id + "_" + table + "_idb_ai", String(this._ai[table]));
        }
        utilities_1.deepSet(this._tableConfigs[table].pkCol, row, pk);
        this.store(table, "readwrite", function (transaction, store) {
            try {
                store.put(row).onsuccess = function () {
                    complete(pk);
                };
            }
            catch (e) {
                error(e);
            }
        }, error);
    };
    IndexedDB.prototype.read = function (table, pk, complete, error) {
        this.store(table, "readonly", function (transaction, store) {
            var singleReq = store.get(pk);
            singleReq.onerror = function (err) {
                complete(undefined);
            };
            singleReq.onsuccess = function () {
                complete(singleReq.result);
            };
        }, error);
    };
    IndexedDB.prototype.delete = function (table, pk, complete, error) {
        this.store(table, "readwrite", function (transaction, store) {
            var req = store.delete(pk);
            req.onerror = error;
            req.onsuccess = function (e) {
                complete();
            };
        }, error);
    };
    IndexedDB.prototype.readMulti = function (table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error) {
        var doOffset = type === "offset";
        var count = 0;
        var lowerLimit = doOffset ? offsetOrLow : 0;
        var upperLimit = lowerLimit + limitOrHigh;
        var advancing = true;
        this.store(table, "readonly", function (tr, store) {
            store.openCursor(type !== "range" ? undefined : IDBKeyRange.bound(offsetOrLow, limitOrHigh, false, false), reverse ? "prev" : "next").onsuccess = function (event) {
                var cursor = event.target.result;
                if (!cursor) {
                    complete();
                    return;
                }
                if (type === "offset") {
                    if (advancing) {
                        var lower = reverse ? lowerLimit + 1 : lowerLimit;
                        cursor.advance(lower);
                        count = lower;
                        advancing = false;
                        return;
                    }
                    if (reverse ? upperLimit >= count : upperLimit > count) {
                        onRow(cursor.value, count - offsetOrLow);
                    }
                }
                else {
                    onRow(cursor.value, count);
                }
                count++;
                cursor.continue();
            };
        }, error);
    };
    IndexedDB.prototype.getTableIndex = function (table, complete, error) {
        var _this = this;
        var index = [];
        this.store(table, "readonly", function (tr, store) {
            store.openCursor().onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    index.push(utilities_1.deepGet(_this._tableConfigs[table].pkCol, cursor.value));
                    cursor.continue();
                }
                else {
                    complete(index);
                }
            };
        }, error);
    };
    IndexedDB.prototype.getTableIndexLength = function (table, complete, error) {
        var count = 0;
        this.store(table, "readonly", function (tr, store) {
            var ctRequest = tr.objectStore(table).count();
            ctRequest.onsuccess = function () {
                complete(ctRequest.result);
            };
            ctRequest.onerror = error;
        }, error);
    };
    return IndexedDB;
}(memoryIndex_1.nanoSQLMemoryIndex));
exports.IndexedDB = IndexedDB;
//# sourceMappingURL=indexedDB.js.map