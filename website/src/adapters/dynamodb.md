<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fadapter-dynamo">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fadapter-dynamo.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 DynamoDB Adapter</h1>
<p align="center">
  <strong>Allows you to run Amazon DynamoDB with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/adapters/dynamodb.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

# Installation

```sh
npm i @nano-sql/adapter-dynamo --save
```

# Usage

```ts
import { DynamoDB } from "@nano-sql/adapter-dynamo";
import { nSQL } from "@nano-sql/core";

nSQL().connect({
    id: "my_db",
    mode: new DynamoDB(),
    tables: [...]
}).then(...)
```

# API

The `DynamoDB` class accepts two optional arguments in it's constructor.

### AWS Dynamo DB Options
The first object is passed directly into the `aws-sdk` constructor for `AWS.DynamodDB`, allowing you to adjust connect preferences and other things.  The constructor properties are documented by AWS [here](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#constructor-property).

### Query Filter Object

Each key is an optional function that allows you to adjust the different queries being sent from this adapter to AWS.

Types are imported with `import * as AWS from "aws-sdk";`

|      Key     | DynamoDB Query |                     Type                    |
|:------------:|:--------------:|:-------------------------------------------:|
| filterSchema | createTable    | AWS.DynamoDB.CreateTableInput               |
| filterDrop   | deleteTable    | AWS.DynamoDB.DeleteTableInput               |
| filterScan   | scan           | AWS.DynamoDB.DocumentClient.ScanInput       |
| filterQuery  | query          | AWS.DynamoDB.DocumentClient.QueryInput      |
| filterUpdate | update         | AWS.DynamoDB.DocumentClient.UpdateItemInput |
| filterDelete | delete         | AWS.DynamoDB.DocumentClient.DeleteItemInput |
| filterGet    | get            | AWS.DynamoDB.DocumentClient.GetItemInput    |

```ts
import { DynamoDB } from "@nano-sql/adapter-dynamo";
import { nSQL } from "@nano-sql/core";
import * as AWS from "aws-sdk";

// example filter for schema
nSQL().connect({
    id: "my_db",
    mode: new DynamoDB({}, {
        filterSchema: (schemaArgs: AWS.DynamoDB.CreateTableInput) => {
            // mess with schema args
            return schemaArgs;
        }
    }),
    tables: [...]
}).then(...)
```

# Limitations

Full table scans or using offset/limit, especially with reverse order will work but cause you to have a bad time.

Focus on using `IN`, `=`, or `BETWEEN` with primary keys and secondary indexes, even with reverse order these are fine.

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

## [2.0.8]
- Documentation and dependency updates.

## [2.0.7]
- Readme updates and dependency updates.

## [2.0.5] & [2.0.6]
- Package.json adjustements

## [2.0.4]
- Readme tweaks

## [2.0.2]
- Moved to a standardized Readme format.

## [2.0.1]
- Added package description.

## [2.0.0]
- First release