import { crowDistance, deepGet, cast, resolvePath, doObjectsEqual, getFnValue, allAsync, _maybeAssign, NanoSQLBuffer, chainAsync } from "./utilities";
import { INanoSQLQuery, INanoSQLIndex, IWhereCondition, INanoSQLInstance } from "./interfaces";
import * as levenshtein from "levenshtein-edit-distance";

const wordLevenshtienCache: { [words: string]: number } = {};

export const attachDefaultFns = (nSQL: INanoSQLInstance) => {

    nSQL.functions = {
        COUNT: {
            type: "A",
            aggregateStart: {result: 0, row: {}},
            call: (query, row, prev, column) => {
                if (column && column !== "*") {
                    if (deepGet(column, row)) {
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
            call: (query, row, prev, column) => {
                let max = deepGet(column, row) || 0;
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
            call: (query, row, prev, column) => {
                let min = deepGet(column, row) || 0;
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
            call: (query, row, prev, ...values: string[]) => {
                const args = values.map(s => isNaN(s as any) ? getFnValue(row, s) : parseFloat(s)).sort((a, b) => a < b ? 1 : -1);
                return {result: args[0]};
            }
        },
        LEAST: {
            type: "S",
            call: (query, row, prev, ...values: string[]) => {
                const args = values.map(s => isNaN(s as any) ? getFnValue(row, s) : parseFloat(s)).sort((a, b) => a > b ? 1 : -1);
                return {result: args[0]};
            }
        },
        AVG: {
            type: "A",
            aggregateStart: {result: 0, row: {}, total: 0, records: 0},
            call: (query, row, prev, column) => {
                const value = parseFloat(deepGet(column, row) || 0) || 0;
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
            call: (query, row, prev, column) => {
                const value = parseFloat(deepGet(column, row) || 0) || 0;
                prev.result += isNaN(value) ? 0 : value;
                prev.row = row;
                return prev;
            }
        },
        LOWER: {
            type: "S",
            call: (query, row, prev, column) => {
                const value = String(getFnValue(row, column)).toLowerCase();
                return {result: value};
            }
        },
        UPPER: {
            type: "S",
            call: (query, row, prev, column) => {
                const value = String(getFnValue(row, column)).toUpperCase();
                return {result: value};
            }
        },
        CAST: {
            type: "S",
            call: (query, row, prev, column, type) => {
                return {result: cast(type, deepGet(column, row))};
            }
        },
        CONCAT: {
            type: "S",
            call: (query, row, prev, ...values: string[]) => {
                return {result: values.map(v => {
                    return getFnValue(row, v);
                }).join("")};
            }
        },
        LEVENSHTEIN: {
            type: "S",
            call: (query, row, prev, word1, word2) => {
                const w1 = getFnValue(row, word1);
                const w2 = getFnValue(row, word2);
                const key = w1 + "::" + w2;
                if (!wordLevenshtienCache[key]) {
                    wordLevenshtienCache[key] = levenshtein(w1, w2);
                }
                return {result: wordLevenshtienCache[key]};
            }
        },
        CROW: {
            type: "S",
            call: (query, row, prev, gpsCol: string, lat: string, lon: string) => {
                const latVal = deepGet(gpsCol + ".lat", row);
                const lonVal = deepGet(gpsCol + ".lon", row);
                return {result: crowDistance(latVal, lonVal, parseFloat(lat), parseFloat(lon), nSQL.earthRadius)};
            },
            whereIndex: (nSQL, query, fnArgs, where) => {
                if (where[1] === ">") {
                    const indexes: {[name: string]: INanoSQLIndex} = typeof query.table === "string" ? nSQL.tables[query.table].indexes : {};
                    const crowColumn = resolvePath(fnArgs[0]);
                    let crowCols: string[] = [];
                    Object.keys(indexes).forEach((k) => {
                        const index = indexes[k];
                        if (doObjectsEqual(index.path.slice(0, index.path.length - 1), crowColumn)) {
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
            queryIndex: (nSQL: INanoSQLInstance, query: INanoSQLQuery, where: IWhereCondition, onlyPKs: boolean, onRow: (row, i) => void, complete: () => void, error: (err) => void) => {
                const latTable = `_idx_${query.table as string}_${where.index}-lat`;
                const lonTable = `_idx_${query.table as string}_${where.index}-lon`;
    
                const distance = parseFloat(where.value || "0");
                const centerLat = parseFloat(where.fnArgs ? where.fnArgs[1] : "0");
                const centerLon = parseFloat(where.fnArgs ? where.fnArgs[2] : "0");
                
                // step 1: get a square that contains the radius circle for our search
                // get latitudes that are distance north and distance south from the search point
                const latRange = [-1, 1].map((i) => {
                    return centerLat + ((distance * i) / nSQL.earthRadius) * (180 * Math.PI);
                });
    
                // get the longitudes that are distance west and distance east from the search point
                const lonRange = [-1, 1].map((i) => {
                    return centerLon + ((distance * i) / nSQL.earthRadius) * (180 * Math.PI) / Math.cos(centerLat * Math.PI / 180);
                });

                let pks: {[id: string]: number} = {};
                allAsync([latTable, lonTable], (table, i, next, error) => {
                    const ranges = i === 0 ? latRange : lonRange;
                    nSQL.adapter.readMulti(table, "range", ranges[0], ranges[1], false, (row, i) => {
                        row.pks.forEach((pk) => {
                            pks[pk] = Math.max(i, pks[pk] ? pks[pk] : 0);
                        });
                    }, () => {
                        next(null);
                    }, error);
                }).then(() => {
                    // step 2: get the square shaped selection of items
                    let counter = 0;
                    const readPKS = Object.keys(pks).filter(p => pks[p] === 1);
                    const crowBuffer = new NanoSQLBuffer((item, i, done, err) => {
                        // perform crow distance calculation on square selected group
                        const rowLat = deepGet((where.fnArgs ? where.fnArgs[0] : "") + ".lat", item);
                        const rowLon = deepGet((where.fnArgs ? where.fnArgs[0] : "") + ".lon", item);
                        if (crowDistance(rowLat, rowLon, centerLat, centerLon, nSQL.earthRadius) < distance) {
                            onRow(onlyPKs ? item[nSQL.tables[query.table as string].pkCol] : item, counter);
                            counter++;
                        }
                        done();
                    }, error, complete);
                    allAsync(readPKS, (pk, i, next, err) => {
                        nSQL.adapter.read(query.table as string, pk, (row) => {
                            if (row) {
                                crowBuffer.newItem(row);
                            }
                            next(null);
                        }, error);
                    }).catch(error).then(() => {
                        crowBuffer.finished();
                    })
                }).catch(error);
            }
        }
    };

    Object.getOwnPropertyNames(Math).forEach((key) => {
        nSQL.functions[key.toUpperCase()] = {
            type: "S",
            call: (query, row, prev, ...args: string[]) => {
                const fnArgs = args.map(a => parseFloat(isNaN(a as any) ? deepGet(a, row) : a));
                return {result: Math[key].apply(null, fnArgs)};
            }
        };
    });
};

