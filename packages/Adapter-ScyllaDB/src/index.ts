import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION } from "@nano-sql/core/lib/interfaces";
import { _nanoSQLQueue, generateID, maybeAssign, setFast, deepSet, allAsync, blankTableDefinition, chainAsync, slugify } from "@nano-sql/core/lib/utilities";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
import * as Cassandra from "cassandra-driver";
import * as redis from "redis";

const copy = (e) => e; 

export interface CassandraFilterArgs {
    createKeySpace?: (query: string) => string;
    createTable?: (query: string) => string;
    useKeySpace?: (query: string) => string;
    dropTable?: (query: string) => string;
    selectRow?: (query: string) => string;
    upsertRow?: (query: string) => string;
    deleteRow?: (query: string) => string;
    createIndex?: (query: string) => string;
    dropIndex?: (query: string) => string;
    addIndexValue?: (query: string) => string;
    deleteIndexValue?: (query: string) => string;
    readIndexValue?: (query: string) => string;
}

export interface CassandraFilterObj {
    createKeySpace: (query: string) => string;
    createTable: (query: string) => string;
    useKeySpace: (query: string) => string;
    dropTable: (query: string) => string;
    selectRow: (query: string) => string;
    upsertRow: (query: string) => string;
    deleteRow: (query: string) => string;
    createIndex: (query: string) => string;
    dropIndex: (query: string) => string;
    addIndexValue: (query: string) => string;
    deleteIndexValue: (query: string) => string;
    readIndexValue: (query: string) => string;
}

export class Scylla implements InanoSQLAdapter {

    plugin: InanoSQLPlugin = {
        name: "Scylla Adapter",
        version: 2.01
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _client: Cassandra.Client;
    private _redis: redis.RedisClient;
    private _filters: CassandraFilterObj;
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }
    constructor(public args: Cassandra.ClientOptions, public redisArgs?: redis.ClientOpts, filters?: CassandraFilterArgs) {  

        this._tableConfigs = {};
        this._filters = {
            createKeySpace: copy,
            createTable: copy,
            useKeySpace: copy,
            dropTable: copy,
            selectRow: copy,
            upsertRow: copy,
            deleteRow: copy,
            createIndex: copy,
            dropIndex: copy,
            addIndexValue: copy,
            deleteIndexValue: copy,
            readIndexValue: copy,
            ...(filters || {})
        }
    }

    scyllaTable(table: string): string {
        return slugify(table).replace(/\-/gmi, "_");
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        this._client = new Cassandra.Client(this.args);
        this._client.connect().then(() => {
            this._client.execute(this._filters.createKeySpace(`CREATE KEYSPACE IF NOT EXISTS "${this.scyllaTable(id)}" WITH REPLICATION = { 
                'class' : 'SimpleStrategy', 
                'replication_factor' : 1
               };`), [], (err, result) => {
                if (err) {
                    error(err);
                    return;
                }
                this._client.execute(this._filters.useKeySpace(`USE "${this.scyllaTable(id)}";`), [], (err, result) => {
                    if (err) {
                        error(err);
                        return;
                    }
                    this._redis = redis.createClient(this.redisArgs);
                    this._redis.on("ready", () => {
                        complete();
                    });
                    this._redis.on("error", error);
    
                });

            });
        }).catch(error);

    }

