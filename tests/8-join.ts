import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { leftJoin, rightJoin, innerJoin, outerJoin, crossJoin } from "./example-data";

describe("Join", () => {
    it("Left Join", (done: MochaDone) => {
        nSQL("users").query("select").join({
            type: "left",
            table: "ships",
            where: ["users.id", "=", "ships.pilotId"]
        }).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal(leftJoin);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Right Join", (done: MochaDone) => {
        nSQL("users").query("select").join({
            type: "right",
            table: "ships",
            where: ["users.id", "=", "ships.pilotId"]
        }).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal(rightJoin);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Inner Join", (done: MochaDone) => {
        nSQL("users").query("select").join({
            type: "inner",
            table: "ships",
            where: ["users.id", "=", "ships.pilotId"]
        }).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal(innerJoin);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Outer Join", (done: MochaDone) => {
        nSQL("users").query("select").join({
            type: "outer",
            table: "ships",
            where: ["users.id", "=", "ships.pilotId"]
        }).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal(outerJoin);
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Cross Join", (done: MochaDone) => {
        nSQL("users").query("select").join({
            type: "cross",
            table: "ships"
        }).exec().then((rows) => {
            try {
                expect(rows).to.deep.equal(crossJoin);
                done();
            } catch(e) {
                done(e);
            }
        });
    });
});