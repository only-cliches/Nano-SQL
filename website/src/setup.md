# Setup

## Installing nanoSQL

### Browser
Simply copy one of the script links below and drop it into your page head.
```html
<!-- ES6 Only (Faster & Smaller) -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.2.5/dist/nano-sql.min.js" integrity="sha256-3IxuRAQ9oXPMAKub/GFaDYs0HmpeXoeqzoHM35NkULE=" crossorigin="anonymous"></script>
<!-- ES5 (Internet Explorer/Old Browser Support) -->
<!-- Promise must be polyfilled as well -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.2.5/dist/nano-sql.min.es5.js" integrity="sha256-zWjH22E8JIeun1GKLKNAqx+xXZO15hhy7gyWG/2/rYw=" crossorigin="anonymous"></script>
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

The [connect](https://api.nanosql.io/classes/_index_.nanosql.html#connect) method accepts one object as its argument and returns a promise.  When the promise resolves the database is ready to use. 

The object used in the connect function is described by the [InanoSQLConfig interface](https://api.nanosql.io/interfaces/_interfaces_.inanosqlconfig.html).

You can create tables using the [create table](/query/create-table.html) query or including them in the config object.

