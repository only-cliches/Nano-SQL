import { NanoSQLInstance } from ".";
import { crowDistance, objQuery, cast } from "./utilities";
import { NanoSQLQuery } from "./interfaces";
import * as levenshtein from "levenshtein-edit-distance";

const wordLevenshtienCache: { [words: string]: number } = {};

export const attachDefaultFns = (nSQL: NanoSQLInstance) => {

    nSQL.functions = {
        COUNT: {
            type: "A",
            aggregateStart: {result: 0, row: {}},
            call: (query, row, complete, isJoin, prev, column) => {
                if (column && column !== "*") {
                    if (objQuery(column, row, isJoin)) {
                        prev.result++;
                    }
                } else {
                    prev.result++;
                }
                prev.row = row;
                complete(prev);
            }
        },
        MAX: {
            type: "A",
            aggregateStart: {result: undefined, row: {}},
            call: (query, row, complete, isJoin, prev, column) => {
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
                complete(prev);
            }
        },
        MIN: {
            type: "A",
            aggregateStart: {result: undefined, row: {}},
            call: (query, row, complete, isJoin, prev, column) => {
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
                complete(prev);
            }
        },
        GREATEST: {
            type: "S",
            call: (query, row, complete, isJoin, prev, ...values: string[]) => {
                const args = values.map(s => isNaN(s as any) ? s : parseFloat(s)).sort((a, b) => a < b ? 1 : -1);
                complete({result: args[0]});
            }
        },
        LEAST: {
            type: "S",
            call: (query, row, complete, isJoin, prev, ...values: string[]) => {
                const args = values.map(s => isNaN(s as any) ? s : parseFloat(s)).sort((a, b) => a > b ? 1 : -1);
                complete({result: args[0]});
            }
        },
        AVG: {
            type: "A",
            aggregateStart: {result: 0, row: {}, total: 0, records: 0},
            call: (query, row, complete, isJoin, prev, column) => {
                const value = parseFloat(objQuery(column, row, isJoin) || 0) || 0;
                prev.total += isNaN(value) ? 0 : value;
                prev.records++;
                prev.result = prev.total / prev.records;
                prev.row = row;
                complete(prev);
            }
        },
        SUM: {
            type: "A",
            aggregateStart: {result: 0, row: {}},
            call: (query, row, complete, isJoin, prev, column) => {
                const value = parseFloat(objQuery(column, row, isJoin) || 0) || 0;
                prev.result += isNaN(value) ? 0 : value;
                prev.row = row;
                complete(prev);
            }
        },
        LOWER: {
            type: "S",
            call: (query, row, complete, isJoin, prev, column) => {
                const value = String(objQuery(column, row, isJoin)).toLowerCase();
                complete({result: value});
            }
        },
        UPPER: {
            type: "S",
            call: (query, row, complete, isJoin, prev, column) => {
                const value = String(objQuery(column, row, isJoin)).toUpperCase();
                complete({result: value});
            }
        },
        CAST: {
            type: "S",
            call: (query, row, complete, isJoin, prev, column, type) => {
                complete({result: cast(type, objQuery(column, row, isJoin))});
            }
        },
        LEVENSHTEIN: {
            type: "S",
            call: (query, row, complete, isJoin, prev, word, column) => {
                const val = String(objQuery(column, row, isJoin) || "");
                const key = val + "::" + word;
                if (!wordLevenshtienCache[key]) {
                    wordLevenshtienCache[key] = levenshtein(val, word);
                }
                complete({result: wordLevenshtienCache[key]});
            }
        },
        CROW: {
            type: "S",
            call: (query, row, complete, isJoin, prev, gpsCol: string, lat: string, lon: string) => {
                const latVal = objQuery(gpsCol + ".lat", row, isJoin);
                const lonVal = objQuery(gpsCol + ".lon", row, isJoin);
                complete({result: crowDistance(latVal, lonVal, parseFloat(lat), parseFloat(lon), nSQL.earthRadius)});
            }
        }
    };

    Object.getOwnPropertyNames(Math).forEach((key) => {
        nSQL.functions[key.toUpperCase()] = {
            type: "S",
            call: (query, row, complete, isJoin, prev, ...args: string[]) => {
                const fnArgs = args.map(a => parseFloat(isNaN(a as any) ? objQuery(a, row, isJoin) : a));
                complete({result: Math[key].apply(null, fnArgs)});
            }
        };
    });
};

