<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fplugin-redis-index">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fplugin-redis-index.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 Redis Indexing Plugin</h1>
<p align="center">
  <strong>Allows you use Redis for Indexes with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.gitbook.io/docs/adapters/redis) | [Help](https://github.com/ClickSimply/Nano-SQL/issues)

# What's This For?
Most of the adapters you can use in NodeJS (MySQL, DynamoDB, etc) must perform serialization of the secondary indexes before and after each upsert query and at least one serialization step for select queries on secondary indexes.  The performance cost of this json serialization can slow down secondary indexes.

Unlike most database engines, Redis provides a native "list" type that allows the serialization process to be skipped entirely.  Using this plugin with MySQL, DynamoDB and almost all the other NodeJS adapters will provide a performance boost for indexes.

Some NodeJS adapters do not benefit from this plugin, I recommend that you test your data models with and without the plugin to make sure you have a performance benefit.  It's mostly the embedded databases (SQLite & RocksDB) that are faster *without* this plugin.

> **Important** If you setup this plugin on an existing database you'll need to [rebuild your indexes](https://nanosql.gitbook.io/docs/query/rebuild-index) (after installing the plugin) for the indexes to start working again.

> **Also Important** Make sure you have [persistance](https://redis.io/topics/persistence) enabled in Redis, or you'll have to rebuild your indexes every time Redis restarts!

# Installation

```sh
npm i @nano-sql/plugin-redis-index --save
```

# Usage

```ts
import { RedisIndex } from "@nano-sql/plugin-redis-index";
import { nSQL } from "@nano-sql/core";

nSQL().connect({
    id: "my_db",
    mode: "PERM", // or any NodeJS adapter
    plugins: [
      RedisIndex()
    ]
    tables: [...]
}).then(...)
```

# API

The `RedisIndex` function accepts two optional arguments

### Redis Client Connect Options
The plugin uses the npm `redis` module internally and calls `redis.createClient` to connect to the redis database.

You can optionally pass in a configuration object to adjust things like the port and ip address the client will attempt to connect to.

All of the configuration options are documented [here](https://www.npmjs.com/package/redis#rediscreateclient).

### Redis Client Callback
A function that will be called once the redis client connects, the argument passed into the function will be the redis client itself, giving you access to perform redis queries manually or add event listeners.

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

