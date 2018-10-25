import { INanoSQLAdapter, INanoSQLDataModel, INanoSQLTable, INanoSQLPlugin, INanoSQLInstance } from "../interfaces";
import { noop, deepFreeze, generateID, binarySearch } from "../utilities";

export class SyncStorage implements INanoSQLAdapter {

    plugin: INanoSQLPlugin = {
        name: "Sync Storage Adapter",
        version: 2.0,
        dependencies: {
            core: [2.0]
        }
    };

    nSQL: INanoSQLInstance;

    _index: {
        [tableName: string]: any[];
    };

    _rows: {
        [tableName: string]: {
            [key: string]: any;
        }
    };

    _id: string;

    _ai: {
        [tableName: string]: number;
    };

    constructor(public useLS?: boolean) {
        this._index = {};
        this._rows = {};
        this._ai = {};
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = this.nSQL.config.id as string;
        complete();
    }

    createAndInitTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._index[tableName] = [];
        this._rows[tableName] = {};
        if (this.useLS) {
            const index = localStorage.getItem(this._id + "*" + tableName + "_idx");
            if (index) {
                this._index[tableName] = JSON.parse(index);
                this._ai[tableName] = parseFloat(localStorage.getItem(this._id + "*" + tableName + "_ai") || "0");
            }
        }
        complete();
    }

    disconnectTable(table: string, complete: () => void, error: (err: any) => void) {
        delete this._index[table];
        delete this._rows[table];
        complete();
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._index[table].forEach((pk) => {
            if (this.useLS) {
                localStorage.removeItem(this._id + "*" + table + "__" + pk);
            } else {
                delete this._rows[table][pk as any];
            }
        });
        if (this.useLS) {
            localStorage.removeItem(this._id + "*" + table + "_idx");
        }
        delete this._index[table];
        delete this._rows[table];
        complete();
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        complete();
    }

    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void) {
        pk = pk || generateID(this.nSQL.tables[table].pkType, this.nSQL.tables[table].ai ? this._ai[table] + 1 : 0);

        if (this.nSQL.tables[table].ai) {
            this._ai[table] = Math.max(this._ai[table], pk);
        }

        if (this._index[table].indexOf(pk) === -1) {
            const loc = binarySearch(this._index[table], pk);
            this._index[table].splice(loc, 0, pk);
            if (this.useLS) {
                localStorage.setItem(this._id + "*" + table + "_idx", JSON.stringify(this._index[table].keys()));
                localStorage.setItem(this._id + "*" + table + "_ai", String(Math.max(this._ai[table], pk)));
            }
        }

        row = {
            [this.nSQL.tables[table].pkCol]: pk,
            ...row
        };


        if (this.useLS) {
            localStorage.setItem(this._id + "*" + table + "__" + pk, JSON.stringify(row));
            complete(row[this.nSQL.tables[table].pkCol]);
        } else {
            this._rows[table][pk as any] = deepFreeze(row);
            complete(row[this.nSQL.tables[table].pkCol]);
        }
    }

    read(table: string, pk: any, complete: (row: {[key: string]: any}) => void, error: (err: any) => void) {
        if (this.useLS) {
            complete(JSON.parse(localStorage.getItem(this._id + "*" + table + "__" + pk) || "{}"));
        } else {
            complete(this._rows[table][pk]);
        }
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        let idx = this._index[table].indexOf(pk);
        if (idx !== -1) {
            this._index[table].splice(idx, 1);
            if (this.useLS) {
                localStorage.setItem(this._id + "*" + table + "_idx", JSON.stringify(this._index[table].keys()));
            }
        }
        if (this.useLS) {
            localStorage.removeItem(this._id + "*" + table + "__" + pk);
        } else {
            delete this._rows[table][pk as any];
        }
        complete();
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHeigh: any, reverse: boolean, onRow: (row: {[key: string]: any}, i: number) => void, complete: () => void, error: (err: any) => void) {
        this.readMultiAbstract(false, table, type, offsetOrLow, limitOrHeigh, reverse, onRow, complete, error);
    }

    readMultiPK(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHeigh: any, reverse: boolean, onPK: (pk: any, i: number) => void, complete: () => void, error: (err: any) => void) {
        this.readMultiAbstract(true, table, type, offsetOrLow, limitOrHeigh, reverse, onPK, complete, error);
    }

    readMultiAbstract(pkOnly: boolean, table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHeigh: any, reverse: boolean, onValue: (pk: any, i: number) => void, complete: () => void, error: (err: any) => void) {
        const doCheck = offsetOrLow || limitOrHeigh;
        const range = {
            "range":  [offsetOrLow, limitOrHeigh],
            "offset": [offsetOrLow, offsetOrLow + limitOrHeigh],
            "all": false
        }[type];
        this._index[table].forEach((pk, i) => {
            const read = !range ? true : (type === "range" ? pk >= range[0] && pk < range[1] : i >= range[0] && i < range[1]);
            if (read) {
                if (pkOnly) {
                    onValue(pk, i);
                } else {
                    if (this.useLS) {
                        onValue(JSON.parse(localStorage.getItem(this._id + "*" + table + "__" + pk) || "{}"), i);
                    } else {
                        onValue(this._rows[table][pk], i);
                    }
                }
            }
        });
        complete();
    }

    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        complete(this._index[table].slice());
    }

    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void) {
        complete(this._index[table].length);
    }
}