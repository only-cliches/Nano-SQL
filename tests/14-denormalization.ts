import { nSQL, NanoSQLInstance } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";


const initStore = (complete: (nSQL: NanoSQLInstance) => void) => {
    const nSQL = new NanoSQLInstance();

};

describe("Denormalization", () => {

});
