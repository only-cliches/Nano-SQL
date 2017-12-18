import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

describe("History", () => {
    it("Roll back single row.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.query("upsert", { age: 50 }).where(["id", "=", 2]).exec().then((result) => {
                    return nSQL.extend("hist", "<");
                }).then((result) => {
                    return nSQL.query("select").exec();
                }).then((rows) => {
                    try {
                        expect(rows).to.deep.equal(ExampleUsers, "Single roll back failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        }, true);
    });
});
