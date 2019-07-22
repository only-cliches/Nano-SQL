<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/master/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/master/graphics/logo.png" alt="nanoSQL Logo">
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

[Documentation](https://nanosql.gitbook.io/docs/adapters/redis) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

# What's This For?
Most of the adapters you can use in NodeJS (MySQL, DynamoDB, RocksDB, etc) must perform serialization of the secondary indexes for each indexed column in an upsert query and at least one serialization step for select queries.  The performance cost of this json serialization and read-modify-write cycles can slow down secondary indexes writes significantly.

Unlike most database engines, Redis provides a native "list" type that allows the serialization process to be skipped entirely.  Using this plugin will provide a performance boost for secondary indexes.  The more secondary indexes you have, the faster this plugin will be compared to without it.

Secondary index read performance should be similar to or better than the built in adapter.

A simple test writing 100k rows with two indexes and RocksDB:
1. Without this plugin: 29.5 seconds (3.4 upserts/ms)
2. With this plugin: 22.3 seconds (4.4 upserts/ms)

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

nSQL().createDatabase({
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

