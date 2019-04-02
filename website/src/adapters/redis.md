# Redis

[![nanoSQL Logo](https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png)](https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core)

[![nanoSQL Logo](https://badge.fury.io/js/%40nano-sql%2Fadapter-redis.svg) ](https://badge.fury.io/js/%40nano-sql%2Fadapter-redis)[![nanoSQL Logo](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE)

## nanoSQL 2 Redis Adapter

**Allows you to run Redis with** [**nanoSQL 2**](https://www.npmjs.com/package/@nano-sql/core)

[Documentation](https://nanosql.gitbook.io/docs/adapters/redis) \| [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) \| [Chat](https://gitter.im/nano-sql/community)

## Installation <a id="installation"></a>

```bash
npm i @nano-sql/adapter-redis --save
```

## Usage <a id="usage"></a>

```typescript
import { Redis } from "@nano-sql/adapter-redis";
import { nSQL } from "@nano-sql/core";

nSQL().connect({
    id: "my_db",
    mode: new Redis(),
    tables: [...]
}).then(...)
```

## API <a id="api"></a>

The `Redis` class accepts two optional arguments

#### Redis Client Connect Options <a id="redis-client-connect-options"></a>

The adapter uses the npm `redis` module internally and calls `redis.createClient` to connect to the redis database.

You can optionally pass in a configuration object to adjust things like the port and ip address the client will attempt to connect to.

All of the configuration options are documented [here](https://www.npmjs.com/package/redis#rediscreateclient).

#### Redis Client Callback <a id="redis-client-callback"></a>

A function that will be called once the redis client connects, the argument passed into the function will be the redis client itself, giveing you access to perform redis queries manually or add event listeners.

## MIT License <a id="mit-license"></a>

Copyright \(c\) 2019 Scott Lott

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files \(the "Software"\), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
