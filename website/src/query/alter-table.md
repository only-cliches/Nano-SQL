# Alter Table

Alter table can be used to modify table indexes, views, actions and data model without destroying the existing table data.

This query is only needed if you want to adjust a table's configuration without restarting nanoSQL, making this mostly relevant in server environments.  This query does essentially the same thing as adjusting the table in the `connect()` configuration object, without requiring you to restart nanoSQL.

The alter table query takes identical arguments as the [create table](/docs/query/create-table) query.  Keep in mind the table views, actions, indexes and data model will all be **replaced** by what's passed into the query, but the rows in the table will not be affected.  You may want to [rebuild your indexes](/docs/query/rebuild-index) or [conform the rows](/docs/query/conform-rows) in the table after the alter table command depending on what changed.

```typescript
// Alter users table with new data model
nSQL("users").query("alter table", {
    name: "users",
    model: {
        "id:int" {pk: true, ai: true},
        "name:string": {}
    }
}).exec().then..
```

You can safely change just about anything in the configuration \(indexes, table name, columns, etc\), the only exception is the primary key.  The primary key column and type cannot safely be changed after a table is created, the only way to make that kind of adjustment is to make a whole new table and copy the rows from the old table to the new table.
