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

import { myConsole, equals } from "./utils";
import { chainAsync, uuid } from "../src/utilities";
import { INanoSQLAdapter, INanoSQLAdapterConstructor, INanoSQLInstance, INanoSQLTableConfig, INanoSQLTable } from "../src/interfaces";
import { SyncStorage } from "../src/adapters/syncStorage";
import { nanoSQL } from "../src";

export class TestAdapter {

    constructor(
        public adapter: INanoSQLAdapterConstructor,
        public args: any[]
    ) {

    }

    public test() {
        return this.PrimaryKeys().then(() => {
            // console.log("✓ Primary Key Tests Passed");
            return this.Writes();
        }).then(() => {
            // console.log("✓ Write Tests Passed");
            return this.RangeReads();
        }).then(() => {
            // console.log("✓ Range Read Tests Passed (number)");
            return this.RangeReadsUUID();
        }).then(() => {
            // console.log("✓ Range Read Tests Passed (uuid)");
            return this.Deletes();
        }).then(() => {
            //console.log("✓ Delete Tests Passed");
            // console.log("✓ All Tests Passed!******");
        });
        /*.catch((e) => {
            console.error("Test Failed", e);
        });*/
    }

    public static newTable(adapter: INanoSQLAdapter, nSQL: INanoSQLInstance, tableName: string, tableConfig: INanoSQLTable, complete: () => void, error: () => void) {
        adapter.nSQL = nSQL;
        adapter.createAndInitTable(tableName, tableConfig, () => {
            nSQL.tables[tableName] = tableConfig;
            complete();
        }, error);
    }

