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

import { chainAsync, uuid, objectsEqual } from "./utilities";
import { InanoSQLAdapter, InanoSQLAdapterConstructor, InanoSQLInstance, InanoSQLTable } from "./interfaces";
import { nanoSQL } from ".";

export const myConsole = Object.create(console, {
    assert: {
        value: function assert(assertion, message, ...args) {
            if (typeof window === "undefined") {
                try {
                    console.assert(assertion, message, ...args);
                } catch (err) {
                    console.error(err.stack);
                }
            } else {
                console.assert(assertion, message, ...args);
            }
        },
        configurable: true,
        enumerable: true,
        writable: true,
    },
});

export class nanoSQLAdapterTest {

    constructor(
        public adapter: InanoSQLAdapterConstructor,
        public args: any[]
    ) {

    }

    public test() {
        return this.PrimaryKeys().then(() => {
            console.log("✓ Primary Key Tests Passed");
            return this.Writes();
        }).then(() => {
            console.log("✓ Write Tests Passed");
            return this.RangeReads();
        }).then(() => {
            console.log("✓ Range Read Tests Passed (number)");
            return this.RangeReadsUUID();
        }).then(() => {
            console.log("✓ Range Read Tests Passed (uuid)");
            return this.Deletes();
        }).then(() => {
            console.log("✓ Delete Tests Passed");
            return this.SecondayIndexes();
        }).then(() => {
            console.log("✓ Secondary Index Passed");
            console.log("✓ All Tests Passed!******");
        })
    }

    public static newTable(adapter: InanoSQLAdapter, nSQL: InanoSQLInstance, tableName: string, tableConfig: InanoSQLTable, complete: () => void, error: () => void) {
        adapter.nSQL = nSQL;
        adapter.createTable(tableName, tableConfig, () => {
            if (!nSQL.dbs["123"]) {
                nSQL.dbs["123"] = {
                    adapter: adapter,
                    _tables: {},
                    _tableIds: {},
                } as any;
            }
            nSQL.getDB("123")._tables[tableName] = tableConfig;
            complete();
        }, error);
    }

