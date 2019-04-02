# MySQL

[![nanoSQL Logo](https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png)](https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core)

[![nanoSQL Logo](https://badge.fury.io/js/%40nano-sql%2Fadapter-dynamo.svg) ](https://badge.fury.io/js/%40nano-sql%2Fadapter-dynamo)[![nanoSQL Logo](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE)

## nanoSQL 2 MySQL Adapter

**Allows you to run MySQL with** [**nanoSQL 2**](https://www.npmjs.com/package/@nano-sql/core)

[Documentation](https://nanosql.gitbook.io/docs/adapters/mysql) \| [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) \| [Chat](https://gitter.im/nano-sql/community)

## Installation <a id="installation"></a>

```bash
npm i @nano-sql/adapter-mysql --save
```

## Usage <a id="usage"></a>

```typescript
import { MySQL } from "@nano-sql/adapter-mysql";
import { nSQL } from "@nano-sql/core";

nSQL().connect({
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

## API <a id="api"></a>

The `MySQL` class accepts one optional argument as its constructor.

#### MySQL Connect Options <a id="mysql-connect-options"></a>

The first object is passed directly into the backend mysql library to adjust the connect preferencs. This object is fully documented [here](https://www.npmjs.com/package/mysql#connection-options).

## MIT License <a id="mit-license"></a>

Copyright \(c\) 2019 Scott Lott

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files \(the "Software"\), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
