import { INanoSQLQuery, ISelectArgs, IWhereArgs, INanoSQLIndex, IWhereCondition, INanoSQLSortBy, INanoSQLTableConfig, INanoSQLQueryExec, INanoSQLInstance } from "./interfaces";
export declare class _NanoSQLQuery implements INanoSQLQueryExec {
    nSQL: INanoSQLInstance;
    query: INanoSQLQuery;
    progress: (row: any, i: number) => void;
    complete: () => void;
    error: (err: any) => void;
    _buffer: any[];
    _stream: boolean;
    _selectArgs: ISelectArgs[];
    _whereArgs: IWhereArgs;
    _havingArgs: IWhereArgs;
    _pkOrderBy: boolean;
    _idxOrderBy: boolean;
    _sortGroups: {
        [groupKey: string]: any[];
    };
    _groupByColumns: string[];
    _orderBy: INanoSQLSortBy;
    _groupBy: INanoSQLSortBy;
    constructor(nSQL: INanoSQLInstance, query: INanoSQLQuery, progress: (row: any, i: number) => void, complete: () => void, error: (err: any) => void);
    _select(complete: () => void, onError: (error: any) => void): void;
    _groupByRows(): void;
    _upsert(onRow: (row: any, i: number) => void, complete: () => void): void;
    _updateRow(newData: any, oldRow: any, complete: (row: any) => void, error: (err: any) => void): void;
    _newRow(newRow: any, complete: (row: any) => void, error: (err: any) => void): void;
    _delete(onRow: (row: any, i: number) => void, complete: () => void): void;
    _getIndexValues(indexes: {
        [name: string]: INanoSQLIndex;
    }, row: any): {
        [indexName: string]: any;
    };
    _showTables(): void;
    _describe(): void;
    _registerRelation(name: string, relation: [string, "<=" | "<=>" | "=>", string], complete: () => void, error: (err: any) => void): void;
    _destroyRelation(name: string, complete: () => void, error: (err: any) => void): void;
    _streamAS(row: any, isJoin: boolean): any;
    _orderByRows(a: any, b: any): number;
    createTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void;
    alterTable(table: INanoSQLTableConfig, complete: () => void, error: (err: any) => void): void;
    dropTable(table: string, complete: () => void, error: (err: any) => void): void;
    _onError(err: any): void;
    _getByPKs(onlyPKs: boolean, table: string, fastWhere: IWhereCondition, isReversed: boolean, orderByPK: boolean, onRow: (row: {
        [name: string]: any;
    }, i: number) => void, complete: () => void): void;
    _fastQuery(onRow: (row: {
        [name: string]: any;
    }, i: number) => void, complete: () => void): void;
    _readIndex(onlyPKs: boolean, fastWhere: IWhereCondition, onRow: (row: {
        [name: string]: any;
    }, i: number) => void, complete: () => void): void;
    _getRecords(onRow: (row: {
        [name: string]: any;
    }, i: number) => void, complete: () => void): void;
    _rebuildIndexes(table: string, complete: () => void, error: (err: any) => void): void;
    /**
     * Handles WHERE statements, combining multiple compared statements aginst AND/OR as needed to return a final boolean value.
     * The final boolean value is wether the row matches the WHERE conditions or not.
     *
     * @param {*} singleRow
     * @param {any[]} where
     * @param {number} rowIDX
     * @param {boolean} [ignoreFirstPath]
     * @returns {boolean}
     */
    _where(singleRow: any, where: (IWhereCondition | string | (IWhereCondition | string)[])[], ignoreFirstPath: boolean): boolean;
    static likeCache: {
        [likeQuery: string]: RegExp;
    };
    _processLIKE(columnValue: string, givenValue: string): boolean;
    _getColValue(where: IWhereCondition, wholeRow: any, isJoin: boolean): any;
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
    _compare(where: IWhereCondition, wholeRow: any, isJoin: boolean): boolean;
    static _sortMemoized: {
        [key: string]: INanoSQLSortBy;
    };
    _parseSort(sort: string[], checkforIndexes: boolean): INanoSQLSortBy;
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
