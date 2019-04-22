# Databases

nanoSQL supports running anywhere from zero to any number of independent databases at once.  Each database has it's own collection of tables with data models, indexes and an adapter to save the data to.

Databases and tables can be created and deleted on the fly, tables can additionally be updated with new properties, indexes, data models, or even name after being created.

If no databases are created nanoSQL won't be able to persist data and can only be used with temporary tables like this:

```ts
// temporary array table
nSQL([
    {name: "bill", age: 20},
    {name: "tom", age: 30}
]).query("select").where(["age", "=", 20]).exec().then..

// temporary table from promise
nSQL(() => fetch("data.json").then(d => d.json())).query("select").where(["age", "=", 20]).exec().then..
```

After a database is created you can still use temporary tables for queries, they won't affect your persistent data in any way.

## Creating a Database

NanoSQL requires very little boilerplate code to start using.  Simply call the `createDatabase` method and pass in an object describing your tables and other properties, then it's ready to use!

```typescript
// basic setup
nSQL().createDatabase({
    id: "my_db", // can be anything that's a string
    mode: "PERM", // save changes to IndexedDB, WebSQL or RocksDB!
    tables: [ // tables can be created as part of createDatabase or created later
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

The [createDatabase](https://api.nanosql.io/classes/_index_.nanosql.html#createdatabase) method accepts one object as its argument and returns a promise.  When the promise resolves the database is ready to use. 

The object used in the createDatabase function is described by the [InanoSQLConfig interface](https://api.nanosql.io/interfaces/_interfaces_.inanosqlconfig.html).

Keep in mind that nanoSQL has no way of saving database config data between reloads of your app (only table data), so the `createDatabase` method should be called on the first and every subsequent app load you intend to use the database in.  If the database and tables already exist the `createDatabase` method just attaches nanoSQL to the existing data, otherwise the tables and indexes are created as needed.

## Selecting A Database Or Table

You can switch between different databases on the fly with the `useDatabase` function.

```ts
nSQL().useDatabase("my_db");
// you can now create tables, select data, or otherwise use database "my_db"
// "my_db" database will be used for all queries until another database is selected.
nSQL("posts").query("select").exec().then...

nSQL().useDatabase("2");
// you can now create tables, select data, or otherwise use database "2"
// subsequent queries will happen on database "2"
nSQL("users").query("select").exec().then...

// you can also chain useDatabase with queries.
// select from "users" table on database "2"
nSQL("users").useDatabase("2").query("select").exec().then...
```

Selecting different tables works much the same way, except you pass your table into the `nSQL` variable.

```ts
// select "users" table
nSQL("users")

// "users" table will be used for all queries until another table is selected.

// these will all query "users" table
nSQL().query("select").exec().then..
nSQL().query("upsert", {}).exec().then...

// there's no harm in selecting the table every time if you'd prefer...
nSQL("users").query("select").exec().then..
nSQL("users").query("upsert", {}).exec().then...
```

Once you select a database or table that database/table combination will remain selected until you select a different table and/or database.

When you create a database or table that database/table is automatically selected for subsequent queries.

## Listing Databases

To see the databases in nanoSQL you can call the `listDatabases` method.

```ts
const dbList = nSQL().listDatabases();
console.log(dbList) // ["db1", "db2", ...]
```

## Dropping A Database

To drop a database, simply call `dropDatabase` with the database id and that database's tables and other related data will be removed.

```ts
nSQL().dropDatabase("my_db").then(() => {
    // database dropped!
}).catch(() => {
    // had a problem
})
```

This will destroy the database, it's tables, rows and indexes.

## Disconnecting From A Database

In some cases you may want to disconnect from a database, to do that you can call `disconnect()`.

If a database ID is passed into `disconnect` nanoSQL will disconnect from only that database, if no ID is passed nanoSQL will disconnect from all current databases.

```ts
// disconnect from all databases
nSQL().disconnect().then..

// disconnect from "1" database
nSQL().disconnect("1").then..
```

Disconnecting from the database will not cause any data loss on the underlying tables/indexes.  This is mostly useful if you need to remove a file lock from the database files (like with SQLite or RocksDB) or free the database connection (like with Redis or MySQL).

## Next Steps

You can dive deeper into how to make tables/data models in nanoSQL. You can create tables in your database using the [create table](/query/create-table.html) query.

You can also learn the ins and outs of [select query](/query/select.html) to unlock the power of nanoSQL.