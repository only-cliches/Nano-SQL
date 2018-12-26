import { INanoSQLTable, INanoSQLPlugin, INanoSQLInstance } from "../interfaces";
import { NanoSQLMemoryIndex } from "./memoryIndex";
export declare const rimraf: (dir_path: string) => void;
export declare class RocksDB extends NanoSQLMemoryIndex {
    path?: string | ((dbID: string, tableName: string, tableData: INanoSQLTable) => {
        lvld: any;
        args?: any;
    }) | undefined;
    plugin: INanoSQLPlugin;
    nSQL: INanoSQLInstance;
    private _id;
    private _lvlDown;
    private _levelDBs;
    private _ai;
    private _tableConfigs;
    constructor(path?: string | ((dbID: string, tableName: string, tableData: INanoSQLTable) => {
        lvld: any;
        args?: any;
    }) | undefined);
    connect(id: string, complete: () => void, error: (err: any) => void): void;
    createTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void): void;
    disconnectTable(table: string, complete: () => void, error: (err: any) => void): void;
    dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    disconnect(complete: () => void, error: (err: any) => void): void;
    write(table: string, pk: any, row: {
        [key: string]: any;
    }, complete: (pk: any) => void, error: (err: any) => void): void;
    read(table: string, pk: any, complete: (row: {
        [key: string]: any;
    } | undefined) => void, error: (err: any) => void): void;
    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {
        [key: string]: any;
    }, i: number) => void, complete: () => void, error: (err: any) => void): void;
    _writeNumberBuffer(table: string, num: number): any;
    _readNumberBuffer(table: string, buff: any): number;
    _encodePk(table: string, pk: any): any;
    _decodePK(table: string, pk: any): any;
    delete(table: string, pk: any, complete: () => void, error: (err: any) => void): void;
    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void): void;
    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void): void;
}
