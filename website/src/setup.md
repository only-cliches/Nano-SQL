# Setup

## Installing nanoSQL

### Browser
Simply copy one of the script links below and drop it into your page head.
```html
<!-- ES6 Only (Faster & Smaller) -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.2.4/dist/nano-sql.min.js"></script>
<!-- ES5 (Internet Explorer/Old Browser Support) -->
<!-- Promise must be polyfilled as well -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.2.4/dist/nano-sql.min.es5.js"></script>
```

### NodeJS / Webpack / Browserify / etc
Run this in your project directory:
```sh
npm i @nano-sql/core --save
```

Then use in your project:
```ts
// typescript & babel
import { nSQL } from "@nano-sql/core";

// commonjs / node syntax
const nSQL = require("@nano-sql/core").nSQL;
```


## Using nanoSQL

NanoSQL requires very little boilerplate code to start using.  Simply call the `connect` method and pass in an object describing your tables and other properties, then it's ready to use!

```typescript
// basic setup
nSQL().connect({
    id: "my_db",
    mode: "PERM", // save changes to IndexedDB, WebSQL or RocksDB!
    tables: [
        {
            name: "users",
            model: {
                "id:uuid": {pk: true},
                "name:string": {},
                "age:int": {}
            }
        }
    ]
}).then(() => {
    // ready to query!
}).catch(() => {
    // ran into a problem
})
```

The connect method accepts one object as its argument and returns a promise.  When the promise resolves the database is ready to use.  The object can be adjusted to change the behavior of nanoSQL.

**Interface InanoSQLConfig**

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| id | String | true | unique id for this database |
| queue | Boolean | false | If true, queries will happen one after another in series.  If false, they will happen as quickly as possible, sometimes in parallel.  Default is false. |
| mode | String \| InanoSQLAdapter | false | Either a string describing the desired mode, or an adapter to use.  Read more [here](/adapters/built-in-adapters.html). |
| plugins | InanoSQLPlugin\[\] | false | Plugins to use. |
| planetRadius | Number | false | The planet radius used by `CROW` function.  Default is 6371 \(km\) |
| version | Number | false | The database version. |
| onVersionUpdate | \(oldVersion: number\) =&gt; Promise | false | Used to migrate to newer database versions as needed. |
| tables | InanoSQLTableConfig\[\] | false | The tables to create and configure before completing `connect`.  Read about these in the [create table docs](/query/create-table.html). |
| size | Number | false | The size declared by the WebSQL database. |

