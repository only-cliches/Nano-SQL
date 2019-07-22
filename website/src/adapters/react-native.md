<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/master/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/master/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-react-native">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-react-native.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 React Native Adapter</h1>
<p align="center">
  <strong>Allows you to run React Native with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/adapters/react-native.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

# Installation

```sh
npm i @nano-sql/adapter-react-native --save
```

# Usage

```ts
import { NativeStorage } from "@nano-sql/adapter-react-native";
import { nSQL } from "@nano-sql/core";

nSQL().createDatabase({
    id: "my_db",
    mode: new NativeStorage(true), // true to enable index cache, leave blank otherwise
    tables: [...]
}).then(...)
```

# API

The `NativeStorage` class accepts one optional argument that is used to enable or disable index caching.

If `true` is passed in, table indexes will be stored in javascript memory to increase write performance and range query performance.  If `false` or nothing is passed in, write performance and range queries will be slower but indexes will only be loaded into memory as they are needed, then cleared from memory.

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

## [2.0.5]
- Documentation and dependency updates.

## [2.0.4]
- Readme updates.

## [2.0.3]
- Added option to cache indexes.

## [2.0.2]
- Fixed index bug.

## [2.0.1]
- Fixed write bug

## [2.0.0]
- First release