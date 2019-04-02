# Select

Select has only one argument, it's an optional array of columns and/or functions to apply to the query. Let's look at some examples.

## Simple Select

```typescript
// Get all rows from the users table.
nSQL("users").query("select").exec().then((rows) => {
    console.log(rows) // <= array of row objects
});

// Get all rows, but only the username column.
nSQL("users").query("select",["username"]).exec().then..

// Get username column and return it as name, then also get the age column.
nSQL("users").query("select",["username AS name","age"]).exec().then...

// Apply an aggregate function to the query...
nSQL("users").query("select",["COUNT(*) AS totalUsers"]).exec().then...
nSQL("users").query("select",["AVG(age) AS averageAge"]).exec().then..

// Query against properties of a column
nSQL("users").query("select").where(["posts.length", ">", 3]).exec().then...
nSQL("users").query("select").where(["meta.eyeColor", "=", "blue"]).exec().then...
nSQL("users").query("select", ["AVG(posts.length) AS averagePostCount"]).exec().then...
```

The built in functions include COUNT, MAX, MIN, GREATEST, LEAST, AVG, SUM, LOWER, UPPER, CAST, CONCAT, LEVENSHTEIN, CROW and all properties of Math as functions. You can also [create your own functions](/query/query-function-api.html).

Without `AS` functions will always add a column identical to the function name to the result set containing the answer:

```typescript
nSQL("users").query("select",["COUNT(*)"]).exec().then((rows) => {
   console.log(rows) //  <= [{"COUNT(*)":200}]
});
```

### Temporary Tables

You can also select from an array of records:

```typescript
nSQL().query("select").from([
    {id: 1, name: "bill"},
    {id: 2, name: "jeb"},
    {id: 3, name: "val"}
]).where(["name", "=", "jeb"].exec()
```

Or even select from a rows returned in a promise.  A good use case for this might be grabbing a json using `fetch` and filtering the rows you get back.

```typescript

nSQL().query("select").from({
    table: () => {
        return new Promise((res, rej) => {
            res({
                rows: [{id: 1, name: "bill"}, {id: 2, name: "jeb"}],
                cache: true
            });
        });
    }
    as: "posts" // optional, used for joins and graph queries
}).where(["name", "=", "jeb"].exec()
```

The promise feature lets you infinitely nest nanoSQL queries:

```typescript
nSQL().query("select").from({
    table: () => nSQL("users").query("select").where(["age", ">", 23]).exec().then(r => {rows: r, cache: true});
}).where(["name", "=", "jeb"].exec()
```

### Streaming Queries

In many cases javascript databases will load the entire query result into memory, then pass the whole object/array of rows to you as the result. This isn't always desirable, especially if you're scanning a very large number of records.

NanoSQL can optionally stream the query to you instead of loading results in memory.

To stream the results, simply replace `.exec()` with `.stream()` and follow the API provided below:

```typescript
nSQL("users").query("select").stream((row) => {
    // row received from stream
}, () => {
    // query complete
}, () => {
    // query error
})
```

While any query will work with `.stream()`, there are some cases where the results MUST be loaded into memory to get the desired result, so using the `.stream()` api in these cases will have no memory benefit over using `.exec()`.

These query conditions will force query results into memory regardless of `.stream()`:

* Using an aggregate function like `COUNT`.
* Using `.groupBy`.
* Using `.orderBy` on a c~~o~~lumn that doesn't have a secondary index or isn't the primary key.
* Using `.orderBy` with more than one column.

If you use `.stream()` in the above cases, you'll get all the query results at once after the query has finished, instead of incrementally as each row is selected.

The `.stream()` api can also be used in `delete` and `upsert` queries, with identical benefits.

### Query Cache

The query cache allows you to perform a query once, then paginate through the results of the query on demand. This is mostly useful for expensive or large queries that the end user is expected to be able to view multiple pages of results.

A few important restrictions to keep in mind about the cache. First the cache will not be updated with row data, so the cache represents the state of all the rows it scanned when they were scanned. Second the cache will remain in memory until it is removed.

To use the cache just replace `.exec()` with `.cache()` following the API described below. There are three methods of using the cache:

