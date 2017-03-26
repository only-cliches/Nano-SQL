import { NanoSQLInstance, NanoSQLBackend, DBConnect, DBExec } from "./index";
import { Promise } from "lie-ts";
import { _NanoSQL_Storage } from "./db-storage";
export declare const _str: (index: number) => string;
export declare class _NanoSQLDB implements NanoSQLBackend {
    _store: _NanoSQL_Storage;
    constructor();
    _connect(connectArgs: DBConnect): void;
    _exec(execArgs: DBExec): void;
    _transaction(type: "start" | "end"): boolean;
    _extend(db: NanoSQLInstance, command: string): Promise<any>;
}
