import { NanoSQLInstance } from "../index";
import { Promise } from "lie-ts";
export declare class _NanoSQLORMQuery {
    private _db;
    private _tableName;
    private _action;
    private _column;
    private _relationIDs;
    private _whereArgs;
    _transactionID: number;
    constructor(db: NanoSQLInstance, table: string, action: "add" | "delete" | "drop" | "rebuild" | "set", column?: string, relationIDs?: any[]);
    where(args: any[]): this;
    rebuild(callBack: (updatedRows: number) => void): void;
    private _rebuildSingleRelation(table, column, complete);
    private _tablePK(table);
    private _getRelatedColumn(table, column);
    private _getRelatedTable(table, column);
    private _setRelationships(type, rows, column, setIds, complete);
    private _updateRelatedRecords(type, changedParentRecords, relatedColumn, relatedTable, complete);
    exec(): Promise<number>;
}
