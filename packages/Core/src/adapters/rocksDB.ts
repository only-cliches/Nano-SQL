import { NanoSQLAdapter, NanoSQLDataModel } from "../interfaces";

export class RocksDB implements NanoSQLAdapter {

    // plugin?: NanoSQLPlugin;
    nSQL: any; // NanoSQLInstance;

    constructor() {

    }

    connect(id: string, complete: () => void, error: (err: any) => void) {

    }

    makeTable(tableName: string, dataModels: NanoSQLDataModel[], complete: () => void, error: (err: any) => void) {

    }

    destroyTable(table: string, complete: () => void, error: (err: any) => void) {

    }

    disconnect(complete: () => void, error: (err: any) => void) {

    }

    write(table: string, pk: any, row: {[key: string]: any}, complete: (row: {[key: string]: any}) => void, error: (err: any) => void) {

    }

    read(table: string, pk: any, complete: (row: {[key: string]: any}) => void, error: (err: any) => void) {

    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {

    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHeigh: any, onRow: (row: {[key: string]: any}, nextRow: () => void) => void, complete: () => void, error: (err: any) => void) {

    }

    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {

    }

    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void) {

    }
}