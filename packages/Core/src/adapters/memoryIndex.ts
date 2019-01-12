import { InanoSQLAdapter, InanoSQLTable, InanoSQLInstance, InanoSQLPlugin, loadIndexCacheFilter } from "../interfaces";
import { binarySearch, blankTableDefinition, assign } from "../utilities";

export const err = new Error("Memory index doesn't support this action!");

export class nanoSQLMemoryIndex implements InanoSQLAdapter {
    plugin: InanoSQLPlugin;
    nSQL: InanoSQLInstance;

    indexes: {
        [indexName: string]: {
            [key: string]: any[];
        }
    }

    indexLoaded: {
        [indexName: string]: boolean;
    }

    useCacheIndexes: {
        [indexName: string]: boolean;
    }

    constructor(public assign?: boolean, public useCache?: boolean) {
        this.indexes = {};
        this.indexLoaded = {};
        this.useCacheIndexes = {};
    }
    connect(id: string, complete: () => void, error: (err: any) => void) {
        error(err);
    }
    disconnect(complete: () => void, error: (err: any) => void) {
        error(err);
    }
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void) {
        error(err);
    }
    dropTable(table: string, complete: () => void, error: (err: any) => void) {
        error(err);
    }
    write(table: string, pk: any, row: {
        [key: string]: any;
    }, complete: (pk: any) => void, error: (err: any) => void) {
        error(err);
    }
    read(table: string, pk: any, complete: (row: {
        [key: string]: any;
    } | undefined) => void, error: (err: any) => void) {
        error(err);
    }
    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {
        error(err);
    }
    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void) {
        error(err);
    }
    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {
        error(err);
    }
    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void) {
        error(err);
    }

    createIndex(tableId: string, index: string, type: string, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        this.createTable(indexName, {
            ...blankTableDefinition,
            pkType: type,
            pkCol: ["id"],
            isPkNum: ["float", "int", "number"].indexOf(type) !== -1
        }, () => {

            if (this.indexes[indexName]) {
                complete();
                return;
            }

            this.indexes[indexName] = {};
            this.indexLoaded[indexName] = false;
            this.useCacheIndexes[indexName] = this.useCache || false;
            complete();

            this.nSQL.doFilter<loadIndexCacheFilter>("loadIndexCache", {res: {load: this.useCache || false}, index: indexName}, (result) => {
                this.useCacheIndexes[indexName] = result.res.load;
                if (result.res.load) {
                    this.readMulti(indexName, "all", undefined, undefined, false, (row) => {
                        if (!this.indexes[indexName][row.id]) {
                            this.indexes[indexName][row.id] = row.pks || [];
                        }
                    }, () => {
                        this.indexLoaded[indexName] = true;
                    }, error);
                }
            }, error);

        }, error);
    }

    deleteIndex(tableId: string, index: string, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        delete this.indexes[indexName];
        delete this.indexLoaded[indexName];
        delete this.useCacheIndexes[indexName];
        this.dropTable(indexName, complete, error);
    }

    addIndexValue(tableId: string, index: string, key: any, value: any, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        if (!this.indexLoaded[indexName]) {
            this.read(indexName, value, (row) => {
                let pks = row ? row.pks : [];
                pks = this.assign ? assign(pks) : pks;
                if (pks.length === 0) {
                    pks.push(key);
                } else {
                    const idx = binarySearch(pks, key, false);
                    pks.splice(idx, 0, key);
                }
                if (this.useCacheIndexes[indexName]) {
                    this.indexes[indexName][value] = pks;
                }
                
                this.write(indexName, value, {
                    id: key,
                    pks: this.assign ? assign(pks) : pks
                }, complete, error);
            }, error);
            return;
        }
        
        if (!this.indexes[indexName][value]) {
            this.indexes[indexName][value] = [];
            this.indexes[indexName][value].push(key);
        } else {
            const idx = binarySearch(this.indexes[indexName][value], key, false);
            this.indexes[indexName][value].splice(idx, 0, key);
        }
        this.write(indexName, value, {
            id: key,
            pks: this.assign ? assign(this.indexes[indexName][value]) : this.indexes[indexName][value]
        }, complete, error);
    }

    deleteIndexValue(tableId: string, index: string, key: any, value: any, complete: () => void, error: (err: any) => void) {
        const indexName = `_idx_${tableId}_${index}`;
        if (!this.indexLoaded[indexName]) {
            this.read(indexName, value, (row) => {
                let pks = row ? row.pks : [];
                pks = this.assign ? assign(pks) : pks;
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
                if (this.useCacheIndexes[indexName]) {
                    this.indexes[indexName][value] = pks;
                }
                
                this.write(indexName, value, {
                    id: key,
                    pks: this.assign ? assign(pks) : pks
                }, complete, error);
            }, error);
            return;
        }
        if (!this.indexes[indexName][value]) {
            complete();
        } else {
            const idx = this.indexes[indexName][value].length < 100 ? this.indexes[indexName][value].indexOf(key) : binarySearch(this.indexes[indexName][value], key, true);
            if (idx === -1) {
                complete();
            } else {
                this.indexes[indexName][value].splice(idx, 1);
                this.write(indexName, value, {
                    id: value,
                    pks: this.assign ? assign(this.indexes[indexName][value]) : this.indexes[indexName][value]
                }, complete, error);
            }
        }
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
