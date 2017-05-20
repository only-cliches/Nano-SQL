import { NanoSQLInstance, _assign, NanoSQLBackend, ActionOrView, QueryLine, DBRow, DataModel, StdObject, DBConnect, DBExec, JoinArgs, DBFunction } from "./index";
import { Promise } from "lie-ts";
import { IHistoryPoint, _NanoSQL_Storage } from "./db-storage";
import { _NanoSQLQuery } from "./db-query";

// Bypass uglifyjs minifaction of these properties
export const _str = (index: number) => {
    return ["_utility", "_historyPoints", "_pointer", "_historyDataRowIDs", "_id"][index];
};

export interface HistoryCallBack {
    [tableID: number]: {
        rows: DBRow[];
        type: string;
        affectedPKS: any[]
    };
}

/**
 * The main class for the immutable database, holds the indexes, data and primary methods.
 *
 * A majority of data moving around for select statements and the like is indexes, not the actual data.
 *
 * @export
 * @class _NanoSQLDB
 * @implements {NanoSQLBackend}
 */
// tslint:disable-next-line
export class _NanoSQLDB implements NanoSQLBackend {

    /**
     * Unique database hash ID based on the data model.
     *
     * @internal
     * @type {string}
     * @memberOf _NanoSQLDB
     */
    public _databaseID: string;

    /**
     * An array holding any queries that should be executed after the current one.
     *
     * @internal
     * @type {Array<DBExec>}
     * @memberOf _NanoSQLDB
     */
    private _pendingQuerys: Array<DBExec>;

    /**
     * The NanoSQL instance this database is attached to.
     *
     * @internal
     * @type {NanoSQLInstance}
     * @memberOf _NanoSQLDB
     */
    public _parent: NanoSQLInstance;

    /**
     * A query hash split up by tables.
     *
     * @internal
     * @type {{
     *         [tableID: number]: {
     *             [queryHash: number]: Array<DBRow>
     *         }
     *     }}
     * @memberOf _NanoSQLDB
     */
    public _queryCache: {
        [tableID: number]: {
            [queryHash: number]: Array<DBRow>
        }
    };

    /**
     * Holds the database data.
     *
     * @type {_NanoSQL_Storage}
     * @memberOf _NanoSQLDB
     */
    public _store: _NanoSQL_Storage;

    constructor() {
        let t = this;
        t._pendingQuerys = [];
        t._queryCache = {};
    }


    /**
     * Called once to init the database, prep all the needed variables and data models
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf _NanoSQLDB
     */
    public _connect(connectArgs: DBConnect): void {
        let t = this;
        t._databaseID = NanoSQLInstance._hash(JSON.stringify(connectArgs._models)).toString();
        t._parent = connectArgs._parent;
        t._store = new _NanoSQL_Storage(t, connectArgs);
    }

    /**
     * Called by NanoSQL to execute queries on this database.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf _NanoSQLDB
     */
    public _exec(execArgs: DBExec): void {
        let t = this;
        new _NanoSQLQuery(t)._doQuery(execArgs);
    }

    /**
     * Invalidate the query cache based on the rows being affected
     *
     * @internal
     * @param {boolean} triggerChange
     *
     * @memberOf _NanoSQLDB
     */
    public _invalidateCache(changedTableID: number, changedRows: DBRow[], changedRowPKS: any[], type: string, action?: string): void {
        let t = this;

        t._queryCache[changedTableID] = {};
        if (changedRows.length && action) {
            t._parent.triggerEvent({
                name: "change",
                actionOrView: "",
                table: t._store._tables[changedTableID]._name,
                query: [],
                time: new Date().getTime(),
                result: [{ msg: action + " was performed.", type: action }],
                changedRows: changedRows,
                changedRowPKS: changedRowPKS,
                changeType: type
            }, ["change"]);
        }
    }

    /**
     * Recursively freezes a js object, used to prevent the rows from being edited once they're added.
     *
     * @internal
     * @param {*} obj
     * @returns {*}
     *
     * @memberOf _NanoSQLQuery
     */
    public _deepFreeze(obj: any, tableID?: number): any {
        if (!obj) return obj;
        let t = this;
        if (tableID) {
            t._store._models[tableID].forEach((model) => {
                let prop = obj[model.key];
                if (["map", "array"].indexOf(model.type) >= 0 || model.type.indexOf("[]") >= 0) {
                    obj[model.key] = t._deepFreeze(prop);
                }
            });
        }

        return Object.freeze(obj);
    }

    public _transaction(type: "start" | "end", transactionID: number): Promise<any[]> {
        let t = this;
        return new Promise((res, rej) => {
            if (type === "start") {
                t._store._activeTransactions.push(transactionID);
                res();
            }
            if (type === "end") {
                t._store._execTransaction(transactionID).then((result) => {
                    let tLoc = t._store._activeTransactions.indexOf(transactionID);
                    if (tLoc !== -1) t._store._activeTransactions.splice(tLoc, 1);
                    t._parent._tableNames.forEach((tableName) => {
                        t._invalidateCache(NanoSQLInstance._hash(tableName), [], [], "transaction");
                    });
                    res(result);
                });
            }
        });
    }

