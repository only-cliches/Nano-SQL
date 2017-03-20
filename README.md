![NanoSQL Logo](https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png)

RDBMS Immutable App Store with Undo, Redo & IndexedDB support.

[![npm](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/nano-sql/blob/master/LICENSE)
![TSlint](https://img.shields.io/badge/tslint-passing-green.svg?style=flat-square)

NanoSQL is the smallest and quickest way to get SQL power into your app, built specifically for modern frameworks like Angular2 and React. You get tons of RDBMS perks like joins, groupby, functions and orderby with strong runtime type casting, events, and IndexedDB support: all in a tiny 8Kb package.   As a bonus, you also get the performance perks of ImmutableJS in a lib half the size.

* [Todo Example](https://some-sql.com/react-todo/)
* [Draw Example](https://some-sql.com/react-draw/)

[Documentation](https://github.com/ClickSimply/Nano-SQL/wiki)

## Features

- Run in Node, IE8+ & modern browsers.
- Supports all common RDBMS queries.
- Queries return immutable rows.
- Super easy IndexedDB support.
- Import and Export CSV/JSON.
- Simple & elegant undo/redo.
- Full Typescript support.
- Runtime type casting.
- Transactions support.
- Full events system.
- Just 8Kb Gzipped.

## Drivers

[What is a driver?](https://github.com/ClickSimply/Nano-SQL/wiki#drivers)

| Type      | Description                                                              | Node | Browser |
|-----------|--------------------------------------------------------------------------|------|---------|
| Immutable | Runs anywhere, can persist to IndexedDB in the browser, used by default. | ✓    | ✓       |
| [SQLite 3](https://github.com/ClickSimply/Nano-SQL/wiki/5.-SQLite)  | Useful for nodeJS applications, supports full NanoSQL API.               | ✓    | ✕       |

### Oh Look, Another Data Store

I spent a long time looking for an existing solution that would do everything I needed and couldn't find one, here's some of the other data stores I looked into and why I didn't end up using them:

| Database                                                 | Events | TS  | Undo  | Immutable | RDBMS | IndexedDB | NodeJS | Any Backend | Size |
|----------------------------------------------------------|:------:|:---:|:-----:|:---------:|:-----:|:---------:|:--------:|:--------------:|:----------:|
| NanoSQL                                                  | ✓      | ✓   | ✓    | ✓         | ✓     | ✓         | ✓       | ✓             | 8         |
| [Redux](https://github.com/reactjs/redux)                | ✓      | ✓   | ✕    | ✕         | ✕     | ✕         | ✓      | ✕              | 2         |
| [TaffyDB](https://github.com/typicaljoe/taffydb)         | ✓      | ✕   | ✕    | ✕         | ✓     | ✕         | ✓      | ✕              | 5        |
| [ImmutableJS](https://github.com/facebook/immutable-js/) | ✕      | ✓   | ✕    | ✓         | ✕     | ✕         | ✓      | ✕              | 16        |
| [LokiJS](https://github.com/techfort/LokiJS)             | ✓      | ✓   | ✕    | ✕         | ✓     | ✓         | ✓      | ✓              | 19        |
| [Lovefield](https://github.com/google/lovefield)         | ✓      | ✓   | ✕    | ✕         | ✓     | ✓         | ✕      | ✕              | 40        |
| [AlaSQL](https://github.com/agershun/alasql)             | ✕      | ✕   | ✕    | ✕         | ✓     | ✓         | ✓      | ✓              | 88        |
| [SQL.js](https://github.com/kripken/sql.js/)             | ✕      | ✓   | ✕    | ✕         | ✓     | ✕         | ✓      | ✕              | 500       |

I needed something small, efficient, strongly typed at runtime, optionally persistent, made working with immutable data automagical, could even be extended to use MySQL, SQLite and Cassandra in the future, and it needs to work with TypeScript.  NanoSQL is that.  

## Installation

`npm i nano-sql --save`

Using in typescript project:

```js
import { nSQL } from "nano-sql";
```

Using in node:

```js
var nSQL = require("nano-sql").nSQL;

```

To use directly in the browser, just include the script file found inside the `dist` folder onto your page.

## Simple Usage

1 minute minimal quick start:

```js
nSQL('users') //  "users" is our table name.
.model([ // Declare data model
    {key:'id',type:'int',props:['pk','ai']}, // pk == primary key, ai == auto incriment
    {key:'name',type:'string'}
])
.connect() // Init the data store for usage.
.then(function(result, db) {
    // "db" holds the current NanoSQL var with the previous table still selected.
    return db.query('upsert',{ // Add a record
        name:"Billy",
    }).exec();
})
.then(function(result, db) {
    return db.query('select').exec(); // select all rows from the current active table
})
.then(function(result, db) {
    console.log(result) // <= [{id:1,name:"Billy"}]
})

```

[Documentation](https://github.com/ClickSimply/Nano-SQL/wiki)

## Detailed Usage
First you declare your models, connect the db, then you execute queries.

### 1. Declare Model & Setup

```js
nSQL('users')// Table/Store Name, required to declare model and attach it to this store.
.model([ // Data Model, required
    {key:'id',type:'uuid',props:['pk']}, // This has the primary key value
    {key:'name',type:'string', default:"None"}, // This will cause inserts to always use "None" if no value is provided.
    {key:'age',type:'int'},
    {key:'balance',type:'float', default: 0},
    {key:'postIDs',type:'array'},
    {key:'meta',type:'map'}
])
.config({persistent:true}) // The long and difficult process of enabling indexed DB support, optional.
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
nSQL().connect().then(function(result, db) {
    // DB ready to use.
    db.doAction('add_new_user',{user:{
        id:null,
        name:'jim',
        age:30,
        balance:25.02,
        postIDs:[0,20,5],
        meta:{
            favorteColor:'blue'
        }
    }}).then(function(result, db) {
        console.log(result) //  <- "1 Row(s) upserted"
        return db.getView('list_all_users');
    }).then(function(result, db) {
        console.log(result) //  <- single object array containing the row we inserted.
    });
});

```

[Documentation](https://github.com/ClickSimply/Nano-SQL/wiki)

Some examples of queries you can do.

```js
// Roll the entire database back one delete/drop/upsert query
nSQL().extend("<") 
// Yep, that's it.

// Listen for changes on the users table
nSQL("users").on("change", function(dbEvent) { ... });

// Listen for changes on any table
nSQL("*").on("change", function(dbEvent) { ... });

// Get all rows, only provide the "name" column.
nSQL("users").query("select",["name"]).exec().then(function(rows, db) {...});

// Select all users with the name "John".
nSQL("users").query("select").where(["name","=","John"]).exec().then(function(rows, db) {...});

// Compound where statements, supports AND & OR
nSQL("users").query("select").where([["name","=","John"],"AND",["age",">",25]]).exec().then(function(rows, db) {...});

// Order results by name ascending, then age descending.
nSQL("users").query("select").orderBy({name:"asc",age:"desc"}).exec().then(function(rows, db) {...});

// Limit and offset are easy to use as well
nSQL("users").query("select").limit(10).offset(100).exec().then(function(rows, db) {...});

// AS and aggregate functions also work.
nSQL("users").query("select",["COUNT(*) AS totalUsers"]).exec().then(function(rows, db) {...});

// Mix and match as you like
nSQL("users")
.query("select",["id", "name AS username", "age"])
.where([["name","=","John"],"AND",["age",">",25]]) // Where statements can't use AS aliases
.orderBy({username:"desc",age:"asc"}) // But order by does!
.exec().then(function(rows, db) {})

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
    where: ["orders.userID","=","users.id"] // Compound WHERE statements with AND/OR don't work, just single ones do.
}).exec().then(function(rows, db) {...})

// Group By also works
nSQL("users")
.query("select",["favoriteColor", "eyeColor", "COUNT(*) AS users"])
.groupBy({favoriteColor:"asc", eyeColor:"desc"}) // Multiple group bys aren't a problem!
.having(["users" ,">", 2]) // Having uses the same syntax as WHERE, but runs after the GROUP BY command.
.orderBy({users:"desc"})
.exec().then(function(rows, db) {...})

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
.exec().then(function(rows, db) {...})

```

[Documentation](https://github.com/ClickSimply/Nano-SQL/wiki)