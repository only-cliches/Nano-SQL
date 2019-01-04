/**
 * Most adapters can only run exclusively in the browser or NodeJS.
 * This adapter test class is meant to handle both situations.
 *
 *
 * TO TEST YOUR ADAPTER
 * 1. Replace the _SyncStore import at the top with your own adapter.
 * 2. Set your adapter and argumnets to pass into it at the bottom.
 *
 * NODEJS:
 * 3. ts-node --disableWarnings test.ts
 *
 * BROWSER:
 * 3. npm run test-browser then navigate to localhost::8080. Test results will be in the console.
 *
 */
import { InanoSQLAdapter, InanoSQLAdapterConstructor, InanoSQLInstance, InanoSQLTable } from "./interfaces";
export declare const myConsole: any;
export declare class nanoSQLAdapterTest {
    adapter: InanoSQLAdapterConstructor;
    args: any[];
    constructor(adapter: InanoSQLAdapterConstructor, args: any[]);
    test(): Promise<void>;
    static newTable(adapter: InanoSQLAdapter, nSQL: InanoSQLInstance, tableName: string, tableConfig: InanoSQLTable, complete: () => void, error: () => void): void;
    Deletes(): Promise<{}>;
    SecondayIndexes(): Promise<{}>;
    RangeReads(): Promise<{}>;
    RangeReadsUUID(): Promise<{}>;
    Writes(): Promise<{}>;
    PrimaryKeys(): Promise<{}>;
}