    key(tableName: string, key: any): string {
        return this._id + "." + tableName + "." + key;
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {

        this._tableConfigs[tableName] = tableData;

        this._client.execute(this._filters.createTable(`CREATE TABLE IF NOT EXISTS "${this.scyllaTable(tableName)}" (
            id ${tableData.isPkNum ? (tableData.pkType === "int" ? "bigint" : "double") : (tableData.pkType === "uuid" ? "uuid" : "text")} PRIMARY KEY,
            data text
        )`), [], (err, result) => {
            if (err) {
                error(err);
                return;
            }
            complete();
        })
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this._redis.del(this.key("_ai_", table), () => { // delete AI
            // done reading index, delete it
            this._redis.del(this.key("_index_", table), (delErr) => {
                if (delErr) {
                    error(delErr);
                    return;
                }
                this._client.execute(this._filters.dropTable(`DROP TABLE IF EXISTS "${this.scyllaTable(table)}"`), [], (err, result) => {
                    if (err) {
                        error(err);
                        return;
                    }
                    complete();
                })
            });
        })
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        this._redis.on("end", () => {
            this._client.shutdown(() => {
                complete();
            });
        })
        this._redis.quit();
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {


        new Promise((res, rej) => { // get current auto incremenet value
            if (this._tableConfigs[table].ai) {
                this._redis.get(this.key("_ai_", table), (err, result) => {
                    if (err) {
                        rej(err);
                        return;
                    }
                    res(parseInt(result) || 0);
                });
            } else {
                res(0);
            }
        }).then((AI: number) => {
            pk = pk || generateID(this._tableConfigs[table].pkType, AI + 1);
            return new Promise((res, rej) => {

                if (typeof pk === "undefined") {
                    rej(new Error("Can't add a row without a primary key!"));
                    return;
                }

                if (this._tableConfigs[table].ai && pk > AI) { // need to increment ai to database
                    this._redis.incr(this.key("_ai_", table), (err, result) => {
                        if (err) {
                            rej(err);
                            return;
                        }
                        res(result || 0);
                    });
                } else {
                    res(pk);
                }
            });
        }).then((primaryKey: any) => {

            deepSet(this._tableConfigs[table].pkCol, row, primaryKey);

            return allAsync(["_index_", "_table_"], (item, i, next, err) => {

                switch (item) {
                    case "_index_": // update index
                        this._redis.zadd(this.key("_index_", table), this._tableConfigs[table].isPkNum ? parseFloat(primaryKey) : 0, primaryKey, (error) => {
                            if (error) {
                                err(error);
                                return;
                            }
                            next(primaryKey);
                        });
                        break;
                    case "_table_": // update row value
                        const long = Cassandra.types.Long
                        const setPK = this._tableConfigs[table].pkType === "int" ? (long as any).fromNumber(pk) : pk;
                        this._client.execute(this._filters.upsertRow(`UPDATE "${this.scyllaTable(table)}" SET data = ? WHERE id = ?`), [JSON.stringify(row), setPK], (err2, result) => {
                            if (err2) {
                                err(err2);
                                return;
                            }
                            next(primaryKey);
                        });
                        break;
                }
            });
        }).then((result: any[]) => {
            complete(result[0])
        }).catch(error);
        

    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        const long = Cassandra.types.Long
        const setPK = this._tableConfigs[table].pkType === "int" ? (long as any).fromNumber(pk) : pk;
        this._client.execute(this._filters.selectRow(`SELECT data FROM "${this.scyllaTable(table)}" WHERE id = ?`), [setPK], (err, result) => {
            if (err) {
                error(err);
                return;
            }
            if (result.rowLength > 0) {
                const row = result.first() || {data: "[]"};
                complete(JSON.parse(row.data));
            } else {
                complete(undefined);
            }
        });
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {

        this.readRedisIndex(table, type, offsetOrLow, limitOrHigh, reverse, (primaryKeys) => {
            const batchSize = 500;
            let page = 0;
            const nextPage = () => {
                const getPKS = primaryKeys.slice(page * batchSize, (page * batchSize) + batchSize);
                if (getPKS.length === 0) {
                    complete();
                    return;
                }
                allAsync(getPKS, (rowPK, i, rowData, onError) => {
                    this.read(table, rowPK, rowData, onError);
                }).then((rows) => {
                    rows.forEach(onRow);
                    page++;
                    nextPage();
                }).catch(error);
            }
            nextPage();
        }, error);

    }


    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {

        allAsync(["_index_", "_table_"], (item, i, next, err) => {

            switch (item) {
                case "_index_": // update index
                    this._redis.zrem(this.key("_index_", table), pk, (error) => {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                    break;
                case "_table_": // remove row value
                    const long = Cassandra.types.Long
                    const setPK = this._tableConfigs[table].pkType === "int" ? (long as any).fromNumber(pk) : pk;
                    this._client.execute(this._filters.deleteRow(`DELETE FROM "${this.scyllaTable(table)}" WHERE id = ?`), [setPK], (err2, result) => {
                        if (err2) {
                            error(err2);
                            return;
                        }
                        next();
                    })
                    break;
            }
        }).then(complete).catch(error);
    }

    readRedisIndex(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, complete: (index: any[]) => void, error: (err: any) => void): void {

        switch (type) {
            case "offset":
                if (reverse) {
                    this._redis.zrevrange(this.key("_index_", table), offsetOrLow + 1, offsetOrLow + limitOrHigh, (err, results) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                } else {
                    this._redis.zrange(this.key("_index_", table), offsetOrLow, offsetOrLow + limitOrHigh - 1, (err, results) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                }
                break;
            case "all":
                this.getTableIndex(table, (index) => {
                    if (reverse) {
                        complete(index.reverse());
                    } else {
                        complete(index);
                    }
                }, error);
                break;
            case "range":
                if (this._tableConfigs[table].isPkNum) {
                    this._redis.zrangebyscore(this.key("_index_", table), offsetOrLow, limitOrHigh, (err, result) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(reverse ? result.reverse() : result);
                    });
                } else {
                    this._redis.zrangebylex(this.key("_index_", table), "[" + offsetOrLow, "[" + limitOrHigh, (err, result) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(reverse ? result.reverse() : result);
                    });
                }

                break;
        }
    }

    maybeMapIndex(table: string, index: any[]): any[] {
        if (this._tableConfigs[table].isPkNum) return index.map(i => parseFloat(i));
        return index;
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {

        this._redis.zrangebyscore(this.key("_index_", table), "-inf", "+inf", (err, result) => {
            if (err) {
                error(err);
                return;
            }

            complete(this.maybeMapIndex(table, result));
        });
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {

        this._redis.zcount(this.key("_index_", table), "-inf", "+inf", (err, result) => {
            if (err) {
                error(err);
                return;
            }
            complete(result);
        });
    }

    createIndex(tableId: string, index: string, type: string, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        const isPkNum = ["float", "int", "number"].indexOf(type) !== -1;
        this._tableConfigs[indexName] = {
            ...blankTableDefinition,
            pkType: type,
            pkCol: ["id"],
            isPkNum: isPkNum
        };

        const pksType = this._tableConfigs[tableId].isPkNum ? (this._tableConfigs[tableId].pkType === "int" ? "bigint" : "double") : (this._tableConfigs[tableId].pkType === "uuid" ? "uuid" : "text");

        this._client.execute(this._filters.createIndex(`CREATE TABLE IF NOT EXISTS "${this.scyllaTable(indexName)}" (
            id ${isPkNum ? (type === "int" ? "bigint" : "double") : (type === "uuid" ? "uuid" : "text")} PRIMARY KEY,
            pks set<${pksType}>
        )`), [], (err, result) => {
            if (err) {
                error(err);
                return;
            }
            complete();
        });
    }

    deleteIndex(tableId: string, index: string, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        this.dropTable(indexName, complete, error);
    }

    addIndexValue(tableId: string, index: string, rowID: any, indexKey: any, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
 

        return allAsync(["_index_", "_table_"], (item, i, next, err) => {

            switch (item) {
                case "_index_": // update index
                    this._redis.zadd(this.key("_index_", indexName), this._tableConfigs[indexName].isPkNum ? parseFloat(indexKey) : 0, indexKey, (error) => {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                    break;
                case "_table_": // update row value
                    const long = Cassandra.types.Long
                    const setIndexKey = this._tableConfigs[indexName].pkType === "int" ? (long as any).fromNumber(indexKey) : indexKey;
                    const setPK = this._tableConfigs[tableId].pkType === "int" ? (long as any).fromNumber(rowID) : rowID;
                    this._client.execute(this._filters.addIndexValue(`UPDATE "${this.scyllaTable(indexName)}" SET pks = pks + {${this._tableConfigs[tableId].isPkNum || this._tableConfigs[tableId].pkType === "uuid" ? setPK : "'" + setPK + "'" }} WHERE id = ?`), [setIndexKey], (err2, result) => {
                        if (err2) {
                            err(err2);
                            return;
                        }
                        next();
                    })
                    break;
            }
        }).then(complete).catch(error);

    }

    deleteIndexValue(tableId: string, index: string, rowID: any, indexKey: any, complete: () => void, error: (err: any) => void) {

        const indexName = `_idx_${tableId}_${index}`;

        const long = Cassandra.types.Long
        const setIndexKey = this._tableConfigs[indexName].pkType === "int" ? (long as any).fromNumber(indexKey) : indexKey;
        const setPK = this._tableConfigs[tableId].pkType === "int" ? (long as any).fromNumber(rowID) : rowID;
        this._client.execute(this._filters.deleteIndexValue(`UPDATE "${this.scyllaTable(indexName)}" SET pks = pks - {${this._tableConfigs[tableId].isPkNum || this._tableConfigs[tableId].pkType === "uuid" ? setPK : "'" + setPK + "'" }} WHERE id = ?`), [setIndexKey], (err2, result) => {
            if (err2) {
                error(err2);
                return;
            }
            complete();
        })

    }

    readIndexKey(tableId: string, index: string, indexKey: any, onRowPK: (pk: any) => void, complete: () => void, error: (err: any) => void) {

        const indexName = `_idx_${tableId}_${index}`;

        const long = Cassandra.types.Long
        const setIndexKey = this._tableConfigs[indexName].pkType === "int" ? (long as any).fromNumber(indexKey) : indexKey;
        this._client.execute(this._filters.readIndexValue(`SELECT pks FROM "${this.scyllaTable(indexName)}" WHERE id = ?`), [setIndexKey], (err2, result) => {
            if (err2) {
                error(err2);
                return;
            }
            if (!result.rowLength) {
                complete();
                return;
            }
            const row = result.first() || {pks: []};
            row.pks.forEach((value, i) => {
                onRowPK(this._tableConfigs[tableId].isPkNum ? value.toNumber() : value.toString());
            });
            complete();
        })

    }

    readIndexKeys(tableId: string, index: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, id: any) => void, complete: () => void, error: (err: any) => void) {

        const indexName = `_idx_${tableId}_${index}`;
        this.readRedisIndex(indexName, type, offsetOrLow, limitOrHigh, reverse, (primaryKeys) => {
            
            const pageSize = 500;
            let page = 0;
            let count = 0;
            const getPage = () => {
                const keys = primaryKeys.slice(pageSize * page, (pageSize * page) + pageSize);
                if (!keys.length) {
                    complete();
                    return;
                }
                allAsync(keys, (indexKey, i, pkNext, pkErr) => {
                    this.readIndexKey(tableId, index, indexKey, (row) => {
                        onRowPK(row, count);
                        count++;
                    }, pkNext, pkErr);
                }).then(() => {
                    page++;
                    getPage();
                })
            }
            getPage();


        }, error);
    }

}