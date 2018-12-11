Object.defineProperty(exports, "__esModule", { value: true });
var interfaces_1 = require("../interfaces");
var utilities_1 = require("../utilities");
var IndexedDB = /** @class */ (function () {
    function IndexedDB(version) {
        this.version = version;
        this.plugin = {
            name: "IndexedDB Adapter",
            version: interfaces_1.VERSION
        };
        this._db = {};
        this._ai = {};
    }
    IndexedDB.prototype.connect = function (id, complete, error) {
        this._id = id;
        complete();
    };
    IndexedDB.prototype.createAndInitTable = function (tableName, tableData, complete, error) {
        var _this = this;
        var version = 1;
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
                _this._db[tableName].createObjectStore(tableName, { keyPath: tableData.pkCol });
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
        pk = pk || utilities_1.generateID(this.nSQL.tables[table].pkType, this._ai[table] + 1);
        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }
        this._ai[table] = Math.max(pk, this._ai[table]);
        if (this.nSQL.tables[table].ai) {
            this._ai[table] = utilities_1.cast("int", Math.max(this._ai[table] || 0, pk));
            localStorage.setItem(this._id + "_" + table + "_idb_ai", String(this._ai[table]));
        }
        row[this.nSQL.tables[table].pkCol] = pk;
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
            singleReq.onerror = function () {
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
        this.store(table, "readonly", function (tr, store) {
            store.openCursor((type === "all" || doOffset) ? undefined : IDBKeyRange.bound(offsetOrLow, limitOrHigh, false, true), reverse ? "prev" : "next").onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (doOffset) {
                        if (lowerLimit <= count && upperLimit > count) {
                            onRow(cursor.value, count - offsetOrLow);
                        }
                    }
                    else {
                        onRow(cursor.value, count);
                    }
                    count++;
                    cursor.continue();
                }
                else {
                    complete();
                }
            };
        }, error);
    };
    IndexedDB.prototype.getIndex = function (table, complete, error) {
        var _this = this;
        var index = [];
        this.store(table, "readonly", function (tr, store) {
            store.openCursor().onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    index.push(cursor.value[_this.nSQL.tables[table].pkCol]);
                    cursor.continue();
                }
                else {
                    complete(index);
                }
            };
        }, error);
    };
    IndexedDB.prototype.getNumberOfRecords = function (table, complete, error) {
        var count = 0;
        this.store(table, "readonly", function (tr, store) {
            store.openCursor().onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    count++;
                    cursor.continue();
                }
                else {
                    complete(count);
                }
            };
        }, error);
    };
    return IndexedDB;
}());
exports.IndexedDB = IndexedDB;
//# sourceMappingURL=indexedDB.js.map