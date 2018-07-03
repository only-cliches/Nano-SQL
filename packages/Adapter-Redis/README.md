# Nano-Redis
Redis Adapter for nanoSQL https://nanosql.io


<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">

[![NPM](https://nodei.co/npm/nano-sqlite.png?downloads=true&stars=true)](https://nodei.co/npm/nano-redis/)

This is the fasest and easiest way to get Redis in your NodeJS app.

## [Adapter Docs](https://docs.nanosql.io/adapters/redis)
## [nanoSQL Docs](https://docs.nanosql.io/)

## Highlighted Features
- Supports all common RDBMS queries (joins, groupBy, etc).
- Import and Export CSV/JSON.
- **Simple & elegant undo/redo.**
- Full Typescript support.
- **Runtime type casting.**
- **Complete ORM support.**
- Fast secondary indexes.
- Full events system.

## Installation
```sh
npm i --save nano-redis
```

## Usage
```ts
import { nSQL } from "nano-sql";
import { RedisAdapter } from "nano-redis";
// OR //
const nSQL = require("nano-sql").nSQL;
const RedisAdapter = require("nano-redis").RedisAdapter;


nSQL("users") // table name
.model([ // data model
    {key: "id", type: "uuid", props: ["pk"]}, // primary key
    {key: "name", type: "string"},
    {key: "age", type: "int", props: ["idx"]} // secondary index
])
.config({
    mode: new RedisAdapter({ // required
        // identical to config object for https://www.npmjs.com/package/redis
        host: "127.0.0.1",
        password: "1234"
    })
}).connect().then(() => {
    // add record
    return nSQL("users").query("upsert", {name: "Jeb", age: 30}).exec();
}).then(() => {
    // get all records
    return nSLQ("users").query("select").exec();
}).then((rows) => {
    console.log(rows) // [{id: "1df52039af3d-a5c0-4ca9-89b7-0e89aad5a61e", name: "Jeb", age: 30}]
})
```

That's it, now everything nanoSQL can do you can do with Redis.

Read about nanoSQL [here](https://nanosql.io/).

## API
The `RedisAdapter` method accepts a single agument, an object that's documented [here](https://www.npmjs.com/package/redis).


## [Adapter Docs](https://docs.nanosql.io/adapters/g-cloud-datastore)
## [nanoSQL Docs](https://docs.nanosql.io/)

## MIT License

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