import { NanoSQLInstance } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

const joinTables = (ready: (nSQL: NanoSQLInstance) => void) => {
    const n = new NanoSQLInstance();
    n
        .table("users").model(ExampleDataModel)
        .table("posts").model([
            { key: "id", type: "int", props: ["pk()", "ai()"] },
            { key: "title", type: "string" },
            { key: "author", type: "int" }
        ])
        .table("comments").model([
            { key: "id", type: "int", props: ["pk()", "ai()"] },
            { key: "author", type: "int" },
            { key: "text", type: "string" }
        ])
        .connect()
        .then(() => {
            return n.loadJS("users", [
                { id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: { value: 1 }, posts: [1, 2, 3] },
                { id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: { value: 1 }, posts: [1, 2, 3] },
                { id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: { value: 1 }, posts: [1, 2, 3] },
                { id: 4, name: "Val", age: 21, email: "val@gmail.com", meta: { value: 1 }, posts: [1, 2, 3] }
            ]);
        }).then(() => {
            return n.loadJS("posts", [
                { id: 1, title: "never", author: 1 },
                { id: 2, title: "gonna", author: 3 },
                { id: 3, title: "give", author: 6 },
                { id: 4, title: "you", author: 2 },
                { id: 5, title: "up", author: 1 }
            ]);
        }).then(() => {
            return n.loadJS("comments", [
                { id: 1, text: "never", author: 1 },
                { id: 2, text: "gonna", author: 3 },
                { id: 3, text: "give", author: 6 },
            ]);
        }).then(() => {
            ready(n);
        });
};

