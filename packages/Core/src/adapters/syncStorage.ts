import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION } from "../interfaces";
import { noop, deepFreeze, generateID, binarySearch, assign, cast, blankTableDefinition, deepSet } from "../utilities";
import { nanoSQLMemoryIndex } from "./memoryIndex";

export class SyncStorage extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "Sync Storage Adapter",
        version: VERSION
    };

    nSQL: InanoSQLInstance;

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

    _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    constructor(public useLS?: boolean) {
        super(true, false);
        this._index = {};
        this._rows = {};
        this._ai = {};
        this._tableConfigs = {};
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        complete();
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._index[tableName] = [];
        this._rows[tableName] = {};
        this._tableConfigs[tableName] = tableData;
        if (this.useLS) {
            const index = localStorage.getItem(this._id + "->" + tableName + "_idx");
            if (index) {
                this._index[tableName] = JSON.parse(index);
                this._ai[tableName] = parseFloat(localStorage.getItem(this._id + "->" + tableName + "_ai") || "0");
            }
        }
        complete();
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._index[table].forEach((pk) => {
            if (this.useLS) {
                localStorage.removeItem(this._id + "->" + table + "__" + pk);
            } else {
                delete this._rows[table][pk as any];
            }
        });
        if (this.useLS) {
            localStorage.removeItem(this._id + "->" + table + "_idx");
        }
        delete this._index[table];
        delete this._rows[table];
        complete();
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        complete();
    }

    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void) {

        pk = pk || generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);

        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }

        if (this._tableConfigs[table].ai) {
            this._ai[table] = Math.max(this._ai[table] || 0, pk);
        }

        if (this._index[table].indexOf(pk) === -1) {

            if (this._ai[table]) {
                this._index[table].push(pk);
            } else {
                const loc = binarySearch(this._index[table], pk, false);
                this._index[table].splice(loc, 0, pk);
            }

            if (this.useLS) {
                localStorage.setItem(this._id + "->" + table + "_idx", JSON.stringify(this._index[table]));
                localStorage.setItem(this._id + "->" + table + "_ai", String(this._ai[table]));
            }
        }

        deepSet(this._tableConfigs[table].pkCol, row, pk);

        if (this.useLS) {
            localStorage.setItem(this._id + "->" + table + "__" + pk, JSON.stringify(row));
            complete(pk);
        } else {
            this._rows[table][pk as any] = deepFreeze(row);
            complete(pk);
        }
    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        if (this.useLS) {
            const item = localStorage.getItem(this._id + "->" + table + "__" + pk);
            complete(item ? JSON.parse(item) : undefined);
        } else {
            complete(this._rows[table][pk]);
        }
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        let idx = this._index[table].indexOf(pk);
        if (idx !== -1) {
            this._index[table].splice(idx, 1);
            if (this.useLS) {
                localStorage.setItem(this._id + "->" + table + "_idx", JSON.stringify(this._index[table].keys()));
            }
        }
        if (this.useLS) {
            localStorage.removeItem(this._id + "->" + table + "__" + pk);
        } else {
            delete this._rows[table][pk as any];
        }
        complete();
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {

        let range: any[] = {
            "range":  [offsetOrLow, limitOrHigh],
            "offset": [offsetOrLow, offsetOrLow + limitOrHigh],
            "all": []
        }[type];


        const idxArr: any[] = ((): any[] => {
            switch(type) {
                case "all":
                    return this._index[table].slice();
                case "offset":
                    const l = this._index[table].length - 1;
                    return reverse ? this._index[table].slice(l - range[1], l - range[0]) : this._index[table].slice(range[0], range[1]);
                case "range":
                    let lowIdx = binarySearch(this._index[table], range[0], false);
                    let highIdx = binarySearch(this._index[table], range[1], false);

                    while(this._index[table][highIdx] > range[1]) {
                        highIdx--;
                    }

                    while(this._index[table][lowIdx] < range[0]) {
                        lowIdx++;
                    }

                    return this._index[table].slice(lowIdx, highIdx + 1);
                    
            }
            return [];
        })();


        if (reverse) {
            idxArr.reverse();
        }

        idxArr.forEach((pk, i) => {
            if (this.useLS) {
                onRow(JSON.parse(localStorage.getItem(this._id + "->" + table + "__" + pk) || "{}"), i);
            } else {
                onRow(this._rows[table][pk], i);
            }
        });
        
        complete();
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        complete(this._index[table].slice());
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        complete(this._index[table].length);
    }
}