```typescript
// 1. Return cache when query completes
nSQL("users").query("select").cache((cacheID, count) => {
    // cacheID contains a UUID of this cache query
    // count contains the total number of records in the cache
}, () => {
    // query error
});

// 2. Return query pages as they are found
// this works similar to ".stream()", except as pages
// doesn't produce cache ID, doesn't require you to flush cache afterwards
nSQL("users").query("select").cache(() => {
    // query complete
}, () => {
    // query error
}, {
    pageSize: 20,
    onPage: (pageNum, rows) => {
        // pageNum is the page number starting with 0
        // rows is the query result
    },
    doNotCache: true
});

// 3. Return query pages AND cache result
nSQL("users").query("select").cache((cacheID, count) => {
    // query complete
    // cacheID contains a UUID of this cache query
    // count contains the total number of records in the cache
},, () => {
    // query error
}, {
    pageSize: 20,
    onPage: (pageNum, rows) => {
        // pageNum is the page number starting with 0
        // rows is the query result
    }
});
```

Once you have the `cacheID` from the cache query you can grab sections of the cache like this:

```typescript
const rows = nSQL().getCache(cacheID, {offset: 20, limit: 20});
```

Clearing the cache is also very straightforward:

```typescript
nSQL().clearCache(cacheID);
```

### Observer Queries

Another option for exporting query results is with a listener. The listener acts similar to an observable, once you subscribe to the query you can be notified when the rows in the query where affected and also get a copy of the new results.

The api is simple, instead of `.exec()` call `.listen()` and use one of the two options for exporting the stream:

```typescript
const observer = nSLQ("users").query("select").where(["age", ">", 23]).listen({ // optional arguments
    // optional: debounce/throttle so that query doesn't fire more often than this.  Default is 500ms
    debounce: 500, 
    // optional: check new queries to see if any changes have happened, don't fire callbacks if no changes
    unique: false, 
    // optional: if unique is true, an expensive deep comparison is performed on the rows, use this 
    // callback to replace that comparison with something faster if possible
    compareFn: (rowsA, rowsB) => {  
        return rowsA.length !== rowsB.length
    }
});

// choose one:
// 1. exec returns all rows in a single callback
observer.exec((rows, error) => {
    // this function will be called on every change
    // error will be undefined unless there was a problem
})
// 2. stream will send the rows one by one on each query
// stream cannot be used if unique:true is set in arguments
observer.stream((row) => {
    // called for every row
}, () => {
    // all rows sent for this query
}, (err) => {
    // query encountered error
})

// unsubscribe
observer.unsubscribe();
```

The listener will trigger for the primary table in the query as well as any tables involved in a join and any tables involved in a graph query, even if the tables are in deeply nested graph queries.

  
The only exception is if you use array based or promise based tables in the join/graph queries, if that's the case you can manually trigger the observer to check for new results at any time by calling `observer.trigger()`.  


### Selecting Rows Conditionally

You can request specific rows from the database based on a set of conditions. Let's look at some examples.

```typescript
// Only get users over 25 years old.
nSQL("users").query("select").where(["age",">",25]).exec().then...

// Users over 25 and under 50
nSQL("users").query("select").where([["age",">",25],"AND",["age","<=",50]]).exec()

// Use a function
nSQL("users").query("select").where(user => user.age > 25).exec().then...
```

If you're passing in a function to the where statement, it acts exactly like the array filter statement, where each row is checked with the function and when it returns a truthy or truth value the row will be provided in the query result.

Otherwise supported comparative queries are `<`, `=`, `!=`, `>`, `<=`, `>=`, `IN`, `NOT IN`, `REGEX`, `LIKE`, , `NOT LIKE`, `BETWEEN`, `NOT BETWEEN`, `INCLUDES`, `NOT INCLUDES`, `INTERSECT`, `INTERSECT ALL` and `NOT INTERSECT`.

`IN` and `NOT IN` take an array and check to see if the value is in the array.

```typescript
// get rows where the name is either jeb or scott.
nSQL("users").query("select").where(["name","IN",["jeb","scott"]]).exec();
```

`BETWEEN` and `NOT BETWEEN` take an array with two values to compare between:

```typescript
// get rows where the age is between 19 and 32.
nSQL("users").query("select").where(["age","BETWEEN",[19,32]).exec();
```

`INCLUDES` and `NOT INCLUDES` check for a specific value _inside_ the array of a column

