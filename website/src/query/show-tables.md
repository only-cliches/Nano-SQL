# Show Tables

Show tables accepts no arguments, it's used to list all the tables in the current database.  

It doesn't matter what table is selected, this query will always output an array of tables in the database

```typescript
// Get a list of all active tables.
nSQL().query("show tables").exec().then((rows) => {
    console.log(rows);
    /*
    [
        {table: "users"},
        {table: "posts"},
        ...
    ]
    */
});
```
