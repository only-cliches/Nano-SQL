import { InanoSQLAdapter, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "@nano-sql/core/lib/interfaces";
import { generateID, deepSet, chainAsync, allAsync, blankTableDefinition } from "@nano-sql/core/lib/utilities";
import * as redis from "redis";

const noClient = `No Redis client!`;

export class Redis implements InanoSQLAdapter {

    plugin: InanoSQLPlugin = {
        name: "Redis Adapter",
        version: 2.02
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _db: redis.RedisClient|undefined;
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    constructor( public connectArgs?: redis.ClientOpts, public getClient?: (redisClient: redis.RedisClient) => void) {

        this.connectArgs = this.connectArgs || {};
        this._tableConfigs = {};
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {

        this._db = redis.createClient(this.connectArgs);

        this._db.on("ready", () => {
            if (!this._db) {
                error(noClient);
                return;
            }
            if (this.getClient) {
                this.getClient(this._db);
            }
            complete();
        });

        this._db.on("error", error);
    }

    key(tableName: string, key: any): string {
        return this._id + "." + tableName + "." + key;
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {
        this._tableConfigs[tableName] = tableData;
        complete();
    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {

        if (!this._db) {
            error(noClient);
            return;
        }
        this._db.del(this.key("_ai_", table), () => { // delete AI
            let ptr = "0";
            const getNextPage = () => {
                if (!this._db) {
                    error(noClient);
                    return;
                }
                this._db.zscan(this.key("_index_", table), ptr, (err, result) => {
                    if (err) {
                        error(err);
                        return;
                    }

                    if (!result[1].length && result[0] !== "0") {
                        ptr = result[0];
                        getNextPage();
                        return;
                    }

                    const PKS = (result[1] || []).filter((v, i) => i % 2 === 0);
                    
                    chainAsync(PKS, (pk, i, next, err) => {
                        if (!this._db) {
                            error(noClient);
                            return;
                        }
                        // clear table contents
                        this._db.del(this.key(table, pk), (delErr) => {
                            if (delErr) {
                                err(delErr);
                                return;
                            }
                            next();
                        })
                    }).then(() => {
                        if (result[0] === "0") { 
                            if (!this._db) {
                                error(noClient);
                                return;
                            }
                            // done reading index, delete it
                            this._db.del(this.key("_index_", table), (delErr) => {
                                if (delErr) {
                                    error(delErr);
                                    return;
                                }
                                complete();
                            });
                            
                        } else {
                            ptr = result[0];
                            getNextPage();
                        }
                    }).catch(error);
                });
            }
            getNextPage();
        })
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        if (!this._db) {
            error(noClient);
            return;
        }
        this._db.on("end", () => {
            this._db = undefined;
            complete();
        })
        this._db.quit();
    }

    write(table: string, pk: any, row: { [key: string]: any }, complete: (pk: any) => void, error: (err: any) => void) {

        new Promise((res, rej) => { // get current auto incremenet value
            if (!this._db) {
                error(noClient);
                return;
            }
            if (this._tableConfigs[table].ai) {
                this._db.get(this.key("_ai_", table), (err, result) => {
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
                if (!this._db) {
                    error(noClient);
                    return;
                }

                if (typeof pk === "undefined") {
                    rej(new Error("Can't add a row without a primary key!"));
                    return;
                }

                if (this._tableConfigs[table].ai && pk > AI) { // need to increment ai to database
                    this._db.incr(this.key("_ai_", table), (err, result) => {
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
                if (!this._db) {
                    error(noClient);
                    return;
                }
                switch(item) {
                    case "_index_": // update index
                        this._db.zadd(this.key("_index_", table), this._tableConfigs[table].isPkNum ? parseFloat(primaryKey) : 0, primaryKey, (error) => {
                            if (error) {
                                err(error);
                                return;
                            }
                            next(primaryKey);
                        });
                    break;
                    case "_table_": // update row value
                        this._db.set(this.key(table, String(primaryKey)), JSON.stringify(row), (error) => {
                            if (error) {
                                err(error);
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
        if (!this._db) {
            error(noClient);
            return;
        }

        this._db.get(this.key(table, String(pk)), (err, result) => {
            if (err) {
                error(err);
                return;
            }
            complete(result ? JSON.parse(result) : undefined);
        })
    }

    readZIndex(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, complete: (index: any[]) => void, error: (err: any) => void): void {
        if (!this._db) {
            error(noClient);
            return;
        }

        switch (type) {
            case "offset":
                if (reverse) {
                    this._db.zrevrange(this.key("_index_", table), offsetOrLow + 1, offsetOrLow + limitOrHigh, (err, results) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                } else {
                    this._db.zrange(this.key("_index_", table), offsetOrLow, offsetOrLow + limitOrHigh - 1, (err, results) => {
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
                    this._db.zrangebyscore(this.key("_index_", table), offsetOrLow, limitOrHigh, (err, result) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(reverse ? result.reverse() : result);
                    });
                } else {
                    this._db.zrangebylex(this.key("_index_", table), "[" + offsetOrLow, "[" + limitOrHigh, (err, result) => {
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

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {
        this.readZIndex(table, type, offsetOrLow, limitOrHigh, reverse, (primaryKeys) => {
            let page = 0;
            // get the records in batches so we don't block redis
            const getPage = () => {
                if (!this._db) {
                    error(noClient);
                    return;
                }
                const PKS = primaryKeys.slice((page * 100), (page * 100) + 100);
                if (!PKS.length) {
                    complete();
                    return;
                }
                this._db.mget(PKS.map(pk => this.key(table, pk)), (err, rows) => {
                    if (err) {
                        error(err);
                        return;
                    }
                    rows.forEach((row, i) => {
                        onRow(JSON.parse(row), i + (page * 500))
                    });
                    page++;
                    getPage();
                });
            }
            getPage();
        }, error);
    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {

        allAsync(["_index_", "_table_"], (item, i, next, err) => {
            if (!this._db) {
                error(noClient);
                return;
            }
            switch(item) {
                case "_index_": // update index
                    this._db.zrem(this.key("_index_", table), pk, (error) => {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                break;
                case "_table_": // remove row value
                    this._db.del(this.key(table, String(pk)), (error) => {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                break;
            }
        }).then(complete).catch(error);
    }

    maybeMapIndex(table: string, index: any[]): any[] {
        if (this._tableConfigs[table].isPkNum) return index.map(i => parseFloat(i));
        return index;
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        let ptr = "0";
        let index: any[] = [];
        if (!this._db) {
            error(noClient);
            return;
        }
        const cb = (err, result) => {
            if (err) {
                error(err);
                return;
            }

            complete(this.maybeMapIndex(table, result));
        };
        this._db.zrangebyscore(this.key("_index_", table), "-inf", "+inf", cb);
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        let count: number = 0;
        if (!this._db) {
            error(noClient);
            return;
        }
        this._db.zcount(this.key("_index_", table), "-inf", "+inf", (err, result) => {
            if(err) {
                error(err);
                return;
            }
            complete(result);
        });
    }

    createIndex(tableId: string, index: string, type: string, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        this.createTable(indexName, {
            ...blankTableDefinition,
            pkType: type,
            pkCol: ["id"],
            isPkNum: ["float", "int", "number"].indexOf(type) !== -1
        }, () => {
            complete();
        }, error);
    }

    deleteIndex(tableId: string, index: string, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        this.dropTable(indexName, complete, error);
    }

    addIndexValue(tableId: string, index: string, rowID: any, indexKey: any, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        if (!this._db) {
            error(noClient);
            return;
        }
        
        return allAsync(["_index_", "_table_"], (item, i, next, err) => {
            if (!this._db) {
                error(noClient);
                return;
            }
            switch(item) {
                case "_index_": // update index
                    this._db.zadd(this.key("_index_", indexName), this._tableConfigs[indexName].isPkNum ? parseFloat(indexKey) : 0, indexKey, (error) => {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                break;
                case "_table_": // update row value
                    const isNum = typeof rowID === "number";
                    this._db.zadd(this.key(indexName, indexKey), 0, (isNum ? "num:" : "") + rowID, (error, result) => {
                        if (error) {
                            err(error);
                            return;
                        }
                        next();
                    });
                break;
            }
        }).then(complete).catch(error);

    }

    deleteIndexValue(tableId: string, index: string, rowID: any, indexKey: any, complete: () => void, error: (err: any) => void) {
        if (!this._db) {
            error(noClient);
            return;
        }
        const indexName = `_idx_${tableId}_${index}`;
        const isNum = typeof rowID === "number";
        this._db.zrem(this.key(indexName, indexKey), (isNum ? "num:" : "") + rowID, (err, result) => {
            if (err) {
                error(err);
                return;
            }
            complete();
        });
    }

    readIndexKey(tableId: string, index: string, indexKey: any, onRowPK: (pk: any) => void, complete: () => void, error: (err: any) => void) {
        if (!this._db) {
            error(noClient);
            return;
        }
        const indexName = `_idx_${tableId}_${index}`;
        this._db.zrangebylex(this.key(indexName, indexKey), "-", "+", (err, result) => {
            if (err) {
                error(err);
                return;
            }
            if (!result) {
                complete();
                return;
            }
            result.forEach((value, i) => {
                onRowPK(value.indexOf("num:") === 0 ? parseFloat(value.replace("num:", "")) : value );
            })
            complete();
        })
    }

    readIndexKeys(tableId: string, index: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, id: any) => void, complete: () => void, error: (err: any) => void) {
        
        const indexName = `_idx_${tableId}_${index}`;
        this.readZIndex(indexName, type, offsetOrLow, limitOrHigh, reverse, (primaryKeys) => {
            let page = 0;
            // get the records in batches so we don't block redis
            const getPage = () => {
                if (!this._db) {
                    error(noClient);
                    return;
                }
                const PKS = primaryKeys.slice((page * 100), (page * 100) + 100);
                if (!PKS.length) {
                    complete();
                    return;
                }
                allAsync(PKS, (indexKey, i, pkNext, pkErr) => {
                    if (!this._db) {
                        error(noClient);
                        return;
                    }
                    this._db.zrangebylex(this.key(indexName, indexKey), "-", "+", (err, result) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        if (!result) {
                            pkNext();
                            return;
                        }
                        result.forEach((value, i) => {
                            onRowPK(value.indexOf("num:") === 0 ? parseFloat(value.replace("num:", "")) : value, i);
                        })
                        pkNext();
                    })
                }).then(() => {
                    page++;
                    getPage();
                })

            }
            getPage();
        }, error);
    }
}