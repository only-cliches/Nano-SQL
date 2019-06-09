import { InanoSQLTable, InanoSQLPlugin, InanoSQLInstance } from "@nano-sql/core/lib/interfaces";
import { generateID, deepSet, allAsync, binarySearch, chainAsync } from "@nano-sql/core/lib/utilities";
import { nanoSQLMemoryIndex } from "@nano-sql/core/lib/adapters/memoryIndex";
import AsyncStorage from "@react-native-community/async-storage";


export const binaryInsert = (arr: any[], value: any, remove: boolean, startVal?: number, endVal?: number): boolean => {

    const start = startVal || 0;
    const end = endVal || arr.length;

    if (arr[start] > value) {
        if (!remove) arr.unshift(value);
        return remove ? false : true;
    }
    if (arr[end] < value) {
        if (!remove) arr.push(value);
        return remove ? false : true;
    }

    const m = Math.floor((start + end) / 2);
    if (value == arr[m]) { // already in array
        if (remove) arr.splice(m, 1);
        return remove ? true : false;
    }
    if (end - 1 == start) {
        if (!remove) arr.splice(end, 0, value);
        return remove ? false : true;
    }

    if (value > arr[m]) return binaryInsert(arr, value, remove, m, end);
    if (value < arr[m]) return binaryInsert(arr, value, remove, start, m);

    if (!remove) arr.splice(end, 0, value);
    return remove ? false : true;
};

export class NativeStorage extends nanoSQLMemoryIndex {

    plugin: InanoSQLPlugin = {
        name: "React Native Adapter",
        version: 2.06
    };

    nSQL: InanoSQLInstance;

    private _id: string;
    private _indexes: {
        [tableName: string]: any[];
    }
    private _ai: {
        [tableName: string]: number;
    }
    private _tableConfigs: {
        [tableName: string]: InanoSQLTable;
    }

