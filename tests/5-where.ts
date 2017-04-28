import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";


describe("Where", () => {
    it("Select single row by primary key.", (done: MochaDone) => {
        nSQL("users").query("select").where(["id", "=", 2]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([{ id: 2, age: 30, name: "Bill" }], "Primary Key select failed");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Select multiple rows by arbitrary value.", (done: MochaDone) => {
        nSQL("users").query("select").where(["age", "=", 30]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { id: 2, age: 30, name: "Bill" },
                    { id: 7, age: 30, name: "Walt" }
                ], "Unable to multiple select.");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Select multiple rows using IN statement", (done: MochaDone) => {
        nSQL("users").query("select").where(["age", "IN", [30, 45]]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { id: 2, age: 30, name: "Bill" },
                    { id: 5, age: 45, name: "Gene" },
                    { id: 7, age: 30, name: "Walt" }
                ], "Unable to IN select");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Select multiple rows using BETWEEN statement", (done: MochaDone) => {
        nSQL("users").query("select").where(["age", "BETWEEN", [29, 46]]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { id: 1, age: 32, name: "Jebediah" },
                    { id: 2, age: 30, name: "Bill" },
                    { id: 3, age: 34, name: "Bob" },
                    { id: 5, age: 45, name: "Gene" },
                    { id: 7, age: 30, name: "Walt" }
                ], "Unable to BETWEEN select");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Select multiple rows by arbitrary range value.", (done: MochaDone) => {
        nSQL("users").query("select").where(["age", ">", 30]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { id: 1, age: 32, name: "Jebediah" },
                    { id: 3, age: 34, name: "Bob" },
                    { id: 5, age: 45, name: "Gene" },
                    { id: 6, age: 50, name: "Mortimer" }
                ], "Unable to range select.");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Select single row by secondary index.", (done: MochaDone) => {
        nSQL("users").query("select").where(["name", "=", "Scott"]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([{ id: 9, name: "Scott", age: 28 }], "Unable to secondary range select.");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Select using AND statement.", (done: MochaDone) => {
        nSQL("users").query("select").where([["name", "=", "Scott"], "AND", ["age", "=", 28]]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([{ id: 9, name: "Scott", age: 28 }], "Unable to select with AND.");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Select using OR statement.", (done: MochaDone) => {
        nSQL("users").query("select").where([["name", "=", "Scott"], "OR", ["age", "=", 23]]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { id: 8, age: 23, name: "Gus" },
                    { id: 9, age: 28, name: "Scott" }
                ], "Unable to select with OR.");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Select using range.", (done: MochaDone) => {
        nSQL("users").query("select").range(2, 2).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { id: 3, age: 34, name: "Bob" },
                    { id: 4, age: 27, name: "Valentina" },
                ], "Unable to select with range query.");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

});