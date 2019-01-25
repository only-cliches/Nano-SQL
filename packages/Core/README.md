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
  <strong>Universal database layer for the client, server & mobile devices.  It's like Lego for databases.</strong>
</p>

[Documentation](https://nanosql.gitbook.io/docs/) | [API Docs](https://gitcdn.xyz/repo/ClickSimply/Nano-SQL/2.0/packages/Core/api/index.html) | [Issues](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

# What is nanoSQL?
nanoSQL core provides a standardized query language, data modeling, indexing and plugin system that can use almost any database technology for data storage and query; providing a consistent experience across environments and database engines.  You can mix and match database backends, query languages and plugins to get the ideal environnement for rapid development.

### Identical API Everywhere
Develop your application with an embedded database like RocksDB, then deploy into production with Redis, Amazon Dynamo, MySQL or many others.  NanoSQL even runs in the browser on top of IndexedDB, WebSQL or LocalStorage.  **All data is portable and all features are isomorphic**; jumping between different databases and environments is trivial.

### Not Only NoSQL 
Classical RDBMS queries like aggregate functions, joins and group bys are also supported.  You can even write your own query functions and use foreign keys!

### Flexible Data Models
The best of both worlds: Use RDBMS style data models to tune performance but still allow arbitrary columns.  Change your data model as often as you want and do type casting only when you need it.

### Data Models => TypeScript Types
Instantly convert data models into typescript interfaces.

### Graph Queries
Use indexing to build nested graph queries on your data with the power of RDBMS and flexibility of noSQL.

### Other Cool Things
Built in geolocation indexing, typescript support, event system, CSV/JSON import & export, runs in every browser back to IE9 and starts at only 25KB!


## Comparison with Other Projects

|           | nanoSQL | TaffyDB   | NeDB | LoveField | PouchDB | alaSQL | RxDB | SQL.js | Lunr |
|-----------|---------|---------|------|-----------|---------|--------|--------|--------|-----|
| Events    | ✓       | ✓      | ✕    | ✓         | ✓       | ✕      | ✓      | ✕      | ✕      |
| Typescript| ✓       | ✕      | ✓    | ✓         | ✓       | ✕      | ✓      | ✓      |✓      |
| Graph Queries  | ✓       | ✕      | ✕    | ✕         | ✕       | ✕      | ✕      | ✕      | ✕      |
| Join Queries  | ✓       | ✓      | ✓    | ✓         | ✕       | ✓      | ✕      | ✓      | ✕      |
| IndexedDB | ✓       | ✕      | ✕    | ✓         | ✓       | ✓      | ✓      | ✕      | ✕      |
| Node      | ✓       | ✓      | ✓    | ✕         | ✓       | ✓      | ✓      | ✓      | ✓      |
| Foreign Keys  | ✓   | ✕      | ✕    | ✓         | ✕       | ✓      | ✕      | ✓      | ✕      |
| Query Functions | ✓ | ✕      | ✕    | ✕         | ✕       | ✓      | ✕      | ✓      | ✕      |
| Custom Backends | ✓ | ✕      | ✕    | ✕         | ✓       | ✕      | ✓      | ✕      | ✕      |
| Size (kb) | 26      | 5      | 27   | 40         | 46      | 88     | 164     | 500    | 8 |


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
4. **[MySQL](https://www.npmjs.com/package/@nano-sql/adapter-mysql)**
5. **[Amazon Dynamo DB](https://www.npmjs.com/package/@nano-sql/adapter-dynamo)**
6. **[MongoDB](https://www.npmjs.com/package/@nano-sql/adapter-mongo)**
7. **[ScyllaDB](https://www.npmjs.com/package/@nano-sql/adapter-scylla)**


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
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.1.1/dist/nano-sql.min.js"></script>
```

## Important
If you are migrating from nanoSQL 1.X to 2.X, please read the [migration guide](https://nanosql.gitbook.io/docs/5-migration/1.x-2.0).

# CLI

The nanoSQL command line interface allows you to compile data models into typescript interface files.

Usage is as follows:
```sh
nsql --outDir www --files file1.ts file2.ts... --watch
```

If you don't pass `--watch` the CLI will compile the files into the given directory, then exit.  You can also optionally pass `--watchPolling` with an interval to enable polling on the watch system.

It's important to note the files must be formatted specifically for the CLI to read them correctly.

Each file should have an export named `tables` that is an array of `InanoSQLTableConfig` types.  The file below is a working example:

```ts
import { InanoSQLTableConfig } from "@nano-sql/core/lib/interfaces";

export const tables: InanoSQLTableConfig[] = [
    {
        name: "users",
        model: {
            "id:uuid": {pk: true},
            "age:float": {notNull: true},
            "name:string[]": {default: []},
            "properties:meta[]": {},
            "address:obj": {
                model: {
                    "street:string":{},
                    "city:string":{},
                    "zip:string":{},
                    "state:string":{}
                }
            },
            "*:any": {}
        }
    }
];

export const types = {
    meta: {
        "key:string": {notNull: true},
        "value:any": {notNull: true}
    }
}

// using the above object in nSQL
import { nSQL } from "@nano-sql/core";
nSQL().connect({
    id: "my_db",
    tables: tables,
    types: types
}).then..
```

Assuming the above file is in the root directory of our project named index.ts, we could compile it to a typescript interface file with this command:

```sh
nsql --outDir www --files index.ts
```

The above command would produce the following file:

```ts
import { uuid, timeId, timeIdms } from  "@nano-sql/core/lib/interfaces";

export interface ItableUsers {
	id:uuid;
	age:number;
	name:string[];
	properties?:ItypeMeta[];
	address?:{
		street?:string;
		city?:string;
		zip?:string;
		state?:string;
	};
	[key: string]: any;
}

export interface ItypeMeta {
	key:string;
	value:any;
}

```

# Query Examples

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