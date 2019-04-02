# CLI

The nanoSQL command line interface allows you to compile data models into typescript interface files.

Usage is as follows:

```bash
nsql --outDir www --files file1.ts file2.ts... --watch
```

If you don't pass `--watch` the CLI will compile the files into the given directory, then exit. You can also optionally pass `--watchPolling` with an interval to enable polling on the watch system.

It's important to note the files must be formatted specifically for the CLI to read them correctly.

Each file should have an export named `tables` that is an array of `InanoSQLTableConfig` types. The file below is a working example:

```typescript
import { InanoSQLTableConfig } from "@nano-sql/core/lib/interfaces";

export const tables: InanoSQLTableConfig[] = [
    {
        name: "users",
        model: {
            "id:uuid": {pk: true},
            "age:float": {},
            "name:string[]": {},
            "meta:obj[]": {
                model: {
                    "key:string": {},
                    "value:any": {}
                }
            },
            "*:any": {}
        }
    }
];

// using the above object in nSQL
import { nSQL } from "@nano-sql/core";
nSQL().connect({
    id: "my_db",
    tables: tables
}).then..
```

Assuming the above file is in the root directory of our project named index.ts, we could compile it to a typescript interface file with this command:

```bash
nsql --outDir www --files index.ts
```

The above command would produce the following file:

```typescript
import { uuid, timeId, timeIdms } from  "@nano-sql/core/lib/interfaces"

export interface IusersTable {
	id:uuid;
	age:number;
	name:string[];
	meta:{
		key:string;
		value:any;
	}[];
	[key: string]: any;
}
```

You can optionally create a file named `nsql.json` in your project root or pass a configuration json file into the CLI with `--package myConfig.json`.

If you make a json file the format is this:

```typescript
{
    watch: boolean,
    watchPolling: number,
    files: string[],
    outDir: string
}
```