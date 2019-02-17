import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION } from "@nano-sql/core/lib/interfaces";
import { generateID, setFast, deepSet } from "@nano-sql/core/lib/utilities";
import { InanoSQLUniversalDB, InanoSQLSession } from "../common";

export class nanoSQLClient {

    public session: InanoSQLSession;

    constructor() {

    }

    public connect(clientArgs: {
        servers: string | string[]; // array of servers OR Url to JSON with server list
        disableWS?: boolean;
        databases: InanoSQLUniversalDB[];
        onConflictFromServer?: () => {}
    }, onSession?: (session: InanoSQLSession) => void): Promise<any> {
        return new Promise((res, rej) => {

        });
    }

    public db(name: string) {

    }

    public requestSync(database: string, table: string): Promise<any> {
        return new Promise((res, rej) => {

        });
    }

    public on(event: string, callback: () => void) {

    }

    public off(event: string, callback: () => void) {

    }

    public subscribe(stream: string, callback: (data: any) => void): void {

    }

    public unsubscribe(stream: string, callback: (data: any) => void): void {

    }

    public get(name: string, args: any): Promise<any> {
        return new Promise((res, rej) => {

        })
    }

    public post(name: string, args: any): Promise<any> {
        return new Promise((res, rej) => {

        })
    }

}