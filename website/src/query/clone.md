# Clone

Clone is used to copy entire tables and their indexes from the current database adapter into a new one.  Useful for transferring from one adapter to another, or for backups. Takes one argument with several properties:

| Property | Required | Type |  |
| :--- | :--- | :--- | :--- |
| mode | yes | string \| InanoSQLAdapter | A valid nanoSQL adapter or mode argument.  Everything that works for `mode` in the `connect()` object works here. |
| id | no | string | The id to use for the database in the adapter we are cloning to.  If no id is provided the one in the source database will be used. |
| getAdapter | no | \(adapter: InanoSQLAdapter\) =&gt; void | After the clone the adapter being cloned into is disconnected, if you instead need access to the raw adapter after the clone pass this argument in. |

Let's look at some examples:

```typescript
// clone users table and indexes into SyncStorage adapter.
nSQL("users").query("clone", {
    mode: new SyncStorage() // or any nanoSQL adapter
}).exec().then(() => {
    // clone table done
})

// clone all current tables and indexes into SyncStorage adapter.
nSQL("*").query("clone", {
    mode: new SyncStorage() // or any nanoSQL adapter
}).exec().then(() => {
    // clone done
})
```



### Cloning A Large Number Of Records <a id="upserting-a-large-number-of-records"></a>

In some cases you may want to clone thousands of records. In this case it's a good idea to use the `.stream()` api. With the normal `.exec()` the removed rows are stored in memory and returned with the result. This can be a problem if you are cloning more rows than you have memory for, so the stream api solves this by not storing the rows in memory. It's easy to use instead of `.exec()`, just replace `.exec()` with `.stream()` and add a few callbacks:

```typescript
nSQL("*").query("clone", {
    mode: new SyncStorage();
}).stream((row) => {
    // row deleted
}, () => {
    // query finished
}, (err) => {
    // query error
})
```
