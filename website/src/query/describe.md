# Describe

Describe is used to show the data model or indexes for the selected database.  The query accepts no arguments and shows the data model for the selected table.

```typescript
// describe "users" table
nSQL("users").query("describe").exec().then((rows) => {
    console.log(rows)
    /*
        [
            {key: "id", type: "int", pk: true, ai: true},
            {key: "name", type: "string", default: "none"},
            {key: "age", type: "int"},
            {key: "postIds", type: "int[]"},
            {key: "meta", type: "obj" model: [
                {key: "key", type: "string"}
                {key: "value", type: "string"}
            ]}
        ]
    */
});

// describe "users" table indexes
nSQL("users").query("describe indexes").exec().then((rows) => {
    console.log(rows)
    /*
        [
            {id: "age", type: "int", isArray: false, path: ["age"], props: {}}
        ]
    */
});
```




