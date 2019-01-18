import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION } from "@nano-sql/core/lib/interfaces";
import { generateID, setFast, deepSet, blankTableDefinition, binarySearch } from "@nano-sql/core/lib/utilities";
import { MongoClient, MongoClientCommonOption, Db, Cursor } from "mongodb";
// import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";

const nan = (input: any) => {
    return isNaN(input) || input === null ? 0 : parseFloat(input);
}

export class MongoDB implements InanoSQLAdapter {

    plugin: InanoSQLPlugin = {
        name: "MongoDB Adapter",
        version: 2.00
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _db: Db;
    private _client: MongoClient;
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    constructor(public connectURL: string, public databaseOptions?: MongoClientCommonOption) {
        this._tableConfigs = {};
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        
        MongoClient.connect(this.connectURL, (err, client) => {
            if (err) {
                error(err);
                return;
            }
            this._client = client;
            this._db = client.db(this._id, this.databaseOptions);
            this.createTable("_ai_", {
                ...blankTableDefinition,
                model: {
                    "table:string": {pk: true},
                    "ai:int": {}
                },
                pkType: "string",
                pkCol: ["table"],
                isPkNum: false
            }, complete, error);
        });
    }


    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {

        this._tableConfigs[tableName] = tableData;

        this._db.listCollections().toArray((err, result) => {
            if (err) {
                error(err);
                return;
            }
            const tables = result.map(t => t.name);
            if (tables.indexOf(tableName) === -1) {
                this._db.createCollection(tableName);
                setTimeout(() => {
                    complete();
                }, 10);
            } else {
                complete();
            }
        });
        

    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        delete this._tableConfigs[table];
        this._db.dropCollection(table).then(() => {
            return this._db.collection("_ai_").deleteOne({_id: table})
        }).catch(error).then(complete);
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        this._client.close(true).then(complete).catch(error);
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {

        new Promise((res, rej) => {
            if (this._tableConfigs[table].ai === true) {
                this._db.collection("_ai_").findOne({_id: table}).then((result) => {
                    let AI = nan(result ? result.ai : 0);
                    if (!pk || AI < pk) {
                        pk = Math.max(nan(pk), AI + 1);
                        this._db.collection("_ai_").updateOne({_id: table}, {$set: {ai: pk}}, {upsert: true}).then(() => {
                            res(pk);
                        }).catch(error);
                    } else {
                        res(pk);
                    }
                }).catch(error);
            } else {
                res(pk || generateID(this._tableConfigs[table].pkType, 0))
            }
        }).then((primaryKey: any) => {
            if (typeof primaryKey === "undefined") {
                error(new Error("Can't add a row without a primary key!"));
                return;
            }
            deepSet(this._tableConfigs[table].pkCol, row, primaryKey);
            this._db.collection(table).updateOne({_id: primaryKey}, {$set: { data: row}}, {upsert: true}).then(() => {
                complete(primaryKey);
            }).catch(error);
        })

    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        this._db.collection(table).findOne({_id: pk}).then((result) => {
            complete(result ? result.data : undefined);
        }).catch(error);
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {
        const query = this._db.collection(table);

        new Promise((res, rej) => {
            switch(type) {
                case "range":
                    res(query.find({_id: {$gte: offsetOrLow, $lte: limitOrHigh}}).sort({_id: reverse ? -1 : 1}).stream());
                break;
                case "offset":
                    res(query.find().skip(reverse ? offsetOrLow + 1 : offsetOrLow).limit(limitOrHigh).sort({_id: reverse ? -1 : 1}).stream());
                break;
                case "all":
                    res(query.find().sort({_id: reverse ? -1 : 1}).stream());
                break;
            }
        }).then((stream: Cursor<any>) => {
            stream.on("error", error);
            let i = 0;
            stream.on("data", (row) => {
                onRow(row.data, i);
                i++;
            });
            stream.on("end", () => {
                complete();
            });
        });
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this._db.collection(table).deleteOne({_id: pk}).then(complete).catch(error);
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        this._db.collection(table)
        .find()
        .project( {_id: 1} )
        .map(x => x._id)
        .toArray().then(complete).catch(error);
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        this._db.collection(table).countDocuments().then(complete).catch(error);
    }

    createIndex(tableId: string, index: string, type: string, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        this.createTable(indexName, {
            ...blankTableDefinition,
            pkType: type,
            pkCol: ["id"],
            isPkNum: ["float", "int", "number"].indexOf(type) !== -1
        }, complete, error);
    }

    deleteIndex(tableId: string, index: string, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        this.dropTable(indexName, complete, error);
    }

    addIndexValue(tableId: string, index: string, key: any, value: any, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;

        this.read(indexName, value, (row) => {
            let pks = row ? row.pks : [];
            if (pks.length === 0) {
                pks.push(key);
            } else {
                const idx = binarySearch(pks, key, false);
                pks.splice(idx, 0, key);
            }
            this.write(indexName, value, {
                id: key,
                pks: pks
            }, complete, error);
        }, error);


    }

    deleteIndexValue(tableId: string, index: string, key: any, value: any, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        this.read(indexName, value, (row) => {
            let pks = row ? row.pks : [];
            if (pks.length === 0) {
                complete();
                return;
            } else {
                const idx = pks.length < 100 ? pks.indexOf(key) : binarySearch(pks, key, true);
                if (idx === -1) {
                    complete();
                    return;
                } else {
                    pks.splice(idx, 1);
                }
            }
            
            this.write(indexName, value, {
                id: key,
                pks: pks
            }, complete, error);
        }, error);

    }

    readIndexKey(tableId: string, index: string, pk: any, onRowPK: (pk: any) => void, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        this.read(indexName, pk, (row) => {
            if (!row) {
                complete();
                return;
            }
            row.pks.forEach(onRowPK);
            complete();
        }, error);
    }

    readIndexKeys(tableId: string, index: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, id: any) => void, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        this.readMulti(indexName, type, offsetOrLow, limitOrHigh, reverse, (index) => {
            if (!index) return;
            index.pks.forEach((pk) => {
                onRowPK(pk, index.id);
            });
        }, complete, error);
    }
}