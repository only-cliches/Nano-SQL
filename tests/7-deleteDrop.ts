import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";


describe("Delete & Drop", () => {
    it("Remove single row with WHERE statement.", (done: MochaDone) => {
        nSQL("users").query("delete").where(["id", "=", 10]).exec().then((rows) => {
            return nSQL("users").query("select").where(["id", "=", 10]).exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal([], "Single row delete failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Delete multiple rows with WHERE statement.", (done: MochaDone) => {
        nSQL("ships").query("delete").where(["year", ">", 2014]).exec().then((rows) => {
            return nSQL("ships").query("select").where(["year", ">", 2014]).exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal([], "Multiple deletes failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Drop entire table.", (done: MochaDone) => {
        nSQL("uuid").query("drop").exec().then((rows) => {
            return nSQL("uuid").query("select").exec();
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
