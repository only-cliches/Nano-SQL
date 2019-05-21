<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-leveldb">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-leveldb.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 LevelDB Adapter</h1>
<p align="center">
  <strong>Allows you to run LevelDB in NodeJS with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/adapters/leveldb.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

# Installation

```sh
npm i @nano-sql/adapter-leveldb --save
```

# Usage

```ts
import { LevelDB } from "@nano-sql/adapter-leveldb";
import { nSQL } from "@nano-sql/core";

nSQL().createDatabase({
    id: "my_db",
    mode: new LevelDB(),
    tables: [...]
}).then(...)
```

# API

The `LevelDB` class accepts two optional constructor arguments.

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

## [2.0.4]
- Moved to new index code.

## [2.0.3]
- Fixed issue with WASM index.

## [2.0.1]
- Fixed an issue with a file not being copied to the lib folder.

## [2.0.0]
- First release