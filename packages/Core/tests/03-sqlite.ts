import { expect, assert } from "chai";
import "mocha";
import { TestDBs, JSON2CSV, CSV2JSON, cleanNsqlJoin  } from "./init";
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

    it("Function Select", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM users WHERE balance > ?;`, [10], (nSQL) => {
                return nSQL.selectTable("users").query("select").where((row) => row.balance > 10).exec();
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

    it("Join Query 1", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * from posts INNER JOIN users ON posts.userId = users.id ORDER BY id`, [], (nSQL) => {
                return nSQL.selectTable("posts").query("select").join({
                    type: "inner",
                    with: {table: "users"},
                    on: ["users.id", "=", "posts.userId"]
                }).orderBy(["id"]).exec();
            }).then((result) => {

                try {
                    expect(result[1]).to.deep.equal(cleanNsqlJoin(result[0]));
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Join Query 2", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * from posts LEFT JOIN users ON posts.userId = users.id WHERE userId = ? ORDER BY id`, [2], (nSQL) => {
                return nSQL.selectTable("posts").query("select").where(["userId", "=", 2]).join({
                    type: "left",
                    with: {table: "users"},
                    on: ["users.id", "=", "posts.userId"]
                }).orderBy(["id"]).exec();
            }).then((result) => {

                try {
                    expect(result[1]).to.deep.equal(cleanNsqlJoin(result[0]));
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Update Query 1", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`UPDATE users SET username = ? WHERE id = ?;`, ["Billy", 2], (nSQL) => {
                return nSQL.selectTable("users").query("upsert", {username: "Billy"}).where(["id", "=", 2]).exec();
            }).then((result) => {
                dbs.runQuery(`SELECT * FROM users WHERE id = ?`, [2], (nSQL) => {
                    return nSQL.selectTable("users").query("select").where(["id", "=", 2]).exec();
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

    it("Update Query 2", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`UPDATE users SET username = ? WHERE id > ?;`, ["Billy", 2], (nSQL) => {
                return nSQL.selectTable("users").query("upsert", {username: "Billy"}).where(["id", ">", 2]).exec();
            }).then((result) => {
                dbs.runQuery(`SELECT * FROM users WHERE id > ?`, [2], (nSQL) => {
                    return nSQL.selectTable("users").query("select").where(["id", ">", 2]).exec();
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

    it("Group By Query 1", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT id, COUNT(*) from posts GROUP BY userId ORDER BY id`, [], (nSQL) => {
                return nSQL.selectTable("posts").query("select", ["id", "COUNT(*)"]).groupBy(["userId"]).orderBy(["id"]).exec();
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

    it("Group By Query 2", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT name, COUNT(*) from comments GROUP BY postId ORDER BY id;`, [], (nSQL) => {
                return nSQL.selectTable("comments").query("select", ["name", "COUNT(*)"]).groupBy(["postId"]).orderBy(["id"]).exec();
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

    it("Order By Query 1", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM comments ORDER BY name;`, [], (nSQL) => {
                return nSQL.selectTable("comments").query("select").orderBy(["name"]).exec();
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

    it("Order By Query 2", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM comments ORDER BY name, email;`, [], (nSQL) => {
                return nSQL.selectTable("comments").query("select").orderBy(["name", "email"]).exec();
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

    it("Order By Query 3", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM comments ORDER BY name DESC, email;`, [], (nSQL) => {
                return nSQL.selectTable("comments").query("select").orderBy(["name desc", "email"]).exec();
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

    it("Delete Query 1", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`DELETE FROM comments WHERE postId = ?;`, [3], (nSQL) => {
                return nSQL.selectTable("comments").query("delete").where(["postId", "=", 3]).exec();
            }).then((result) => {
                dbs.runQuery(`SELECT * FROM comments ORDER BY id;`, [], (nSQL) => {
                    return nSQL.selectTable("comments").query("select").orderBy(["id"]).exec();
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

    it("Limit Offset Query 1", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM comments LIMIT 10 OFFSET 5;`, [], (nSQL) => {
                return nSQL.selectTable("comments").query("select").limit(10).offset(5).exec();
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

    it("Limit Offset Query 2", (done: MochaDone) => {
        TestDBs().then((dbs) => {
            dbs.runQuery(`SELECT * FROM comments GROUP BY postId LIMIT 10 OFFSET 5;`, [], (nSQL) => {
                return nSQL.selectTable("comments").query("select").groupBy(["postId"]).limit(10).offset(5).exec();
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