    constructor(public cacheIndexes: boolean) {
        super(false, false);
        this._tableConfigs = {};
    }

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._id = id;
        this._indexes = {};
        this._ai = {};
        complete();
    }


    key(table: string, pk: any) {
        return this._id + "_" + table + "_" + String(pk);
    }

    getIndex(table: string): Promise<any[]> {
        return new Promise((res, rej) => {
            if (this._indexes[table]) {
                res(this._indexes[table]);
                return;
            }
            AsyncStorage.getItem(this.key(table, "__IDX__"), (err, result) => {
                if (err) {
                    rej(err);
                    return;
                }

                const index = JSON.parse(result || "[]");
                if (this.cacheIndexes) {
                    this._indexes[table] = index;
                    res(this._indexes[table]);
                } else {
                    res(index);
                }
            });
        });
    }

    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {

        this._tableConfigs[tableName] = tableData;
        AsyncStorage.getItem(this.key(tableName, "__IDX__"), (err, result) => {
            if (err) {
                error(err);
                return;
            }

            // remove duplicate index from bug.
            new Promise((res, rej) => {
                AsyncStorage.getItem(this.key(tableName, "__FX__"), (err, result2) => {
                    if (result2) {
                        res(result ? JSON.parse(result || "[]") : undefined);
                    } else {
                        const index = JSON.parse(result || "[]").filter((v, i, s) => s.indexOf(v) === i);
                        AsyncStorage.setItem(this.key(tableName, "__IDX__"), JSON.stringify(index), (err) => {
                            AsyncStorage.setItem(this.key(tableName, "__FX__"), "true", (err) => {
                                if (err) {
                                    error(err);
                                    return;
                                }
                                res(index);
                            })
                        });
                    }
                });
            }).then((index?: any[]) => {

                if (index) {
                
                    if (this.cacheIndexes) {
                        this._indexes[tableName] = index;
                    }
                    AsyncStorage.getItem(this.key(tableName, "__AI__"), (err, ai) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        this._ai[tableName] = ai ? parseInt(ai) : 0;
                        complete();
                    })
                } else {
                    this._ai[tableName] = 0;
                    this._indexes[tableName] = [];
                    AsyncStorage.setItem(this.key(tableName, "__IDX__"), "[]", (err) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        AsyncStorage.setItem(this.key(tableName, "__AI__"), "0", (err) => {
                            if (err) {
                                error(err);
                                return;
                            }
                            complete();
                        })
                    })
                }
            })

        });

    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        this.getIndex(table).then((pks) => {
            AsyncStorage.multiRemove(pks.map(s => this.key(table, s)), (err) => {
                if (err) {
                    error(err);
                    return;
                }
                AsyncStorage.removeItem(this.key(table, "__IDX__"), (err) => {
                    if (err) {
                        error(err);
                        return;
                    }
                    AsyncStorage.removeItem(this.key(table, "__AI__"), (err) => {
                        if (err) {
                            error(err);
                            return;
                        }
                        delete this._indexes[table];
                        this._ai[table] = 0;
                        complete();
                    });
                });
            });
        });
    }

    disconnect(complete: () => void, error: (err: any) => void) {
        complete();
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

        const json = JSON.stringify(deepSet(this._tableConfigs[table].pkCol, row, pk));
        this.getIndex(table).then((index) => {
            const didUpdate = binaryInsert(index, pk, false);

            return allAsync([0, 1, 2], (idx, i, next, err) => {
                switch(idx) {
                    case 0:
                        AsyncStorage.setItem(this.key(table, pk), json, (queryError) => {
                            if (queryError) {
                                error(queryError);
                                return;
                            }
                            next();
                        });
                    break;
                    case 1:
                        if (didUpdate) {
                            AsyncStorage.setItem(this.key(table, "__IDX__"), JSON.stringify(index), (queryError) => {
                                if (queryError) {
                                    err(queryError);
                                    return;
                                }
                                next();
                            })
                        } else {
                            next();
                        }
                    break;
                    case 2:
                        if (this._tableConfigs[table].ai) {
                            AsyncStorage.setItem(this.key(table, "__AI__"), String(this._ai[table]), (queryError) => {
                                if (queryError) {
                                    err(queryError);
                                    return;
                                }
                                next();
                            })
                        } else {
                            next();
                        }
                    break;
                }
            });
        }).then(() => {
            complete(pk);
        }).catch(error);

    }

    read(table: string, pk: any, complete: (row: { [key: string]: any } | undefined) => void, error: (err: any) => void) {
        AsyncStorage.getItem(this.key(table, pk), (err, result) => {
            if (err) {
                error(err);
                return;
            }
            complete(result ? JSON.parse(result) : undefined);
        });
    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: { [key: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void) {

        let range: any[] = {
            "range":  [offsetOrLow, limitOrHigh],
            "offset": [offsetOrLow, offsetOrLow + limitOrHigh],
            "all": []
        }[type];


        this.getIndex(table).then((index) => {
            return new Promise((res, rej) => {
                switch(type) {
                    case "all":
                        res(index.slice());
                        break;
                    case "offset":
                        const l = index.length - 1;
                        res(reverse ? index.slice(l - range[1], l - range[0]) : index.slice(range[0], range[1]));
                        break;
                    case "range":
                        let lowIdx = binarySearch(index, range[0], false);
                        let highIdx = binarySearch(index, range[1], false);
    
                        while(index[highIdx] > range[1]) {
                            highIdx--;
                        }
    
                        while(index[lowIdx] < range[0]) {
                            lowIdx++;
                        }
                        res(index.slice(lowIdx, highIdx + 1));
                        break;
                    default:
                        res([]);
                }
            });
        }).then((getPKs: any[]) => {
            return allAsync(reverse ? getPKs.reverse() : getPKs, (pk, i, next, err) => {
                this.read(table, pk, (row) => {
                    onRow(row || {}, i);
                    next();
                }, err);
            });
        }).then(() => {
            complete();
        }).catch(error);

    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        this.getIndex(table).then((index) => {
            const didUpdate = binaryInsert(index, pk, true);
            allAsync([0, 1], (item, i, next, err) => {
                switch(item) {
                    case 0:
                        if (didUpdate) {
                            AsyncStorage.setItem(this.key(table, "__IDX__"), JSON.stringify(index), (queryError) => {
                                if (queryError) {
                                    err(queryError);
                                    return;
                                }
                                next();
                            })
                        } else {
                            next();
                        }
                    break;
                    case 1:
                        AsyncStorage.removeItem(this.key(table, pk), (queryError) => {
                            if (queryError) {
                                err(queryError);
                                return;
                            }
                            next();
                        });
                    break;
                }
            }).then(() => {
                complete();
            }).catch(error);
        }).catch(error);
    }

    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        this.getIndex(table).then(complete).catch(error);
    }

    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        this.getIndex(table).then((index) => {
            complete(index.length);
        }).catch(error);
    }
}