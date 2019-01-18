import { InanoSQLQuery, ISelectArgs, IWhereArgs, InanoSQLIndex, IWhereCondition, InanoSQLSortBy, InanoSQLTableConfig, InanoSQLQueryExec, InanoSQLInstance, InanoSQLGraphArgs, InanoSQLTable, TableQueryResult } from "./interfaces";
import { _nanoSQLQueue } from "./utilities";
export declare const secondaryIndexQueue: {
    [idAndTable: string]: _nanoSQLQueue;
};
export declare class _nanoSQLQuery implements InanoSQLQueryExec {
    nSQL: InanoSQLInstance;
    query: InanoSQLQuery;
    progress: (row: any, i: number) => void;
    complete: () => void;
    error: (err: any) => void;
    _queryBuffer: any[];
    _stream: boolean;
    _selectArgs: ISelectArgs[];
    _whereArgs: IWhereArgs;
    _havingArgs: IWhereArgs;
    _pkOrderBy: boolean;
    _idxOrderBy: boolean;
    _sortGroups: any[][];
    _sortGroupKeys: {
        [groupKey: string]: number;
    };
    _groupByColumns: string[];
    _orderBy: InanoSQLSortBy;
    _groupBy: InanoSQLSortBy;
    upsertPath: string[];
    private _hasOrdered;
    private _startTime;
    private _indexesUsed;
    constructor(nSQL: InanoSQLInstance, query: InanoSQLQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void);
    _conform(progress: (row: any, i: number) => void, finished: () => void, error: (err: any) => void): void;
    _getTable(tableName: string, whereCond: any[] | ((row: {
        [key: string]: any;
    }, i?: number) => boolean) | undefined, table: any, callback: (result: TableQueryResult) => void): void;
    _select(complete: () => void, onError: (error: any) => void): void;
    _groupByRows(): void;
    _buildCombineWhere(graphWhere: any, graphTable: string, rowTable: string, rowData: any): any;
    _graph(gArgs: InanoSQLGraphArgs | InanoSQLGraphArgs[], topTable: string, row: any, index: number, onRow: (row: any, i: number) => void): void;
    _upsert(onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void;
    _updateRow(newData: any, oldRow: any, complete: (row: any) => void, error: (err: any) => void): void;
    private _checkUniqueIndexes;
    private _diffUpdates;
    private _updateIndex;
    _newRow(newRow: any, complete: (row: any) => void, error: (err: any) => void): void;
    _delete(onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void;
    _removeRowAndIndexes(table: InanoSQLTable, row: any, complete: (rowOrEv: any) => void, error: (err: any) => void): void;
    _getIndexValues(indexes: {
        [id: string]: InanoSQLIndex;
    }, row: any): {
        [indexName: string]: any;
    };
    _showTables(): void;
    _describe(type?: "table" | "idx" | "fks"): void;
    _combineRows(rData: any): {};
    _streamAS(row: any): any;
    _orderByRows(a: any, b: any): number;
    _tableID(): string;
    _createTable(table: InanoSQLTableConfig, alterTable: boolean, complete: () => void, error: (err: any) => void): void;
    _dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    _onError(err: any): void;
    _resolveFastWhere(onlyGetPKs: any, fastWhere: IWhereCondition, isReversed: boolean, onRow: (row: {
        [name: string]: any;
    }, i: number) => void, complete: () => void): void;
    _fastQuery(onRow: (row: {
        [name: string]: any;
    }, i: number) => void, complete: () => void): void;
    _getRecords(onRow: (row: {
        [name: string]: any;
    }, i: number) => void, complete: () => void): void;
    _rebuildIndexes(progress: (row: any, i: any) => void, complete: () => void, error: (err: any) => void): void;
    _where(singleRow: any, where: (IWhereCondition | string | (IWhereCondition | string)[])[]): boolean;
    static likeCache: {
        [likeQuery: string]: RegExp;
    };
    _processLIKE(columnValue: string, givenValue: string): boolean;
    _getColValue(where: IWhereCondition, wholeRow: any): any;
    /**
     * Compare function used by WHERE to determine if a given value matches a given condition.
     *
     * Accepts single where arguments (compound arguments not allowed).
     *
     *
     * @param {*} val1
     * @param {string} compare
     * @param {*} val2
     * @returns {boolean}
     */
    _compare(where: IWhereCondition, wholeRow: any): boolean;
    static _sortMemoized: {
        [key: string]: InanoSQLSortBy;
    };
    _parseSort(sort: string[], checkforIndexes: boolean): InanoSQLSortBy;
    static _selectArgsMemoized: {
        [key: string]: {
            hasAggrFn: boolean;
            args: ISelectArgs[];
        };
    };
    _hasAggrFn: boolean;
    _parseSelect(): void;
    static _whereMemoized: {
        [key: string]: IWhereArgs;
    };
    _parseWhere(qWhere: any[] | ((row: {
        [key: string]: any;
    }) => boolean), ignoreIndexes?: boolean): IWhereArgs;
}
