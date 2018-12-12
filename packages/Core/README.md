Universal database for the client, server & mobile devices.  It's like Lego for databases.
<center>
<img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">


[![npm downloads](https://img.shields.io/npm/dm/@nano-sql/core/svg?style=flat-square)](https://www.npmjs.com/package/@nano-sql/core)
[![npm version](https://badge.fury.io/js/%40nano-sql%2Fcore.svg)](https://badge.fury.io/js/%40nano-sql%2Fcore)
[![npm](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE)
![TSlint](https://img.shields.io/badge/tslint-passing-green.svg?style=flat-square)
</center>

<img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/1-standalone-1.0.png">
<img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/2-serverclient-1.0.png">
<img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/3-multiserverclient-1.0.png">

NanoSQL 2.0 is in BETA state right now, tons of undocumented breaking changes from 1.0.

The API is also not stable, not recommended for production environments.

Current minified build:
https://cdn.jsdelivr.net/npm/@nano-sql/core@2.0.0-rc9/dist/nano-sql.min.js

NPM Install
```sh
npm i @nano-sql/core
```

# 2.0 Progress
- [x] Query Engine 
- [x] Hook/Filter System
- [x] Memory/Local Storage Adapter
- [x] Graph Query Support
- [x] Event System
- [x] Indexed DB/WebSQL/RocksDB Adapters
- [x] Core Tests
- [x] Adapter Tests
- [ ] 2.0 documentation
- [ ] 2.0 release
- [ ] SQLite3, Cordova, Redis, ReactNative, MySQL Adapters
- [ ] Net Plugin (Offline Syncing)
- [ ] Search Plugin
- [ ] History Plugin
- [ ] SQLite Query Support
- [ ] GraphQL Query Support
- [ ] MongoDB Query Support
- [ ] ReQL Query Support

# Examples

```ts
// Persistent Database
nSQL().connect({
    id: "test",
    mode: "PERM",
    tables: [
        {
            name: "users",
            model: {
                "id:uuid": {pk: true},
                "name:string": {},
                "age:int": {},
                "meta:obj": {
                    model: {
                        "color:string": {}
                    }
                },
                "tags:string[]": {default: []}
            }
            indexes: {
                "tags:string[]": {},
                "meta.color:string": {},
                "age:int": {}
            }
        }
    ],
}).then(() => {
    return nSQL("users").query("upsert", {name: "Jeb", age: 20, meta: {color: "blue"}, tags: ["some", "tags", "here"]}).exec();
}).then(() => {
    return nSQL("users").query("select").exec();
}).then((rows) => {
    console.log(rows);
    /*
    [
        {
            "id": "64c611b8-0b1e-42f6-af52-5b8289834bba",
            "name": "Billy",
            "age": 21,
            "meta": {
                "color": "blue"
            },
            "tags": [
                "some",
                "tags",
                "here"
            ]
        }
    ]
    */
});

// Graph Queries
nSQL().query("select", ["author[0].name AS author", "body", "comments[0].totalComments AS commentsTotal", "id", "title"]).from({
    table: () => fetch("https://jsonplaceholder.typicode.com/posts").then(d => d.json()).then(j => ({rows: j, cache: true})),
    as: "posts"
}).graph([
    {
        key: "author",
        with: {
            table: () => fetch("https://jsonplaceholder.typicode.com/users").then(d => d.json()).then(j => ({rows: j, cache: true})),
            as: "author"
        },
        on: ["author.id", "=", "posts.userId"]
    },
    {
        key: "comments",
        select: ["COUNT(*) as totalComments"],
        with: {
            table: () => fetch("https://jsonplaceholder.typicode.com/comments").then(d => d.json()).then(j => ({rows: j, cache: true})),
            as: "comments"
        },
        on: ["comments.postId", "=", "posts.id"]
    }
]).exec().then((rows) => {
    console.log(rows);
    /*
        "author": "Leanne Graham",
        "body": "quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto",
        "commentsTotal": 5,
        "id": 1,
        "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit"
    },
    {
        "author": "Leanne Graham",
        "body": "est rerum tempore vitae\nsequi sint nihil reprehenderit dolor beatae ea dolores neque\nfugiat blanditiis voluptate porro vel nihil molestiae ut reiciendis\nqui aperiam non debitis possimus qui neque nisi nulla",
        "commentsTotal": 5,
        "id": 2,
        "title": "qui est esse"
    }
    ...
    */
});

// Join Queries
nSQL().query("select", ["posts.id AS id", "posts.title AS title", "comments.name AS comment", "users.name AS name"]).from({ 
    table: () => fetch("https://jsonplaceholder.typicode.com/posts").then(d => d.json()).then(j => ({rows: j, cache: true})),
    as: "posts" 
}).where(["userId", "=", 3]).join([
    {
        type: "inner",
        with: {
            table: () => fetch("https://jsonplaceholder.typicode.com/comments").then(d => d.json()).then(j => ({rows: j, cache: true})),
            as: "comments"
        },
        on: ["posts.id", "=", "comments.postId"]
    },
    {
        type: "inner",
        with: {
            table: () => fetch("https://jsonplaceholder.typicode.com/users").then(d => d.json()).then(j => ({rows: j, cache: true})),
            as: "users"
        },
        on: ["users.id", "=", "posts.userId"]
    }
])
.exec().then((rows) => {
    console.log(rows);
    /*
    [
        {
            "id": 21,
            "title": "asperiores ea ipsam voluptatibus modi minima quia sint",
            "comment": "perspiciatis magnam ut eum autem similique explicabo expedita",
            "name": "Clementine Bauch"
        },
        {
            "id": 21,
            "title": "asperiores ea ipsam voluptatibus modi minima quia sint",
            "comment": "officia ullam ut neque earum ipsa et fuga",
            "name": "Clementine Bauch"
        },
        .....
    ]
    */
})
```