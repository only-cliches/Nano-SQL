<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fcore">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fcore.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2</h1>
<p align="center">
  <strong>Universal database for the client, server & mobile devices.  It's like Lego for databases.</strong>
</p>

[Documentation](https://nanosql.gitbook.io/docs/) | [API Docs](https://gitcdn.xyz/repo/ClickSimply/Nano-SQL/2.0/packages/Core/api/index.html) | [Help](https://github.com/ClickSimply/Nano-SQL/issues)

## nanoSQL is a database abstraction layer that: 
1. Makes running noSQL a breeze anywhere (NodeJS / Browser / Cordova / React Native / Electron).
2. Supports many advanced features like Graph Queries, Indexing, and Geolocations.
3. Lets you use almost any database technology (RocksDB, IndexedDB, WebSQL, etc).
4. Starts at only 25 KB gzipped.

### Identical API Everywhere
Develop your application with an embedded database like RocksDB, then deploy into production with Redis, Amazon Dynamo, MySQL or many others.  NanoSQL even runs in the browser on top of IndexedDB, WebSQL or LocalStorage.  **All data is portable and all features are isomorphic**; jumping between different databases and environments is trivial.

### Not Only NoSQL 
Classical RDBMS queries like aggregate functions, joins and group bys are also supported.

### Flexible Data Models
The best of both worlds: Use RDBMS style data models to tune performance but still allow arbitrary columns.  Change your data model as often as you want and do type casting only when you need it.

### Graph Queries
Use indexing to build nested graph queries on your data with the power of RDBMS and flexibility of noSQL.

### Other Cool Things
Built in geolocation indexing, query function support, typescript support, event system, CSV/JSON import & export, and runs in every browser back to IE9!


## Comparison with Other Projects

|           | nanoSQL | TaffyDB  | LokiJS | NeDB | LoveField | PouchDB | alaSQL | RxDB | SQL.js | Lunr |
|-----------|---------|---------|--------|------|-----------|---------|--------|--------|--------|-----|
| Events    | ✓       | ✓      | ✓      | ✕    | ✓         | ✓       | ✕      | ✓      | ✕      | ✕      |
| Typescript| ✓       | ✕      | ✓      | ✓    | ✓         | ✓       | ✕      | ✓      | ✓      |✓      |
| Graph Queries  | ✓       | ✕      | ✕      | ✕    | ✕         | ✕       | ✕      | ✕      | ✕      | ✕      |
| Join Queries  | ✓       | ✓      | ✓      | ✓    | ✓         | ✕       | ✓      | ✕      | ✓      | ✕      |
| IndexedDB | ✓       | ✕      | ✓      | ✕    | ✓         | ✓       | ✓      | ✓      | ✕      | ✕      |
| Node      | ✓       | ✓      | ✓      | ✓    | ✕         | ✓       | ✓      | ✓      | ✓      | ✓      |
| Query Functions | ✓ | ✕      | ✕      | ✕    | ✕         | ✕       | ✓      | ✕      | ✓      | ✕      |
| Size (kb) | 25      | 5       | 19      | 27   | 40         | 46      | 88     | 164     | 500    | 8 |


## Database Support

NanoSQL can save data to many different places, depending on the browser or environment it's being ran in.

1. **Included In The Box**
    - Memory
    - Rocks DB
    - Indexed DB
    - WebSQL
    - Local Storage

2. **[SQLite (NodeJS)](https://www.npmjs.com/package/@nano-sql/adapter-sqlite)**
3. **[Redis](https://www.npmjs.com/package/@nano-sql/adapter-redis)**
4. **[Amazon Dynamo DB](https://www.npmjs.com/package/@nano-sql/adapter-dynamo)**

## Installation

```sh
npm i @nano-sql/core --save
```

Using in Typescript/Babel project:

```js
import { nSQL } from "@nano-sql/core";
```

Using in Node:

```js
const nSQL = require("@nano-sql/core").nSQL;
```

To use directly in the browser, drop the tag below into your `<head>`.

```html
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.0.2/dist/nano-sql.min.js"></script>
```

## Important
If you are migrating from nanoSQL 1.X to 2.X, please read the [migration guide](https://nanosql.gitbook.io/docs/5-migration/1.x-2.0).


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

# 2.0 Progress
- [x] Query Engine 
- [x] Hook/Filter System
- [x] Memory/Local Storage Adapter
- [x] Graph Query Support
- [x] Event System
- [x] Indexed DB/WebSQL/RocksDB Adapters
- [x] Core Tests
- [x] Adapter Tests
- [x] 2.0 documentation
- [x] 2.0 release
- [ ] SQLite3, Cordova, Redis, ReactNative, MySQL, Amazon Dynamo DB Adapters
- [ ] GraphQL Support
- [ ] Net Plugin (Offline Syncing)
- [ ] Search Plugin
- [ ] History Plugin
- [ ] SQLite Query Support
- [ ] MongoDB Query Support
- [ ] ReQL Query Support