import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, SQLiteAbstractFns } from "@nano-sql/core/lib/interfaces";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
import { SQLiteAbstract } from "@nano-sql/core/lib/adapters/webSQL"; 

declare const cordova: any;

export interface CordovaSQLiteDB {
    sqlBatch: (queries: (string|any[])[], onSuccess: () => void, onFail: (err: Error) => void) => void;
    executeSql: (sql: string, vars: any[], onSuccess: (result: SQLResultSet) => void, onFail: (err: Error) => void) => void;
}

export const getMode = () => {
    if (typeof cordova !== "undefined" && window["sqlitePlugin"]) {
        if (window["device"] && window["device"].platform && window["device"].platform !== "browser") {
            return new SQLiteCordova();
        } else {
            return "PERM";
        }
    } else {
        return "PERM";
    }
};

export class SQLiteCordova  extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "SQLite Cordova Adapter",
        version: 2.09
    };

    nSQL: InanoSQLInstance;

    private _db: CordovaSQLiteDB;
    private _ai: {[table: string]: number};
    private _sqlite: SQLiteAbstractFns;
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    constructor() {
        super(false, false);
        if (!window["sqlitePlugin"]) {
            throw Error("SQLite plugin not installed or nanoSQL plugin called before device ready!");
        }
        this._ai = {};
        this._query = this._query.bind(this);
        this._tableConfigs = {};
        this._sqlite = SQLiteAbstract(this._query, 500);
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        console.log(`nanoSQL "${id}" using SQLite.`);
        try {
            this._db = window["sqlitePlugin"].openDatabase({name: id, location: "default"});
            complete();
        } catch(e) {
            error(e);
        }
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    }

    _query(allowWrite: boolean, sql: string, args: any[], onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void {

        this._db.executeSql(sql, args, (result) => {
            let rows: any[] = [];
            for (let i = 0; i < result.rows.length; i++) {
                onRow(result.rows.item(i), i);
            }
            complete();
        }, (err) => {
            error(err);
        });
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._sqlite.dropTable(table, complete, error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        complete();
    }

    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void) {
        this._sqlite.write(this._tableConfigs[table].pkType, this._tableConfigs[table].pkCol, table, pk, row, this._tableConfigs[table].ai, this._ai, complete, error);
    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        this._sqlite.read(table, pk, complete, error);
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this._sqlite.remove(table, pk, complete, error);
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {
        this._sqlite.readMulti(table, type, offsetOrLow, limitOrHigh, reverse, onRow, complete, error);
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        this._sqlite.getIndex(table, complete, error);
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        this._sqlite.getNumberOfRecords(table, complete, error);
    }
}