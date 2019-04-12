<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-dynamo">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-dynamo.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 SQLite Query Plugin</h1>
<p align="center">
  <strong>Allows you to use SQLite style queries with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/adapters/dynamodb.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

The SQL AST generator is courtesy of [alasql](https://github.com/agershun/alasql).

# Installation

```sh
npm i @nano-sql/query-sqlite --save
```

# Usage
```ts
import { nanoSQL } from "@nano-sql/core";
import { nSQLite } from "@nano-sql/query-sqlite";

const sqlite = new nSQLite(new nanoSQL());
// sqlite.nSQL => same as normal nSQL usage.
// sqlite.query => use SQLite syntax on nSQL database.

sqlite.nSQL().connect({
    id: "my-db",
    mode: "PERM"
}).then(() => {
    return sqlite.query(`CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name TEXT,
        pass TEXT,
        email TEXT
    )`, []).exec();
}).then(() => {
    return sqlite.query(
        `INSERT INTO users (name, pass, email) VALUES (?, ?, ?)`, 
        ["bill", "123", "bill@gmail.com"]
    ).exec();
}).then(() => {
    return sqlite.query(`SELECT * FROM users;`).exec();
}).then((rows) => {
    console.log(rows);
    /*
    [
        {id: 1, name: "bill", pass: "123", email: "bill@gmail.com"}
    ]
    */
})

```


# API




# Limitations
- You can't do multiple SQL statements in one query, only one statement per query.
- `CREATE TABLE` does the same as `CREATE TABLE IF NOT EXISTS`.
- `INSERT` and `UPDATE` both act as upsert queries.


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


## [2.0.0]
- First release