```typescript
// get all rows where the postIDs column is an array containing the number 3.
nSQL("users").query("select").where(["postIDs", "INCLUDES", 3]).exec();

// get all rows where the postIDs column is an array NOT containing the number 3.
nSQL("users").query("select").where(["postIDs", "NOT INCLUDES", 3]).exec();
```

`INTERSECT ALL`, `INTERSECT` and `NOT INTERSECT` are useful to see if any values of a given array intersect with the values of an array column.

```typescript
// get all rows where the postIDs column is an array containing 1 OR 2.
nSQL("users").query("select").where(["postIDs", "INTERSECT", [1, 2]]).exec();

// get all rows where the postIDs column is an array NOT containing 1 OR 2.
nSQL("users").query("select").where(["postIDs", "NOT INTERSECT", [1, 2]]).exec();

// get all rows where the postIDs column is an array containing 1 AND 2.
nSQL("users").query("select").where(["postIDs", "INTERSECT ALL", [1, 2]]).exec();
```

You can add as many conditions as you'd like to a where statement, separating each condition with `AND` or `OR`.

```typescript
// Get all users who are over 20 years old and have blue as their favorite color.
nSQL("users").query("select").where([["age", ">", 20], "AND", ["favoriteColor", "=", "blue"]]).exec();
```

If you have more than two `where` conditions it's good to nest them, like this:

```typescript
nSQL("table").query("select").where([
    ["postYear", ">", 1999], "AND" [
        ["title", "LIKE", "searchTerm"], "OR", ["author", "LIKE", "searchTerm"]
    ]
]).exec()...
```

A recursive function is used to handle the nesting, so you can nest as many times as you need to.

You can also use functions inside the `where` conditions:

```typescript
// get all rows with levenshtien distance of less than 3 with "jeb", compare against the name column.
nSQL("users").query("select").where(["LEVENSHTEIN('jeb', name)", "<", 3]).exec()...
```

And it's also possible to query against nested values in each row:

```typescript
nSQL("users").query("select").where(["props.nested.value", "=", "something"]).exec()...
```

Nested values can also be used in query functions:

```typescript

nSQL("users").query("select").where(["LEVENSHTEIN('jeb', props.nested.name)", "<", 3]).exec()...
```

Finally, keep in mind if you use the `AS` syntax in your rows, the where statement must use the original row names.

```typescript
nSQL("users").query("select",["age AS howOld"]).where(["age",">",25]).exec()...
```

There are considerable performance considerations when setting up your queries, the [performance docs](/performance.html) are a good read.

### Distinct

The `distinct()` query argument allows you to select rows based on the unique value of specified columns.

```typescript
// get rows with distinct city column
nSQL("users").query("select").distinct(["city"]).exec();
```

You can add as many columns as you'd like to the distinct query simply by making the array argument larger.

### **Order By**

`OrderBy` accepts one required argument, it's an object describing the rows you want sorted, and in what direction. Let's take a look.

```typescript
// Sort by age descending, then name ascending.
nSQL("users").query("select").orderBy(["age DESC", "name ASC"]).exec();
```

You can sort by 1 or more columns, with the first columns in the object being sorted first, then the second, etc.

The sorting stacks as you add columns, for the example above everyone with the same age will be ordered together, then records _with the same age_ will be sorted by their name. If we added a third column to the orderBy argument above, all records with the _same name and age_ would be sorted by the value provided.

`AS` statements get applied before OrderBy, so make sure you use the column alias for sorting.

```typescript
nSQL("users").query("select",["username AS name"]).orderBy(["name ASC").exec();
```

You can also use query functions in the order by query:

```typescript
nSQL("users").query("select").orderBy(["UPPER(name) ASC"]).exec();
```

### **Limit & Offset**

Mostly used for pagination, these are very easy to use.

```typescript
// Get 20 records at a time, 40 records below the first one.
nSQL("users").query("select").limit(20).offset(40).exec();
```

### Copy To

Can be used to stream the results of the query into another table. This modifier works for any query type and will export each row of the result into the table provided. You can optionally pass in a second argument to mutate the selected rows before inserting them.

