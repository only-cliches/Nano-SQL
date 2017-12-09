import { NanoSQLPlugin, DBConnect, NanoSQLInstance, DatabaseEvent } from "./index";
export declare class _NanoSQLHistoryPlugin implements NanoSQLPlugin {
    historyModeArgs: ("row" | "table" | "database") | {
        [tableName: string]: ("row" | "table");
    };
    parent: NanoSQLInstance;
    private _tablePkKeys;
    private _tablePkTypes;
    private _tableKeys;
    historyModes: {
        [tableName: string]: ("row" | "table");
    };
    constructor(historyModeArgs: ("row" | "table" | "database") | {
        [tableName: string]: ("row" | "table");
    });
    willConnect(connectArgs: DBConnect, next: (connectArgs: DBConnect) => void): void;
    private _histTable(table);
    private _generateHistoryPointers(table, complete);
    didConnect(connectArgs: DBConnect, next: () => void): void;
    private _purgeRowHistory(table, rowPKs, complete, clearAll?);
    private _purgeTableHistory(table, complete, clearAll?);
    private _purgeParentHistory(table, rowPKs, complete);
    private _purgeAllHistory(table, rowPK, complete);
    didExec(event: DatabaseEvent, next: (event: DatabaseEvent) => void): void;
    private _unshiftParent(event, histRowIDs, complete);
    private _unshiftSingleRow(table, eventTypes, rowPK, row, skipIDX, complete);
    extend(next: (args: any[], result: any[]) => void, args: any[], result: any[]): void;
    private _getRevisionHistory(table, rowPK, complete);
    private _getTableHistory(table, complete);
    private _queryHistory(table, rowPK, complete);
    private _shiftTableHistory(direction, table, complete);
    private _shiftRowHistory(direction, table, PK, complete);
    private _shiftHistory(direction, table, rowPK, complete);
}
