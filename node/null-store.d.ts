import { NanoSQLInstance, NanoSQLBackend, DBConnect, DBExec } from "./index";
export declare class _NanoSQLNullStore implements NanoSQLBackend {
    _connect(connectArgs: DBConnect): void;
    _exec(execArgs: DBExec): void;
    _extend(instance: NanoSQLInstance, ...args: Array<any>): null;
}