```typescript
// copy results of upsert
nSQL("posts").query("upsert", {...}).copyTo("postsLog").exec();

// get a section of rows from one table into another
nSQL("users").query("select")
.where(["status", "=", "banned"])
.copyTo("bannedUsers").exec();

// stream analytics
nSQL("orders").query("select", ["COUNT(*) AS totalOrders", "AVG(total) AS avgOrder"])
.where(["orderDate", ">", Date.now() - (24 * 60 * 60 * 1000)])
.copyTo("orderStats").exec();
```

## Advanced Select

### **Join**

The join command takes an object or array of objects as it's argument with 3 properties.

#### **Interface InanoSQLJoinArgs**

| Property | Type |  |
| :--- | :--- | :--- |
| with | Object | The right side table in the join. [Options](/query/select#with-graph-join-syntax.html) |
| type | String | The join type, accepts: `left`, `right`, `inner`, `outer`, and `cross`. |
| on | Any\[\] | Condition to join the tables on, not used if the join type is cross. |

Let's look at some examples

```typescript
nSQL("users").query("select")
.join({
   type: "left",
   with: {table: "orders"},
   on: ["users.id","=","orders.userID"]
}).exec();
```

When using `join` you must use table.column syntax through out the rest of the query, like this:

```typescript
nSQL("users").query("select", ["users.id", "users.name", "orders.date","orders.total"])
.join({
   type: "left",
   with: {table: "orders"},
   on: ["users.id","=","orders.userID"]
})
.where(["orders.total",">",200])
.orderBy(["orders.date ASC"])
.exec().then..
```

Multiple joins are possible, just use an array in the `.join()` method and pass in as many joins as you'd like.

Keep in mind join queries will use indexes where possible, so if you can reasonably use `on` conditions that check against primary key or secondary index values you'll see improved performance.

### **Graph**

The **graph** command takes an object or array of objects as it's argument with each object having 3 or more properties:

#### Interface InanoSQLGraphArgs

| Property | Required | Type |  |
| :--- | :--- | :--- | :--- |
| with | yes | Object | The table to graph against. [Options](/query/select.html#with-graph-join-syntax) |
| on | yes | Any\[\] | Condition to graph the rows against. |
| key | yes | String | The column name that the graphed rows will occupy. |
| limit | no | Number | Same as `.limit()` , for graph results. |
| offset | no | Number | Same as `.offset()`, for graph results. |
| orderBy | no | String\[\] | Same as `.orderBy()`, for graph results. |
| groupBy | no | String\[\] | Same as `.groupBy()` , for graph results. |
| select | no | String\[\] | Same as arguments for `select` query, for graph results. |
| graph | no | InanoSQLGraphArgs | Recursively nest graph queries, can also be an array of graph queries. |

Let's look at some examples.

```typescript
nSQL("users").query("select")
.graph({
   key: "userOrders",
   with: {table: "orders"},
   on: ["users.id","=","orders.userID"]
}).exec();
```

You can also use query modifiers to adjust the graph result set the same as you would any other nanoSQL query.

```typescript
nSQL("users").query("select")
.graph({
   key: "userOrders",
   with: {table: "orders"},
   on: ["users.id","=","orders.userID"],
   limit: 20,
   orderBy: ["total ASC"],
   groupBy: ["date ASC"],
   select: ["id", "AVG(total) AS averageTotal", "date"],
   graph: { // nested graph query
      key: "items",
      with: {table: "products"}
      on: ["products.id", "IN", "orders.productList"]
   }
}).exec();
```

It's also possible to have multiple graph queries simply by passing an array of graph objects into the `.graph()` method instead of just one object.

Keep in mind graph queries will use indexes where possible, so if you can reasonably use `on` conditions that check against primary key or secondary index values you'll see improved performance.

### **Group By**

`GroupBy` is used to combine rows with the same value into a single row, almost exclusively used with aggregate functions. It takes exactly the same arguments as `orderBy`.

If no aggregate functions are used in the query, `groupBy` has the same effect as `orderBy`.

Lets look at some examples:

```typescript
// Let's get the average salary of every department
nSQL("employees")
.query("select",["department","AVG(salary) AS averageSalary"])
.groupBy(["department ASC"])
.exec()..

// Or the average transaction cost for each day
nSQL("orders")
.query("select",["date","AVG(total) AS averageTotal"])
.groupBy(["date ASC"])
.exec()...

// Total number of transactions each day
nSQL("orders")
.query("select",["date","COUNT(*) AS numberOfTransactions"])
.groupBy(["date ASC"])
.exec()...
```

You can also use functions in group By arguments:

```typescript
nSQL("employees")
.query("select",["department","AVG(salary) AS averageSalary"])
.groupBy(["TRIM(department) ASC"])
.exec()..
```

### **Having**

`Having` follows exactly the same syntax as `where`, except it runs AFTER `groupBy` and `join`, allowing you to select based on results of a join and/or group by command. You typically won't use `having` unless you also have a `groupBy` or `join` command already in place, although this isn't a requirement.

First take a look at the `where` syntax [here](/query/select.html#selecting-rows-conditionally).

Here is a use case for `having`:

```typescript
nSQL("users")
.query("select",["eyeColor", "AVG(age) AS averageAge"])
.groupBy(["eyeColor ASC"])
.having(["averageAge",">",20])
.exec()...
```

### **As / Alias**

NanoSQL follows MySQL in the order of the `select` statement queries. Select arguments are applied in this order: 1. `Where` 2. `Join` 3. `Group By` 4. `AS` statements and functions applied. 5. `Having` 6. `OrderBy` 7. `Offset` & `Limit`

This means that when you use `.where()`, `.join()`, and `.groupBy()` you'll have to use the original column names and not the alias column name you provided.

For example:

```typescript
nSQL("users")
.query("select",["orders.userID AS ID", "users.name AS Customer", "COUNT(*) AS Orders", "SUM(orders.total) AS Total"])
.where([["users.balance", ">", 100], "OR",["users.age", ">", 45]])
.join({
    type:"left", 
    with: {table: "orders"},
    on: ["orders.userID","=","users.id"] 
})
.groupBy(["orders.userID ASC"])
// AS statements parsed here.
.having(["Total", ">", 100])
.orderBy(["Total DESC"])
.exec().then((rows) => {...})
```

And something without a join to make it simple:

```typescript
nSQL("users")
.query("select",["username AS name", "age AS howOld"])
.where(["age",">",20])
.groupBy(["age ASC"])
// AS statements parsed here.
.having(["howOld",">",20]) // This is technically redundant.
.orderBy(["name ASC"])
.exec().then...
```

### With \(Graph/Join Syntax\)

The WITH syntax is used with Graph and Join queries.  Using `with` you can join/graph temporary tables and internal tables with relative ease, or any combination of internal tables and temporary tables.

All examples are using `graph` queries but the syntax is identical for the `with` property in join queries.

Using an internal table:

```typescript
nSQL("users").query("select").graph([
    {
        key: "posts",
        with: {table: "posts"},
        on: ["posts.userId", "=", "users.id"]
    }
]).exec()
```

Using an internal table with an alias:

```typescript

nSQL("users").query("select").graph([
    {
        key: "posts",
        with: {
            table: "posts"
            as: "blogPosts"
        },
        on: ["blogPosts.userId", "=", "users.id"]
    }
]).exec()
```

Using a static array table \(must use alias\):

```typescript
nSQL("users").query("select").graph([
    {
        key: "posts",
        with: {
            table: [
                {title: "hello", userId: 1},
                {title: "world", userId: 2}
            ]
            as: "posts"
        },
        on: ["posts.userId", "=", "users.id"]
    }
]).exec()
```

Using a promise returned table \(must use alias\)

```typescript
nSQL("users").query("select").graph([
    {
        key: "posts",
        with: {
            table: () => fetch("https://jsonplaceholder.typicode.com/posts").then(d => d.json()).then(j => {
                // if you're returning a whole table, always pass "cache: true"
                return {rows: j, cache: true};
            })
            as: "posts"
        },
        on: ["posts.userId", "=", "users.id"]
    }
]).exec()
```

Using a promise to return filtered rows \(muse use alias\)

```typescript
nSQL("users").query("select").graph([
    {
        key: "posts",
        with: {
            table: (where) => {
                // "where" argument contains a converted where statement 
                // derived from the "on" property
                // for this example the `where` would be something like
                // ["userId", "=", 2]
                return new Promise((res, rej) {
                    return fetch(`http://example.com/posts?getByUserId=${where[2]}`).then(d => d.json()).then(d => {
                        return {
                            rows: d,
                            filtered: true // pass filtered if only the results of `where` were returned 
                        }
                    });
                });
            }
            as: "posts"
        },
        on: ["posts.userId", "=", "users.id"]
    }
]).exec()
```

## Aggregate Functions

Aggregate functions take a collection of rows and combine them into a single row with a resulting value.  

Aggregate functions can be used in combination with `groupBy` to get multiple aggregate values at once.  The `groupBy` arguments are used to determine what rows are merged together for the aggregate function.  Reading the [groupBy](/query/select.html#group-by) docs will help familiarize yourself with how aggregate functions work with `groupBy`.

### COUNT

Count is used to get the number of records that match the argument.  If the argument is "\*" every record is counted, if a column value is provided instead all rows that have a truthy value in that column are counted.

**Syntax**

```bash
COUNT(expression)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| expression | "\*" to count every record or column to check for truthy value. |

