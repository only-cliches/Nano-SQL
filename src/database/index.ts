import { Trie } from "prefix-trie-ts";
import { IdbQuery } from "../query/std-query";
import { NanoSQLPlugin, DBConnect, NanoSQLInstance  } from "../index";
import { _NanoSQLStorage } from "./storage";
import { _NanoSQLStorageQuery } from "./query";
import { ALL } from "../utilities";

declare var global: any;

export class NanoSQLDefaultBackend implements NanoSQLPlugin {

    private _store: _NanoSQLStorage;

    public parent: NanoSQLInstance;

    constructor() {

    }

    public willConnect(connectArgs: DBConnect, next: (connectArgs: DBConnect) => void): void {

        this.parent = connectArgs.parent;

        this._store = new _NanoSQLStorage(connectArgs.parent, {
            ...connectArgs.config,
        } as any);

        this._store.init(connectArgs.models, (newModels) => {
            connectArgs.models = {
                ...connectArgs.models,
                ...newModels
            };
            next(connectArgs);
        });
    }

    public doExec(execArgs: IdbQuery, next: (execArgs: IdbQuery) => void): void {
        execArgs.state = "complete";
        new _NanoSQLStorageQuery(this._store).doQuery(execArgs, next);
    }

    /*public transactionBegin(id: string, next: () => void): void {
        next();
    }

    public transactionEnd(id: string, next: () => void): void {
        next();
    }
    */

    public extend(next: (args: any[], result: any[]) => void, args: any[], result: any[]): void {
        switch (args[0]) {
            case "idx.length":
            case "idx":
                const table = args[1];
                if (Object.keys(this._store.tableInfo).indexOf(table) > -1) {
                    this._store._adapter.getIndex(table, args[0] !== "idx", (idx: any) => {
                        next(args, idx);
                    });
                } else {
                    next(args, []);
                }
            break;
            case "rebuild_idx":
                if (args[1]) {
                    this._store.rebuildIndexes(args[1], (time) => {
                        next(args, [time]);
                    });
                } else {
                    new ALL(Object.keys(this._store.tableInfo).map((table) => {
                        return (done) => {
                            this._store.rebuildIndexes(table, done);
                        };
                    })).then((times) => {
                        next(args, times);
                    });
                }

            break;
            case "clear_cache":
                if (args[1]) {
                    this._store._cache[args[1]] = {};
                } else {
                    Object.keys(this._store.tableInfo).forEach((table) => {
                        this._store._cache[table] = {};
                    });
                }
                next(args, args[1] || Object.keys(this._store.tableInfo));
            break;
            default:
                next(args, result);
        }
    }
}