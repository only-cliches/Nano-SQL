var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var lie_ts_1 = require("lie-ts");
var utilities_1 = require("../utilities");
var db_idx_1 = require("./db-idx");
/**
 * Handles IndexedDB with and without web workers.
 * Uses blob worker OR eval()s the worker and uses it inline.
 *
 * @export
 * @class _IndexedDBStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
var _IndexedDBStore = /** @class */ (function () {
    function _IndexedDBStore() {
        this._pkKey = {};
        this._pkType = {};
        this._dbIndex = {};
    }
    _IndexedDBStore.prototype.connect = function (complete) {
        var _this = this;
        var idb = indexedDB.open(this._id, 1);
        var upgrading = false;
        var idxes = {};
        // Called only when there is no existing DB, creates the tables and data store.
        // Sets indexes as empty arrays.
        idb.onupgradeneeded = function (event) {
            upgrading = true;
            _this._db = event.target.result;
            Object.keys(_this._dbIndex).forEach(function (table) {
                _this._db.createObjectStore(table, { keyPath: _this._pkKey[table] });
                idxes[table] = [];
            });
        };
        // Called once the database is connected and working
        // If an onupgrade wasn't called it's an existing DB, so we import indexes
        idb.onsuccess = function (event) {
            _this._db = event.target.result;
            if (!upgrading) {
                var getIDBIndex_1 = function (tName, callBack) {
                    var items = [];
                    _this.store(tName, "readonly", function (transaction, store) {
                        var cursorRequest = store.openCursor();
                        cursorRequest.onsuccess = function (evt) {
                            var cursor = evt.target.result;
                            if (cursor) {
                                items.push(cursor.key);
                                cursor.continue();
                            }
                        };
                        transaction.oncomplete = function () {
                            callBack(items);
                        };
                    });
                };
                utilities_1.fastALL(Object.keys(_this._dbIndex), function (table, i, tDone) {
                    getIDBIndex_1(table, function (index) {
                        _this._dbIndex[table].set(index);
                        tDone();
                    });
                }).then(function () {
                    complete();
                });
            }
            else {
                complete();
            }
        };
    };
    _IndexedDBStore.prototype.store = function (table, type, open) {
        var transaction = this._db.transaction(table, type);
        open(transaction, transaction.objectStore(table));
    };
    _IndexedDBStore.prototype.setID = function (id) {
        this._id = id;
    };
    _IndexedDBStore.prototype.makeTable = function (tableName, dataModels) {
        var _this = this;
        this._dbIndex[tableName] = new db_idx_1.DatabaseIndex();
        dataModels.forEach(function (d) {
            if (d.props && utilities_1.intersect(["pk", "pk()"], d.props)) {
                _this._pkType[tableName] = d.type;
                _this._pkKey[tableName] = d.key;
                if (d.props && utilities_1.intersect(["ai", "ai()"], d.props) && (d.type === "int" || d.type === "number")) {
                    _this._dbIndex[tableName].doAI = true;
                }
            }
        });
    };
    _IndexedDBStore.prototype.write = function (table, pk, data, complete) {
        pk = pk || utilities_1.generateID(this._pkType[table], this._dbIndex[table].ai);
        if (!pk) {
            throw new Error("nSQL: Can't add a row without a primary key!");
        }
        if (this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
        }
        var r = __assign({}, data, (_a = {}, _a[this._pkKey[table]] = pk, _a));
        this.store(table, "readwrite", function (transaction, store) {
            store.put(r);
            transaction.oncomplete = function (e) {
                complete(r);
            };
        });
        var _a;
    };
    _IndexedDBStore.prototype.delete = function (table, pk, complete) {
        var idx = this._dbIndex[table].indexOf(pk);
        if (idx !== -1) {
            this._dbIndex[table].remove(pk);
        }
        this.store(table, "readwrite", function (transaction, store) {
            transaction.oncomplete = function (e) {
                complete();
            };
            transaction.onerror = function (e) {
                complete();
            };
            if (pk === "_clear_") {
                store.clear();
            }
            else {
                store.delete(pk);
            }
        });
    };
    _IndexedDBStore.prototype.read = function (table, pk, callback) {
        if (this._dbIndex[table].indexOf(pk) === -1) {
            callback(null);
            return;
        }
        this.store(table, "readonly", function (transaction, store) {
            var singleReq = store.get(pk);
            singleReq.onsuccess = function () {
                callback(singleReq.result);
            };
        });
    };
    _IndexedDBStore.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
        var keys = this._dbIndex[table].keys();
        var usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        var ranges = usefulValues ? [from, to] : [0, keys.length - 1];
        if (!keys.length) {
            complete();
            return;
        }
        var lower = usePK && usefulValues ? from : keys[ranges[0]];
        var higher = usePK && usefulValues ? to : keys[ranges[1]];
        this.store(table, "readonly", function (transaction, store) {
            var rows = [];
            var cursorRequest = usefulValues ? store.openCursor(IDBKeyRange.bound(lower, higher)) : store.openCursor();
            transaction.oncomplete = function (e) {
                var i = 0;
                var getRow = function () {
                    if (rows[i]) {
                        rowCallback(rows[i], i, function () {
                            i++;
                            i % 500 === 0 ? lie_ts_1.setFast(getRow) : getRow(); // handle maximum call stack error
                        });
                    }
                    else {
                        complete();
                    }
                };
                getRow();
            };
            cursorRequest.onsuccess = function (evt) {
                var cursor = evt.target.result;
                if (cursor) {
                    rows.push(cursor.value);
                    cursor.continue();
                }
            };
        });
    };
    _IndexedDBStore.prototype.drop = function (table, callback) {
        var _this = this;
        var idx = new db_idx_1.DatabaseIndex();
        idx.doAI = this._dbIndex[table].doAI;
        this._dbIndex[table] = idx;
        this.delete(table, "_clear_", function () {
            var idx = new db_idx_1.DatabaseIndex();
            idx.doAI = _this._dbIndex[table].doAI;
            _this._dbIndex[table] = idx;
            callback();
        });
    };
    _IndexedDBStore.prototype.getIndex = function (table, getLength, complete) {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    };
    _IndexedDBStore.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            _this.drop(table, done);
        }).then(complete);
    };
    return _IndexedDBStore;
}());
exports._IndexedDBStore = _IndexedDBStore;
