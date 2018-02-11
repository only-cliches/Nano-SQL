NoSQL Everywhere

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">


[![npm](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/nano-sql/blob/master/LICENSE)
![TSlint](https://img.shields.io/badge/tslint-passing-green.svg?style=flat-square)
[![npm downloads](https://img.shields.io/npm/dm/nano-sql.svg?style=flat-square)](https://www.npmjs.com/package/nano-sql)

[![NPM](https://nodei.co/npm/nano-sql.png?downloads=true&stars=true)](https://nodei.co/npm/nano-sql/)

NanoSQL is a universal database abstraction layer to make running noSQL a breaze.

## Features
NanoSQL is the result of the realization that most noSQL databases share enough features that a common abstraction layer could be used without significant loss of features or performance.  Every feature in nanoSQL works with every database it supports.  At the same time if you had a client side library with identical API many performance advantages could be had with very little work.
- Imagine pulling in a result set from your server and doing sorting & searching purely client side.  
- Imagine caching database rows into a client side cache that behaves identically to your server database.
- Imagine having the power of RDBMS with the speed and scalability of noSQL.
- Imagine being able to jump between databases as your needs grow without reprogramming your whole server.

#### Identical API Everywhere
Develope your application with a simple database like LevelDB, then deploy into production with Redis, Google Cloud Datastore, MySQL or many others.  NanoSQL even runs in the browser on top of IndexedDB, WebSQL or LocalStorage.  Data is always portable, transferring between different database adapters is trivial.

#### Automate NoSQL Housekeeping
NanoSQL includes a full ORM system, secondary indexes and denormalization helpers to make high performance data modeling simple and easy.

#### Not Only NoSQL 
Classical RDBMS queries like aggregate functions, joins and group by's are also supported.

#### Flexible Data Models
The best of both worlds: Use RDBMS style data models to tune performance but still allow arbtrary columns.  Change your data model as often as you want and forced type casting where you need it.

#### Other Cool Things
Built in undo/redo, typescript support, full event system, CSV/JSON import & export, runs in every browser back to IE9+

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
<script src="https://cdn.jsdelivr.net/npm/nano-sql@1.3.2/dist/nano-sql.min.js"></script>
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


// Or declare database models and store data in nanoSQL, using it as a full database
nSQL('users') //  "users" is our table name.
.model([ // Declare data model
    {key:'id',type:'uuid',props:['pk']}, // pk == primary key,
    {key:'name',type:'string'}, // name column, string
    {key:'age', type:'int'}, // age column, integer
    {key: "*", type: "*"} // allow any other columns
])
.connect() // Init the data store for usage. (only need to do this once)
.then((result) => {
    return nSQL().query('upsert', { // Add a record
        name:"bill", 
        age: 20, 
        somethingElse: "yo"
    }).exec();
})
.then((result) => {
    return nSQL().query('select').exec(); // select all rows from the current active table
})
.then((result) => {
    console.log(result) // <= [{id:"93716b41-7e71-4c55-bf5e-bd1cf09416c9", name:"bill", age: 20, somethingElse: "yo"}]
})

```

[Documentation](https://docs.nanosql.io/)

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