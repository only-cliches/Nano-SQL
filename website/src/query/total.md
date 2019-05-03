# Total

Total queries can be used to get a cached count of rows in a table. 

When you perform queries that affect table data an in memory counter is adjusted that keeps track of the number of rows in each table.  The in memory counter is saved to the database asynchronously so it can be loaded back into memory on subsequent loads.

The asynchronous nature of these cache updates mean that using this query without the `{rebuild: true}` argument can give results that are not 100% accurate.  If you absolutely need an accurate number using `{rebuild: true}` with this query is the way to go.

This query is orders of magnitude faster than `.query("select", ["COUNT(*)"])`, even with `{rebuild: true}`.  Performance difference is determined by the limitations of the database adapter.

The optional query argument `{rebuild: true}` gets the actual row count from the database (not the cache), updates the cache with the new total and returns the updated total.

If you plan to use this query it's a good idea to run `.query("total", {rebuild: true})` on a regular basis to make sure the cached totals are kept within a small margin of the actual row count.

### Using the Total Query
```ts
// Get the cached table row count (VERY fast but may be slightly off from the real count)
nSQL("myTable").query("total").exec().then((rows) => {
    console.log(rows); // [{total: 99}]
});

// Gets the *actual* table row count and updates the cache
// Much slower but is accurate and updates the cache so subsequent total queries are more accurate.
nSQL("myTable").query("total", {rebuild: true}).exec().then((rows) => {
    console.log(rows); // [{total: 99}]
});
```

A good practice for this query would be using `.query("total")` when you need to get the total number of rows in a table instead of the much slower `query("select", ["COUNT(*)"])` and running `.query("total", {rebuild: true})` in the background once a day to make sure the counters remain accurate.