describe("Join", () => {
    /*
    it("Left Join", (done: MochaDone) => {
        joinTables((n) => {
            n.table("users").query("select").join({
                type: "left",
                table: "posts",
                where: ["users.id", "=", "posts.author"]
            }).exec().then((rows) => {
                try {
                    expect(rows).to.deep.equal([
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 1, "posts.title": "never", "posts.author": 1 },
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 5, "posts.title": "up", "posts.author": 1 },
                        { "users.id": 2, "users.age": 24, "users.name": "Jeb", "users.email": "jeb@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 4, "posts.title": "you", "posts.author": 2 },
                        { "users.id": 3, "users.age": 21, "users.name": "Bob", "users.email": "bob@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 2, "posts.title": "gonna", "posts.author": 3 },
                        { "users.id": 4, "users.age": 21, "users.name": "Val", "users.email": "val@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": undefined, "posts.title": undefined, "posts.author": undefined }
                    ], "Left Join failed!");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Left Join with Function", (done: MochaDone) => {
        joinTables((n) => {
            n.table("users").query("select", ["UPPER(users.email) AS email"]).join({
                type: "left",
                table: "posts",
                where: ["users.id", "=", "posts.author"]
            }).exec().then((rows) => {
                try {
                    expect(rows).to.deep.equal([
                        { email: "BILL@GMAIL.COM" },
                        { email: "BILL@GMAIL.COM" },
                        { email: "JEB@GMAIL.COM" },
                        { email: "BOB@GMAIL.COM" },
                        { email: "VAL@GMAIL.COM" }
                    ], "Left Join with function failed!");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
*/
    it("Right Join", (done: MochaDone) => {
        joinTables((n) => {
            n.table("users").query("select").join({
                type: "right",
                table: "posts",
                where: ["users.id", "=", "posts.author"]
            }).exec().then((rows) => {
                console.log(rows);
                try {
                    expect(rows).to.deep.equal([
                        { "posts.id": 1, "posts.title": "never", "posts.author": 1, "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3] },
                        { "posts.id": 2, "posts.title": "gonna", "posts.author": 3, "users.id": 3, "users.age": 21, "users.name": "Bob", "users.email": "bob@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3] },
                        { "posts.id": 3, "posts.title": "give", "posts.author": 6, "users.id": undefined, "users.age": undefined, "users.name": undefined, "users.email": undefined, "users.meta": undefined, "users.posts": undefined },
                        { "posts.id": 4, "posts.title": "you", "posts.author": 2, "users.id": 2, "users.age": 24, "users.name": "Jeb", "users.email": "jeb@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3] },
                        { "posts.id": 5, "posts.title": "up", "posts.author": 1, "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3] }
                    ], "Right join failed!");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
/*
    it("Multiple Joins", (done: MochaDone) => {
        joinTables((n) => {
            n.table("users").query("select").join([
                {
                    type: "inner",
                    table: "posts",
                    where: ["users.id", "=", "posts.author"]
                },
                {
                    type: "inner",
                    table: "comments",
                    where: ["users.id", "=", "comments.author"]
                }
            ]).exec().then((rows) => {

                try {
                    expect(rows).to.deep.equal([{
                        "users.id": 1,
                        "users.age": 20,
                        "users.name": "Bill",
                        "users.email": "bill@gmail.com",
                        "users.meta": {
                            "value": 1
                        },
                        "users.posts": [1, 2, 3],
                        "posts.id": 1,
                        "posts.title": "never",
                        "posts.author": 1,
                        "comments.id": 1,
                        "comments.author": 1,
                        "comments.text": "never"
                    },
                    {
                        "users.id": 1,
                        "users.age": 20,
                        "users.name": "Bill",
                        "users.email": "bill@gmail.com",
                        "users.meta": {
                            "value": 1
                        },
                        "users.posts": [1, 2, 3],
                        "posts.id": 5,
                        "posts.title": "up",
                        "posts.author": 1,
                        "comments.id": 1,
                        "comments.author": 1,
                        "comments.text": "never"
                    },
                    {
                        "users.id": 2,
                        "users.age": 24,
                        "users.name": "Jeb",
                        "users.email": "jeb@gmail.com",
                        "users.meta": {
                            "value": 1
                        },
                        "users.posts": [1, 2, 3],
                        "posts.id": 4,
                        "posts.title": "you",
                        "posts.author": 2
                    },
                    {
                        "users.id": 3,
                        "users.age": 21,
                        "users.name": "Bob",
                        "users.email": "bob@gmail.com",
                        "users.meta": {
                            "value": 1
                        },
                        "users.posts": [1, 2, 3],
                        "posts.id": 2,
                        "posts.title": "gonna",
                        "posts.author": 3,
                        "comments.id": 2,
                        "comments.author": 3,
                        "comments.text": "gonna"
                    }
                    ], "Multiple join failed!");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Inner Join", (done: MochaDone) => {
        joinTables((n) => {
            n.table("users").query("select").join({
                type: "inner",
                table: "posts",
                where: ["users.id", "=", "posts.author"]
            }).exec().then((rows) => {

                try {
                    expect(rows).to.deep.equal([
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 1, "posts.title": "never", "posts.author": 1 },
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 5, "posts.title": "up", "posts.author": 1 },
                        { "users.id": 2, "users.age": 24, "users.name": "Jeb", "users.email": "jeb@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 4, "posts.title": "you", "posts.author": 2 },
                        { "users.id": 3, "users.age": 21, "users.name": "Bob", "users.email": "bob@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 2, "posts.title": "gonna", "posts.author": 3 }
                    ], "Inner join failed!");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Outer Join", (done: MochaDone) => {
        joinTables((n) => {
            n.table("users").query("select").join({
                type: "outer",
                table: "posts",
                where: ["users.id", "=", "posts.author"]
            }).exec().then((rows) => {

                try {
                    expect(rows).to.deep.equal([
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 1, "posts.title": "never", "posts.author": 1 },
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 5, "posts.title": "up", "posts.author": 1 },
                        { "users.id": 2, "users.age": 24, "users.name": "Jeb", "users.email": "jeb@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 4, "posts.title": "you", "posts.author": 2 },
                        { "users.id": 3, "users.age": 21, "users.name": "Bob", "users.email": "bob@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 2, "posts.title": "gonna", "posts.author": 3 },
                        { "users.id": 4, "users.age": 21, "users.name": "Val", "users.email": "val@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": undefined, "posts.title": undefined, "posts.author": undefined },
                        { "users.id": undefined, "users.age": undefined, "users.name": undefined, "users.email": undefined, "users.meta": undefined, "users.posts": undefined, "posts.id": 3, "posts.title": "give", "posts.author": 6 }
                    ], "Outer join failed!");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    it("Cross Join", (done: MochaDone) => {
        joinTables((n) => {
            n.table("users").query("select").join({
                type: "cross",
                table: "posts",
            }).exec().then((rows) => {

                try {
                    expect(rows).to.deep.equal([
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 1, "posts.title": "never", "posts.author": 1 },
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 2, "posts.title": "gonna", "posts.author": 3 },
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 3, "posts.title": "give", "posts.author": 6 },
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 4, "posts.title": "you", "posts.author": 2 },
                        { "users.id": 1, "users.age": 20, "users.name": "Bill", "users.email": "bill@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 5, "posts.title": "up", "posts.author": 1 },
                        { "users.id": 2, "users.age": 24, "users.name": "Jeb", "users.email": "jeb@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 1, "posts.title": "never", "posts.author": 1 },
                        { "users.id": 2, "users.age": 24, "users.name": "Jeb", "users.email": "jeb@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 2, "posts.title": "gonna", "posts.author": 3 },
                        { "users.id": 2, "users.age": 24, "users.name": "Jeb", "users.email": "jeb@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 3, "posts.title": "give", "posts.author": 6 },
                        { "users.id": 2, "users.age": 24, "users.name": "Jeb", "users.email": "jeb@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 4, "posts.title": "you", "posts.author": 2 },
                        { "users.id": 2, "users.age": 24, "users.name": "Jeb", "users.email": "jeb@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 5, "posts.title": "up", "posts.author": 1 },
                        { "users.id": 3, "users.age": 21, "users.name": "Bob", "users.email": "bob@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 1, "posts.title": "never", "posts.author": 1 },
                        { "users.id": 3, "users.age": 21, "users.name": "Bob", "users.email": "bob@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 2, "posts.title": "gonna", "posts.author": 3 },
                        { "users.id": 3, "users.age": 21, "users.name": "Bob", "users.email": "bob@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 3, "posts.title": "give", "posts.author": 6 },
                        { "users.id": 3, "users.age": 21, "users.name": "Bob", "users.email": "bob@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 4, "posts.title": "you", "posts.author": 2 },
                        { "users.id": 3, "users.age": 21, "users.name": "Bob", "users.email": "bob@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 5, "posts.title": "up", "posts.author": 1 },
                        { "users.id": 4, "users.age": 21, "users.name": "Val", "users.email": "val@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 1, "posts.title": "never", "posts.author": 1 },
                        { "users.id": 4, "users.age": 21, "users.name": "Val", "users.email": "val@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 2, "posts.title": "gonna", "posts.author": 3 },
                        { "users.id": 4, "users.age": 21, "users.name": "Val", "users.email": "val@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 3, "posts.title": "give", "posts.author": 6 },
                        { "users.id": 4, "users.age": 21, "users.name": "Val", "users.email": "val@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 4, "posts.title": "you", "posts.author": 2 },
                        { "users.id": 4, "users.age": 21, "users.name": "Val", "users.email": "val@gmail.com", "users.meta": { "value": 1 }, "users.posts": [1, 2, 3], "posts.id": 5, "posts.title": "up", "posts.author": 1 }
                    ], "Cross join failed!");
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
    */
});