import { InanoSQLConfig, InanoSQLTableConfig } from "@nano-sql/core/lib/interfaces";

export interface InanoSQLWebTableConfig {
    offline?: "client-only" | "client-only-wait-sync"| "server-until-client-ready"
}

export interface InanoSQLSession {
    time: number;
    sessionID: string;
    meta: {[key: string]: any};
}

export interface InanoSQLUniversalDB {
    name: string;
    consensus: "raft" | "multi-master" | "none",
    config: InanoSQLConfig,
    tables: (InanoSQLTableConfig & InanoSQLWebTableConfig)[]
}