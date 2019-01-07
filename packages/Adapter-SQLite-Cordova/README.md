# cordova-Nano-SQLite

The most powerful little database, now in your mobile device!

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">

What if your app's data store and permenent storage where one and the same?  NanoSQL is the quickest way to get SQL power into your app. You get tons of RDBMS perks like joins, groupby, functions and orderby with strong runtime type casting, events, and caching.  

This is a special plugin written for NanoSQL that uses IndexedDB/WebSQL in the browser for testing, then switches over to a full SQLite database on the device *with exactly the same API!*  Test all day long in the browser, then get a full real database on the device with **zero** effort.

- [nanoSQL Documentation](https://docs.nanosql.io/)
- [Plugin Documentation](https://docs.nanosql.io/adapters/sqlite-cordova/)

## Highlighted Features
- Works on device and in the browser with same API.
- Supports all common RDBMS queries.
- Import and Export CSV/JSON.
- **Simple & elegant undo/redo.**
- Full Typescript support.
- **Runtime type casting.**
- **Complete ORM support.**
- Fast secondary indexes.
- Full events system.


## Installation

```sh
cordova plugin add cordova-plugin-nano-sqlite --save
npm i cordova-plugin-nano-sqlite --save
```

## Usage

Works with Babel, ES5 and Typescript projects out of the box.

### Standard Usage
1. Include nanoSQL in your head:

```html
 <script src="https://cdn.jsdelivr.net/npm/nano-sql@1.6.3/dist/nano-sql.min.js"></script> 
```

2. Follow the guide below:

```js
nSQL().onConnected(() => {

    // Database is no ready to query against.

    // ReactDOM.render()...
    // VueApp.$mount()...
    // platformBrowserDynamic().bootstrapModule(AppModule);

    nSQL("users").query('upsert', { // Add a record
        name: "bill",
        age: 20
    }).exec().then((result) => {
        return nSQL().query('select').exec(); // select all rows from the current active table
    }).then((result) => {
        console.log(result) // <= [{id:1, name:"bill", age: 20}]
    })
});

document.addEventListener(typeof cordova !== "undefined" ? "deviceready" : "DOMContentLoaded", () => {
    nSQL("users")
    .model([
        { key: 'id', type: 'int', props: ['pk', 'ai'] },
        { key: 'name', type: 'string' },
        { key: 'age', type: 'int' }
    ])
    .config({
        mode: window.nSQLite.getMode() // required
    }).connect()
});
```



### Using With A Module Bundler (Webpack/Babel/Typescript):

```js
import { getMode } from "cordova-plugin-nano-sqlite/lib/sqlite-adapter";
import { nSQL } from "nano-sql";

nSQL().onConnected(() => {

    // Database is no ready to query against.

    // ReactDOM.render()...
    // VueApp.$mount()...
    // platformBrowserDynamic().bootstrapModule(AppModule);

    nSQL("users").query('upsert', { // Add a record
        name: "bill",
        age: 20
    }).exec().then((result) => {
        return nSQL().query('select').exec(); // select all rows from the current active table
    }).then((result) => {
        console.log(result) // <= [{id:1, name:"bill", age: 20}]
    })
});

document.addEventListener(typeof cordova !== "undefined" ? "deviceready" : "DOMContentLoaded", () => {
    nSQL("users")
    .model([
        { key: 'id', type: 'int', props: ['pk', 'ai'] },
        { key: 'name', type: 'string' },
        { key: 'age', type: 'int' }
    ])
    .config({
        mode: getMode() // required
    }).connect()
});
```

And that's it, you can use this just like you would use NanoSQL in the browser or anywhere else.  The API is exactly the same.


## More detailed use cases, examples and documentation: 
- [nanoSQL Documentation](https://docs.nanosql.io/)
- [Plugin Documentation](https://docs.nanosql.io/adapters/sqlite-cordova/)

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