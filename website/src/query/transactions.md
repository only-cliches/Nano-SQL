# Transactions

Transactions can be used to batch a collection of writes/deletes together to form an atomic set of changes to the database.

> *Note* not all adapters support transactions, if you attempt to perform a transaction on an adapter that doesn't suppor them, nanoSQL will fallback to standard writes/deletes and emit a console warning.

To perform a transaction, call the `.transaction` method and provide it with an array of queries to perform.

A few limitations:
- Transactions only work on `upsert` or `delete` queries.
- Transactions only work on one database at a time.
- Each query should end with `.emit()` instead of `.exec()` or other output.

```ts
nSQL().transaction([
    nSQL("table").query("upsert", {row: data}).emit(),
    nSQL("table2").query("delete").where(["id","=","something"]).emit()
]).then(() => {
    // transaction done
}).catch(() => {
    // transaction error
})
```

Keep in mind when you're performing actions on large sets of data the **entire data set** is loaded into memory, data sets in the 10s of thousands of rows are at a risk of running the javascript engine out of memory.  

If you have extremely large data sets like this you should either use `.stream()` with standard queries or batch the data sets into smaller segments, then use a transaction on those.