import { NanoSQLInstance, ORMArgs, JoinArgs, DatabaseEvent, DataModel } from "../index";
import { CHAIN, _assign, StdObject, uuid, cast, ALL } from "../utilities";
import { Promise, setFast } from "lie-ts";
import { DBRow } from "../database/storage";

// tslint:disable-next-line
export class _NanoSQLORMQuery {

    private _db: NanoSQLInstance;
    private _tableName: string;
    private _action: "add" | "delete" | "drop" | "rebuild" | "set";
    private _column: string;
    private _relationIDs: any[];
    private _whereArgs: any[];
    public _transactionID: number;

    constructor(db: NanoSQLInstance, table: string, action: "add" | "delete" | "drop" | "rebuild" | "set", column?: string, relationIDs?: any[]) {
        this._db = db;
        this._tableName = table;
        this._action = action;
        this._column = column || "";
        this._relationIDs = relationIDs || [];
    }

    public where(args: any[]): this {
        this._whereArgs = args;
        return this;
    }

    public rebuild(callBack: (updatedRows: number) => void): void {
        let jobQue: DataModel[] = [];

        this._db._models[this._tableName].forEach((m) => {
            if (this._db._tableNames.indexOf(m.key.replace("[]", "")) !== -1) {
                jobQue.push(m);
            }
        });

        new CHAIN(jobQue.map((j) => {
            return (nextJ) => {
                this._rebuildSingleRelation(this._tableName, j.key, nextJ);
            };
        })).then(() => {
            callBack(0);
        });
    }

    private _rebuildSingleRelation(table: string, column: string, complete: () => void) {
        const pk = this._tablePK(table);
        const relatedColumn = this._getRelatedColumn(table, column);
        const relatedTable = this._getRelatedTable(table, column);

        if (!relatedColumn || !relatedTable) {
            complete(); // no ref=> set, can't automatically rebuid
            return;
        }

        const childRelateTable = this._getRelatedTable(relatedTable.table, relatedColumn);
        let ptr = 0;
        const loopRows = () => {
            this._db.table(table).query("select").range(1, ptr).exec().then((rows) => {
                if (rows.length && childRelateTable) {
                    const pk = rows[this._tablePK(table)];
                    this._db.table(childRelateTable.table).query("select").where(
                        [relatedColumn, childRelateTable.isArray ? "HAVE" : "=", pk] as any
                    ).exec().then((childRows) => {
                        this._db.table(table).query("upsert", {
                            ...rows[0],
                            [column]: childRows.length ? relatedTable.isArray ? childRows.map(r => r[this._tablePK(childRelateTable.table)]) : childRows[0][this._tablePK(childRelateTable.table)] : null
                        }, true).exec().then(() => {
                            ptr++;
                            loopRows();
                        });
                    });
                } else {
                    complete();
                }
            });
        };

        loopRows();
    }

    private _tablePK(table: string) {
        return this._db._models[table].reduce((prev, cur) => {
            return cur.props && cur.props.indexOf("pk") !== -1 ? cur.key : prev;
        }, "");
    }

    private _getRelatedColumn(table: string, column: string): string | null {
        return this._db._models[table].reduce((prev, cur) => {
            if (cur.key === column) {
                return cur.props && cur.props.reduce((p, c) => {
                    return c.indexOf("ref=>") !== -1 ? c.replace("ref=>", "") : p;
                }, null);
            }
            return prev;
        }, null);
    }

    private _getRelatedTable(table: string, column: string): { table: string, isArray: boolean } | null {
        return this._db._models[table].reduce((prev, cur) => {
            if (cur.key === column) {
                return {
                    table: cur.type.replace("[]", ""),
                    isArray: cur.type.indexOf("[]") !== -1
                } as any;
            }
            return prev;
        }, null);
    }

