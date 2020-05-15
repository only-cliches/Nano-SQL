<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/master/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/master/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-pg">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-pg.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 PostgreSQL Adapter</h1>
<p align="center">
  <strong>Allows you to run PostgreSQL with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/adapters/PostgreSQL.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)


# Installation

```sh
npm i @nano-sql/adapter-PostgreSQL --save
```

# Usage

```ts
import { PostgreSQL } from "@nano-sql/adapter-pg";
import { nSQL } from "@nano-sql/core";

nSQL().createDatabase({
    id: "my_db",
    mode: new PostgreSQL({ // required
		host: "localhost",
		database: "test",
		user: "admin",
		password: "secret"
    }),
    tables: [...]
}).then(...)
```

# API

The `PostgreSQL` class accepts one optional argument as its constructor.

### PostgreSQL Connect Options
The first object is passed directly into the backend PostgreSQL library to adjust the connect preferencs.  This object is fully documented [here](https://node-postgres.com/api/pool).

# MIT License

Copyright (c) 2020 Klemens D. Morgenstern

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
- Initial Version
