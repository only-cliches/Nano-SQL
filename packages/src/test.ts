import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";
import { SyncStorage } from "@nano-sql/core/lib/adapters/syncStorage";
import { RedisIndex } from "./index";
import { InanoSQLAdapter, InanoSQLPlugin, adapterConnectFilter, InanoSQLQuery, adapterCreateIndexFilter, adapterDeleteIndexFilter, adapterAddIndexValueFilter, adapterDeleteIndexValueFilter, adapterReadIndexKeyFilter, adapterReadIndexKeysFilter } from "@nano-sql/core/lib/interfaces";
import { noop } from "@nano-sql/core/lib/utilities";

class TestAdapter extends SyncStorage implements InanoSQLAdapter {

    private _redis: InanoSQLPlugin;

    connect(id: string, complete: () => void, error: (err: any) => void) {
        this._redis = RedisIndex();
        const args: adapterConnectFilter = {
            res: {
                id: "123",
                complete: complete,
                error: error
            },
            query: {} as InanoSQLQuery
        };
        this.getFilter("adapterConnect").call(args, () => {
            super.connect(id, complete, error);
        }, error);
    }

    getFilter(name: string): {
        name: string;
        priority: number;
        call: (inputArgs: any, complete: (args: any) => void, cancel: (info: any) => void) => void;
    } {
        return this._redis && this._redis.filters ? this._redis.filters.reduce((prev, cur) => {
            if (cur.name === name) return cur;
            return prev;
        }) : {
            name: "none",
            priority: 100,
            call: () => {}
        }
    }

    createIndex(tableId: string, index: string, type: string, complete: () => void, error: (err: any) => void) {
        const args: adapterCreateIndexFilter = {
            res: {
                table: tableId,
                indexName: index,
                type: type,
                complete: complete,
                error: error
            },
            query: {} as InanoSQLQuery
        }
        this.getFilter("adapterCreateIndex").call(args, noop, error);
    }

    deleteIndex(tableId: string, index: string, complete: () => void, error: (err: any) => void) {
        const args: adapterDeleteIndexFilter = {
            res: {
                table: tableId,
                indexName: index,
                complete: complete,
                error: error
            },
            query: {} as InanoSQLQuery
        }
        this.getFilter("adapterDeleteIndex").call(args, noop, error);
    }

    addIndexValue(tableId: string, index: string, key: any, value: any, complete: () => void, error: (err: any) => void) {
        const args: adapterAddIndexValueFilter = {
            res: {
                table: tableId,
                indexName: index,
                key: key,
                value: value,
                complete: complete,
                error: error
            },
            query: {} as InanoSQLQuery
        }
        this.getFilter("adapterAddIndexValue").call(args, noop, error);
    }

    deleteIndexValue(tableId: string, index: string, key: any, value: any, complete: () => void, error: (err: any) => void) {
        const args: adapterDeleteIndexValueFilter = {
            res: {
                table: tableId,
                indexName: index,
                key: key,
                value: value,
                complete: complete,
                error: error
            },
            query: {} as InanoSQLQuery
        }
        this.getFilter("adapterDeleteIndexValue").call(args, noop, error);
    }

    readIndexKey(tableId: string, index: string, pk: any, onRowPK: (pk: any) => void, complete: () => void, error: (err: any) => void) {
        const args: adapterReadIndexKeyFilter = {
            res: {
                table: tableId,
                indexName: index,
                pk: pk,
                onRowPK: onRowPK,
                complete: complete,
                error: error
            },
            query: {} as InanoSQLQuery
        }
        this.getFilter("adapterReadIndexKey").call(args, noop, error);
    }

    readIndexKeys(tableId: string, index: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, id: any) => void, complete: () => void, error: (err: any) => void) {
        const args: adapterReadIndexKeysFilter = {
            res: {
                table: tableId,
                indexName: index,
                type: type,
                offsetOrLow: offsetOrLow,
                limitOrHigh: limitOrHigh,
                reverse: reverse,
                onRowPK: onRowPK,
                complete: complete,
                error: error
            },
            query: {} as InanoSQLQuery
        }
        this.getFilter("adapterReadIndexKeys").call(args, noop, error);
    }
}

new nanoSQLAdapterTest(TestAdapter, []).test().then(() => {
    console.log("Redis Index Test Passed");
    setTimeout(() => {
        process.exit();
    }, 250);
}).catch((err) => {
    console.log("Test Failed", err);
    setTimeout(() => {
        process.exit();
    }, 250);
});
