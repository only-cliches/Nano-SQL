import { InanoSQLAdapter, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, adapterCreateIndexFilter, adapterConnectFilter, adapterDeleteIndexFilter, adapterAddIndexValueFilter, adapterDeleteIndexValueFilter, adapterReadIndexKeyFilter, adapterReadIndexKeysFilter } from "@nano-sql/core/lib/interfaces";
import { generateID, deepSet, chainAsync, allAsync, blankTableDefinition } from "@nano-sql/core/lib/utilities";
import * as redis from "redis";

const noClient = `No Redis client!`;

export const RedisIndex = (connectArgs?: redis.ClientOpts, getClient?: (redisClient: redis.RedisClient) => void): InanoSQLPlugin => {

    let _db: redis.RedisClient;
    let _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    } = {};
    let id: string;

    const key = (tableName: string, key: any): string => {
        return id + "." + tableName + "." + key;
    }

    const maybeMapIndex = (table: string, index: any[]): any[] => {
        if (_tableConfigs[table].isPkNum) return index.map(i => parseFloat(i));
        return index;
    }

    const getTableIndex = (table: string, complete: (index: any[]) => void, error: (err: any) => void) => {

        _db.zrangebyscore(key("_index_", table), "-inf", "+inf", (err, result) => {
            if (err) {
                error(err);
                return;
            }

            complete(maybeMapIndex(table, result));
        });
    }

    const readZIndex = (table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, complete: (index: any[]) => void, error: (err: any) => void): void => {


        switch (type) {
            case "offset":
                if (reverse) {
                    _db.zrevrange(key("_index_", table), offsetOrLow + 1, offsetOrLow + limitOrHigh, (err, results) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                } else {
                    _db.zrange(key("_index_", table), offsetOrLow, offsetOrLow + limitOrHigh - 1, (err, results) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(results);
                    });
                }
                break;
            case "all":
                getTableIndex(table, (index) => {
                    if (reverse) {
                        complete(index.reverse());
                    } else {
                        complete(index);
                    }
                }, error);
                break;
            case "range":
                if (_tableConfigs[table].isPkNum) {
                    _db.zrangebyscore(key("_index_", table), offsetOrLow, limitOrHigh, (err, result) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        complete(reverse ? result.reverse() : result);
                    });
                } else {
                    _db.zrangebylex(key("_index_", table), "[" + offsetOrLow, "[" + limitOrHigh, (err, result) => {
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

    return {
        name: "Redis Index",
        version: 2.00,
        filters: [
            {
                name: "adapterConnect",
                priority: 1000,
                call: (inputArgs: adapterConnectFilter, complete: (args: adapterConnectFilter) => void, cancel: (info: any) => void) => {

                    id = inputArgs.res.id;
                    _db = redis.createClient(connectArgs);

                    _db.on("ready", () => {
                        if (getClient) {
                            getClient(_db);
                        }
                        complete(inputArgs);
                    });
            
                    _db.on("error", cancel);
                }
            },
            {
                name: "adapterCreateIndex",
                priority: 1000,
                call: (inputArgs: adapterCreateIndexFilter, complete: (args: any) => void, cancel: (info: any) => void) => {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    const indexName = `_idx_${inputArgs.res.table}_${inputArgs.res.indexName}`;
                    _tableConfigs[indexName] = {
                        ...blankTableDefinition,
                        pkType: inputArgs.res.type,
                        pkCol: ["id"],
                        isPkNum: ["float", "int", "number"].indexOf(inputArgs.res.type) !== -1
                    };
                    inputArgs.res.complete();
                }
            },
            {
                name: "adapterDeleteIndex",
                priority: 1000,
                call: (inputArgs: adapterDeleteIndexFilter, complete: (args: any) => void, cancel: (info: any) => void) => {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    const indexName = `_idx_${inputArgs.res.table}_${inputArgs.res.indexName}`;
                    let ptr = "0";
                    const getNextPage = () => {
                        _db.zscan(key("_index_", indexName), ptr, (err, result) => {
                            if (err) {
                                inputArgs.res.error(err);
                                return;
                            }
        
                            if (!result[1].length && result[0] !== "0") {
                                ptr = result[0];
                                getNextPage();
                                return;
                            }
        
                            const PKS = (result[1] || []).filter((v, i) => i % 2 === 0);
        
                            chainAsync(PKS, (pk, i, next, err) => {
                                // clear table contents
                                _db.del(key(indexName, pk), (delErr) => {
                                    if (delErr) {
                                        err(delErr);
                                        return;
                                    }
                                    next();
                                })
                            }).then(() => {
                                if (result[0] === "0") {

                                    // done reading index, delete it
                                    _db.del(key("_index_", indexName), (delErr) => {
                                        if (delErr) {
                                            inputArgs.res.error(delErr);
                                            return;
                                        }
                                        inputArgs.res.complete();
                                    });
        
                                } else {
                                    ptr = result[0];
                                    getNextPage();
                                }
                            }).catch(inputArgs.res.error);
                        });
                    }
                    getNextPage();
                }
            },
            {
                name: "adapterAddIndexValue",
                priority: 1000,
                call: (inputArgs: adapterAddIndexValueFilter, complete: (args: any) => void, cancel: (info: any) => void) => {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    const indexName = `_idx_${inputArgs.res.table}_${inputArgs.res.indexName}`;
                    // key = rowID
                    // value = indexKey
            
                    return allAsync(["_index_", "_table_"], (item, i, next, err) => {

                        switch (item) {
                            case "_index_": // update index
                                _db.zadd(key("_index_", indexName), _tableConfigs[indexName].isPkNum ? parseFloat(inputArgs.res.value) : 0, inputArgs.res.value, (error) => {
                                    if (error) {
                                        err(error);
                                        return;
                                    }
                                    next();
                                });
                                break;
                            case "_table_": // update row value
                                const rowID = inputArgs.res.key;
                                const isNum = typeof rowID === "number";
                                _db.zadd(key(indexName, inputArgs.res.value), 0, (isNum ? "num:" : "") + rowID, (error, result) => {
                                    if (error) {
                                        err(error);
                                        return;
                                    }
                                    next();
                                });
                                break;
                        }
                    }).then(inputArgs.res.complete).catch(inputArgs.res.error);
                }
            },
            {
                name: "adapterDeleteIndexValue",
                priority: 1000,
                call: (inputArgs: adapterDeleteIndexValueFilter, complete: (args: any) => void, cancel: (info: any) => void) => {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    const indexName = `_idx_${inputArgs.res.table}_${inputArgs.res.indexName}`;
                    // key = rowID
                    // value = indexKey
                    const rowID = inputArgs.res.key;
                    const isNum = typeof rowID === "number";
                    _db.zrem(key(indexName, inputArgs.res.value), (isNum ? "num:" : "") + rowID, (err, result) => {
                        if (err) {
                            inputArgs.res.error(err);
                            return;
                        }
                        inputArgs.res.complete();
                    });
                }
            },
            {
                name: "adapterReadIndexKey",
                priority: 1000,
                call: (inputArgs: adapterReadIndexKeyFilter, complete: (args: any) => void, cancel: (info: any) => void) => {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    const indexName = `_idx_${inputArgs.res.table}_${inputArgs.res.indexName}`;

                    _db.zrangebylex(key(indexName, inputArgs.res.pk), "-", "+", (err, result) => {
                        if (err) {
                            inputArgs.res.error(err);
                            return;
                        }
                        if (!result) {
                            inputArgs.res.complete();
                            return;
                        }
                        result.forEach((value, i) => {
                            inputArgs.res.onRowPK(value.indexOf("num:") === 0 ? parseFloat(value.replace("num:", "")) : value);
                        })
                        inputArgs.res.complete();
                    })
                }
            },
            {
                name: "adapterReadIndexKeys",
                priority: 1000,
                call: (inputArgs: adapterReadIndexKeysFilter, complete: (args: any) => void, cancel: (info: any) => void) => {
                    complete(false);
                    if (!inputArgs) {
                        cancel("Query taken over by another plugin!");
                        return;
                    }
                    const indexName = `_idx_${inputArgs.res.table}_${inputArgs.res.indexName}`;
        
                    readZIndex(indexName, inputArgs.res.type, inputArgs.res.offsetOrLow, inputArgs.res.limitOrHigh, inputArgs.res.reverse, (primaryKeys) => {

                        chainAsync(primaryKeys, (indexKey, i, pkNext, pkErr) => {

                            _db.zrangebylex(key(indexName, indexKey), "-", "+", (err, result) => {
                                if (err) {
                                    inputArgs.res.error(err);
                                    return;
                                }
                                if (!result) {
                                    pkNext();
                                    return;
                                }
                                result.forEach((value, i) => {
                                    inputArgs.res.onRowPK(value.indexOf("num:") === 0 ? parseFloat(value.replace("num:", "")) : value, i);
                                })
                                pkNext();
                            })
                        }).then(() => {
                            inputArgs.res.complete();
                        })
            
                    }, inputArgs.res.error);
                }
            }
        ]
    }
}