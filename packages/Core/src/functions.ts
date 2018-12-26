import { crowDistance, deepGet, cast, resolvePath, _objectsEqual, getFnValue, allAsync, _maybeAssign, _NanoSQLQueue, chainAsync, adapterFilters, deg2rad, rad2deg } from "./utilities";
import { INanoSQLQuery, INanoSQLIndex, IWhereCondition, INanoSQLInstance } from "./interfaces";
import * as levenshtein from "levenshtein-edit-distance";

const wordLevenshtienCache: { [words: string]: number } = {};

export interface ICrowIndexQuery {
    key: any, 
    num: number, 
    lat: number, 
    lon: number
}

export const attachDefaultFns = (nSQL: INanoSQLInstance) => {

    nSQL.functions = {
        COUNT: {
            type: "A",
            aggregateStart: {result: 0, row: {}},
            call: (query, row, prev, column) => {
                if (column && column !== "*") {
                    if (getFnValue(row, column)) {
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
                let max = getFnValue(row, column) || 0;
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
                let min = getFnValue(row, column) || 0;
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
                const value = parseFloat(getFnValue(row, column) || 0) || 0;
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
                const value = parseFloat(getFnValue(row, column) || 0) || 0;
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
                const latVal = getFnValue(row, gpsCol + ".lat");
                const lonVal = getFnValue(row, gpsCol + ".lon");

                return {
                    result: crowDistance(latVal, lonVal, parseFloat(lat), parseFloat(lon), nSQL.planetRadius)
                };
            },
            checkIndex: (query, fnArgs, where) => {
                if (where[1] === "<" || where[1] === "<=") {
                    const indexes: {[id: string]: INanoSQLIndex} = typeof query.table === "string" ? nSQL.tables[query.table].indexes : {};
                    const crowColumn = resolvePath(fnArgs[0]);
                    let crowCols: string[] = [];
                    // find the lat/lon indexes for the crow calculation
                    Object.keys(indexes).forEach((k) => {
                        const index = indexes[k];
                        if (index.type === "float" && _objectsEqual(index.path.slice(0, index.path.length - 1), crowColumn)) {
                            crowCols.push(k.replace(".lat", "").replace(".lon", ""));
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
            queryIndex: (query: INanoSQLQuery, where: IWhereCondition, onlyPKs: boolean, onRow: (row, i) => void, complete: () => void, error: (err) => void) => {
                const latTable = `_idx_${query.table as string}_${where.index}.lat`;
                const lonTable = `_idx_${query.table as string}_${where.index}.lon`;
                const condition = where.comp;

                const distance = parseFloat(where.value || "0");
                const centerLat = parseFloat(where.fnArgs ? where.fnArgs[1] : "0");
                const centerLon = parseFloat(where.fnArgs ? where.fnArgs[2] : "0");

                // get distance radius in degrees
                const distanceDegrees = (distance / (nSQL.planetRadius * 2 * Math.PI)) * 360;

                // get degrees north and south of search point
                let latRange = [-1, 1].map(s => centerLat + (distanceDegrees * s));

                let lonRange: number[] = [];
                let extraLonRange: number[] = [];

                // check if latitude range is above/below the distance query
                // that means we're querying near a pole
                // if so, grab all longitudes
                let poleQuery = false;
                const poleRange = Math.max(90 - distanceDegrees, 0);

                if (Math.abs(latRange[0]) > poleRange || Math.abs(latRange[1]) > poleRange) {
                    poleQuery = true;
                    if (latRange[0] < poleRange * -1) {
                        latRange = [-90, latRange[1]];
                    }
                    if (latRange[1] > poleRange) {
                        latRange = [latRange[0], 90];
                    }
                } else {

                    const largestLat = Math.max(Math.abs(latRange[0]), Math.abs(latRange[1]));

                    // get degrees east and west of search point
                    lonRange = [-1, 1].map(s => {
                        const equatorDegrees = distanceDegrees * s;
                        return centerLon + (equatorDegrees / Math.cos(deg2rad(largestLat)));
                    });

                    // if range query happens to cross antimeridian
                    // no need to check this for pole queries
                    if (Math.abs(lonRange[0]) > 180) {
                        // lonRange [-185, -170]
                        // extraLonRange [175, 180]
                        const diff = Math.abs(lonRange[0]) - 180;
                        extraLonRange = [180 - diff, 180];
                    }
                    if (Math.abs(lonRange[1]) > 180) {
                        // lonRange [175, 185]
                        // extraLonRange [-180, -175]
                        const diff = Math.abs(lonRange[1]) - 180;
                        extraLonRange = [-180, -180 + diff];
                    }
                }

                let pks: {[id: string]: ICrowIndexQuery} = {};

                allAsync([latTable, lonTable, lonTable], (table, i, next, error) => {
                    const ranges = [latRange, lonRange, extraLonRange][i];

                    if (!ranges.length) {
                        next(null);
                        return;
                    }
                    // read values from seconday index table
                    adapterFilters(nSQL, query).readIndexKeys(table, "range", ranges[0], ranges[1], false, (pk, id) => {
                        if (!pks[pk]) {
                            pks[pk] = {
                                key: pk,
                                lat: 0,
                                lon: 0,
                                num: 0
                            };
                        } else {
                            pks[pk].num++;
                        }
                        if (i === 0) {
                            pks[pk].lat = id - 90;
                        } else {
                            pks[pk].lon = id - 180;
                        }
                    }, () => {
                        next(null);
                    }, error as any);

                }).then(() => {
                    // step 2: get the square shaped selection of items
                    let counter = 0;

                    const rowsToRead = Object.keys(pks).filter(p => {
                        if (poleQuery) { // check all rows for pole query
                            return true;
                        }
                        if (pks[p].num === 0) { // if not pole query and doesn't have both lat and lon values, ignore
                            return false;
                        }
                        // confirm within distance for remaining rows
                        const crowDist = crowDistance(pks[p].lat, pks[p].lon, centerLat, centerLon, nSQL.planetRadius);
                        return condition === "<" ? crowDist < distance : crowDist <= distance;
                    }).map(p => pks[p]);

                    if (!poleQuery && onlyPKs) {
                        rowsToRead.forEach((rowData, k) => {
                            onRow(rowData.key, k);
                        });
                        return;
                    }


                    allAsync(rowsToRead, (rowData: ICrowIndexQuery, i, next, err) => {

                        adapterFilters(query.parent, query).read(query.table as string, rowData.key, (row) => {
                            if (!row) { 
                                next(null);
                                return;
                            }
                            if (!poleQuery) {
                                onRow(row, i);
                                next(null);
                                return;
                            }

                            // perform crow distance calculation on square selected group
                            const rowLat = deepGet((where.fnArgs ? where.fnArgs[0] : "") + ".lat", row);
                            const rowLon = deepGet((where.fnArgs ? where.fnArgs[0] : "") + ".lon", row);

                            const crowDist = crowDistance(rowLat, rowLon, centerLat, centerLon, nSQL.planetRadius);
                            const doRow = condition === "<" ? crowDist < distance : crowDist <= distance;
                            if (doRow) {
                                onRow(onlyPKs ? row[nSQL.tables[query.table as string].pkCol] : row, counter);
                                counter++;
                            }

                            next(null);
                        }, error);
                    }).catch(error).then(() => {
                        complete();
                    });
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

