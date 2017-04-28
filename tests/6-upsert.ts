import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";


describe("Upsert", () => {
    it("Update single row with WHERE statement.", (done: MochaDone) => {
        nSQL("users").query("upsert", { age: 50 }).where(["id", "=", 2]).exec().then((rows) => {
            return nSQL("users").query("select").where(["id", "=", 2]).exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal([{ id: 2, age: 50, name: "Bill" }], "Single update failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Update multiple rows with WHERE statement.", (done: MochaDone) => {
        nSQL("ships").query("upsert", { name: "Of Course I Still Love You" }).where(["year", ">", 2014]).exec().then((rows) => {
            return nSQL("ships").query("select").where(["year", ">", 2014]).exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal([
                    {
                        id: 1,
                        pilotId: 1,
                        name: "Of Course I Still Love You",
                        meta: { fuel: 20, parts: "40" },
                        partIds: [1, 3],
                        year: 2017
                    },
                    {
                        id: 3,
                        pilotId: 2,
                        name: "Of Course I Still Love You",
                        meta: { fuel: 22, parts: "40" },
                        partIds: [1, 3],
                        year: 2015
                    }
                ], "Multiple updates failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Insert new row.", (done: MochaDone) => {
        nSQL("users").query("upsert", { age: 40, name: "Elon" }).exec().then((rows) => {
            return nSQL("users").query("select").where(["id", "=", 10]).exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal([{ id: 10, age: 40, name: "Elon" }], "Single insert failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
});
