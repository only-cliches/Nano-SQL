import { nSQL, nanoSQLInstance } from "nano-sql";
import { getMode } from "./sqlite-adapter";
import { Promise } from "lie-ts";

declare const cordova: any;

declare global {
    interface Window {
        nSQL: (table?: string) => nanoSQLInstance
    }
}

export class initnanoSQL {

    private _noGlobal: boolean;

    private _nsql: nanoSQLInstance;

    constructor(setup: (nSQL: (table?: string) => nanoSQLInstance) => void, doNotSetGlobal?: boolean) {
        this._noGlobal = doNotSetGlobal || false;
        this._nsql = new nanoSQLInstance();
        setup((table?: string) => {
            return this._nsql.table(table);
        });
    }

    public connect(): Promise<any> {
        return new Promise((res, rej) => {

            if (!this._noGlobal) {
                window.nSQL = (table?: string) => {
                    return this._nsql.table(table);
                };
            }

            let config = this._nsql.getConfig();
            this._nsql.config({
                ...config,
                mode: getMode()
            }).connect().then(() => {
                res([], (table?: string) => {
                    return this._nsql.table(table);
                });
            }).catch(rej);
        });
    }
}