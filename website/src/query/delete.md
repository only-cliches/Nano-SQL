# Delete

Delete takes no arguments. You use a `where` statement to find the rows you want to modify. If no `where` statement is provided the entire table is deleted.

Let's look at some examples:

```typescript
// Remove all users who are older than 50
nSQL("users").query("delete").where(["age",">",50]).exec()...

// Remove all rows from 'users' table
nSQL("users").query("delete").exec()...
```



### Deleting A Large Number Of Records <a id="upserting-a-large-number-of-records"></a>

In some cases you may want to remove thousands of records. In this case it's a good idea to use the `.stream()` api. With the normal `.exec()` the removed rows are stored in memory and returned with the result. This can be a problem if you are removing more rows than you have memory for, so the stream api solves this by not storing the rows in memory. It's easy to use instead of `.exec()`, just replace `.exec()` with `.stream()` and add a few callbacks:

```typescript
nSQL("users").query("delete").where(["age",">",50]).stream((row) => {
    // row deleted
}, () => {
    // query finished
}, (err) => {
    // query error
})
```
