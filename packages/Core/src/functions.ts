import { crowDistance, deepGet, cast, resolveObjPath, compareObjects, getFnValue } from "./utilities";
import { INanoSQLQuery, INanoSQLIndex, IWhereCondition, INanoSQLInstance } from "./interfaces";
import * as levenshtein from "levenshtein-edit-distance";

const wordLevenshtienCache: { [words: string]: number } = {};

export const attachDefaultFns = (nSQL: INanoSQLInstance) => {

    nSQL.functions = {
        COUNT: {
            type: "A",
            aggregateStart: {result: 0, row: {}},
            call: (query, row, isJoin, prev, column) => {
                if (column && column !== "*") {
                    if (deepGet(column, row, isJoin)) {
                        prev.result++;
                    }
                } else {
                    prev.result++;
                }
                prev.row = row;
                return prev;
            }
        },
        MAX: {
            type: "A",
            aggregateStart: {result: undefined, row: {}},
            call: (query, row, isJoin, prev, column) => {
                let max = deepGet(column, row, isJoin) || 0;
                if (typeof prev.result === "undefined") {
                    prev.result = max;
                    prev.row = row;
                } else {
                    if (max > prev.result) {
                        prev.result = max;
                        prev.row = row;
                    }
                }
                return prev;
            }
        },
        MIN: {
            type: "A",
            aggregateStart: {result: undefined, row: {}},
            call: (query, row, isJoin, prev, column) => {
                let min = deepGet(column, row, isJoin) || 0;
                if (typeof prev.result === "undefined") {
                    prev.result = min;
                    prev.row = row;
                } else {
                    if (min < prev.result) {
                        prev.result = min;
                        prev.row = row;
                    }
                }
                return prev;
            }
        },
        GREATEST: {
            type: "S",
            call: (query, row, isJoin, prev, ...values: string[]) => {
                const args = values.map(s => isNaN(s as any) ? getFnValue(row, s, isJoin) : parseFloat(s)).sort((a, b) => a < b ? 1 : -1);
                return {result: args[0]};
            }
        },
        LEAST: {
            type: "S",
            call: (query, row, isJoin, prev, ...values: string[]) => {
                const args = values.map(s => isNaN(s as any) ? getFnValue(row, s, isJoin) : parseFloat(s)).sort((a, b) => a > b ? 1 : -1);
                return {result: args[0]};
            }
        },
        AVG: {
            type: "A",
            aggregateStart: {result: 0, row: {}, total: 0, records: 0},
            call: (query, row, isJoin, prev, column) => {
                const value = parseFloat(deepGet(column, row, isJoin) || 0) || 0;
                prev.total += isNaN(value) ? 0 : value;
                prev.records++;
                prev.result = prev.total / prev.records;
                prev.row = row;
                return prev;
            }
        },
        SUM: {
            type: "A",
            aggregateStart: {result: 0, row: {}},
            call: (query, row, isJoin, prev, column) => {
                const value = parseFloat(deepGet(column, row, isJoin) || 0) || 0;
                prev.result += isNaN(value) ? 0 : value;
                prev.row = row;
                return prev;
            }
        },
        LOWER: {
            type: "S",
            call: (query, row, isJoin, prev, column) => {
                const value = String(getFnValue(row, column, isJoin)).toLowerCase();
                return {result: value};
            }
        },
        UPPER: {
            type: "S",
            call: (query, row, isJoin, prev, column) => {
                const value = String(getFnValue(row, column, isJoin)).toUpperCase();
                return {result: value};
            }
        },
        CAST: {
            type: "S",
            call: (query, row, isJoin, prev, column, type) => {
                return {result: cast(type, deepGet(column, row, isJoin))};
            }
        },
        CONCAT: {
            type: "S",
            call: (query, row, isJoin, prev, ...values: string[]) => {
                return {result: values.map(v => {
                    return getFnValue(row, v, isJoin);
                }).join("")};
            }
        },
        LEVENSHTEIN: {
            type: "S",
            call: (query, row, isJoin, prev, word1, word2) => {
                const w1 = getFnValue(row, word1, isJoin);
                const w2 = getFnValue(row, word2, isJoin);
                const key = w1 + "::" + w2;
                if (!wordLevenshtienCache[key]) {
                    wordLevenshtienCache[key] = levenshtein(w1, w2);
                }
                return {result: wordLevenshtienCache[key]};
            }
        },
        CROW: {
            type: "S",
            call: (query, row, isJoin, prev, gpsCol: string, lat: string, lon: string) => {
                const latVal = deepGet(gpsCol + ".lat", row, isJoin);
                const lonVal = deepGet(gpsCol + ".lon", row, isJoin);
                return {result: crowDistance(latVal, lonVal, parseFloat(lat), parseFloat(lon), nSQL.earthRadius)};
            },
            whereIndex: (nSQL, query, fnArgs, where) => {
                if (where[1] === ">" || where[1] === ">=") {
                    const indexes: {[name: string]: INanoSQLIndex} = typeof query.table === "string" ? nSQL.tables[query.table].indexes : {};
                    const crowColumn = resolveObjPath(fnArgs[0]);
                    let crowCols: string[] = [];
                    Object.keys(indexes).forEach((k) => {
                        const index = indexes[k];
                        if (compareObjects(index.path.slice(0, index.path.length - 1), crowColumn)) {
                            crowCols.push(index.name.replace("-lat", "").replace("-lon", ""));
                        }
                    });
                    if (crowCols.length === 2) {
                        return {
                            index: crowCols[0],
                            fnName: "CROW",
                            fnArgs: fnArgs,
                            comp: where[1],
                            value: where[2]
                        };
                    }
                }
                return false;
            },
            queryIndex: (nSQL: any, query: INanoSQLQuery, where: IWhereCondition, onlyPKs: boolean, onRow: (row, i) => void, complete: () => void) => {

            }
        }
    };

    Object.getOwnPropertyNames(Math).forEach((key) => {
        nSQL.functions[key.toUpperCase()] = {
            type: "S",
            call: (query, row, isJoin, prev, ...args: string[]) => {
                const fnArgs = args.map(a => parseFloat(isNaN(a as any) ? deepGet(a, row, isJoin) : a));
                return {result: Math[key].apply(null, fnArgs)};
            }
        };
    });
};

