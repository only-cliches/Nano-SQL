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
});