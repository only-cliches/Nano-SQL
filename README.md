Super flexible database/datastore for the client, server & mobile devices.

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">


[![npm](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/nano-sql/blob/master/LICENSE)
![TSlint](https://img.shields.io/badge/tslint-passing-green.svg?style=flat-square)
[![npm downloads](https://img.shields.io/npm/dm/nano-sql.svg?style=flat-square)](https://www.npmjs.com/package/nano-sql)

[![NPM](https://nodei.co/npm/nano-sql.png?downloads=true&stars=true)](https://nodei.co/npm/nano-sql/)

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/quick-demo.gif" alt="Demo">

NanoSQL is the smallest and quickest way to get SQL power into your app. You get tons of RDBMS perks like joins, groupby, functions and orderby with strong runtime type casting, events, IndexedDB support, transactions and an ORM.  

Persistence supports `Local Storage`, `Indexed DB`, and `WebSQL` in the browser, and `Level DB` in NodeJS *with the same API*.  The storage engine is automatically selected based on the browser/environment, or can be manually selected.

## Live Examples: [Express](https://docs.nanosql.io/examples/express) - [React](https://docs.nanosql.io/examples/react) - [Angular](https://docs.nanosql.io/examples/angular) - [Vue](https://docs.nanosql.io/examples/vue) - [Cordova](https://docs.nanosql.io/examples/cordova)

[Documentation](https://docs.nanosql.io/)

## Highlighted Features

- **Easy `LevelDB`, `IndexedDB`, `WebSQL` support**.
- Runs in Node, IE9+ & modern browsers.
- Supports all common RDBMS queries.
- Import and Export CSV/JSON.
- **Simple & elegant undo/redo.**
- Full Typescript support.
- **Runtime type casting.**
- **Complete ORM support.**
- Fast secondary indexes.
- Full events system.

## NEW: Observable Queries

Use observables to subscribe to table changes and automatically update your views.
```ts
nSQL().observable(() => {
    return nSQL("users").query("select").emit(); // use .emit() instead of .exec()
})
.debounce(1000) // dont trigger more than every second (optional)
.distinct() // only trigger if the previous record doesn't match the next record to trigger (optional)
.filter(rows => rows.length) // use a filter function to only emit changes based on provided fn. (optional)
.map(rows => rows) // mutate the results (optional)
.first() // only emit the first change (optional)
.skip(10) // skip the first n elements (optional)
.take(10) // only get the first n elements (optional)
.subscribe((rows) => {
    // Update view here, this will be called each time the "users" table changes
})
```

## NEW: Fuzzy Search
```ts
// first set which columns are indexed
nSQL("posts")
.model([
    {key: "id", type: "uuid", props: ["pk"]},
    {key: "title", type: "string", props: ["search(english, 5)"]}, // arguments are tokenizer, weight
    {key: "body", type: "string", props: ["search(english, 1)"]}
]).connect().then(() => {
    // search the title and body columns for items with above .4 relevance for "some search term"
    return nSQL("posts").query("select").where(["search(title, body)", ">0.4", "some search term"]).exec();
})....
```

## Browser Support

![Chrome](https://raw.github.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png) | ![Firefox](https://raw.github.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png) | ![Safari](https://raw.github.com/alrra/browser-logos/master/src/safari/safari_48x48.png) | ![Opera](https://raw.github.com/alrra/browser-logos/master/src/opera/opera_48x48.png) | ![Edge](https://raw.github.com/alrra/browser-logos/master/src/edge/edge_48x48.png) | ![IE](https://raw.github.com/alrra/browser-logos/master/src/archive/internet-explorer_9-11/internet-explorer_9-11_48x48.png) |
--- | --- | --- | --- | --- | --- |
Latest ✔ | Latest ✔ | Latest ✔ | Latest ✔ | Latest ✔ | 9+ ✔ |

## Comparison With Other Projects

|           | nanoSQL | TaffyDB  | LokiJS | NeDB | LoveField | PouchDB | alaSQL | RxDB | SQL.js |
|-----------|---------|---------|--------|------|-----------|---------|--------|--------|--------|
| Events    | ✓       | ✓      | ✓      | ✕    | ✓         | ✓       | ✕      | ✓      | ✕      |
| Typescript| ✓       | ✕      | ✓      | ✓    | ✓         | ✓       | ✕      | ✓      | ✓      |
| Undo/Redo | ✓       | ✕      | ✕      | ✕    | ✕         | ✕       | ✕      | ✓      | ✕      |
| ORM       | ✓       | ✕      | ✕      | ✕    | ✕         | ✕       | ✕      | ✓      | ✕      |
| IndexedDB | ✓       | ✕      | ✓      | ✕    | ✓         | ✓       | ✓      | ✓      | ✕      |
| Node      | ✓       | ✓      | ✓      | ✓    | ✕         | ✓       | ✓      | ✓      | ✓      |
| Observables| ✓      | ✕      | ✕      | ✕    | ✕         | ✕       | ✕      | ✓      | ✕      |
| Fuzzy Search| ✓     | ✕      | ✕      | ✕    | ✕         | ✕       | ✕      | ✕      | ✕      |
| Query Functions | ✓ | ✕      | ✕      | ✕    | ✕         | ✕       | ✓      | ✕      | ✓      |
| Size (kb) | 30      | 5       | 19      | 27   | 40         | 46      | 88     | 183     | 500    |

## Database Support

NanoSQL can save data to several different places, depending on the browser or environment it's being ran in.

1. **Included In The Box**
    - Memory
    - Level DB
    - Indexed DB
    - WebSQL
    - Local Storage

2. **[SQLite (NodeJS)](https://www.npmjs.com/package/nano-sqlite)**
3. **[SQLite (Cordova)](https://www.npmjs.com/package/cordova-plugin-nano-sqlite)**
4. **[MySQL](https://www.npmjs.com/package/nano-mysql)**
5. **[React Native](https://www.npmjs.com/package/nano-react-native)**
6. **[Redis](https://www.npmjs.com/package/nano-redis)**
7. **[Google Cloud Datastore](https://www.npmjs.com/package/nano-gcloud-datastore)**
8. **[Trival DB (JSON File Store)](https://www.npmjs.com/package/nano-trivial)**

## Installation

```sh
npm i nano-sql --save
```

Using in Typescript/Babel project:

```js
import { nSQL } from "nano-sql";
```

Using in Node:

```js
const nSQL = require("nano-sql").nSQL;
```

To use directly in the browser, drop the tag below into your `<head>`.

```html
<script src="https://cdn.jsdelivr.net/npm/nano-sql@1.7.0/dist/nano-sql.min.js"></script>
```

## Simple Usage

1 minute minimal quick start:

```js
// Use an instance table to query and organize existing tables of data.
nSQL([
    {name: "bill", age: 20},
    {name: "bob", age: 25},
    {name: "jeb", age: 27}
]).query("select", ["name", "MAX(age) AS age"]).exec().then((rows) => {
    console.log(rows); // <= [{name: "jeb", age: 27}]
})


// Or declare database models and store data in nanoSQL, using it as a self contained RDBMS
nSQL('users') //  "users" is our table name.
.model([ // Declare data model
    {key:'id',type:'int',props:['pk','ai']}, // pk == primary key, ai == auto incriment
    {key:'name',type:'string'},
    {key:'age', type:'int'}
])
.connect() // Init the data store for usage. (only need to do this once)
.then(function(result) {
    return nSQL().query('upsert',{ // Add a record
        name:"bill", age: 20
    }).exec();
})
.then(function(result) {
    return nSQL().query('select').exec(); // select all rows from the current active table
})
.then(function(result) {
    console.log(result) // <= [{id:1, name:"bill", age: 20}]
})

```

[Documentation](https://docs.nanosql.io/)

## Detailed Usage
First you declare your models, connect the db, then you execute queries.

### 1. Declare Model & Setup

```js
nSQL('users')// Table/Store Name, required to declare model and attach it to this store.
.model([ // Data Model, required
    {key:'id',type:'uuid',props:['pk']}, // This has the primary key value
    {key:'name',type:'string', default:"None"}, // The 'default' will cause inserts to always use "None" if no value is provided.
    {key:'age',type:'int', props: ["idx"]}, // secondary index
    {key: "eyeColor", type: "string", props:["trie"]}, // Index as trie
    {key:'balance',type:'float', default: 0},
    {key:'postIDs',type:'array'},
    {key:'meta',type:'map'}
])
.config({
    mode: "PERM", // With this enabled, the best storage engine will be auttomatically selected and all changes saved to it.  Works in browser AND nodeJS automatically.
    history: true // allow the database to undo/redo changes on the fly. 
}) 
.actions([ // Optional
    {
        name:'add_new_user',
        args:['user:map'],
        call:function(args, db) {
            return db.query('upsert',args.user).exec();
        }
    }
])
.views([ // Optional
    {
        name: 'get_user_by_name',
        args: ['name:string'],
        call: function(args, db) {
            return db.query('select').where(['name','=',args.name]).exec();
        }
    },
    {
        name: 'list_all_users',
        args: ['page:int'],
        call: function(args, db) {
            return db.query('select',['id','name']).exec();
        }
    }                       
])

```

### 2. Connect the DB and execute queries

```js
// Initializes the db.
nSQL().connect().then(function(result) {
    // DB ready to use.
    nSQL().doAction('add_new_user',{user:{
        id:null,
        name:'jim',
        age:30,
        balance:25.02,
        postIDs:[0,20,5],
        meta:{
            favorteColor:'blue'
        }
    }}).then(function(result) {
        console.log(result) //  <- "1 Row(s) upserted"
        return nSQL().getView('list_all_users');
    }).then(function(result) {
        console.log(result) //  <- single object array containing the row we inserted.
    });
});

```

[Documentation](https://docs.nanosql.io/)

Some examples of queries you can do.

```js
// Listen for changes on the users table
nSQL("users").on("change", function(dbEvent) { ... });

// Listen for changes on any table
nSQL("*").on("change", function(dbEvent) { ... });

// Get all rows, only provide the "name" column.
nSQL("users").query("select",["name"]).exec().then(function(rows) {...});

// find all users who's name begins with "fr".
// must have props: ["trie"] on the name column in the data model.
nSQL("users").query("select").trieSearch("name","fr").exec()...

// Select all users with the name "John".
nSQL("users").query("select").where(["name","=","John"]).exec().then(function(rows) {...});

// Use a function for WHERE
nSQL("users").query("select").where(row => row.age > 20).exec().exec().then(function(rows) {...});

// Get rows based on the internal property of an object in the row
nSQL("users").query("select").where(["meta[eyeColor]", "=", "blue"]).exec().then(function(rows) {...});

// Get all users with moe than 4 posts.
nSQL("users").query("select").where(["posts.length", ">", 4]).exec().then(function(rows) {...});

// Compound where statements, supports AND & OR
nSQL("users").query("select").where([["name","=","John"],"AND",["age",">",25]]).exec().then(function(rows) {...});

// Order results by name ascending, then age descending.
nSQL("users").query("select").orderBy({name:"asc",age:"desc"}).exec().then(function(rows) {...});

// Limit and offset are easy to use as well
nSQL("users").query("select").limit(10).offset(100).exec().then(function(rows) {...});

// AS and aggregate functions also work.
nSQL("users").query("select",["COUNT(*) AS totalUsers"]).exec().then(function(rows) {...});

// Mix and match as you like
nSQL("users")
.query("select",["id", "name AS username", "age"])
.where([["name","=","John"],"AND",["age",">",25]]) // Where statements can't use AS aliases
.orderBy({username:"desc",age:"asc"}) // But order by does!
.exec().then(function(rows) {})

```

And here are some more advanced query examples.

```js

// Relatively simple join
nSQL("users")
.query("select",["orders.id", "users.name","orders.total"])
.where(["users.balance",">",500])
.join({
    type:"left", // Supported join types are left, inner, right, cross and outer.
    table: "orders",
    where: ["orders.userID", "=", "users.id"] // any valid WHERE statement works here
}).exec().then(function(rows) {...})

// Group By also works
nSQL("users")
.query("select",["favoriteColor", "eyeColor", "COUNT(*) AS users"])
.groupBy({favoriteColor:"asc", eyeColor:"desc"}) // Multiple group bys aren't a problem!
.having(["users" ,">", 2]) // Having uses the same syntax as WHERE, but runs after the GROUP BY command.
.orderBy({users:"desc"})
.exec().then(function(rows) {...})

// Look mah, I used every feature!
nSQL("users")
.query("select",["orders.userID AS ID", "users.name AS Customer", "COUNT(*) AS Orders", "SUM(orders.total) AS Total"])
.join({
    type:"left", 
    table: "orders",
    where: ["orders.userID","=","users.id"] 
})
.where([["users.balance", ">", 100], "OR",["users.age", ">", 45]])
.groupBy({"orders.userID":"asc"})
.having(["Total", ">", 100])
.orderBy({Total:"desc"})
.limit(20)
.exec().then(function(rows) {...})

```

## History

The Undo/Redo system is super easy to use.  First, enable it in the config object.

```js
nSQL("table")
.model([...])
.config({
    history: true
})
.connect().then....
```

Then use it!  Every query that changes row data will be tracked as a history point.

```js
// Roll the database back one query.
nSQL().extend("hist", "<");

// Roll it forward one query.
nSQL().extend("hist", ">");

// Delete all history points
nSQL().extend("hist", "clear")

// Get the status of the history system
nSQL().extend("hist", "?").then(function(status) {
    console.log(status) // <= [0,0];
    // The array from the ? query gives you the length of the history in the first value and the current history reference point in the last.
    // If the length and point are zero, undo & redo will do nothing.
    // If the length and point are equal, redo does nothing.
    // if the point is zero, undo will do nothing.
});

``` 

Writes are quite a bit slower when the history system is used, and your database takes up more space.  You can disable the history system from being activated by not calling `history` in the config object.

# Help

## [Documentation](https://docs.nanosql.io/)
## [Github Issues](https://github.com/ClickSimply/Nano-SQL/issues)

# Contributing

nanoSQL is an **OPEN Open Source Project**. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

Read more details [here](http://openopensource.org/).

# MIT License

Copyright (c) 2017 Scott Lott

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.