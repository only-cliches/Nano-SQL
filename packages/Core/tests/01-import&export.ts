import { expect, assert } from "chai";
import "mocha";
import { TestDBs, JSON2CSV, CSV2JSON  } from "./init";
import { comments, users, posts } from "./data";
import { nSQL } from "../src";
import { INanoSQLInstance } from "../src/interfaces";


describe("Import/Export", () => {

        it("Imported JSON should be identical to table data.", (done: MochaDone) => {
            TestDBs().then((result) => {
                result.runQuery(``, [], (nSQL) => {
                    return nSQL.selectTable("users").query("select").exec();
                }).then((result) => {
                    try {
                        expect(result[0]).to.deep.equal(users, "Import JSON Failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });

        it("Exported CSV should match source data.", (done: MochaDone) => {
            TestDBs().then((result) => {
                result.runQuery(``, [], (nSQL) => {
                    return nSQL.selectTable("users").query("select").toCSV(true);
                }).then((result) => {
                    try {
                        expect(result[0]).to.equal(JSON2CSV(users), "Export CSV Failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });

        it("Imported CSV should match original data.", (done: MochaDone) => {
            TestDBs().then((result) => {
                let nanoSQL: INanoSQLInstance;
                result.runQuery(``, [], (nSQL) => {
                    nanoSQL = nSQL;
                    return nSQL.selectTable("users").query("delete").exec();
                }).then((result) => {
                    return nanoSQL.selectTable("users").loadCSV(JSON2CSV(users));
                }).then((result) => {
                    return nanoSQL.selectTable("users").query("select").exec();
                }).then((rows) => {
                    try {
                        expect(rows).to.deep.equal(users, "Export CSV Failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });

});