**Examples**

```typescript
// Get the total number of users in the database
nSQL("users").query("select", ["COUNT(*)"]).exec();

// Get the number of users with a balance
nSQL("users").query("select", ["COUNT(balance)"]).exec();

// Get the number of users for each account type
nSQL("users").query("select", ["type", "COUNT(*)"]).groupBy(["type ASC"]).exec();
```

### MAX & MIN

Min & Max functions are used to get the highest or lowest value in a given column on a table.  

**Syntax**

```bash
MAX(expression)
MIN(expression)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| expression | Column to compare values. |

**Examples**

```typescript
// Get the oldest user
nSQL("users").query("select", ["name", "MAX(age)"]).exec();

// Get the youngest user
nSQL("users").query("select", ["name", "MIN(age)"]).exec();

// Get the oldest user for each account type
nSQL("users").query("select", ["type", "MAX(age)"]).groupBy(["type ASC"]).exec();
```

### AVG

Avg function is used to average all the values on a given column together.

**Syntax**

```bash
AVG(expression)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| expression | Column to average values. |

**Examples**

```typescript
// Get the average age of all users
nSQL("users").query("select", ["AVG(age)"]).exec();

// Get the average age for each account type
nSQL("users").query("select", ["type", "AVG(age)"]).groupBy(["type ASC"]).exec();
```

