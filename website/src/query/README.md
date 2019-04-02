---
pageClass: section-home
---

# Query

Every query is structured like this:

```typescript
nSQL("table name")
.query("query type", ...query args)
...optional filtering, etc..
.exec()
```

Every query starts with the `.query()` method and ends with either `.exec()` to export the query to a JSON format, with `.toCSV()` to export the query to CSV format, or with `.stream()` to stream the result set.

For example, a query to select all rows from the "users" table would look like this:

```typescript
nSQL("users").query("select").exec().then((rows) => {
    // selected rows
    console.log(rows);
}).catch((error) => {
    // query error
});
```

If you wanted to stream the results instead to save memory, you could do this:

```typescript
nSQL("users").query("select").stream((row) => {
    // row selected
    console.log(row);
}, () => {
    // query complete
}, (error) => {
    // query error
});
```

Every query returns a promise with a JSON result of the query when using `.exec()`.

```typescript
nSQL().query("upsert",{name:"Bill"}).exec().then((result) => {
   return nSQL().query("select").where(["name","=","Bill"]).exec();
}).then((rows) => {
   console.log(rows) // <= [{id: 1, name: "Bill"}]
});
```