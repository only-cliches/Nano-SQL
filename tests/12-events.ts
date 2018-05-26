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

    it("Observer should trigger as expected.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {

            nSQL.loadJS("users", ExampleUsers).then(() => {

                nSQL.observable(() => {
                    return nSQL.table("users").query("select" , ["name"]).where(["id", "=", 1]).emit();
                })
                .skip(1)
                .subscribe((rows) => {
                    try {
                        expect(rows).to.deep.equal([{name: "BILL"}]);
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
                setTimeout(() => {
                    nSQL.table("users").query("upsert", {id: 1, name: "BILL"}).exec();
                }, 0);
            });
        });
    });
});