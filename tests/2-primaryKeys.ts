import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";


describe("Primary Keys", () => {
    it("Int primary keys should auto incriment", (done: MochaDone) => {
        nSQL("users").query("upsert", { name: "Scott", age: 28 }).exec().then((result, db) => {
            db.table("users").query("select").exec().then((rows) => {
                try {
                    expect(rows[rows.length - 1]).to.deep.equal({ id: 9, name: "Scott", age: 28 }, "Auto incriment failed.");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
    it("UUID primary keys should auto generate", (done: MochaDone) => {
        nSQL("uuid").query("upsert", {}).exec().then((result, db) => {
            nSQL("uuid").query("select").exec().then((rows) => {
                try {
                    expect(rows[0].id).to.match(/\w{12}-\w{4}-\w{4}-\w{4}-\w{12}/, "UUID not generated correctly");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
    it("timeId primary keys should auto generate", (done: MochaDone) => {
        nSQL("timeId").query("upsert", {}).exec().then((result, db) => {
            nSQL("timeId").query("select").exec().then((rows) => {
                try {
                    expect(rows[0].id).to.match(/^\d{10}-\w{4}/, "timeId not generated correctly");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
    it("timeIdms primary keys should auto generate", (done: MochaDone) => {
        nSQL("timeIdms").query("upsert", {}).exec().then((result, db) => {
            nSQL("timeIdms").query("select").exec().then((rows) => {
                try {
                    expect(rows[0].id).to.match(/^\d{13}-\w{4}/, "timeIdms not generated correctly");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
});