import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import {
    usersDatabase,
    spaceShipsDatabase
} from "./example-data";

describe("Import/Export", () => {
    it("Imported JSON should be identical to table data.", (done: MochaDone) => {
        nSQL().loadJS("users", usersDatabase).then((result) => {
            nSQL("users").query("select").exec().then((rows) => {
                try {
                    expect(rows).to.deep.equal(usersDatabase, "Users import failed!");
                    expect(rows.length).to.equal(8, "Users Import failed!");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Imported JSON should be identical to table data.", (done: MochaDone) => {
        nSQL().loadJS("ships", spaceShipsDatabase).then((result) => {
            nSQL("ships").query("select").exec().then((rows) => {
                try {
                    expect(rows).to.deep.equal(spaceShipsDatabase, "Ships import failed!");
                    expect(rows.length).to.equal(9, "Ships Import failed!");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    let CSVvalue = "";
    it("Exported CSV should match source data.", (done: MochaDone) => {
        nSQL("ships").query("select").toCSV(true).then((CSV) => {
            CSVvalue = CSV;
                try {
                    expect(CSV.replace(/\s/gm, "")).to.equal(`id,pilotId,name,meta,partIds,year
                        1,1,"Hello, world!","{'fuel':20,'parts':'40'}","[1,3]",2017
                        2,2,"Don't mess with me!","{'fuel':24,'parts':'40'}","[1,3]",1999
                        3,2,"Hello, world!","{'fuel':22,'parts':'40'}","[1,3]",2015
                        4,5,"Hello, world!","{'fuel':25,'parts':'40'}","[1,3]",2010
                        5,2,"Hello, world!","{'fuel':21,'parts':'40'}","[1,3]",2007
                        6,20,"Hello, world!","{'fuel':10,'parts':'40'}","[1,3]",2001
                        7,2,"Hello, world!","{'fuel':5,'parts':'40'}","[1,3]",1988
                        8,6,"Hello, world!","{'fuel':4,'parts':'40'}","[1,3]",1956
                        9,2,"Hello, world!","{'fuel':0,'parts':'40'}","[1,3]",2002`.replace(/\s/gm, ""), "CSV Export failed");
                    done();
                } catch (e) {
                    done(e);
                }
        })
    });

    it("Imported CSV should be identical to source data.", (done: MochaDone) => {
        nSQL("ships").query("drop").exec().then(() => {
            nSQL().loadCSV("ships", CSVvalue).then(() => {
                nSQL("ships").query("select").exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal(spaceShipsDatabase, "CSV Import failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });
});