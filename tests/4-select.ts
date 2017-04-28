import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";


describe("Select", () => {
    it("Select single column.", (done: MochaDone) => {
        nSQL("users").query("select", ["name"]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { name: "Jebediah" },
                    { name: "Bill" },
                    { name: "Bob" },
                    { name: "Valentina" },
                    { name: "Gene" },
                    { name: "Mortimer" },
                    { name: "Walt" },
                    { name: "Gus" },
                    { name: "Scott" }
                ]);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Select multiple columns.", (done: MochaDone) => {
        nSQL("users").query("select", ["name", "age"]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { age: 32, name: "Jebediah" },
                    { age: 30, name: "Bill" },
                    { age: 34, name: "Bob" },
                    { age: 27, name: "Valentina" },
                    { age: 45, name: "Gene" },
                    { age: 50, name: "Mortimer" },
                    { age: 30, name: "Walt" },
                    { age: 23, name: "Gus" },
                    { age: 28, name: "Scott" }
                ]);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Select column using AS alias.", (done: MochaDone) => {
        nSQL("users").query("select", ["name AS title"]).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    { title: "Jebediah" },
                    { title: "Bill" },
                    { title: "Bob" },
                    { title: "Valentina" },
                    { title: "Gene" },
                    { title: "Mortimer" },
                    { title: "Walt" },
                    { title: "Gus" },
                    { title: "Scott" }
                ]);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
});