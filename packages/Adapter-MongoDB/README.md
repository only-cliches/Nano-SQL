<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-mongo">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-mongo.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 MongoDB Adapter</h1>
<p align="center">
  <strong>Allows you to run MongoDB with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.gitbook.io/docs/adapters/mongodb) | [Help](https://github.com/ClickSimply/Nano-SQL/issues)

# Installation

```sh
npm i @nano-sql/adapter-mongo --save
```

# Usage

```ts
import { MongoDB } from "@nano-sql/adapter-mongo";
import { nSQL } from "@nano-sql/core";

nSQL().connect({
    id: "my_db",
    mode: new MongoDB("mongodb://localhost:27017"),
    tables: [...]
}).then(...)
```

# API

The `MongoDB` class accepts two argument in its constructor.

### MongoDB URL (required)
The first argument is the mongoDB url you intend to connect to.

### MongoDB Client Options (optional)
The second argument is an object that is passed directly into the backend mongodb library to adjust the connect preferences. The options are described below:

```ts
interface MongoClientCommonOption {
    /** Do not make the db an event listener to the original connection. */
    noListener?: boolean;
    /** Control if you want to return a cached instance or have a new one created */
    returnNonCachedInstance?: boolean;
}
```

# Limitations
While auto increment primary keys will *technically* work (on a small scale), you shouldn't use them.  Your primary keys should be `uuid` or something else non sequential.

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

