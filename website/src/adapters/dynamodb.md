# DynamoDB

[![nanoSQL Logo](https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png)](https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core)

[![nanoSQL Logo](https://badge.fury.io/js/%40nano-sql%2Fadapter-dynamo.svg) ](https://badge.fury.io/js/%40nano-sql%2Fadapter-dynamo)[![nanoSQL Logo](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE)

## nanoSQL 2 DynamoDB Adapter

**Allows you to run Amazon DynamoDB with** [**nanoSQL 2**](https://www.npmjs.com/package/@nano-sql/core)

[Documentation](https://nanosql.gitbook.io/docs/adapters/dynamodb) \| [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) \| [Chat](https://gitter.im/nano-sql/community)

## Installation <a id="installation"></a>

```bash
npm i @nano-sql/adapter-dynamo --save
```

## Usage <a id="usage"></a>

```typescript
import { DynamoDB } from "@nano-sql/adapter-dynamo";
import { nSQL } from "@nano-sql/core";

nSQL().connect({
    id: "my_db",
    mode: new DynamoDB(),
    tables: [...]
}).then(...)
```

## API <a id="api"></a>

The `DynamoDB` class accepts two optional arguments in it's constructor.

#### AWS Dynamo DB Options <a id="aws-dynamo-db-options"></a>

The first object is passed directly into the `aws-sdk` constructor for `AWS.DynamodDB`, allowing you to adjust connect preferences and other things. The constructor properties are documented by AWS [here](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#constructor-property).

#### Query Filter Object <a id="query-filter-object"></a>

Each key is an optional function that allows you to adjust the different queries being sent from this adapter to AWS.

Types are imported with `import * as AWS from "aws-sdk";`

| Key | DynamoDB Query | Type |
| :--- | :--- | :--- |
| filterSchema | createTable | AWS.DynamoDB.CreateTableInput |
| filterDrop | deleteTable | AWS.DynamoDB.DeleteTableInput |
| filterScan | scan | AWS.DynamoDB.DocumentClient.ScanInput |
| filterQuery | query | AWS.DynamoDB.DocumentClient.QueryInput |
| filterUpdate | update | AWS.DynamoDB.DocumentClient.UpdateItemInput |
| filterDelete | delete | AWS.DynamoDB.DocumentClient.DeleteItemInput |
| filterGet | get | AWS.DynamoDB.DocumentClient.GetItemInput |

```bash
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

## Limitations <a id="limitations"></a>

Full table scans or using offset/limit, especially with reverse order will work but cause you to have a bad time.

Focus on using `IN`, `=`, or `BETWEEN` with primary keys and secondary indexes, even with reverse order these are fine.

## MIT License <a id="mit-license"></a>

Copyright \(c\) 2019 Scott Lott

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files \(the "Software"\), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
