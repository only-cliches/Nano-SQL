<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-sqlite-nativescript">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-sqlite-nativescript.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 SQLite NativeScript Adapter</h1>
<p align="center">
  <strong>Allows you to run SQLite in NativeScript with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/adapters/sqlite-nativescript.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

Includes all typings, runs in iOS or Android

# Installation

```sh
tns plugin add @nano-sql/adapter-sqlite-nativescript
```

# Usage

```ts
import { NativeSQLite } from "@nano-sql/adapter-sqlite-nativescript";
// MUST include nSQL from the lib path.
import { nSQL } from "@nano-sql/core/lib/index";

nSQL().createDatabase({
    id: "my_db",
    mode: new NativeSQLite(),
    tables: [...]
}).then(...)
```

# API

The `NativeSQLite` class accepts one optional arguments in it's constructor.

### Filename
The first argument is the filename to the SQLite database to connect to, default is to use the database ID as the filename.

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

## [2.0.2]
- SQLite now uses database ID as name instead of ":memory:" by default.

## [2.0.1]
- Dependency & Documentation updates.

## [2.0.0]
- First release