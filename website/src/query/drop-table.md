# Drop Table

Drop accepts no arguments, it completely removes all rows from the table and removes the table and it's indexes from the database.  After a drop is performed you won't be able to use the table again unless you use the `create table` query to make it.

```typescript
// Drop the users table
nSQL("users").query("drop").exec()...
```
