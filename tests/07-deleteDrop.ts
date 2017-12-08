import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

describe("Delete & Drop", () => {
    it("Remove single row with WHERE statement.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.query("delete").where(["id", "=", 2]).exec().then(() => {
                    return nSQL.query("select").where(["id", "=", 2]).exec();
                }).then((rows) => {
                    try {
                        expect(rows).to.deep.equal([], "Single row delete failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("Delete multiple rows with WHERE statement.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.query("delete").where(["age", ">", 20]).exec().then(() => {
                    return nSQL.query("select").exec();
                }).then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]}
                        ], "Multiple deletes failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Drop entire table.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.query("drop").exec().then(() => {
                    return nSQL.query("select").exec();
                }).then((rows) => {
                    try {
                        expect(rows).to.deep.equal([], "Drop failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
});
