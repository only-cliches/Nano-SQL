/// <reference types="react" />
import * as React from "react";
import { nanoSQLInstance, DatabaseEvent } from "nano-sql";
export interface WithNSQLData {
    nSQLdata?: any;
    nSQLloading?: boolean;
}
export interface NSQLComponent<T> extends React.ComponentClass<T> {
    onChange?: (e: DatabaseEvent, complete: (any) => void) => void;
    tables?: () => string[];
}
export declare function bindNSQL<P extends WithNSQLData>(Comp: NSQLComponent<P>, props: {
    tables?: string[];
    onChange?: (e: DatabaseEvent, complete: (any) => void) => void;
    store?: nanoSQLInstance;
}): React.ComponentClass<P>;
