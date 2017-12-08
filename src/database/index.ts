import { Trie } from "prefix-trie-ts";
import { IdbQuery } from "../query/std-query";
import { NanoSQLPlugin, DBConnect, NanoSQLInstance  } from "../index";
import { _NanoSQLStorage } from "./storage";
import { _NanoSQLStorageQuery } from "./query";

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
            case "idx":
            case "idx.length":
                const table = args[1];
                if (Object.keys(this._store.tableInfo).indexOf(table) > -1) {
                    this._store._adapter.getIndex(table, args[0] !== "idx", (idx) => {
                        next(args, idx);
                    });
                } else {
                    next(args, []);
                }
            break;
            case "rebuild_idx":
                this._store.rebuildIndexes(args[1], (time) => {
                    next(args, [time]);
                });
            break;
            default:
                next(args, result);
        }
    }
}