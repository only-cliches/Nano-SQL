import { NanoSQLInstance } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

describe("Order By", () => {
    it("Order rows by single value.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.query("select", ["age"]).orderBy({ age: "desc" }).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([{age: 24}, {age: 21}, {age: 20}], "OrderBy failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Order rows by multiple values.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.query("select", ["age"]).orderBy({ age: "desc", name: "asc"}).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([{age: 24}, {age: 21}, {age: 20}], "OrderBy Multiple failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
});