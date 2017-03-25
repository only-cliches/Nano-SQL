import { NanoSQLInstance, _assign, NanoSQLBackend, ActionOrView, QueryLine, DBRow, DataModel, StdObject, DBConnect, DBExec, JoinArgs, DBFunction } from "./index";
import { Promise } from "lie-ts";
import { IHistoryPoint, _NanoSQL_Storage } from "./db-storage";
import { _NanoSQLQuery } from "./db-query";

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
     * @type {number}
     * @memberOf _NanoSQLDB
     */
    public _databaseID: number;

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
     * A hash of the current table name.
     *
     * @internal
     * @type {number}
     * @memberOf _NanoSQLDB
     */
    public _selectedTable: number;

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
        t._databaseID = NanoSQLInstance._hash(JSON.stringify(connectArgs._models));
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

        if (t._pendingQuerys.length) {
            t._pendingQuerys.push(execArgs);
        } else {
            t._selectedTable = NanoSQLInstance._hash(execArgs._table);
            new _NanoSQLQuery(t)._doQuery(execArgs, (query) => {
                if (t._pendingQuerys.length) {
                    t._exec(<any> t._pendingQuerys.pop());
                }
            });
        }
    }

    /**
     * Invalidate the query cache based on the rows being affected
     *
     * @internal
     * @param {boolean} triggerChange
     *
     * @memberOf _NanoSQLDB
     */
    public _invalidateCache(changedTableID: number, changedRows: DBRow[], type: string, action?: string): void {
        let t = this;

        t._queryCache[t._selectedTable] = {};

        if (changedRows.length && action) {
            t._parent.triggerEvent({
                name: "change",
                actionOrView: "",
                table: t._store._tables[changedTableID]._name,
                query: [],
                time: new Date().getTime(),
                result: [{msg: action + " was performed.", type: action}],
                changedRows: changedRows,
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
    public _deepFreeze(obj: any): any {
        if (!obj) return obj;
        let t = this;
        t._store._models[t._selectedTable].forEach((model) => {
            let prop = obj[model.key];
            if (["map", "array"].indexOf(typeof prop) >= 0) {
                obj[model.key] = t._deepFreeze(prop);
            }
        });
        return Object.freeze(obj);
    }

    public _transaction(type: "start"|"end") {
        if (type === "start") this._store._doingTransaction = true;
        if (type === "end") this._store._doingTransaction = false;
        return !!this._store._doingTransaction;
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
        const shiftRowIDs = (direction: number, callBack: (info: {[tableID: number]: {rows: DBRow[], type: string}}) => void): void  => {
            let results = {};
            let check = (t._store._historyLength - t._store._historyPoint);

            t._store._read("_historyPoints", (row: IHistoryPoint) => {
                return row.historyPoint === check;
            }, (hps: IHistoryPoint[]) => {
                j = 0;
                const nextPoint = () => {
                    if (j < hps.length) {
                        i = 0;
                        let tableID: number = hps[j].tableID;
                        let table = t._store._tables[tableID];
                        let rows: DBRow[] = [];

                        const nextRow = () => {
                            if (i < hps[j].rowKeys.length) {

                                rowID = hps[j].rowKeys[i];
                                if (table._pkType === "int") rowID = parseInt(rowID);

                                t._store._read(table._name, rowID, (rowData) => {

                                    if (direction > 0) rows.push(rowData[0]); // Get current row data befoe shifting to a different row

                                    // Shift the row pointer
                                    t._store._read("_" + table._name + "_hist__meta", rowID, (row) => {
                                        row = _assign(row);
                                        row[0]._pointer += direction;
                                        const historyRowID = row[0]._historyDataRowIDs[row[0]._pointer];
                                        t._store._upsert("_" + table._name + "_hist__meta", rowID, row[0], () => { // Update row pointer
                                            t._store._read("_" + table._name + "_hist__data", historyRowID, (row) => { // Now getting the new row data
                                                let newRow = row[0] ? _assign(row[0]) : null;
                                                t._store._upsert(table._name, rowID, newRow, () => { // Overwriting row data
                                                    if (direction < 0) rows.push(newRow);
                                                    if (!results[tableID]) results[tableID] = {type: hps[j].type, rows: []};
                                                    results[tableID].rows = results[tableID].rows.concat(rows);
                                                    i++;
                                                    nextRow();
                                                });
                                            });
                                        });
                                    });
                                });
                            } else {
                                j++;
                                nextPoint();
                            }
                        };
                        nextRow();
                    } else {
                        callBack(results);
                    }
                };
                nextPoint();
            });

        };

        return new Promise((res, rej) => {

            switch (command) {
                case "<":
                    if (!t._store._historyLength || t._store._historyPoint === t._store._historyLength) { // end of history
                        res(false);
                    } else {
                        shiftRowIDs(1, (affectedTables) => {
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
                                t._invalidateCache(parseInt(tableID), affectedTables[tableID].rows, description, "undo");
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
                                t._invalidateCache(parseInt(tableID), affectedTables[tableID].rows, affectedTables[tableID].type, "redo");
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
                case "flush_db":
                    Object.keys(t._store._tables).forEach((tableID) => {
                        let rows = t._store._tables[parseInt(tableID)]._rows;
                        t._invalidateCache(parseInt(tableID), Object.keys(rows).map(r => rows[r]) as DBRow[], "remove", "clear");
                    });
                    t._store._clearAll(res);
                break;
                case "flush_history":
                    t._store._clearHistory(res);
                break;
            }
        });
    }
}