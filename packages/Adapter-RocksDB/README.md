<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/master/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/master/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-rocksdb">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-rocksdb.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 RocksDB Adapter</h1>
<p align="center">
  <strong>Allows you to run RocksDB in NodeJS with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/adapters/rocksdb.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

# Installation

```sh
npm i @nano-sql/adapter-rocksdb --save
```

# Usage

```ts
import { RocksDB } from "@nano-sql/adapter-rocksdb";
import { nSQL } from "@nano-sql/core";

nSQL().createDatabase({
    id: "my_db",
    mode: new RocksDB(),
    tables: [...]
}).then(...)
```

# API

The `RocksDB` class accepts two optional constructor arguments.

## path:string (optional)
Can be `undefined` to use default (`__dirname`), allows you to specify which folder to place the database folders into.

## useIndex:boolean (optional)
Store the database index in webassembly memory. You get these tradeoffs:
- Dramatically improved offset/limit queries. (pagination)
- Dramatically improved index/count reads.
- Slightly reduces insert/delete performance.
- All keys across all tables must occupy less than ~4GB of space.

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

## [2.0.6]
- Moved new Wasm index file into correct place.

## [2.0.4]
- Fixed drop issue with wasm index.
- Fixed read/write issues with wasm index.

## [2.0.1]
- Fixed a few issues with the wasm index.
- Added info to readme.

## [2.0.0]
- First release