import { NanoSQLInstance, NanoSQLBackend, DBRow, DBConnect, DBExec } from "./index";
import { Promise } from "lie-ts";
import { _NanoSQL_Storage } from "./db-storage";
export declare const _str: (index: number) => string;
export interface HistoryCallBack {
    [tableID: number]: {
        rows: DBRow[];
        type: string;
        affectedPKS: any[];
    };
}
export declare class _NanoSQLDB implements NanoSQLBackend {
    _store: _NanoSQL_Storage;
    constructor();
    _connect(connectArgs: DBConnect): void;
    _exec(execArgs: DBExec): void;
    _transaction(type: "start" | "end", transactionID: number): Promise<any[]>;
    _extend(db: NanoSQLInstance, command: string): Promise<any>;
}
export declare class _fnForEach {
    loop(items: any[], callBack: (item: any, next: (result?: any) => void) => void): Promise<any[]>;
}
