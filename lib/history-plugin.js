var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("./utilities");
var strs = ["_hist", "_hist_ptr"];
var _NanoSQLHistoryPlugin = (function () {
    function _NanoSQLHistoryPlugin(historyModeArgs) {
        this.historyModeArgs = historyModeArgs;
        this._tablePkKeys = {};
        this._tablePkTypes = {};
        this._tableKeys = {};
    }
    _NanoSQLHistoryPlugin.prototype.willConnect = function (connectArgs, next) {
        var _this = this;
        this.parent = connectArgs.parent;
        var historyTables = {};
        Object.keys(connectArgs.models).forEach(function (table) {
            if (table.indexOf("_") !== 0) {
                var histModel = utilities_1._assign(connectArgs.models[table]).map(function (model) {
                    if (model.props && model.props.indexOf("pk") !== -1) {
                        _this._tablePkKeys[table] = model.key;
                        _this._tablePkTypes[table] = model.type;
                        _this._tableKeys[table] = {};
                    }
                    delete model.props;
                    delete model.default;
                    return model;
                });
                histModel.unshift({ key: "_id", type: "timeIdms", props: ["pk"] });
                historyTables["_" + table + "__hist_rows"] = histModel;
                historyTables["_" + table + "__hist_idx"] = [
                    { key: "id", type: _this._tablePkTypes[table], props: ["pk"] },
                    { key: "histRows", type: "timeIdms[]" },
                    { key: "histPtr", type: "number" }
                ];
            }
        });
        var isNotString = typeof this.historyModeArgs !== "string";
        var historyTable = [
            { key: "id", type: "timeIdms", props: ["pk"] },
            { key: "table", type: "string" },
            { key: "keys", type: "any[]" }
        ];
        var historyTablePointer = [
            { key: "id", type: "timeIdms", props: ["pk"] },
            { key: "ptr", type: "int" }
        ];
        if (this.historyModeArgs === "database" || !this.historyModeArgs) {
            historyTables[strs[0]] = historyTable;
            historyTables[strs[1]] = historyTablePointer;
        }
        else if (this.historyModeArgs !== "database" || isNotString) {
            this.historyModes = {};
            if (!isNotString) {
                Object.keys(this._tablePkKeys).forEach(function (table) {
                    _this.historyModes[table] = _this.historyModeArgs;
                });
            }
            else {
                this.historyModes = utilities_1._assign(this.historyModeArgs);
            }
            Object.keys(this.historyModes).forEach(function (table) {
                if (_this.historyModes[table] === "table") {
                    historyTables["_" + table + "__hist"] = historyTable;
                    historyTables["_" + table + "__hist_ptr"] = historyTablePointer;
                }
            });
        }
        connectArgs.models = __assign({}, connectArgs.models, historyTables);
        next(connectArgs);
    };
    _NanoSQLHistoryPlugin.prototype._histTable = function (table) {
        if (!table)
            return "__null";
        return this.historyModes ? this.historyModes[table] === "table" ? "_" + table + "__hist" : null : "_hist";
    };
    _NanoSQLHistoryPlugin.prototype._generateHistoryPointers = function (table, complete) {
        var _this = this;
        var histTable = this._histTable(table);
        if (!histTable) {
            complete();
        }
        else {
            this.parent.table(histTable + "_ptr").query("select").exec().then(function (rows) {
                if (rows.length) {
                    complete();
                }
                else {
                    _this.parent.table(histTable + "_ptr").query("upsert", {
                        id: utilities_1.timeid(true),
                        table: table,
                        ptr: 0
                    }).exec().then(complete);
                }
            });
        }
    };
    _NanoSQLHistoryPlugin.prototype.didConnect = function (connectArgs, next) {
        var _this = this;
        var finishSetup = function () {
            new utilities_1.ALL(Object.keys(_this._tableKeys).map(function (table) {
                return function (tableDone) {
                    _this.parent.extend("idx", "_" + table + "__hist_idx").then(function (index) {
                        index.forEach(function (item) {
                            _this._tableKeys[table][item] = true;
                        });
                        if (_this.historyModes) {
                            _this._generateHistoryPointers(table, tableDone);
                        }
                        else {
                            tableDone();
                        }
                    });
                };
            })).then(next);
        };
        if (!this.historyModes) {
            this.parent.table("_hist_ptr").query("select").exec().then(function (rows) {
                if (rows.length) {
                    finishSetup();
                }
                else {
                    _this.parent.table("_hist_ptr").query("upsert", {
                        id: utilities_1.timeid(true),
                        table: "",
                        ptr: 0
                    }).exec().then(finishSetup);
                }
            });
        }
        else {
            finishSetup();
        }
    };
    _NanoSQLHistoryPlugin.prototype._purgeRowHistory = function (table, rowPKs, complete, clearAll) {
        var _this = this;
        var rowHistTable = "_" + table + "__hist_rows";
        var rowIDXTable = "_" + table + "__hist_idx";
        new utilities_1.ALL(rowPKs.map(function (pk) {
            return function (rowDone) {
                _this.parent.table(rowIDXTable).query("select").where(["id", "=", pk]).exec().then(function (rows) {
                    if (!rows.length) {
                        rowDone();
                        return;
                    }
                    var histRowIDX = Object.isFrozen(rows[0]) ? utilities_1._assign(rows[0]) : rows[0];
                    var delIDs = [];
                    if (clearAll) {
                        delIDs = delIDs.concat(histRowIDX.histRows.filter(function (r) { return r !== -1; }));
                        histRowIDX.histPtr = 0;
                        histRowIDX.histRows = [];
                    }
                    else {
                        while (histRowIDX.histPtr--) {
                            delIDs.push(histRowIDX.histRows.shift());
                        }
                        histRowIDX.histPtr = 0;
                    }
                    if (!delIDs.length) {
                        rowDone();
                        return;
                    }
                    _this.parent.table(rowIDXTable).query("upsert", histRowIDX).comment("History Purge").where(["id", "=", pk]).exec().then(function () {
                        _this.parent.table(rowHistTable).query("delete").comment("History Purge").where(["_id", "IN", delIDs]).exec().then(function () {
                            if (clearAll) {
                                _this.parent.table(table).query("select").where([_this._tablePkKeys[table], "=", pk]).exec().then(function (existingRow) {
                                    _this._unshiftSingleRow(table, ["change"], pk, existingRow[0], false, rowDone);
                                });
                            }
                            else {
                                rowDone();
                            }
                        });
                    });
                });
            };
        })).then(complete);
    };
    _NanoSQLHistoryPlugin.prototype._purgeTableHistory = function (table, complete, clearAll) {
        var _this = this;
        this.parent.table(table + "_ptr").query("select").exec().then(function (rows) {
            var row = Object.isFrozen(rows[0]) ? utilities_1._assign(rows[0]) : rows[0];
            if (clearAll || row.ptr > 0) {
                var histQ = _this.parent.table(table).query("select");
                if (!clearAll) {
                    histQ.range(row.ptr * -1, 0);
                }
                histQ.exec().then(function (histTableRows) {
                    if (!histTableRows.length) {
                        complete();
                        return;
                    }
                    var purgeRows = {};
                    histTableRows.forEach(function (row) {
                        if (!purgeRows[row.table])
                            purgeRows[row.table] = [];
                        purgeRows[row.table] = purgeRows[row.table].concat(row.keys);
                    });
                    new utilities_1.ALL(Object.keys(purgeRows).map(function (ta) {
                        return function (tableDone) {
                            _this._purgeRowHistory(ta, purgeRows[ta], tableDone, clearAll);
                        };
                    })).then(function () {
                        _this.parent.table(table).query("delete").comment("History Purge").where(["id", "IN", histTableRows.map(function (r) { return r.id; })]).exec().then(function () {
                            row.ptr = 0;
                            _this.parent.table(table + "_ptr").query("upsert", row).comment("History Purge").where(["id", "=", row.id]).exec().then(complete);
                        });
                    });
                });
            }
            else {
                complete();
            }
        });
    };
    _NanoSQLHistoryPlugin.prototype._purgeParentHistory = function (table, rowPKs, complete) {
        if (!this.historyModes) {
            this._purgeTableHistory("_hist", complete);
            return;
        }
        var histTable = this._histTable(table);
        if (!histTable) {
            this._purgeRowHistory(table, rowPKs, complete);
        }
        else {
            this._purgeTableHistory(histTable, complete);
        }
    };
    _NanoSQLHistoryPlugin.prototype._purgeAllHistory = function (table, rowPK, complete) {
        if (!this.historyModes) {
            this._purgeTableHistory("_hist", complete, true);
            return;
        }
        var histTable = this._histTable(table);
        if (!histTable) {
            this._purgeRowHistory(table, [rowPK], complete, true);
        }
        else {
            this._purgeTableHistory(histTable, complete, true);
        }
    };
    _NanoSQLHistoryPlugin.prototype.didExec = function (event, next) {
        var _this = this;
        if (event.table && event.table.indexOf("_") !== 0 && event.types.indexOf("change") > -1 && event.query.comments.indexOf("History Write") === -1) {
            this._purgeParentHistory(event.table, event.affectedRowPKS, function () {
                new utilities_1.ALL(event.affectedRows.map(function (row) {
                    return function (rowDone) {
                        var pk = row[_this._tablePkKeys[event.table]];
                        if (_this._tableKeys[event.table][pk]) {
                            _this._unshiftSingleRow(event.table, event.types, pk, row, false, function (id) {
                                rowDone(pk);
                            });
                        }
                        else {
                            _this._tableKeys[event.table][pk] = true;
                            _this._unshiftSingleRow(event.table, event.types, pk, row, true, function (id) {
                                _this.parent.table("_" + event.table + "__hist_idx").query("upsert", {
                                    id: pk,
                                    histRows: [id, -1],
                                    histPtr: 0
                                }).exec().then(function () {
                                    rowDone(pk);
                                });
                            });
                        }
                    };
                })).then(function (rowIDs) {
                    _this._unshiftParent(event, rowIDs, next);
                });
            });
        }
        else {
            next(event);
        }
    };
    _NanoSQLHistoryPlugin.prototype._unshiftParent = function (event, histRowIDs, complete) {
        var histTable = this._histTable(event.table);
        if (!histTable) {
            complete(event);
        }
        else {
            this.parent.table(histTable).query("upsert", {
                id: utilities_1.timeid(true),
                table: event.table,
                keys: histRowIDs
            }).exec().then(function () {
                complete(event);
            });
        }
    };
    _NanoSQLHistoryPlugin.prototype._unshiftSingleRow = function (table, eventTypes, rowPK, row, skipIDX, complete) {
        var _this = this;
        var rowHistTable = "_" + table + "__hist_idx";
        var id = utilities_1.timeid(true);
        var adjustHistoryIDX = function (appendID) {
            _this.parent.table(rowHistTable).query("select").where(["id", "=", rowPK]).exec().then(function (rows) {
                var histRowIDX = Object.isFrozen(rows[0]) ? utilities_1._assign(rows[0]) : rows[0];
                histRowIDX.histRows.unshift(appendID);
                _this.parent.table(rowHistTable).query("upsert", histRowIDX).where(["id", "=", rowPK]).exec().then(function () {
                    complete(appendID);
                });
            });
        };
        if (eventTypes.indexOf("delete") > -1 || eventTypes.indexOf("drop") > -1) {
            adjustHistoryIDX(-1);
        }
        else {
            this.parent.table("_" + table + "__hist_rows").query("upsert", __assign({ _id: id }, row)).exec().then(function () {
                if (skipIDX) {
                    complete(id);
                    return;
                }
                adjustHistoryIDX(id);
            });
        }
    };
    _NanoSQLHistoryPlugin.prototype.extend = function (next, args, result) {
        if (args[0] === "hist") {
            var query = args[1];
            var table = args[2];
            var rowPK = args[3];
            switch (query) {
                case "<":
                case ">":
                    this._shiftHistory(query, table, rowPK, function (didAnything) {
                        next(args, [didAnything]);
                    });
                    break;
                case "?":
                    this._queryHistory(table, rowPK, function (qResult) {
                        next(args, qResult);
                    });
                    break;
                case "rev":
                    this._getRevisionHistory(table, rowPK, function (qResult) {
                        next(args, qResult);
                    });
                    break;
                case "clear":
                    this._purgeAllHistory(table, rowPK, function () {
                        next(args, result);
                    });
                    break;
            }
        }
        else {
            next(args, result);
        }
    };
    _NanoSQLHistoryPlugin.prototype._getRevisionHistory = function (table, rowPK, complete) {
        var _this = this;
        var rowHistTable = "_" + table + "__hist_idx";
        this.parent.table(rowHistTable).query("select").where(["id", "=", rowPK]).exec().then(function (rows) {
            var getRows = rows[0].histRows.filter(function (id) { return id !== -1; });
            _this.parent.table("_" + table + "__hist_rows").query("select").where(["_id", "IN", getRows]).exec().then(function (resultRows) {
                var rObj = {};
                resultRows.forEach(function (row) {
                    rObj[row._id] = Object.isFrozen(row) ? utilities_1._assign(row) : row;
                    delete rObj[row._id]._id;
                });
                complete([{
                        pointer: rows[0].histRows.length - rows[0].histPtr - 1,
                        revisions: rows[0].histRows.reverse().map(function (r) { return r === -1 ? null : rObj[r]; })
                    }]);
            });
        });
    };
    _NanoSQLHistoryPlugin.prototype._getTableHistory = function (table, complete) {
        var _this = this;
        this.parent.extend("idx.length", table).then(function (len) {
            _this.parent.table(table + "_ptr").query("select").exec().then(function (rows) {
                if (!rows.length) {
                    complete([0, 0]);
                    return;
                }
                complete([len, len - rows[0].ptr]);
            });
        });
    };
    _NanoSQLHistoryPlugin.prototype._queryHistory = function (table, rowPK, complete) {
        if (!this.historyModes) {
            this._getTableHistory("_hist", function (result) {
                complete(result);
            });
            return;
        }
        var histTable = this._histTable(table);
        if (!histTable) {
            if (!rowPK) {
                throw Error("Need a row primary key to query this history!");
            }
            var rowHistTable = "_" + table + "__hist_idx";
            this.parent.table(rowHistTable).query("select").where(["id", "=", rowPK]).exec().then(function (rows) {
                var histRowIDX = rows[0];
                complete([histRowIDX.histRows.length, histRowIDX.histRows.length - histRowIDX.histPtr - 1]);
            });
        }
        else {
            if (!table) {
                throw Error("Need a table to query this history!");
            }
            this._getTableHistory(histTable, complete);
        }
    };
    _NanoSQLHistoryPlugin.prototype._shiftTableHistory = function (direction, table, complete) {
        var _this = this;
        this.parent.table(table + "_ptr").query("select").exec().then(function (rows) {
            var rowPtr = utilities_1._assign(rows[0]);
            rowPtr.ptr += direction === "<" ? 1 : -1;
            if (rowPtr.ptr < 0)
                rowPtr.ptr = 0;
            _this.parent.extend("idx.length", table).then(function (len) {
                if (rowPtr.ptr > len) {
                    rowPtr.ptr = len;
                }
                if (rows[0].ptr === rowPtr.ptr) {
                    complete(false);
                    return;
                }
                _this.parent.table(table).query("select").range(-1, direction === "<" ? rows[0].ptr : rowPtr.ptr).exec().then(function (rows) {
                    _this.parent.table(table + "_ptr").query("upsert", rowPtr).exec().then(function () {
                        new utilities_1.ALL(rows[0].keys.map(function (pk) {
                            return function (nextRow) {
                                _this._shiftRowHistory(direction, rows[0].table, pk, nextRow);
                            };
                        })).then(function (didAnything) {
                            complete(didAnything.indexOf(true) > -1);
                        });
                    });
                });
            });
        });
    };
    _NanoSQLHistoryPlugin.prototype._shiftRowHistory = function (direction, table, PK, complete) {
        var _this = this;
        var updateIDX = function (meta) {
            _this.parent.table("_" + table + "__hist_idx").query("upsert", meta).where([_this._tablePkKeys[table], "=", PK]).exec().then(function () {
                complete(true);
            });
        };
        this.parent.table("_" + table + "__hist_idx").query("select").where([this._tablePkKeys[table], "=", PK]).exec().then(function (rows) {
            var rowIDX = utilities_1._assign(rows[0]);
            rowIDX.histPtr += direction === "<" ? 1 : -1;
            if (rowIDX.histPtr < 0)
                rowIDX.histPtr = 0;
            if (rowIDX.histPtr > rowIDX.histRows.length - 1)
                rowIDX.histPtr = rowIDX.histRows.length - 1;
            if (rowIDX.histPtr === rows[0].histPtr) {
                complete(false);
                return;
            }
            var historyPK = rowIDX.histRows[rowIDX.histPtr];
            if (historyPK === -1) {
                _this.parent.table(table).query("delete").comment("History Write").where([_this._tablePkKeys[table], "=", PK]).exec().then(function () {
                    updateIDX(rowIDX);
                });
            }
            else {
                _this.parent.table("_" + table + "__hist_rows").query("select").where(["_id", "=", historyPK]).exec().then(function (rows) {
                    _this.parent.table(table).query("upsert", rows[0]).comment("History Write").exec().then(function () {
                        updateIDX(rowIDX);
                    });
                });
            }
        });
    };
    _NanoSQLHistoryPlugin.prototype._shiftHistory = function (direction, table, rowPK, complete) {
        if (!this.historyModes) {
            this._shiftTableHistory(direction, "_hist", complete);
            return;
        }
        var histTable = this._histTable(table);
        if (!histTable) {
            if (!rowPK) {
                throw Error("Need a row primary key to change this history!");
            }
            this._shiftRowHistory(direction, table, rowPK, complete);
        }
        else {
            if (!table) {
                throw Error("Need a table to change this history!");
            }
            this._shiftTableHistory(direction, histTable, complete);
        }
    };
    return _NanoSQLHistoryPlugin;
}());
exports._NanoSQLHistoryPlugin = _NanoSQLHistoryPlugin;
