import { NanoSQLInstance } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleUsers2, ExampleDataModel } from "./data";

describe("Select", () => {
    it("Select single column.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select", ["name"]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([{name: "Bill"}, {name: "Jeb"}, {name: "Bob"}], "Single column select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("Select multiple columns.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select", ["name", "age"]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([{name: "Bill", age: 20}, {name: "Jeb", age: 24}, {name: "Bob", age: 21}], "Multi column select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("Select using LIKE.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select", ["name"]).where(["name", "LIKE", "%j%"]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([{name: "Jeb"}], "LIKE select failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("Select column using AS alias.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select", ["name AS title"]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([{title: "Bill"}, {title: "Jeb"}, {title: "Bob"}], "AS alias failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("Select inner value of row object.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select", ["posts.length", "posts[1]"]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {"posts.length": 2, "posts[1]": 3},
                            {"posts.length": 1, "posts[1]": undefined},
                            {"posts.length": 3, "posts[1]": 2}
                        ], "Select inner value failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("Secondary index range select.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers2).then(() => {
                nSQL.table("users").query("select", ["id", "age"]).where(["age", ">", 23]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            { id: 2, age: 24 },
                            { id: 6, age: 29 },
                            { id: 5, age: 30 }
                        ], "Secondary index range failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("Secondary index range select (part 2).", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers2).then(() => {
                nSQL.table("users").query("select", ["id", "age"]).where(["age", "<", 23]).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            { id: 1, age: 20 },
                            { id: 3, age: 21 }
                        ], "Secondary index range failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
});