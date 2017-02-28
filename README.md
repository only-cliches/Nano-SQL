# SomeSQL
Small Immutable App Store with Undo, Redo & IndexedDB support.

[![npm](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/Some-SQL/blob/master/LICENSE)
![TSlint](https://img.shields.io/badge/tslint-passing-green.svg?style=flat-square)

## Browsers support <sub><sup><sub><sub>made by <a href="https://godban.github.io">godban</a></sub></sub></sup></sub>

| [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/edge.png" alt="IE / Edge" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>IE / Edge | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/firefox.png" alt="Firefox" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>Firefox | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/chrome.png" alt="Chrome" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>Chrome | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/safari.png" alt="Safari" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>Safari | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/safari-ios.png" alt="iOS Safari" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>iOS Safari | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/opera-mini.png" alt="Opera Mini" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>Opera Mini | [<img src="https://raw.githubusercontent.com/godban/browsers-support-badges/master/src/images/chrome-android.png" alt="Chrome for Android" width="16px" height="16px" />](http://godban.github.io/browsers-support-badges/)</br>Chrome for Android |
| --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| IE9, IE10, IE11, Edge| last 2 versions| last 2 versions| last 2 versions| last 2 versions| last 2 versions| last 2 versions

I looked everywhere for a data store with these features and couldn't find it:

1. Backend agnostic & can be extended to use any possible backend (like Knex).
2. Stores data in memory and compiles to a very small size. (like TaffyDB).
3. Used the consistency and flexibility of RDBMS dbs. (like Lovefield DB).
4. Allowed you to declare actions and views in a simple way (like Redux).
5. Returned immutable data sets to improve React performance (like ImmutableJS).


SomeSQL was born to bring all this together.  It's an extensible database abstraction layer first, then includes an in memory store to make immediate use easy.

## Features
SomeSQL comes to you in two parts minified into a single file.

### General Features
* Written in TypeScript with 100% type coverage.
* Works in NodeJS and the browser.
* Uses Promises like no one's business.

### 1. Database Abstraction Layer
* Extensible API to simplify SQL like commands.
* Built to plug into any database backend.
* Flux like usage pattern with Actions and Views.
* Declarative data models.
* Optional strong typing at run time.
* Easily handles Joins, Selects, Upserts, Sorting, etc.
* Import and export CSV and JSON with any database.
* Uses the built in memory database by default.
* Listen for change or other events on any or all tables.

### 2. Built In Memory Database Driver
* Fast and efficient in memory store for your applications.
* Returns immutable sets, optimized for use with ReactJS & Angular 2.
* Query cache and shallow copying optimizations.
* Built in, super simple undo/redo.
* Optionally persist to IndexedDB.

Oh yeah, and it's all just 6 Kb gzipped. :)


## Simple Usage

1 minute minimal quick start:

```ts
SomeSQL('users') //  "users" is our table name.
.model([ // Declare data model
    {key:'id',type:'int',props:['pk','ai']},
    {key:'name',type:'string'},
    {key:'age',type:'int'}, 
])
.connect() // Init the data store for usage.
.then(function(result, db) {
    // "db" holds the current SomeSQL var with the previous table still selected.
    return db.query('upsert',{ // Add a record
        name:"Billy",
        age:50
    }).exec();
})
.then(function(result, db) {
    return db.query('select').exec(); // select all rows from the current active table
})
.then(function(result, db) {
    console.log(result) // <= [{id:1,name:"Billy",age:50}]
})

```

## Installation

`npm i some-sql --save`

Using in typescript project:

```ts
import { SomeSQL } from "some-sql";

SomeSQL("users")...
```

Using in node:

```js
var SomeSQL = require("some-sql").SomeSQL;

SomeSQL("users")...
```

To use directly in the browser, just include the script file found inside the `dist` folder onto your page.


## Detailed Usage
First you declare your models, connect the db, then you execute queries.

### 1. Declare Model & Setup

```ts
SomeSQL('users')// Table/Store Name, required to declare model and attach it to this store.
.model([ // Data Model, required
    {key:'id',type:'uuid',props:['pk']}, // This has the primary key value
    {key:'name',type:'string', default:"None"}, // This will cause inserts to always use "None" if no value is provided.
    {key:'age',type:'int'},
    {key:'balance',type:'float', default: 0},
    {key:'postIDs',type:'array'},
    {key:'meta',type:'map'}
])
.rowFilter(function(row) { // Optional, lets you control the row data going into the database.
    if(row.age > 99) row.age = 99;
    if(row.age < 12) row.age = 12;
    if(row.balance < 0) callOverDraftFunction();
    return row;
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

```ts
// Initializes the db.
SomeSQL().connect().then(function(result, db) {
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

### Arbitrary Commands

You can execute a db command at any point from the `SomeSQL` object after the DB is connected.

Every query follows the same pattern:
`SomeSQL(#TABLE_NAME#).query(#ACTION#,#ARGS#)....optional filtering, sorting, etc...exec()`

For example a query to get all rows from the users table looks like this:
`SomeSQL('users').query('select').exec()`

Here are some more examples:

```ts
// Get all records but only return the name and id columns
SomeSQL('users').query('select',['name','id']).exec(); 

// only show rows where the name == "scott"
SomeSQL('users').query('select').where(['name','=','scott']).exec() 

// Compound where statement with AND
SomeSQL('users').query('select').where([['name','=','billy'],'and',['balance','>',20]]).exec();

// Compund where statement with OR
SomeSQL('users').query('select').where([['name','=','billy'],'or',['balance','>',20]]).exec();

// Order the results by name ascending, then age descending.
SomeSQL('users').query('select').orderBy({name:'asc',age:'desc'}).exec() 

// Limit and Offset
SomeSQL('users').query('select').limit(20).offset(10).exec();

// Filters (Must be supported by the database driver or supplied by the user)
SomeSQL('users').query('select',['age']).filter('average').exec();

// The Memory DB supports sum, min, max, average, and count

// combine any patterns as you'd like.
SomeSQL('users').query('select',['name']).where(['age','>',20]).orderBy({age:'desc'}).exec() 

// Where statements work on upserts as well.
SomeSQL('users').query('upsert',{name:"Account Closed"}).where(['balance','<',0]).exec() 

// Simple join
SomeSQL("users").query("select",["users.name","orders.title"]).where(["users.name","=","Jimmy"]).join({
    type:'inner',
    table:"orders",
    where:['orders.customerID',"=",'user.id']
}).orderBy({"users.name":"asc"}).exec();

```

Possible query commands are `select`, `drop`, `upsert`, and `delete`.

All calls to the `exec()` return a promise, with the first argument of the promise being the response from the database.

The second argument is always the SomeSQL var, making chaining commands easy...

```ts
SomeSQL('users').query('select').exec().then(function(result, db) {
    return db.query('upsert',{name:"Bill"}).where(['name','=','billy']).exec();
}).then(function(result, db) {
    return db.query('drop').exec();
})

```


### Events

You can listen to any number of database events on any table or all tables.

```ts
SomeSQL("users").on('select',function(eventData) {}) // Listen to "select" commands from the users table
SomeSQL("*").on('change',function(eventData) {}) // Listen for any changes to any table in the database.

```

Possible events are `change`, `delete`, `upsert`, `drop`, `select` and `error`.


### Multiple Tables

You can create a new table by selecting it and creating a new data model:

```ts
SomeSQL('newTable').model([
    {key:'name',type:'string'}
])

```

Keep in mind you MUST declare all your models and tables BEFORE calling the `connect()` command.

### Multiple Data Stores

If you need more than one data store with a collection of separate tables, you can declare a completely new SomeSQL db at any point.

```ts
var myDB = new SomeSQL_Instance().table;

// And now use it just like you use the SomeSQL var.
myDB('users').query("select").exec()...

```

Keep in mind that the tables and models are completely separate for each instance; there is no shared data, events or anything else.

# API Index

Possible commands are split into three groups, one group is used before you connect to the database.  
The other group is used after you connect to the database, and it's used to query the database data.

All commands can be chained or return a promise unless otherwise noted.

## Group 1: Setup Mode

| Command         | Definition                                                                  |          |
|-----------------|-----------------------------------------------------------------------------|----------|
| .model()        | Declare database model, required.                                           | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#model) |
| .views()        | Declare views to use.                                                       | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#views) |
| .actions()      | Declare actions to use.                                                     | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#actions) |
| .config()       | Pass custom configuration options to the database driver.                   | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#config) |
| .addFilter()    | Add a filter that can be used on queries.                                   | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#addfilter) |
| .rowFilter()    | Add a filter function to be applied to every row being inserted.            | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#rowFilter) |
| .connect()      | Complete setup mode and optionally connect to a specific backend, required. | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#connect) |

## Group 2: Query Mode 

Every database query looks like this:
`SomeSQL(#Table Name#).query(#Query Type#, #Query Args#)...Optional Query Modifiers...exec()`

This gives each query three distinct sections, the query init section, the query modifier section, and the execute section.

### Query Init

There is only one possible function to start a query, and it has several different possible arguments.  Check out the examples to see those.

| Command    | Definition                                                   |          |
|------------|--------------------------------------------------------------|----------|
| .query()   | Starts a database query.                                     | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#query) |

### Query Modifiers

Each modifier can take up to two arguments and normally can only be used once.  Check each example for usage.

| Command    | Definition                                                   |          |
|------------|--------------------------------------------------------------|----------|
| .where()   | Adds a search component to the current query.                | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#where) |
| .orderBy() | Adds a order by component to the current query.              | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#orderby) |
| .join()    | Combine multiple queries into one using a where statement.   | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#join) |
| .offset()  | Offset the current query by a given value.                   | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#offset) |
| .limit()   | Limits the current query by a given value.                   | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#limit) |
| .filter()  | Applies a custom filter to the current query.                | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#filter) |
| .extend()  | Use a extend query modifier provided by the database driver. | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#extend) |


### Query Execution

These come at the end of a query to execute it on the database.

| Command    | Definition                                                                     |          |
|------------|--------------------------------------------------------------------------------|----------|
| .exec()    | Executes a pending query and returns a promise containing an array of objects. | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#exec) |
| .toCSV()   | Executes the pending query and returns a promise containg a string CSV.        | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#tocsv) |


## Misc Commands

## Events

Events can be called before or after setup mode, at any time.

| Command      | Definition                                                                  |          |
|--------------|-----------------------------------------------------------------------------|----------|
| .on()        | Listen to specific database events with a callback function.                | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#on) |
| .off()       | Remove a listening function from being triggered by events.                 | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#off) |

### Mass Import Data

| Command    | Definition                                                             |          |
|------------|------------------------------------------------------------------------|----------|
| .loadJS()  | Loads json directly into the database.                                 | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#loadjs) |
| .loadCSV() | Loads CSV files directly into the database.                            | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#loadcsv) |


### Actions & Views

These can be used in replacement of the query..exec pattern to execute a given view or action.

| Command     | Definition                                                             |          |
|-------------|------------------------------------------------------------------------|----------|
| .getView()  | Gets a specific view, returns a promise.                               | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#getview) |
| .doAction() | Does a specific action, returns a promise.                             | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#doaction) |


[View Complete Official Docs](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html)

## Memory Database API
Documentation here is specific to the built in memory database driver.

### Memoization

SomeSQL will memoize all select queries automatically with no configuration needed.

Identical select statements will only require a single actual select on that table.  Every subsequent select query after the first will draw from the cache, pointing to the same object allowing strict comparison checking ("==="). 

Once you modify a table, all memoized selects for that table are cleared, however the rows themselves are still immutable so once the query itself is recreated unchanged rows will still pass "===" checks.

Finally, using JOIN commands will cause multiple table caches to be invalidated on single table updates so expect degraded performance with joins.

### IndexedDB

The memory database can optionally persist all of it's changes to the browser's indexed DB. Some features:
* All changes automatically update to indexedDB.
* The memory database is populated from the Indexed DB on connection, allowing you to resume the previous state with no effort.
* Undo and redo states are not saved.
* Each Indexed DB is attached to a specific data model.  If you change your data model a new, blank IndexedDB will be used.

Enableing it is easy, just call `config` before `connect` with `{persistent:true}` passed in, like this:

```ts
SomeSQL().config({persistent:true}).connect().then....

```

You can declare models, views, actions and filters before calling config, but it must be called BEFORE `connect()`.

Finally, you can clear the current indexedDB completely by calling this:

```ts
SomeSQL().extend("flush_db");
```

This will cause ALL active databases and tables to be removed from Indexed DB, but they will remain in memory until the page is refreshed.

### Undo & Redo
The driver has built in "undo" and "redo" functionality that lets you progress changes to the database forward and backward in time.  

There is no need to enable anything, the history is enabled automatically and requires no configuration.

Each Undo/Redo action represents a single Upsert, Delete, or Drop query.

The history is applied across all database tables, calling a specific table on an undo/redo command will have no affect.

Queries that did not affect any rows do not get added to the history.

Usage:
* Undo: `SomeSQL().extend("<")`
* Redo: `SomeSQL().extend(">")`

These commands will cascade `change` events to the affected tables.

Optionally, you can attach `then` to the end of either undo or redo to discover if a redo/undo action was performed.

```ts
SomeSQL().extend(">").then(function(response) {
    console.log(response) //<= If this is true, a redo action was done.  If false, nothing was done.
});
```

You can also request the state of the undo/redo system like this:

```ts
SomeSQL().extend("?").then(function(response) {
    console.log(response) // <= [0,0]
});
```

The query returns an immutable array with two numbers.  The first is the length of change history, the second is the current pointer of the change history.

This lets you determine if an undo/redo action will do anything:

1. If the history length is zero, undo and redo will both do nothing.
2. If the pointer is zero, undo will do nothing.
3. If the pointer is equal to history length redo will do nothing.

Since the history state is immutable you can perform strict "===" checks against it to see if the history state has changed.  This is useful for deciding to adjust the rendering of undo/redo buttons.

Finally, performing changes to the database anywhere in history is completely allowed and automatically handled. You can play with the Todo example to see how this works.

[View Complete Official Docs](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html)