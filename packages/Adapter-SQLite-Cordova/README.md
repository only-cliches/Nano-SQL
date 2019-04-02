<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-sqlite-cordova">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-sqlite-cordova.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 SQLite Cordova Adapter</h1>
<p align="center">
  <strong>Allows you to run SQLite in Cordova with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/adapters/sqlite-cordova.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

This adapter for nanoSQL 2 uses IndexedDB/WebSQL in the browser, then switches over to a full SQLite database on the device with exactly the same API and features. Test and develop your app in the browser, then get a full real database on the device with zero effort.

# Installation

```sh
cordova plugin add @nano-sql/adapter-sqlite-cordova
```

# Usage 

## Module Loader
```ts
import { getMode } from "@nano-sql/adapter-sqlite-cordova";
import { nSQL } from "@nano-sql/core";

nSQL().on("ready", () => {
    // Database is now ready to query against.

    // ReactDOM.render()...
    // VueApp.$mount()...
    // platformBrowserDynamic().bootstrapModule(AppModule);
});

document.addEventListener(typeof cordova !== "undefined" ? "deviceready" : "DOMContentLoaded", () => {
    nSQL().connect({
        id: "my_db",
        mode: getMode(),
        tables: [...]
    })
});
```

## Embedded
If you're not using a module loader you can only test your app in the browser with `cordova run browser`.
```ts

nSQL().on("ready", () => {
    // Database is now ready to query against.

    // ReactDOM.render()...
    // VueApp.$mount()...
    // platformBrowserDynamic().bootstrapModule(AppModule);
});

document.addEventListener("deviceready", () => {
    nSQL().connect({
        id: "my_db",
        mode: window.nSQLadapter.getMode(),
        tables: [...]
    });
});
```

## Database ID

SQLite will use the id in the nanoSQL connect object as the database filename, you can run multiple databases at the same time provided you use a different id for each one.

# MIT License

Copyright (c) 2019 Scott Lott

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

# Changelog

## [2.1.2]
- Upgraded @nano-sql/core dependency to newest version.
- Documentation updates.

## [2.0.9]
- Upgraded @nano-sql/core dependency to newest version.

## [2.0.8]
- Upgraded @nano-sql/core dependency to newest version.

## [2.0.7]
- Disabled cache for better memory performance.

## [2.0.6]
- Adjusted readme and plugin index file.

## [2.0.5]
- Readme adjustment
- Dependency update

## [2.0.4]
- Readme adjustment

## [2.0.3]
- Fixed module loader clobbers.

## [2.0.2]
- Adjusted plugin.xml and package.json.
- Added plugin js file.

## [2.0.1]
- Adjusted readme.
- Adjusted package.json and plugin.xml for cordova release bug.

## [2.0.0]
- First release