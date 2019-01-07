Universal database for the client, server & mobile devices.  It's like Lego for databases.
<center>
<img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">

[![npm version](https://badge.fury.io/js/%40nano-sql%2Fcore.svg)](https://badge.fury.io/js/%40nano-sql%2Fcore)
[![npm](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE)
![TSlint](https://img.shields.io/badge/tslint-passing-green.svg?style=flat-square)
</center>

# NOTICE: This is the IN PROGRESS readme for nanoSQL 2.0.  Some of these features are not in place yet.
Scroll down for the todo list and it's progress.

## nanoSQL is a database abstraction layer that: 
1. Makes running noSQL a breeze anywhere (NodeJS / Browser / Cordova / React Native / Electron).
2. Use nanoSQL standalone, as the glue between your server and clients, or even with multi master servers.
3. Supports many advanced features like Graph Queries, Map/Reduce, Indexing, and Geolocations.
4. Lets you use almost any database technology (RocksDB, MySQL, SQLite, Amazon Dynamo, etc...).
5. Is Lightweight at 25 KB gzipped.

### Identical API Everywhere
Develop your application with an embedded database like RocksDB, then deploy into production with Redis, Amazon Dynamo, MySQL or many others.  NanoSQL even runs in the browser on top of IndexedDB, WebSQL or LocalStorage.  **All data is portable and all features are isomorphic**; jumping between different databases and environments is trivial.

### Data Model => Typescript Interface
Automatically generate typescript interfaces from your data models.

### Offline Syncing
Run nanoSQL on your server and client, then with little effort allow nanoSQL to handle the eventual consistency problems and keep both ends in sync with eachother.

### Not Only NoSQL 
Classical RDBMS queries like aggregate functions, joins and group bys are also supported.

### Flexible Data Models
The best of both worlds: Use RDBMS style data models to tune performance but still allow arbtrary columns.  Change your data model as often as you want and do type casting only when you need it.

### Other Cool Things
Built in geolocation indexing, query functions, multi-tab sync, typescript support, event system, CSV/JSON import & export, graph query support, and runs in every browser back to IE9!

## Live Examples: [Express/NodeJS](https://docs.nanosql.io/examples/express) - [React](https://docs.nanosql.io/examples/react) - [React Native](https://docs.nanosql.io/examples/react-native) - [Angular](https://docs.nanosql.io/examples/angular) - [Vue](https://docs.nanosql.io/examples/vue) - [Cordova](https://docs.nanosql.io/examples/cordova)


## Browser Support

![Chrome](https://raw.github.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png) | ![Firefox](https://raw.github.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png) | ![Safari](https://raw.github.com/alrra/browser-logos/master/src/safari/safari_48x48.png) | ![Opera](https://raw.github.com/alrra/browser-logos/master/src/opera/opera_48x48.png) | ![Edge](https://raw.github.com/alrra/browser-logos/master/src/edge/edge_48x48.png) | ![IE](https://raw.github.com/alrra/browser-logos/master/src/archive/internet-explorer_9-11/internet-explorer_9-11_48x48.png) |
--- | --- | --- | --- | --- | --- |
Latest ✔ | Latest ✔ | Latest ✔ | Latest ✔ | Latest ✔ | 9+ ✔ |

## Database Support

NanoSQL can save data to many different places, depending on the browser or environment it's being ran in.

1. **Included In The Box**
    - Memory
    - Rocks DB
    - Indexed DB
    - WebSQL
    - Local Storage

2. **[SQLite (NodeJS)](#)**
3. **[SQLite (Cordova)](#)**
4. **[MySQL](#)**
5. **[React Native](#)**
6. **[Redis](#)**
7. **[Amazon Dynamo DB](#)**

[Documentation](https://nanosql.gitbook.io/docs/) | [API Docs](https://gitcdn.xyz/repo/ClickSimply/Nano-SQL/2.0/packages/Core/api/index.html)

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
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.0.0-rc19/dist/nano-sql.min.js"></script>
```

## Important
If you are migrating from nanoSQL 1.X to 2.X, please read the [migration guide](https://nanosql.gitbook.io/docs/5-migration/1.x-2.0).

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
- [ ] SQLite3, Cordova, Redis, ReactNative, MySQL, Amazon Dynamo DB Adapters
- [ ] GraphQL Support
- [ ] Net Plugin (Offline Syncing)
- [ ] Search Plugin
- [ ] History Plugin
- [ ] SQLite Query Support
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