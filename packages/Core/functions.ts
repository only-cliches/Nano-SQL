import { NanoSQLInstance } from ".";
import { crowDistance, objQuery, cast } from "./utilities";

export const attachDefaultFns = (nSQL: NanoSQLInstance) => {
    nSQL.whereFunctions = {
        crow: (row: any, isJoin: boolean, lat: number, lon: number, latColumn?: string, lonColumn?: string) => {
            const latCol = latColumn || "lat";
            const lonCol = lonColumn || "lon";
            const latVal = objQuery(latCol, row, isJoin);
            const lonVal = objQuery(lonCol, row, isJoin);
            return crowDistance(latVal, lonVal, lat, lon, nSQL.earthRadius);
        },
        sum: (row: any, isJoin: boolean, ...columns: string[]) => {
            return columns.reduce((prev, cur) => {
                const val = objQuery(cur, row, isJoin) || 0;
                if (Array.isArray(val)) {
                    return prev + val.reduce((p, c) => p + parseFloat(c || 0), 0);
                }
                return prev + parseFloat(val);
            }, 0);
        },
        avg: (row: any, isJoin: boolean, ...columns: string[]) => {
            let numRecords = 0;
            const total = columns.reduce((prev, cur) => {
                const val = objQuery(cur, row, isJoin) || 0;
                if (Array.isArray(val)) {
                    numRecords += val.length;
                    return prev + val.reduce((p, c) => p + parseFloat(c || 0), 0);
                }
                numRecords++;
                return prev + parseFloat(val);
            }, 0);
            return total / numRecords;
        }
    };


    nSQL.functions = {
        COUNT: {
            type: "A",
            aggregateStart: {result: 0, row: {}},
            call: (row, complete, isJoin, prev, column) => {
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
            call: (row, complete, isJoin, prev, column) => {
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
            call: (row, complete, isJoin, prev, column) => {
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
        AVG: {
            type: "A",
            aggregateStart: {result: 0, row: {}, total: 0, records: 0},
            call: (row, complete, isJoin, prev, column) => {
                const value = parseFloat(objQuery(column, row, isJoin)) || 0;
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
            call: (row, complete, isJoin, prev, column) => {
                const value = parseFloat(objQuery(column, row, isJoin)) || 0;
                prev.result += isNaN(value) ? 0 : value;
                prev.row = row;
                complete(prev);
            }
        },
        LOWER: {
            type: "S",
            call: (row, complete, isJoin, prev, column) => {
                const value = String(objQuery(column, row, isJoin)).toLowerCase();
                complete({result: value});
            }
        },
        UPPER: {
            type: "S",
            call: (row, complete, isJoin, prev, column) => {
                const value = String(objQuery(column, row, isJoin)).toUpperCase();
                complete({result: value});
            }
        },
        CAST: {
            type: "S",
            call: (row, complete, isJoin, prev, column, type) => {
                const value = cast(type, objQuery(column, row, isJoin));
                complete({result: value});
            }
        },
        ABS: {
            type: "S",
            call: (row, complete, isJoin, prev, column) => {
                const value = parseFloat(objQuery(column, row, isJoin)) || 0;
                complete({result: Math.abs(value)});
            }
        },
        CEIL: {
            type: "S",
            call: (row, complete, isJoin, prev, column) => {
                const value = parseFloat(objQuery(column, row, isJoin)) || 0;
                complete({result: Math.ceil(value)});
            }
        },
        POW: {
            type: "S",
            call: (row, complete, isJoin, prev, column, power) => {
                const value = parseFloat(objQuery(column, row, isJoin)) || 0;
                complete({result: Math.pow(value, parseInt(power))});
            }
        },
        ROUND: {
            type: "S",
            call: (row, complete, isJoin, prev, column) => {
                const value = parseFloat(objQuery(column, row, isJoin)) || 0;
                complete({result: Math.round(value)});
            }
        },
        SQRT: {
            type: "S",
            call: (row, complete, isJoin, prev, column) => {
                const value = parseFloat(objQuery(column, row, isJoin)) || 0;
                complete({result: Math.sqrt(value)});
            }
        }
    };
};