### SUM

Sum function is used to add all the values on a given column together.

**Syntax**

```bash
SUM(expression)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| expression | Column to add values. |

**Examples**

```typescript
// Get the combined age of all users
nSQL("users").query("select", ["SUM(age)"]).exec();

// Get the combined age for each account type
nSQL("users").query("select", ["type", "SUM(age)"]).groupBy(["type ASC"]).exec();
```

## Simple Functions

Simple functions normally transform the value in a specific column to a desired value.  Unlike aggregate functions, simple functions will return a value for every single row that is queried.

### GREATEST & LEAST

Greatest and least functions are used to get the highest or lowest value inside the same row, can also be used to compare each row's value against a provided value.

Another way to think of Greatest & Least is it's like Min & Max but only compares a single row's values to each other instead of comparing all rows on a table.

**Syntax**

```bash
GREATEST(arg1, arg2, arg3, ....)
LEAST(arg1, arg2, arg3, ....)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| arg1, arg2, arg3, .... | Columns to compare values. |

**Examples**

```typescript
// returns 20 or the users age if it's higher
nSQL("users").query("select", ["name", "GREATEST(20, age)"]).exec();

// can also be used to compare one row value to another
nSQL("users").query("select", ["name", "GREATEST(balance, points)"]).exec();
```

### LOWER & UPPER

These functions take a row column and either uppercase or lowercase the provided column.

**Syntax**

```bash
UPPER(expression)
LOWER(expression)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| expression | Column to mutate. |

**Examples**

```typescript
// returns uppercase of every users's name
nSQL("users").query("select", ["UPPER(name)"]).exec();

// can also be used to make case insensative sorting.
nSQL("users").query("select", ["name"]).orderBy(["UPPER(name) ASC"]).exec();
```

### TRIM

This function takes a row column and removes trailing and leading whitespace.

**Syntax**

```bash
TRIM(expression)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| expression | Column to mutate. |

**Examples**

```typescript
// returns names without leading or trailing whitespace
nSQL("users").query("select", ["TRIM(name)"]).exec();
```

