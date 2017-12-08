import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

const groupByUsers = ExampleUsers.concat([
    {id: 4, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 2, 3]},
    {id: 5, name: "Bob", age: 24, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 2, 3]},
]);

describe("Group By & Functions", () => {
    it("Group rows together given a single value.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", groupByUsers).then(() => {
                nSQL.query("select", ["age"]).groupBy({ age: "asc" }).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            { age: 20 },
                            { age: 20 },
                            { age: 21 },
                            { age: 24 },
                            { age: 24 }
                        ], "Group By failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

    it("Group rows together given multiple values.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", groupByUsers).then(() => {
                nSQL.query("select").groupBy({ age: "desc", name: "asc" }).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {"id": 5, "age": 24, "name": "Bob", "email": "bill@gmail.com", "meta": {"value": 1}, "posts": [1, 2, 3]},
                            {"id": 2, "age": 24, "name": "Jeb", "email": "jeb@gmail.com", "meta": {"value": 1}, "posts": [1]},
                            {"id": 3, "age": 21, "name": "Bob", "email": "bob@gmail.com", "meta": {"value": 1}, "posts": [1, 2, 3]},
                            {"id": 1, "age": 20, "name": "Bill", "email": "bill@gmail.com", "meta": {"value": 1}, "posts": [1, 3]},
                            {"id": 4, "age": 20, "name": "Bill", "email": "bill@gmail.com", "meta": {"value": 1}, "posts": [1, 2, 3]}
                        ], "Multiple Group By failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });



    it("Aggregate function with Group By.", (done: MochaDone) => {
        usersDB(ExampleDataModel, (nSQL) => {
            nSQL.loadJS("users", groupByUsers).then(() => {
                nSQL.query("select", ["age", "COUNT(*)"]).groupBy({ age: "desc" }).exec().then((rows) => {
                    try {
                        expect(rows).to.deep.equal([
                            {age: 20, "COUNT(*)": 2},
                            {age: 21, "COUNT(*)": 1},
                            {age: 24, "COUNT(*)": 2}
                        ], "Group By with function failed!");
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });
    });

});