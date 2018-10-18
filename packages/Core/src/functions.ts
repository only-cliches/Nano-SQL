import { NanoSQLInstance } from ".";
import { crowDistance, objQuery, cast, resolveObjPath, compareObjects } from "./utilities";
import { NanoSQLQuery, NanoSQLIndex } from "./interfaces";
import * as levenshtein from "levenshtein-edit-distance";

const wordLevenshtienCache: { [words: string]: number } = {};

export const attachDefaultFns = (nSQL: NanoSQLInstance) => {

    nSQL.functions = {
        COUNT: {
            type: "A",
            aggregateStart: {result: 0, row: {}},
            call: (query, row, isJoin, prev, column) => {
                if (column && column !== "*") {
                    if (objQuery(column, row, isJoin)) {
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
                let max = objQuery(column, row, isJoin) || 0;
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
                let min = objQuery(column, row, isJoin) || 0;
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
                const args = values.map(s => isNaN(s as any) ? objQuery(s, row, isJoin) : parseFloat(s)).sort((a, b) => a < b ? 1 : -1);
                return {result: args[0]};
            }
        },
        LEAST: {
            type: "S",
            call: (query, row, isJoin, prev, ...values: string[]) => {
                const args = values.map(s => isNaN(s as any) ? objQuery(s, row, isJoin) : parseFloat(s)).sort((a, b) => a > b ? 1 : -1);
                return {result: args[0]};
            }
        },
        AVG: {
            type: "A",
            aggregateStart: {result: 0, row: {}, total: 0, records: 0},
            call: (query, row, isJoin, prev, column) => {
                const value = parseFloat(objQuery(column, row, isJoin) || 0) || 0;
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
                const value = parseFloat(objQuery(column, row, isJoin) || 0) || 0;
                prev.result += isNaN(value) ? 0 : value;
                prev.row = row;
                return prev;
            }
        },
        LOWER: {
            type: "S",
            call: (query, row, isJoin, prev, column) => {
                const value = String(objQuery(column, row, isJoin)).toLowerCase();
                return {result: value};
            }
        },
        UPPER: {
            type: "S",
            call: (query, row, isJoin, prev, column) => {
                const value = String(objQuery(column, row, isJoin)).toUpperCase();
                return {result: value};
            }
        },
        CAST: {
            type: "S",
            call: (query, row, isJoin, prev, column, type) => {
                return {result: cast(type, objQuery(column, row, isJoin))};
            }
        },
        LEVENSHTEIN: {
            type: "S",
            call: (query, row, isJoin, prev, word, column) => {
                const val = String(objQuery(column, row, isJoin) || "");
                const key = val + "::" + word;
                if (!wordLevenshtienCache[key]) {
                    wordLevenshtienCache[key] = levenshtein(val, word);
                }
                return {result: wordLevenshtienCache[key]};
            }
        },
        CROW: {
            type: "S",
            call: (query, row, isJoin, prev, gpsCol: string, lat: string, lon: string) => {
                const latVal = objQuery(gpsCol + ".lat", row, isJoin);
                const lonVal = objQuery(gpsCol + ".lon", row, isJoin);
                return {result: crowDistance(latVal, lonVal, parseFloat(lat), parseFloat(lon), nSQL.earthRadius)};
            },
            whereIndex: (nSQL, query, fnArgs, where) => {
                if (where[1] === "<" || where[1] === "<=") {
                    const indexes: {[name: string]: NanoSQLIndex} = typeof query.table === "string" ? nSQL.tables[query.table].indexes : {};
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
            queryIndex: (query, where) => {
                return new Promise((res, rej) => res([]));
            }
        }
    };

    Object.getOwnPropertyNames(Math).forEach((key) => {
        nSQL.functions[key.toUpperCase()] = {
            type: "S",
            call: (query, row, isJoin, prev, ...args: string[]) => {
                const fnArgs = args.map(a => parseFloat(isNaN(a as any) ? objQuery(a, row, isJoin) : a));
                return {result: Math[key].apply(null, fnArgs)};
            }
        };
    });
};