### IF

Evaluates an expression, if the expression is true the second argument is returned, otherwise the third argument is returned.

**Syntax**

```bash
IF(expression, trueArg, falseArg)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| expression | Expression to evaluate. |
| trueArg | Return this value if the expression is true. |
| falseArg | Return this value if the expression is false. |

**Examples**

```typescript
// returns 'name is bill' if the name is bill, otherwise 'not bill'
nSQL("users").query("select", ["IF(name='bill', 'name is bill', 'not bill')"]).exec();

// returns "positive balance" if balance is greater than 0, otherwise "negative balance".
nSQL("users").query("select", ["IF(balance>0, 'positive balance', 'negative balance')"]).exec();
```

### CAST

This function takes a column value and type, then mutates the column value to the provided type.

**Syntax**

```bash
CAST(column, type)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| column | Column to mutate. |
| type | nanoSQL type to mutate the column into. |

**Examples**

```typescript
// return body of comments converted to html special characters.
nSQL("comments").query("select", ["CAST(body, 'safestr')"]).exec();
```

### CONCAT

Works the same as String.join\(\) in javascript, merges multiple values into a single string.

**Syntax**

```bash
CONCAT(arg1, arg2, arg3, ....)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| arg1, arg2, arg3, .... | Columns to concatenate, can also pass in raw strings. |

**Examples**

```typescript
// Get users whole name
nSQL("users").query("select", ["CONCAT(firstName, ' ', lastName) AS name"]).exec()
```

### CONCAT\_WS

Works the same as String.join\(\) in javascript, merges multiple values into a single string.  Unlike `CONCAT`, you can pass in a custom value that is used to join the strings together.

**Syntax**

```bash
CONCAT_WS(expression, arg1, arg2, arg3, ....)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| expression | Value to put between each string |
| arg1, arg2, arg3, .... | Columns to concatenate, can also pass in raw strings. |

**Examples**

```typescript
// Get users whole name
nSQL("users").query("select", ["CONCAT_WS(' ', firstName, lastName) AS name"]).exec()
```

### REPLACE

Searches a provided string for a provided value and replaces it with a new value.

**Syntax**

```bash
REPLACE(subject, find, replace)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| subject | String or column to search. |
| find | String to find in subject |
| replace | String to replace when find value is in subject. |

**Examples**

```typescript
// find all users names bill and return their name as william.
nSQL("users").query("select", ["REPLACE(name, 'bill', 'william')"]).exec():
```

### STRCMP

Compares two strings together; returns 0 if strings match, -1 if first string is greater than second string and1 otherwise.

**Syntax**

```bash
STRCMP(subject1, subject2)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| subject1 | String or column to use for comparison. |
| subject2 | String or column to use for comparison. |

**Examples**

```typescript
// sort all user's name against 'bill'.
nSQL("users").query("select").orderBy(["STRCMP(name, 'bill') ASC"]).exec():
```

### CROW

Get the distance between rows and a given GPS coordinate using the  Haversine formula.

Default distance is in km, update the `nSQL().planetRadius` value to get results in another size.

**Syntax**

```bash
CROW(column, latitude, longitude)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| column | Row column to get GPS points.  Column must be an object with `lat` and `lon` properties. |
| latitude | Latitude of center point. |
| longitude | Longitude of center point. |

**Examples**

```typescript
// sort rows by distance from point
nSQL("users").query("select").orderBy(["CROW(address, 16.83268871, -75.94151676) DESC"]).exec();

// get rows within radius of point
nSQL("users").query("select").where(["CROW(address, 16.83268871, -75.94151676)", "<", 4]).exec();
```

### LEVENSHTEIN

Finds the [edit distance](https://en.wikipedia.org/wiki/Levenshtein_distance) between two strings.

**Syntax**

```bash
LEVENSHTEIN(expression1, expression2)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| expression1 | First word or column to use Levenshtein formula. |
| expression2 | Second word or column to use in Levenshtein formula. |

**Examples**

```typescript
// Get the edit distance against "jeb" for all users names
nSQL("users").query("select", ["LEVENSHTEIN('jeb', firstName)"]).exec()

// Get all users who's name is within an edit distance of 3 of "jeb"
nSQL("users").query("select").where(["LEVENSHTEIN('jeb', firstName)", "<", 3]).exec()
```

