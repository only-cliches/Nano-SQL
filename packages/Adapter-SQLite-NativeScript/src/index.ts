import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, SQLiteAbstractFns } from "@nano-sql/core/lib/interfaces";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
import { SQLiteAbstract } from "@nano-sql/core/lib/adapters/webSQL";
const NSSQLite = require("nativescript-sqlite");

export class NativeSQLite extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "NativeScript SQLite Adapter",
        version: 2.00
    };

    nSQL: InanoSQLInstance;

    public _id: string;
    public _db: any;
    public _ai: { [table: string]: number };
    public _sqlite: SQLiteAbstractFns;
    public _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    public _filename: string;

    constructor(fileName?: string) {
        super(false, true);
        this._ai = {};
        this._query = this._query.bind(this);
        this._filename = fileName || ":memory:";
        this._tableConfigs = {};
        this._sqlite = SQLiteAbstract(this._query, 500);
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        new NSSQLite(this._filename, (err, db) => {
            if (err) {
                error(err);
                return;
            }
            this._db = db;
            this._sqlite.createAI(() => {
                this._db.resultType(NSSQLite.RESULTSASOBJECT);
                complete();
            }, error);
        });
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._tableConfigs[tableName] = tableData;
        this._sqlite.createTable(tableName, tableData, this._ai, complete, error);
    }

    _query(allowWrite: boolean, sql: string, args: any[], onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void {

        if (allowWrite) {
            this._db.execSQL(sql, args, (err) => {
                if (err) {
                    error(err);
                    return;
                }
                complete();
            });
        } else {
            let count = 0;
            this._db.each(sql, args, (err, row) => {
                if (err) {
                    error(err);
                    return;
                }
                onRow(row, count);
                count++;
            }, (err) => {
                if (err) {
                    error(err);
                    return;
                }
                complete();
            });
        }
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._sqlite.dropTable(table, complete, error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        complete();
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {
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