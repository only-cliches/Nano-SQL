# Import & Export

## Smart Import / Export

The import functions take data and insert it into the database.

If you have secondary indexes, tries or orm properties set up, they will be managed automatically during any data imports.

### Export JSON

NanoSQL exports to JSON by default. If you're using the `TEMP` data store the rows you get will be references to actual raw data stored in memory. If you'd like to be able to edit the exported data in this case or separate the reference you can surround the resulting rows with `JSON.parse(JSON.stringify(rowData))`.  If you're not using the TEMP data store  you don't need to separate the reference to modify the rows.

```typescript
nSQL().query("select").exec().then((rows) => {
    console.log(rows) // <= json data
});
```

### Import JSON

Simply provide nanoSQL with an array of rows to import.

```typescript
nSQL("tableToImport").loadJS([
    {id: 1, name: "Jeb"},
    {id: 2, name: "Bob"}
]).then(() => {
    console.log("Data is in the database and ready!");
});
```

loadJS also has an optional second argument, an `onProgress` callback.  This function will be called for every row insert and provide a number between 0 and 100 representing the load progress.

```typescript
nSQL("tableToImport").loadJS([
    {id: 1, name: "Jeb"},
    {id: 2, name: "Bob"}
], (progress) => {
    console.log(progress) // when progress === 1 the import is done
}).then(() => {
    console.log("Data is in the database and ready!");
});
```

There is also a third optional argument, if you pass `true` into the third argument the import will be performed in parallel instead of in series.

### Export CSV

Just call `.toCSV()` at the end of your query **instead of** `.exec()`. All normal query options are available here, any select query that works with `.exec()` will also work with `.toCSV()`.

The `.toCSV()` function accepts a single optional argument, if it's true the resulting CSV will have row headers. If false, row headers will be omitted.  Exported CSVs will be [RFC4180](https://tools.ietf.org/html/rfc4180) compliant.

```typescript
nSQL("table").query("select").toCSV(true).then((csv) => {
    console.log(csv); //<= CSV export
});
```

### Import CSV

Imported CSVs must include row headers so nanoSQL knows where to put the data.  CSVs should be [RFC4180](https://tools.ietf.org/html/rfc4180) compliant.

```typescript
nSQL("tableToImport").loadCSV(`
    id,name
    1,Bill
    2,Jeb
`).then(() => {
    console.log("Data is in the database and ready!");
});
```

loadCSV also has three optional arguments.  The first optional argument is a rowMap function that can be used to mutate the rows after they've been converted to JSON but before they are inserted into the database.   The second argument, an `onProgress` callback.  This function will be called for every row insert and provide a number between 0 and 1 representing the load progress.

```typescript
nSQL("tableToImport").loadCSV(`
    id,name
    1,Bill
    2,Jeb
`, (row) => {
    return row;
}, (progress) => {
    console.log(progress) // when progress === 1 the import is done
}).then(() => {
    console.log("Data is in the database and ready!");
});
```

There is also a third optional argument, if you pass `true` into the fourth argument the import will be performed in parallel instead of in series.

## Raw Import / Export

These methods let you move data in and out of the database table objects directly. You get a massive performance benefit but with some significant tradeoffs.

None of the methods in this section will cause any database events to be triggered or can any of these methods be filtered.

Internally the database adapters typically use transactions for these queries.  If you need transactions this is currently the only supported way to get them, but the transactions do not work across tables.

### Raw Export

You can get a snapshot of everything in nanoSQL by calling this method.  It accepts three arguments and returns a promise when the export is done.

| Argument | Type | Description |
| :--- | :--- | :--- |
| Tables | String\[\] | List of tables to export, empty to export all. |
| Indexes | Boolean | Should table indexes be exported instead of rows? |
| onRow | \(table: string, row: any\) =&gt; void | Called for each row exported from the database |

```typescript
// Show me all rows in all tables.
nSQL().rawDump([], false, (table, row) => {
    // table <- string of the table currently being exported
    // row <- object of the current row
}).then((data) => {
    // export done
});

// Show me all rows in just users table.
nSQL().rawDump(["users"], false, (table, row) => {
    // table <- "users"
    // row <- object of the current row
}).then((data) => {
    // export done
});

// Show me all index values in just users table.
nSQL().rawDump(["users"], true, (table, row) => {
    // table <- "users.indexName"
    // row <- {indexId: key, rowId: id}
}).then(() => {
    // export done
});
```

### Raw Import

**BE VERY CAREFUL WITH THIS** nanoSQL normally keeps track of auto increment values, secondary indexes and other things as part of the standard query lifecycle. When you use this import you will be inserting data DIRECTLY into the backend database: bypassing every check, safety and consistency guarantee provided by nanoSQL.

This is **orders of magnitude** faster than importing data using `.loadJS`, but your data must already be organized and sanitized or you won't get acceptable results. If the data is coming from a `rawDump()` command you have no worries here; if you're importing data you've built yourself it might be a good idea to run a `conform rows` query after the import.

The best use case for this method is mounting state to nanoSQL following a server side render of your app.

The function accepts three arguments

| Argument | Type | Description |
| :--- | :--- | :--- |
| tables | {\[tableName: string\]: any\[\]} | An object where each key is the table name, and the values are arrays or rows for each table.  If indexes each key is the tableName.IndexName and the rows are `{indexId: id, rowId: key}` |
| indexes | boolean | `true` if importing indexes, otherwise `false` |
| onProgress | \(percent: numer\) =&gt; void | callback used to report import progress, when `percent` === 100 the import will be done. |

Some important notes on the behavior here:

* If you pass in a table that doesn't exist, the import will fail.
* Existing rows will be completely replaced by a provided row with the same primary key.
* If you omit a table it will not be affected by the import process.

```typescript
// import data into users table
nSQL().rawImport({
    users: [{id: 1, name: "Billy", age: 20}]
}, false, (progress) => {
    // import progress
}).then(() => {
    // import complete!
})

// import data into users age index
nSQL().rawImport({
    "users.age": [{indexId: 20, rowId: 1}]
}, true, (progress) => {
    // import progress
}).then(() => {
    // import complete!
})
```
