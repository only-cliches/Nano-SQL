import { expect, assert } from "chai";
import "mocha";
import { TestDBs, JSON2CSV, CSV2JSON  } from "./init";
import { comments, users, posts } from "./data";
import { nanoSQL } from "../src";
import { InanoSQLInstance } from "../src/interfaces";


describe("Primary Keys", () => {
    it("Auto Incriment with Int primary key.", (done: MochaDone) => {
        const nSQL = new nanoSQL();
        nSQL.connect({
            tables: [
                {
                    name: "test",
                    model: {
                        "id:int": {pk: true, ai: true},
                        "name:string": {}
                    }
                }
            ]
        }).then(() =>  {
            return nSQL.selectTable("test").query("upsert", [{name: "Jeb"}, {name: "Bill"}]).exec();
        }).then(() => {
            return nSQL.query("select").exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal([ { id: 1, name: "Jeb" }, { id: 2, name: "Bill" } ], "Auto Incriment Error");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("UUID primary keys should auto generate.", (done: MochaDone) => {
        const nSQL = new nanoSQL();
        nSQL.connect({
            tables: [
                {
                    name: "test",
                    model: {
                        "id:uuid": {pk: true},
                        "name:string": {}
                    }
                }
            ]
        }).then(() =>  {
            return nSQL.selectTable("test").query("upsert", [{name: "Jeb"}, {name: "Bill"}]).exec();
        }).then(() => {
            return nSQL.query("select").exec();
        }).then((rows) => {
            try {
                expect(rows[0].id).to.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{8}/, "UUID not generated correctly");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("timeId primary keys should auto generate", (done: MochaDone) => {
        const nSQL = new nanoSQL();
        nSQL.connect({
            tables: [
                {
                    name: "test",
                    model: {
                        "id:timeId": {pk: true},
                        "name:string": {}
                    }
                }
            ]
        }).then(() =>  {
            return nSQL.selectTable("test").query("upsert", [{name: "Jeb"}, {name: "Bill"}]).exec();
        }).then(() => {
            return nSQL.query("select").exec();
        }).then((rows) => {
            try {
                expect(rows[0].id).to.match(/^\d{10}-\w{4}/, "timeId not generated correctly");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("timeIdms primary keys should auto generate", (done: MochaDone) => {
        const nSQL = new nanoSQL();
        nSQL.connect({
            tables: [
                {
                    name: "test",
                    model: {
                        "id:timeIdms": {pk: true},
                        "name:string": {}
                    }
                }
            ]
        }).then(() =>  {
            return nSQL.selectTable("test").query("upsert", [{name: "Jeb"}, {name: "Bill"}]).exec();
        }).then(() => {
            return nSQL.query("select").exec();
        }).then((rows) => {
            try {
                expect(rows[0].id).to.match(/^\d{13}-\w{4}/, "timeIdms not generated correctly");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
});