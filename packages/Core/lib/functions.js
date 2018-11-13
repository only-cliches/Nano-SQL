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
                    if (utilities_1.deepGet(column, row)) {
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
                var max = utilities_1.deepGet(column, row) || 0;
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
                var min = utilities_1.deepGet(column, row) || 0;
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
                var value = parseFloat(utilities_1.deepGet(column, row) || 0) || 0;
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
                var value = parseFloat(utilities_1.deepGet(column, row) || 0) || 0;
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
                return { result: utilities_1.cast(type, utilities_1.deepGet(column, row)) };
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
        CROW: {
            type: "S",
            call: function (query, row, prev, gpsCol, lat, lon) {
                var latVal = utilities_1.deepGet(gpsCol + ".lat", row);
                var lonVal = utilities_1.deepGet(gpsCol + ".lon", row);
                return { result: utilities_1.crowDistance(latVal, lonVal, parseFloat(lat), parseFloat(lon), nSQL.earthRadius) };
            },
            whereIndex: function (nSQL, query, fnArgs, where) {
                if (where[1] === ">") {
                    var indexes_1 = typeof query.table === "string" ? nSQL.tables[query.table].indexes : {};
                    var crowColumn_1 = utilities_1.resolvePath(fnArgs[0]);
                    var crowCols_1 = [];
                    Object.keys(indexes_1).forEach(function (k) {
                        var index = indexes_1[k];
                        if (utilities_1.objectsEqual(index.path.slice(0, index.path.length - 1), crowColumn_1)) {
                            crowCols_1.push(index.name.replace("-lat", "").replace("-lon", ""));
                        }
                    });
                    if (crowCols_1.length === 2) {
                        return {
                            index: crowCols_1[0],
                            fnName: "CROW",
                            fnArgs: fnArgs,
                            comp: where[1],
                            value: where[2]
                        };
                    }
                }
                return false;
            },
            queryIndex: function (nSQL, query, where, onlyPKs, onRow, complete, error) {
                var latTable = "_idx_" + query.table + "_" + where.index + "-lat";
                var lonTable = "_idx_" + query.table + "_" + where.index + "-lon";
                var distance = parseFloat(where.value || "0");
                var centerLat = parseFloat(where.fnArgs ? where.fnArgs[1] : "0");
                var centerLon = parseFloat(where.fnArgs ? where.fnArgs[2] : "0");
                // step 1: get a square that contains the radius circle for our search
                // get latitudes that are distance north and distance south from the search point
                var latRange = [-1, 1].map(function (i) {
                    return centerLat + ((distance * i) / nSQL.earthRadius) * (180 * Math.PI);
                });
                // get the longitudes that are distance west and distance east from the search point
                var lonRange = [-1, 1].map(function (i) {
                    return centerLon + ((distance * i) / nSQL.earthRadius) * (180 * Math.PI) / Math.cos(centerLat * Math.PI / 180);
                });
                var pks = {};
                utilities_1.allAsync([latTable, lonTable], function (table, i, next, error) {
                    var ranges = i === 0 ? latRange : lonRange;
                    nSQL.adapter.readMulti(table, "range", ranges[0], ranges[1], false, function (row, i) {
                        row.pks.forEach(function (pk) {
                            pks[pk] = Math.max(i, pks[pk] ? pks[pk] : 0);
                        });
                    }, function () {
                        next(null);
                    }, error);
                }).then(function () {
                    // step 2: get the square shaped selection of items
                    var counter = 0;
                    var readPKS = Object.keys(pks).filter(function (p) { return pks[p] === 1; });
                    var crowBuffer = new utilities_1.NanoSQLQueue(function (item, i, done, err) {
                        // perform crow distance calculation on square selected group
                        var rowLat = utilities_1.deepGet((where.fnArgs ? where.fnArgs[0] : "") + ".lat", item);
                        var rowLon = utilities_1.deepGet((where.fnArgs ? where.fnArgs[0] : "") + ".lon", item);
                        if (utilities_1.crowDistance(rowLat, rowLon, centerLat, centerLon, nSQL.earthRadius) < distance) {
                            onRow(onlyPKs ? item[nSQL.tables[query.table].pkCol] : item, counter);
                            counter++;
                        }
                        done();
                    }, error, complete);
                    utilities_1.allAsync(readPKS, function (pk, i, next, err) {
                        nSQL.adapter.read(query.table, pk, function (row) {
                            if (row) {
                                crowBuffer.newItem(row);
                            }
                            next(null);
                        }, error);
                    }).catch(error).then(function () {
                        crowBuffer.finished();
                    });
                }).catch(error);
            }
        }
    };
    Object.getOwnPropertyNames(Math).forEach(function (key) {
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