import { Trie } from "prefix-trie-ts";
import { NanoSQLPlugin, DBConnect, NanoSQLInstance, DatabaseEvent, DataModel } from "./index";
import { IdbQuery } from "./query/std-query";
import { _assign, fastALL, timeid, intersect } from "./utilities";

interface HistoryDataTable {
    id: any;
    table: string;
    keys: any[];
}

interface HistoryTablePointer {
    id: any;
    ptr: number;
}

interface HistoryRowMeta {
    id: any;
    histRows: any[];
    histPtr: number;
}

// uglifyJS workaround
const strs = ["_hist", "_hist_ptr", "_id"];

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
export class _NanoSQLHistoryPlugin implements NanoSQLPlugin {

    public parent: NanoSQLInstance;

    private _tablePkKeys: {
        [tableName: string]: any;
    };

    private _tablePkTypes: {
        [tableName: string]: any;
    };

    private _tableKeys: {
        [tableName: string]: {
            [key: string]: boolean;
        };
    };

    /**
     * If this variable is undefined, historyMode is database wide.
     * Otherwise it will contain an object with a key for each table.
     * Each table will be set to row or table history mode.
     *
     * @type {({
     *         [tableName: string]: ("row" | "table");
     *     })}
     * @memberof _NanoSQLHistoryPlugin
     */
    public historyModes: {
        [tableName: string]: ("row" | "table");
    };

    constructor(
        public historyModeArgs: ("row" | "table" | "database") | { [tableName: string]: ("row" | "table") }
    ) {
        this._tablePkKeys = {};
        this._tablePkTypes = {};
        this._tableKeys = {};
    }

