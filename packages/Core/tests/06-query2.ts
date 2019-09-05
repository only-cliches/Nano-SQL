import { expect, assert } from "chai";
import "mocha";

const colors = require("colors");
console.log(("Tests Beginning at " + new Date().toLocaleTimeString() + ", " + new Date().toDateString() as any).magenta);

import {
    _processFunctionString,
    _processArrayWhere,
    _processOffsetLimit,
    _processSingleSortBy,
    _processSortBy
} from "../src/query2-ast";

describe("Query Engine Unit Tests", () => {
    it("processFunctionString: Simple Function Queries Should Parse", (done: MochaDone) => {

        const result = _processFunctionString("SOMEFUNC(ARG1)");

        try {
            expect(result).to.deep.equal({
                name: "somefunc",
                args: ["ARG1"]
            });
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processFunctionString: Simple Function Queries Should Parse With Multiple Arguments", (done: MochaDone) => {

        const result = _processFunctionString("SOMEFUNC(ARG1, ARG2, ARG3)");
        try {
            expect(result).to.deep.equal({
                name: "somefunc",
                args: ["ARG1", "ARG2", "ARG3"]
            });
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processFunctionString: Nested Function Queries Should Parse With Multiple Arguments", (done: MochaDone) => {

        const result = _processFunctionString("SOMEFUNC(ARG1, ARG2, SOMEFUNC2(ARG3, ARG4))");
        try {
            expect(result).to.deep.equal({
                name: "somefunc",
                args: ["ARG1", "ARG2", {
                    name: "somefunc2",
                    args: ["ARG3", "ARG4"]
                }]
            });
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processFunctionString: Deeply Nested Function Queries Should Parse With Multiple Arguments", (done: MochaDone) => {

        const result = _processFunctionString("SOMEFUNC(ARG1, ARG2, SOMEFUNC2(ARG3, SOMEFUNC3(ARG4)))");
        try {
            expect(result).to.deep.equal({
                name: "somefunc",
                args: ["ARG1", "ARG2", {
                    name: "somefunc2",
                    args: ["ARG3", {
                        name: "somefunc3",
                        args: ["ARG4"]
                    }]
                }]
            });
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processFunctionString: Incorrect parentheses matching should cause error", (done: MochaDone) => {

        try {
            const result = _processFunctionString("SOMEFUNC(ARG1, ARG2, SOMEFUNC2(ARG3, SOMEFUNC3(ARG4))");
            done("ERROR");
        } catch (e) {
            done();
        }
    });

    it("processFunctionString: Strings should return as is", (done: MochaDone) => {

        const result = _processFunctionString("some string");

        try {
            expect(result).to.equal("some string");
            done();
        } catch (e) {
            done();
        }
    });


    it("processArrayWhere: Simple Array Wheres Process", (done: MochaDone) => {

        const result = _processArrayWhere(["Some value", "=", 2]);
        try {
            expect(result).to.deep.equal({
                STMT: ['Some value', '=', 2]
            });
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processArrayWhere: Compound Array Wheres Process", (done: MochaDone) => {

        const result = _processArrayWhere([
            ["Some value", "=", 2], "AND", 
            ["Some other value", "=", "hello"]
        ]);

        try {
            expect(result).to.deep.equal({
                NESTED: [
                    {
                        STMT: ["Some value", "=", 2]
                    },
                    {
                        ANDOR: "AND"
                    },
                    {
                        STMT: ["Some other value", "=", "hello"]
                    }
                ]
            });
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processArrayWhere: Deeply Nested Compound Array Wheres Process", (done: MochaDone) => {

        const result = _processArrayWhere([
            ["Some value", "=", 2], "AND", [
                ["Some other value 2", "=", 3],
                "OR",
                ["some other value 3", "=", 5]
            ]
        ]);

        try {
            expect(result).to.deep.equal({
                NESTED: [
                    {
                        STMT: ["Some value", "=", 2]
                    },
                    {
                        ANDOR: "AND"
                    },
                    {
                        NESTED: [
                            {
                                STMT: ["Some other value 2", "=", 3]
                            },
                            {
                                ANDOR: "OR"
                            },
                            {
                                STMT: ["some other value 3", "=", 5]
                            }
                        ]
                    }
                ]
            });
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processArrayWhere: Long Chain Compound Array Wheres Process", (done: MochaDone) => {

        const result = _processArrayWhere([
            ["Some value", "=", 2], "AND",
            ["Some other value", "=", "hello"], "OR",
            ["Some other value 2", "=", "hello2"]
        ]);

        try {
            expect(result).to.deep.equal({
                NESTED: [
                    {
                        STMT: ["Some value", "=", 2]
                    },
                    {
                        ANDOR: "AND"
                    },
                    {
                        STMT: ["Some other value", "=", "hello"]
                    },
                    {
                        ANDOR: "OR"
                    },
                    {
                        STMT: ["Some other value 2", "=", "hello2"]
                    }
                ]
            });
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processArrayWhere: Malformed Wheres Throw Error", (done: MochaDone) => {

        try {
            _processArrayWhere([["Some value", "=", 2], , "AND", ["some other value", "=", 3]]);
            done("ERROR");
        } catch (e) {
            done();
        }
    });

    it("processOffsetLimit: Works as expected.", (done: MochaDone) => {

        try {
            const result = _processOffsetLimit(10, 20);
            expect(result).to.deep.equal([10, 30]);
            done();
        } catch (e) {
            done(e);
        }
    });

    


    it("processSortBy: Works as expected for v2 format", (done: MochaDone) => {

        try {
            const result = _processSortBy(["column asc"]);
            expect(result).to.deep.equal([{value: "column", dir: "asc"}]);
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processSortBy: Works as expected for v1 format", (done: MochaDone) => {

        try {
            const result = _processSortBy({"column":"asc"});
            expect(result).to.deep.equal([{value: "column", dir: "asc"}]);
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processSortBy: Works as expected for v2 format with no direction", (done: MochaDone) => {

        try {
            const result = _processSortBy(["column"]);
            expect(result).to.deep.equal([{value: "column", dir: "asc"}]);
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processSingleSortBy: Works as expected for ascending", (done: MochaDone) => {

        try {
            const result = _processSingleSortBy("column", "asc");
            expect(result).to.deep.equal({value: "column", dir: "asc"});
            done();
        } catch (e) {
            done(e);
        }
    });

    it("processSingleSortBy: Works as expected for no direction", (done: MochaDone) => {

        try {
            const result = _processSingleSortBy("column");
            expect(result).to.deep.equal({value: "column", dir: "asc"});
            done();
        } catch (e) {
            done(e);
        }
    });


    
});