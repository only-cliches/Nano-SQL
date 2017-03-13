import { NanoSQLInstance, NanoSQLBackend, ActionOrView, QueryLine, DBRow, DataModel, StdObject, DBConnect, DBExec, JoinArgs } from "./index";
import { Promise } from "es6-promise";

/**
 * Only for testing purposes, to test the speed of the NanoSQL abstraction layer by itself.
 * This file is not bundled with the library.
 * 
 * This also kind of shows the barebones data store, these 3 functions are all that's needed to conform to spec.
 * 
 * 
 * @export
 * @class _NanoSQLNullStore
 * @implements {NanoSQLBackend}
 */

// tslint:disable-next-line
export class _NanoSQLNullStore implements NanoSQLBackend {
    public _connect(connectArgs: DBConnect): void {
        connectArgs._onSuccess();
    }

    public _exec(execArgs: DBExec): void {
        execArgs._onSuccess([],"null",[]);
    }

    public _extend(instance: NanoSQLInstance, ...args: Array<any>) {
        return null;
    }
}