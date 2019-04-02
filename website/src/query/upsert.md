# Upsert

Upserts accept only one argument, it's an object containing the data to insert into the database or an array of objects to insert. If the primary key of the data is provided then either the data in that place of the database will be replaced with the new data or the new data will simply be inserted. If no primary key is provided, a new one will be generated if the primary key is of type `uuid`, `int` with auto increment or `timeId`, `timeIdms`. If you use any other type as a primary key, you must provide it inside the object being upserted.

Finally, you can use a `where` statement with upserts to modify multiple rows based on the condition provided. Using `where` will never insert new rows, only modify existing ones.  If you use `where` you cannot use an array to insert multiple records at once.

Some examples:

```typescript
// Add multiple new rows
nSQL("users")
.query("upsert",[{name:"billy",age:50}, {name: "jeb", age: 30}])
.exec().then..

//Set all accounts with a balance less than zero to closed.
nSQL("accounts")
.query("upsert",{status:"closed"})
.where(["balance","<",0])
.exec().then...

// Assuming the primary key is id, set the data in row 5 to the provided data
nSQL("users")
.query("upsert",{id:5, name:"billy", age:50})
.exec().then..

// Nested upsert
nSQL("users.age").query("upsert", 50).where(["name", "=", "billy"]).exec()..
```

### Upserting A Large Number Of Records

In some cases you may want to modify or add thousands of records.  In this case it's a good idea to use the `.stream()` api.  With the normal `.exec()` the modified/added rows are stored in memory and returned with the result.  This can be a problem if you are modifying more rows than you have memory for, so the stream api solves this by not storing the rows in memory.  It's easy to use instead of `.exec()`, just replace `.exec()` with `.stream()` and add a few callbacks:

```typescript
nSQL("accounts")
.query("upsert",{status:"closed"})
.where(["balance","<",0])
.stream((row) => {
    // on row update
}, () => {
    // all updates/inserts done
}, (err) => {
    // query encountered error
})
```
