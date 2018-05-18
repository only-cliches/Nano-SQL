import { NanoSQLInstance } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

describe("Where", () => {
    it("Select single row by primary key.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where(["id", "=", 2]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([{id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]}], "Single primary key select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select by inner object value.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where(["posts.length", ">", 1]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Select by inner object failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select by intersection.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where(["posts", "INTERSECT", [3]]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Select by intersection failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select single row with function.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where(r => r.id === 2).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([{id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]}], "Single primary key select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select multiple rows by arbitrary value.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where(["age", ">=", 21]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]},
                            {id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]}
                        ], "Multiple row select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select multiple rows by Levenshtein distance.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where(["levenshtein(bib, name)", "<", 3]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]},
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Levenshtein select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select multiple rows using IN statement", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where(["age", "IN", [20, 21]]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Multiple row select with IN failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select multiple rows using BETWEEN statement", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where(["age", "BETWEEN", [19, 21]]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]},
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]}
                        ], "Multiple row select with IN failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select single row by secondary index.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where(["name", "=", "Bill"]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]}
                        ], "Single row select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select using AND statement.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where([["name", "=", "Bill"], "AND", ["age", "=", 20]]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]}
                        ], "AND select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select using OR statement.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where([["name", "=", "Bill"], "OR", ["age", "=", 21]]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Or select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select using Compound WHERE statement.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table(ExampleUsers).query("select").where([["name", "=", "Bill"], "AND", ["age", "=", 20], "OR", ["email", "=", "bob@gmail.com"]]).exec().then((rows) => {

                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Compound where select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select using Compound WHERE statement (2).", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").where([["name", "=", "Bill"], "OR", ["age", "=", 24], "OR", ["email", "=", "bob@gmail.com"]]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
                            {id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]},
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Compound where select failed (2)!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Select using range.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").range(2, 1).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]},
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Range select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Range and Limit/Offset should match.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").range(2, 1).exec().then((rows) => {
                    nSQL.table("users").query("select").limit(2).offset(1).exec().then((rows2) => {
                        try {
                            expect(rows).to.deep.equal(rows2, "Limit/offset and range don't match!");
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });

                });
            });
        });
    });

    it("Select using trie.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").trieSearch("email", "bo").exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Trie select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

});