    /**
     * Undo & Redo logic.
     *
     * ### Undo
     * Reverse the state of the database by one step into the past.
     * Usage: `NanoSQL().extend("<")`;
     *
     * ### Redo
     * Step the database state forward by one.
     * Usage: `NanoSQL().extend(">")`;
     *
     * ### Query
     * Discover the state of the history system
     * ```ts
     * NanoSQL().extend("?").then(function(state) {
     *  console.log(state[0]) // <= length of history records
     *  console.log(state[1]) // <= current history pointer position
     * });
     * ```
     *
     * The history point is zero by default, perforing undo shifts the pointer backward while redo shifts it forward.
     *
     * @param {NanoSQLInstance} db
     * @param {("<"|">"|"?")} command
     * @returns {Promise<any>}
     *
     * @memberOf _NanoSQLDB
     */
    public _extend(db: NanoSQLInstance, command: string): Promise<any> {

        let t = this;
        let i;
        let h;
        let j;
        let rowID;
        let rowData;
        let rowKey;
        let store: IDBObjectStore;
        const shiftRowIDs = (direction: number, callBack: (cbData: HistoryCallBack) => void): void => {

            let results: HistoryCallBack = {};
            const check = (t._store._historyLength - t._store._historyPoint);
            t._store._readArray(_str(1), t._store._historyPointIndex[check], (hps: IHistoryPoint[]) => {
                // Loop through all history points
                Promise.chain(hps.map((hp) => {
                    return new Promise((res, rej) => {

                        let tableID: number = hp.tableID;
                        let table = t._store._tables[tableID];
                        let rows: DBRow[] = [];

                        // Loop through all rows
                        Promise.chain(hp.rowKeys.map((rowID: any) => {
                            return new Promise((res2, rej2) => {

                                if (!results[tableID]) results[tableID] = { type: hp.type, rows: [], affectedPKS: hp.rowKeys };
                                // Shift the row pointer
                                t._store._read("_" + table._name + "_hist__meta", rowID, (row) => {
                                    row = _assign(row);
                                    row[0][_str(2)] = (row[0][_str(2)] || 0) + direction;
                                    const historyRowID = row[0][_str(3)][row[0][_str(2)]];
                                    t._store._upsert("_" + table._name + "_hist__meta", rowID, row[0], () => { // Update row pointer
                                        t._store._read("_" + table._name + "_hist__data", historyRowID, (setRow) => { // Now getting the new row data

                                            let newRow = {};
                                            if (setRow.length) {
                                                table._keys.forEach((k) => {
                                                    newRow[k] = setRow[0][k];
                                                });
                                            }

                                            t._store._upsert(table._name, rowID, setRow.length ? newRow : null, () => { // Overwriting row data

                                                rows.push(newRow);
                                                results[tableID].rows = results[tableID].rows.concat(rows);
                                                i++;
                                                res2();
                                            });
                                        });
                                    });
                                });
                            });
                        })).then(res);
                    });
                })).then(() => {
                    callBack(results);
                });
            });
        };

        return new Promise((res, rej) => {

            switch (command) {
                case "<":
                    if (!t._store._historyLength || t._store._historyPoint === t._store._historyLength) { // end of history
                        res(false);
                    } else {
                        shiftRowIDs(1, (affectedTables: HistoryCallBack) => {
                            t._store._historyPoint++;
                            t._store._utility("w", "historyPoint", t._store._historyPoint);
                            Object.keys(affectedTables).forEach((tableID) => {
                                let description = affectedTables[tableID].type;
                                switch (description) {
                                    case "inserted":
                                        description = "deleted";
                                        break;
                                    case "deleted":
                                        description = "inserted";
                                        break;
                                }
                                t._invalidateCache(parseInt(tableID), affectedTables[tableID].rows, affectedTables[tableID].affectedPKS, description, "undo");
                            });
                            res(true);
                        });
                    }
                    break;
                case ">":
                    if (!t._store._historyLength || t._store._historyPoint < 1) { // beginning of history
                        res(false);
                    } else {
                        t._store._historyPoint--;
                        t._store._utility("w", "historyPoint", t._store._historyPoint);
                        shiftRowIDs(-1, (affectedTables) => {
                            Object.keys(affectedTables).forEach((tableID) => {
                                t._invalidateCache(parseInt(tableID), affectedTables[tableID].rows, affectedTables[tableID].affectedPKS, affectedTables[tableID].type, "redo");
                            });
                            res(true);
                        });
                    }
                    break;
                case "?":
                    h = [t._store._historyLength, t._store._historyLength - t._store._historyPoint];
                    if (t._store._historyArray.join("+") !== h.join("+")) {
                        t._store._historyArray = h;
                    }
                    res(t._store._historyArray);
                    break;
                case "flush_history":
                case "flush_db":
                    t._store._utility("w", "historyPoint", 0);
                    t._store._utility("w", "historyLength", 0);
                    t._store._historyPoint = 0;
                    t._store._historyLength = 0;
                    Object.keys(t._store._tables).forEach((tableID) => {
                        let pks: any | null[];
                        if (t._store._tables[parseInt(tableID)]._name.indexOf("_") === 0) {
                            pks = [];
                        } else {
                            pks = t._store._tables[parseInt(tableID)]._index;
                        }
                        t._invalidateCache(parseInt(tableID), pks.map(r => null), pks, "remove", "clear");
                    });
                    if (command === "flush_db") {
                        t._store._clear("all", res);
                    } else {
                        t._store._clear("hist", res);
                    }
                    break;
            }
        });
    }
}