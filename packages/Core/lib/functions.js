Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("./utilities");
var levenshtein = require("levenshtein-edit-distance");
var wordLevenshtienCache = {};
exports.attachDefaultFns = function (nSQL) {
    nSQL.functions = {
        COUNT: {
            type: "A",
            aggregateStart: { result: 0, row: {} },
            call: function (query, row, isJoin, prev, column) {
                if (column && column !== "*") {
                    if (utilities_1.objQuery(column, row, isJoin)) {
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
            call: function (query, row, isJoin, prev, column) {
                var max = utilities_1.objQuery(column, row, isJoin) || 0;
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
            call: function (query, row, isJoin, prev, column) {
                var min = utilities_1.objQuery(column, row, isJoin) || 0;
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
            call: function (query, row, isJoin, prev) {
                var values = [];
                for (var _i = 4; _i < arguments.length; _i++) {
                    values[_i - 4] = arguments[_i];
                }
                var args = values.map(function (s) { return isNaN(s) ? utilities_1.getFnValue(row, s, isJoin) : parseFloat(s); }).sort(function (a, b) { return a < b ? 1 : -1; });
                return { result: args[0] };
            }
        },
        LEAST: {
            type: "S",
            call: function (query, row, isJoin, prev) {
                var values = [];
                for (var _i = 4; _i < arguments.length; _i++) {
                    values[_i - 4] = arguments[_i];
                }
                var args = values.map(function (s) { return isNaN(s) ? utilities_1.getFnValue(row, s, isJoin) : parseFloat(s); }).sort(function (a, b) { return a > b ? 1 : -1; });
                return { result: args[0] };
            }
        },
        AVG: {
            type: "A",
            aggregateStart: { result: 0, row: {}, total: 0, records: 0 },
            call: function (query, row, isJoin, prev, column) {
                var value = parseFloat(utilities_1.objQuery(column, row, isJoin) || 0) || 0;
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
            call: function (query, row, isJoin, prev, column) {
                var value = parseFloat(utilities_1.objQuery(column, row, isJoin) || 0) || 0;
                prev.result += isNaN(value) ? 0 : value;
                prev.row = row;
                return prev;
            }
        },
        LOWER: {
            type: "S",
            call: function (query, row, isJoin, prev, column) {
                var value = String(utilities_1.getFnValue(row, column, isJoin)).toLowerCase();
                return { result: value };
            }
        },
        UPPER: {
            type: "S",
            call: function (query, row, isJoin, prev, column) {
                var value = String(utilities_1.getFnValue(row, column, isJoin)).toUpperCase();
                return { result: value };
            }
        },
        CAST: {
            type: "S",
            call: function (query, row, isJoin, prev, column, type) {
                return { result: utilities_1.cast(type, utilities_1.objQuery(column, row, isJoin)) };
            }
        },
        CONCAT: {
            type: "S",
            call: function (query, row, isJoin, prev) {
                var values = [];
                for (var _i = 4; _i < arguments.length; _i++) {
                    values[_i - 4] = arguments[_i];
                }
                return { result: values.map(function (v) {
                        return utilities_1.getFnValue(row, v, isJoin);
                    }).join("") };
            }
        },
        LEVENSHTEIN: {
            type: "S",
            call: function (query, row, isJoin, prev, word1, word2) {
                var w1 = utilities_1.getFnValue(row, word1, isJoin);
                var w2 = utilities_1.getFnValue(row, word2, isJoin);
                var key = w1 + "::" + w2;
                if (!wordLevenshtienCache[key]) {
                    wordLevenshtienCache[key] = levenshtein(w1, w2);
                }
                return { result: wordLevenshtienCache[key] };
            }
        },
        CROW: {
            type: "S",
            call: function (query, row, isJoin, prev, gpsCol, lat, lon) {
                var latVal = utilities_1.objQuery(gpsCol + ".lat", row, isJoin);
                var lonVal = utilities_1.objQuery(gpsCol + ".lon", row, isJoin);
                return { result: utilities_1.crowDistance(latVal, lonVal, parseFloat(lat), parseFloat(lon), nSQL.earthRadius) };
            },
            whereIndex: function (nSQL, query, fnArgs, where) {
                if (where[1] === ">" || where[1] === ">=") {
                    var indexes_1 = typeof query.table === "string" ? nSQL.tables[query.table].indexes : {};
                    var crowColumn_1 = utilities_1.resolveObjPath(fnArgs[0]);
                    var crowCols_1 = [];
                    Object.keys(indexes_1).forEach(function (k) {
                        var index = indexes_1[k];
                        if (utilities_1.compareObjects(index.path.slice(0, index.path.length - 1), crowColumn_1)) {
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
            queryIndex: function (nSQL, query, where, onlyPKs, onRow, complete) {
            }
        }
    };
    Object.getOwnPropertyNames(Math).forEach(function (key) {
        nSQL.functions[key.toUpperCase()] = {
            type: "S",
            call: function (query, row, isJoin, prev) {
                var args = [];
                for (var _i = 4; _i < arguments.length; _i++) {
                    args[_i - 4] = arguments[_i];
                }
                var fnArgs = args.map(function (a) { return parseFloat(isNaN(a) ? utilities_1.objQuery(a, row, isJoin) : a); });
                return { result: Math[key].apply(null, fnArgs) };
            }
        };
    });
};
//# sourceMappingURL=functions.js.map