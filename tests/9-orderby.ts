import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";

describe("Order By", () => {
    it("Order rows by single value.", (done: MochaDone) => {
        nSQL("users").query("select").orderBy({ age: "desc" }).exec().then((rows) => {
            try {
                let test = [50, 50, 45, 34, 32, 30, 28, 27, 23];
                rows.map(r => r.age).forEach((val, idx) => {
                    expect(val).to.equal(test[idx], "OrderBy failed!");
                });
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Order rows by multiple values.", (done: MochaDone) => {
        nSQL("users").query("select").orderBy({ age: "desc", name: "desc" }).exec().then((rows) => {
            try {
                let test = ["Mortimer", "Bill", "Gene", "Bob", "Jebediah", "Walt", "Scott", "Valentina", "Gus"];
                rows.map(r => r.name).forEach((val, idx) => {
                    expect(val).to.equal(test[idx], "OrderBy failed!");
                });
                done();
            } catch (e) {
                done(e);
            }
        });
    });
});