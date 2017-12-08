import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

describe("Upsert", () => {
    it("Update single row with WHERE statement.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.query("upsert", { age: 50 }).where(["id", "=", 2]).exec().then(() => {
                    return nSQL.query("select").where(["id", "=", 2]).exec();
                }).then((rows) => {
                    try {
                        expect(rows).to.deep.equal([{id: 2, name: "Jeb", age: 50, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]}], "Single update failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Update multiple rows with WHERE statement.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.query("upsert", { age: 50 }).where(["name", "!=", "Jeb"]).exec().then(() => {
                    return nSQL.query("select").exec();
                }).then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 50, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
                            {id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]},
                            {id: 3, name: "Bob", age: 50, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
                        ], "Multiple updates failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("Insert new row.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.query("upsert",
                    {name: "Scott", age: 25, email: "scott@gmail.com", meta: {value: 2}, posts: [3, 2, 1]}
                ).exec().then(() => {
                    return nSQL.query("select").exec();
                }).then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
                            {id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]},
                            {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]},
                            {id: 4, name: "Scott", age: 25, email: "scott@gmail.com", meta: {value: 2}, posts: [3, 2, 1]}
                        ], "Single insert failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
});