### ADD

Add multiple values/columns together

**Syntax**

```bash
ADD(arg1, arg2, arg3, ...)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| arg1, arg2, arg3, ... | Columns or numbers to add together |

**Examples**

```bash
// Get the age + 30 of all users
nSQL("users").query("select", ["ADD(age, 30)"]).exec()

// Add age, 30 and balance
nSQL("users").query("select", ["ADD(age, 30, balance)"]).exec()
```

### SUB

Subtract multiple values/columns together

**Syntax**

```bash
SUB(arg1, arg2, arg3, ...)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| arg1, arg2, arg3, ... | Columns or numbers to add together |

**Examples**

```bash
// Get the age - 30 of all users
nSQL("users").query("select", ["SUB(age, 30)"]).exec()

// Subtract age, 30 and balance
nSQL("users").query("select", ["SUB(age, 30, balance)"]).exec()
```

### DIV

Divide values and/or columns.

**Syntax**

```bash
DIV(arg1, arg2)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| arg1 | Column or number for the left or top of the division |
| arg2 | Column or number for the right or bottom of the division |

**Examples**

```bash
// Devide all balances by 100: balance / 100
nSQL("users").query("select", ["DIV(balance, 100)"]).exec()
```

### MULT

Multiply values or columns together

**Syntax**

```bash
MULT(arg1, arg2, arg3, ...)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| arg1, arg2, arg3, ... | Columns or numbers to add together |

**Examples**

```bash
// Multiply all user's age by 30
nSQL("users").query("select", ["MULT(age, 30)"]).exec()

// Multiply age, 30 and balance
nSQL("users").query("select", ["MULT(age, 30, balance)"]).exec()
```

### MOD

Get the modulus of two numbers.

**Syntax**

```bash
MOD(arg1, arg2)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| arg1 | The larger number to get the remainder from |
| arg2 | The remainder/devide value |

**Examples**

```bash
// Get the modulus of 30 and the user's age.
nSQL("users").query("select", ["MOD(30, age)"]).exec()

// Get the modulus of the user's balance and 20.
nSQL("users").query("select", ["MOD(balance, 20)"]).exec()
```

### TRUNCATE

Get a number reduced to the provided number of decimals

**Syntax**

```bash
TRUNCATE(arg1, arg2)
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| arg1 | The number to truncate. |
| arg2 | The number of decimal places to truncate to. |

**Examples**

```bash
// Get the balance truncated to 0 decimal places
nSQL("users").query("select", ["TRUNCATE(balance, 0)"]).exec()
```

### Math

All javascript Math functions that are a property of the global `Math` object are supported:

Supported By IE9+: \(These math functions are safe in almost any environment\)

ABS, ACOS, ASIN, ATAN, ATAN2, CEIL, COS, EXP, FLOOR, LOG, MAX, MIN, POW, RANDOM, ROUND, SIN, SQRT, TAN

Supported By ES6: \(These functions require a newer environment\)

ACOSH, ASINH, ATANH, CBRT, EXPM1, CLZ32, COSH, FROUND, HYPOT, IMUL, LOG1P, LOG2, LOG10, SIGN, SINH, TANH, TRUNC, E, LN10, LN2, LOG10E, LOG2E, PI, SQRT1\_2, SQRT2

> Internally nanoSQL uses Object.getOwnPropertyNames\(Math\) to generate all the math functions, which means the javascript environment must support the math function you're attempting to use, which might not always be the case.  If you're using a more obscure or new ES6 math function it might be a good idea to implement it as a [custom function](/query/query-function-api.html).

The [Mozilla Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math) on the Math function are a good place to see how the math functions are used.

**Syntax**

```bash
ABS(arg1, arg2, arg3, ....)
SQRT(arg1, arg2, arg3, ....)
ASIN(arg1, arg2, arg3, ....)
...
```

**Parameter Values**

| **Parameters** | Description |
| :--- | :--- |
| arg1, arg2, arg3, .... | Arguments to pass to math function.  Can be raw number or column. |

**Examples**

```typescript
// Get absolute value of every balance
nSQL("users").query("select", ["ABS(balance)"]).exec()

// Get square value of users age
nSQL("users").query("select", ["POW(age, 2)"].exec();
```