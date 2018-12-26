import { INanoSQLAdapter, INanoSQLDataModel, INanoSQLTable, INanoSQLPlugin, INanoSQLInstance, VERSION } from "../interfaces";
import { allAsync, _NanoSQLQueue, generateID, _maybeAssign, setFast, deepSet, deepGet, nan, blankTableDefinition } from "../utilities";
import { NanoSQLMemoryIndex } from "./memoryIndex";

declare const global: any;

export const rimraf = (dir_path: string) => {
    if (global._fs.existsSync(dir_path)) {
        global._fs.readdirSync(dir_path).forEach(function(entry) {
            const entry_path = global._path.join(dir_path, entry);
            if (global._fs.lstatSync(entry_path).isDirectory()) {
                rimraf(entry_path);
            } else {
                global._fs.unlinkSync(entry_path);
            }
        });
        global._fs.rmdirSync(dir_path);
    }
};

export class RocksDB extends NanoSQLMemoryIndex {

    plugin: INanoSQLPlugin = {
        name: "RocksDB Adapter",
        version: VERSION
    };

    nSQL: INanoSQLInstance;

    private _id: string;
    private _lvlDown: (dbID: string, tableName: string, tableData: INanoSQLTable) => { lvld: any, args?: any };
    private _levelDBs: {
        [key: string]: any;
    };
    private _ai: {
        [key: string]: number;
    };

    private _tableConfigs: {
        [tableName: string]: INanoSQLTable;
    }

    constructor(
        public path?: string | ((dbID: string, tableName: string, tableData: INanoSQLTable) => { lvld: any, args?: any })
    ) {
        super();
        this._levelDBs = {};
        this._ai = {};
        this._tableConfigs = {};

        if (typeof this.path === "string" || typeof this.path === "undefined") {
            this._lvlDown = ((dbId: string, tableName: string, tableData: INanoSQLTable) => {

                const basePath = global._path.join(this.path || ".", "db_" + dbId);
                if (!global._fs.existsSync(basePath)) {
                    global._fs.mkdirSync(basePath);
                }
                const keyEncoding = {
                    "int": global._lexint
                }[tableData.pkType] || "binary";
                return {
                    lvld: global._encode(global._rocks(global._path.join(basePath, tableName)), { valueEncoding: "json", keyEncoding: keyEncoding }),
                    args: {
                        cacheSize: 64 * 1024 * 1024,
                        writeBufferSize: 64 * 1024 * 1024
                    }
                };
            });
        } else {
            this._lvlDown = this.path;
        }
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        const tableName = "_ai_store_";
        const lvlDownAI = this._lvlDown(this._id, tableName, {
            ...blankTableDefinition,
            pkType: "string"
        });
        global._levelup(lvlDownAI.lvld, lvlDownAI.args, (err, db) => {
            if (err) {
                error(err);
                return;
            }
            this._levelDBs[tableName] = db;
            complete();
        });
    }

    createTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void) {

        if (this._levelDBs[tableName]) {
            error(new Error(`Table ${tableName} already exists and is open!`));
            return;
        }
        this._tableConfigs[tableName] = tableData;

        const lvlDown = this._lvlDown(this._id, tableName, tableData);
        global._levelup(lvlDown.lvld, lvlDown.args, (err, db) => {
            if (err) {
                error(err);
                return;
            }
            this._levelDBs[tableName] = db;
            this._levelDBs["_ai_store_"].get(Buffer.from(tableName, "utf-8"), (err, value) => {
                this._ai[tableName] = value ? value.ai || 0 : 0;
                complete();
            });
        });
    }

    disconnectTable(table: string, complete: () => void, error: (err: any) => void) {
        this._levelDBs[table].close((err) => {
            if (err) {
                error(err);
                return;
            }
            delete this._levelDBs[table];
            complete();
        });
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._levelDBs["_ai_store_"].del(Buffer.from(table, "utf-8")).then(() => {
            this.disconnectTable(table, () => {
                try {
                    rimraf(global._path.join((this.path || "."), "db_" + this._id, table));
                } catch (e) {
                    error(e);
                    return;
                }
                complete();
            }, error);
        }).catch(error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        allAsync(Object.keys(this._levelDBs), (table, i, next, err) => {
            this.disconnectTable(table, next as any, err);
        }).then(complete).catch(error);
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {
        pk = pk || generateID(this._tableConfigs[table].pkType, this._ai[table] + 1);
        if (typeof pk === "undefined") {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }

        if (this._tableConfigs[table].ai) {
            this._ai[table] = Math.max(pk, this._ai[table]);
        }

        row[this._tableConfigs[table].pkCol] = pk;

        this._levelDBs[table].put(this._encodePk(table, pk), row, (err) => {
            if (err) {
                error(err);
            } else {
                if (this._tableConfigs[table].ai) {
                    this._levelDBs["_ai_store_"].put(Buffer.from(table, "utf-8"), {ai: this._ai[table]}).then(() => {
                        complete(pk);
                    }).catch(error);
                } else {
                    complete(pk);
                }
            }
        });
    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        this._levelDBs[table].get(this._encodePk(table, pk), (err, row) => {
            if (err) {
                complete(undefined);
            } else {
                complete(row);
            }
        });
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {

        let i = 0;

        this._levelDBs[table]
            .createValueStream(type === "range" ? {
                gte: type === "range" ? this._encodePk(table, offsetOrLow) : undefined,
                lte: type === "range" ? this._encodePk(table, limitOrHigh) : undefined,
                reverse: reverse
            } : type === "offset" ? {
                reverse: reverse,
                limit: type === "offset" ? (offsetOrLow + limitOrHigh + (reverse ? 1 : 0)) : undefined
            } : {
                reverse: reverse,
            })
            .on("data", (data) => {
                if (type === "offset" && (reverse ? i < offsetOrLow + 1 : i < offsetOrLow)) {
                    i++;
                    return;
                }
                onRow(data, i);
                i++;
            })
            .on("end", () => {
                complete();
            })
            .on("error", error);
    }

    _writeNumberBuffer(table: string, num: number): any {

        switch (this._tableConfigs[table].pkType) {
            case "int":
                return num;
            // case "float":
            // case "number":
            default:
                return Buffer.from(String(num), "utf-8");
        }
    }

    _readNumberBuffer(table: string, buff: any): number {

        switch (this._tableConfigs[table].pkType) {
            case "int":
                return buff;
            // case "float":
            // case "number":
            default:
                const buffer = new Buffer(buff);
                return parseFloat(buffer.toString("utf-8"));
        }
    }

    _encodePk(table: string, pk: any): any {
        return this._tableConfigs[table].isPkNum ? this._writeNumberBuffer(table, pk) : Buffer.from(pk, "utf-8");
    }

    _decodePK(table: string, pk: any): any {
        return this._tableConfigs[table].isPkNum ? this._readNumberBuffer(table, pk) : new Buffer(pk).toString("utf-8");
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this._levelDBs[table].del(this._encodePk(table, pk), (err) => {
            if (err) {
                throw Error(err);
            } else {
                complete();
            }
        });
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        let index: any[] = [];
        this._levelDBs[table]
            .createKeyStream()
            .on("data", (pk) => {
                index.push(this._decodePK(table, pk));
            })
            .on("end", () => {
                complete(index);
            })
            .on("error", error);
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {

        let count = 0;
        this._levelDBs[table]
            .createKeyStream()
            .on("data", (pk) => {
                count++;
            })
            .on("end", () => {
                complete(count);
            })
            .on("error", error);
    }
}