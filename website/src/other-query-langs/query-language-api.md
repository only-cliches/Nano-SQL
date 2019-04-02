# Query Language API

With nanoSQL, you can use any query language you'd like or even invent your own with the query language API.

Usage is very simple, you just need to provide a function that returns an object with all the query parameters.  The query object looks like this:

**InanoSQLQuery Interface**

| Property | Required | Type | Description |
| :--- | :--- | :--- | :--- |
| table | yes | String \| Any\[\] \| Promise&lt;Any\[\]&gt; | The table to query against |
| tableAs | maybe | String | The table alias.  Required if a table property isn't of type "String" and a join or graph query is used. |
| action | yes | String | The query type.  Can be "select", "upsert", "delete", "drop", etc or any other [valid queries](https://nanosql.gitbook.io/docs/query). |
| actionArgs | no | Any | The arguments for the query.  For example a "select" query argument might be \["name", "COUNT\(\*\)"\]. |
| tags | no | Any\[\] | Query tags, not normally used by the query system. |
| comments | no | Any\[\] | Query comments, also not used by the query system. |
| where | no | Any\[\] \| Function | Identical to query `.where()` syntax, accepts valid where arguments. |
| graph | no | InanoSQLGraphArgs | Identical to query `.graph()` syntax, accepts graph arguments. |
| distinct | no | String\[\] | Identical to query `.distinct()` syntax, accepts distinct arguments. |
| orderBy | no | String\[\] | Identical to query `.orderBy()` syntax, accepts orderBy arguments. |
| groupBy | no | String\[\] | Identical to query `.groupBy()` syntax, accepts groupBy arguments. |
| having | no | Any\[\] \| Function | Identical to query `.having()` syntax, accepts valid having arguments. |
| join | no | InanoSQLJoinArgs | Identical to query `.join()` syntax, accepts valid join arguments. |
| limit | no | Integer | Query limit value, identical to `.limit()`. |
| offset | no | Integer | Query offset value, identical to `.offset().` |
| union | no | InanoSQLUnionArgs | Identical to query `.union()` syntax, accepts valid union arguments. |
| returnEvent | no | Boolean | Causes the query to return query event objects instead of normal results. |

* The function that returns this object should be passed into the `nSQL().query` function instead of the standard query arguments.
* The function will get the `nanoSQL` parent instance passed in as its only argument.

Let's build a custom query function that will grab a specific user by their id.

```typescript
import { InanoSQLInstance } from "@nano-sql/core";
import { buildQuery } from "@nano-sql/core/lib/utiliites";

const getUserById = (id: number) => {
    return (nanoSQL: InanoSQLInstance) => {
        return {
            // you should use this helper function
            ...buildQuery(nanoSQL, "users", "select"),             
            // now build out the query object 
            where: ["id", "=", id]
        }
    });
}
```

With the above function, we can use it like this:

```typescript
nSQL().query(getUserById(3)).exec()...

// the above function would execute this query:
nSLQ("users").query("select").where(["id", "=", 3]).exec()...
```

The `buildQuery` function used in the example takes care of boilerplate properties needed by the query object, you can pass in your `nanoSQL` parent, the table you'd like to select and the query action into the function, those will get passed into the underlying query object.

You can also allow the table that the user selected to be used in the query, just pass an empty string into the table argument for the `buildQuery` function.

Since you can pass anything into your custom query function, setting up any query language is just a matter of parsing the custom query into a nanoSQL query object.

```typescript
import { InanoSQLInstance } from "@nano-sql/core";
import { buildQuery } from "@nano-sql/core/lib/utiliites";

const mySQL = (query: string) => {
    return (nanoSQL: InanoSQLInstance) => {
        // parse mySQL string into object
        const parsed = someParsingFn(query);
        return {
            ...buildQuery(nanoSQL, parsed.table, parsed.action)
            ...parsed.query
        }
    }
}

// usage would look like this:
nSQL().query(mySQL("SELECT * FROM users")).exec()..
```
