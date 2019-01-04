import { nanoSQLInstance } from "nano-sql";
import { Promise } from "lie-ts";
declare global  {
    interface Window {
        nSQL: (table?: string) => nanoSQLInstance;
    }
}
export declare class initnanoSQL {
    private _noGlobal;
    private _nsql;
    constructor(setup: (nSQL: (table?: string) => nanoSQLInstance) => void, doNotSetGlobal?: boolean);
    connect(): Promise<any>;
}
