# Performance

## \#1 Performance Killer

The main thing that slows down query performance are full table scans.  In fact, most modern noSQL databases make it as hard as possible to do full table scans since the performance penalty is so dramatic.  So the main goal when setting up the data model and queries is to reduce the number of full table scans that come from the application.  

NanoSQL makes it easy to do full table scans so it's there when you need it, but the performance cost is still a problem that should be taken very seriously.

While it's usually impossible to never perform a full table scan, we can get clever about the way we setup the application and database so that the full table scans are extremely infrequent.

You can optionally pass `warnOnSlowQuery` into the `createDatabase` object to have nanoSQL warn you when queries that require a full table scan are performed.

## Never Use Offset/Limit

NanoSQL has a query caching feature that allows you to save the results of a complete query in memory, then paginate through them as desired.  This works with any query type and doesn't require any changes to your data models.

[Query Cache API](/query/select.html#query-cache)

This is a much better alternative to using `.offset()` and `.limit` in your queries.  

> FYI: Limit and offset typically work by selecting the entire result set, then cutting it down to the desired size.  So each time you paginate through a query using limit/offset the entire query result set must be selected.

## Index All The Things

Primary Keys and Secondary Indexes are a great way to increase query performance.  This means you need to be thinking about how the data will be queried as you're building out the data structures.

Indexing boils down to one idea: if you can know the exact id or range of ids on a column you'll need for a given query, you'll find orders of magnitude faster performance if you use an index on that column.

Let's look at a simple example when we have orders and we know a common query will be getting the orders from the last day.  We could setup a data model like this:

```typescript
nSQL().createDatabase({
    tables: [
        {
            name: "orders",
            model: {
                "id:uuid": {pk: true},
                "date:int": {},
                "total:float": {},
                "items:any[]": {}
            }
        }
    ]
})
```

Then to get the last day of orders the query would look like this:

```typescript
nSQL("orders").query("select").where(["date", ">", Date.now() - (24 * 60 * 60 * 1000)]).exec()
```

The problem here is _every single order row will have to checked_ to see if the date is within the range provided.  Even with a fast database engine, checking tens of thousands of records is a problem.  Imagine if this system is in use for several years and the orders get into the hundreds of thousands or even millions.  The above query would start taking dozens of seconds to complete, even if there were only a few sales for a given day.

With a small tweak to our data model and query, we can increase the performance of this kind of query exponentially:

```typescript
nSQL().createDatabase({
    tables: [
        {
            name: "orders",
            model: {
                "id:uuid": {pk: true},
                "date:int": {},
                "total:float": {},
                "items:any[]": {}
            },
            indexes: { // add index for the date column
                "date:int": {}
            }
        }
    ]
})
```

We'll also need to adjust the query slightly since indexes only work with ranges or exact matches:

```typescript
nSQL("orders").query("select").where(["date", "BETWEEN", [Date.now() - (24 * 60 * 60 * 1000), Date.now()]).exec()
```

The other massive advantage to this setup is the above query won't get slower as the table gets larger, even at millions of records grabbing a slice of the last day of sales will be a very fast query, likely taking less than a second.

Don't go crazy with indexes though, there is an upsert performance penalty for each index you add.  Essentially each index will act like another row update, so if you have 3 indexes each row update can take as long as 3 times as a normal row update without indexes.

There are some additional use cases and restrictions when using indexes, you can read about them on the [create table page](/query/create-table.html).

## Sub Optimized Queries

When you query the database using a primary key or secondary index with `BETWEEN`, `IN` or `=`,  nanoSQL detects the faster query path and uses that instead, optimizing the query for the best performance.

But what if you wanted to get a subset of records inside the optimized set? 

NanoSQL provides a method to form your queries to take advantage of the indexes while also being able to grab more specific but less optimized records within the larger optimized set.

While we could index every column that intended to be queried, this can quickly lead to an issue with upserts taking forever to complete, so this isn't an ideal solution.

Instead, we can use the few indexed columns and a clever arrangement of our query to get good performance.

The rules are simple: start your `where` with the optimized/indexed conditions separated by "AND".  Follow the last optimized where with an AND, then add any further \(non indexed\) conditions after that.

Internally nanoSQL will select the desired rows using the indexes, then perform a full table scan style query on the selected rows to further narrow them down as needed.

Let's look at some examples:

```typescript
// example data model
nSQL().createDatabase({
    tables: [
        {
            name: "orders",
            model: {
                "id:uuid": {pk: true},
                "date:int": {},
                "store:int": {},
                "cashier:int", {},
                "total:float": {},
                "items:any[]": {}
            },
            indexes: {
                "date:int": {},
                "store:uuid": {}
            }
        }
    ]
})

// get all orders in the last 24 hours for a specific cashier
nSQL("orders").query("select").where([
    ["date", "BETWEEN", [Date.now() - (24 * 60 * 60 * 1000), Date.now()]],
    "AND",
    ["cashier", "=", 2]
]).exec()..

// get all orders in the last 24 hours for a specific store AND cashier
nSQL("orders").query("select").where([
    ["date", "BETWEEN", [Date.now() - (24 * 60 * 60 * 1000), Date.now()]],
    "AND",
    ["store", "=", 59],
    "AND",
    ["cashier", "=", 2]
]).exec()..

// get all orders in the last 24 hours for a specific store AND cashier with totals above $100
nSQL("orders").query("select").where([
    ["date", "BETWEEN", [Date.now() - (24 * 60 * 60 * 1000), Date.now()]],
    "AND",
    ["store", "=", 59],
    "AND",
    ["cashier", "=", 2],
    "AND",
    ["total", ">", 100]
]).exec()..
```



## Incremental Map Reduce

Placeholder for when the map reduce plugin is ready to go.