    public Deletes() {
        const adapter: INanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: INanoSQLInstance = new nanoSQL();

        let allRows: any[] = [];
        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                TestAdapter.newTable(adapter, nSQL, "test", {
                    model: {
                        "id:int": {ai: true, pk: true},
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
                    offsets: [],
                    actions: [],
                    views: [],
                    pkType: "int",
                    pkCol: "id",
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
                        const condition = equals(rows, allRows.filter(r => r.id !== 3));
                        myConsole.assert(condition, "Delete Test");
                        condition ? res() : rej(rows);
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

    public RangeReads() {
        const adapter: INanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: INanoSQLInstance = new nanoSQL();

        let allRows: any[] = [];
        let index: any[] = [];
        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                TestAdapter.newTable(adapter, nSQL, "test", {
                    model: {
                        "id:int": {ai: true, pk: true},
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
                    offsets: [],
                    actions: [],
                    views: [],
                    pkType: "int",
                    pkCol: "id",
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
            // Select a range of rows using a range of the index
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "range", 10, 20, false, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const condition = equals(rows, allRows.filter(r => r.id >= 10 && r.id < 20));
                    myConsole.assert(condition, "Select Range Test 1");
                    condition ? res() : rej(rows);
                }, rej);
            });
        }).then(() => {
            // Select a range of rows given a lower and upper limit primary key
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "offset", 10, 20, false, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const condition = equals(rows, allRows.filter(r => r.id > 10 && r.id <= 30));
                    myConsole.assert(condition, "Select Offset / Limit Test");
                    condition ? res() : rej({g: rows, e: allRows.filter(r => r.id > 10 && r.id <= 30)});
                }, rej);
            });
        }).then(() => {
            // Select entire table
            return new Promise((res, rej) => {
                let rows: any[] = [];
                adapter.readMulti("test", "all", undefined, undefined, false, (row, idx) => {
                    rows.push(row);
                }, () => {
                    const condition = equals(rows, allRows);
                    myConsole.assert(condition, "Select Entire Table");
                    condition ? res() : rej(rows);
                }, rej);
            });
        }).then(() => {
            // Select index
            return new Promise((res, rej) => {
                adapter.getIndex("test", (idx) => {
                    const condition = equals(idx, index);
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
                adapter.getNumberOfRecords("test", (idx) => {
                    const condition = idx === 500;
                    myConsole.assert(condition, "Select Index Length Test");
                    condition ? res() : rej(idx);
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
        const adapter: INanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: INanoSQLInstance = new nanoSQL();

        let allRows: any[] = [];
        let index: any[] = [];
        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                TestAdapter.newTable(adapter, nSQL, "test", {
                    model: {
                        "id:uuid": {pk: true},
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
                    offsets: [],
                    actions: [],
                    views: [],
                    pkType: "uuid",
                    pkCol: "id",
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
                    const condition = equals(rows, allRows.filter((r, i) => i >= 10 && i < 30));
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
                    const condition = equals(rows, allRows.filter(r => r.id >= allRows[10].id && r.id < allRows[20].id));
                    myConsole.assert(condition, "Select Range Test (Primary Key)");
                    condition ? res() : rej({
                        g: rows,
                        e: allRows.filter(r => r.id >= allRows[10].id && r.id < allRows[20].id)
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
                    const condition = equals(rows, allRows);
                    myConsole.assert(condition, "Select Entire Table Test");
                    condition ? res() : rej(rows);
                }, rej);
            });
        }).then(() => {
            // Select index
            return new Promise((res, rej) => {
                adapter.getIndex("test", (idx) => {
                    const condition = equals(idx, index);
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
                adapter.getNumberOfRecords("test", (len) => {
                    const condition = len === 500;
                    myConsole.assert(condition, "Select Index Length Test");
                    condition ? res() : rej(len);
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
        const adapter: INanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: INanoSQLInstance = new nanoSQL();

        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                TestAdapter.newTable(adapter, nSQL, "test", {
                    model: {
                        "id:int": {pk: true, ai: true},
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
                    offsets: [],
                    actions: [],
                    views: [],
                    pkType: "int",
                    pkCol: "id",
                    isPkNum: true,
                    ai: true
                }, res, rej);
            }, rej);
        }).then(() => {
            // make sure new rows are added correctly
            return new Promise((res, rej) => {
                adapter.write("test", null, { name: "Test", posts: [1, 2]}, (pk) => {
                    adapter.read("test", pk, (row) => {
                        const condition = equals(row, {name: "Test", id: 1, posts: [1, 2]});
                        myConsole.assert(condition, "Insert Test");
                        condition ? res() : rej(row);
                    }, rej);
                }, rej);
            });
        }).then(() => {
            // Make sure existing rows are updated correctly
            return new Promise((res, rej) => {
                adapter.write("test", 1, {id: 1, name: "Testing", posts: [1, 2]}, (pk) => {
                    adapter.read("test", pk, (row) => {
                        const condition = equals(row, {name: "Testing", id: 1, posts: [1, 2]});
                        myConsole.assert(condition, "Update Test");
                        condition ? res() : rej(row);
                    }, rej);
                }, rej);
            });
        }).then(() => {
            // Make sure existing rows are replaced correctly
            return new Promise((res, rej) => {
                adapter.write("test", 1, {id: 1, name: "Testing"}, (pk) => {
                    adapter.read("test", pk, (row) => {
                        const condition = equals(row, {name: "Testing", id: 1});
                        myConsole.assert(condition, "Replace Test");
                        condition ? res() : rej(row);
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
        const adapter: INanoSQLAdapter = new this.adapter(...this.args);
        const nSQL: INanoSQLInstance = new nanoSQL();

        return new Promise((res, rej) => {
            adapter.nSQL = nSQL;
            adapter.connect("123", () => {
                Promise.all([
                    "test", "test2", "test3", "test4", "test5", "test6"
                ].map(t => {
                    return new Promise((res2, rej2) => {
                        TestAdapter.newTable(adapter, nSQL, t, {
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
                                }
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
                                    }
                                }[t],
                                {
                                    key: "name",
                                    type: "string"
                                }
                            ],
                            indexes: {},
                            offsets: [],
                            actions: [],
                            views: [],
                            pkType: {
                                test: "int",
                                test2: "uuid",
                                test3: "timeId",
                                test4: "timeIdms",
                                test5: "uuid",
                                test6: "float"
                            }[t],
                            pkCol: "id",
                            isPkNum: {
                                test: true,
                                test2: false,
                                test3: false,
                                test4: false,
                                test5: false,
                                test6: true
                            }[t],
                            ai: {
                                test: true,
                                test2: false,
                                test3: false,
                                test4: false,
                                test5: false,
                                test6: false
                            }[t]
                        }, res2, rej2);
                    });
                })).then(res).catch(rej);
            }, rej);
        }).then(() => {
            // Auto incriment test
            return new Promise((res, rej) => {
                adapter.write("test", null, {name: "Test"}, (pk) => {
                    const condition = equals(pk, 1);
                    myConsole.assert(condition, "Test Auto Incriment Integer.");
                    condition ? (() => {
                        adapter.read("test", 1, (row: any) => {
                            const condition2 = equals(row.id, 1);
                            myConsole.assert(condition2, "Select Integer Primary Key.");
                            condition2 ? res() : rej();
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
                            const condition2 = equals(row.id, pk);
                            myConsole.assert(condition2, "Select UUID Primary Key.");
                            condition2 ? res() : rej();
                        }, rej);
                    })() : rej(pk);
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
                            const condition2 = equals(row.id, pk);
                            myConsole.assert(condition2, "Select timeId Primary Key.");
                            condition2 ? res() : rej();
                        }, rej);
                    })() : rej(pk);
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
                            const condition2 = equals(row.id, pk);
                            myConsole.assert(condition2, "Select timeIdms Primary Key.");
                            condition2 ? res() : rej();
                        }, rej);
                    })() : rej(pk);
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
                        const condition = equals(keys, UUIDs);
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
                        const condition = equals(rows, floats.sort((a, b) => a.id > b.id ? 1 : -1));
                        myConsole.assert(condition, "Test float primary keys.");
                        condition ? (() => {
                            adapter.read("test6", floats[0].id, (row: any) => {
                                const condition2 = equals(row.id, floats[0].id);
                                myConsole.assert(condition2, "Select Float Primary Key.");
                                condition2 ? res() : rej();
                            }, rej);
                        })() : rej({
                            e: floats.sort((a, b) => a.id > b.id ? 1 : -1),
                            g: rows
                        });
                    }, rej);
                }).catch(rej);
            });
        }).then(() => {
            return Promise.all([
                "test", "test2", "test3", "test4", "test5", "test6"
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