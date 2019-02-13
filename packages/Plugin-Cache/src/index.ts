import { InanoSQLAdapter, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, adapterCreateIndexFilter, adapterConnectFilter, adapterDeleteIndexFilter, adapterAddIndexValueFilter, adapterDeleteIndexValueFilter, adapterReadIndexKeyFilter, adapterReadIndexKeysFilter, adapterWriteFilter, adapterReadFilter, adapterReadMultiFilter, adapterDisconnectFilter, adapterCreateTableFilter, adapterDropTableFilter, adapterDeleteFilter, adapterGetTableIndexFilter, adapterGetTableIndexLengthFilter, postConnectFilter, willConnectFilter, InanoSQLQuery } from "@nano-sql/core/lib/interfaces";
import { generateID, deepSet, chainAsync, allAsync, blankTableDefinition, adapterFilters, buildQuery, noop } from "@nano-sql/core/lib/utilities";
import { SyncStorage } from "@nano-sql/core/lib/adapters/syncStorage";

export const nSQLCache = (args?: {
    cacheAll?: boolean;
    batchSize?: number;
    batchInterval?: number;
}): InanoSQLPlugin => {

    let _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    } = {};
    let id: string;
    let cacheAdapter: InanoSQLAdapter = new SyncStorage();
    let cachedTables: {[tableName: string]: "loading" | "ready"} = {};
    let connected = false;
    const setArgs = {
        cacheAll: false,
        batchSize: 1000,
        batchInterval: 500,
        ...(args || {}),
    };
    let nSQL: InanoSQLInstance;

    setInterval(() => {
        if (connected) {

        }
    }, setArgs.batchInterval);

    const loadCache = (tableId: string) => {
        const tableName = Object.keys(nSQL._tableIds).reduce((prev, cur) => {
            if (nSQL._tableIds[cur] === tableId) return cur;
            return prev; 
        }, "");
        adapterFilters(nSQL).getTableIndex(tableId, (index) => {
            let i = 0;
            const next = () => {
                let loadThese = index.splice(setArgs.batchSize * i, (setArgs.batchSize * i) + setArgs.batchSize);
                if (!loadThese.length) {
                    cachedTables[tableId] = "ready";
                    return;
                }
                allAsync(loadThese, (pk, i, next, err) => {
                    adapterFilters(nSQL).read(tableId, pk, next, err);
                }).then((rows) => {
                    nSQL.triggerQuery({
                        ...buildQuery(nSQL, tableName, "upsert"),
                        actionArgs: rows,
                        tags: ["load-cache"]
                    }, noop, () => {
                        i++;
                        setTimeout(next);
                    }, (err) => {
                        throw new Error(err);
                    });

                }).catch((err) => {
                    throw new Error(err);
                })
            }
            next();
        }, (err) => {
            throw new Error(err);
        })
    }

    return {
        name: "Cache",
        version: 2.00,
        filters: [
            {
                name: "willConnect",
                priority: 1500,
                call: (inputArgs: willConnectFilter, complete: (args: willConnectFilter) => void, cancel: (info: any) => void) => {
                    nSQL = inputArgs.res;
                    complete(inputArgs);
                }
            },
            {
                name: "adapterConnect",
                priority: 1500,
                call: (inputArgs: adapterConnectFilter, complete: (args: adapterConnectFilter) => void, cancel: (info: any) => void) => {
                    cacheAdapter.connect(inputArgs.res.id, () => {
                        connected = true;
                        complete(inputArgs);
                    }, cancel);
                }
            },
            {
                name: "adapterWrite",
                priority: 1500,
                call: (inputArgs: adapterWriteFilter, complete: (args: any) => void, cancel: (info: any) => void) => {
                    const loadCache = ((inputArgs.query || {} as InanoSQLQuery).tags || []).indexOf("load-cache") !== -1;
                    if (loadCache || cachedTables[inputArgs.res.table] === "ready") {
                        
                    }
                }
            },
            {
                name: "adapterRead",
                priority: 1500,
                call: (inputArgs: adapterReadFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterReadMulti",
                priority: 1500,
                call: (inputArgs: adapterReadMultiFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterReadMulti",
                priority: 1500,
                call: (inputArgs: adapterReadMultiFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterDisconnect",
                priority: 1500,
                call: (inputArgs: adapterDisconnectFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterCreateTable",
                priority: 1500,
                call: (inputArgs: adapterCreateTableFilter, complete: (args: any) => void, cancel: (info: any) => void) => {
                    const doCache = setArgs.cacheAll || (inputArgs.res.tableData.props || {}).cache;
                    if (doCache) {
                        cachedTables[inputArgs.res.tableName] = "loading";
                        cacheAdapter.createTable(inputArgs.res.tableName, inputArgs.res.tableData, () => {
                            complete(inputArgs);
                            loadCache(inputArgs.res.tableName);
                        }, inputArgs.res.error);
                    } else {
                        complete(inputArgs);
                    }
                }
            },
            {
                name: "adapterDropTable",
                priority: 1500,
                call: (inputArgs: adapterDropTableFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterDelete",
                priority: 1500,
                call: (inputArgs: adapterDeleteFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterGetTableIndex",
                priority: 1500,
                call: (inputArgs: adapterGetTableIndexFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterGetTableIndexLength",
                priority: 1500,
                call: (inputArgs: adapterGetTableIndexLengthFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterCreateIndex",
                priority: 1500,
                call: (inputArgs: adapterCreateIndexFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterDeleteIndex",
                priority: 1500,
                call: (inputArgs: adapterDeleteIndexFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterAddIndexValue",
                priority: 1500,
                call: (inputArgs: adapterAddIndexValueFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterDeleteIndexValue",
                priority: 1500,
                call: (inputArgs: adapterDeleteIndexValueFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterReadIndexKey",
                priority: 1500,
                call: (inputArgs: adapterReadIndexKeyFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            },
            {
                name: "adapterReadIndexKeys",
                priority: 1500,
                call: (inputArgs: adapterReadIndexKeysFilter, complete: (args: any) => void, cancel: (info: any) => void) => {

                }
            }
        ]
    }
}