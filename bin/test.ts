import { SomeSQL } from "../src/index";
import { TSPromise } from "typescript-promise";

class TestSuite {

    public data: Array<any>;

    constructor() {
        this.data = [];

        TSPromise.chain([
            this.checkInserts(),
            this.checkSelect(),
            this.checkOrderBy(),
            this.checkWhere()
        ]).then((res, rej) => {
            let passed = 0;
            res.forEach((val: Array<any>, i: number) => {
                console.log(i + 1 + ". " + val[0] + " - " + (val[1] === true ? "Passed" : val[1]));
                if (val[1] === true) passed++;
            });
            if (passed === res.length) {
                console.log("\nAll Tests Passed!");
            } else {
                let failed = res.length - passed;
                console.log("\n" + failed + " out of " + res.length + " tests failed!");
            }
        });
    }

    public checkInserts(): TSPromise<any> {
        return new TSPromise<any>((res, rej) => {
            SomeSQL("users").model([
                {key: "id", type: "int", props: ["pk", "ai"]},
                {key: "name", type: "string"},
                {key: "age", type: "int"},
                {key: "balance", type: "float"},
                {key: "postIDs", type: "array"},
                {key: "meta", type: "map"}
            ]).connect().then(() => {
                return new TSPromise((resolve, reject) => {
                    let index = 0;
                    let insert = () => {
                        let user = {
                            name: TestSuite.random(),
                            age: Math.round(Math.random() * 100),
                            balance: Math.round(Math.random() * 100000) / 100,
                            postIDs: [1, 2, 3, 4],
                            meta: {test: "test"}
                        };
                        this.data.push(user);
                        return SomeSQL("users").query("upsert", user).exec();
                    };


                    let step = () => {
                        if (index < 10) {
                            insert().then(() => {
                                index++;
                                step();
                            });
                        } else {
                            resolve();
                        }
                    };
                    step();
                });
            }).then(() => {
                return SomeSQL("users").query("select").exec().then((rows) => {
                    return new TSPromise((resolve, rej) => {
                        resolve(rows);
                    });
                });
            }).then((rows) => {
                let success = true;

                // Make sure the data has not been morphed
                this.data.forEach((val: any, i: number) => {
                    if (this.data[i].name !== rows[i].name || this.data[i].age !== rows[i].age || this.data[i].balance !== rows[i].balance) {
                        success = false;
                    }
                });

                // Make sure all rows made it to the DB
                if (this.data.length !== rows.length) {
                    success = false;
                }

                res("Inserts", success);
            });
        });
    }

    public checkSelect(): TSPromise<any> {
        return new TSPromise((res, rej) => {
            let keys = ["name", "age"];

            SomeSQL("users").query("select", keys).exec().then((rows) => {
                let success = true;
                if (!rows) {
                    success = false;
                } else {
                    rows.forEach((val: any, i: number) => {
                        let checkKeys: any[] = [];
                        for (let k in val) {
                            checkKeys.push(k);
                        }

                        if (checkKeys.length !== keys.length) {
                            success = false;
                        } else {
                            keys.forEach((k) => {
                                let i = checkKeys.indexOf(k);
                                if (i !== -1) {
                                    checkKeys.splice(i, 1);
                                }
                            });

                            if (checkKeys.length !== 0) {
                                success = false;
                            }
                        }
                    });
                }
                res("Select", success);
            });
        });
    }

    public checkOrderBy(): TSPromise<any> {
        return new TSPromise<any>((res, rej) => {
            SomeSQL("users").query("select", ["age"]).orderBy({age: "desc"}).exec().then((rows: any[]) => {
                return new TSPromise((resolve, reject) => {
                    let success = true;
                    rows.sort((a, b) => {
                        if (a.age > b.age) {
                            return 1;
                        } else {
                            success = false;
                            return -1;
                        }
                    });
                    if (success) {
                        resolve();
                    } else {
                        res("Order By", success);
                    }
                });
            }).then(() => {
                SomeSQL("users").query("select", ["age"]).orderBy({age: "asc"}).exec().then((rows: any[]) => {
                    let success = true;
                    rows.sort((a, b) => {
                        if (a.age < b.age) {
                            return -1;
                        } else {
                            success = false;
                            return 1;
                        }
                    });
                    res("Order By", success);
                });
            });
        });
    }

    public checkWhere(): TSPromise<any> {
        return new TSPromise<any>((res, rej) => {

            let i = 0;

            let queries = [
                SomeSQL("users").query("select").where(["age", ">", 50]).exec(),
                SomeSQL("users").query("select").where([["age", ">", 50], "and", ["balance", "<", 5000]]).exec()
            ];

            let results: any[] = [];

            let runWhereTest = (index: number) => {
                return new TSPromise((resolve, rej) => {
                    queries[index].then((rows) => {
                        resolve(rows);
                    });
                });
            };

            let step = () => {
                if (i < queries.length) {
                    runWhereTest(i).then((rows) => {
                        results.push(rows);
                        i++;
                        step();
                    });
                } else {
                    results.map((dbResult: any, index: number) => {
                        let success = true;
                        if (!dbResult.length) return false;
                        switch (index) {
                            case 0:
                                dbResult.forEach((row: any) => {
                                    if (row.age <= 50) {
                                        success = false;
                                    }
                                });
                                return success;
                            case 1:
                                dbResult.forEach((row: any) => {
                                    if (row.age <= 50 || row.balance >= 5000) {
                                        success = false;
                                    }
                                });
                                return success;
                            default:
                                return success;
                        }
                    });

                    let successAll = true;
                    results.forEach((didSucceed: boolean) => {
                        if (didSucceed === false) successAll = false;
                    });
                    res("Where", successAll);
                }
            };

            step();
        });
    }

    public static random(length: number = 10) {
        let text = "";
        let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for ( let i = 0; i < length; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }
}

let t = new TestSuite();