"use strict";
var index_1 = require("./index");
var db_query_1 = require("./db-query");
// Bypass uglifyjs minifaction of these properties
var _str = function (index) {
    return ["_utility", "_historyPoints"][index];
};
// tslint:disable-next-line
var _NanoSQL_Storage = (function () {
    function _NanoSQL_Storage(database, args) {
        this._savedArgs = args;
        this.init(database, args);
    }
    /**
     * Setup persistent storage engine and import any existing data into memory.
     *
     * @static
     * @param {_NanoSQLDB} database
     * @param {DBConnect} args
     * @returns {boolean}
     *
     * @memberOf _NanoSQL_Persistent
     */
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
                // WSQL: 3,
                LVL: 4
            }[args._config[0].mode] || 0;
        }
        var upgrading = false;
        var index = 0;
        var isNewStore = true;
        Object.keys(args._models).forEach(function (t) {
            args._models["_" + t + "_hist__data"] = index_1._assign(args._models[t]);
            args._models["_" + t + "_hist__data"] = args._models["_" + t + "_hist__data"].map(function (m) {
                delete m.props;
                return m;
            });
            // args._models["_" + t + "_hist__data"].unshift({key: "__id", type: "int", props:["ai", "pk"]});
            args._models["_" + t + "_hist__meta"] = [
                { key: "id", type: "int", props: ["ai", "pk"] },
                { key: "_pointer", type: "int" },
                { key: "_historyDataRowIDs", type: "array" },
            ];
        });
        args._models[_str(0)] = [
            { key: "key", type: "string", props: ["pk"] },
            { key: "value", type: "blob" },
        ];
        args._models[_str(1)] = [
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
                t._read(_str(0), "all", function (rows) {
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
        /**
         * mode 0: no persistent storage, memory only
         * mode 1: Indexed DB // Preferred, forward compatible browser persistence
         * mode 2: Local Storage // Default fallback
         * mode 3: WebSQL // No longer planned
         * mode 4: Level Up // Used by NodeJS
         */
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
                        t._mode = 2; // Local storage is the fail safe
                    if (typeof indexedDB !== "undefined")
                        t._mode = 1; // Use indexedDB instead if it's there
                }
                if (typeof levelup !== "undefined" && typeof fs !== "undefined") {
                    t._mode = 4; // Use LevelUp in NodeJS if it's there.
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
                // Called only when there is no existing DB, creates the tables and data store.
                idb.onupgradeneeded = function (event) {
                    upgrading = true;
                    var db = event.target.result;
                    var transaction = event.target.transaction;
                    t._indexedDB = db;
                    var next = function () {
                        if (index < tables.length) {
                            var ta = index_1.NanoSQLInstance._hash(tables[index]);
                            var config = t._tables[ta]._pk ? { keyPath: t._tables[ta]._pk } : {};
                            db.createObjectStore(t._tables[ta]._name, config); // Standard Tables
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
                // Called once the database is connected and working
                idb.onsuccess = function (event) {
                    t._indexedDB = event.target.result;
                    // Called to import existing indexed DB data into the memory store.
                    if (!upgrading) {
                        isNewStore = false;
                        var next_1 = function () {
                            if (index >= tables.length) {
                                completeSetup();
                                return;
                            }
                            // Do not import history tables if history is disabled.
                            if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                index++;
                                next_1();
                                return;
                            }
                            // Load data from indexed DB into memory store
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
                    // import indexes no matter what
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
                    // only import data if the memory store is enabled
                    if (t._storeMemory) {
                        var tIndex_1 = 0;
                        var step_2 = function () {
                            if (tIndex_1 < tables.length) {
                                var items_2 = [];
                                // Do not import history tables if history is disabled.
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
            /* NODE-START */
            case 4:
                // Called to import existing  data into the memory store.
                var existingStore = function () {
                    isNewStore = false;
                    var next = function () {
                        if (index < tables.length) {
                            // Do not import history tables if history is disabled.
                            if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                                index++;
                                next();
                                return;
                            }
                            // Load data from level up into memory store
                            if (index < tables.length) {
                                var ta_2 = index_1.NanoSQLInstance._hash(tables[index]);
                                var items_3 = [];
                                if (t._storeMemory) {
                                    t._levelDBs[tables[index]].createValueStream()
                                        .on("data", function (data) {
                                        items_3.push(JSON.parse(data));
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
                if (!fs.existsSync(dbFolder_1)) {
                    fs.mkdirSync(dbFolder_1);
                    existing = false;
                }
                tables.forEach(function (table) {
                    t._levelDBs[table] = levelup(dbFolder_1 + "/" + table);
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
    _NanoSQL_Storage.prototype._clearHistory = function (complete) {
        var t = this;
        var tables = Object.keys(t._tables);
        var index = 0;
        var step = function () {
            if (index < tables.length) {
                if (tables[index].indexOf("_hist__meta") !== -1) {
                }
                if (tables[index].indexOf("_hist__data") !== -1) {
                }
                if (tables[index] === "_historyPoints") {
                }
            }
            else {
                complete();
            }
        };
        step();
    };
    _NanoSQL_Storage.prototype._delete = function (tableName, rowID, callBack) {
        var t = this;
        var editingHistory = false;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        t._tables[ta]._index.splice(t._tables[ta]._index.indexOf(String(rowID)), 1); // Update Index
        if (t._storeMemory) {
            console.log(t._tables);
            delete t._tables[ta]._rows[rowID];
            if (t._mode === 0 && callBack)
                return callBack(true);
        }
        switch (t._mode) {
            case 1:
                var transaction = t._indexedDB.transaction(tableName, "readwrite").objectStore(tableName);
                transaction.delete(rowID);
                if (callBack)
                    callBack(true);
                break;
            case 2:
                localStorage.removeItem(tableName + "-" + String(rowID));
                localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                if (callBack)
                    callBack(true);
                break;
            /* NODE-START */
            case 4:
                t._levelDBs[tableName].del(rowID, function () {
                    if (callBack)
                        callBack(true);
                });
                break;
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
        // Index update
        if (t._tables[ta] && t._tables[ta]._index.indexOf(String(rowID)) === -1) {
            t._tables[ta]._index.push(String(rowID));
        }
        // Memory Store Update
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
            /* NODE-START */
            case 4:
                if (tableName.indexOf("_hist__data") !== -1) {
                    t._levelDBs[tableName].put(String(rowID), JSON.stringify(value), function () {
                        if (callBack)
                            callBack(rowID);
                    });
                }
                else {
                    if (value) {
                        t._levelDBs[tableName].put(String(rowID), JSON.stringify(value), function () {
                            if (callBack)
                                callBack(rowID);
                        });
                    }
                    else {
                        t._levelDBs[tableName].del(String(rowID), function () {
                            if (callBack)
                                callBack(rowID);
                        });
                    }
                }
                break;
        }
    };
    _NanoSQL_Storage.prototype._read = function (tableName, row, callBack) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        // Way faster to read directly from memory if we can.
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
                        rows_3.push(JSON.parse(data));
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
                    t._levelDBs[tableName].get(String(row), function (err, data) {
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
    _NanoSQL_Storage.prototype._clearAll = function (callBack) {
        var t = this;
        t._savedArgs._onSuccess = callBack;
        t._savedArgs._onFail = function () { };
        switch (t._mode) {
            case 0:
                t.init(t._parent, t._savedArgs);
                break;
            case 1:
                indexedDB.deleteDatabase(String(t._parent._databaseID)).onsuccess = function () {
                    t.init(t._parent, t._savedArgs);
                };
                break;
            case 2:
                localStorage.clear();
                t.init(t._parent, t._savedArgs);
                break;
            /* NODE-START */
            case 4:
                break;
        }
        if (callBack)
            callBack(true);
    };
    /**
     * Write or access utility options.
     *
     * @param {("r"|"w")} type
     * @param {string} key
     * @param {*} [value]
     * @returns
     *
     * @memberOf _NanoSQLDB
     */
    _NanoSQL_Storage.prototype._utility = function (type, key, value) {
        if (type === "r") {
            if (this._utilityTable[key]) {
                return this._utilityTable[key].value;
            }
            else {
                return null;
            }
        }
        else {
            this._upsert(_str(0), key, { key: key, value: value });
            this._utility[key] = {
                key: key,
                value: value
            };
            return value;
        }
    };
    /**
     * Setup a new table.
     *
     * @param {string} tableName
     * @param {DataModel[]} dataModels
     * @returns {string}
     *
     * @memberOf _NanoSQL_Storage
     */
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
        // Discover primary keys for each table
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
