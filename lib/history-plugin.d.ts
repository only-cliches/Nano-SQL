import { NanoSQLPlugin, DBConnect, NanoSQLInstance, DatabaseEvent } from "./index";
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
export declare class _NanoSQLHistoryPlugin implements NanoSQLPlugin {
    historyModeArgs: ("row" | "table" | "database") | {
        [tableName: string]: ("row" | "table");
    };
    parent: NanoSQLInstance;
    private _tablePkKeys;
    private _tablePkTypes;
    private _tableKeys;
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
    historyModes: {
        [tableName: string]: ("row" | "table");
    };
    constructor(historyModeArgs: ("row" | "table" | "database") | {
        [tableName: string]: ("row" | "table");
    });
    willConnect(connectArgs: DBConnect, next: (connectArgs: DBConnect) => void): void;
    private _histTable;
    private _generateHistoryPointers;
    didConnect(connectArgs: DBConnect, next: () => void): void;
    /**
     * If any of the given row pointers are above zero, remove the rows in "forward" history.
     *
     * @private
     * @param {string} table
     * @param {any[]} rowPKs
     * @param {() => void} complete
     * @memberof _NanoSQLHistoryPlugin
     */
    private _purgeRowHistory;
    private _purgeTableHistory;
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
    private _purgeParentHistory;
    private _purgeAllHistory;
    didExec(event: DatabaseEvent, next: (event: DatabaseEvent) => void): void;
    private _unshiftParent;
    private _unshiftSingleRow;
    extend(next: (args: any[], result: any[]) => void, args: any[], result: any[]): void;
    private _getRevisionHistory;
    private _getTableHistory;
    private _queryHistory;
    private _shiftTableHistory;
    private _shiftRowHistory;
    private _shiftHistory;
}
