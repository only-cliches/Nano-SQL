import { INanoSQLAdapter, INanoSQLDataModel, INanoSQLTable, INanoSQLPlugin, INanoSQLInstance } from "../interfaces";
import { allAsync, NanoSQLBuffer, generateID, _maybeAssign } from "../utilities";

declare const global: any;

export class RocksDB implements INanoSQLAdapter {

    plugin: INanoSQLPlugin = {
        name: "RocksDB Adapter",
        version: 2.0,
        dependencies: {
            core: [2.0]
        }
    };

    nSQL: INanoSQLInstance;

    private _id: string;
    private _lvlDown: (dbID: string, tableName: string) => { lvld: any, args?: any };
    private _levelDBs: {
        [key: string]: any;
    };
    private _ai: {
        [key: string]: number;
    }

    constructor(
        public path?: string | ((dbID: string, tableName: string) => { lvld: any, args?: any })
    ) {
        this._levelDBs = {};
        this._ai = {};

        if (typeof this.path === "string" || typeof this.path === "undefined") {
            this._lvlDown = ((dbId: string, tableName: string) => {

                const basePath = (this.path || ".") + "/db_" + dbId;
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
        const lvlDown = this._lvlDown(this._id, tableName);
        global._levelup(lvlDown.lvld, lvlDown.args, (err, db) => {
            if (err) {
                error(err);
                return;
            }
            this._levelDBs[tableName] = db;
            complete();
        })
    }

    createAndInitTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void) {

        if (this._levelDBs[tableName]) {
            error(new Error(`Table ${tableName} already exists and is open!`));
            return;
        }

        const lvlDown = this._lvlDown(this._id, tableName);
        global._levelup(lvlDown.lvld, lvlDown.args, (err, db) => {
            if (err) {
                error(err);
                return;
            }
            this._levelDBs[tableName] = db;
            this._levelDBs["_ai_store_"].get(tableName, (err, value) => {
                this._ai[tableName] = value || 1;
                complete();
            });
        })
    }

    disconnectTable(table: string, complete: () => void, error: (err: any) => void) {
        this._levelDBs[table].close((err) => {
            if (err) {
                error(err);
            } else {
                delete this._levelDBs[table];
                complete();
            }
        });
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        const del = new NanoSQLBuffer((item, i , next, err) => {
            // remove all records
            this._levelDBs[table].del(item).then(next).catch(err);
        }, error, () => {
            // delete auto increment 
            this._levelDBs["_ai_store_"].del(table).then(() => {
                //disconnect
                this.disconnectTable(table, complete, error);
            }).catch(error);
        });
        this._levelDBs[table].createReadStream({ values: false })
            .on('data', function (data) {
                del.newItem(data.key);
            })
            .on('error', function (err) {
                error(err);
                del.finished();
            })
            .on('close', function () {
                del.finished();
            })
            .on('end', function () {
                del.finished();
            });
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        allAsync(Object.keys(this._levelDBs), (table, i, next, err) => {
            this.disconnectTable(table, next as any, err);
        }).then(complete).catch(error);
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {
        pk = pk || generateID(this.nSQL.tables[table].pkType, this._ai[table]);
        if (!pk) {
            error(new Error("Can't add a row without a primary key!"));
            return;
        }

        row[this.nSQL.tables[table].pkCol] = pk;

        this._levelDBs[table].put(this.nSQL.tables[table].isPkNum ? new global._Int64BE(pk as any).toBuffer() : pk, JSON.stringify(row), (err) => {
            if (err) {
                error(err);
            } else {
                if (this.nSQL.tables[table].ai && pk === this._ai[table]) {
                    this._ai[table]++;
                    this._levelDBs["_ai_store_"].put(table, this._ai[table]).then(() => {
                        complete(pk);
                    }).catch(error);
                } else {
                    complete(pk);
                }
            }
        });
    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        this._levelDBs[table].get(this.nSQL.tables[table].isPkNum ? new global._Int64BE(pk as any).toBuffer() : pk, (err, row) => {
            if (err) {
                complete(undefined);
            } else {
                complete(JSON.parse(row));
            }
        });
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHeigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {
        const isPkNum = this.nSQL.tables[table].isPkNum;

        let i = 0;
        this._levelDBs[table]
            .createValueStream({
                gte: type === "range" ? (isPkNum ? new global._Int64BE(offsetOrLow as any).toBuffer() : offsetOrLow) : undefined,
                lte: type === "range" ? (isPkNum ? new global._Int64BE(limitOrHeigh as any).toBuffer() : limitOrHeigh) : undefined,
                reverse: reverse,
                limit: type === "offset" ? offsetOrLow + limitOrHeigh : undefined
            })
            .on("data", (data) => {
                if (type === "offset" && i < offsetOrLow) {
                    return;
                }
                onRow(JSON.parse(data), i - offsetOrLow);
                i++;
            })
            .on("end", () => {
                complete();
            })
            .on("error", error);
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this._levelDBs[table].del(this.nSQL.tables[table].isPkNum ? new global._Int64BE(pk as any).toBuffer() : pk, (err) => {
            if (err) {
                throw Error(err);
            } else {
                complete();
            }
        });
    }

    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        let index: any[] = [];
        this._levelDBs[table]
            .createKeyStream()
            .on("data", (pk) => {
                index.push(this.nSQL.tables[table].isPkNum ? new global._Int64BE(pk as any).toBuffer() : pk)
            })
            .on("end", () => {
                complete(index);
            })
            .on("error", error);
    }

    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void) {
        
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