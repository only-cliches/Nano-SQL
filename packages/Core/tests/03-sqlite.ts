import { expect, assert } from "chai";
import "mocha";
import { TestDBs, JSON2CSV, CSV2JSON  } from "./init";
import { comments, users, posts } from "./data";
import { NanoSQL } from "../src";
import { INanoSQLInstance } from "../src/interfaces";


describe("Equivalent SQLite Queries Should Match", () => {
    it("Simple Select", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM users;`, [], (nSQL) => {
                return nSQL.selectTable("users").query("select").exec();
            }).then((result) => {
                try {
                    expect(result[1]).to.deep.equal(result[0]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("WHERE Statement 1", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM users WHERE balance > ?;`, [10], (nSQL) => {
                return nSQL.selectTable("users").query("select").where(["balance", ">", 10]).exec();
            }).then((result) => {
                try {
                    expect(result[1]).to.deep.equal(result[0]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("WHERE Statement 2", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM users WHERE age < ?;`, [30], (nSQL) => {
                return nSQL.selectTable("users").query("select").where(["age", "<", 30]).exec();
            }).then((result) => {
                try {
                    expect(result[1]).to.deep.equal(result[0]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("WHERE Statement 3", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM users WHERE age BETWEEN ? AND ?;`, [20, 30], (nSQL) => {
                return nSQL.selectTable("users").query("select").where(["age", "BETWEEN", [20, 30]]).exec();
            }).then((result) => {
                try {
                    expect(result[1]).to.deep.equal(result[0]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Compound WHERE Statement 1", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM users WHERE age > ? AND subscribed = ?;`, [20, false], (nSQL) => {
                return nSQL.selectTable("users").query("select").where([["age", ">", 20], "AND", ["subscribed", "=", false]]).exec();
            }).then((result) => {
                try {
                    expect(result[1]).to.deep.equal(result[0]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Compound WHERE Statement 2", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM users WHERE age > ? AND balance > ?;`, [20, 20], (nSQL) => {
                return nSQL.selectTable("users").query("select").where([["age", ">", 20], "AND", ["balance", ">", 20]]).exec();
            }).then((result) => {
                try {
                    expect(result[1]).to.deep.equal(result[0]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Compound WHERE Statement 3", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM users WHERE age > ? OR balance > ?;`, [20, 20], (nSQL) => {
                return nSQL.selectTable("users").query("select").where([["age", ">", 20], "OR", ["balance", ">", 20]]).exec();
            }).then((result) => {
                try {
                    expect(result[1]).to.deep.equal(result[0]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Function Query 1", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT AVG(age) AS averageAge FROM users;`, [], (nSQL) => {
                return nSQL.selectTable("users").query("select", ["AVG(age) AS averageAge"]).exec();
            }).then((result) => {
                try {
                    expect(result[1]).to.deep.equal(result[0]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Function Query 2", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT SUM(age) AS totalAge FROM users WHERE age > ?;`, [25], (nSQL) => {
                return nSQL.selectTable("users").query("select", ["SUM(age) AS totalAge"]).where(["age", ">", 25]).exec();
            }).then((result) => {
                try {
                    expect(result[1]).to.deep.equal(result[0]);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
});