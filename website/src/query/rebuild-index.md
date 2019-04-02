# Rebuild Index

Used to rebuild secondary indexes, this query type takes no arguments. You use a `where` statement to select the rows you'd like to rebuild. If no `where` statement is provided then all the rows on the selected table are rebuilt.

Let's look at some examples:

```typescript
// Rebuild indexes for users who age is greather than 50
nSQL("users").query("rebuild indexes").where(["age",">",50]).exec()...​

// Rebuild all row indexes on users table
nSQL("users").query("rebuild indexes").exec()...
```

​

### Rebuilding A Large Number Of Records <a id="upserting-a-large-number-of-records"></a>

In some cases you may want to rebuild thousands of records. In this case it's a good idea to use the `.stream()` api. With the normal `.exec()` the rebuilt rows are stored in memory and returned with the result. This can be a problem if you are rebuilding more rows than you have memory for, so the stream api solves this by not storing the rows in memory. It's easy to use instead of `.exec()`, just replace `.exec()` with `.stream()` and add a few callbacks:

```typescript
nSQL("users").query("rebuild indexes").stream((row) => {    
    // row rebuilt
}, () => {    
    // query finished
}, (err) => {    
    // query error
});
```
