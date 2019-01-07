Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("./utilities");
var levenshtein = require("levenshtein-edit-distance");
var wordLevenshtienCache = {};
exports.attachDefaultFns = function (nSQL) {
    nSQL.functions = {
        COUNT: {
            type: "A",
            aggregateStart: { result: 0, row: {} },
            call: function (query, row, prev, column) {
                if (column && column !== "*") {
                    if (utilities_1.getFnValue(row, column)) {
                        prev.result++;
                    }
                }
                else {
                    prev.result++;
                }
                prev.row = row;
                return prev;
            }
        },
        MAX: {
            type: "A",
            aggregateStart: { result: undefined, row: {} },
            call: function (query, row, prev, column) {
                var max = utilities_1.getFnValue(row, column) || 0;
                if (typeof prev.result === "undefined") {
                    prev.result = max;
                    prev.row = row;
                }
                else {
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
            aggregateStart: { result: undefined, row: {} },
            call: function (query, row, prev, column) {
                var min = utilities_1.getFnValue(row, column) || 0;
                if (typeof prev.result === "undefined") {
                    prev.result = min;
                    prev.row = row;
                }
                else {
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
            call: function (query, row, prev) {
                var values = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    values[_i - 3] = arguments[_i];
                }
                var args = values.map(function (s) { return isNaN(s) ? utilities_1.getFnValue(row, s) : parseFloat(s); }).sort(function (a, b) { return a < b ? 1 : -1; });
                return { result: args[0] };
            }
        },
        LEAST: {
            type: "S",
            call: function (query, row, prev) {
                var values = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    values[_i - 3] = arguments[_i];
                }
                var args = values.map(function (s) { return isNaN(s) ? utilities_1.getFnValue(row, s) : parseFloat(s); }).sort(function (a, b) { return a > b ? 1 : -1; });
                return { result: args[0] };
            }
        },
        AVG: {
            type: "A",
            aggregateStart: { result: 0, row: {}, total: 0, records: 0 },
            call: function (query, row, prev, column) {
                var value = parseFloat(utilities_1.getFnValue(row, column) || 0) || 0;
                prev.total += isNaN(value) ? 0 : value;
                prev.records++;
                prev.result = prev.total / prev.records;
                prev.row = row;
                return prev;
            }
        },
        SUM: {
            type: "A",
            aggregateStart: { result: 0, row: {} },
            call: function (query, row, prev, column) {
                var value = parseFloat(utilities_1.getFnValue(row, column) || 0) || 0;
                prev.result += isNaN(value) ? 0 : value;
                prev.row = row;
                return prev;
            }
        },
        LOWER: {
            type: "S",
            call: function (query, row, prev, column) {
                var value = String(utilities_1.getFnValue(row, column)).toLowerCase();
                return { result: value };
            }
        },
        TRIM: {
            type: "S",
            call: function (query, row, prev, column) {
                var value = String(utilities_1.getFnValue(row, column)).trim();
                return { result: value };
            }
        },
        UPPER: {
            type: "S",
            call: function (query, row, prev, column) {
                var value = String(utilities_1.getFnValue(row, column)).toUpperCase();
                return { result: value };
            }
        },
        CAST: {
            type: "S",
            call: function (query, row, prev, column, type) {
                return { result: utilities_1.cast(utilities_1.getFnValue(row, type), utilities_1.deepGet(column, row), false, query.parent) };
            }
        },
        CONCAT: {
            type: "S",
            call: function (query, row, prev) {
                var values = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    values[_i - 3] = arguments[_i];
                }
                return { result: values.map(function (v) {
                        return utilities_1.getFnValue(row, v);
                    }).join("") };
            }
        },
        REPLACE: {
            type: "S",
            call: function (query, row, prev, subject, find, replace) {
                var subjVal = String(utilities_1.getFnValue(row, subject));
                var findVal = String(utilities_1.getFnValue(row, find));
                var repVal = String(utilities_1.getFnValue(row, replace));
                return { result: subjVal.replace(findVal, repVal) };
            }
        },
        STRCMP: {
            type: "S",
            call: function (query, row, prev, subject1, subject2) {
                var subjVal1 = String(utilities_1.getFnValue(row, subject1));
                var subjVal2 = String(utilities_1.getFnValue(row, subject2));
                if (subjVal1 < subjVal2)
                    return { result: -1 };
                if (subjVal1 > subjVal2)
                    return { result: 1 };
                return { result: 0 };
            }
        },
        CONCAT_WS: {
            type: "S",
            call: function (query, row, prev, sep) {
                var values = [];
                for (var _i = 4; _i < arguments.length; _i++) {
                    values[_i - 4] = arguments[_i];
                }
                return { result: values.map(function (v) {
                        return utilities_1.getFnValue(row, v);
                    }).join(utilities_1.getFnValue(row, sep)) };
            }
        },
        LEVENSHTEIN: {
            type: "S",
            call: function (query, row, prev, word1, word2) {
                var w1 = utilities_1.getFnValue(row, word1);
                var w2 = utilities_1.getFnValue(row, word2);
                var key = w1 + "::" + w2;
                if (!wordLevenshtienCache[key]) {
                    wordLevenshtienCache[key] = levenshtein(w1, w2);
                }
                return { result: wordLevenshtienCache[key] };
            }
        },
        IF: {
            type: "S",
            call: function (query, row, prev, expression, isTrue, isFalse) {
                var exp = expression.split(/<|=|>|<=|>=/gmi).map(function (s) {
                    if (isNaN(s)) {
                        return utilities_1.getFnValue(row, s);
                    }
                    else {
                        return parseFloat(s);
                    }
                });
                var comp = expression.match(/<|=|>|<=|>=/gmi)[0];
                if (!comp)
                    return { result: utilities_1.getFnValue(row, isFalse) };
                switch (comp) {
                    case "=": return exp[0] == exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    case ">": return exp[0] > exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    case "<": return exp[0] < exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    case "<=": return exp[0] <= exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    case ">=": return exp[0] < exp[1] ? utilities_1.getFnValue(row, isTrue) : utilities_1.getFnValue(row, isFalse);
                    default: return { result: utilities_1.getFnValue(row, isFalse) };
                }
            }
        },
        CROW: {
            type: "S",
            call: function (query, row, prev, gpsCol, lat, lon) {
                var latVal = utilities_1.getFnValue(row, gpsCol + ".lat");
                var lonVal = utilities_1.getFnValue(row, gpsCol + ".lon");
                return {
                    result: utilities_1.crowDistance(latVal, lonVal, parseFloat(lat), parseFloat(lon), nSQL.planetRadius)
                };
            },
            checkIndex: function (query, fnArgs, where) {
                if (where[1] === "<" || where[1] === "<=") {
                    var indexes_1 = typeof query.table === "string" ? nSQL.tables[query.table].indexes : {};
                    var crowColumn_1 = utilities_1.resolvePath(fnArgs[0]);
                    var crowCols_1 = [];
                    // find the lat/lon indexes for the crow calculation
                    Object.keys(indexes_1).forEach(function (k) {
                        var index = indexes_1[k];
                        if (index.type === "float" && utilities_1._objectsEqual(index.path.slice(0, index.path.length - 1), crowColumn_1)) {
                            crowCols_1.push(k.replace(".lat", "").replace(".lon", ""));
                        }
                    });
                    if (crowCols_1.length === 2) {
                        return {
                            index: crowCols_1[0],
                            parsedFn: { name: "CROW", args: fnArgs },
                            comp: where[1],
                            value: where[2]
                        };
                    }
                }
                return false;
            },
            queryIndex: function (query, where, onlyPKs, onRow, complete, error) {
                var latTable = "_idx_" + query.table + "_" + where.index + ".lat";
                var lonTable = "_idx_" + query.table + "_" + where.index + ".lon";
                var condition = where.comp;
                var distance = parseFloat(where.value || "0");
                var centerLat = parseFloat(where.parsedFn ? where.parsedFn.args[1] : "0");
                var centerLon = parseFloat(where.parsedFn ? where.parsedFn.args[2] : "0");
                // get distance radius in degrees
                var distanceDegrees = (distance / (nSQL.planetRadius * 2 * Math.PI)) * 360;
                // get degrees north and south of search point
                var latRange = [-1, 1].map(function (s) { return centerLat + (distanceDegrees * s); });
                var lonRange = [];
                var extraLonRange = [];
                // check if latitude range is above/below the distance query
                // that means we're querying near a pole
                // if so, grab all longitudes
                var poleQuery = false;
                var poleRange = Math.max(90 - distanceDegrees, 0);
                if (Math.abs(latRange[0]) > poleRange || Math.abs(latRange[1]) > poleRange) {
                    poleQuery = true;
                    if (latRange[0] < poleRange * -1) {
                        latRange = [-90, latRange[1]];
                    }
                    if (latRange[1] > poleRange) {
                        latRange = [latRange[0], 90];
                    }
                }
                else {
                    var largestLat_1 = Math.max(Math.abs(latRange[0]), Math.abs(latRange[1]));
                    // get degrees east and west of search point
                    lonRange = [-1, 1].map(function (s) {
                        var equatorDegrees = distanceDegrees * s;
                        return centerLon + (equatorDegrees / Math.cos(utilities_1.deg2rad(largestLat_1)));
                    });
                    // if range query happens to cross antimeridian
                    // no need to check this for pole queries
                    if (Math.abs(lonRange[0]) > 180) {
                        // lonRange [-185, -170]
                        // extraLonRange [175, 180]
                        var diff = Math.abs(lonRange[0]) - 180;
                        extraLonRange = [180 - diff, 180];
                    }
                    if (Math.abs(lonRange[1]) > 180) {
                        // lonRange [175, 185]
                        // extraLonRange [-180, -175]
                        var diff = Math.abs(lonRange[1]) - 180;
                        extraLonRange = [-180, -180 + diff];
                    }
                }
                var pks = {};
                utilities_1.allAsync([latTable, lonTable, lonTable], function (table, i, next, error) {
                    var ranges = [latRange, lonRange, extraLonRange][i];
                    if (!ranges.length) {
                        next(null);
                        return;
                    }
                    // read values from seconday index table
                    utilities_1.adapterFilters(nSQL, query).readIndexKeys(table, "range", ranges[0], ranges[1], false, function (pk, id) {
                        if (!pks[pk]) {
                            pks[pk] = {
                                key: pk,
                                lat: 0,
                                lon: 0,
                                num: 0
                            };
                        }
                        else {
                            pks[pk].num++;
                        }
                        if (i === 0) {
                            pks[pk].lat = id - 90;
                        }
                        else {
                            pks[pk].lon = id - 180;
                        }
                    }, function () {
                        next(null);
                    }, error);
                }).then(function () {
                    // step 2: get the square shaped selection of items
                    var counter = 0;
                    var rowsToRead = Object.keys(pks).filter(function (p) {
                        if (poleQuery) { // check all rows for pole query
                            return true;
                        }
                        if (pks[p].num === 0) { // if not pole query and doesn't have both lat and lon values, ignore
                            return false;
                        }
                        // confirm within distance for remaining rows
                        var crowDist = utilities_1.crowDistance(pks[p].lat, pks[p].lon, centerLat, centerLon, nSQL.planetRadius);
                        return condition === "<" ? crowDist < distance : crowDist <= distance;
                    }).map(function (p) { return pks[p]; });
                    if (!poleQuery && onlyPKs) {
                        rowsToRead.forEach(function (rowData, k) {
                            onRow(rowData.key, k);
                        });
                        return;
                    }
                    utilities_1.allAsync(rowsToRead, function (rowData, i, next, err) {
                        utilities_1.adapterFilters(query.parent, query).read(query.table, rowData.key, function (row) {
                            if (!row) {
                                next(null);
                                return;
                            }
                            if (!poleQuery) {
                                onRow(row, i);
                                next(null);
                                return;
                            }
                            // perform crow distance calculation on pole locations
                            var rowLat = utilities_1.deepGet((where.parsedFn ? where.parsedFn.args[0] : "") + ".lat", row);
                            var rowLon = utilities_1.deepGet((where.parsedFn ? where.parsedFn.args[0] : "") + ".lon", row);
                            var crowDist = utilities_1.crowDistance(rowLat, rowLon, centerLat, centerLon, nSQL.planetRadius);
                            var doRow = condition === "<" ? crowDist < distance : crowDist <= distance;
                            if (doRow) {
                                onRow(onlyPKs ? utilities_1.deepGet(nSQL.tables[query.table].pkCol, row) : row, counter);
                                counter++;
                            }
                            next(null);
                        }, err);
                    }).catch(error).then(function () {
                        complete();
                    });
                }).catch(error);
            }
        }
    };
    var MathFns = Object.getOwnPropertyNames ? Object.getOwnPropertyNames(Math) : ["abs", "acos", "asin", "atan", "atan2", "ceil", "cos", "exp", "floor", "log", "max", "min", "pow", "random", "round", "sin", "sqrt", "tan"];
    MathFns.forEach(function (key) {
        nSQL.functions[key.toUpperCase()] = {
            type: "S",
            call: function (query, row, prev) {
                var args = [];
                for (var _i = 3; _i < arguments.length; _i++) {
                    args[_i - 3] = arguments[_i];
                }
                var fnArgs = args.map(function (a) { return parseFloat(isNaN(a) ? utilities_1.deepGet(a, row) : a); });
                return { result: Math[key].apply(null, fnArgs) };
            }
        };
    });
};
//# sourceMappingURL=functions.js.map