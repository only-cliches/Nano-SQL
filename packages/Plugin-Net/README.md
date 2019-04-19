<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-mysql">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-mysql.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 MySQL Adapter</h1>
<p align="center">
  <strong>Allows you to run MySQL with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.gitbook.io/docs/adapters/mysql) | [Help](https://github.com/ClickSimply/Nano-SQL/issues)

# Installation

```sh
npm i @nano-sql/adapter-mysql --save
```

# Usage

```ts
import { MySQL } from "@nano-sql/adapter-mysql";
import { nSQL } from "@nano-sql/core";

nSQL().createDatabase({
    id: "my_db",
    mode: new MySQL({ // required
		host: "localhost",
		database: "test",
		user: "root",
		password: "secret"
    }),
    tables: [...]
}).then(...)
```

# API

The `MySQL` class accepts one optional argument as its constructor.

### MySQL Connect Options
The first object is passed directly into the backend mysql library to adjust the connect preferencs.  This object is fully documented [here](https://www.npmjs.com/package/mysql#connection-options).

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

