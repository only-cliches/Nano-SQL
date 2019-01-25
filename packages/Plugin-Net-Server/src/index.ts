import { InanoSQLAdapter, InanoSQLDataModel, InanoSQLTable, InanoSQLPlugin, InanoSQLInstance, VERSION, InanoSQLQuery } from "@nano-sql/core/lib/interfaces";
import { generateID, setFast, deepSet } from "@nano-sql/core/lib/utilities";
import { InanoSQLUniversalDB, InanoSQLSession } from "@nano-sql/plugin-net-common";
import { RSE } from "really-small-events";
import { Express } from "express";

export interface InanoSQLPresetQuery {
    name: string,
    args?: {
        [colAndType: string]: InanoSQLDataModel;
    } | string;
    call: (args: any, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => any;
}


export class nanoSQLServer {

    constructor(public app: Express) {

    }

    public connect(serverArgs: {
        id?: string; // unique for all servers.  if not declared, uuid is generated
        secretKey: string; // should be identical for all servers in the cluster
        multiCluster?: {
            id: string; // unique for each cluster of servers
            configServer: string; // redis server for config
        };
        servers?: string | string[]; // array of server urls or redis database connect url
        databases: InanoSQLUniversalDB[];
        beforeQuery?: (database: string, dynamicQuery: InanoSQLQuery, presetQuery: InanoSQLPresetQuery,  session: InanoSQLSession) => Promise<any>;
        syncRequest?: (database: string, table: string, session: InanoSQLSession) => Promise<boolean | ((rowData: any) => boolean)>;
        subscribeRequest?: (session: InanoSQLSession, streamName: string) => Promise<any>;
        onConflict?: (database: string, table: string, oldRow: any, newRow: any) => Promise<any>;
        get?: { [name: string]: (session: InanoSQLSession, query: any) => Promise<any> };
        post?: { [name: string]: (session: InanoSQLSession, query: any) => Promise<any> };
    }): Promise<any> {
        return new Promise((res, rej) => {

        });
    }

    public publish(streamName: string, eventData: any) {

    }

    public on(event: string, callback: () => void) {

    }

    public off(event: string, callback: () => void) {

    }
    
    public getDB(name: string) {

    }

    public newDB(config: InanoSQLUniversalDB) {

    }

    public clearDB(name: string) {

    }

    public dropDB(name: string) {

    }

    public blacklistSession() {

    }
}