    public Deletes() {
        const adapter: InanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: InanoSQLInstance = new nanoSQL();

        let allRows: any[] = [];
        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: uuid(),
                    name: "test",
                    count: 0,
                    rowLocks: {},
                    model: {
                        "id:int": {ai: true, pk: true},
                        "name:string": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "int",
                            immutable: false
                        },
                        {
                            key: "name",
                            type: "string",
                            immutable: false
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
        }).then(() => {
            return new Promise((res, rej) => {
                let titles: any[] = [];
                for (let i = 0; i < 500; i++) {
                    allRows.push({id: i + 1, name: "Title " + (i + 1)});
                    titles.push("Title " + (i + 1));
                }
                chainAsync(titles, (title, i, done) => {
                    adapter.write("test", null, {name: title}, done, rej);
                }).then(res);
            });
        }).then(() => {
            return new Promise((res, rej) => {
                // single rows can be deleted.
                adapter.delete("test", 3 as any, () => {
                    let rows: any[] = [];
                    adapter.readMulti("test", "all", undefined, undefined, false, (row, idx) => {
                        rows.push(row);
                    }, () => {
                        const condition = objectsEqual(rows, allRows.filter(r => r.id !== 3));
                        myConsole.assert(condition, "Delete Test");
                        condition ? res() : rej({e: allRows.filter(r => r.id !== 3), g: rows });
                    }, rej);
                }, rej);
            });
        }).then(() => {
            return new Promise((res, rej) => {
                adapter.dropTable("test", () => {
                    adapter.disconnect(res, rej);
                }, rej);
            });
        });
    }

    public SecondayIndexes() {
        const adapter: InanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: InanoSQLInstance = new nanoSQL();

        let allRows: any[] = [];
        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: uuid(),
                    name: "test",
                    count: 0,
                    rowLocks: {},
                    model: {
                        "id:int": {ai: true, pk: true},
                        "name:string": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "int",
                            immutable: false
                        },
                        {
                            key: "name",
                            type: "string",
                            immutable: false
                        }
                    ],
                    indexes: {
                        "name": {
                            id: "name",
                            isArray: false,
                            type: "string",
                            path: ["name"],
                            props: {},
                            isDate: false
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
        }).then(() => {
            return new Promise((res, rej) => {
                let titles: any[] = [];
                for (let i = 0; i < 500; i++) {
                    let num: any = (i + 1);
                    if (num <= 9) {
                        num = "00" + num;
                    } else if (num <= 99) {
                        num = "0" + num;
                    }
                    allRows.push({id: i + 1, name: "Title " + num});
                }
                adapter.createIndex("test", "name", "string", () => {
                    chainAsync(allRows, (row, i, done) => {
                        adapter.write("test", null, row, () => {
                            adapter.addIndexValue("test", "name", row.id, row.name, done, rej);
                        }, rej);
                    }).then(res);
                }, rej);

            });
        }).then(() => {
            return new Promise((res, rej) => {
                // read secondary index
                let pks: any[] = [];
                adapter.readIndexKey("test", "name", "Title 005", (pk) => {
                    pks.push(pk);
                }, () => {
                    const condition = objectsEqual(pks, [5]);
                    myConsole.assert(condition, "Secondary Index Single Read");
                    condition ? res() : rej({e: [5], g: pks});
                }, rej);    
            });
        }).then(() => {
            return new Promise((res, rej) => {
                // read range secondary index
                let pks: any[] = [];
                adapter.readIndexKeys("test", "name", "range", "Title 004", "Title 020", false, (pk, value) => {
                    pks.push(pk);
                }, () => {
                    const filterRows = allRows.filter(r => r.name >= "Title 004" && r.name <= "Title 020").map(r => r.id);
                    const condition = objectsEqual(pks, filterRows);
                    myConsole.assert(condition, "Secondary Index Range Read");
                    condition ? res() : rej({e: filterRows, g: pks});
                }, rej); 
            });
        }).then(() => {
            return new Promise((res, rej) => {
                // read offset secondary index
                let pks: any[] = [];
                adapter.readIndexKeys("test", "name", "offset", 10, 20, false, (pk) => {
                    pks.push(pk);
                }, () => {
                    const filterRows = allRows.filter((r, i) => i >= 10 && i < 30).map(r => r.id);
                    const condition = objectsEqual(pks, filterRows);
                    myConsole.assert(condition, "Secondary Index Offset Read");
                    condition ? res() : rej({e: filterRows, g: pks});
                }, rej); 
            });
        }).then(() => {
            return new Promise((res, rej) => {
                // read range secondary index
                let pks: any[] = [];
                adapter.readIndexKeys("test", "name", "range", "Title 010", "~", true, (pk, value) => {
                    pks.push(pk);
                }, () => {
                    const filterRows = allRows.filter(r => r.name >= "Title 010").map(r => r.id).reverse();
                    const condition = objectsEqual(pks, filterRows);
                    myConsole.assert(condition, "Secondary Index Range Read Reverse");
                    condition ? res() : rej({e: filterRows, g: pks});
                }, rej); 
            });
        }).then(() => {
            return new Promise((res, rej) => {
                // read offset secondary index
                let pks: any[] = [];
                adapter.readIndexKeys("test", "name", "offset", 10, 20, true, (pk) => {
                    pks.push(pk);
                }, () => {
                    const filterRows = allRows.filter((r, i) => i >= 469 && i < 489).map(r => r.id).reverse();
                    const condition = objectsEqual(pks, filterRows);
                    myConsole.assert(condition, "Secondary Index Offset Read Reverse");
                    condition ? res() : rej({e: filterRows, g: pks});
                }, rej); 
            });
        }).then(() => {
            return new Promise((res, rej) => {
                // read offset secondary index
                let pks: any[] = [];
                adapter.deleteIndexValue("test", "name", 10, "Title 010", () => {
                    adapter.readIndexKeys("test", "name", "all", undefined, undefined, false, (pk) => {
                        pks.push(pk);
                    }, () => {
                        const filterRows = allRows.filter(r => r.id !== 10).map(r => r.id);
                        const condition = objectsEqual(pks, filterRows);
                        myConsole.assert(condition, "Secondary Index Remove Value");
                        condition ? res() : rej({e: filterRows, g: pks});
                    }, rej); 
                }, rej);

            });
        });
    }

    public RangeReads() {
        const adapter: InanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: InanoSQLInstance = new nanoSQL();

        let allRows: any[] = [];
        let index: any[] = [];
        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: uuid(),
                    name: "test",
                    count: 0,
                    rowLocks: {},
                    model: {
                        "id:int": {ai: true, pk: true},
                        "name:string": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "int",
                            immutable: false
                        },
                        {
                            key: "name",
                            type: "string",
                            immutable: false
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
        }).then(() => {
            return new Promise((res, rej) => {

                let titles: any[] = [];
                for (let i = 0; i < 500; i++) {
                    allRows.push({id: i + 1, name: "Title " + (i + 1)});
                    titles.push("Title " + (i + 1));
                    index.push(i + 1);
                }
                chainAsync(titles, (title, i, done) => {
                    adapter.write("test", null, {name: title}, done, rej);
                }).then(res);
            });
        }).then(() => {
            // Select entire table
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "all", undefined, undefined, false, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const condition = objectsEqual(rows, allRows);
                    myConsole.assert(condition, "Select Entire Table");
                    condition ? res() : rej({e: allRows, g: rows});
                }, rej);
            });
        }).then(() => {
            // Select a range of rows using a range of the index with reverse
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "all", undefined, undefined, true, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const filterRows = allRows.slice().reverse();
                    const condition = objectsEqual(rows, filterRows);
                    myConsole.assert(condition, "Select All Rows Test (reverse)");
                    condition ? res() : rej({e: filterRows, g: rows});
                }, rej);
            });
        }).then(() => {
            // Select a range of rows using a range of the index with reverse
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "range", 10, 20, true, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const filterRows = allRows.filter(r => r.id >= 10 && r.id <= 20).reverse();
                    const condition = objectsEqual(rows, filterRows);
                    myConsole.assert(condition, "Select Range Test (Reverse)");
                    condition ? res() : rej({e: filterRows, g: rows});
                }, rej);
            });
        }).then(() => {
            // Select a range of rows using a range of the index with reverse
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "offset", 10, 20, true, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const filterRows = allRows.filter((r, i) => i >= 499 - 30 && i < 499 - 10).reverse();
                    const condition = objectsEqual(rows, filterRows);
                    myConsole.assert(condition, "Select Offset Test (Reverse)");
                    condition ? res() : rej({e: filterRows, g: rows});
                }, rej);
            });
        }).then(() => {
            // Select a range of rows using a range of the index
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "range", 10, 20, false, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const filterRows = allRows.filter(r => r.id >= 10 && r.id <= 20);
                    const condition = objectsEqual(rows, filterRows);
                    myConsole.assert(condition, "Select Range Test 2");
                    condition ? res() : rej({e: filterRows, g: rows});
                }, rej);
            });
        }).then(() => {
            // Select a range of rows given a lower and upper limit primary key
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "offset", 10, 20, false, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const condition = objectsEqual(rows, allRows.filter(r => r.id > 10 && r.id <= 30));
                    myConsole.assert(condition, "Select Offset / Limit Test");
                    condition ? res() : rej({g: rows, e: allRows.filter(r => r.id > 10 && r.id <= 30)});
                }, rej);
            });
        }).then(() => {
            // Select index
            return new Promise((res, rej) => {
                adapter.getTableIndex("test", (idx) => {
                    const condition = objectsEqual(idx, index);
                    myConsole.assert(condition, "Select Index Test");
                    condition ? res() : rej({
                        e: index,
                        g: idx
                    });
                }, rej);
            });
        }).then(() => {
            // Select index length
            return new Promise((res, rej) => {
                adapter.getTableIndexLength("test", (idx) => {
                    const condition = idx === 500;
                    myConsole.assert(condition, "Select Index Length Test");
                    condition ? res() : rej({e: 500, g: idx});
                }, rej);
            });
        }).then(() => {
            return new Promise((res, rej) => {
                adapter.dropTable("test", () => {
                    adapter.disconnect(res, rej);
                }, rej);
            });
        });
    }

    public RangeReadsUUID() {
        const adapter: InanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: InanoSQLInstance = new nanoSQL();

        let allRows: any[] = [];
        let index: any[] = [];
        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: uuid(),
                    name: "test",
                    count: 0,
                    rowLocks: {},
                    model: {
                        "id:uuid": {pk: true},
                        "name:string": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "uuid",
                            immutable: false
                        },
                        {
                            key: "name",
                            type: "string",
                            immutable: false
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
        }).then(() => {
            return new Promise((res, rej) => {

                let titles: any[] = [];
                for (let i = 0; i < 500; i++) {
                    const id = uuid();
                    allRows.push({id: id, name: "Title " + i});
                    titles.push("Title " + i);
                    index.push(id);
                }
                index.sort((a, b) => a > b ? 1 : -1);
                allRows.sort((a, b) => a.id > b.id ? 1 : -1);
                chainAsync(allRows, (row, i, done) => {
                    adapter.write("test", row.id, row, done, rej);
                }).then(res);
            });
        }).then(() => {
            // Select a range of rows using a range of the index
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "offset", 10, 20, false, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const condition = objectsEqual(rows, allRows.filter((r, i) => i >= 10 && i < 30));
                    myConsole.assert(condition, "Select Range Test 2");
                    condition ? res() : rej({g: rows, e: allRows.filter((r, i) => i >= 10 && i < 30)});
                }, rej);
            });
        }).then(() => {
            // Select a range of rows given a lower and upper limit primary key
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "range", allRows[10].id, allRows[20].id, false, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const condition = objectsEqual(rows, allRows.filter(r => r.id >= allRows[10].id && r.id <= allRows[20].id));
                    myConsole.assert(condition, "Select Range Test (Primary Key)");
                    condition ? res() : rej({
                        g: rows,
                        e: allRows.filter(r => r.id >= allRows[10].id && r.id <= allRows[20].id)
                    });
                }, rej);
            });
        }).then(() => {
            // Select entire table
            return new Promise((res, rej) => {
                let rows: any[] = [];
                // console.time("READ");
                adapter.readMulti("test", "all", undefined, undefined, false, (row, idx) => {
                    rows.push(row);
                }, () => {
                    // console.timeEnd("READ");
                    const condition = objectsEqual(rows, allRows);
                    myConsole.assert(condition, "Select Entire Table Test");
                    condition ? res() : rej({e: allRows, g: rows});
                }, rej);
            });
        }).then(() => {
            // Select index
            return new Promise((res, rej) => {
                adapter.getTableIndex("test", (idx) => {
                    const condition = objectsEqual(idx, index);
                    myConsole.assert(condition, "Select Index Test");
                    condition ? res() : rej({
                        e: index,
                        g: idx
                    });
                }, rej);
            });
        }).then(() => {
            // Select index length
            return new Promise((res, rej) => {
                adapter.getTableIndexLength("test", (len) => {
                    const condition = len === 500;
                    myConsole.assert(condition, "Select Index Length Test");
                    condition ? res() : rej({e: 500, g: len});
                }, rej);
            });
        }).then(() => {
            return new Promise((res, rej) => {
                adapter.dropTable("test", () => {
                    adapter.disconnect(res, rej);
                }, rej);
            });
        });
    }

    public Writes() {
        const adapter: InanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: InanoSQLInstance = new nanoSQL();

        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                nanoSQLAdapterTest.newTable(adapter, nSQL, "test", {
                    id: uuid(),
                    name: "test",
                    count: 0,
                    rowLocks: {},
                    model: {
                        "id:int": {pk: true, ai: true},
                        "name:string": {},
                        "posts:string[]": {}
                    },
                    columns: [
                        {
                            key: "id",
                            type: "int",
                            immutable: false
                        },
                        {
                            key: "name",
                            type: "string",
                            immutable: false
                        },
                        {
                            key: "posts",
                            type: "string[]",
                            immutable: false
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
        }).then(() => {
            // make sure new rows are added correctly
            return new Promise((res, rej) => {
                adapter.write("test", null, { name: "Test",
                count: 0,
                rowLocks: {}, 
                posts: [1, 2]
            }, (pk) => {
                    adapter.read("test", pk, (row) => {
                        const expectRow = {name: "Test",
                        count: 0,
                        rowLocks: {}, id: 1, posts: [1, 2]};
                        const condition = objectsEqual(row, expectRow);
                        myConsole.assert(condition, "Insert Test");
                        condition ? res() : rej({e: expectRow, g: row});
                    }, rej);
                }, rej);
            });
        }).then(() => {
            // Make sure existing rows are updated correctly
            return new Promise((res, rej) => {
                adapter.write("test", 1, {id: 1, name: "Testing", posts: [1, 2]}, (pk) => {
                    adapter.read("test", pk, (row) => {
                        const expectRow = {name: "Testing", id: 1, posts: [1, 2]};
                        const condition = objectsEqual(row, expectRow);
                        myConsole.assert(condition, "Update Test");
                        condition ? res() : rej({e: expectRow, g: row});
                    }, rej);
                }, rej);
            });
        }).then(() => {
            // Make sure existing rows are replaced correctly
            return new Promise((res, rej) => {
                adapter.write("test", 1, {id: 1, name: "Testing"}, (pk) => {
                    adapter.read("test", pk, (row) => {
                        const expectRow = {name: "Testing", id: 1};
                        const condition = objectsEqual(row, expectRow);
                        myConsole.assert(condition, "Replace Test");
                        condition ? res() : rej({e: expectRow, g: row});
                    }, rej);
                }, rej);
            });
        }).then(() => {
            return new Promise((res, rej) => {
                adapter.dropTable("test", () => {
                    adapter.disconnect(res, rej);
                }, rej);
            });
        });
    }

    public PrimaryKeys() {
        const adapter: InanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: InanoSQLInstance = new nanoSQL();

        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                Promise.all([
                    "test", "test2", "test3", "test4", "test5", "test6", "test7", "test8"
                ].map(t => {
                    return new Promise((res2, rej2) => {
                        nanoSQLAdapterTest.newTable(adapter, nSQL, t, {
                            id: uuid(),
                            name: "test",
                            count: 0,
                            rowLocks: {},
                            model: {
                                "test": {
                                    "id:int": {pk: true, ai: true},
                                    "name:string": {}
                                },
                                "test2": {
                                    "id:uuid": {pk: true},
                                    "name:string": {}
                                },
                                "test3": {
                                    "id:timeId": {pk: true},
                                    "name:string": {}
                                },
                                "test4": {
                                    "id:timeIdms": {pk: true},
                                    "name:string": {}
                                },
                                "test5": {
                                    "id:uuid": {pk: true},
                                    "name:string": {}
                                },
                                "test6": {
                                    "id:float": {pk: true},
                                    "name:string": {}
                                },
                                "test7": {
                                    "nested:obj": {
                                        model: {"id:int": {pk: true}}
                                    },
                                    "name:string": {}
                                },
                                "test8": {
                                    "id:string": {pk: true},
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
                                            {key: "id", type: "int"}
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
        }).then(() => {
            // Auto incriment test
            return new Promise((res, rej) => {
                adapter.write("test", null, {name: "Test"}, (pk) => {
                    const condition = objectsEqual(pk, 1);
                    myConsole.assert(condition, "Test Auto Incriment Integer.");
                    condition ? (() => {
                        adapter.read("test", 1, (row: any) => {
                            const condition2 = objectsEqual(row.id, 1);
                            myConsole.assert(condition2, "Select Integer Primary Key.");
                            condition2 ? res() : rej({e: 1, g: row.id});
                        }, rej);
                    })() : rej(pk);
                }, rej);
            });
        }).then(() => {
            // UUID test
            return new Promise((res, rej) => {
                adapter.write("test2", null, { name: "Test" }, (pk) => {
                    const condition = pk.match(/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/);
                    myConsole.assert(condition, "Test UUID.");
                    condition ? (() => {
                        adapter.read("test2", pk, (row: any) => {
                            const condition2 = objectsEqual(row.id, pk);
                            myConsole.assert(condition2, "Select UUID Primary Key.");
                            condition2 ? res() : rej({e: pk, g: row.id});
                        }, rej);
                    })() : rej({e: "valid uuid", g: pk});
                }, rej);
            });
        }).then(() => {
            // TimeID Test
            return new Promise((res, rej) => {
                adapter.write("test3", null, { name: "Test" }, (pk) => {
                    const condition = pk.match(/^\w{10}-\w{1,5}$/);
                    myConsole.assert(condition, "Test timeId.");
                    condition ? (() => {
                        adapter.read("test3", pk, (row: any) => {
                            const condition2 = objectsEqual(row.id, pk);
                            myConsole.assert(condition2, "Select timeId Primary Key.");
                            condition2 ? res() : rej({e: pk, g: row.id});
                        }, rej);
                    })() : rej({e: "valid timeid", g: pk});
                }, rej);
            });
        }).then(() => {
            // TimeIDMS test
            return new Promise((res, rej) => {
                adapter.write("test4", null, { name: "Test" }, (pk) => {
                    const condition = pk.match(/^\w{13}-\w{1,5}$/);
                    myConsole.assert(condition, "Test timeIdms.");
                    condition ? (() => {
                        adapter.read("test4", pk, (row: any) => {
                            const condition2 = objectsEqual(row.id, pk);
                            myConsole.assert(condition2, "Select timeIdms Primary Key.");
                            condition2 ? res() : rej({e: pk, g: row.id});
                        }, rej);
                    })() : rej({e: "valid timeidms", g: pk});
                }, rej);
            });
        }).then(() => {
            // Ordered String Primary Key Test
            return new Promise((res, rej) => {
                let UUIDs: any[] = [];

                for (let i = 0; i < 20; i ++) {
                    UUIDs.push(uuid());
                }

                chainAsync(UUIDs, (uuid, i, done) => {
                    adapter.write("test5", uuid, {id: uuid, name: "Test " + i }, done, rej);
                }).then(() => {

                    UUIDs.sort();

                    let keys: any[] = [];
                    adapter.readMulti("test5", "all", undefined, undefined, false, (row, idx) => {
                        keys.push(row.id);
                    }, () => {
                        const condition = objectsEqual(keys, UUIDs);
                        myConsole.assert(condition, "Test Sorted Primary Keys.");
                        condition ? res() : rej({e: UUIDs, g: keys});
                    }, rej);
                });
            });
        }).then(() => {
            // Ordered Float PK Test
            return new Promise((res, rej) => {
                let floats: any[] = [];
                for (let i = 0; i < 20; i++) {
                    floats.push({id: Math.random(), name: "Test " + i});
                }
                chainAsync(floats, (row, i, next) => {
                    adapter.write("test6", row.id, row, next, rej);
                }).then(() => {
                    let rows: any[] = [];
                    adapter.readMulti("test6", "all", undefined, undefined, false, (row) => {
                        rows.push(row);
                    }, () => {
                        const condition = objectsEqual(rows, floats.sort((a, b) => a.id > b.id ? 1 : -1));
                        myConsole.assert(condition, "Test float primary keys.");
                        condition ? (() => {
                            adapter.read("test6", floats[0].id, (row: any) => {
                                const condition2 = objectsEqual(row.id, floats[0].id);
                                myConsole.assert(condition2, "Select Float Primary Key.");
                                condition2 ? res() : rej({e: floats[0].id, g: row.id});
                            }, rej);
                        })() : rej({
                            e: floats.sort((a, b) => a.id > b.id ? 1 : -1),
                            g: rows
                        });
                    }, rej);
                }).catch(rej);
            });
        }).then(() => {
            // Nested PK Test
            return new Promise((res, rej) => {
                let nestedPKRows: any[] = [];
                for (let i = 1; i < 20; i++) {
                    nestedPKRows.push({nested: {id: i}, name: "Test " + i});
                }
                chainAsync(nestedPKRows, (row, i, next) => {
                    adapter.write("test7", row.nested.id, row, next, rej);
                }).then(() => {
                    let rows: any[] = [];
                    adapter.readMulti("test7", "all", undefined, undefined, false, (row) => {
                        rows.push(row);
                    }, () => {
                        const condition = objectsEqual(rows, nestedPKRows);
                        myConsole.assert(condition, "Test Nested primary keys.");
                        condition ? (() => {
                            adapter.read("test7", nestedPKRows[2].nested.id, (row: any) => {
                                const condition2 = objectsEqual(row.nested.id, nestedPKRows[2].nested.id);
                                myConsole.assert(condition2, "Select Nested Primary Key.");
                                condition2 ? res() : rej({e: nestedPKRows[0].nested.id, g: row.id});
                            }, rej);
                        })() : rej({
                            e: nestedPKRows.sort((a, b) => a.id > b.id ? 1 : -1),
                            g: rows
                        });
                    }, rej);
                }).catch(rej);
            });
        }).then(() => {
            // Sorted string test
            return new Promise((res, rej) => {
                let nestedPKRows: any[] = [];
                let stringValues = " !#$%&'()*+,-./0123456789;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{|}~".split("");
                for (let i = 0; i < stringValues.length; i++) {
                    nestedPKRows.push({id: stringValues[i], name: "Test " + i});
                }
                chainAsync(nestedPKRows, (row, i, next) => {
                    adapter.write("test8", row.id, row, next, rej);
                }).then(() => {
                    let rows: any[] = [];
                    adapter.readMulti("test8", "all", undefined, undefined, false, (row) => {
                        rows.push(row);
                    }, () => {
                        const condition = objectsEqual(rows, nestedPKRows);
                        myConsole.assert(condition, "Test strings sort properly.");
                        condition ? res() : rej({e: nestedPKRows, g: rows});
                    }, rej);
                }).catch(rej);
            });
        }).then(() => {
            return Promise.all([
                "test", "test2", "test3", "test4", "test5", "test6", "test7", "test8"
            ].map(table => new Promise((res, rej) => {
                adapter.dropTable(table, res, rej);
            }))).then(() => {
                return new Promise((res, rej) => {
                    adapter.disconnect(res, rej);
                });
            });
        });
    }
}