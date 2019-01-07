import { nSQL, NanoSQLInstance } from "nano-sql";
import { getMode } from "./sqlite-adapter";
import { Promise } from "lie-ts";

declare const cordova: any;

declare global {
    interface Window {
        nSQL: (table?: string) => NanoSQLInstance;
    }
}

export class initNanoSQL {

    private _noGlobal: boolean;

    private _nsql: NanoSQLInstance;

    constructor(setup: (nSQL: (table?: string) => NanoSQLInstance) => void, doNotSetGlobal?: boolean) {
        this._noGlobal = doNotSetGlobal || false;
        this._nsql = new NanoSQLInstance();
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
                res((table?: string) => {
                    return this._nsql.table(table);
                });
            }).catch(rej);
        });
    }
}