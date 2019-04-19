<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-redis">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-redis.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 Redis Adapter</h1>
<p align="center">
  <strong>Allows you to run Redis with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/adapters/redis.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

# Installation

```sh
npm i @nano-sql/adapter-redis --save
```

# Usage

```ts
import { Redis } from "@nano-sql/adapter-redis";
import { nSQL } from "@nano-sql/core";

nSQL().createDatabase({
    id: "my_db",
    mode: new Redis(),
    tables: [...]
}).then(...)
```

# API

The `Redis` class accepts two optional arguments

### Redis Client Connect Options
The adapter uses the npm `redis` module internally and calls `redis.createClient` to connect to the redis database.

You can optionally pass in a configuration object to adjust things like the port and ip address the client will attempt to connect to.

All of the configuration options are documented [here](https://www.npmjs.com/package/redis#rediscreateclient).

### Redis Client Callback
A function that will be called once the redis client connects, the argument passed into the function will be the redis client itself, giveing you access to perform redis queries manually or add event listeners.

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

## [2.0.7]
- Documentation and dependency updates.

## [2.0.6]
- Package.json, performance, dependency & Readme updates.

## [2.0.5]
- Fixed package.json issue.

## [2.0.4]
- Adjusted secondary index read.

## [2.0.3]
- Added details to package.json

## [2.0.1] & [2.0.2]
- Fixed readme bug

## [2.0.0]
- First release