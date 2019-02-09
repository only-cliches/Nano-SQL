/**
 * Most adapters can only run exclusively in the browser or NodeJS.
 * This adapter test class is meant to handle both situations.
 *
 *
 * TO TEST YOUR ADAPTER
 * 1. Replace the _SyncStore import at the top with your own adapter.
 * 2. Set your adapter and argumnets to pass into it at the bottom.
 *
 * NODEJS:
 * 3. ts-node --disableWarnings test.ts
 *
 * BROWSER:
 * 3. npm run test-browser then navigate to localhost::8080. Test results will be in the console.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("./utilities");
var _1 = require(".");
exports.myConsole = Object.create(console, {
    assert: {
        value: function assert(assertion, message) {
            var args = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                args[_i - 2] = arguments[_i];
            }
            if (typeof window === "undefined") {
                try {
                    console.assert.apply(console, [assertion, message].concat(args));
                }
                catch (err) {
                    console.error(err.stack);
                }
            }
            else {
                console.assert.apply(console, [assertion, message].concat(args));
            }
        },
        configurable: true,
        enumerable: true,
        writable: true,
    },
});
var nanoSQLAdapterTest = /** @class */ (function () {
    function nanoSQLAdapterTest(adapter, args) {
        this.adapter = adapter;
        this.args = args;
    }
    nanoSQLAdapterTest.prototype.test = function () {
        var _this = this;
        return this.PrimaryKeys().then(function () {
            console.log("✓ Primary Key Tests Passed");
            return _this.Writes();
        }).then(function () {
            console.log("✓ Write Tests Passed");
            return _this.RangeReads();
        }).then(function () {
            console.log("✓ Range Read Tests Passed (number)");
            return _this.RangeReadsUUID();
        }).then(function () {
            console.log("✓ Range Read Tests Passed (uuid)");
            return _this.Deletes();
        }).then(function () {
            console.log("✓ Delete Tests Passed");
            return _this.SecondayIndexes();
        }).then(function () {
            console.log("✓ Secondary Index Passed");
            console.log("✓ All Tests Passed!******");
        });
    };
    nanoSQLAdapterTest.newTable = function (adapter, nSQL, tableName, tableConfig, complete, error) {
        adapter.nSQL = nSQL;
        adapter.createTable(tableName, tableConfig, function () {
            nSQL._tables[tableName] = tableConfig;
            complete();
        }, error);
    };
    nanoSQLAdapterTest.prototype.Deletes = function () {
        var _a;
        var adapter = new ((_a = this.adapter).bind.apply(_a, [void 0].concat(this.args)))();
        var nSQL = new _1.nanoSQL();
        var allRows = [];
        return new Promise(function (res, rej) {
            adapter.nSQL = nSQL;
            adapter.connect("123", function () {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: utilities_1.uuid(),
                    name: "test",
                    model: {
                        "id:int": { ai: true, pk: true },
                        "name:string": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "int"
                        },
                        {
                            key: "name",
                            type: "string"
                        }
                    ],
                    indexes: {},
                    actions: [],
                    queries: {},
                    views: [],
                    pkType: "int",
                    pkCol: ["id"],
                    isPkNum: true,
                    ai: true
                }, res, rej);
            }, rej);
        }).then(function () {
            return new Promise(function (res, rej) {
                var titles = [];
                for (var i = 0; i < 500; i++) {
                    allRows.push({ id: i + 1, name: "Title " + (i + 1) });
                    titles.push("Title " + (i + 1));
                }
                utilities_1.chainAsync(titles, function (title, i, done) {
                    adapter.write("test", null, { name: title }, done, rej);
                }).then(res);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                // single rows can be deleted.
                adapter.delete("test", 3, function () {
                    var rows = [];
                    adapter.readMulti("test", "all", undefined, undefined, false, function (row, idx) {
                        rows.push(row);
                    }, function () {
                        var condition = utilities_1.objectsEqual(rows, allRows.filter(function (r) { return r.id !== 3; }));
                        exports.myConsole.assert(condition, "Delete Test");
                        condition ? res() : rej({ e: allRows.filter(function (r) { return r.id !== 3; }), g: rows });
                    }, rej);
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                adapter.dropTable("test", function () {
                    adapter.disconnect(res, rej);
                }, rej);
            });
        });
    };
    nanoSQLAdapterTest.prototype.SecondayIndexes = function () {
        var _a;
        var adapter = new ((_a = this.adapter).bind.apply(_a, [void 0].concat(this.args)))();
        var nSQL = new _1.nanoSQL();
        var allRows = [];
        return new Promise(function (res, rej) {
            adapter.nSQL = nSQL;
            adapter.connect("123", function () {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: utilities_1.uuid(),
                    name: "test",
                    model: {
                        "id:int": { ai: true, pk: true },
                        "name:string": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "int"
                        },
                        {
                            key: "name",
                            type: "string"
                        }
                    ],
                    indexes: {
                        "name": {
                            id: "name",
                            isArray: false,
                            type: "string",
                            path: ["name"],
                            props: {}
                        }
                    },
                    actions: [],
                    queries: {},
                    views: [],
                    pkType: "int",
                    pkCol: ["id"],
                    isPkNum: true,
                    ai: true
                }, res, rej);
            }, rej);
        }).then(function () {
            return new Promise(function (res, rej) {
                var titles = [];
                for (var i = 0; i < 500; i++) {
                    var num = (i + 1);
                    if (num <= 9) {
                        num = "00" + num;
                    }
                    else if (num <= 99) {
                        num = "0" + num;
                    }
                    allRows.push({ id: i + 1, name: "Title " + num });
                }
                adapter.createIndex("test", "name", "string", function () {
                    utilities_1.chainAsync(allRows, function (row, i, done) {
                        adapter.write("test", null, row, function () {
                            adapter.addIndexValue("test", "name", row.id, row.name, done, rej);
                        }, rej);
                    }).then(res);
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                // read secondary index
                var pks = [];
                adapter.readIndexKey("test", "name", "Title 005", function (pk) {
                    pks.push(pk);
                }, function () {
                    var condition = utilities_1.objectsEqual(pks, [5]);
                    exports.myConsole.assert(condition, "Secondary Index Single Read");
                    condition ? res() : rej({ e: [5], g: pks });
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                // read range secondary index
                var pks = [];
                adapter.readIndexKeys("test", "name", "range", "Title 004", "Title 020", false, function (pk, value) {
                    pks.push(pk);
                }, function () {
                    var filterRows = allRows.filter(function (r) { return r.name >= "Title 004" && r.name <= "Title 020"; }).map(function (r) { return r.id; });
                    var condition = utilities_1.objectsEqual(pks, filterRows);
                    exports.myConsole.assert(condition, "Secondary Index Range Read");
                    condition ? res() : rej({ e: filterRows, g: pks });
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                // read offset secondary index
                var pks = [];
                adapter.readIndexKeys("test", "name", "offset", 10, 20, false, function (pk) {
                    pks.push(pk);
                }, function () {
                    var filterRows = allRows.filter(function (r, i) { return i >= 10 && i < 30; }).map(function (r) { return r.id; });
                    var condition = utilities_1.objectsEqual(pks, filterRows);
                    exports.myConsole.assert(condition, "Secondary Index Offset Read");
                    condition ? res() : rej({ e: filterRows, g: pks });
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                // read range secondary index
                var pks = [];
                adapter.readIndexKeys("test", "name", "range", "Title 010", "~", true, function (pk, value) {
                    pks.push(pk);
                }, function () {
                    var filterRows = allRows.filter(function (r) { return r.name >= "Title 010"; }).map(function (r) { return r.id; }).reverse();
                    var condition = utilities_1.objectsEqual(pks, filterRows);
                    exports.myConsole.assert(condition, "Secondary Index Range Read Reverse");
                    condition ? res() : rej({ e: filterRows, g: pks });
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                // read offset secondary index
                var pks = [];
                adapter.readIndexKeys("test", "name", "offset", 10, 20, true, function (pk) {
                    pks.push(pk);
                }, function () {
                    var filterRows = allRows.filter(function (r, i) { return i >= 469 && i < 489; }).map(function (r) { return r.id; }).reverse();
                    var condition = utilities_1.objectsEqual(pks, filterRows);
                    exports.myConsole.assert(condition, "Secondary Index Offset Read Reverse");
                    condition ? res() : rej({ e: filterRows, g: pks });
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                // read offset secondary index
                var pks = [];
                adapter.deleteIndexValue("test", "name", 10, "Title 010", function () {
                    adapter.readIndexKeys("test", "name", "all", undefined, undefined, false, function (pk) {
                        pks.push(pk);
                    }, function () {
                        var filterRows = allRows.filter(function (r) { return r.id !== 10; }).map(function (r) { return r.id; });
                        var condition = utilities_1.objectsEqual(pks, filterRows);
                        exports.myConsole.assert(condition, "Secondary Index Remove Value");
                        condition ? res() : rej({ e: filterRows, g: pks });
                    }, rej);
                }, rej);
            });
        });
    };
    nanoSQLAdapterTest.prototype.RangeReads = function () {
        var _a;
        var adapter = new ((_a = this.adapter).bind.apply(_a, [void 0].concat(this.args)))();
        var nSQL = new _1.nanoSQL();
        var allRows = [];
        var index = [];
        return new Promise(function (res, rej) {
            adapter.nSQL = nSQL;
            adapter.connect("123", function () {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: utilities_1.uuid(),
                    name: "test",
                    model: {
                        "id:int": { ai: true, pk: true },
                        "name:string": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "int"
                        },
                        {
                            key: "name",
                            type: "string"
                        }
                    ],
                    indexes: {},
                    actions: [],
                    views: [],
                    queries: {},
                    pkType: "int",
                    pkCol: ["id"],
                    isPkNum: true,
                    ai: true
                }, res, rej);
            }, rej);
        }).then(function () {
            return new Promise(function (res, rej) {
                var titles = [];
                for (var i = 0; i < 500; i++) {
                    allRows.push({ id: i + 1, name: "Title " + (i + 1) });
                    titles.push("Title " + (i + 1));
                    index.push(i + 1);
                }
                utilities_1.chainAsync(titles, function (title, i, done) {
                    adapter.write("test", null, { name: title }, done, rej);
                }).then(res);
            });
        }).then(function () {
            // Select a range of rows using a range of the index with reverse
            return new Promise(function (res, rej) {
                var rows = [];
                adapter.readMulti("test", "range", 10, 20, true, function (row, idx) {
                    rows.push(row);
                }, function () {
                    var filterRows = allRows.filter(function (r) { return r.id >= 10 && r.id <= 20; }).reverse();
                    var condition = utilities_1.objectsEqual(rows, filterRows);
                    exports.myConsole.assert(condition, "Select Range Test (Reverse)");
                    condition ? res() : rej({ e: filterRows, g: rows });
                }, rej);
            });
        }).then(function () {
            // Select a range of rows using a range of the index with reverse
            return new Promise(function (res, rej) {
                var rows = [];
                adapter.readMulti("test", "offset", 10, 20, true, function (row, idx) {
                    rows.push(row);
                }, function () {
                    var filterRows = allRows.filter(function (r, i) { return i >= 499 - 30 && i < 499 - 10; }).reverse();
                    var condition = utilities_1.objectsEqual(rows, filterRows);
                    exports.myConsole.assert(condition, "Select Offset Test (Reverse)");
                    condition ? res() : rej({ e: filterRows, g: rows });
                }, rej);
            });
        }).then(function () {
            // Select a range of rows using a range of the index with reverse
            return new Promise(function (res, rej) {
                var rows = [];
                adapter.readMulti("test", "all", undefined, undefined, true, function (row, idx) {
                    rows.push(row);
                }, function () {
                    var filterRows = allRows.slice().reverse();
                    var condition = utilities_1.objectsEqual(rows, filterRows);
                    exports.myConsole.assert(condition, "Select All Rows Test (reverse)");
                    condition ? res() : rej({ e: filterRows, g: rows });
                }, rej);
            });
        }).then(function () {
            // Select a range of rows using a range of the index
            return new Promise(function (res, rej) {
                var rows = [];
                adapter.readMulti("test", "range", 10, 20, false, function (row, idx) {
                    rows.push(row);
                }, function () {
                    var filterRows = allRows.filter(function (r) { return r.id >= 10 && r.id <= 20; });
                    var condition = utilities_1.objectsEqual(rows, filterRows);
                    exports.myConsole.assert(condition, "Select Range Test 2");
                    condition ? res() : rej({ e: filterRows, g: rows });
                }, rej);
            });
        }).then(function () {
            // Select a range of rows given a lower and upper limit primary key
            return new Promise(function (res, rej) {
                var rows = [];
                adapter.readMulti("test", "offset", 10, 20, false, function (row, idx) {
                    rows.push(row);
                }, function () {
                    var condition = utilities_1.objectsEqual(rows, allRows.filter(function (r) { return r.id > 10 && r.id <= 30; }));
                    exports.myConsole.assert(condition, "Select Offset / Limit Test");
                    condition ? res() : rej({ g: rows, e: allRows.filter(function (r) { return r.id > 10 && r.id <= 30; }) });
                }, rej);
            });
        }).then(function () {
            // Select entire table
            return new Promise(function (res, rej) {
                var rows = [];
                adapter.readMulti("test", "all", undefined, undefined, false, function (row, idx) {
                    rows.push(row);
                }, function () {
                    var condition = utilities_1.objectsEqual(rows, allRows);
                    exports.myConsole.assert(condition, "Select Entire Table");
                    condition ? res() : rej({ e: allRows, g: rows });
                }, rej);
            });
        }).then(function () {
            // Select index
            return new Promise(function (res, rej) {
                adapter.getTableIndex("test", function (idx) {
                    var condition = utilities_1.objectsEqual(idx, index);
                    exports.myConsole.assert(condition, "Select Index Test");
                    condition ? res() : rej({
                        e: index,
                        g: idx
                    });
                }, rej);
            });
        }).then(function () {
            // Select index length
            return new Promise(function (res, rej) {
                adapter.getTableIndexLength("test", function (idx) {
                    var condition = idx === 500;
                    exports.myConsole.assert(condition, "Select Index Length Test");
                    condition ? res() : rej({ e: 500, g: idx });
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                adapter.dropTable("test", function () {
                    adapter.disconnect(res, rej);
                }, rej);
            });
        });
    };
    nanoSQLAdapterTest.prototype.RangeReadsUUID = function () {
        var _a;
        var adapter = new ((_a = this.adapter).bind.apply(_a, [void 0].concat(this.args)))();
        var nSQL = new _1.nanoSQL();
        var allRows = [];
        var index = [];
        return new Promise(function (res, rej) {
            adapter.nSQL = nSQL;
            adapter.connect("123", function () {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: utilities_1.uuid(),
                    name: "test",
                    model: {
                        "id:uuid": { pk: true },
                        "name:string": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "uuid"
                        },
                        {
                            key: "name",
                            type: "string"
                        }
                    ],
                    indexes: {},
                    actions: [],
                    views: [],
                    queries: {},
                    pkType: "uuid",
                    pkCol: ["id"],
                    isPkNum: false,
                    ai: false
                }, res, rej);
            }, rej);
        }).then(function () {
            return new Promise(function (res, rej) {
                var titles = [];
                for (var i = 0; i < 500; i++) {
                    var id = utilities_1.uuid();
                    allRows.push({ id: id, name: "Title " + i });
                    titles.push("Title " + i);
                    index.push(id);
                }
                index.sort(function (a, b) { return a > b ? 1 : -1; });
                allRows.sort(function (a, b) { return a.id > b.id ? 1 : -1; });
                utilities_1.chainAsync(allRows, function (row, i, done) {
                    adapter.write("test", row.id, row, done, rej);
                }).then(res);
            });
        }).then(function () {
            // Select a range of rows using a range of the index
            return new Promise(function (res, rej) {
                var rows = [];
                adapter.readMulti("test", "offset", 10, 20, false, function (row, idx) {
                    rows.push(row);
                }, function () {
                    var condition = utilities_1.objectsEqual(rows, allRows.filter(function (r, i) { return i >= 10 && i < 30; }));
                    exports.myConsole.assert(condition, "Select Range Test 2");
                    condition ? res() : rej({ g: rows, e: allRows.filter(function (r, i) { return i >= 10 && i < 30; }) });
                }, rej);
            });
        }).then(function () {
            // Select a range of rows given a lower and upper limit primary key
            return new Promise(function (res, rej) {
                var rows = [];
                adapter.readMulti("test", "range", allRows[10].id, allRows[20].id, false, function (row, idx) {
                    rows.push(row);
                }, function () {
                    var condition = utilities_1.objectsEqual(rows, allRows.filter(function (r) { return r.id >= allRows[10].id && r.id <= allRows[20].id; }));
                    exports.myConsole.assert(condition, "Select Range Test (Primary Key)");
                    condition ? res() : rej({
                        g: rows,
                        e: allRows.filter(function (r) { return r.id >= allRows[10].id && r.id <= allRows[20].id; })
                    });
                }, rej);
            });
        }).then(function () {
            // Select entire table
            return new Promise(function (res, rej) {
                var rows = [];
                // console.time("READ");
                adapter.readMulti("test", "all", undefined, undefined, false, function (row, idx) {
                    rows.push(row);
                }, function () {
                    // console.timeEnd("READ");
                    var condition = utilities_1.objectsEqual(rows, allRows);
                    exports.myConsole.assert(condition, "Select Entire Table Test");
                    condition ? res() : rej({ e: allRows, g: rows });
                }, rej);
            });
        }).then(function () {
            // Select index
            return new Promise(function (res, rej) {
                adapter.getTableIndex("test", function (idx) {
                    var condition = utilities_1.objectsEqual(idx, index);
                    exports.myConsole.assert(condition, "Select Index Test");
                    condition ? res() : rej({
                        e: index,
                        g: idx
                    });
                }, rej);
            });
        }).then(function () {
            // Select index length
            return new Promise(function (res, rej) {
                adapter.getTableIndexLength("test", function (len) {
                    var condition = len === 500;
                    exports.myConsole.assert(condition, "Select Index Length Test");
                    condition ? res() : rej({ e: 500, g: len });
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                adapter.dropTable("test", function () {
                    adapter.disconnect(res, rej);
                }, rej);
            });
        });
    };
    nanoSQLAdapterTest.prototype.Writes = function () {
        var _a;
        var adapter = new ((_a = this.adapter).bind.apply(_a, [void 0].concat(this.args)))();
        var nSQL = new _1.nanoSQL();
        return new Promise(function (res, rej) {
            adapter.nSQL = nSQL;
            adapter.connect("123", function () {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: utilities_1.uuid(),
                    name: "test",
                    model: {
                        "id:int": { pk: true, ai: true },
                        "name:string": {},
                        "posts:string[]": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "int"
                        },
                        {
                            key: "name",
                            type: "string"
                        },
                        {
                            key: "posts",
                            type: "string[]"
                        }
                    ],
                    indexes: {},
                    actions: [],
                    views: [],
                    queries: {},
                    pkType: "int",
                    pkCol: ["id"],
                    isPkNum: true,
                    ai: true
                }, res, rej);
            }, rej);
        }).then(function () {
            // make sure new rows are added correctly
            return new Promise(function (res, rej) {
                adapter.write("test", null, { name: "Test", posts: [1, 2] }, function (pk) {
                    adapter.read("test", pk, function (row) {
                        var expectRow = { name: "Test", id: 1, posts: [1, 2] };
                        var condition = utilities_1.objectsEqual(row, expectRow);
                        exports.myConsole.assert(condition, "Insert Test");
                        condition ? res() : rej({ e: expectRow, g: row });
                    }, rej);
                }, rej);
            });
        }).then(function () {
            // Make sure existing rows are updated correctly
            return new Promise(function (res, rej) {
                adapter.write("test", 1, { id: 1, name: "Testing", posts: [1, 2] }, function (pk) {
                    adapter.read("test", pk, function (row) {
                        var expectRow = { name: "Testing", id: 1, posts: [1, 2] };
                        var condition = utilities_1.objectsEqual(row, expectRow);
                        exports.myConsole.assert(condition, "Update Test");
                        condition ? res() : rej({ e: expectRow, g: row });
                    }, rej);
                }, rej);
            });
        }).then(function () {
            // Make sure existing rows are replaced correctly
            return new Promise(function (res, rej) {
                adapter.write("test", 1, { id: 1, name: "Testing" }, function (pk) {
                    adapter.read("test", pk, function (row) {
                        var expectRow = { name: "Testing", id: 1 };
                        var condition = utilities_1.objectsEqual(row, expectRow);
                        exports.myConsole.assert(condition, "Replace Test");
                        condition ? res() : rej({ e: expectRow, g: row });
                    }, rej);
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                adapter.dropTable("test", function () {
                    adapter.disconnect(res, rej);
                }, rej);
            });
        });
    };
    nanoSQLAdapterTest.prototype.PrimaryKeys = function () {
        var _a;
        var adapter = new ((_a = this.adapter).bind.apply(_a, [void 0].concat(this.args)))();
        var nSQL = new _1.nanoSQL();
        return new Promise(function (res, rej) {
            adapter.nSQL = nSQL;
            adapter.connect("123", function () {
                Promise.all([
                    "test", "test2", "test3", "test4", "test5", "test6", "test7", "test8"
                ].map(function (t) {
                    return new Promise(function (res2, rej2) {
                        nanoSQLAdapterTest.newTable(adapter, nSQL, t, {
                            id: utilities_1.uuid(),
                            name: "test",
                            model: {
                                "test": {
                                    "id:int": { pk: true, ai: true },
                                    "name:string": {}
                                },
                                "test2": {
                                    "id:uuid": { pk: true },
                                    "name:string": {}
                                },
                                "test3": {
                                    "id:timeId": { pk: true },
                                    "name:string": {}
                                },
                                "test4": {
                                    "id:timeIdms": { pk: true },
                                    "name:string": {}
                                },
                                "test5": {
                                    "id:uuid": { pk: true },
                                    "name:string": {}
                                },
                                "test6": {
                                    "id:float": { pk: true },
                                    "name:string": {}
                                },
                                "test7": {
                                    "nested:obj": {
                                        model: { "id:int": { pk: true } }
                                    },
                                    "name:string": {}
                                },
                                "test8": {
                                    "id:string": { pk: true },
                                    "name:string": {}
                                },
                            }[t],
                            columns: [
                                {
                                    "test": {
                                        key: "id",
                                        type: "int"
                                    },
                                    "test2": {
                                        key: "id",
                                        type: "uuid"
                                    },
                                    "test3": {
                                        key: "id",
                                        type: "timeId"
                                    },
                                    "test4": {
                                        key: "id",
                                        type: "timeIdms"
                                    },
                                    "test5": {
                                        key: "id",
                                        type: "uuid"
                                    },
                                    "test6": {
                                        key: "id",
                                        type: "float"
                                    },
                                    "test7": {
                                        key: "nested",
                                        model: [
                                            { key: "id", type: "int" }
                                        ]
                                    },
                                    "test8": {
                                        key: "id",
                                        type: "string"
                                    }
                                }[t],
                                {
                                    key: "name",
                                    type: "string"
                                }
                            ],
                            indexes: {},
                            actions: [],
                            queries: {},
                            views: [],
                            pkType: {
                                test: "int",
                                test2: "uuid",
                                test3: "timeId",
                                test4: "timeIdms",
                                test5: "uuid",
                                test6: "float",
                                test7: "int",
                                test8: "string"
                            }[t],
                            pkCol: t === "test7" ? ["nested", "id"] : ["id"],
                            isPkNum: {
                                test: true,
                                test2: false,
                                test3: false,
                                test4: false,
                                test5: false,
                                test6: true,
                                test7: true,
                                test8: false
                            }[t],
                            ai: {
                                test: true,
                                test2: false,
                                test3: false,
                                test4: false,
                                test5: false,
                                test6: false,
                                test7: false,
                                test8: false
                            }[t]
                        }, res2, rej2);
                    });
                })).then(res).catch(rej);
            }, rej);
        }).then(function () {
            // Auto incriment test
            return new Promise(function (res, rej) {
                adapter.write("test", null, { name: "Test" }, function (pk) {
                    var condition = utilities_1.objectsEqual(pk, 1);
                    exports.myConsole.assert(condition, "Test Auto Incriment Integer.");
                    condition ? (function () {
                        adapter.read("test", 1, function (row) {
                            var condition2 = utilities_1.objectsEqual(row.id, 1);
                            exports.myConsole.assert(condition2, "Select Integer Primary Key.");
                            condition2 ? res() : rej({ e: 1, g: row.id });
                        }, rej);
                    })() : rej(pk);
                }, rej);
            });
        }).then(function () {
            // UUID test
            return new Promise(function (res, rej) {
                adapter.write("test2", null, { name: "Test" }, function (pk) {
                    var condition = pk.match(/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/);
                    exports.myConsole.assert(condition, "Test UUID.");
                    condition ? (function () {
                        adapter.read("test2", pk, function (row) {
                            var condition2 = utilities_1.objectsEqual(row.id, pk);
                            exports.myConsole.assert(condition2, "Select UUID Primary Key.");
                            condition2 ? res() : rej({ e: pk, g: row.id });
                        }, rej);
                    })() : rej({ e: "valid uuid", g: pk });
                }, rej);
            });
        }).then(function () {
            // TimeID Test
            return new Promise(function (res, rej) {
                adapter.write("test3", null, { name: "Test" }, function (pk) {
                    var condition = pk.match(/^\w{10}-\w{1,5}$/);
                    exports.myConsole.assert(condition, "Test timeId.");
                    condition ? (function () {
                        adapter.read("test3", pk, function (row) {
                            var condition2 = utilities_1.objectsEqual(row.id, pk);
                            exports.myConsole.assert(condition2, "Select timeId Primary Key.");
                            condition2 ? res() : rej({ e: pk, g: row.id });
                        }, rej);
                    })() : rej({ e: "valid timeid", g: pk });
                }, rej);
            });
        }).then(function () {
            // TimeIDMS test
            return new Promise(function (res, rej) {
                adapter.write("test4", null, { name: "Test" }, function (pk) {
                    var condition = pk.match(/^\w{13}-\w{1,5}$/);
                    exports.myConsole.assert(condition, "Test timeIdms.");
                    condition ? (function () {
                        adapter.read("test4", pk, function (row) {
                            var condition2 = utilities_1.objectsEqual(row.id, pk);
                            exports.myConsole.assert(condition2, "Select timeIdms Primary Key.");
                            condition2 ? res() : rej({ e: pk, g: row.id });
                        }, rej);
                    })() : rej({ e: "valid timeidms", g: pk });
                }, rej);
            });
        }).then(function () {
            // Ordered String Primary Key Test
            return new Promise(function (res, rej) {
                var UUIDs = [];
                for (var i = 0; i < 20; i++) {
                    UUIDs.push(utilities_1.uuid());
                }
                utilities_1.chainAsync(UUIDs, function (uuid, i, done) {
                    adapter.write("test5", uuid, { id: uuid, name: "Test " + i }, done, rej);
                }).then(function () {
                    UUIDs.sort();
                    var keys = [];
                    adapter.readMulti("test5", "all", undefined, undefined, false, function (row, idx) {
                        keys.push(row.id);
                    }, function () {
                        var condition = utilities_1.objectsEqual(keys, UUIDs);
                        exports.myConsole.assert(condition, "Test Sorted Primary Keys.");
                        condition ? res() : rej({ e: UUIDs, g: keys });
                    }, rej);
                });
            });
        }).then(function () {
            // Ordered Float PK Test
            return new Promise(function (res, rej) {
                var floats = [];
                for (var i = 0; i < 20; i++) {
                    floats.push({ id: Math.random(), name: "Test " + i });
                }
                utilities_1.chainAsync(floats, function (row, i, next) {
                    adapter.write("test6", row.id, row, next, rej);
                }).then(function () {
                    var rows = [];
                    adapter.readMulti("test6", "all", undefined, undefined, false, function (row) {
                        rows.push(row);
                    }, function () {
                        var condition = utilities_1.objectsEqual(rows, floats.sort(function (a, b) { return a.id > b.id ? 1 : -1; }));
                        exports.myConsole.assert(condition, "Test float primary keys.");
                        condition ? (function () {
                            adapter.read("test6", floats[0].id, function (row) {
                                var condition2 = utilities_1.objectsEqual(row.id, floats[0].id);
                                exports.myConsole.assert(condition2, "Select Float Primary Key.");
                                condition2 ? res() : rej({ e: floats[0].id, g: row.id });
                            }, rej);
                        })() : rej({
                            e: floats.sort(function (a, b) { return a.id > b.id ? 1 : -1; }),
                            g: rows
                        });
                    }, rej);
                }).catch(rej);
            });
        }).then(function () {
            // Nested PK Test
            return new Promise(function (res, rej) {
                var nestedPKRows = [];
                for (var i = 1; i < 20; i++) {
                    nestedPKRows.push({ nested: { id: i }, name: "Test " + i });
                }
                utilities_1.chainAsync(nestedPKRows, function (row, i, next) {
                    adapter.write("test7", row.nested.id, row, next, rej);
                }).then(function () {
                    var rows = [];
                    adapter.readMulti("test7", "all", undefined, undefined, false, function (row) {
                        rows.push(row);
                    }, function () {
                        var condition = utilities_1.objectsEqual(rows, nestedPKRows);
                        exports.myConsole.assert(condition, "Test Nested primary keys.");
                        condition ? (function () {
                            adapter.read("test7", nestedPKRows[2].nested.id, function (row) {
                                var condition2 = utilities_1.objectsEqual(row.nested.id, nestedPKRows[2].nested.id);
                                exports.myConsole.assert(condition2, "Select Nested Primary Key.");
                                condition2 ? res() : rej({ e: nestedPKRows[0].nested.id, g: row.id });
                            }, rej);
                        })() : rej({
                            e: nestedPKRows.sort(function (a, b) { return a.id > b.id ? 1 : -1; }),
                            g: rows
                        });
                    }, rej);
                }).catch(rej);
            });
        }).then(function () {
            // Sorted string test
            return new Promise(function (res, rej) {
                var nestedPKRows = [];
                var stringValues = " !#$%&'()*+,-./0123456789;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~".split("");
                for (var i = 0; i < stringValues.length; i++) {
                    nestedPKRows.push({ id: stringValues[i], name: "Test " + i });
                }
                utilities_1.chainAsync(nestedPKRows, function (row, i, next) {
                    adapter.write("test8", row.id, row, next, rej);
                }).then(function () {
                    var rows = [];
                    adapter.readMulti("test8", "all", undefined, undefined, false, function (row) {
                        rows.push(row);
                    }, function () {
                        var condition = utilities_1.objectsEqual(rows, nestedPKRows);
                        exports.myConsole.assert(condition, "Test strings sort properly.");
                        condition ? res() : rej({ e: nestedPKRows, g: rows });
                    }, rej);
                }).catch(rej);
            });
        }).then(function () {
            return Promise.all([
                "test", "test2", "test3", "test4", "test5", "test6", "test7", "test8"
            ].map(function (table) { return new Promise(function (res, rej) {
                adapter.dropTable(table, res, rej);
            }); })).then(function () {
                return new Promise(function (res, rej) {
                    adapter.disconnect(res, rej);
                });
            });
        });
    };
    return nanoSQLAdapterTest;
}());
exports.nanoSQLAdapterTest = nanoSQLAdapterTest;
//# sourceMappingURL=adapter-test.js.map