    public willConnect(connectArgs: DBConnect, next: (connectArgs: DBConnect) => void): void {

        this.parent = connectArgs.parent;

        let historyTables: {
            [tableName: string]: DataModel[];
        } = {};

        // handle tables to store row data history
        Object.keys(connectArgs.models).forEach((table) => {
            // only add history for public tables
            if (table.indexOf("_") !== 0) {
                let histModel: DataModel[] = _assign(connectArgs.models[table]).map((model) => {
                    if (model.props && intersect(["pk", "pk()"], model.props)) {
                        this._tablePkKeys[table] = model.key;
                        this._tablePkTypes[table] = model.type;
                        this._tableKeys[table] = {};
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
                    { key: "id", type: this._tablePkTypes[table], props: ["pk()"] }, // same exact primary key as related row
                    { key: "histRows", type: `timeIdms[]` }, // primary keys from _table__hist
                    { key: "histPtr", type: "number" } // where in the above array we are.
                ];
            }
        });


        const isNotString = typeof this.historyModeArgs !== "string";

        const historyTable = [
            { key: "id", type: "timeIdms", props: ["pk()"] },
            { key: "table", type: "string" },
            { key: "keys", type: "any[]" }
        ];

        const historyTablePointer = [ // this table will only have one row, the pointer of the above row that is active
            { key: "id", type: "timeIdms", props: ["pk()"] },
            { key: "ptr", type: "int" }
        ];

        // database/linear mode. all undo/redo is tracked across the entire database.  Default behavior
        if (this.historyModeArgs === "database" || !this.historyModeArgs) {
            historyTables[strs[0]] = historyTable;
            historyTables[strs[1]] = historyTablePointer;
            // table/row mode, undo/redo is tracked either per row OR per table
        } else if (this.historyModeArgs !== "database" || isNotString) {

            this.historyModes = {};

            if (!isNotString) { // apply the global arg ("row" or "table") to every table
                Object.keys(this._tablePkKeys).forEach((table) => {
                    this.historyModes[table] = this.historyModeArgs as any;
                });
            } else { // object of tables was passed in, the user specified a behavior for each table.  Just copy their config object.
                this.historyModes = _assign(this.historyModeArgs);
            }

            // create tracking rows needed for table wide history
            Object.keys(this.historyModes).forEach((table) => {
                if (this.historyModes[table] === "table") {
                    historyTables[`_${table}__hist`] = historyTable;
                    historyTables[`_${table}__hist_ptr`] = historyTablePointer;
                }
            });
        }

        connectArgs.models = {
            ...connectArgs.models,
            ...historyTables
        };

        next(connectArgs);
    }

    private _histTable(table: string): string | null {
        if (!table) return "__null";
        return this.historyModes ? this.historyModes[table] === "table" ? `_${table}__hist` : null : "_hist";
    }

    private _generateHistoryPointers(table: string, complete: () => void) {
        const histTable = this._histTable(table);
        if (!histTable) { // row mode
            complete();
        } else {
            this.parent.query("select").manualExec({
                table: histTable + "_ptr"
            }).then((rows: HistoryTablePointer[]) => {
                if (rows.length) { // already has a pointer
                    complete();
                } else { // needs one
                    this.parent.query("upsert", {
                        id: timeid(true),
                        table: table,
                        ptr: 0 // empty table
                    }).manualExec({ table: histTable + "_ptr" }).then(complete);
                }
            });
        }
    }

    public didConnect(connectArgs: DBConnect, next: () => void): void {

        const finishSetup = () => {
            // we need to know what existing primary keys are in each table and make sure pointers are setup where needed.
            fastALL(Object.keys(this._tableKeys), (table, k, tableDone) => {
                this.parent.extend("beforeConn", "idx", `_${table}__hist_idx`).then((index) => {
                    index.forEach((item) => {
                        this._tableKeys[table][item] = true;
                    });
                    if (this.historyModes) { // table / row mode
                        this._generateHistoryPointers(table, tableDone);
                    } else { // global mode
                        tableDone();
                    }
                });
            }).then(next);
        };

        if (!this.historyModes) { // global mode
            this.parent.query("select").manualExec({
                table: "_hist_ptr"
            }).then((rows: HistoryTablePointer[]) => {
                if (rows.length) {
                    finishSetup();
                } else {
                    this.parent.query("upsert", {
                        id: timeid(true),
                        table: "",
                        ptr: 0
                    }).manualExec({ table: "_hist_ptr" }).then(finishSetup);
                }
            });
        } else {
            finishSetup();
        }
    }


    /**
     * If any of the given row pointers are above zero, remove the rows in "forward" history.
     *
     * @private
     * @param {string} table
     * @param {any[]} rowPKs
     * @param {() => void} complete
     * @memberof _NanoSQLHistoryPlugin
     */
    private _purgeRowHistory(table: string, rowPKs: any[], complete: () => void, clearAll?: boolean) {
        const rowHistTable = "_" + table + "__hist_rows";
        const rowIDXTable = "_" + table + "__hist_idx";


        fastALL(rowPKs, (pk, l, rowDone) => {
            this.parent.query("select").where(["id", "=", pk]).manualExec({ table: rowIDXTable }).then((rows: HistoryRowMeta[]) => {

                if (!rows.length) {
                    rowDone();
                    return;
                }
                let histRowIDX: HistoryRowMeta = Object.isFrozen(rows[0]) ? _assign(rows[0]) : rows[0];
                let delIDs: any[] = [];
                if (clearAll) {
                    delIDs = delIDs.concat(histRowIDX.histRows.filter(r => r !== -1));
                    histRowIDX.histPtr = 0;
                    histRowIDX.histRows = [];
                } else {
                    while (histRowIDX.histPtr--) {
                        delIDs.push(histRowIDX.histRows.shift());
                    }
                    histRowIDX.histPtr = 0;
                }
                if (!delIDs.length) {
                    rowDone();
                    return;
                }

                this.parent.query("upsert", histRowIDX).comment("History Purge").where(["id", "=", pk]).manualExec({ table: rowIDXTable }).then(() => {
                    this.parent.query("delete").comment("History Purge").where(["_id", "IN", delIDs]).manualExec({ table: rowHistTable }).then(() => {
                        if (clearAll) {
                            this.parent.query("select").where([this._tablePkKeys[table], "=", pk]).manualExec({ table: table }).then((existingRow: any) => {
                                this._unshiftSingleRow(table, ["change"], pk, existingRow[0], false, rowDone);
                            });
                        } else {
                            rowDone();
                        }
                    });
                });
            });
        }).then(complete);
    }

    private _purgeTableHistory(table: string, complete: () => void, clearAll?: boolean) {

        this.parent.query("select").manualExec({ table: table + "_ptr" }).then((rows: HistoryTablePointer[]) => {
            let row = Object.isFrozen(rows[0]) ? _assign(rows[0]) : rows[0];

            if (clearAll || row.ptr > 0) {
                let histQ = this.parent.query("select");
                if (!clearAll) {
                    histQ.range(row.ptr * -1, 0);
                }
                histQ.manualExec({ table: table }).then((histTableRows: HistoryDataTable[]) => {

                    if (!histTableRows.length) {
                        complete();
                        return;
                    }
                    let purgeRows: { [table: string]: any[] } = {};
                    histTableRows.forEach((row) => {
                        if (!purgeRows[row.table]) purgeRows[row.table] = [];
                        purgeRows[row.table] = purgeRows[row.table].concat(row.keys);
                    });

                    fastALL(Object.keys(purgeRows), (ta, j, tableDone) => {
                        this._purgeRowHistory(ta, purgeRows[ta], tableDone, clearAll);
                    }).then(() => {
                        this.parent.query("delete").comment("History Purge").where(["id", "IN", histTableRows.map(r => r.id)]).manualExec({ table: table }).then(() => {
                            row.ptr = 0;
                            this.parent.query("upsert", row).comment("History Purge").where(["id", "=", row.id]).manualExec({ table: table + "_ptr" }).then(complete);
                        });
                    });
                });
            } else {
                complete();
            }
        });
    }

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
    private _purgeParentHistory(table: string, rowPKs: any[], complete: () => void) {

        if (!this.historyModes) { // global mode
            this._purgeTableHistory("_hist", complete);
            return;
        }

        const histTable = this._histTable(table);

        if (!histTable) { // row mode
            this._purgeRowHistory(table, rowPKs, complete);
        } else { // table mode
            this._purgeTableHistory(histTable, complete);
        }
    }

    private _purgeAllHistory(table: string, rowPK: any, complete: () => void) {

        if (!this.historyModes) { // global mode
            this._purgeTableHistory("_hist", complete, true);
            return;
        }

        const histTable = this._histTable(table);

        if (!histTable) { // row mode
            this._purgeRowHistory(table, [rowPK], complete, true);
        } else { // table mode
            this._purgeTableHistory(histTable, complete, true);
        }
    }

    public didExec(event: DatabaseEvent, next: (event: DatabaseEvent) => void): void {
        // only do history on public tables (ones that dont begin with _)
        // also only do history if there was a change in the database

        if (event.table && event.table.indexOf("_") !== 0 && event.types.indexOf("change") > -1 && event.query.comments.indexOf("History Write") === -1) {

            this._purgeParentHistory(event.table, event.affectedRowPKS as any[], () => {


                fastALL(event.affectedRows, (row, k, rowDone) => {

                    let pk = row[this._tablePkKeys[event.table as string]];

                    if (this._tableKeys[event.table as string][pk]) { // existing row
                        this._unshiftSingleRow(event.table, event.types, pk, row, false, (id) => {
                            rowDone(pk);
                        });
                    } else { // new row
                        this._tableKeys[event.table as string][pk] = true;

                        this._unshiftSingleRow(event.table, event.types, pk, row, true, (id) => {
                            this.parent.query("upsert", {
                                id: pk,
                                histRows: [id, -1],
                                histPtr: 0
                            }).manualExec({ table: "_" + event.table + "__hist_idx" }).then(() => {
                                rowDone(pk);
                            });
                        });
                    }
                }).then((rowIDs) => {
                    this._unshiftParent(event, rowIDs, next);
                });
            });
        } else {
            next(event);
        }
    }

    private _unshiftParent(event: DatabaseEvent, histRowIDs: any[], complete: (event: DatabaseEvent) => void) {

        // null if in row mode, otherwise provides the history table
        const histTable = this._histTable(event.table);
        if (!histTable) {
            complete(event);
        } else {

            this.parent.query("upsert", {
                id: timeid(true),
                table: event.table,
                keys: histRowIDs
            }).manualExec({ table: histTable }).then(() => {
                complete(event);
            });
        }
    }

    private _unshiftSingleRow(table: string, eventTypes: string[], rowPK, row, skipIDX: boolean, complete: (rowHistoryID: any) => void) {

        const rowHistTable = "_" + table + "__hist_idx";

        const id = timeid(true);

        const adjustHistoryIDX = (appendID: any) => {
            // adjust the history pointer table with the new row id
            this.parent.query("select").where(["id", "=", rowPK]).manualExec({ table: rowHistTable }).then((rows: HistoryRowMeta[]) => {
                let histRowIDX = Object.isFrozen(rows[0]) || Object.isFrozen(rows[0].histRows) ? _assign(rows[0]) : rows[0];
                histRowIDX.histRows.unshift(appendID);
                this.parent.query("upsert", histRowIDX).where(["id", "=", rowPK]).manualExec({ table: rowHistTable }).then(() => {
                    complete(appendID);
                });
            });
        };

        if (eventTypes.indexOf("delete") > -1 || eventTypes.indexOf("drop") > -1) {
            // add deleted record to history table
            adjustHistoryIDX(-1);
        } else {
            // add row to history table

            this.parent.query("upsert", {
                [strs[2]]: id,
                ...row
            }).manualExec({ table: "_" + table + "__hist_rows" }).then(() => {
                if (skipIDX) {
                    complete(id);
                    return;
                }
                adjustHistoryIDX(id);
            });
        }
    }

    public extend(next: (args: any[], result: any[]) => void, args: any[], result: any[]): void {
        if (args[0] === "hist") {
            const query: ("?" | ">" | "<" | "rev" | "clear") = args[1];
            const table: string = args[2];
            const rowPK: any = args[3];

            switch (query) {
                // move database/table/row forward or backward in history
                case "<":
                case ">":
                    this._shiftHistory(query, table, rowPK, (didAnything) => {
                        next(args, [didAnything]);
                    });
                    break;
                // query history state of database/table/row
                case "?":
                    this._queryHistory(table, rowPK, (qResult) => {
                        next(args, qResult);
                    });
                    break;
                // get all revisions of a given row
                case "rev":
                    this._getRevisionHistory(table, rowPK, (qResult) => {
                        next(args, qResult);
                    });
                    break;
                // clear history of the database/table/row
                case "clear":
                    this._purgeAllHistory(table, rowPK, () => {
                        next(args, result);
                    });
                    break;
            }
        } else {
            next(args, result);
        }
    }

    // only works when given a specific row
    private _getRevisionHistory(table: string, rowPK: any, complete: (data: any[]) => void) {
        const rowHistTable = "_" + table + "__hist_idx";
        this.parent.query("select").where(["id", "=", rowPK]).manualExec({ table: rowHistTable }).then((rows: HistoryRowMeta[]) => {
            const getRows = rows[0].histRows.filter(id => id !== -1);
            this.parent.query("select").where(["_id", "IN", getRows]).manualExec({ table: "_" + table + "__hist_rows" }).then((resultRows: any[]) => {
                const rObj = {};
                resultRows.forEach((row) => {
                    rObj[row[strs[2]]] = Object.isFrozen(row) ? _assign(row) : row;
                    delete rObj[row[strs[2]]][strs[2]];
                });
                complete([{
                    pointer: rows[0].histRows.length - rows[0].histPtr - 1,
                    revisions: rows[0].histRows.reverse().map(r => r === -1 ? null : rObj[r])
                }]);
            });
        });
    }

    private _getTableHistory(table: string, complete: (result: [number, number]) => void) {
        this.parent.extend("idx.length", table).then((len: number) => {
            this.parent.query("select").manualExec({ table: table + "_ptr" }).then((rows: HistoryTablePointer[]) => {
                if (!rows.length) {
                    complete([0, 0]);
                    return;
                }
                complete([len, len - rows[0].ptr]);
            });
        });
    }

    private _queryHistory(table: string, rowPK: any, complete: (result: [number, number]) => void) {

        if (!this.historyModes) { // global mode
            this._getTableHistory("_hist", (result) => {
                complete(result);
            });
            return;
        }

        const histTable = this._histTable(table);

        if (!histTable) { // get single row history
            if (!rowPK) {
                throw Error("nSQL: Need a row primary key to query this history!");
            }
            const rowHistTable = "_" + table + "__hist_idx";
            this.parent.query("select").where(["id", "=", rowPK]).manualExec({ table: rowHistTable }).then((rows: HistoryRowMeta[]) => {
                let histRowIDX = rows[0];
                complete([histRowIDX.histRows.length, histRowIDX.histRows.length - histRowIDX.histPtr - 1]);
            });
        } else { // get single table history
            if (!table) {
                throw Error("nSQL: Need a table to query this history!");
            }
            this._getTableHistory(histTable, complete);
        }
    }

    private _shiftTableHistory(direction: "<" | ">", table: string, complete: (didAnything: boolean) => void) {

        this.parent.query("select").manualExec({ table: table + "_ptr" }).then((rows: HistoryTablePointer[]) => {
            let rowPtr: HistoryTablePointer = _assign(rows[0]);
            rowPtr.ptr += direction === "<" ? 1 : -1;

            if (rowPtr.ptr < 0) rowPtr.ptr = 0;

            this.parent.extend("idx.length", table).then((len: number) => {
                if (rowPtr.ptr > len) {
                    rowPtr.ptr = len;
                }
                if (rows[0].ptr === rowPtr.ptr) { // no change in history, nothing to do.
                    complete(false);
                    return;
                }

                this.parent.query("select").range(-1, direction === "<" ? rows[0].ptr : rowPtr.ptr).manualExec({ table: table }).then((rows: HistoryDataTable[]) => {

                    this.parent.query("upsert", rowPtr).manualExec({ table: table + "_ptr" }).then(() => {
                        fastALL(rows[0].keys, (pk, i, nextRow) => {
                            this._shiftRowHistory(direction, rows[0].table, pk, nextRow);
                        }).then((didAnything: boolean[]) => {
                            complete(didAnything.indexOf(true) > -1);
                        });
                    });
                });
            });
        });
    }

    private _shiftRowHistory(direction: "<" | ">", table: string, PK: any, complete: (didAnything: boolean) => void) {

        const updateIDX = (meta: HistoryRowMeta) => {
            this.parent.query("upsert", meta).where([this._tablePkKeys[table], "=", PK]).manualExec({ table: `_${table}__hist_idx` }).then(() => {
                complete(true);
            });
        };

        this.parent.query("select").where([this._tablePkKeys[table], "=", PK]).manualExec({ table: `_${table}__hist_idx` }).then((rows: HistoryRowMeta[]) => {
            let rowIDX: HistoryRowMeta = _assign(rows[0]);
            rowIDX.histPtr += direction === "<" ? 1 : -1;

            if (rowIDX.histPtr < 0) rowIDX.histPtr = 0;
            if (rowIDX.histPtr > rowIDX.histRows.length - 1) rowIDX.histPtr = rowIDX.histRows.length - 1;
            if (rowIDX.histPtr === rows[0].histPtr) { // outside of history range, nothing to do
                complete(false);
                return;
            }

            const historyPK = rowIDX.histRows[rowIDX.histPtr];

            if (historyPK === -1) { // row has been deleted
                this.parent.query("delete").comment("History Write").where([this._tablePkKeys[table], "=", PK]).manualExec({ table: table }).then(() => {
                    updateIDX(rowIDX);
                });
            } else { // row has been added or modified
                // pull the history's copy of the row
                this.parent.query("select").where(["_id", "=", historyPK]).manualExec({ table: `_${table}__hist_rows` }).then((rows: any[]) => {
                    // overwrite the row in the database
                    this.parent.query("upsert", rows[0]).comment("History Write").manualExec({ table: table }).then(() => {
                        updateIDX(rowIDX);
                    });
                });
            }
        });
    }

    private _shiftHistory(direction: "<" | ">", table: string, rowPK: any, complete: (didAnything: boolean) => void) {
        if (!this.historyModes) { // global mode
            this._shiftTableHistory(direction, "_hist", complete);
            return;
        }

        const histTable = this._histTable(table);

        if (!histTable) { // adjust single row history
            if (!rowPK) {
                throw Error("nSQL: Need a row primary key to change this history!");
            }
            this._shiftRowHistory(direction, table, rowPK, complete);

        } else { // adjust single table history
            if (!table) {
                throw Error("nSQL: Need a table to change this history!");
            }
            this._shiftTableHistory(direction, histTable, complete);
        }
    }
}