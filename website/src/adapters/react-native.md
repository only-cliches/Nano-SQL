# React Native

[![nanoSQL Logo](https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png)](https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core)

[![nanoSQL Logo](https://badge.fury.io/js/%40nano-sql%2Fadapter-react-native.svg) ](https://badge.fury.io/js/%40nano-sql%2Fadapter-react-native)[![nanoSQL Logo](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE)

## nanoSQL 2 React Native Adapter

**Allows you to run React Native with** [**nanoSQL 2**](https://www.npmjs.com/package/@nano-sql/core)

[Documentation](https://nanosql.gitbook.io/docs/adapters/react-native) \| [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) \| [Chat](https://gitter.im/nano-sql/community)

## Installation <a id="installation"></a>

```bash
npm i @nano-sql/adapter-react-native --save
```

## Usage <a id="usage"></a>

```typescript
import { NativeStorage } from "@nano-sql/adapter-react-native";
import { nSQL } from "@nano-sql/core";

nSQL().connect({
    id: "my_db",
    mode: new NativeStorage(true), // true to enable index cache, leave blank otherwise
    tables: [...]
}).then(...)
```

## API <a id="api"></a>

The `NativeStorage` class accepts one optional argument that is used to enable or disable index caching.

If `true` is passed in, table indexes will be stored in javascript memory to increase write performance and range query performance. If `false` or nothing is passed in, write performance and range queries will be slower but indexes will only be loaded into memory as they are needed, then cleared from memory.

## MIT License <a id="mit-license"></a>

Copyright \(c\) 2019 Scott Lott

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files \(the "Software"\), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.Some content has been disabled in this document
