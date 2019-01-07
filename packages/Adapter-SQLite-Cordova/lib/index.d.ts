import { NanoSQLInstance } from "nano-sql";
import { Promise } from "lie-ts";
declare global {
    interface Window {
        nSQL: (table?: string) => NanoSQLInstance;
    }
}
export declare class initNanoSQL {
    private _noGlobal;
    private _nsql;
    constructor(setup: (nSQL: (table?: string) => NanoSQLInstance) => void, doNotSetGlobal?: boolean);
    connect(): Promise<any>;
}
