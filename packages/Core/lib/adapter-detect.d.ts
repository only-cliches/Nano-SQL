import { InanoSQLAdapter } from "./interfaces";
export declare const detectStorage: () => string;
export declare const resolveMode: (mode: string | InanoSQLAdapter, args?: {
    size?: number | undefined;
    version?: number | undefined;
    path?: string | ((dbID: string, tableName: string) => {
        lvld: any;
        args?: any;
    }) | undefined;
} | undefined) => InanoSQLAdapter;
