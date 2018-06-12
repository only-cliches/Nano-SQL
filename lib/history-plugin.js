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
// uglifyJS workaround
var strs = ["_hist", "_hist_ptr", "_id"];
/**
 * New History Plugin
 * Provides multiple history modes, including a per row mode (for row revisions), a database wide mode and a table wide mode.
 * You can either set a single argument to tell the system to use row, table, or database mode OR you can pass in an object.
 * The object should contain a key with all tables with history, each value should be "row" or "table", dictating the type of history
 * for that table.
 *
 * @export
 * @class _NanoSQLHistoryPlugin
 * @implements {NanoSQLPlugin}
 */
// tslint:disable-next-line
var _NanoSQLHistoryPlugin = /** @class */ (function () {
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
        // handle tables to store row data history
        Object.keys(connectArgs.models).forEach(function (table) {
            // only add history for public tables
            if (table.indexOf("_") !== 0) {
                var histModel = utilities_1._assign(connectArgs.models[table]).map(function (model) {
                    if (model.props && utilities_1.intersect(["pk", "pk()"], model.props)) {
                        _this._tablePkKeys[table] = model.key;
                        _this._tablePkTypes[table] = model.type;
                        _this._tableKeys[table] = {};
                    }
                    delete model.props; // remove secondary indexes and everything else fancy
                    delete model.default; // remove default column value
                    return model;
                });
                // add new primary key used by the history system
                histModel.unshift({ key: "_id", type: "timeIdms", props: ["pk()"] });
                // Holds old or new row data
                historyTables["_" + table + "__hist_rows"] = histModel;
                // holds where in the row history we are
                historyTables["_" + table + "__hist_idx"] = [
                    { key: "id", type: _this._tablePkTypes[table], props: ["pk()"] },
                    { key: "histRows", type: "timeIdms[]" },
                    { key: "histPtr", type: "number" } // where in the above array we are.
                ];
            }
        });
        var isNotString = typeof this.historyModeArgs !== "string";
        var historyTable = [
            { key: "id", type: "timeIdms", props: ["pk()"] },
            { key: "table", type: "string" },
            { key: "keys", type: "any[]" }
        ];
        var historyTablePointer = [
            { key: "id", type: "timeIdms", props: ["pk()"] },
            { key: "ptr", type: "int" }
        ];
        // database/linear mode. all undo/redo is tracked across the entire database.  Default behavior
        if (this.historyModeArgs === "database" || !this.historyModeArgs) {
            historyTables[strs[0]] = historyTable;
            historyTables[strs[1]] = historyTablePointer;
            // table/row mode, undo/redo is tracked either per row OR per table
        }
        else if (this.historyModeArgs !== "database" || isNotString) {
            this.historyModes = {};
            if (!isNotString) { // apply the global arg ("row" or "table") to every table
                Object.keys(this._tablePkKeys).forEach(function (table) {
                    _this.historyModes[table] = _this.historyModeArgs;
                });
            }
            else { // object of tables was passed in, the user specified a behavior for each table.  Just copy their config object.
                this.historyModes = utilities_1._assign(this.historyModeArgs);
            }
            // create tracking rows needed for table wide history
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
        if (!histTable) { // row mode
            complete();
        }
        else {
            this.parent.query("select").manualExec({
                table: histTable + "_ptr"
            }).then(function (rows) {
                if (rows.length) { // already has a pointer
                    complete();
                }
                else { // needs one
                    _this.parent.query("upsert", {
                        id: utilities_1.timeid(true),
                        table: table,
                        ptr: 0 // empty table
                    }).manualExec({ table: histTable + "_ptr" }).then(complete);
                }
            });
        }
    };
    _NanoSQLHistoryPlugin.prototype.didConnect = function (connectArgs, next) {
        var _this = this;
        var finishSetup = function () {
            // we need to know what existing primary keys are in each table and make sure pointers are setup where needed.
            utilities_1.fastALL(Object.keys(_this._tableKeys), function (table, k, tableDone) {
                _this.parent.extend("beforeConn", "idx", "_" + table + "__hist_idx").then(function (index) {
                    index.forEach(function (item) {
                        _this._tableKeys[table][item] = true;
                    });
                    if (_this.historyModes) { // table / row mode
                        _this._generateHistoryPointers(table, tableDone);
                    }
                    else { // global mode
                        tableDone();
                    }
                });
            }).then(next);
        };
        if (!this.historyModes) { // global mode
            this.parent.query("select").manualExec({
                table: "_hist_ptr"
            }).then(function (rows) {
                if (rows.length) {
                    finishSetup();
                }
                else {
                    _this.parent.query("upsert", {
                        id: utilities_1.timeid(true),
                        table: "",
                        ptr: 0
                    }).manualExec({ table: "_hist_ptr" }).then(finishSetup);
                }
            });
        }
        else {
            finishSetup();
        }
    };
    /**
     * If any of the given row pointers are above zero, remove the rows in "forward" history.
     *
     * @private
     * @param {string} table
     * @param {any[]} rowPKs
     * @param {() => void} complete
     * @memberof _NanoSQLHistoryPlugin
     */
    _NanoSQLHistoryPlugin.prototype._purgeRowHistory = function (table, rowPKs, complete, clearAll) {
        var _this = this;
        var rowHistTable = "_" + table + "__hist_rows";
        var rowIDXTable = "_" + table + "__hist_idx";
        utilities_1.fastALL(rowPKs, function (pk, l, rowDone) {
            _this.parent.query("select").where(["id", "=", pk]).manualExec({ table: rowIDXTable }).then(function (rows) {
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
                _this.parent.query("upsert", histRowIDX).comment("History Purge").where(["id", "=", pk]).manualExec({ table: rowIDXTable }).then(function () {
                    _this.parent.query("delete").comment("History Purge").where(["_id", "IN", delIDs]).manualExec({ table: rowHistTable }).then(function () {
                        if (clearAll) {
                            _this.parent.query("select").where([_this._tablePkKeys[table], "=", pk]).manualExec({ table: table }).then(function (existingRow) {
                                _this._unshiftSingleRow(table, ["change"], pk, existingRow[0], false, rowDone);
                            });
                        }
                        else {
                            rowDone();
                        }
                    });
                });
            });
        }).then(complete);
    };
    _NanoSQLHistoryPlugin.prototype._purgeTableHistory = function (table, complete, clearAll) {
        var _this = this;
        this.parent.query("select").manualExec({ table: table + "_ptr" }).then(function (rows) {
            var row = Object.isFrozen(rows[0]) ? utilities_1._assign(rows[0]) : rows[0];
            if (clearAll || row.ptr > 0) {
                var histQ = _this.parent.query("select");
                if (!clearAll) {
                    histQ.range(row.ptr * -1, 0);
                }
                histQ.manualExec({ table: table }).then(function (histTableRows) {
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
                    utilities_1.fastALL(Object.keys(purgeRows), function (ta, j, tableDone) {
                        _this._purgeRowHistory(ta, purgeRows[ta], tableDone, clearAll);
                    }).then(function () {
                        _this.parent.query("delete").comment("History Purge").where(["id", "IN", histTableRows.map(function (r) { return r.id; })]).manualExec({ table: table }).then(function () {
                            row.ptr = 0;
                            _this.parent.query("upsert", row).comment("History Purge").where(["id", "=", row.id]).manualExec({ table: table + "_ptr" }).then(complete);
                        });
                    });
                });
            }
            else {
                complete();
            }
        });
    };
    /**
     * If any row pointers are above zero, we must first remove the revisions ahead of the existing one before adding a new revision.
     * This prevents the history from becomming broken
     *
     * @private
     * @param {string} table
     * @param {any[]} rowPKs
     * @param {() => void} complete
     * @memberof _NanoSQLHistoryPlugin
     */
    _NanoSQLHistoryPlugin.prototype._purgeParentHistory = function (table, rowPKs, complete) {
        if (!this.historyModes) { // global mode
            this._purgeTableHistory("_hist", complete);
            return;
        }
        var histTable = this._histTable(table);
        if (!histTable) { // row mode
            this._purgeRowHistory(table, rowPKs, complete);
        }
        else { // table mode
            this._purgeTableHistory(histTable, complete);
        }
    };
    _NanoSQLHistoryPlugin.prototype._purgeAllHistory = function (table, rowPK, complete) {
        if (!this.historyModes) { // global mode
            this._purgeTableHistory("_hist", complete, true);
            return;
        }
        var histTable = this._histTable(table);
        if (!histTable) { // row mode
            this._purgeRowHistory(table, [rowPK], complete, true);
        }
        else { // table mode
            this._purgeTableHistory(histTable, complete, true);
        }
    };
    _NanoSQLHistoryPlugin.prototype.didExec = function (event, next) {
        // only do history on public tables (ones that dont begin with _)
        // also only do history if there was a change in the database
        var _this = this;
        if (event.table && event.table.indexOf("_") !== 0 && event.types.indexOf("change") > -1 && event.query.comments.indexOf("History Write") === -1) {
            this._purgeParentHistory(event.table, event.affectedRowPKS, function () {
                utilities_1.fastALL(event.affectedRows, function (row, k, rowDone) {
                    var pk = row[_this._tablePkKeys[event.table]];
                    if (_this._tableKeys[event.table][pk]) { // existing row
                        _this._unshiftSingleRow(event.table, event.types, pk, row, false, function (id) {
                            rowDone(pk);
                        });
                    }
                    else { // new row
                        _this._tableKeys[event.table][pk] = true;
                        _this._unshiftSingleRow(event.table, event.types, pk, row, true, function (id) {
                            _this.parent.query("upsert", {
                                id: pk,
                                histRows: [id, -1],
                                histPtr: 0
                            }).manualExec({ table: "_" + event.table + "__hist_idx" }).then(function () {
                                rowDone(pk);
                            });
                        });
                    }
                }).then(function (rowIDs) {
                    _this._unshiftParent(event, rowIDs, next);
                });
            });
        }
        else {
            next(event);
        }
    };
    _NanoSQLHistoryPlugin.prototype._unshiftParent = function (event, histRowIDs, complete) {
        // null if in row mode, otherwise provides the history table
        var histTable = this._histTable(event.table);
        if (!histTable) {
            complete(event);
        }
        else {
            this.parent.query("upsert", {
                id: utilities_1.timeid(true),
                table: event.table,
                keys: histRowIDs
            }).manualExec({ table: histTable }).then(function () {
                complete(event);
            });
        }
    };
    _NanoSQLHistoryPlugin.prototype._unshiftSingleRow = function (table, eventTypes, rowPK, row, skipIDX, complete) {
        var _this = this;
        var rowHistTable = "_" + table + "__hist_idx";
        var id = utilities_1.timeid(true);
        var adjustHistoryIDX = function (appendID) {
            // adjust the history pointer table with the new row id
            _this.parent.query("select").where(["id", "=", rowPK]).manualExec({ table: rowHistTable }).then(function (rows) {
                var histRowIDX = Object.isFrozen(rows[0]) || Object.isFrozen(rows[0].histRows) ? utilities_1._assign(rows[0]) : rows[0];
                histRowIDX.histRows.unshift(appendID);
                _this.parent.query("upsert", histRowIDX).where(["id", "=", rowPK]).manualExec({ table: rowHistTable }).then(function () {
                    complete(appendID);
                });
            });
        };
        if (eventTypes.indexOf("delete") > -1 || eventTypes.indexOf("drop") > -1) {
            // add deleted record to history table
            adjustHistoryIDX(-1);
        }
        else {
            // add row to history table
            this.parent.query("upsert", __assign((_a = {}, _a[strs[2]] = id, _a), row)).manualExec({ table: "_" + table + "__hist_rows" }).then(function () {
                if (skipIDX) {
                    complete(id);
                    return;
                }
                adjustHistoryIDX(id);
            });
        }
        var _a;
    };
    _NanoSQLHistoryPlugin.prototype.extend = function (next, args, result) {
        if (args[0] === "hist") {
            var query = args[1];
            var table = args[2];
            var rowPK = args[3];
            switch (query) {
                // move database/table/row forward or backward in history
                case "<":
                case ">":
                    this._shiftHistory(query, table, rowPK, function (didAnything) {
                        next(args, [didAnything]);
                    });
                    break;
                // query history state of database/table/row
                case "?":
                    this._queryHistory(table, rowPK, function (qResult) {
                        next(args, qResult);
                    });
                    break;
                // get all revisions of a given row
                case "rev":
                    this._getRevisionHistory(table, rowPK, function (qResult) {
                        next(args, qResult);
                    });
                    break;
                // clear history of the database/table/row
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
    // only works when given a specific row
    _NanoSQLHistoryPlugin.prototype._getRevisionHistory = function (table, rowPK, complete) {
        var _this = this;
        var rowHistTable = "_" + table + "__hist_idx";
        this.parent.query("select").where(["id", "=", rowPK]).manualExec({ table: rowHistTable }).then(function (rows) {
            var getRows = rows[0].histRows.filter(function (id) { return id !== -1; });
            _this.parent.query("select").where(["_id", "IN", getRows]).manualExec({ table: "_" + table + "__hist_rows" }).then(function (resultRows) {
                var rObj = {};
                resultRows.forEach(function (row) {
                    rObj[row[strs[2]]] = Object.isFrozen(row) ? utilities_1._assign(row) : row;
                    delete rObj[row[strs[2]]][strs[2]];
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
            _this.parent.query("select").manualExec({ table: table + "_ptr" }).then(function (rows) {
                if (!rows.length) {
                    complete([0, 0]);
                    return;
                }
                complete([len, len - rows[0].ptr]);
            });
        });
    };
    _NanoSQLHistoryPlugin.prototype._queryHistory = function (table, rowPK, complete) {
        if (!this.historyModes) { // global mode
            this._getTableHistory("_hist", function (result) {
                complete(result);
            });
            return;
        }
        var histTable = this._histTable(table);
        if (!histTable) { // get single row history
            if (!rowPK) {
                throw Error("nSQL: Need a row primary key to query this history!");
            }
            var rowHistTable = "_" + table + "__hist_idx";
            this.parent.query("select").where(["id", "=", rowPK]).manualExec({ table: rowHistTable }).then(function (rows) {
                var histRowIDX = rows[0];
                complete([histRowIDX.histRows.length, histRowIDX.histRows.length - histRowIDX.histPtr - 1]);
            });
        }
        else { // get single table history
            if (!table) {
                throw Error("nSQL: Need a table to query this history!");
            }
            this._getTableHistory(histTable, complete);
        }
    };
    _NanoSQLHistoryPlugin.prototype._shiftTableHistory = function (direction, table, complete) {
        var _this = this;
        this.parent.query("select").manualExec({ table: table + "_ptr" }).then(function (rows) {
            var rowPtr = utilities_1._assign(rows[0]);
            rowPtr.ptr += direction === "<" ? 1 : -1;
            if (rowPtr.ptr < 0)
                rowPtr.ptr = 0;
            _this.parent.extend("idx.length", table).then(function (len) {
                if (rowPtr.ptr > len) {
                    rowPtr.ptr = len;
                }
                if (rows[0].ptr === rowPtr.ptr) { // no change in history, nothing to do.
                    complete(false);
                    return;
                }
                _this.parent.query("select").range(-1, direction === "<" ? rows[0].ptr : rowPtr.ptr).manualExec({ table: table }).then(function (rows) {
                    _this.parent.query("upsert", rowPtr).manualExec({ table: table + "_ptr" }).then(function () {
                        utilities_1.fastALL(rows[0].keys, function (pk, i, nextRow) {
                            _this._shiftRowHistory(direction, rows[0].table, pk, nextRow);
                        }).then(function (didAnything) {
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
            _this.parent.query("upsert", meta).where([_this._tablePkKeys[table], "=", PK]).manualExec({ table: "_" + table + "__hist_idx" }).then(function () {
                complete(true);
            });
        };
        this.parent.query("select").where([this._tablePkKeys[table], "=", PK]).manualExec({ table: "_" + table + "__hist_idx" }).then(function (rows) {
            var rowIDX = utilities_1._assign(rows[0]);
            rowIDX.histPtr += direction === "<" ? 1 : -1;
            if (rowIDX.histPtr < 0)
                rowIDX.histPtr = 0;
            if (rowIDX.histPtr > rowIDX.histRows.length - 1)
                rowIDX.histPtr = rowIDX.histRows.length - 1;
            if (rowIDX.histPtr === rows[0].histPtr) { // outside of history range, nothing to do
                complete(false);
                return;
            }
            var historyPK = rowIDX.histRows[rowIDX.histPtr];
            if (historyPK === -1) { // row has been deleted
                _this.parent.query("delete").comment("History Write").where([_this._tablePkKeys[table], "=", PK]).manualExec({ table: table }).then(function () {
                    updateIDX(rowIDX);
                });
            }
            else { // row has been added or modified
                // pull the history's copy of the row
                _this.parent.query("select").where(["_id", "=", historyPK]).manualExec({ table: "_" + table + "__hist_rows" }).then(function (rows) {
                    // overwrite the row in the database
                    _this.parent.query("upsert", rows[0]).comment("History Write").manualExec({ table: table }).then(function () {
                        updateIDX(rowIDX);
                    });
                });
            }
        });
    };
    _NanoSQLHistoryPlugin.prototype._shiftHistory = function (direction, table, rowPK, complete) {
        if (!this.historyModes) { // global mode
            this._shiftTableHistory(direction, "_hist", complete);
            return;
        }
        var histTable = this._histTable(table);
        if (!histTable) { // adjust single row history
            if (!rowPK) {
                throw Error("nSQL: Need a row primary key to change this history!");
            }
            this._shiftRowHistory(direction, table, rowPK, complete);
        }
        else { // adjust single table history
            if (!table) {
                throw Error("nSQL: Need a table to change this history!");
            }
            this._shiftTableHistory(direction, histTable, complete);
        }
    };
    return _NanoSQLHistoryPlugin;
}());
exports._NanoSQLHistoryPlugin = _NanoSQLHistoryPlugin;
//# sourceMappingURL=history-plugin.js.map