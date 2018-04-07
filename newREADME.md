NoSQL Everywhere

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">


[![npm](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/nano-sql/blob/master/LICENSE)
![TSlint](https://img.shields.io/badge/tslint-passing-green.svg?style=flat-square)
[![npm downloads](https://img.shields.io/npm/dm/nano-sql.svg?style=flat-square)](https://www.npmjs.com/package/nano-sql)

[![NPM](https://nodei.co/npm/nano-sql.png?downloads=true&stars=true)](https://nodei.co/npm/nano-sql/)

## NanoSQL is a database abstraction layer that: 
1. Makes running noSQL a breeze anywhere (NodeJS / Browser / Cordova).
2. Lets you scale faster by moving query logic to your application server.
3. Supports many advanced features like ORM, Map/Reduce, Indexing and Fuzzy Search.

### Identical API Everywhere
Develop your application with a simple database like LevelDB, then deploy into production with Redis, Google Cloud Datastore, MySQL or many others.  NanoSQL even runs in the browser on top of IndexedDB, WebSQL or LocalStorage.  All data is portable and all features are isomorphic; jumping between different databases and environments is trivial.

### Automate NoSQL Housekeeping
NanoSQL includes a full ORM system, secondary indexes, events, Map/Reduce, fuzzy document search and denormalization helpers to make high performance data modeling simple and easy.

### Not Only NoSQL 
Classical RDBMS queries like aggregate functions, joins and group bys are also supported.

### Flexible Data Models
The best of both worlds: Use RDBMS style data models to tune performance but still allow arbtrary columns.  Change your data model as often as you want and forced type casting where you need it.

### Other Cool Things
Built in undo/redo, automatic live backups, typescript support, full event system, CSV/JSON import & export, and runs in every browser back to IE9

## Live Examples: [Express](https://docs.nanosql.io/examples/express) - [React](https://docs.nanosql.io/examples/react) - [Angular](https://docs.nanosql.io/examples/angular) - [Vue](https://docs.nanosql.io/examples/vue) - [Cordova](https://docs.nanosql.io/examples/cordova)

## Database Support

NanoSQL can save data to several different places, depending on the browser or environment it's being ran in.

1. **Included In The Box**
    - Memory
    - Level DB
    - Indexed DB
    - WebSQL
    - Local Storage

2. **[SQLite (NodeJS)](https://github.com/ClickSimply/Nano-SQLite3)**
3. **[SQLite (Cordova)](https://github.com/ClickSimply/cordova-Nano-SQLite)**
4. **[Redis](https://github.com/ClickSimply/Nano-Redis)**
5. **[Google Cloud Datastore](https://github.com/ClickSimply/Nano-GoogleCloudstore)**

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
<script src="https://cdn.jsdelivr.net/npm/nano-sql@1.4.1/dist/nano-sql.min.js"></script>
```

## Simple Usage

1 minute quick start:

```js
// Use an instance table to query and organize existing tables of data.
nSQL([
    {name: "bill", age: 20},
    {name: "bob", age: 25},
    {name: "jeb", age: 27}
]).query("select", ["name", "MAX(age) AS age"]).exec().then((rows) => {
    console.log(rows); // <= [{name: "jeb", age: 27}]
})


// Or declare database models and store data in nanoSQL, using it as a full database
nSQL('users') //  "users" is our table name.
.model([ // Declare data model
    {key:'id', type:'uuid', props:['pk']}, // pk == primary key,
    {key:'name',type:'string'}, // name column, string
    {key:'age', type:'int'}, // age column, integer
    {key: "*", type: "*"} // allow any other columns of any type
])
.connect() // Init the data store for usage. (only need to do this once)
.then((result) => {
    return nSQL("users").query('upsert', { // Add a record
        name:"bill", 
        age: 20, 
        somethingElse: "yo"
    }).exec();
})
.then((result) => {
    return nSQL("users").query("select").exec(); // select all rows from the current active table
})
.then((result) => {
    console.log(result) // <= [{id:"93716b41-7e71-4c55-bf5e-bd1cf09416c9", name:"bill", age: 20, somethingElse: "yo"}]
})

```

## Advanced Document Search
Have lots of data that needs searching?  Many concepts have been taken from Apache Solr/ElasticSearch, streamlined and implimented in nanoSQL.  Just let nanoSQL know what columns need to be indexed and it takes everything from there.

## ORM (Object Relation Mapping)
Just because we're running no-SQL doesn't mean we can't have relationships.

## Denormalization & Map/Reduce
Get the performancea advantages of no-SQL without the housework.  Just let nanoSQL know when and where you want your data and it takes care of the rest.

## Import / Export
It's easy to move CSV and JSON data into and out of nanoSQL.

## History (Undo / Redo)
NanoSQL can keep track of changes to your data so you can scrub back and forth through time.

## Live Write Backups
NanoSQL can optionally write to any number of databases at the same time.  This allows you to have always accurate, in place backups of your data.

## Events
Want to know when something is happening?  Just ask!


[Documentation](https://docs.nanosql.io/)

# Help

## [Documentation](https://docs.nanosql.io/)
## [Github Issues](https://github.com/ClickSimply/Nano-SQL/issues)

# Contributing

nanoSQL is an **OPEN Open Source Project**. This means that:

> Individuals making significant and valuable contributions are given commit-access to the project to contribute as they see fit. This project is more like an open wiki than a standard guarded open source project.

Read more details [here](http://openopensource.org/).

# MIT License

Copyright (c) 2018 Scott Lott

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