import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION, postConnectFilter } from "../interfaces";
import { allAsync, _nanoSQLQueue, generateID, maybeAssign, setFast, deepSet, deepGet, nan, blankTableDefinition } from "../utilities";
import { nanoSQLMemoryIndex } from "./memoryIndex";

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

export class RocksDB extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "RocksDB Adapter",
        version: VERSION
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _lvlDown: (dbID: string, tableName: string, tableData: InanoSQLTable) => { lvld: any, args?: any };
    private _levelDBs: {
        [key: string]: any;
    };
    private _ai: {
        [key: string]: number;
    };

    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    private _indexNum: {
        [tableName: string]: number;
    } = {};

    constructor(
        public path?: string | ((dbID: string, tableName: string, tableData: InanoSQLTable) => { lvld: any, args?: any }),
        public indexCache?: boolean
    ) {
        super(false, false);
        this._levelDBs = {};
        this._ai = {};
        this._tableConfigs = {};

        if (typeof this.path === "string" || typeof this.path === "undefined") {
            this._lvlDown = ((dbId: string, tableName: string, tableData: InanoSQLTable) => {

                const basePath = global._path.join(this.path || ".", "db_" + dbId);
                if (!global._fs.existsSync(basePath)) {
                    global._fs.mkdirSync(basePath);
                }
                return {
                    lvld: global._rocks(global._path.join(basePath, tableName)),
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
        const keyEncoding = "binary";
        global._levelup(global._encode(lvlDownAI.lvld, { valueEncoding: "json", keyEncoding: keyEncoding }), lvlDownAI.args, (err, db) => {
            if (err) {
                error(err);
                return;
            }
            if (this.indexCache) {

                const checkWasm = () => {
                    if (global._wasm.loaded) {
                        this._levelDBs[tableName] = db;
                        complete();
                    } else {
                        setTimeout(checkWasm, 10);
                    }
                }
                checkWasm();
            } else {
                this._levelDBs[tableName] = db;
                complete();
            }

        });
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {

        if (this._levelDBs[tableName]) {
            error(new Error(`Table ${tableName} already exists and is open!`));
            return;
        }
        this._tableConfigs[tableName] = tableData;

        const keyEncoding = {
            "int": global._lexint
        }[tableData.pkType] || "binary";

        const lvlDown = this._lvlDown(this._id, tableName, tableData);
        global._levelup(global._encode(lvlDown.lvld, { valueEncoding: "json", keyEncoding: keyEncoding }), lvlDown.args, (err, db) => {
            if (err) {
                error(err);
                return;
            }
            this._levelDBs[tableName] = db;
            this._indexNum[tableName] = tableData.isPkNum ? global._wasm.new_index() : global._wasm.new_index_str();
 
            this._levelDBs["_ai_store_"].get(Buffer.from(tableName, "utf-8"), (err, value) => {
                this._ai[tableName] = value ? value.ai || 0 : 0;
                if (this.indexCache) {
                    this._levelDBs[tableName]
                    .createKeyStream()
                    .on("data", (data) => {
                        const wasm = global._wasm;
                        if (tableData.isPkNum) {
                            wasm.add_to_index(this._indexNum[tableName], data);
                        } else {
                            wasm.add_to_index_str(this._indexNum[tableName], data);
                        }
                    })
                    .on("end", () => {
                        complete();
                    })
                    .on("error", error);
                } else {
                    complete();
                }
                
            });
        });
    }


    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        if (this.indexCache) {
            const wasm = global._wasm;
            this._tableConfigs[table].isPkNum ? wasm.empty_index(this._indexNum[table]) : wasm.empty_index_str(this._indexNum[table]);
        }
        this._levelDBs["_ai_store_"].del(Buffer.from(table, "utf-8")).then(() => {
            this._levelDBs[table].close((err) => {
                try {
                    rimraf(global._path.join((this.path || "."), "db_" + this._id, table));
                } catch (e) {
                    error(e);
                    return;
                }
                delete this._levelDBs[table];
                complete();
            }, error);
        }).catch(error);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        allAsync(Object.keys(this._levelDBs), (table, i, next, error) => {
            if (this.indexCache) {
                const wasm = global._wasm;
                this._tableConfigs[table].isPkNum ? wasm.empty_index(this._indexNum[table]) : wasm.empty_index_str(this._indexNum[table]);
            }
            this._levelDBs[table].close((err) => {
                if (err) {
                    error(err);
                    return;
                } 
                next(null);
            });
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

        deepSet(this._tableConfigs[table].pkCol, row, pk);

        if (this.indexCache) {
            const wasm = global._wasm;
            if (this._tableConfigs[table].isPkNum) {
                wasm.add_to_index(this._indexNum[table], pk);
            } else {
                wasm.add_to_index_str(this._indexNum[table], pk);
            }    
        }

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

        if (this.indexCache && type === "offset") {
            const wasm = global._wasm;
            const ptrFn = this._tableConfigs[table].isPkNum ? wasm.read_index_offset : wasm.read_index_offset_str;
            const nextFn = this._tableConfigs[table].isPkNum ? wasm.read_index_offset_next : wasm.read_index_offset_str_next;
            const it = ptrFn(this._indexNum[table], reverse ? 1 : 0, offsetOrLow);
            let nextKey: any = 0;
            let lastKey: any;
            let count = 0;

            const nextRow = () => {
                nextKey = nextFn(this._indexNum[table], it, reverse ? 1 : 0, limitOrHigh, count);
                if (nextKey === lastKey) {
                    complete();
                } else {
                    this.read(table, nextKey, (row) => {
                        if (row) {
                            onRow(row, count);
                        }
                        nextRow();
                    }, error);
                    lastKey = nextKey;
                }
                count++;
            }
            nextRow();
            return;
        }

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
        if (this.indexCache) {
            const wasm = global._wasm;
            const ptrFn = this._tableConfigs[table].isPkNum ? wasm.read_index : wasm.read_index_str;
            const nextFn = this._tableConfigs[table].isPkNum ? wasm.read_index_next : wasm.read_index_str_next;
    
            const it = ptrFn(this._indexNum[table], 0);
            let nextKey: any = 0;
            let lastKey: any;
            let isDone = false;
            let count = 0;
            let keys: any[] = [];
            
            while(!isDone) {
                nextKey = nextFn(this._indexNum, it, 0, count);
                if (nextKey === lastKey) {
                    isDone = true;
                } else {
                    count++;
                    keys.push(nextKey);
                    lastKey = nextKey;
                }
            }
            complete(keys);
            return;
        }

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

        if (this.indexCache) {
            const wasm = global._wasm;
            complete(this._tableConfigs[table].isPkNum ? wasm.get_total(this._indexNum[table]) : wasm.get_total_str(this._indexNum[table]));
            return;
        }

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