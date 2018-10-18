import { NanoSQLInstance } from ".";
import { NanoSQLQuery, SelectArgs, WhereArgs, WhereType, NanoSQLIndex, WhereCondition, NanoSQLSortBy } from "./interfaces";
import { objSort, objQuery, chainAsync, compareObjects, hash, resolveObjPath, setFast } from "./utilities";

// tslint:disable-next-line
export class _NanoSQLQuery {

    private _buffer: any[] = [];
    private _stream: boolean = true;
    private _selectArgs: SelectArgs[] = [];
    private _whereArgs: WhereArgs;
    private _havingArgs: WhereArgs;
    private _pkOrderBy: boolean = false;
    private _idxOrderBy: boolean = false;

    private _orderBy: NanoSQLSortBy;
    private _groupBy: NanoSQLSortBy;

    constructor(
        public nSQL: NanoSQLInstance,
        public query: NanoSQLQuery,
        public progress: (row: any) => void,
        public complete: () => void,
        public error: (err: any) => void
    ) {
        this.query.state = "processing";
        const action = query.action.toLowerCase().trim();
        if (action !== "select" && typeof query.table !== "string") {
            this.query.state = "error";
            this.error(`Only "select" queries are available for this resource!`);
            return;
        }
        switch (action) {
            case "select":
                this._select();
                break;
            case "upsert":
                this._upsert();
                break;
            case "delete":
                this._delete();
                break;
            case "show tables":
                this._showTables();
                break;
            case "describe":
                this._describe();
                break;
            default:
                this.query.state = "error";
                this.error(`Query type "${query.action}" not supported!`);
        }
    }

    private _select() {
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where, typeof this.query.table !== "string") : { type: WhereType.none };
        this._havingArgs = this.query.having ? this._parseWhere(this.query.having, true) : { type: WhereType.none };
        this._parseSelect();
        if (this.query.state === "error") return;

