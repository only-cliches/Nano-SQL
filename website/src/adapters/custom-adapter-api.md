# Custom Adapter API

## Writing Custom Adapters

Building a custom adapter is pretty straightforward, just import the interface from `@nano-sql/core` and write a class extending it that conforms to the the interface.

```typescript
import { InanoSQLAdapter } from "@nano-sql/core/lib/interfaces";

export class MyAdapter implements InanoSQLAdapter {
    // adapter code
}

// using the custom adapter
nSQL().createDatabase({
    id: "my_db",
    mode: new MyAdapter()
})
```

While it's possible to write an adapter in ES5 or ES6, using Typescript will make your life significantly easier.

You can also reference existing adapter code:

* [IndexedDB Adapter Source](https://github.com/ClickSimply/Nano-SQL/blob/master/packages/Core/src/adapters/indexedDB.ts)
* [RocksDB Adapter Source](https://github.com/ClickSimply/Nano-SQL/blob/master/packages/Core/src/adapters/rocksDB.ts)
* [Memory / Local Storage Adapter Source](https://github.com/ClickSimply/Nano-SQL/blob/master/packages/Core/src/adapters/syncStorage.ts)
* [WebSQL Adapter Source](https://github.com/ClickSimply/Nano-SQL/blob/master/packages/Core/src/adapters/webSQL.ts)

Here are the methods/objects in an adapter class:

```typescript
export class MyAdapter implements InanoSQLAdapter {
    // plugin object allows you to declare dependencies and filters
    // just like a plugin, read the plugin api for more details
    plugin: InanoSQLPlugin;
    
    // holds a reference to the parent nanoSQL instance
    // available just before `connect` is called, not available in constructor
    nSQL: InanoSQLInstance;
    
    // called to connect to the database backend
    connect(id: string, complete: () => void, error: (err: any) => void);
    
    // disconnect from the database backend
    disconnect(complete: () => void, error: (err: any) => void);
    
    // create a new table in the database backend
    // if the table already exists, do nothing
    createTable(tableName: string, tableData: InanoSQLTable, complete: () => void, error: (err: any) => void);
    
    // drop/delete table from database
    dropTable(table: string, complete: () => void, error: (err: any) => void);
    
    // write a single row to the database
    // primary key/pk may be undefined
    write(table: string, pk: any, row: {[key: string]: any}, complete: (pk: any) => void, error: (err: any) => void);
    
    // read a single row from the database
    read(table: string, pk: any, complete: (row: {[key: string]: any} | undefined) => void, error: (err: any) => void);
    
    // delete a single row from the database
    delete(table: string, pk: any, complete: () => void, error: (err: any) => void);
    
    // read multiple rows from the database
    readMulti(table: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRow: (row: {[key: string]: any}, i: number) => void, complete: () => void, error: (err: any) => void);
    
    // get an array of primary keys for this table
    getTableIndex(table: string, complete: (index: any[]) => void, error: (err: any) => void);
    
    // get the total number of records in this table
    getTableIndexLength(table: string, complete: (length: number) => void, error: (err: any) => void);
    
    // create a secondary index
    createIndex(table: string, indexName: string, type: string, complete: () => void, error: (err: any) => void);
    
    // delete a secondary index
    deleteIndex(table: string, indexName: string, complete: () => void, error: (err: any) => void);
    
    // add a value to a secondary index
    addIndexValue(table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void);
    
    // delete a value from a secondary index
    deleteIndexValue(table: string, indexName: string, key: any, value: any, complete: () => void, error: (err: any) => void);
    
    // read a single index key
    readIndexKey(table: string, indexName: string, pk: any, onRowPK: (key: any) => void, complete: () => void, error: (err: any) => void);
    
    // read a range of index keys
    readIndexKeys(table: string, indexName: string, type: "range" | "offset" | "all", offsetOrLow: any, limitOrHigh: any, reverse: boolean, onRowPK: (key: any, value: any) => void, complete: () => void, error: (err: any) => void);
}
```

## Testing Custom Adapters

Every nanoSQL adapter is tested using the official adapter test API.

The example below shows how you can test your own adapter.

```typescript
import { nanoSQLAdapterTest } from "@nano-sql/core/lib/adapter-test";

// the test will call your class like this:
// new MyAdapterClass(adapter, args);
new nanoSQLAdapterTest(MyAdapterClass, [adapter, args]).test().then(() => {
    // test passed
}).catch(() => {
    // test failed
})
```

The test makes sure that all of the adapter methods work consistently with all the other adapters.  This makes sure that regardless of the adapter being used the end user will experience identical query results.
