import { NanoSQLInstance } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

const CSVData = `id,age,name,email,meta,posts\r\n1,20,"Bill","bill@gmail.com","{""value"":1}","[1,3]"\r\n2,24,"Jeb","jeb@gmail.com","{""value"":1}","[1]"\r\n3,21,"Bob","bob@gmail.com","{""value"":1}","[1,2,3]"`;

describe("Import/Export", () => {
    it("Imported JSON should be identical to table data.", (done: MochaDone) => {

        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal(ExampleUsers, "Users import failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Exported CSV should match source data.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", ExampleUsers).then(() => {
                nSQL.table("users").query("select").toCSV(true).then((rows) => {
                    try {
                        expect(rows).to.equal(CSVData, "CSV Export Failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Imported CSV should match database data.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadCSV("users", CSVData).then(() => {
                nSQL.table("users").query("select").exec().then((rows) => {
                    try {
                        console.log(rows);
                        expect(rows).to.deep.equal(ExampleUsers, "CSV Import failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

});