        this._getRecords((row, i) => {

        }, () => {

        });
        // Query order:
        // 1. Join / Index / Where Select
        // 2. Group By & Functions
        // 3. Apply AS
        // 4. Having
        // 5. OrderBy
        // 6. Offset
        // 7. Limit
        /*
                if (this._stream) { // stream results directly to the client.

                } else { // load query results into a buffer, perform order by/group by/aggregate function then stream the buffer to the client.

                }*/
    }

    private _upsert() {
        if (!this.query.actionArgs) {
            this.error("Can't upsert without records!");
            this.query.state = "error";
        }
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: WhereType.none };
        if (this.query.state === "error") return;
        const upsertRecords = Array.isArray(this.query.actionArgs) ? this.query.actionArgs : [this.query.actionArgs];

        if (this._whereArgs.type === WhereType.none) { // insert/update records directly

        } else { // find records and update them

        }
    }

    private _delete() {
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: WhereType.none };
        if (this.query.state === "error") return;

        if (this._whereArgs.type === WhereType.none) { // drop all records

        } else { // find records and delete them

        }
    }


    private _showTables() {

    }

    private _describe() {

    }

    private _onError(err: any) {
        this.query.state = "error";
        this.error(err);
    }

    private _getByPKs(onlyPKs: boolean, fastWhere: WhereCondition, isReversed: boolean, orderByPK: boolean, onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

        switch (fastWhere.comp) {
            case "=":
                if (onlyPKs) {
                    onRow(fastWhere.value as any, 0);
                    complete();
                } else {
                    this.nSQL.adapter.read(this.query.table as string, fastWhere.value, (row) => {
                        onRow(row, 0);
                        complete();
                    }, this._onError);
                }
                break;
            case "BETWEEN":
                (onlyPKs ? this.nSQL.adapter.readMultiPK : this.nSQL.adapter.readMulti)(this.query.table as string, "range", fastWhere.value[0], fastWhere.value[1], isReversed, (row, i) => {
                    onRow(row, i);
                }, complete, this._onError);
                break;
            case "IN":

                const PKS = orderByPK ? (isReversed ? (fastWhere.value as any[]).sort((a, b) => a < b ? 1 : -1) : (fastWhere.value as any[]).sort((a, b) => a > b ? 1 : -1)) : fastWhere.value as any[];
                if (onlyPKs) {
                    PKS.forEach((pk, i) => {
                        onRow(pk as any, i);
                    });
                    complete();
                } else {
                    chainAsync(PKS, (pk, i, next) => {
                        this.nSQL.adapter.read(this.query.table as string, pk, (row) => {
                            onRow(row, i);
                            next();
                        }, this._onError);
                    }).then(complete);
                }

                break;
        }
    }

    private _fastQuery(onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {
        if (this._whereArgs.fastWhere) {
            if (this._whereArgs.fastWhere.length === 1) { // single where

                const fastWhere = this._whereArgs.fastWhere[0] as WhereCondition;
                const isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";

                // function
                if (fastWhere.index && fastWhere.fnName) {
                    (this.nSQL.functions[fastWhere.fnName].queryIndex as any)(this.nSQL, this, fastWhere, false, onRow, complete);
                    // primary key
                } else if (fastWhere.col === this.nSQL.tables[this.query.table as string].pkCol) {
                    this._getByPKs(false, fastWhere, isReversed, this._pkOrderBy, onRow, complete);
                    // index
                } else {
                    this._readIndex(false, fastWhere, onRow, complete);
                }
            } else {  // multiple conditions
                let indexBuffer: any = {};
                let maxI = 0;
                chainAsync(this._whereArgs.fastWhere, (fastWhere, i, next) => {

                    if (i % 2 === 1) { // should be AND
                        next();
                        return;
                    }

                    maxI = i;

                    const addIndexBuffer = (pk) => {
                        indexBuffer[pk] = i;
                    };
                    // function
                    if (fastWhere.index && fastWhere.fnName) {
                        (this.nSQL.functions[fastWhere.fnName].queryIndex as any)(this.nSQL, this, fastWhere, true, addIndexBuffer, next);
                        // primary key
                    } else if (fastWhere.col === this.nSQL.tables[this.query.table as string].pkCol) {
                        this._getByPKs(true, fastWhere, false, false, addIndexBuffer, next);
                        // index
                    } else {
                        this._readIndex(true, fastWhere, addIndexBuffer, next);
                    }
                }).then(() => {
                    let getPKs: any[] = [];
                    Object.keys(indexBuffer).forEach((PK) => {
                        if (indexBuffer[PK] === maxI) {
                            getPKs.push(PK);
                        }
                    });
                    this._getByPKs(false, {
                        index: "_pk_",
                        col: this.nSQL.tables[this.query.table as string].pkCol,
                        comp: "IN",
                        value: getPKs
                    }, false, false, (row, i) => {
                        onRow(row, i);
                    }, complete);
                });
            }
        }
    }


    private _readIndex(onlyPKs: boolean, fastWhere: WhereCondition, onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

        const useIndex = this.nSQL.tables[this.query.table as string].indexes[fastWhere.index as string];
        if (!useIndex) {
            this._onError(`Index not found!`);
            return;
        }

        let queryComplete: boolean = false;
        let bufferStarted: boolean = false;
        let counter = 0;
        const processBuffer = () => {

            if (!indexBuffer.length) {
                if (queryComplete) { // buffer is empty and query is done, we're finshed
                    complete();
                } else { // wait for next row to come into the buffer
                    setFast(processBuffer);
                }
                return;
            }

            // execute rows in the buffer
            this._getByPKs(false, {
                index: "_pk_",
                col: this.nSQL.tables[this.query.table as string].pkCol,
                comp: "IN",
                value: (indexBuffer.shift() as any).pks
            }, false, false, (row) => {
                onRow(row, counter);
                counter++;
            }, () => {
                counter % 100 === 0 ? setFast(processBuffer) : processBuffer();
            });
        };

        const table = "_idx_" + fastWhere.index;
        let indexBuffer: { id: any, pks: any[] }[] = [];
        let indexPKs: any[] = [];
        const isReversed = this._idxOrderBy && this._orderBy.sort[0].dir === "DESC";
        this._getByPKs(false, fastWhere, isReversed, this._idxOrderBy, (row) => {
            if (onlyPKs) {
                indexPKs = indexPKs.concat(row.pks || []);
            } else {
                indexBuffer.push(row as any);
                if (!bufferStarted) {
                    bufferStarted = true;
                    processBuffer();
                }
            }

        }, () => {
            queryComplete = true;
            if (onlyPKs) {
                let i = 0;
                while (i < indexPKs.length) {
                    onRow(indexPKs[i], i);
                    i++;
                }
                complete();
            }
        });

    }

    private _getRecords(onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void): void {

        const scanRecords = (rows: any[]) => {
            let i = 0;
            while (i < rows.length) {
                if (this._whereArgs.type !== WhereType.none) {
                    if (this._whereArgs.whereFn) {
                        if (this._whereArgs.whereFn(rows[i], i)) {
                            onRow(rows[i], i);
                        }
                    } else {
                        if (this._where(rows[i], this._whereArgs.slowWhere as any, this.query.join !== undefined)) {
                            onRow(rows[i], i);
                        }
                    }
                } else {
                    onRow(rows[i], i);
                }
                i++;
            }
            complete();
        };

        if (typeof this.query.table === "string") { // pull from local table, possibly use indexes
            switch (this._whereArgs.type) {
                // primary key or secondary index select
                case WhereType.fast:
                    this._fastQuery(onRow, complete);
                    break;
                // primary key or secondary index followed by slow query
                case WhereType.medium:
                    this._fastQuery((row, i) => {
                        if (this._where(row, this._whereArgs.slowWhere as any, false)) {
                            onRow(row, i);
                        }
                    }, complete);
                    break;
                // full table scan
                case WhereType.slow:
                case WhereType.none:
                case WhereType.fn:
                    const isReversed = this._pkOrderBy && this._orderBy.sort[0].dir === "DESC";
                    this.nSQL.adapter.readMulti(this.query.table, "all", undefined, undefined, isReversed, (row, i) => {
                        if (this._whereArgs.type === WhereType.slow) {
                            if (this._where(row, this._whereArgs.slowWhere as any, false)) {
                                onRow(row, i);
                            }
                        } else if (this._whereArgs.type === WhereType.fn && this._whereArgs.whereFn) {
                            if (this._whereArgs.whereFn(row, i)) {
                                onRow(row, i);
                            }
                        } else {
                            onRow(row, i);
                        }
                    }, complete, (err) => {
                        this.query.state = "error";
                        this.error(err);
                    });
                    break;
            }

        } else if (typeof this.query.table === "function") { // promise that returns array
            this.query.table().then(scanRecords).catch((err) => {
                this.error(err);
            });
        } else if (Array.isArray(this.query.table)) { // array
            scanRecords(this.query.table);
        }
    }


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
    private _where(singleRow: any, where: (WhereCondition | string | (WhereCondition | string)[])[], ignoreFirstPath: boolean): boolean {

        if (where.length > 1) { // compound where statements

            let prevCondition: string = "AND";
            let matches = true;
            let idx = 0;
            while (idx < where.length) {
                const wArg = where[idx];
                if (idx % 2 === 1) {
                    prevCondition = wArg as string;
                } else {

                    let compareResult = false;

                    if (Array.isArray(wArg[0])) { // nested where
                        compareResult = this._where(singleRow, wArg as any, ignoreFirstPath || false);
                    } else {
                        compareResult = this._compare(wArg as WhereCondition, singleRow, ignoreFirstPath || false);
                    }

                    if (idx === 0) {
                        matches = compareResult;
                    } else {
                        if (prevCondition === "AND") {
                            matches = matches && compareResult;
                        } else {
                            matches = matches || compareResult;
                        }
                    }
                }
            }
            return matches;

        } else { // single where statement
            return this._compare(where[0] as WhereCondition, singleRow, ignoreFirstPath || false);
        }
    }

    public static likeCache: { [likeQuery: string]: RegExp } = {};

    private _processLIKE(columnValue: string, givenValue: string): boolean {
        if (!_NanoSQLQuery.likeCache[givenValue]) {
            let prevChar = "";
            _NanoSQLQuery.likeCache[givenValue] = new RegExp(givenValue.split("").map(s => {
                if (prevChar === "\\") {
                    prevChar = s;
                    return s;
                }
                prevChar = s;
                if (s === "%") return ".*";
                if (s === "_") return ".";
                return s;
            }).join(""), "gmi");
        }
        if (typeof columnValue !== "string") {
            if (typeof columnValue === "number") {
                return String(columnValue).match(_NanoSQLQuery.likeCache[givenValue]) !== null;
            } else {
                return JSON.stringify(columnValue).match(_NanoSQLQuery.likeCache[givenValue]) !== null;
            }
        }
        return columnValue.match(_NanoSQLQuery.likeCache[givenValue]) !== null;
    }

    private _getColValue(where: WhereCondition, wholeRow: any, isJoin: boolean): any {
        if (where.fnName) {
            return this.nSQL.functions[where.fnName].call(this.query, wholeRow, isJoin, this.nSQL.functions[where.fnName].aggregateStart || { result: undefined }, ...(where.fnArgs || []));
        } else {
            return objQuery(where.col as string, wholeRow, isJoin);
        }
    }

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
    private _compare(where: WhereCondition, wholeRow: any, isJoin: boolean): boolean {


        const columnValue = this._getColValue(where, wholeRow, isJoin);
        const givenValue = where.value as any;
        const compare = where.comp;

        if (givenValue === "NULL" || givenValue === "NOT NULL") {
            const isNull = [undefined, null, ""].indexOf(columnValue) !== -1;
            const isEqual = compare === "=" || compare === "LIKE";
            switch (givenValue) {
                case "NULL": return isEqual ? isNull : !isNull;
                case "NOT NULL": return isEqual ? !isNull : isNull;
            }
        }

        if (["IN", "NOT IN", "BETWEEN", "INTERSECT", "INTERSECT ALL", "NOT INTERSECT"].indexOf(compare) !== -1) {
            if (!Array.isArray(givenValue)) {
                this.query.state = "error";
                this.query.error(`WHERE "${compare}" comparison requires an array value!`);
                return false;
            }
        }


        switch (compare) {
            // if column equal to given value. Supports arrays, objects and primitives
            case "=": return compareObjects(givenValue, columnValue);
            // if column not equal to given value. Supports arrays, objects and primitives
            case "!=": return !compareObjects(givenValue, columnValue);
            // if column greather than given value
            case ">": return columnValue > givenValue;
            // if column less than given value
            case "<": return columnValue < givenValue;
            // if column less than or equal to given value
            case "<=": return columnValue <= givenValue;
            // if column greater than or equal to given value
            case ">=": return columnValue >= givenValue;
            // if column value exists in given array
            case "IN": return givenValue.indexOf(columnValue) !== -1;
            // if column does not exist in given array
            case "NOT IN": return givenValue.indexOf(columnValue) === -1;
            // regexp search the column
            case "REGEXP":
            case "REGEX": return (columnValue || "").match(givenValue) !== null;
            // if given value exists in column value
            case "LIKE": return this._processLIKE((columnValue || ""), givenValue);
            // if given value does not exist in column value
            case "NOT LIKE": return !this._processLIKE((columnValue || ""), givenValue);
            // if the column value is between two given numbers
            case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] > columnValue;
            // if single value exists in array column
            case "INCLUDES": return (columnValue || []).indexOf(givenValue) !== -1;
            // if single value does not exist in array column
            case "NOT INCLUDES": return (columnValue || []).indexOf(givenValue) === -1;
            // if array of values intersects with array column
            case "INTERSECT": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length > 0;
            // if every value in the provided array exists in the array column
            case "INTERSECT ALL": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length === givenValue.length;
            // if array of values does not intersect with array column
            case "NOT INTERSECT": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length === 0;
            default: return false;
        }
    }


    public static _sortMemoized: {
        [key: string]: NanoSQLSortBy;
    };

    private _parseSort(sort: string[], checkforIndexes: boolean): NanoSQLSortBy {
        const key = sort && sort.length ? hash(JSON.stringify(sort)) : "";
        if (!key) return { sort: [], index: "" };
        if (_NanoSQLQuery._sortMemoized[key]) return _NanoSQLQuery._sortMemoized[key];

        const result: { path: string[], dir: string }[] = sort.map(o => o.split(" ").map(s => s.trim())).reduce((p, c) => { return p.push({ path: resolveObjPath(c[0]), dir: (c[1] || "asc").toUpperCase() }), p; }, [] as any[]);

        let index = "";
        if (checkforIndexes && result.length === 1) {
            const pkKey: string = typeof this.query.table === "string" ? this.nSQL.tables[this.query.table].pkCol : "";
            if (result[0].path[0].length && result[0].path[0] === pkKey) {
                index = "_pk_";
            } else {
                const indexKeys = Object.keys(this.nSQL.tables[this.query.table as string].indexes);
                let i = indexKeys.length;
                while (i-- && !index) {
                    if (compareObjects(this.nSQL.tables[this.query.table as string].indexes[indexKeys[i]], result[0].path)) {
                        index = this.nSQL.tables[this.query.table as string].indexes[indexKeys[i]].name;
                    }
                }
            }
        }
        _NanoSQLQuery._sortMemoized[key] = {
            sort: result,
            index: index
        };
        return _NanoSQLQuery._sortMemoized[key];
    }

    public static _selectArgsMemoized: {
        [key: string]: {
            hasAggrFn: boolean;
            args: SelectArgs[]
        }
    } = {};

    private _parseSelect() {
        const selectArgsKey = this.query.actionArgs && this.query.actionArgs.length ? JSON.stringify(this.query.actionArgs) : "";

        let hasAggrFn = false;

        this._orderBy = this._parseSort(this.query.orderBy || [], typeof this.query.table === "string");
        this._groupBy = this._parseSort(this.query.groupBy || [], false);

        if (selectArgsKey) {
            if (_NanoSQLQuery._selectArgsMemoized[selectArgsKey]) {
                hasAggrFn = _NanoSQLQuery._selectArgsMemoized[selectArgsKey].hasAggrFn;
                this._selectArgs = _NanoSQLQuery._selectArgsMemoized[selectArgsKey].args;
            } else {
                (this.query.actionArgs || []).forEach((val: string) => {
                    const splitVal = val.split(/\s+as\s+/i).map(s => s.trim());
                    if (splitVal[0].indexOf("(") !== -1) {
                        const fnArgs = splitVal[0].split("(")[1].replace(")", "").split(",").map(v => v.trim());
                        const fnName = splitVal[0].split("(")[0].trim().toUpperCase();
                        this._selectArgs.push({ isFn: true, value: fnName, as: splitVal[1], args: fnArgs });
                        if (!this.nSQL.functions[fnName]) {
                            this.query.state = "error";
                            this.error(`Function "${fnName}" not found!`);
                        } else {
                            if (this.nSQL.functions[fnName].type === "A") {
                                hasAggrFn = true;
                            }
                        }
                    } else {
                        this._selectArgs.push({ isFn: false, value: splitVal[0], as: splitVal[1] });
                    }
                });
                if (this.query.state !== "error") {
                    _NanoSQLQuery._selectArgsMemoized[selectArgsKey] = { hasAggrFn: hasAggrFn, args: this._selectArgs };
                }
            }

        } else {
            this._selectArgs = [];
        }

        let canUseOrderByIndex: boolean = false;
        if (this._whereArgs.type === WhereType.none) {
            canUseOrderByIndex = this._orderBy.index === "_pk_";
            if (canUseOrderByIndex) {
                this._pkOrderBy = true;
            }
        } else {
            canUseOrderByIndex = this._orderBy.index.length && this._whereArgs.fastWhere && compareObjects((this._whereArgs.fastWhere[0] as WhereCondition).col, this._orderBy.sort[0].path) ? true : false;
            if (canUseOrderByIndex) {
                this._idxOrderBy = true;
            }
        }

        if ((this._orderBy.sort.length && !canUseOrderByIndex) || this._groupBy.sort.length || hasAggrFn) {
            this._stream = false;
        }
    }

    public static _whereMemoized: {
        [key: string]: WhereArgs;
    };

    private _parseWhere(qWhere: any[] | ((row: { [key: string]: any }) => boolean), ignoreIndexes?: boolean): WhereArgs {
        const where = qWhere || [];
        const key = JSON.stringify(where) + (ignoreIndexes ? "0" : "1");

        if (_NanoSQLQuery._whereMemoized[key]) {
            return _NanoSQLQuery._whereMemoized[key];
        }

        if (typeof where === "function") {
            return { type: WhereType.fn, whereFn: where };
        } else if (!where.length) {
            _NanoSQLQuery._whereMemoized[key] = { type: WhereType.none };
            return _NanoSQLQuery._whereMemoized[key];
        }

        const indexes: NanoSQLIndex[] = typeof this.query.table === "string" ? Object.keys(this.nSQL.tables[this.query.table].indexes).map(k => this.nSQL.tables[this.query.table as string].indexes[k]) : [];
        const pkKey: string = typeof this.query.table === "string" ? this.nSQL.tables[this.query.table].pkCol : "";

        // find indexes and functions
        const recursiveParse = (ww: any[], level: number): (WhereCondition | string)[] => {

            const doIndex = !ignoreIndexes && level === 0;
            return ww.reduce((p, w, i) => {
                if (i % 2 === 1) { // AND or OR
                    if (typeof w !== "string") {
                        this.query.state = "error";
                        this.error("Malformed WHERE statement!");
                        return p;
                    }
                    p.push(w);
                    return p;
                } else { // where conditions

                    if (!Array.isArray(w)) {
                        this.query.state = "error";
                        this.error("Malformed WHERE statement!");
                        return p;
                    }
                    if (Array.isArray(w[0])) { // nested array
                        p.push(recursiveParse(w, level + 1));
                    } else if (w[0].indexOf("(") !== -1) { // function

                        const fnArgs: string[] = w[0].split("(")[1].replace(")", "").split(",").map(v => v.trim()).filter(a => a);
                        const fnName: string = w[0].split("(")[0].trim().toUpperCase();
                        let hasIndex = false;
                        if (!this.nSQL.functions[fnName]) {
                            this.query.state = "error";
                            this.error(`Function "${fnName}" not found!`);
                            return p;
                        }
                        if (doIndex && this.nSQL.functions[fnName] && this.nSQL.functions[fnName].whereIndex) {
                            const indexFn = (this.nSQL.functions[fnName].whereIndex as any)(this.nSQL, this.query, fnArgs, w);
                            if (indexFn) {
                                hasIndex = true;
                                p.push(indexFn);
                            }
                        }

                        if (!hasIndex) {
                            p.push({
                                fnName: fnName,
                                fnArgs: fnArgs,
                                comp: w[1],
                                value: w[2]
                            });
                        }

                    } else { // column select
                        let isIndexCol = false;

                        if (["=", "BETWEEN", "IN"].indexOf(w[1]) && doIndex) {
                            // primary key select
                            if (w[0] === pkKey) {
                                isIndexCol = true;
                                p.push({
                                    index: "_pk_",
                                    col: w[0],
                                    comp: w[1],
                                    value: w[2]
                                });
                            } else { // check if we can use any index
                                const path = resolveObjPath(w[0]);
                                indexes.forEach((index) => {
                                    if (compareObjects(index.path, path)) {
                                        isIndexCol = true;
                                        p.push({
                                            index: index.name,
                                            col: w[0],
                                            comp: w[1],
                                            value: w[2]
                                        });
                                    }
                                });
                            }
                        }

                        if (!isIndexCol) {
                            p.push({
                                col: w[0],
                                comp: w[1],
                                value: w[2]
                            });
                        }
                        return p;
                    }
                }
            }, [] as any[]);
        };
        let parsedWhere = recursiveParse(typeof where[0] === "string" ? [where] : where, 0);


        // discover where we have indexes we can use
        // the rest is a full table scan OR a scan of the index results
        // fastWhere = index query, slowWhere = row by row/full table scan
        let isIndex = true;
        let count = 0;
        let lastFastIndx = -1;
        while (count < parsedWhere.length && isIndex) {
            if (count % 2 === 1) {
                if (parsedWhere[count] !== "AND") {
                    isIndex = false;
                    lastFastIndx = count;
                }
            } else {
                if (Array.isArray((parsedWhere[count] as any)) || !(parsedWhere[count] as any).index) {
                    isIndex = false;
                    lastFastIndx = count;
                }
            }
            count++;
        }

        // make sure lastFastIndx lands on an AND, OR or gets pushed off the end.
        if (lastFastIndx % 2 === 0) {
            lastFastIndx++;
        }
        // has at least some index values
        // "AND" or the end of the WHERE should follow the last index to use the indexes
        if (lastFastIndx !== -1 && (parsedWhere[lastFastIndx] === "AND" || !parsedWhere[lastFastIndx])) {
            const slowWhere = parsedWhere.slice(lastFastIndx + 1);
            _NanoSQLQuery._whereMemoized[key] = {
                type: slowWhere.length ? WhereType.medium : WhereType.fast,
                slowWhere: slowWhere,
                fastWhere: parsedWhere.slice(0, lastFastIndx)
            };
        } else {
            _NanoSQLQuery._whereMemoized[key] = {
                type: WhereType.slow,
                slowWhere: parsedWhere
            };
        }
        return _NanoSQLQuery._whereMemoized[key];
    }
}