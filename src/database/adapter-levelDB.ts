import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "./storage";
import { DataModel } from "../index";
import { setFast } from "lie-ts";
import { StdObject, hash, fastALL, deepFreeze, uuid, timeid, _assign, generateID, sortedInsert } from "../utilities";
import { DatabaseIndex } from "./db-idx";

declare var global: any;

const deleteFolderRecursive = (path) => {
    if (global._fs.existsSync(path)) {
        global._fs.readdirSync(path).forEach((file) => {
            const curPath = path + "/" + file;
            if (global._fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                global._fs.unlinkSync(curPath);
            }
        });
        global._fs.rmdirSync(path);
    }
};

/**
 * Handles Level DB storage.
 *
 * @export
 * @class _LevelStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
export class _LevelStore implements NanoSQLStorageAdapter {

    private _pkKey: {
        [tableName: string]: string;
    };

    private _pkType: {
        [tableName: string]: string;
    };

    private _isPKnum: {
        [tableName: string]: boolean;
    };

    private _dbIndex: {
        [tableName: string]: DatabaseIndex;
    };

    private _id: string;

    private _path: string;

    private _levelDBs: {
        [key: string]: any;
    };

    constructor(
        public path?: string,
        public writeCache?: number,
        public readCache?: number
    ) {
        this._pkKey = {};
        this._pkType = {};
        this._dbIndex = {};
        this._levelDBs = {};
        this._isPKnum = {};
    }

    public connect(complete: () => void) {
        fastALL(Object.keys(this._dbIndex), (table, i, done) => {
            let pks: any[] = [];
            this._levelDBs[table].createKeyStream()
                .on("data", (data) => {
                    pks.push(this._isPKnum[table] ? new global._Int64BE(data).toNumber() : data);
                })
                .on("end", () => {
                    if (pks.length) {
                        this._dbIndex[table].set(pks);
                    }
                    done();
                });
        }).then(complete);
    }

    public disconnect(complete: () => void) {
        fastALL(Object.keys(this._dbIndex), (table, i , done) => {
            this._levelDBs[table].close(done);
        }).then(() => {
            complete();
        });
    }

    public setID(id: string) {
        this._id = id;
        this._path = (this.path || ".") + "/db_" + this._id;
        if (!global._fs.existsSync(this._path)) {
            global._fs.mkdirSync(this._path);
        }
    }

    public makeTable(tableName: string, dataModels: DataModel[]): void {

        this._dbIndex[tableName] = new DatabaseIndex();

        this._levelDBs[tableName] = global._levelup(global._leveldown(global._path.join(this._path, tableName)), {
            cacheSize: (this.readCache || 32) * 1024 * 1024,
            writeBufferSize: (this.writeCache || 32) * 1024 * 1024
        });

        dataModels.forEach((d) => {
            if (d.props && d.props.indexOf("pk") > -1) {
                this._pkType[tableName] = d.type;
                this._pkKey[tableName] = d.key;
                this._isPKnum[tableName] = ["int", "number", "float"].indexOf(d.type) !== -1;
            }

            if (d.props && d.props.indexOf("ai") > -1 && d.props.indexOf("pk") > -1 && d.type === "int") {
                this._dbIndex[tableName].doAI = true;
            }
        });
    }

    public write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void): void {

        pk = pk || generateID(this._pkType[table], this._dbIndex[table].ai) as DBKey;

        if (!pk) {
            throw Error("Can't add a row without a primary key!");
        }

        if (this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
        }

        let r = {
            ...data,
            [this._pkKey[table]]: pk,
        };

        this._levelDBs[table].put(this._isPKnum[table] ? new global._Int64BE(pk as any).toBuffer() : pk, JSON.stringify(r), (err) => {
            if (err) {
                throw Error(err);
            } else {
                complete(r);
            }
        });

    }

    public delete(table: string, pk: DBKey, complete: () => void): void {
        let idx = this._dbIndex[table].indexOf(pk);
        if (idx !== -1) {
            this._dbIndex[table].remove(pk);
        }
        this._levelDBs[table].del(this._isPKnum[table] ? new global._Int64BE(pk as any).toBuffer() : pk, (err) => {
            if (err) {
                throw Error(err);
            } else {
                complete();
            }
        });
    }

    public read(table: string, pk: DBKey, callback: (row: any) => void): void {
        if (this._dbIndex[table].indexOf(pk) === -1) {
            callback(null);
            return;
        }
        this._levelDBs[table].get(this._isPKnum[table] ? new global._Int64BE(pk as any).toBuffer() : pk, (err, row) => {
            if (err) {
                throw Error(err);
            } else {
                callback(JSON.parse(row));
            }
        });
    }

    public rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void {

        const keys = this._dbIndex[table].keys();
        const usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        const ranges: number[] = usefulValues ? [from as any, to as any] : [0, keys.length - 1];

        let rows: any[] = [];

        const lower = usePK && usefulValues ? from : keys[ranges[0]];
        const higher = usePK && usefulValues ? to : keys[ranges[1]];

        this._levelDBs[table]
            .createValueStream({
                gte: this._isPKnum[table] ? new global._Int64BE(lower as any).toBuffer() : lower,
                lte: this._isPKnum[table] ? new global._Int64BE(higher as any).toBuffer() : higher
            })
            .on("data", (data) => {
                rows.push(JSON.parse(data));
            })
            .on("end", () => {
                let idx = ranges[0] || 0;
                let i = 0;
                const getRow = () => {
                    if (i < rows.length) {
                        rowCallback(rows[i], idx, () => {
                            idx++;
                            i++;
                            i > 1000 ? setFast(getRow) : getRow(); // handle maximum call stack error
                        });
                    } else {
                        complete();
                    }
                };
                getRow();
            });
    }

    public drop(table: string, callback: () => void): void {

        fastALL(this._dbIndex[table].keys(), (pk, i, done) => {
            this._levelDBs[table].del(pk, done);
        }).then(() => {
            let idx = new DatabaseIndex();
            idx.doAI = this._dbIndex[table].doAI;
            this._dbIndex[table] = idx;
            callback();
        });


    }

    public getIndex(table: string, getLength: boolean, complete: (index) => void): void {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    }

    public destroy(complete: () => void) {
        fastALL(Object.keys(this._dbIndex), (table, i , done) => {
            this.drop(table, () => {
                this._levelDBs[table].close(done);
            });
        }).then(() => {
            deleteFolderRecursive(this._path);
            complete();
        });
    }
}