# Conform Rows

Unlike standard RDBMS systems like MySQL, when you change the data model in nanoSQL all of the existing rows aren't affected in any way.  This can lead to problems if the new data model is substantially different than the old one or you expect particular default values that you've added to the data model afterwards.

The conform rows query can be used to mutate and conform all of the existing rows in the database to a new data model.  The query accepts one optional argument, a function to filter the old rows into new values.  NanoSQL will automatically type cast, remove and add columns as needed, filing in default values if the row's current column value is undefined.  You can use the optional function to make further adjustments if needed.

You can optionally use a `where` statement to select the rows you'd like to conform. If no `where` statement is provided then all the rows on the selected table are conformed.

Conforming the rows also rebuilds the indexes.

Let's look at some examples:

```typescript
// Conform rows for users who age is greather than 50
nSQL("users").query("conform rows").where(["age",">",50]).exec()...​

// Conform all rows on users table with a filter function.
nSQL("users").query("conform rows", (oldRow) => {
    return {
        ...oldRow,
        newCol: "val"
    }
}).exec()...
```

​

### Conforming A Large Number Of Records

In some cases you may want to conform thousands of records. In this case it's a good idea to use the `.stream()` api. With the normal `.exec()` the rebuilt rows are stored in memory and returned with the result. This can be a problem if you are conforming more rows than you have memory for, so the stream api solves this by not storing the rows in memory. It's easy to use instead of `.exec()`, just replace `.exec()` with `.stream()` and add a few callbacks:

```typescript
nSQL("users").query("conform rows").stream((row) => {    
    // row conformed
}, () => {    
    // query finished
}, (err) => {    
    // query error
});
```
