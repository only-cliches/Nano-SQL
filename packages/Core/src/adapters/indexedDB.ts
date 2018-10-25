import { INanoSQLAdapter, INanoSQLDataModel, INanoSQLTable, INanoSQLPlugin, INanoSQLInstance } from "../interfaces";

export class IndexedDB implements INanoSQLAdapter {

    plugin: INanoSQLPlugin = {
        name: "IndexedDB Adapter",
        version: 2.0,
        dependencies: {
            core: [2.0]
        }
    };

    nSQL: INanoSQLInstance;

    constructor() {

    }

    connect(id: string, complete: () => void, error: (err: any) => void) {

    }

    createAndInitTable(tableName: string, tableData: INanoSQLTable, complete: () => void, error: (err: any) => void) {

    }

    disconnectTable(table: string, complete: () => void, error: (err: any) => void) {

    }

    dropTable(table: string, complete: () => void, error: (err: any) => void) {

    }

    disconnect(complete: () => void, error: (err: any) => void) {

    }

    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void) {

    }

    read(table: string, pk: any, complete: (row: {[key: string]: any}) => void, error: (err: any) => void) {

    }

    delete(table: string, pk: any, complete: () => void, error: (err: any) => void) {

    }

    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHeigh: any, reverse: boolean, onRow: (row: {[key: string]: any}, i: number) => void, complete: () => void, error: (err: any) => void) {

    }

    readMultiPK(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHeigh: any, reverse: boolean, onPK: (pk: any, i: number) => void, complete: () => void, error: (err: any) => void) {

    }

    getIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void) {

    }

    getNumberOfRecords(table: string, complete: (length: number) => void, error: (err: any) => void) {

    }
}