    private _setRelationships(type: "rm" | "set" | "add", rows: DBRow[], column: string, setIds: string[], complete: () => void) {

        const pk = this._tablePK(this._tableName);

        const changedParentRecords: any[] = rows.map(r => r[pk]);

        const relatedColumn = this._getRelatedColumn(this._tableName, column);
        const relatedTable = this._getRelatedTable(this._tableName, column);

        const cleanUp = () => {
            this._updateRelatedRecords(type, changedParentRecords, relatedColumn, relatedTable, complete);
        };

        if (setIds.length) {
            new ALL(rows.map((row) => {
                return (doneRow) => {

                    const setColumn = () => {
                        switch (type) {
                            case "rm":
                                return relatedTable && relatedTable.isArray ?
                                    (row[column] || []).filter(id => setIds.indexOf(id) === -1) : // filter out remove ids from array relation
                                    setIds.indexOf(row[column]) !== -1 ? null : row[column]; // set to NULL if it's a non array relation and a removeID exists
                            case "set":
                                return relatedTable && relatedTable.isArray ? setIds : setIds[0];
                            case "add":
                                return relatedTable && relatedTable.isArray ? (row[column] || []).concat(setIds) : setIds[0];
                        }
                    };

                    this._db.table(this._tableName).query("upsert", {
                        ...row,
                        [column]: setColumn()
                    }, true).exec().then(doneRow);
                };
            })).then(cleanUp);
        } else {
            this._db.table(this._tableName).query("upsert", {
                [column]: relatedTable && relatedTable.isArray ? [] : null
            }, true).where([pk, "IN", rows.map(r => changedParentRecords)]).exec().then(cleanUp);
        }
    }

    private _updateRelatedRecords(type: "rm" | "set" | "add", changedParentRecords: any[], relatedColumn: string | null, relatedTable: { table: string, isArray: boolean } | null, complete: () => void) {

        let childRelateTable: { table: string, isArray: boolean } | null = null;
        let childRleatePK: string;
        if (relatedColumn && relatedTable) {
            childRelateTable = this._getRelatedTable(relatedTable.table, relatedColumn);
        }

        // if there's no ref=> then skip the related update
        if (!relatedColumn || !relatedTable || !childRelateTable) {
            complete();
            return;
        }

        const compare = childRelateTable.isArray ? "HAVE" : "IN";

        this._db.table(childRelateTable.table).query("select").where([relatedColumn, compare, changedParentRecords]).exec().then((rows) => {
            new ALL(rows.map((r) => {
                return (done) => {
                    if (!childRelateTable) return;

                    const newColumn = () => {
                        if (!childRelateTable) return null;
                        switch (type) {
                            case "rm":
                                return childRelateTable.isArray ? r[relatedColumn].filter(i => changedParentRecords.indexOf(i) === -1) : null;
                            case "set":
                            case "add":
                                return childRelateTable.isArray ? r[relatedColumn].concat(changedParentRecords).filter((val, idx, self) => {
                                    return self.indexOf(val) === idx;
                                }) : changedParentRecords[0];
                        }
                    };

                    this._db.table(childRelateTable.table).query("upsert", {
                        ...r,
                        [relatedColumn]: newColumn()
                    }).exec().then(done);
                };
            })).then(complete);
        });

    }

    public exec(): Promise<number> {

        let t = this;
        return new Promise((res, rej) => {

            if (t._action === "rebuild") {
                return t.rebuild(res);
            }
            const q = t._db.table(t._tableName).query("select");
            if (t._whereArgs) {
                q.where(t._whereArgs);
            }
            q.exec().then((rows: DBRow[]) => {
                if (!rows.length) {
                    res([]);
                    return;
                }
                switch (this._action) {
                    case "set":
                        this._setRelationships("rm", rows, this._column, [], () => { // clear all existing relations
                            this._setRelationships("set", rows, this._column, this._relationIDs, () => { // set relations
                                res();
                            });
                        });
                        break;
                    case "add":
                        this._setRelationships("add", rows, this._column, this._relationIDs, () => { // set relations
                            res();
                        });
                        break;
                    case "delete":
                        this._setRelationships("rm", rows, this._column, this._relationIDs, () => {
                            res();
                        });
                        break;
                    case "drop":
                        this._setRelationships("rm", rows, this._column, [], () => {
                            res();
                        });
                        break;
                }
            });
        });
    }
}