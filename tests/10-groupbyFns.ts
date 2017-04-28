import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";


describe("Group By & Functions", () => {
    it("Group rows together given a single value.", (done: MochaDone) => {
        nSQL("users").query("select").groupBy({ age: "asc" }).exec().then((rows) => {
            try {
                let test = [8, 4, 9, 7, 1, 3, 5, 2, 6];
                rows.map(r => r.id).forEach((val, idx) => {
                    expect(val).to.equal(test[idx], "Group By failed!");
                });
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Group rows together given multiple values.", (done: MochaDone) => {
        nSQL("users").query("select").groupBy({ age: "desc", name: "desc" }).exec().then((rows) => {
            try {
                let test = [6, 2, 5, 3, 1, 7, 9, 4, 8];
                rows.map(r => r.id).forEach((val, idx) => {
                    expect(val).to.equal(test[idx], "Group By failed!");
                });
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Aggregate function with Group By.", (done: MochaDone) => {

        nSQL("users").query("select", ["age", "COUNT(*)"]).groupBy({ age: "desc" }).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { age: 23, COUNT: 1 },
                    { age: 27, COUNT: 1 },
                    { age: 28, COUNT: 1 },
                    { age: 30, COUNT: 1 },
                    { age: 32, COUNT: 1 },
                    { age: 34, COUNT: 1 },
                    { age: 45, COUNT: 1 },
                    { age: 50, COUNT: 2 }
                ], "Group By failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

});