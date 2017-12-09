import { NanoSQLStorageAdapter, DBKey, DBRow, _NanoSQLStorage } from "./storage";
import { DataModel } from "../index";
import { setFast } from "lie-ts";
import { StdObject, hash, ALL, CHAIN, deepFreeze, uuid, timeid, _assign, generateID, sortedInsert } from "../utilities";
import { DatabaseIndex } from "./db-idx";

const _evalContext = (source: string, context: {[key: string]: any}) => {
    const compiled = eval("(function(" + Object.keys(context).join(", ") + ") {" + source + "})");
    return compiled.apply(context, Object.keys(context).map(c => context[c]));
};

/**
 * Handles IndexedDB with and without web workers.
 * Uses blob worker OR eval()s the worker and uses it inline.
 *
 * @export
 * @class _IndexedDBStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
export class _IndexedDBStore implements NanoSQLStorageAdapter {

    private _pkKey: {
        [tableName: string]: string;
    };

    private _pkType: {
        [tableName: string]: string;
    };

    private _dbIndex: {
        [tableName: string]: DatabaseIndex;
    };

    private _id: string;

    private _w: any;

    private _waitingCBs: {
        [key: string]: any;
    };

    private _useWorker: boolean;

    private _worker = require("./adapter-indexedDB-worker.txt");

    constructor(useWorker: boolean) {
        this._pkKey = {};
        this._pkType = {};
        this._dbIndex = {};
        this._waitingCBs = {};
        this._useWorker = useWorker;
    }

    public connect(complete: () => void) {

        if (this._useWorker) {

            // blob webworker, doesn't use an external file!
            // not supported by IE and Edge with IndexedDB, like at all.

            this._w = new Worker(window.URL.createObjectURL(new Blob([this._worker])));
            this._w.addEventListener("message", (e: MessageEvent) => {
                this._handleWWMessage(e.data.do, e.data.args);
            });

        } else {

            // eval the worker, the end result being a ui thread indexed db instance.
            // this is mostly to get IndexedDB support in IE and Edge without duplicating the indexed db code

            let listeners: any[] = [];

            // emulate worker behavior
            _evalContext(this._worker, {
                postMessage: (msg: any) => {
                    this._handleWWMessage(msg.do, msg.args);
                },
                addEventListener: (type: string, listener: (e) => void) => {
                    listeners.push(listener);
                }
            });

            // emulate worker object
            this._w = {
                addEventListener: null as any,
                postMessage: (message: any, transfer?: any[]) => {
                    listeners.forEach((l) => {
                        l({data: message});
                    });
                }
            };
        }

        // returns indexes for each table
        this._waitingCBs["rdy"] = (args: { [table: string]: any[] }) => {

            Object.keys(args).forEach((table) => {
                this._dbIndex[table].set(args[table]);
            });
            complete();
        };

        this._w.postMessage({
            do: "setup", args: {
                pkKeys: this._pkKey,
                id: this._id
            }
        });
    }

    public setID(id: string) {
        this._id = id;
    }

    private _handleWWMessage(action: string, args: any) {
        if (this._waitingCBs[action]) {
            this._waitingCBs[action](args);
            delete this._waitingCBs[action];
        }
    }

    public makeTable(tableName: string, dataModels: DataModel[]): void {
        this._dbIndex[tableName] = new DatabaseIndex();

        dataModels.forEach((d) => {
            if (d.props && d.props.indexOf("pk") > -1) {
                this._pkType[tableName] = d.type;
                this._pkKey[tableName] = d.key;

                if (d.props && d.props.indexOf("ai") > -1 && (d.type === "int" || d.type === "number")) {
                    this._dbIndex[tableName].doAI = true;
                }
            }
        });
    }

    public write(table: string, pk: DBKey | null, data: DBRow, complete: (row: DBRow) => void, skipReadBeforeWrite): void {

        pk = pk || generateID(this._pkType[table], this._dbIndex[table].ai) as DBKey;

        if (!pk) {
            throw new Error("Can't add a row without a primary key!");
        }

        if (this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
        }

        let queryID = uuid();

        let r  = {
            ...data,
            [this._pkKey[table]]: pk,
        };

        this._waitingCBs["write_" + queryID] = (args: null) => {
            complete(r);
        };

        const w = (oldData: any) => {
            r = {
                ...oldData,
                ...r
            };

            this._w.postMessage({
                do: "write",
                args: {
                    table: table,
                    id: queryID,
                    row: r
                }
            });
        };

        if (skipReadBeforeWrite) {
            w({});
        } else {
            this.read(table, pk, (row) => {
                w(row);
            });
        }
    }

    public delete(table: string, pk: DBKey, complete: () => void): void {
        let idx = this._dbIndex[table].indexOf(pk);
        if (idx !== -1) {
            this._dbIndex[table].remove(pk);
        }

        let queryID = uuid();


        this._waitingCBs["delete_" + queryID] = (args: null) => {
            complete();
        };

        this._w.postMessage({
            do: "delete", args: {
                table: table,
                id: queryID,
                pk: pk
            }
        });
    }

    public read(table: string, pk: DBKey, callback: (row: any) => void): void {
        let queryID = uuid();
        if (this._dbIndex[table].indexOf(pk) === -1) {
            callback(null);
            return;
        }

        this._waitingCBs["read_" + queryID] = (args: DBRow) => {
            callback(args);
        };

        this._w.postMessage({
            do: "read", args: {
                table: table,
                id: queryID,
                pk: pk
            }
        });
    }

    public rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void {
        const keys = this._dbIndex[table].keys();
        const usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        let ranges: number[] = usefulValues ? [from as any, to as any] : [0, keys.length - 1];

        if (!keys.length) {
            complete();
            return;
        }

        const queryID = uuid();

        let rows: DBRow[] = [];

        let idx = ranges[0];
        let i = 0;

        this._waitingCBs["readRange_" + queryID + "_done"] = (args: DBRow[]) => {
            delete this._waitingCBs["readRange_" + queryID];
            rows = args;

            const getRow = () => {
                if (idx <= ranges[1]) {
                    rowCallback(rows[i], idx, () => {
                        idx++;
                        i++;
                        i > 200 ? setFast(getRow) : getRow(); // handle maximum call stack error
                    });
                } else {
                    complete();
                }
            };
            getRow();
        };

        /*const getNextRows = () => {
            this._waitingCBs["readRange_" + queryID] = (args: DBRow[]) => {
                rows = rows.concat(args);
                getNextRows();
            };
        };
        getNextRows();*/

        this._w.postMessage({
            do: "readRange",
            args: {
                table: table,
                id: queryID,
                range: usePK && usefulValues ? ranges : ranges.map(r => keys[r])
            }
        });
    }

    public drop(table: string, callback: () => void): void {

        let idx = new DatabaseIndex();
        idx.doAI = this._dbIndex[table].doAI;
        this._dbIndex[table] = idx;
        let queryID = uuid();

        this._waitingCBs["delete_" + queryID] = (args: null) => {
            callback();
        };

        this._w.postMessage({
            do: "delete", args: {
                table: table,
                id: queryID,
                pk: "_clear_"
            }
        });
    }

    public getIndex(table: string, getLength: boolean, complete: (index) => void): void {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    }

    public destroy(complete: () => void) {
        new ALL(Object.keys(this._dbIndex).map((table) => {
            return (done) => {
                this.drop(table, done);
            };
        })).then(complete);
    }
}