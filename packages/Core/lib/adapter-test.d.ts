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
import { INanoSQLAdapter, INanoSQLAdapterConstructor, INanoSQLInstance, INanoSQLTable } from "./interfaces";
export declare const myConsole: any;
export declare class nanoSQLAdapterTest {
    adapter: INanoSQLAdapterConstructor;
    args: any[];
    constructor(adapter: INanoSQLAdapterConstructor, args: any[]);
    test(): Promise<void>;
    static newTable(adapter: INanoSQLAdapter, nSQL: INanoSQLInstance, tableName: string, tableConfig: INanoSQLTable, complete: () => void, error: () => void): void;
    Deletes(): Promise<{}>;
    SecondayIndexes(): Promise<{}>;
    RangeReads(): Promise<{}>;
    RangeReadsUUID(): Promise<{}>;
    Writes(): Promise<{}>;
    PrimaryKeys(): Promise<{}>;
}
