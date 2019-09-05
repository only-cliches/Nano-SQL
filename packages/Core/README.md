<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/master/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/master/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fcore">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fcore.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
  <a href="https://snyk.io/test/npm/@nano-sql/core">
    <img src="https://snyk.io/test/npm/@nano-sql/core/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/npm/@nano-sql/core" style="max-width:100%;">
  </a>
  <a href="https://www.npmjs.com/package/@nano-sql/core">
    <img src="https://img.shields.io/npm/dm/@nano-sql/core.svg">
  </a>
</p>

<h1 align="center">nanoSQL 2</h1>
<p align="center">
  <strong>Universal database layer for the client, server & mobile devices.  It's like Lego for databases.</strong>
</p>

[Documentation](https://nanosql.io/setup.html) | [API Docs](https://api.nano-sql.io) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

# What is nanoSQL?
nanoSQL core provides a standardized query language, data modeling, indexing and plugin system that can use almost any database technology for data storage and query; providing a consistent experience across environments and database engines.  You can mix and match database backends, query languages and plugins to get the ideal environnement for rapid development.

One of the big items that lead me to build nanoSQL was how NoSQL stores are becoming so popular and performant yet none of them have SQL semantics when you need them. It’s like you have to choose between good performance (noSQL/Document Store) or having stable data modeling with advanced query capability (SQL Style). It seems to me that you can have both, you just have to be aware of the tradeoffs. The big idea here is to build a SQL style parser on top of noSQL datastores.   This buys you the strong data models (which is critical in my opinion) of SQL style systems and noSQL level performance if you play inside a [small set of rules](https://nanosql.io/performance.html). You can jump outside those rules whenever you like at the cost of speed…and that’s the point. YOU the developer get to make the choice when and how that happens.

### Multiple Database & Adapter Support
Run several databases in parallel, each database can use it's own backend adapter.  This means you could have one nanoSQL instance running a Redis based database, a MySQL based database and a RocksDB based database at the same time seamlessly!

### Identical API Everywhere
Develop your application with an embedded database like RocksDB, then deploy into production with Redis, Amazon Dynamo, MySQL or many others.  nanoSQL even runs in the browser on top of IndexedDB, WebSQL or LocalStorage.  **All data is portable and all features are isomorphic**; jumping between different databases and environments is trivial.

### Not Only NoSQL 
Classical RDBMS queries like aggregate functions, joins and group bys are also supported.  You can even write your own query functions and use foreign keys!

### Flexible Data Models
The best of both worlds: Use RDBMS style data models to tune performance but still allow arbitrary columns.  Change your data model as often as you want and do type casting only when you need it.

### Data Models => TypeScript Files
Instantly convert nanoSQL data models into typescript interface files.

### Graph Queries
Use indexing to build nested graph queries on your data with the power of RDBMS and flexibility of noSQL.

### Other Cool Things
Built in geolocation indexing, autocomplete, observable queries, typescript support, event system, CSV/JSON import & export, fuzzy search, runs in every browser back to IE9 and starts at only 30KB!


## Comparison with Other Projects

|                 | nanoSQL | TaffyDB| NeDB | LoveField | PouchDB | alaSQL |  RxDB  | SQL.js |  Lunr  |
|-----------------|---------|--------|------|-----------|---------|--------|--------|--------|--------|
| Events          | ✓       | ✓      | ✕    | ✓         | ✓       | ✕      | ✓      | ✕      | ✕      |
| Typescript      | ✓       | ✕      | ✓    | ✓         | ✓       | ✕      | ✓      | ✓      | ✓      |
| Graph Queries   | ✓       | ✕      | ✕    | ✕         | ✕       | ✕      | ✕      | ✕      | ✕      |
| Join Queries    | ✓       | ✓      | ✓    | ✓         | ✕       | ✓      | ✕      | ✓      | ✕      |
| IndexedDB       | ✓       | ✕      | ✕    | ✓         | ✓       | ✓      | ✓      | ✕      | ✕      |
| NodeJS          | ✓       | ✓      | ✓    | ✕         | ✓       | ✓      | ✓      | ✓      | ✓      |
| Foreign Keys    | ✓       | ✕      | ✕    | ✓         | ✕       | ✓      | ✕      | ✓      | ✕      |
| Query Functions | ✓       | ✕      | ✕    | ✕         | ✕       | ✓      | ✕      | ✓      | ✕      |
| Custom Backends | ✓       | ✕      | ✕    | ✕         | ✓       | ✕      | ✓      | ✕      | ✕      |
| Fuzzy Search *  | ✓       | ✕      | ✕    | ✕         | ✕       | ✕      | ✕      | ✕      | ✓      |
| Size (kb)       | 30      | 5      | 27   | 40        | 46      | 88     | 164    | 500    | 8      |

\* Requires additional plugin not included in the bundle size shown in the table.

## Database Support

NanoSQL can save data to many different places, depending on the browser or environment it's being ran in.

1. **Included In The Box**
    - Memory (Browser/NodeJS/Electron)
    - Snap DB (NodeJS/Electron)
    - Indexed DB (Browser)
    - WebSQL (Browser)
    - Local Storage (Browser)

2. **[RocksDB (NodeJS/Electron)](https://www.npmjs.com/package/@nano-sql/adapter-rocksdb)**
3. **[LevelDB (NodeJS/Electron)](https://www.npmjs.com/package/@nano-sql/adapter-leveldb)**
4. **[SQLite (NodeJS/Electron)](https://www.npmjs.com/package/@nano-sql/adapter-sqlite)**
5. **[SQLite (Cordova)](https://www.npmjs.com/package/@nano-sql/adapter-sqlite-cordova)**
6. **[SQLite (NativeScript)](https://www.npmjs.com/package/@nano-sql/adapter-sqlite-nativescript)**
7. **[React Native](https://www.npmjs.com/package/@nano-sql/adapter-react-native)**
8. **[Redis](https://www.npmjs.com/package/@nano-sql/adapter-redis)**
9. **[MySQL](https://www.npmjs.com/package/@nano-sql/adapter-mysql)**
10. **[Amazon Dynamo DB](https://www.npmjs.com/package/@nano-sql/adapter-dynamo)**
11. **[MongoDB](https://www.npmjs.com/package/@nano-sql/adapter-mongo)**
12. **[ScyllaDB](https://www.npmjs.com/package/@nano-sql/adapter-scylla)**

## Plugins
- **[Fuzzy Search](https://www.npmjs.com/package/@nano-sql/plugin-fuzzy-search)**
- **[Redis Index](https://www.npmjs.com/package/@nano-sql/plugin-redis-index)**


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

To use directly in the browser, drop one of the tags below into your `<head>`.

```html
<!-- ES6 Only (Faster & Smaller) -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.3.7/dist/nano-sql.min.js" integrity="sha256-W1pVgKda7GC4fwXqq9jfOrssBDJJXZqck+ultRPVzmc=" crossorigin="anonymous"></script>
<!-- ES5 (Internet Explorer/Old Browser Support) -->
<!-- Promise must be polyfilled as well -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.3.7/dist/nano-sql.min.es5.js" integrity="sha256-1t9VlpFUgHaxlLQy6HM9ROQvTiuUv2M12Fp1oTh3+yg=" crossorigin="anonymous"></script>
```

## Important
If you are migrating from nanoSQL 1.X to 2.X, please read the [migration guide](https://nanosql.io/migration.html#_1-x-2-0-migration).


# Query Examples

```ts
// Persistent Database
nSQL().createDatabase({
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
nSQL().createDatabase({
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
- [x] SQLite3, Cordova, Redis, ReactNative, MySQL, Amazon Dynamo DB Adapters
- [ ] GraphQL Support
- [ ] Net Plugin (Offline Syncing)
- [ ] Search Plugin
- [ ] History Plugin
- [ ] SQLite Query Support
- [ ] MongoDB Query Support
- [ ] ReQL Query Support


