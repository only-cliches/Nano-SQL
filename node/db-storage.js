var index_1 = require("./index");
var db_index_1 = require("./db-index");
var db_query_1 = require("./db-query");
var _NanoSQL_Storage = (function () {
    function _NanoSQL_Storage(database, args) {
        this._savedArgs = args;
        this.init(database, args);
    }
    _NanoSQL_Storage.prototype.init = function (database, args) {
        var t = this;
        t._models = {};
        t._tables = {};
        t._levelDBs = {};
        t._historyPoint = 0;
        t._historyLength = 0;
        t._historyArray = [0, 0];
        t._doingTransaction = false;
        t._doHistory = true;
        t._storeMemory = true;
        t._persistent = false;
        t._utilityTable = {};
        t._mode = 0;
        t._parent = database;
        var size = 5;
        if (args._config.length) {
            t._persistent = args._config[0].persistent !== undefined ? args._config[0].persistent : false;
            t._doHistory = args._config[0].history !== undefined ? args._config[0].history : true;
            t._storeMemory = args._config[0].memory !== undefined ? args._config[0].memory : true;
            size = args._config[0].size || 5;
            t._mode = {
                IDB: 1,
                LS: 2,
                LVL: 4
            }[args._config[0].mode] || 0;
        }
        var upgrading = false;
        var index = 0;
        var isNewStore = true;
        Object.keys(args._models).forEach(function (t) {
            var pkRow;
            args._models[t].forEach(function (m) {
                if (m.props && m.props.indexOf("pk") !== -1)
                    pkRow = index_1._assign(m);
            });
            if (pkRow) {
                args._models["_" + t + "_hist__data"] = index_1._assign(args._models[t]).map(function (m) {
                    delete m.props;
                    return m;
                });
                args._models["_" + t + "_hist__meta"] = [
                    pkRow,
                    { key: "_pointer", type: "int" },
                    { key: "_historyDataRowIDs", type: "array" },
                ];
            }
        });
        args._models[db_index_1._str(0)] = [
            { key: "key", type: "string", props: ["pk"] },
            { key: "value", type: "blob" },
        ];
        args._models[db_index_1._str(1)] = [
            { key: "id", type: "int", props: ["ai", "pk"] },
            { key: "tableID", type: "int" },
            { key: "historyPoint", type: "int" },
            { key: "rowKeys", type: "array" },
            { key: "type", type: "string" }
        ];
        var tables = Object.keys(args._models);
        var beforeHist;
        var beforeMode;
        Object.keys(args._models).forEach(function (tableName) {
            t._newTable(tableName, args._models[tableName]);
        });
        Object.keys(args._functions || []).forEach(function (f) {
            db_query_1._functions[f] = args._functions[f];
        });
        var completeSetup = function () {
            var tables = Object.keys(args._models);
            var i = 0;
            t._mode = beforeMode;
            if (beforeHist) {
                t._read(db_index_1._str(0), "all", function (rows) {
                    rows.forEach(function (d) {
                        t._utility("w", d.key, d.value);
                        if (d.key === "historyPoint")
                            t._historyPoint = d.value || 0;
                        if (d.key === "historyLength")
                            t._historyLength = d.value || 0;
                    });
                });
            }
            if (isNewStore) {
                var step_1 = function () {
                    if (i < tables.length) {
                        if (tables[i].indexOf("_hist__data") !== -1) {
                            t._upsert(tables[i], 0, null, function () {
                                i++;
                                step_1();
                            });
                        }
                        else {
                            i++;
                            step_1();
                        }
                    }
                    else {
                        t._doHistory = beforeHist;
                        args._onSuccess();
                    }
                };
                step_1();
            }
            else {
                t._doHistory = beforeHist;
                args._onSuccess();
            }
        };
        beforeMode = t._mode;
        if (t._persistent) {
            if (t._mode !== 0) {
                switch (t._mode) {
                    case 1:
                        if (typeof indexedDB === "undefined")
                            t._mode = 0;
                        break;
                    case 2:
                        if (typeof localStorage === "undefined")
                            t._mode = 0;
                        break;
                    case 4:
                        if (typeof window !== "undefined")
                            t._mode = 0;
                        break;
                }
            }
            else {
                if (typeof window !== "undefined") {
                    if (typeof localStorage !== "undefined")
                        t._mode = 2;
                    if (typeof indexedDB !== "undefined")
                        t._mode = 1;
                }
                if (typeof global !== "undefined") {
                    if (typeof global._levelup !== "undefined" && typeof global._fs !== "undefined") {
                        t._mode = 4;
                    }
                }
            }
        }
        else {
            t._mode = 0;
            completeSetup();
        }
        beforeHist = t._doHistory;
        beforeMode = t._mode;
        t._mode = 0;
        t._doHistory = false;
        switch (beforeMode) {
            case 0:
                completeSetup();
                break;
            case 1:
                var idb = indexedDB.open(String(t._parent._databaseID), 1);
                idb.onupgradeneeded = function (event) {
                    upgrading = true;
                    var db = event.target.result;
                    var transaction = event.target.transaction;
                    t._indexedDB = db;
                    var next = function () {
                        if (index < tables.length) {
                            var ta = index_1.NanoSQLInstance._hash(tables[index]);
                            var config = t._tables[ta]._pk ? { keyPath: t._tables[ta]._pk } : {};
                            db.createObjectStore(t._tables[ta]._name, config);
                            index++;
                            next();
                        }
                        else {
                            transaction.oncomplete = function () {
                                completeSetup();
                            };
                        }
                    };
                    next();
                };
                idb.onsuccess = function (event) {
                    t._indexedDB = event.target.result;
                    if (!upgrading) {
                        isNewStore = false;
                        var next_1 = function () {
                            if (index >= tables.length) {
                                completeSetup();
                                return;
                            }
                            if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                index++;
                                next_1();
                                return;
                            }
                            if (index < tables.length) {
                                var ta_1 = index_1.NanoSQLInstance._hash(tables[index]);
                                var transaction = t._indexedDB.transaction(tables[index], "readonly");
                                var store = transaction.objectStore(tables[index]);
                                var cursorRequest = store.openCursor();
                                var items_1 = [];
                                transaction.oncomplete = function () {
                                    if (t._storeMemory) {
                                        if (tables[index].indexOf("_hist__data") !== -1) {
                                            t._tables[ta_1]._index.push("0");
                                            t._tables[ta_1]._rows["0"] = null;
                                            t._tables[ta_1]._incriment++;
                                            t._parent._parent.loadJS(tables[index], items_1).then(function () {
                                                index++;
                                                next_1();
                                            });
                                        }
                                        else {
                                            t._parent._parent.loadJS(tables[index], items_1).then(function () {
                                                index++;
                                                next_1();
                                            });
                                        }
                                    }
                                    else {
                                        t._tables[ta_1]._index = items_1;
                                        t._tables[ta_1]._incriment = items_1.reduce(function (prev, cur) {
                                            return Math.max(parseInt(cur), prev);
                                        }, 0) + 1;
                                        index++;
                                        next_1();
                                    }
                                };
                                cursorRequest.onsuccess = function (evt) {
                                    var cursor = evt.target.result;
                                    if (cursor) {
                                        items_1.push(t._storeMemory ? cursor.value : cursor.key);
                                        cursor.continue();
                                    }
                                };
                            }
                        };
                        next_1();
                    }
                    ;
                };
                break;
            case 2:
                if (localStorage.getItem("dbID") !== String(t._parent._databaseID)) {
                    localStorage.clear();
                    localStorage.setItem("dbID", String(t._parent._databaseID));
                    tables.forEach(function (table) {
                        var ta = index_1.NanoSQLInstance._hash(table);
                        localStorage.setItem(table, JSON.stringify([]));
                    });
                    completeSetup();
                }
                else {
                    isNewStore = false;
                    tables.forEach(function (tName) {
                        var ta = index_1.NanoSQLInstance._hash(tName);
                        var tableIndex = JSON.parse(localStorage.getItem(tName) || "[]");
                        t._tables[ta]._index = tableIndex;
                        if (!t._storeMemory) {
                            t._tables[ta]._incriment = tableIndex.reduce(function (prev, cur) {
                                return Math.max(parseInt(cur), prev);
                            }, 0) + 1;
                        }
                    });
                    if (t._storeMemory) {
                        var tIndex_1 = 0;
                        var step_2 = function () {
                            if (tIndex_1 < tables.length) {
                                var items_2 = [];
                                if (!beforeHist && (tables[tIndex_1].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                    tIndex_1++;
                                    step_2();
                                    return;
                                }
                                JSON.parse(localStorage.getItem(tables[tIndex_1]) || "[]").forEach(function (ptr) {
                                    items_2.push(JSON.parse(localStorage.getItem(tables[tIndex_1] + "-" + ptr) || ""));
                                });
                                t._parent._parent.loadJS(tables[tIndex_1], items_2).then(function () {
                                    tIndex_1++;
                                    step_2();
                                });
                            }
                            else {
                                completeSetup();
                            }
                        };
                        step_2();
                    }
                    else {
                        completeSetup();
                    }
                }
                break;
            case 4:
                var existingStore = function () {
                    isNewStore = false;
                    var next = function () {
                        if (index < tables.length) {
                            if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                index++;
                                next();
                                return;
                            }
                            if (index < tables.length) {
                                var ta_2 = index_1.NanoSQLInstance._hash(tables[index]);
                                var items_3 = [];
                                if (t._storeMemory) {
                                    t._levelDBs[tables[index]].createValueStream()
                                        .on("data", function (data) {
                                        items_3.push(data);
                                    })
                                        .on("end", function () {
                                        if (tables[index].indexOf("_hist__data") !== -1) {
                                            t._tables[ta_2]._index.push("0");
                                            t._tables[ta_2]._rows["0"] = null;
                                            t._tables[ta_2]._incriment++;
                                            t._parent._parent.table().loadJS(tables[index], items_3).then(function () {
                                                index++;
                                                next();
                                            });
                                        }
                                        else {
                                            t._parent._parent.loadJS(tables[index], items_3).then(function () {
                                                index++;
                                                next();
                                            });
                                        }
                                    });
                                }
                                else {
                                    t._levelDBs[tables[index]].createKeyStream()
                                        .on("data", function (data) {
                                        items_3.push(data);
                                    })
                                        .on("end", function () {
                                        t._tables[ta_2]._index = items_3;
                                        t._tables[ta_2]._incriment = items_3.reduce(function (prev, cur) {
                                            return Math.max(parseInt(cur), prev);
                                        }, 0) + 1;
                                        index++;
                                        next();
                                    });
                                }
                            }
                        }
                        else {
                            completeSetup();
                            return;
                        }
                    };
                    next();
                };
                var dbFolder_1 = "./db_" + t._parent._databaseID;
                var existing = true;
                if (!global._fs.existsSync(dbFolder_1)) {
                    global._fs.mkdirSync(dbFolder_1);
                    existing = false;
                }
                tables.forEach(function (table) {
                    t._levelDBs[table] = global._levelup(dbFolder_1 + "/" + table, {
                        valueEncoding: "json"
                    });
                });
                if (existing) {
                    existingStore();
                }
                else {
                    completeSetup();
                }
                break;
        }
    };
    _NanoSQL_Storage.prototype._clear = function (type, complete) {
        var t = this;
        var tables = Object.keys(t._tables).map(function (k) { return t._tables[k]._name; });
        var index = 0;
        var setupNewHist = function () {
            var index = 0;
            var histStep = function () {
                if (index < tables.length) {
                    if (tables[index].indexOf("_hist__meta") !== -1) {
                        var referenceTable_1 = String(tables[index]).slice(1).replace("_hist__meta", "");
                        var ta = index_1.NanoSQLInstance._hash(referenceTable_1);
                        var pk_1 = t._tables[ta]._pk;
                        t._read(referenceTable_1, "all", function (rows) {
                            rows.forEach(function (row, i) {
                                var hist = {};
                                hist[db_index_1._str(2)] = 0;
                                hist[db_index_1._str(3)] = [i + 1];
                                t._upsert(tables[index], row[pk_1], hist);
                                t._upsert("_" + referenceTable_1 + "_hist__data", i + 1, row);
                            });
                            index++;
                            histStep();
                        });
                    }
                    else {
                        index++;
                        histStep();
                    }
                }
                else {
                    complete();
                }
            };
            histStep();
        };
        var step = function () {
            if (index < tables.length) {
                var deleteTable = false;
                if (type === "hist" && (tables[index] === "_historyPoints" || tables[index].indexOf("_hist__meta") !== -1 || tables[index].indexOf("_hist__data") !== -1)) {
                    deleteTable = true;
                }
                if (type === "all" && tables[index] !== "_utility") {
                    deleteTable = true;
                }
                if (deleteTable) {
                    t._delete(tables[index], "all", function () {
                        if (tables[index].indexOf("_hist__data") !== -1) {
                            t._upsert(tables[index], 0, null);
                        }
                        index++;
                        step();
                    });
                }
                else {
                    index++;
                    step();
                }
            }
            else {
                if (type === "hist") {
                    setupNewHist();
                }
                else {
                    complete();
                }
            }
        };
        step();
    };
    _NanoSQL_Storage.prototype._delete = function (tableName, rowID, callBack) {
        var t = this;
        var editingHistory = false;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        var deleteRowIDS = [];
        if (rowID === "all") {
            deleteRowIDS = t._tables[ta]._index.slice();
            t._tables[ta]._index = [];
        }
        else {
            deleteRowIDS.push(rowID);
            t._tables[ta]._index.splice(t._tables[ta]._index.indexOf(rowID), 1);
        }
        if (t._storeMemory) {
            if (rowID === "all") {
                t._tables[ta]._rows = {};
            }
            else {
                delete t._tables[ta]._rows[rowID];
                if (t._mode === 0 && callBack)
                    return callBack(true);
            }
        }
        if (t._mode > 0) {
            var i_1 = 0;
            var step_3 = function () {
                if (i_1 < deleteRowIDS.length) {
                    switch (t._mode) {
                        case 1:
                            t._indexedDB.transaction(tableName, "readwrite").objectStore(tableName).delete(parseInt(deleteRowIDS[i_1]));
                            i_1++;
                            step_3();
                            break;
                        case 2:
                            localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                            localStorage.removeItem(tableName + "-" + String(deleteRowIDS[i_1]));
                            i_1++;
                            step_3();
                            break;
                        case 4:
                            t._levelDBs[tableName].del(deleteRowIDS[i_1], function () {
                                i_1++;
                                step_3();
                            });
                            break;
                        default:
                            i_1++;
                            step_3();
                    }
                }
                else {
                    if (callBack)
                        callBack(true);
                }
            };
            step_3();
        }
    };
    _NanoSQL_Storage.prototype._upsert = function (tableName, rowID, value, callBack) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        if (rowID === undefined || rowID === null) {
            t._models[ta].forEach(function (m) {
                if (m.props && m.props.indexOf("pk") !== -1) {
                    if (m.type === "uuid") {
                        rowID = index_1.NanoSQLInstance.uuid();
                    }
                    else {
                        rowID = t._tables[ta]._incriment++;
                    }
                }
            });
            if (!rowID)
                rowID = parseInt(t._tables[ta]._index[t._tables[ta]._index.length - 1] || "0") + 1;
        }
        if (t._tables[ta]._pkType === "int")
            rowID = parseInt(rowID);
        var pk = t._tables[ta]._pk;
        if (pk && pk.length && value && !value[pk]) {
            value[pk] = rowID;
        }
        if (t._tables[ta] && t._tables[ta]._index.indexOf(rowID) === -1) {
            t._tables[ta]._index.push(rowID);
        }
        if (t._storeMemory && t._tables[ta]) {
            t._tables[ta]._rows[rowID] = t._parent._deepFreeze(value, ta);
            if (t._mode === 0 && callBack)
                return callBack(rowID);
        }
        switch (t._mode) {
            case 1:
                var transaction = t._indexedDB.transaction(tableName, "readwrite");
                var store = transaction.objectStore(tableName);
                if (pk.length && value) {
                    store.put(value);
                }
                else {
                    if (tableName.indexOf("_hist__data") !== -1) {
                        store.put(value, rowID);
                    }
                    else {
                        if (value)
                            store.put(value);
                        if (!value)
                            store.delete(rowID);
                    }
                }
                transaction.oncomplete = function () {
                    if (callBack)
                        callBack(rowID);
                };
                break;
            case 2:
                localStorage.setItem(tableName + "-" + String(rowID), value ? JSON.stringify(value) : "");
                localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                if (callBack)
                    callBack(rowID);
                break;
            case 4:
                if (tableName.indexOf("_hist__data") !== -1) {
                    t._levelDBs[tableName].put(rowID, value ? value : null, function () {
                        if (callBack)
                            callBack(rowID);
                    });
                }
                else {
                    if (value) {
                        t._levelDBs[tableName].put(rowID, value, function () {
                            if (callBack)
                                callBack(rowID);
                        });
                    }
                    else {
                        t._levelDBs[tableName].del(rowID, function () {
                            if (callBack)
                                callBack(rowID);
                        });
                    }
                }
                break;
        }
    };
    _NanoSQL_Storage.prototype._readRange = function (tableName, key, between, callBack) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        if ((t._storeMemory && t._tables[ta]) || t._mode === 2) {
            this._read(tableName, function (row) {
                return row[key] >= between[0] && row[key] <= between[1];
            }, callBack);
            return;
        }
        var rows = [];
        switch (t._mode) {
            case 1:
                var transaction = t._indexedDB.transaction(tableName, "readonly");
                var store = transaction.objectStore(tableName);
                var cursorRequest = store.openCursor(IDBKeyRange.bound(between[0], between[1]));
                transaction.oncomplete = function () {
                    callBack(rows);
                };
                cursorRequest.onsuccess = function (evt) {
                    var cursor = evt.target.result;
                    if (cursor) {
                        rows.push(cursor.value);
                        cursor.continue();
                    }
                };
                break;
            case 4:
                t._levelDBs[tableName].createValueStream({
                    gte: between[0],
                    lte: between[1]
                })
                    .on("data", function (data) {
                    if (data)
                        rows.push(data);
                })
                    .on("end", function () {
                    callBack(rows);
                });
                break;
        }
    };
    _NanoSQL_Storage.prototype._read = function (tableName, row, callBack) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        if (t._storeMemory && t._tables[ta]) {
            var rows_1 = t._tables[ta]._rows;
            if (row === "all" || typeof row === "function") {
                var allRows = Object.keys(rows_1).map(function (r) { return rows_1[r]; });
                if (row === "all") {
                    callBack(allRows.filter(function (r) { return r; }));
                }
                else {
                    callBack(allRows.filter(function (r) { return row(r); }));
                }
            }
            else {
                callBack([rows_1[row]].filter(function (r) { return r; }));
            }
            return;
        }
        switch (t._mode) {
            case 1:
                var transaction = t._indexedDB.transaction(tableName, "readonly");
                var store = transaction.objectStore(tableName);
                if (row === "all" || typeof row === "function") {
                    var cursorRequest = store.openCursor();
                    var rows_2 = [];
                    transaction.oncomplete = function () {
                        callBack(rows_2);
                    };
                    cursorRequest.onsuccess = function (evt) {
                        var cursor = evt.target.result;
                        if (cursor) {
                            if (row !== "all") {
                                if (row(cursor.value))
                                    rows_2.push(cursor.value);
                            }
                            else {
                                rows_2.push(cursor.value);
                            }
                            cursor.continue();
                        }
                    };
                }
                else {
                    var singleReq_1 = store.get(row);
                    singleReq_1.onsuccess = function (event) {
                        callBack([singleReq_1.result]);
                    };
                }
                break;
            case 2:
                if (row === "all" || typeof row === "function") {
                    var rows = t._tables[ta]._index.map(function (idx) {
                        var item = localStorage.getItem(tableName + "-" + idx);
                        return item && item.length ? JSON.parse(item) : null;
                    });
                    if (row !== "all") {
                        callBack(rows.filter(function (r) { return row(r); }));
                    }
                    else {
                        callBack(rows);
                    }
                }
                else {
                    var item = localStorage.getItem(tableName + "-" + row);
                    callBack([item && item.length ? JSON.parse(item) : null]);
                }
                break;
            case 4:
                if (row === "all" || typeof row === "function") {
                    var rows_3 = [];
                    t._levelDBs[tableName].createValueStream()
                        .on("data", function (data) {
                        if (data)
                            rows_3.push(data);
                    })
                        .on("end", function () {
                        if (row !== "all") {
                            callBack(rows_3.filter(function (r) { return row(r); }));
                        }
                        else {
                            callBack(rows_3);
                        }
                    });
                }
                else {
                    t._levelDBs[tableName].get(row, function (err, data) {
                        if (err) {
                            callBack([null]);
                        }
                        else {
                            callBack([JSON.parse(data)]);
                        }
                    });
                }
                break;
        }
    };
    _NanoSQL_Storage.prototype._utility = function (type, key, value) {
        var t = this;
        if (type === "r") {
            if (t._utilityTable[key]) {
                return t._utilityTable[key].value;
            }
            else {
                return null;
            }
        }
        else {
            t._upsert(db_index_1._str(0), key, { key: key, value: value });
            t._utility[key] = {
                key: key,
                value: value
            };
            return value;
        }
    };
    _NanoSQL_Storage.prototype._newTable = function (tableName, dataModels) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        t._models[ta] = dataModels;
        t._parent._queryCache[ta] = {};
        t._tables[ta] = {
            _pk: "",
            _pkType: "",
            _keys: [],
            _defaults: [],
            _name: tableName,
            _incriment: 1,
            _index: [],
            _rows: {}
        };
        var i = t._models[ta].length;
        var keys = [];
        var defaults = [];
        while (i--) {
            var p = t._models[ta][i];
            t._tables[ta]._keys.unshift(p.key);
            t._tables[ta]._defaults[i] = p.default;
            if (p.props && p.props.indexOf("pk") >= 0) {
                t._tables[ta]._pk = p.key;
                t._tables[ta]._pkType = p.type;
            }
        }
        return tableName;
    };
    return _NanoSQL_Storage;
}());
exports._NanoSQL_Storage = _NanoSQL_Storage;
