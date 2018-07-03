import { NanoSQLInstance, DatabaseEvent } from "nano-sql";
export declare const nSQLVue: (props: {
    tables: string[];
    callback: (event: DatabaseEvent, complete: (any: any) => void) => void;
    store?: NanoSQLInstance;
}) => {
    methods: {
        _nSQLDoRunUpdate: (event: any) => void;
    };
    created: () => void;
    destroyed: () => void;
};
