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
        t._doingTransaction = false;
        t._doHistory = true;
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
                    delete m.props;
                    return m;
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
                t._read(db_index_1._str(1), "all", function (rows) {
                    rows.forEach(function (row) {
                        if (!t._historyPointIndex[row.historyPoint]) {
                            t._historyPointIndex[row.historyPoint] = [];
                        }
                        t._historyPointIndex[row.historyPoint].push(row.id);
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
                        rebuildSecondaryIndexes();
                    }
                };
                step_1();
            }
            else {
                t._doHistory = beforeHist;
                rebuildSecondaryIndexes();
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
                            if (tables[index].indexOf("_hist__data") !== -1) {
                                t._tables[ta_1]._index.push(0);
                                t._tables[ta_1]._trieIndex.addWord("0");
                                t._tables[ta_1]._rows[0] = null;
                                t._tables[ta_1]._incriment++;
                                t._parent._parent.loadJS(tables[index], tableData).then(function () {
                                    index++;
                                    next();
                                });
                            }
                            else {
                                t._parent._parent.loadJS(tables[index], tableData).then(function () {
                                    index++;
                                    next();
                                });
                            }
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
            var step_2 = function () {
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
                        step_2();
                    });
                }
                else {
                    callBack();
                }
            };
            step_2();
        }
    };
    _NanoSQL_Storage.prototype._execTransaction = function () {
        var t = this;
        var complete = function () {
            Object.keys(t._transactionData).forEach(function (tableName) {
                t._rebuildSecondaryIndex(tableName, function () { });
            });
        };
        if (t._mode !== 4) {
            complete();
        }
        switch (t._mode) {
            case 4:
                Object.keys(t._transactionData).forEach(function (tableName) {
                    t._levelDBs[tableName].batch(t._transactionData[tableName]);
                });
                complete();
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
                if (type === "hist" && (tables[index] === db_index_1._str(1) || tables[index].indexOf("_hist__meta") !== -1 || tables[index].indexOf("_hist__data") !== -1)) {
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
            if (t._mode === 0 && callBack)
                return callBack(true);
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
                            if (t._doingTransaction) {
                                if (!t._transactionData[tableName]) {
                                    t._transactionData[tableName] = [];
                                }
                                t._transactionData[tableName].push({
                                    type: "del",
                                    key: deleteRowIDS[i_1],
                                    value: ""
                                });
                                i_1++;
                                step_3();
                            }
                            else {
                                t._levelDBs[tableName].del(deleteRowIDS[i_1], function () {
                                    i_1++;
                                    step_3();
                                });
                            }
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
        if (tableName.indexOf("_hist__data") !== -1 && value) {
            rowID = value[db_index_1._str(4)];
        }
        if (t._tables[ta]._pkType === "int")
            rowID = parseInt(rowID);
        var pk = t._tables[ta]._pk;
        if (pk && pk.length && value && !value[pk]) {
            value[pk] = rowID;
        }
        if (!t._tables[ta]._trieIndex.getPrefix(String(rowID)).length) {
            t._tables[ta]._index.push(rowID);
        }
        if (t._storeMemory) {
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
                if (t._doingTransaction) {
                    if (!t._transactionData[tableName]) {
                        t._transactionData[tableName] = [];
                    }
                    t._transactionData[tableName].push({
                        type: tableName.indexOf("_hist__data") !== -1 ? "put" : !value ? "del" : "put",
                        key: rowID,
                        value: value ? JSON.stringify(value) : ""
                    });
                    if (callBack)
                        callBack(rowID);
                }
                else {
                    if (tableName.indexOf("_hist__data") !== -1) {
                        t._levelDBs[tableName].put(rowID, value ? JSON.stringify(value) : null, function () {
                            if (callBack)
                                callBack(rowID);
                        });
                    }
                    else {
                        if (value) {
                            t._levelDBs[tableName].put(rowID, JSON.stringify(value), function () {
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
            var step_4 = function () {
                if (ptr_2 < allRowIDs_1.length) {
                    _this._read(parentTable_1, allRowIDs_1[ptr_2], function (rows) {
                        resultRows_1 = resultRows_1.concat(rows);
                        ptr_2++;
                        step_4();
                    });
                }
                else {
                    callBack(resultRows_1);
                }
            };
            step_4();
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
            var stepRead_1 = function () {
                var pk = t._tables[ta]._index[startPtr_1];
                if (pk <= between[1]) {
                    _this._read(tableName, pk, function (rows) {
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
        while (i--) {
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
        }
        return tableName;
    };
    return _NanoSQL_Storage;
}());
exports._NanoSQL_Storage = _NanoSQL_Storage;
