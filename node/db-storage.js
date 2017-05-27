Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./index");
var db_index_1 = require("./db-index");
var db_query_1 = require("./db-query");
var lie_ts_1 = require("lie-ts");
var prefix_trie_ts_1 = require("prefix-trie-ts");
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
        t._activeTransactions = [];
        t._transactionData = {};
        t._doHistory = true;
        t._historyMode = 1;
        t._storeMemory = true;
        t._persistent = false;
        t._utilityTable = {};
        t._historyPointIndex = {};
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
            if (args._config[0].historyMode && args._config[0].history === "revisions") {
                t._historyMode = 2;
            }
            if (args._config[0].rebuildIndexes)
                t._rebuildIndexes = true;
            if (args._config[0].id)
                t._parent._databaseID = String(args._config[0].id);
        }
        var upgrading = false;
        var index = 0;
        var isNewStore = true;
        Object.keys(args._models).forEach(function (t) {
            var pkRow = { key: "x", type: "x" };
            var secondaryIndexes = [];
            args._models[t].forEach(function (m) {
                if (m.props && m.props.indexOf("pk") !== -1) {
                    pkRow = index_1._assign(m);
                }
                if (m.props && (m.props.indexOf("idx") !== -1 || m.props.indexOf("trie") !== -1)) {
                    secondaryIndexes.push(m);
                }
            });
            if (pkRow.key !== "x" && pkRow.type !== "x") {
                args._models["_" + t + "_hist__data"] = index_1._assign(args._models[t]).map(function (m) {
                    return {
                        key: m.key,
                        type: m.type
                    };
                });
                args._models["_" + t + "_hist__data"].unshift({ key: db_index_1._str(4), type: "int" });
                args._models["_" + t + "_hist__meta"] = [
                    pkRow,
                    { key: "_pointer", type: "int", default: 0 },
                    { key: "_historyDataRowIDs", type: "array" },
                ];
            }
            if (secondaryIndexes.length && (pkRow.key !== "x" && pkRow.type !== "x")) {
                secondaryIndexes.forEach(function (s) {
                    args._models["_" + t + "_idx_" + s.key] = [
                        { key: "id", type: s.type, props: ["pk"] },
                        { key: "rowPK", type: pkRow.type }
                    ];
                });
            }
        });
        args._models[db_index_1._str(1)] = [
            { key: "id", type: "int", props: ["ai", "pk"] },
            { key: "tableID", type: "int" },
            { key: "historyPoint", type: "int" },
            { key: "rowKeys", type: "array" },
            { key: "type", type: "string" }
        ];
        args._models[db_index_1._str(0)] = [
            { key: "key", type: "string", props: ["pk"] },
            { key: "value", type: "blob" },
        ];
        var tables = Object.keys(args._models);
        var beforeHist;
        var beforeMode;
        Object.keys(args._models).forEach(function (tableName) {
            t._newTable(tableName, args._models[tableName]);
        });
        Object.keys(args._functions || {}).forEach(function (f) {
            db_query_1._functions[f] = args._functions[f];
        });
        var rebuildSecondaryIndexes = function () {
            if (!t._rebuildIndexes) {
                t._rebuildTries(args._onSuccess);
            }
            else {
                lie_ts_1.Promise.all(Object.keys(args._models).map(function (tableName) {
                    return new lie_ts_1.Promise(function (res, rej) {
                        t._rebuildSecondaryIndex(tableName, function () {
                            res();
                        });
                    });
                })).then(function () {
                    t._rebuildTries(args._onSuccess);
                });
            }
        };
        var completeSetup = function () {
            var tables = Object.keys(args._models);
            var i = 0;
            t._mode = beforeMode;
            if (beforeHist && t._historyMode === 1) {
                t._read(db_index_1._str(0), "all", function (rows) {
                    rows.forEach(function (d) {
                        t._utility("w", d.key, d.value);
                        if (d.key === "historyPoint")
                            t._historyPoint = d.value || 0;
                        if (d.key === "historyLength")
                            t._historyLength = d.value || 0;
                    });
                });
                t._read(db_index_1._str(1), "all", function (rows) {
                    rows.forEach(function (row) {
                        if (!t._historyPointIndex[row.historyPoint]) {
                            t._historyPointIndex[row.historyPoint] = [];
                        }
                        t._historyPointIndex[row.historyPoint].push(row.id);
                    });
                });
            }
            var restoreHistoryData = function () {
                if (i < tables.length) {
                    if (tables[i].indexOf("_hist__data") !== -1) {
                        var ta = index_1.NanoSQLInstance._hash(tables[i]);
                        if (isNewStore) {
                            t._upsert(tables[i], 0, null, function () {
                                i++;
                                restoreHistoryData();
                            });
                        }
                        else {
                            i++;
                            restoreHistoryData();
                        }
                    }
                    else {
                        i++;
                        restoreHistoryData();
                    }
                }
                else {
                    t._doHistory = beforeHist;
                    rebuildSecondaryIndexes();
                }
            };
            restoreHistoryData();
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
        }
        beforeHist = t._doHistory;
        beforeMode = t._mode;
        t._mode = 0;
        var createTables = function (makeTable, complete) {
            var next = function () {
                if (index < tables.length) {
                    var ta = index_1.NanoSQLInstance._hash(tables[index]);
                    makeTable(tables[index], ta, t._tables[ta]);
                    index++;
                    next();
                }
                else {
                    complete();
                }
            };
            next();
        };
        var cacheTableData = function (args) {
            isNewStore = false;
            var index = 0;
            var next = function () {
                if (index < tables.length) {
                    var ta_1 = index_1.NanoSQLInstance._hash(tables[index]);
                    if (!beforeHist && (tables[index].indexOf("_hist__data") !== -1 || tables[index].indexOf("_hist__meta") !== -1)) {
                        index++;
                        next();
                        return;
                    }
                    if (t._storeMemory) {
                        args.requestTable(tables[index], function (tableData) {
                            t._parent._parent.loadJS(tables[index], tableData).then(function () {
                                if (tables[index].indexOf("_hist__data") !== -1) {
                                    t._tables[ta_1]._rows[0] = null;
                                }
                                index++;
                                next();
                            });
                        });
                    }
                    else if (!t._storeMemory || args.forceIndex) {
                        args.requestIndex(tables[index], function (indexData) {
                            t._parent._store._tables[ta_1]._index = indexData;
                            t._parent._store._tables[ta_1]._incriment = indexData.reduce(function (prev, cur) {
                                return Math.max(prev, parseInt(cur) || 0);
                            }, 0);
                            t._parent._store._tables[ta_1]._incriment++;
                            index++;
                            next();
                        });
                    }
                }
                else {
                    if (args.cleanup) {
                        args.cleanup(function () {
                            completeSetup();
                        });
                    }
                    else {
                        completeSetup();
                    }
                    return;
                }
            };
            next();
        };
        switch (beforeMode) {
            case 0:
                completeSetup();
                break;
            case 1:
                var idb = indexedDB.open(t._parent._databaseID, 1);
                idb.onupgradeneeded = function (event) {
                    upgrading = true;
                    var db = event.target.result;
                    var transaction = event.target.transaction;
                    t._indexedDB = db;
                    createTables(function (tableName, tableHash, tableObj) {
                        var config = tableObj._pk ? { keyPath: tableObj._pk } : {};
                        db.createObjectStore(tableName, config);
                    }, function () {
                        transaction.oncomplete = function () {
                            completeSetup();
                        };
                    });
                };
                idb.onsuccess = function (event) {
                    t._indexedDB = event.target.result;
                    if (!upgrading) {
                        var getIDBData_1 = function (tName, callBack) {
                            var items = [];
                            var transaction = t._indexedDB.transaction(tName, "readonly");
                            var store = transaction.objectStore(tName);
                            var cursorRequest = store.openCursor();
                            cursorRequest.onsuccess = function (evt) {
                                var cursor = evt.target.result;
                                if (cursor) {
                                    items.push(t._storeMemory ? cursor.value : cursor.key);
                                    cursor.continue();
                                }
                            };
                            transaction.oncomplete = function () {
                                callBack(items);
                            };
                        };
                        cacheTableData({
                            requestIndex: function (tableName, complete) {
                                getIDBData_1(tableName, complete);
                            },
                            requestTable: function (tableName, complete) {
                                getIDBData_1(tableName, complete);
                            }
                        });
                    }
                };
                break;
            case 2:
                if (localStorage.getItem("dbID") !== t._parent._databaseID) {
                    localStorage.setItem("dbID", t._parent._databaseID);
                    createTables(function (tableName, tableHash, tableObj) {
                        localStorage.setItem(tableName, JSON.stringify([]));
                    }, function () {
                        completeSetup();
                    });
                }
                else {
                    cacheTableData({
                        forceIndex: true,
                        requestIndex: function (tableName, complete) {
                            var tableIndex = JSON.parse(localStorage.getItem(tableName) || "[]");
                            complete(tableIndex);
                        },
                        requestTable: function (tableName, complete) {
                            var items = [];
                            JSON.parse(localStorage.getItem(tableName) || "[]").forEach(function (ptr) {
                                items.push(JSON.parse(localStorage.getItem(tableName + "-" + ptr) || ""));
                            });
                            complete(items);
                        }
                    });
                }
                break;
            case 4:
                var existingStore = function () {
                    var getLevelData = function (tName, callBack) {
                        var items = [];
                        var stream = t._storeMemory ? t._levelDBs[tName].createValueStream() : t._levelDBs[tName].createKeyStream();
                        stream.on("data", function (data) {
                            items.push(t._storeMemory ? JSON.parse(data) : data);
                        })
                            .on("end", function () {
                            callBack(items);
                        });
                    };
                    cacheTableData({
                        requestIndex: function (tableName, complete) {
                            getLevelData(tableName, complete);
                        },
                        requestTable: function (tableName, complete) {
                            getLevelData(tableName, complete);
                        }
                    });
                };
                var dbFolder_1 = "./db_" + t._parent._databaseID;
                var existing = true;
                if (!global._fs.existsSync(dbFolder_1)) {
                    global._fs.mkdirSync(dbFolder_1);
                    existing = false;
                }
                tables.forEach(function (table) {
                    t._levelDBs[table] = global._levelup(dbFolder_1 + "/" + table, {
                        cacheSize: 24 * 1024 * 1024,
                        writeBufferSize: 12 * 1024 * 1024
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
    _NanoSQL_Storage.prototype._rebuildSecondaryIndex = function (tableName, complete) {
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        var rowPTR = 0;
        var secondIdx = t._tables[ta]._secondaryIndexes;
        this._read(tableName, "all", function (rows) {
            var PK = t._tables[ta]._pk;
            var step2 = function () {
                if (rowPTR < rows.length) {
                    var ptr3_1 = 0;
                    var step3_1 = function () {
                        if (ptr3_1 < secondIdx.length) {
                            var key_1 = secondIdx[ptr3_1];
                            var idxTbl_1 = "_" + tableName + "_idx_" + key_1;
                            var rowKey_1 = String(rows[rowPTR][key_1]).toLowerCase();
                            t._read(idxTbl_1, rowKey_1, function (readRows) {
                                var indexedRows = [rows[rowPTR][PK]];
                                if (readRows.length && readRows[0].rowPK) {
                                    indexedRows = indexedRows.concat(readRows[0].rowPK).filter(function (item, pos) {
                                        return indexedRows.indexOf(item) === pos;
                                    });
                                }
                                t._upsert(idxTbl_1, rowKey_1, {
                                    id: rows[rowPTR][key_1],
                                    rowPK: indexedRows
                                }, function () {
                                    ptr3_1++;
                                    lie_ts_1.setFast(step3_1);
                                });
                            }, true);
                        }
                        else {
                            rowPTR++;
                            lie_ts_1.setFast(step2);
                        }
                    };
                    step3_1();
                }
                else {
                    complete();
                }
            };
            step2();
        });
    };
    _NanoSQL_Storage.prototype._rebuildTries = function (callBack) {
        var rebuildJob = {};
        var jobLength = 0;
        var t = this;
        Object.keys(t._tables).forEach(function (tableID) {
            var tableName = t._tables[tableID]._name;
            if (tableName.indexOf("_") !== 0) {
                if (t._tables[tableID]._trieColumns.length) {
                    rebuildJob[tableName] = t._tables[tableID]._trieColumns;
                    jobLength++;
                }
            }
        });
        if (jobLength === 0) {
            callBack();
        }
        else {
            var tables_1 = Object.keys(rebuildJob);
            var ptr_1 = 0;
            var step_1 = function () {
                if (ptr_1 < tables_1.length) {
                    var ta_2 = index_1.NanoSQLInstance._hash(tables_1[ptr_1]);
                    t._read(tables_1[ptr_1], "all", function (rows) {
                        rows.forEach(function (row, i) {
                            rebuildJob[tables_1[ptr_1]].forEach(function (key) {
                                if (row[key])
                                    t._tables[ta_2]._trieObjects[key].addWord(row[key]);
                            });
                        });
                        ptr_1++;
                        step_1();
                    });
                }
                else {
                    callBack();
                }
            };
            step_1();
        }
    };
    _NanoSQL_Storage.prototype._execTransaction = function (transactionID) {
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            var complete = function () {
                if (t._transactionData[transactionID]) {
                    lie_ts_1.Promise.all(Object.keys(t._transactionData[transactionID]).map(function (table) {
                        return new lie_ts_1.Promise(function (resolve) {
                            t._rebuildSecondaryIndex(table, resolve);
                        });
                    })).then(function () {
                        res([{ msg: Object.keys(t._transactionData[transactionID]).length + " transactions performed." }], t._parent._parent);
                        delete t._transactionData[transactionID];
                    });
                }
                else {
                    res([{ msg: "0 transactions performed." }], t._parent._parent);
                }
            };
            switch (t._mode) {
                case 4:
                    Object.keys(t._transactionData[transactionID]).forEach(function (tableName) {
                        t._levelDBs[tableName].batch(t._transactionData[transactionID][tableName]);
                    });
                    complete();
                    break;
                default:
                    complete();
            }
        });
    };
    _NanoSQL_Storage.prototype._clear = function (type, complete) {
        var t = this;
        var tables = Object.keys(t._tables).map(function (k) { return t._tables[k]._name; });
        var setupNewHist = function () {
            lie_ts_1.Promise.all(tables.map(function (table) {
                return new lie_ts_1.Promise(function (res, rej) {
                    if (table.indexOf("_hist__meta") !== -1) {
                        var referenceTable_1 = String(table).slice(1).replace("_hist__meta", "");
                        var ta = index_1.NanoSQLInstance._hash(referenceTable_1);
                        var pk_1 = t._tables[ta]._pk;
                        t._upsert("_" + referenceTable_1 + "_hist__data", 0, null);
                        t._tables["_" + referenceTable_1 + "_hist__data"]._index.push(0);
                        t._read(referenceTable_1, "all", function (rows) {
                            rows.forEach(function (row, i) {
                                var hist = {};
                                hist[db_index_1._str(2)] = 0;
                                hist[db_index_1._str(3)] = [i + 1];
                                t._upsert(table, row[pk_1], hist);
                                t._upsert("_" + referenceTable_1 + "_hist__data", i + 1, row);
                            });
                            res();
                        });
                    }
                    else {
                        res();
                    }
                });
            })).then(function () {
                complete();
            });
        };
        lie_ts_1.Promise.all(tables.map(function (table) {
            return new lie_ts_1.Promise(function (res, rej) {
                var deleteTable = false;
                if (type === "hist" && (table === db_index_1._str(1) || table.indexOf("_hist__meta") !== -1 || table.indexOf("_hist__data") !== -1)) {
                    deleteTable = true;
                }
                if (type === "all" && table !== "_utility") {
                    deleteTable = true;
                }
                if (deleteTable) {
                    t._delete(table, "all", function () {
                        if (table.indexOf("_hist__data") !== -1) {
                            t._upsert(table, 0, null);
                        }
                        res();
                    });
                }
                else {
                    res();
                }
            });
        })).then(function () {
            setupNewHist();
        });
    };
    _NanoSQL_Storage.prototype._delete = function (tableName, rowID, callBack, transactionID) {
        var t = this;
        var editingHistory = false;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        var deleteRowIDS = [];
        if (rowID === "all") {
            deleteRowIDS = t._tables[ta]._index.slice().filter(function (i) { return i; });
            t._tables[ta]._index = [];
            t._tables[ta]._trieIndex = new prefix_trie_ts_1.Trie([]);
        }
        else {
            deleteRowIDS.push(rowID);
            t._tables[ta]._trieIndex.removeWord(String(rowID));
            t._tables[ta]._index.splice(t._tables[ta]._index.indexOf(rowID), 1);
        }
        if (t._storeMemory) {
            if (rowID === "all") {
                t._tables[ta]._rows = {};
            }
            else {
                delete t._tables[ta]._rows[rowID];
            }
        }
        index_1.NanoSQLInstance.chain(deleteRowIDS.map(function (rowID) {
            return function (nextRow) {
                if (transactionID) {
                    if (!t._transactionData[transactionID])
                        t._transactionData[transactionID] = {};
                    if (!t._transactionData[transactionID][tableName]) {
                        t._transactionData[transactionID][tableName] = [];
                    }
                    t._transactionData[transactionID][tableName].push({
                        type: "del",
                        key: rowID,
                        value: ""
                    });
                }
                switch (t._mode) {
                    case 0:
                        nextRow();
                        break;
                    case 1:
                        t._indexedDB.transaction(tableName, "readwrite").objectStore(tableName).delete(rowID);
                        nextRow();
                        break;
                    case 2:
                        localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                        localStorage.removeItem(tableName + "-" + String(rowID));
                        nextRow();
                        break;
                    case 4:
                        if (transactionID) {
                            nextRow();
                        }
                        else {
                            t._levelDBs[tableName].del(rowID, function () {
                                nextRow();
                            });
                        }
                        break;
                    default:
                        nextRow();
                }
            };
        }))(function () {
            if (callBack)
                callBack(true);
        });
    };
    _NanoSQL_Storage.prototype._updateSecondaryIndex = function (newRow, tableID, callBack) {
        var t = this;
        var table = t._tables[tableID];
        var oldRow = {};
        if (table._name.indexOf("_") !== 0) {
            var emptyColumns_1 = [];
            var updateIndex_1 = function (tableName, rowID, key, complete) {
                t._read(tableName, rowID, function (rows) {
                    var indexedRows = [];
                    if (rows.length && rows[0].rowPK)
                        indexedRows = indexedRows.concat(rows[0].rowPK);
                    indexedRows.push(newRow[table._pk]);
                    indexedRows = indexedRows.filter(function (item, pos, arr) {
                        return arr.indexOf(item) === pos;
                    });
                    if (indexedRows.length) {
                        t._upsert(tableName, rowID, {
                            id: rowID,
                            rowPK: indexedRows
                        }, complete);
                    }
                    else {
                        emptyColumns_1.push(key);
                        t._delete(tableName, rowID, complete);
                    }
                }, true);
            };
            table._trieColumns.forEach(function (key) {
                var word = String(newRow[key]).toLocaleLowerCase();
                if (emptyColumns_1.indexOf(key) !== -1) {
                    t._tables[tableID]._trieObjects[key].removeWord(word);
                }
                else {
                    t._tables[tableID]._trieObjects[key].addWord(word);
                }
            });
            if (table._secondaryIndexes.length) {
                lie_ts_1.Promise.all(table._secondaryIndexes.map(function (key) {
                    return new lie_ts_1.Promise(function (res, rej) {
                        var idxTable = "_" + table._name + "_idx_" + key;
                        var rowID = String(newRow[key]).toLowerCase();
                        var oldRowID = String(oldRow[key]).toLowerCase();
                        if (rowID !== oldRowID && oldRow[key]) {
                            t._read(idxTable, oldRowID, function (oldRowIndex) {
                                var indexes = oldRowIndex[0] ? index_1._assign(oldRowIndex[0].rowPK || []) : [];
                                var oldRowLoc = indexes.indexOf(oldRowID[table._pk]);
                                if (oldRowLoc !== -1) {
                                    indexes.splice(oldRowLoc, 1);
                                    t._upsert(idxTable, oldRowID, {
                                        id: oldRowID,
                                        rowPK: indexes
                                    }, function () {
                                        updateIndex_1(idxTable, rowID, key, res);
                                    });
                                }
                                else {
                                    updateIndex_1(idxTable, rowID, key, res);
                                }
                            });
                        }
                        else {
                            if (newRow[key] !== undefined) {
                                updateIndex_1(idxTable, rowID, key, res);
                            }
                            else {
                                if (callBack)
                                    callBack();
                            }
                        }
                    });
                })).then(callBack);
            }
            else {
                if (callBack)
                    callBack();
            }
        }
        else {
            if (callBack)
                callBack();
        }
    };
    _NanoSQL_Storage.prototype._addHistoryRow = function (tableID, rowData, transactionID, complete) {
        var t = this;
        var table = t._tables[tableID];
        var histTableName = "_" + table._name + "_hist__data";
        var histTable = t._tables[index_1.NanoSQLInstance._hash(histTableName)];
        rowData = index_1._assign(rowData);
        var pk = histTable._index[histTable._index.length - 1] + 1;
        histTable._index.push(pk);
        rowData[db_index_1._str(4)] = pk;
        t._upsert(histTableName, pk, rowData, function () {
            complete(pk);
        }, transactionID);
    };
    _NanoSQL_Storage.prototype._addHistoryPoint = function (tableID, updatedPKs, describe, complete) {
        var t = this;
        if (!t._doHistory) {
            complete();
            return;
        }
        var makeRecord = function () {
            t._utility("w", "historyLength", t._historyLength);
            t._utility("w", "historyPoint", t._historyPoint);
            var histPoint = t._historyLength - t._historyPoint;
            t._upsert(db_index_1._str(1), null, {
                historyPoint: histPoint,
                tableID: tableID,
                rowKeys: updatedPKs,
                type: describe
            }, function (rowID) {
                if (!t._historyPointIndex[histPoint]) {
                    t._historyPointIndex[histPoint] = [];
                }
                t._historyPointIndex[histPoint].push(rowID);
                complete();
            });
        };
        if (t._historyPoint === 0) {
            t._historyLength++;
            makeRecord();
        }
        else if (t._historyPoint > 0) {
            var histPoints = [];
            var k_1 = 0, j = 0;
            var startIndex = (t._historyLength - t._historyPoint) + 1;
            while (t._historyPointIndex[startIndex]) {
                histPoints = histPoints.concat(t._historyPointIndex[startIndex].slice());
                delete t._historyPointIndex[startIndex];
                startIndex++;
            }
            t._readArray(db_index_1._str(1), histPoints, function (historyPoints) {
                index_1.NanoSQLInstance.chain(historyPoints.map(function (histPoint) {
                    return function (nextHistPoint) {
                        var tableName = t._tables[histPoint.tableID]._name;
                        index_1.NanoSQLInstance.chain(histPoint.rowKeys.map(function (rowKey) {
                            return function (nextRowKey) {
                                t._read("_" + tableName + "_hist__meta", rowKey, function (rows) {
                                    rows[0] = index_1._assign(rows[0]);
                                    rows[0][db_index_1._str(2)] = 0;
                                    var del = rows[0][db_index_1._str(3)].shift();
                                    t._upsert("_" + tableName + "_hist__meta", rowKey, rows[0], function () {
                                        if (del) {
                                            t._delete("_" + tableName + "_hist__data", del, function () {
                                                k_1++;
                                                nextRowKey();
                                            });
                                        }
                                        else {
                                            k_1++;
                                            nextRowKey();
                                        }
                                    });
                                });
                            };
                        }))(function () {
                            t._delete(db_index_1._str(1), histPoint.id, nextHistPoint);
                        });
                    };
                }))(function () {
                    t._historyLength -= t._historyPoint;
                    t._historyLength++;
                    t._historyPoint = 0;
                    makeRecord();
                });
            });
        }
    };
    _NanoSQL_Storage.prototype._generateID = function (type, tableHash) {
        switch (type) {
            case "int": return this._tables[tableHash]._incriment++;
            case "uuid": return index_1.NanoSQLInstance.uuid();
            case "timeId": return index_1.NanoSQLInstance.timeid();
            case "timeIdms": return index_1.NanoSQLInstance.timeid(true);
        }
        return "";
    };
    _NanoSQL_Storage.prototype._upsert = function (tableName, rowID, rowData, callBack, transactionID) {
        var t = this;
        rowData = index_1._assign(rowData);
        var ta = index_1.NanoSQLInstance._hash(tableName);
        var pk = t._tables[ta]._pk;
        if (tableName.indexOf("_hist__data") !== -1 && rowData) {
            rowID = rowData[db_index_1._str(4)];
        }
        else {
            if (rowID === undefined || rowID === null) {
                t._models[ta].forEach(function (m) {
                    if (m.props && m.props.indexOf("pk") !== -1) {
                        rowID = t._generateID(m.type, ta);
                    }
                });
                if (!rowID)
                    rowID = parseInt(t._tables[ta]._index[t._tables[ta]._index.length - 1] || "0") + 1;
            }
            if (pk && pk.length && rowData && rowData[pk] === undefined) {
                rowData[pk] = rowID;
            }
        }
        rowID = (rowID !== undefined && rowID !== null) ? rowID : -1;
        if (!t._tables[ta]._trieIndex.getPrefix(String(rowID)).length) {
            t._tables[ta]._trieIndex.addWord(String(rowID));
            t._tables[ta]._index.push(rowID);
        }
        if (transactionID) {
            if (!t._transactionData[transactionID])
                t._transactionData[transactionID] = {};
            if (!t._transactionData[transactionID][tableName]) {
                t._transactionData[transactionID][tableName] = [];
            }
            t._transactionData[transactionID][tableName].push({
                type: tableName.indexOf("_hist__data") !== -1 ? "put" : !rowData ? "del" : "put",
                key: rowID,
                value: rowData ? JSON.stringify(rowData) : ""
            });
        }
        if (t._storeMemory) {
            t._tables[ta]._rows[rowID] = t._parent._deepFreeze(rowData, ta);
            if (t._mode === 0 && callBack)
                return callBack(rowID);
        }
        switch (t._mode) {
            case 1:
                var transaction = t._indexedDB.transaction(tableName, "readwrite");
                var store = transaction.objectStore(tableName);
                if (pk.length && rowData) {
                    store.put(rowData);
                }
                else {
                    if (tableName.indexOf("_hist__data") !== -1) {
                        store.put(rowData, rowID);
                    }
                    else {
                        if (rowData)
                            store.put(rowData);
                        if (!rowData)
                            store.delete(rowID);
                    }
                }
                transaction.oncomplete = function () {
                    if (callBack)
                        callBack(rowID);
                };
                break;
            case 2:
                localStorage.setItem(tableName + "-" + String(rowID), rowData ? JSON.stringify(rowData) : "");
                localStorage.setItem(tableName, JSON.stringify(t._tables[ta]._index));
                if (callBack)
                    callBack(rowID);
                break;
            case 4:
                if (transactionID) {
                    if (callBack)
                        callBack(rowID);
                }
                else {
                    if (tableName.indexOf("_hist__data") !== -1) {
                        t._levelDBs[tableName].put(rowID, rowData ? JSON.stringify(rowData) : null, function () {
                            if (callBack)
                                callBack(rowID);
                        });
                    }
                    else {
                        if (rowData) {
                            t._levelDBs[tableName].put(rowID, JSON.stringify(rowData), function () {
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
                }
                break;
        }
    };
    _NanoSQL_Storage.prototype._indexRead = function (tableName, rows, callBack, getIndex) {
        var _this = this;
        var isSecondIndex = tableName.indexOf("_") === 0 && tableName.indexOf("_idx_") !== -1;
        if (!isSecondIndex || getIndex) {
            callBack(rows);
        }
        else {
            var parentTable_1 = !isSecondIndex ? "" : tableName.slice(1, tableName.indexOf("_idx_"));
            var allRowIDs_1 = rows.reduce(function (prev, cur) {
                return prev.concat(cur.rowPK);
            }, []);
            var resultRows_1 = [];
            var ptr_2 = 0;
            var step_2 = function () {
                if (ptr_2 < allRowIDs_1.length) {
                    _this._read(parentTable_1, allRowIDs_1[ptr_2], function (rows) {
                        resultRows_1 = resultRows_1.concat(rows);
                        ptr_2++;
                        step_2();
                    });
                }
                else {
                    callBack(resultRows_1);
                }
            };
            step_2();
        }
    };
    _NanoSQL_Storage.prototype._readArray = function (tableName, pkArray, callBack) {
        var _this = this;
        var rows = [];
        var ptr = 0;
        var readRow = function () {
            if (ptr < pkArray.length) {
                _this._read(tableName, pkArray[ptr], function (newRows) {
                    rows = rows.concat(newRows);
                    ptr++;
                    readRow();
                });
            }
            else {
                callBack(rows);
            }
        };
        readRow();
    };
    _NanoSQL_Storage.prototype._readRange = function (tableName, key, between, callBack) {
        var _this = this;
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        if (t._mode === 0 || t._mode === 2) {
            var startPtr_1 = t._tables[ta]._index.indexOf(between[0]);
            var resultRows_2 = [];
            if (startPtr_1 === -1) {
                callBack(resultRows_2);
                return;
            }
            var stepRead_1 = function () {
                var pk = t._tables[ta]._index[startPtr_1];
                if (!pk) {
                    callBack(resultRows_2);
                    return;
                }
                if (pk <= between[1]) {
                    t._read(tableName, pk, function (rows) {
                        resultRows_2 = resultRows_2.concat(rows);
                        startPtr_1++;
                        stepRead_1();
                    });
                }
                else {
                    callBack(resultRows_2);
                }
            };
            stepRead_1();
            return;
        }
        var rows = [];
        switch (t._mode) {
            case 1:
                var transaction = t._indexedDB.transaction(tableName, "readonly");
                var store = transaction.objectStore(tableName);
                var cursorRequest = store.openCursor(IDBKeyRange.bound(between[0], between[1]));
                transaction.oncomplete = function () {
                    _this._indexRead(tableName, rows, callBack);
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
                        rows.push(JSON.parse(data));
                })
                    .on("end", function () {
                    _this._indexRead(tableName, rows, callBack);
                });
                break;
        }
    };
    _NanoSQL_Storage.prototype._read = function (tableName, row, callBack, readIndex) {
        var _this = this;
        var t = this;
        var ta = index_1.NanoSQLInstance._hash(tableName);
        if (t._storeMemory) {
            var rows_1 = t._tables[ta]._rows;
            if (row === "all" || typeof row === "function") {
                var allRows = Object.keys(rows_1).map(function (r) { return rows_1[r]; });
                if (row === "all") {
                    t._indexRead(tableName, allRows.filter(function (r) { return r; }), callBack, readIndex);
                }
                else {
                    t._indexRead(tableName, allRows.filter(function (r) { return row(r); }), callBack, readIndex);
                }
            }
            else {
                t._indexRead(tableName, [rows_1[row]].filter(function (r) { return r; }), callBack, readIndex);
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
                        _this._indexRead(tableName, rows_2, callBack, readIndex);
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
                        _this._indexRead(tableName, [singleReq_1.result], callBack, readIndex);
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
                        this._indexRead(tableName, rows.filter(function (r) { return row(r); }), callBack, readIndex);
                    }
                    else {
                        this._indexRead(tableName, rows, callBack, readIndex);
                    }
                }
                else {
                    var item = localStorage.getItem(tableName + "-" + row);
                    this._indexRead(tableName, [item && item.length ? JSON.parse(item) : null], callBack, readIndex);
                }
                break;
            case 4:
                if (row === "all" || typeof row === "function") {
                    var rows_3 = [];
                    t._levelDBs[tableName].createValueStream()
                        .on("data", function (data) {
                        if (data)
                            rows_3.push(JSON.parse(data));
                    })
                        .on("end", function () {
                        if (row !== "all") {
                            _this._indexRead(tableName, rows_3.filter(function (r) { return row(r); }), callBack, readIndex);
                        }
                        else {
                            _this._indexRead(tableName, rows_3, callBack, readIndex);
                        }
                    });
                }
                else {
                    t._levelDBs[tableName].get(row, function (err, data) {
                        if (err) {
                            _this._indexRead(tableName, [], callBack, readIndex);
                        }
                        else {
                            _this._indexRead(tableName, [JSON.parse(data)], callBack, readIndex);
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
            _relations: [],
            _defaults: [],
            _secondaryIndexes: [],
            _trieColumns: [],
            _trieObjects: {},
            _name: tableName,
            _incriment: 1,
            _index: [],
            _trieIndex: new prefix_trie_ts_1.Trie([]),
            _rows: {}
        };
        var i = t._models[ta].length;
        var keys = [];
        var defaults = [];
        var _loop_1 = function () {
            var p = t._models[ta][i];
            t._tables[ta]._keys.unshift(p.key);
            t._tables[ta]._defaults[i] = p.default;
            if (p.props && p.props.indexOf("pk") >= 0) {
                t._tables[ta]._pk = p.key;
                t._tables[ta]._pkType = p.type;
            }
            if (p.props && (p.props.indexOf("idx") >= 0 || p.props.indexOf("trie") >= 0)) {
                t._tables[ta]._secondaryIndexes.push(p.key);
            }
            if (p.props && p.props.indexOf("trie") >= 0) {
                t._tables[ta]._trieColumns.push(p.key);
                t._tables[ta]._trieObjects[p.key] = new prefix_trie_ts_1.Trie([]);
            }
            if (p.props && t._parent._parent._tableNames.indexOf(p.type.replace("[]", "")) !== -1) {
                var mapTo_1 = "";
                p.props.forEach(function (p) {
                    if (p.indexOf("ref=>") !== -1)
                        mapTo_1 = p.replace("ref=>", "");
                });
                t._tables[ta]._relations.push({
                    _table: p.type.replace("[]", ""),
                    _key: p.key,
                    _mapTo: mapTo_1,
                    _type: p.type.indexOf("[]") === -1 ? "single" : "array"
                });
            }
        };
        while (i--) {
            _loop_1();
        }
        return tableName;
    };
    return _NanoSQL_Storage;
}());
exports._NanoSQL_Storage = _NanoSQL_Storage;
