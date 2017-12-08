import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

describe("Primary Keys", () => {
    it("Auto Incriment with Int primary key.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers.map(u => {return {...u, id: undefined}; })).then(() => {
                nSQL.table("users").query("select").exec().then((rows) => {
                    try {
                        expect(rows[rows.length - 1].id).to.equal(3, "Auto incriment failed.");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("UUID primary keys should auto generate.", (done: MochaDone) => {
        usersDB(ExampleDataModel.map(r => r.key !== "id" ? r : {key: "id", type: "uuid", props: ["pk"]}), (nSQL) => {
            nSQL.loadJS("users", ExampleUsers.map(u => {return {...u, id: undefined}; })).then(() => {
                nSQL.table("users").query("select").exec().then((rows) => {
                    try {
                        expect(rows[0].id).to.match(/\w{12}-\w{4}-\w{4}-\w{4}-\w{12}/, "UUID not generated correctly");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("timeId primary keys should auto generate", (done: MochaDone) => {
        usersDB(ExampleDataModel.map(r => r.key !== "id" ? r : {key: "id", type: "timeId", props: ["pk"]}), (nSQL) => {
            nSQL.loadJS("users", ExampleUsers.map(u => {return {...u, id: undefined}; })).then(() => {
                nSQL.table("users").query("select").exec().then((rows) => {
                    try {
                        expect(rows[0].id).to.match(/^\d{10}-\w{4}/, "timeId not generated correctly");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
    it("timeIdms primary keys should auto generate", (done: MochaDone) => {
        usersDB(ExampleDataModel.map(r => r.key !== "id" ? r : {key: "id", type: "timeIdms", props: ["pk"]}), (nSQL) => {
            nSQL.loadJS("users", ExampleUsers.map(u => {return {...u, id: undefined}; })).then(() => {
                nSQL.table("users").query("select").exec().then((rows) => {
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
});