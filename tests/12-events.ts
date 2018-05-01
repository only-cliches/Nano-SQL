import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

describe("Events", () => {
    it("Event Listener should trigger.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {

            nSQL.loadJS("users", ExampleUsers).then(() => {

                nSQL.table("users").on("select", (event) => {
                    try {
                        expect(event.table).to.equal("users", "Event listener failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });

                nSQL.table("users").query("select").exec();
            });
        });
    });
});