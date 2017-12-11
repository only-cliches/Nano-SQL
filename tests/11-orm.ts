import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
import { usersDB, ExampleUsers, ExampleDataModel } from "./data";

const ormDataModels = {
    "users": [
        {key: "id", type: "int", props: ["pk", "ai"]},
        {key: "name", type: "string"}
    ],
    "posts": [
        {key: "id", type: "int", props: ["pk", "ai"]},
        {key: "title", type: "string"}
    ]
};


describe("ORM System", () => {
    it("Related records should auto add.", (done: MochaDone) => {
        nSQL("users").model(ormDataModels.users.concat([
            {key: "posts", type: "posts[]", props: ["ref=>author"] }
        ]));
        nSQL("posts").model(ormDataModels.posts.concat([
            {key: "author", type: "users", props: ["ref=>posts[]"]}
        ]));
        nSQL().connect().then(() => {
            return nSQL("users").query("upsert", {
                name: "billy",
                posts: []
            }).exec();
        }).then(() => {
            return nSQL("posts").query("upsert", {
                title: "How To Fly",
                author: 1
            }).exec();
        }).then(() => {
            return nSQL("users").query("select").exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal( [ { name: "billy", posts: [ 1 ], id: 1 } ], "Auto add ORM failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Related records should auto remove when updated.", (done: MochaDone) => {
        nSQL("users").model(ormDataModels.users.concat([
            {key: "posts", type: "posts[]", props: ["ref=>author"] }
        ]));
        nSQL("posts").model(ormDataModels.posts.concat([
            {key: "author", type: "users", props: ["ref=>posts[]"]}
        ]));
        nSQL().connect().then(() => {
            return nSQL("users").query("upsert", {
                name: "billy",
                posts: []
            }).exec();
        }).then(() => {
            return nSQL("posts").query("upsert", {
                title: "How To Fly",
                author: 1
            }).exec();
        }).then(() => {
            return nSQL("posts").query("upsert", {
                id: 1,
                author: null
            }).exec();
        }).then(() => {
            return nSQL("users").query("select").exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal( [ { name: "billy", posts: [], id: 1 } ], "Auto remove on update failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
    it("Related records should auto remove when updated (Other direction).", (done: MochaDone) => {
        nSQL("users").model(ormDataModels.users.concat([
            {key: "posts", type: "posts[]", props: ["ref=>author"] }
        ]));
        nSQL("posts").model(ormDataModels.posts.concat([
            {key: "author", type: "users", props: ["ref=>posts[]"]}
        ]));
        nSQL().connect().then(() => {
            return nSQL("users").query("upsert", {
                name: "billy",
                posts: []
            }).exec();
        }).then(() => {
            return nSQL("posts").query("upsert", {
                title: "How To Fly",
                author: 1
            }).exec();
        }).then(() => {
            return nSQL("users").query("upsert", {
                id: 1,
                posts: []
            }).exec();
        }).then(() => {
            return nSQL("posts").query("select").exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal( [ { title: "How To Fly", author: null, id: 1 } ], "Auto remove on update failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Related records should auto remove when deleted.", (done: MochaDone) => {
        nSQL("users").model(ormDataModels.users.concat([
            {key: "posts", type: "posts[]", props: ["ref=>author"] }
        ]));
        nSQL("posts").model(ormDataModels.posts.concat([
            {key: "author", type: "users", props: ["ref=>posts[]"]}
        ]));
        nSQL().connect().then(() => {
            return nSQL("users").query("upsert", {
                name: "billy",
                posts: []
            }).exec();
        }).then(() => {
            return nSQL("posts").query("upsert", {
                title: "How To Fly",
                author: 1
            }).exec();
        }).then(() => {
            return nSQL("posts").query("delete").where(["id", "=", 1]).exec();
        }).then(() => {
            return nSQL("users").query("select").exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal( [ { name: "billy", posts: [], id: 1 } ], "Auto remove on delete failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Many to Many relationships should remain in sync.", (done: MochaDone) => {
        nSQL("users").model(ormDataModels.users.concat([
            {key: "posts", type: "posts[]", props: ["ref=>authors[]"] }
        ]));
        nSQL("posts").model(ormDataModels.posts.concat([
            {key: "authors", type: "users[]", props: ["ref=>posts[]"]}
        ]));
        nSQL().connect().then(() => {
            return nSQL("users").loadJS("users", [
                {name: "Billy", posts: []},
                {name: "Jeb", posts: []}
            ]);
        }).then(() => {
            return nSQL("posts").query("upsert", {
                title: "How To Fly",
                authors: [1, 2]
            }).exec();
        }).then(() => {
            return nSQL("users").query("select").exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal( [
                    {id: 1, name: "Billy", posts: [1]},
                    {id: 2, name: "Jeb", posts: [1]}
                ], "Many to many relationships failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Many to Many relationships should remain in sync when a delete happens.", (done: MochaDone) => {
        nSQL("users").model(ormDataModels.users.concat([
            {key: "posts", type: "posts[]", props: ["ref=>authors[]"] }
        ]));
        nSQL("posts").model(ormDataModels.posts.concat([
            {key: "authors", type: "users[]", props: ["ref=>posts[]"]}
        ]));
        nSQL().connect().then(() => {
            return nSQL("users").loadJS("users", [
                {name: "Billy", posts: []},
                {name: "Jeb", posts: []}
            ]);
        }).then(() => {
            return nSQL("posts").query("upsert", {
                title: "How To Fly",
                authors: [1, 2]
            }).exec();
        }).then(() => {
            return nSQL("posts").query("delete").where(["id", "=", 1]).exec();
        }).then(() => {
            return nSQL("users").query("select").exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal( [
                    {id: 1, name: "Billy", posts: []},
                    {id: 2, name: "Jeb", posts: []}
                ], "Many to many relationships failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("Many to Many relationships should remain in sync when a delete happens (other direction).", (done: MochaDone) => {
        nSQL("users").model(ormDataModels.users.concat([
            {key: "posts", type: "posts[]", props: ["ref=>authors[]"] }
        ]));
        nSQL("posts").model(ormDataModels.posts.concat([
            {key: "authors", type: "users[]", props: ["ref=>posts[]"]}
        ]));
        nSQL().connect().then(() => {
            return nSQL("users").loadJS("users", [
                {name: "Billy", posts: []},
                {name: "Jeb", posts: []}
            ]);
        }).then(() => {
            return nSQL("posts").query("upsert", {
                title: "How To Fly",
                authors: [1, 2]
            }).exec();
        }).then(() => {
            return nSQL("users").query("delete").where(["id", "=", 1]).exec();
        }).then(() => {
            return nSQL("posts").query("select").exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal( [
                    {id: 1, title: "How To Fly", authors: [2]}
                ], "Many to many relationships failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("ORM Query.", (done: MochaDone) => {
        nSQL("users").model(ormDataModels.users);
        nSQL("posts").model(ormDataModels.posts.concat([
            {key: "authors", type: "users[]"}
        ]));
        nSQL().connect().then(() => {
            return nSQL("users").loadJS("users", [
                {name: "Billy"},
                {name: "Jeb"},
                {name: "Val"}
            ]);
        }).then(() => {
            return nSQL("posts").query("upsert", {
                title: "How To Fly",
                authors: [1, 3]
            }).exec();
        }).then(() => {
            return nSQL("posts").query("select").orm(["authors"]).exec();
        }).then((rows) => {
            try {
                expect(rows).to.deep.equal( [
                    {id: 1, title: "How To Fly", authors: [
                        {id: 1, name: "Billy"},
                        {id: 3, name: "Val"}
                    ]}
                ], "ORM Query failed!");
                done();
            } catch (e) {
                done(e);
            }
        });
    });
});