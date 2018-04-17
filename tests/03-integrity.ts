import { NanoSQLInstance } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";


describe("Data Integrity", () => {
    it("Columns should be force type casted", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.query("upsert", {
                name: 500,
                age: "20",
                email: "bill@gmail.com",
                meta: {value: 1},
                posts: ["1", 2.0, "3"]
            }).exec().then(() => {
                nSQL.query("select").exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {
                                id: 1,
                                name: "500",
                                age: 20,
                                email: "bill@gmail.com",
                                meta: {value: 1},
                                posts: [1, 2, 3]
                            }], "Runtime type casting failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });

        });
    });

    it("Default values should automatically insert", (done: MochaDone) => {
        usersDB([
            {key: "id", type: "int", props: ["pk()", "ai()"]},
            {key: "name", type: "string"},
            {key: "title", type: "string", default: "Captain"},
            {key: "age", type: "int"}
        ], (nSQL) => {
            nSQL.query("upsert", {
                name: "Bill"
            }).exec().then(() => {
                nSQL.query("select").exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {
                                id: 1,
                                name: "Bill",
                                title: "Captain"
                            }], "Default values failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });

        });
    });
});