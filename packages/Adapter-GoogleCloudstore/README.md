# Nano-GoogleCloudstore
Google Cloud Store Adapter for [nanoSQL](https://nanosql.io/)

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">

[![NPM](https://nodei.co/npm/nano-sqlite.png?downloads=true&stars=true)](https://nodei.co/npm/nano-gcloud-datastore/)

This is the fasest and easiest way to get Google Cloud Datastore in your NodeJS app.

## [Adapter Docs](https://docs.nanosql.io/adapters/g-cloud-datastore)
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
npm i --save nano-gcloud-datastore
```

## Usage
```ts
import { nSQL } from "nano-sql";
import { GDatastoreAdapter } from "nano-gcloud-datastore";
// OR //
const nSQL = require("nano-sql").nSQL;
const GDatastoreAdapter = require("nano-gcloud-datastore").GDatastoreAdapter;


nSQL("users") // table name
.model([ // data model
    {key: "id", type: "uuid", props: ["pk"]}, // primary key
    {key: "name", type: "string"},
    {key: "age", type: "int", props: ["idx"]} // secondary index
])
.config({
    id: "myDB", // will be used as namespace in Google Datastore.
    cache: false, // dont use javascript object cache
    mode: new GDatastoreAdapter({ // required
        projectId: "my-project",
        keyFilename: "myAuth.json"
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

That's it, now everything nanoSQL can do you can do with Google Cloud Datastore.

Read about nanoSQL [here](https://nanosql.io/).

## API
The `new GDatastoreAdapter` method accepts a single agument, an object that's documented by Google [here](https://cloud.google.com/nodejs/docs/reference/datastore/1.3.x/Datastore).

There's a large number of options here but the 90/10 properties are below:

- **projectId**: The google project Id you'll be using.
- **keyFilename**: If you plan to use this outside of Google's AppEngine service you'll have to [get a JSON file](https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually) that grants you access to the data store outside Google services.  Once you get the JSON file and place it in your project you'll pass it's name and path here.
- **distributedMode**: Pass in `true` to disable auto incriment primary keys, `trie` props and local indexes.  If you plan to access the datastore from multiple nodeJS instances turn this on.  **IMPORTANT** If you pass `true` into this property also make sure you have `cache: false` passed into the main config object.  
- **strongConsistency**: Boolean, if you pass in `true` all reads will be strongly consistent at the cost of query speed.  The default (eventual consistency) is much more performant and perfectly acceptable in most situations. 

## Limit/Offset

NanoSQL handles limit/offset queries much better than Google Datastore's default behavior.

If you query using `offset` from Google Datastore you get a [performance penalty equal to the offset length](https://cloud.google.com/datastore/docs/best-practices#queries).  For example, if you sent `.limit(20).offset(200)` directly to Google Cloud Datastore you'll pay for 220 entity reads and Datastore will actually read 220 entities, then return only 20 of them.  Using the `.range(20, 200)` query modifier with nanoSQL lets you bypass this entirely.  NanoSQL will first grab a copy of the table index (a fast 1 entity cost read) then limit/offset against the index.  Meaning no matter how large the offset gets you only query the total number in the limit argument plus 1.  This is potentially hundreds of times faster.

## Performance Tips

There's no way around the NoSQL style limitations of Datastore.  Use `.range()` or  `.where()` queries limited to using primary keys or secondary indexes combined with `BETWEEN`, `=`, or `IN`. Venture outside this safe zone and nanoSQL has to query the entire table of data to complete your request.  

Assuming we use the data model at the top under **Usage** the following queries would perform very well:
```ts
// select by primary key
nSQL("users").query("select").where(["id", "=", "1df52039af3d-a5c0-4ca9-89b7-0e89aad5a61e"]).exec()
// select by secondary index
nSQL("users").query("select").where(["age", "=", 30]).exec()
// select by secondary index range
nSQL("users").query("select").where(["age", "BETWEEN", [20, 30]]).exec()
// even combined where statements are fine as long as every column being checked is a primary key or secondary index
nSQL("users").query("select").where([["age", "=", 30], "OR", ["age", "=", 35]]).exec();
```

The queries below *will work* but require nanoSQL to grab a copy of the whole table/kind and read every row/entity to discover what matches.
```ts
// must check every name column and see if it's like john.
nSQL("users").query("select").where(["name", "LIKE", "john"]).exec();
// because the name column isn't indexed this is still very slow
nSQL("users").query("select").where(["name", "=", "john"]).exec();
// If you use a non primary key/secondary indexed column anywhere in a .where() statement it does a full table scan.
nSQL("users").query("select").where([["age", "=", 30], "OR", ["name", "=", "john"]]).exec()
``` 

The takeway here is there's no such thing as a free lunch, while you get RDBMS functions they aren't magically performant. RDBMS is still slow.

There are a few workarounds for this situation, most of them being pretty simple.  

### Setup primary keys / Secondary Indexes
When you can grab data directly by it's key or by a range of keys, this is the ideal situation.  But secondary indexes slow down your writes the more you have so you can't just secondary index every single column.

### Generate Cache Tables
Setup tables where you cache low performance queries on a regular basis, this way low performance queries can happen infrequently and in the background.

For example, lets say you want to show the total sales by day over the past week.  Make a new table called "salesByDay" with the primary key being the date, then run a daily `setInterval` that reads the most recent day's orders and crunches them into a single row in the "salesByDay" table.  Now when you need to show this data just pull it directly from "salesByDay", very performant and easy to do!

### Keep Tables Small
If you can setup your data so that each table/kind only has a few thousand records, performing the full table scan should only take a second or two to complete.


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
