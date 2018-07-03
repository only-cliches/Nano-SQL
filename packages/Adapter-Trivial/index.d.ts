import { NanoSQLStorageAdapter, DBKey, DBRow } from "nano-sql/lib/database/storage";
import { DataModel } from "nano-sql/lib/index";
export interface trivialDBOpts {
    writeToDisk?: boolean;
    loadFromDisk?: boolean;
    rootPath?: string;
    dbPath?: string;
    writeDelay?: number;
    prettyPrint?: boolean;
    idFunc?: () => string;
}
export interface trivialDB {
    load: (key: any) => Promise<any>;
    save: (key: any, value: any) => Promise<any>;
    remove: (keyObj: {
        [primaryKeyCol: string]: any;
    }) => Promise<any>;
    clear: () => Promise<any>;
    loading: Promise<any>;
    filter: (filterFunc: (value: any, key: any) => boolean) => void;
}
export declare class TrivialAdapter implements NanoSQLStorageAdapter {
    nameSpaceOpts: {
        basePath?: string | undefined;
        dbPath?: string | undefined;
    } | undefined;
    dbOpts: trivialDBOpts | undefined;
    private _id;
    private _dbs;
    private ns;
    private _pkKey;
    private _dbIndex;
    constructor(nameSpaceOpts?: {
        basePath?: string | undefined;
        dbPath?: string | undefined;
    } | undefined, dbOpts?: trivialDBOpts | undefined);
    setID(id: string): void;
    connect(complete: () => void): void;
    makeTable(tableName: string, dataModels: DataModel[]): void;
    write(table: string, pk: DBKey | null, newData: DBRow, complete: (row: DBRow) => void): void;
    delete(table: string, pk: DBKey, complete: () => void): void;
    read(table: string, pk: DBKey, callback: (row: DBRow) => void): void;
    rangeRead(table: string, rowCallback: (row: DBRow, idx: number, nextRow: () => void) => void, complete: () => void, from?: any, to?: any, usePK?: boolean): void;
    drop(table: string, callback: () => void): void;
    getIndex(table: string, getLength: boolean, complete: (index) => void): void;
    destroy(complete: () => void): void;
}
