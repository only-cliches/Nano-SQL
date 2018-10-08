import { NanoSQLInstance } from ".";
import { NanoSQLQuery } from "./interfaces";
import { objSort } from "./utilities";

interface SelectArgs {
    isFn: boolean;
    value: string;
    as?: string;
    args?: string[];
}

enum WhereType {
    fast, // primary key or secondary index on all WHERE statements using nothing but AND with single dimensional WHERE
    medium, // fast query followed by AND with slow query (lets us grab optimized rows, then full table scan the optimized rows)
    slow, // full table scan
    fn, // full table scan with function
    none // no where, return all rows
}

interface WhereArgs {
    type: WhereType;
    whereFn?: (row: { [name: string]: any }, index: number) => boolean;
    fastWhere?: any[];
    slowWhere?: any[];
}

// tslint:disable-next-line
export class _NanoSQLQuery {

    private _buffer: any[] = [];
    private _stream: boolean = true;
    private _selectArgs: SelectArgs[] = [];
    private _whereArgs: WhereArgs;
    private _havingArgs: WhereArgs;

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
            case "drop":
                this._drop();
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
        this._organizeSelectArgs();
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where, typeof this.query.table !== "string") : { type: WhereType.none };
        this._havingArgs = this.query.having ? this._parseWhere(this.query.having, true) : { type: WhereType.none };
        if (this.query.state === "error") return;
        // Query order:
        // 1. Join / Index / Where Select
        // 2. Group By & Functions
        // 3. Apply AS
        // 4. Having
        // 5. OrderBy
        // 6. Offset
        // 7. Limit
    }

    private _upsert() {
        this._whereArgs = this.query.where ? this._parseWhere(this.query.where) : { type: WhereType.none };
        if (!this.query.actionArgs) {
            this.error("Can't upsert without records!");
            this.query.state = "error";
        }
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
            this._drop();
        } else { // find records and delete them

        }
    }

    private _drop() {

    }

    private _showTables() {

    }

    private _describe() {

    }

    private _getRecords(onRow: (row: { [name: string]: any }) => void, complete: () => void, error: (err: string) => void) {
        if (typeof this.query.table === "string") { // pull from local table

        } else if (typeof this.query.table === "function") { // promise that returns array
            this.query.table().then((rows) => {
                rows.forEach((row) => {
                    onRow(row);
                });
                complete();
            }).catch((err) => {
                this.error(err);
            });
        } else if (Array.isArray(this.query.table)) { // array
            this.query.table.forEach((row) => {
                onRow(row);
            });
            complete();
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
    private _where(singleRow: any, where: any[], rowIDX: number, ignoreFirstPath?: boolean, searchCache?: any[], pk?: any): boolean {

        if (typeof where[0] !== "string") { // compound where statements

            let decided: boolean;
            let prevCondition: string;

            return where.reduce((prev, wArg, idx) => {

                if (decided !== undefined) return decided;

                if (idx % 2 === 1) {
                    prevCondition = wArg;
                    return prev;
                }

                let compareResult: boolean = false;
                if (wArg[0].indexOf("search(") === 0 && searchCache) {
                    compareResult = searchCache[idx].indexOf(singleRow[pk]) !== -1;
                } else if (Array.isArray(wArg[0])) {
                    compareResult = _where(singleRow, wArg, rowIDX, ignoreFirstPath || false, searchCache, pk);
                } else {
                    compareResult = _compare(wArg, singleRow, ignoreFirstPath || false);
                }

                // if all conditions are "AND" we can stop checking on the first false result
                if (!hasOr && compareResult === false) {
                    decided = false;
                    return decided;
                }

                if (idx === 0) return compareResult;

                if (prevCondition === "AND") {
                    return prev && compareResult;
                } else {
                    return prev || compareResult;
                }
            }, false);
        } else { // single where statement
            return this._compare(where, singleRow, ignoreFirstPath || false);
        }
    }

    public static likeCache: { [likeQuery: string]: RegExp } = {};
    public static whereFuncCache: { [value: string]: string[] } = {};


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
    private _compare(where: any[], wholeRow: any, isJoin: boolean): boolean {

        if (!whereFuncCache[where[0]]) {
            // "levenshtein(word, column)"" => ["levenshtein", "word", "column"]
            // "crow(-49, 29, lat_main, lon_main)" => ["crow", -49, 29, "lat_main", "lon_main"]
            // notAFunction => []
            whereFuncCache[where[0]] = where[0].indexOf("(") !== -1 ?
                where[0].replace(/(.*)\((.*)\)/gmi, "$1,$2").split(",").map(c => isNaN(c) ? c.trim() : parseFloat(c.trim()))
                : [];
        }

        const processLIKE = (columnValue: string, givenValue: string): boolean => {
            if (!likeCache[givenValue]) {
                let prevChar = "";
                likeCache[givenValue] = new RegExp(givenValue.split("").map(s => {
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
                    return String(columnValue).match(likeCache[givenValue]) !== null;
                } else {
                    return JSON.stringify(columnValue).match(likeCache[givenValue]) !== null;
                }
            }
            return columnValue.match(likeCache[givenValue]) !== null;
        };

        const givenValue = where[2];
        const compare = where[1];
        const columnValue = (() => {
            if (whereFuncCache[where[0]].length) {
                const whereFn = NanoSQLInstance.whereFunctions[whereFuncCache[where[0]][0]];
                if (whereFn) {
                    return whereFn.apply(null, [wholeRow, isJoin].concat(whereFuncCache[where[0]].slice(1)));
                }
                return undefined;
            } else {
                return objQuery(where[0], wholeRow, isJoin);
            }
        })();

        if (givenValue === "NULL" || givenValue === "NOT NULL") {
            const isNull = [undefined, null, ""].indexOf(columnValue) !== -1;
            const isEqual = compare === "=" || compare === "LIKE";
            switch (givenValue) {
                case "NULL": return isEqual ? isNull : !isNull;
                case "NOT NULL": return isEqual ? !isNull : isNull;
            }
        }

        if (["IN", "BETWEEN", "INTERSECT", "INTERSECT ALL", "NOT INTERSECT"].indexOf(compare) !== -1) {
            if (!Array.isArray(givenValue)) {
                throw new Error(`nSQL: ${compare} requires an array value!`);
            }
        }

        switch (compare) {
            // if column equal to given value
            case "=": return columnValue === givenValue;
            // if column not equal to given value
            case "!=": return columnValue !== givenValue;
            // if column greather than given value
            case ">": return columnValue > givenValue;
            // if column less than given value
            case "<": return columnValue < givenValue;
            // if column less than or equal to given value
            case "<=": return columnValue <= givenValue;
            // if column greater than or equal to given value
            case ">=": return columnValue >= givenValue;
            // if column value exists in given array
            case "IN": return (givenValue || []).indexOf(columnValue) !== -1;
            // if column does not exist in given array
            case "NOT IN": return (givenValue || []).indexOf(columnValue) === -1;
            // regexp search the column
            case "REGEXP":
            case "REGEX": return (columnValue || "").match(givenValue) !== null;
            // if given value exists in column value
            case "LIKE": return processLIKE((columnValue || ""), givenValue);
            // if given value does not exist in column value
            case "NOT LIKE": return !processLIKE((columnValue || ""), givenValue);
            // if the column value is between two given numbers
            case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] >= columnValue;
            // if single value exists in array column
            case "HAVE":
            case "INCLUDES": return (columnValue || []).indexOf(givenValue) !== -1;
            // if single value does not exist in array column
            case "NOT HAVE":
            case "NOT INCLUDES": return (columnValue || []).indexOf(givenValue) === -1;
            // if array of values intersects with array column
            case "INTERSECT": return (columnValue || []).filter(l => (givenValue || []).indexOf(l) > -1).length > 0;
            // if every value in the provided array exists in the array column
            case "INTERSECT ALL": return (columnValue || []).filter(l => (givenValue || []).indexOf(l) > -1).length === givenValue.length;
            // if array of values does not intersect with array column
            case "NOT INTERSECT": return (columnValue || []).filter(l => (givenValue || []).indexOf(l) > -1).length === 0;
            default: return false;
        }
    }

    public static selectArgsMemoized: {
        [key: string]: {
            hasAggrFn: boolean;
            args: SelectArgs[]
        }
    } = {};

    private _organizeSelectArgs() {
        const selectArgsKey = this.query.actionArgs && this.query.actionArgs.length ? JSON.stringify(this.query.actionArgs) : "";

        let hasAggrFn = false;

        if (selectArgsKey) {
            if (_NanoSQLQuery.selectArgsMemoized[selectArgsKey]) {
                hasAggrFn = _NanoSQLQuery.selectArgsMemoized[selectArgsKey].hasAggrFn;
                this._selectArgs = _NanoSQLQuery.selectArgsMemoized[selectArgsKey].args;
            } else {
                (this.query.actionArgs || []).forEach((val: string) => {
                    const splitVal = val.split(/as/i).map(s => s.trim());
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
                    _NanoSQLQuery.selectArgsMemoized[selectArgsKey] = { hasAggrFn: hasAggrFn, args: this._selectArgs };
                }
            }

        } else {
            this._selectArgs = [];
        }


        if (this.query.orderBy || this.query.groupBy || this.query.join || hasAggrFn) {
            this._stream = false;
        }
    }

    public static _whereMemoized: {
        [key: string]: WhereArgs;
    };

    private _parseWhere(qWhere: any[] | ((row: { [key: string]: any }) => boolean), ignoreIndexes?: boolean): WhereArgs {
        const where = this.query.where || [];
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

        const indexes: { name: string, type: string, paths: string[] }[] = typeof this.query.table === "string" ? this.nSQL.tables[this.query.table].indexes : [];

        // find indexes and functions
        const recursiveParse = (ww: any[], level: number): any[] => {
            let skip = 0;
            const doIndex = level === 0 && !ignoreIndexes;
            return ww.reduce((p, w, i) => {
                if (skip) {
                    skip--;
                    return p;
                }
                if (i % 2 === 1) { // AND or OR
                    p.push(w);
                    return p;
                } else { // where conditions
                    if (Array.isArray(w[0])) { // nested array
                        p.push(recursiveParse(w, level + 1));
                    } else if (w[0].indexOf("(") !== -1) { // function

                        const fnArgs = w[0].split("(")[1].replace(")", "").split(",").map(v => v.trim());
                        const fnName = w[0].split("(")[0].trim().toUpperCase();
                        let hasIndex = false;
                        if (fnName === "CROW" && (w[1] === "<" || w[1] === "<=")) {
                            const crowColumn = fnArgs[0];
                            let crowCols: string[] = [];
                            indexes.forEach((index) => {
                                if (index.paths[0] === crowColumn + ".lat") {
                                    crowCols.push(index.name);
                                }
                                if (index.paths[0] === crowColumn + ".lon") {
                                    crowCols.push(index.name);
                                }
                            });
                            if (crowCols.length === 2 && doIndex) {
                                hasIndex = true;
                                p.push({
                                    index: crowCols[0],
                                    fnName: fnName,
                                    fnArgs: fnArgs,
                                    comp: w[1],
                                    value: w[2]
                                });
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
                        indexes.forEach((index) => {
                            const idx = index.paths.indexOf(w[0]);
                            if (idx !== -1 && doIndex) {
                                if (index.paths.length === 1) { // single column index
                                    if (["=", "BETWEEN", "IN"].indexOf(w[1]) !== -1) {
                                        isIndexCol = true;
                                        p.push({
                                            index: index.name,
                                            col: w[0],
                                            comp: w[1],
                                            value: w[2]
                                        });
                                    }
                                } else { // multiple column index
                                    // multiple column indexes are used when:
                                    // A. The multiple column values are next to eachother in a WHERE statement
                                    // B. There is an "AND" between each comparitor
                                    // C. Each comparitor is "="
                                    let columns: { [index: string]: string } = {};
                                    if (w[1] === "=") {
                                        columns[w[0]] = w[2];
                                        let validIndex = true;
                                        let remainingIndexs = index.paths.slice();
                                        remainingIndexs.splice(idx, 1);
                                        let pickIndexes = remainingIndexs.slice();
                                        let count = 1;
                                        while (count <= remainingIndexs.length && validIndex) {
                                            const nextIdx = i + count;
                                            const nextVal = ww[nextIdx];
                                            if (nextVal) {

                                                if (nextIdx % 2 === 1) {
                                                    if (nextVal !== "AND") {
                                                        validIndex = false;
                                                    }
                                                } else {
                                                    if (typeof nextVal[0] !== "string") {
                                                        validIndex = false;
                                                    } else {
                                                        const otherIndexes = pickIndexes.indexOf(nextVal[0]);
                                                        if (otherIndexes !== -1 && nextVal[1] === "=") {
                                                            pickIndexes.splice(otherIndexes, 1);
                                                            columns[nextVal[0]] = nextVal[2];
                                                        } else {
                                                            validIndex = false;
                                                        }
                                                    }
                                                }
                                            }
                                            count++;
                                        }
                                        if (pickIndexes.length === 0 && validIndex === true) {
                                            isIndexCol = true;
                                            skip = (index.paths.length * 2) - 2;
                                            p.push({
                                                index: index.name,
                                                col: Object.keys(columns),
                                                comp: "=",
                                                value: Object.keys(columns).map(c => columns[c])
                                            });
                                        }
                                    }
                                }
                            }
                        });
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
        const parsedWhere = recursiveParse(where, 0);

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
                if (!parsedWhere[count].index) {
                    isIndex = false;
                    lastFastIndx = count;
                }
            }
            count++;
        }
        if (lastFastIndx % 2 === 0) {
            lastFastIndx++;
        }
        // has at least some index values
        // AND or the end of the WHERE should follow the last index to use the indexes
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