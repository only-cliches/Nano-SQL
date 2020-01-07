## Query API

```ts


// start query (select table)
db.table.main
// or
db.table.session
// ...
 
// pick one
.get(["{{row.key}}", "=", "FACE"])
.get(["{{row.main.indexedColumn}}", "BETWEEN", ["lower", "higher"]])
/*
.get() // get all
.get({ // get =
    "=": "key",
    "IN": ["multiple", "keys"]
})
.getRange({
    "PREFIX": "pref%",
    ">": "higher", 
    "<": "lower", 
    ">=": ..., 
    "<=": ...
})
.getInList({ // only works for array indexes
    "INCLUDES PREFIX": "pref%",
    "INCLUDES": "value",
    "INTERSECT": ["intersect", "values"],
    "INCLUDES LIKE": "value%",
    "INTERSECT ALL": ["intersect", "values"],
})
.getGeo({ 
    lat: ...
    lon: ...
    range: 20
})
.getSearch({
    phrase: "something here",
    relevance: 20
})
.getTotal()*/
.getIntersect((table) => [ // AND
    table.getList(...).limit(50).filter(...).graph(...).do("select"),
    table.getGeo(...).do("select")
]) 
.getUnion((table) => [ // OR
    table.getList(...).do("select"),
    table.getGeo(...).do("select")
    table.getIntersect((table) => [ // Nested AND
        table.getList(...).do("select"),
        table.getGeo(...).do("select")
    ]).do("select")
]) 

// arguments
.reverse()
.limit(50)
.filter(["{{row.value}}", "=", "something"]) // slow, do not use!
.graph([
    {
        key: "posts",
        query: db.author.main.get(["{{row.author}}", "=", "{{posts.key}}"]).do("select")
    }
])

// do what? (pick one)
.do("select", ["{{row.session}}", "arguments"])
.do("upsert", {key: value})
.do("delete");
.do("drop");

// quick example
db.users.get(["{{row.key}}", "=", "scott"]).do("select");
// SELECT * FROM users WHERE id = "scott";

db.users.do("upsert", {key: value});
``` 

## Transactions

```ts
db.batch([
    db.table.do("upsert", {key: value}),
    db.table.get({"=": "scott"}).do("delete")
])
```

## config.js
Server configuration script:

```ts
module.exports = (db) => {

    // base level configuration
    db.config({
        port: 80,
        host: "localhost",
        dbPath: "/db" // what URL path does the db files live at?
    })

    // create database
    db.createOrReplaceDatabase({
        out: { // save typings where?
            dir: "./dir/to/put/ts/files",
            type: "js" | "ts"
        },
        name: "databaseName",
        secretKey: "somethingcrazylongandsecure",
        appURL: "http://localhost:3000",
        session: { // session options (WIP)
            update: 60, // how often should the session be refreshed? (session refresh is expensive)
            timeout: 24 * 60 * 60, // how long should each session be active for?
        },
        peers: { // sync with other database servers (WIP)

        },
        channels: { // pub/sub channels (only needed to declare here if AUTH is used)
            anything: { // specific channel
                auth: (token, channelName) => { // slow
                    return token.userType == "admin";
                },
                auth: [ // fast
                    ["{{token.userType}}", "=", "admin"]
                ]
            },
            "*": { // all channels
                auth: (token, channelName) => {

                }
            }
        },
        jobs: [ // WIP Job Queue
            {
                name: "send-emails",
                call: () => {

                },
            }
        ]
    })


    // NEW API
    db.createOrReplaceTable({
        database: "databaseName",
        name: "users", 
        onConflict: "lww", // last write wins
        onConflict: (oldData, newData, userToken): boolean => { // function for conflicts

        },
        key: "uuid", // or timeId
        model: [
            main:  [
                ["username", "string",         {i: 0, immutable: true, index: {case_sensitive: false, unique: true}}],
                ["email",    "string",         {i: 1, index: {case_sensitive: false, unique: true}}],
                ["pass",     "hash(script)",   {i: 2, default: "", hidden: true}], // column doesn't return on select statements
                ["tags",     "string[]",       {i: 3, index: {}}],
                ["age",      "int",            {i: 4, max: 130, min: 13, default: 0, notNull: true}],
                ["type",     "enum",           {i: 5, elements: [ 
                    "admin", "user", "none"
                ]}],
                ["meta",     "map(string, string)", {i: 6}],
                ["nestedTable", "table",      {i: 7, model: [
                    ["value", "string", {i: 0}]
                ]}].
                ["data",     "bytes", {i: 8}]
            ],
            address: [
                ["street",   "string", {i: 0}],
                ["street2",  "string", {i: 1}],
                ["city",     "string", {i: 2}],
                ["state",    "string", {i: 3}],
                ["zip",      "string", {i: 4}],
                ["country",  "string", {i: 5}]
            ],
            session: [
                ["last_login", "date", {i: 0}],
                ["blacklist_sessions", "uuid[]", {i: 1}],
                ["login_count", "count", {i: 2}] // "count" is special distributed count type
            ]
        ],
        hooks: [ // hooks change/update tokens, actions/views do not
            {
                name: "login", // POST URL/databaseName/users/hooks/login
                args: [
                    ["login", "string"],
                    ["pass", "string"]
                ],
                auth: true // no auth
                call: async (args, token) => {
                    const matchedAccounts = await db.users.getUnion([
                        db.users.main.get(["{{row.username}}", "=", args.login]),
                        db.users.main.get(["{{row.email}}", "=", args.login])
                    ]);
                    if (!matchedAccounts.length) return false;

                    const passwordCheck = await db.checkPassword(matchedAccounts[0].main.pass, args.pass);
                    if (passwordCheck) {
                        token.set("loggedIn", true);
                        return true;
                    }
                    return false;
                }
                call: "/appEndpoint"
            },
            {
                name: "logout",
                args: [],
                auth: true,
                call: async (args, token) => {
                    token.clear();
                    return true;
                }
            }
        ],
        onRow: { // optional
            select: (token, row) => { // slow
                row.age += 20;
                return row;

                return false; // stop select 
            },
            upsert: (token, row) => { // slow
                if (row.value !== "error") return false; // do not insert this row
                return row;

                return false; // stop upsert
            }, 
            delete: (token, row) => {

                return false; // do not delete any rows
            },
            delete: eventArray
        },
        denormalize: [ // optional, updates other 
            {
                name: "posts",
                scope: ["main", "sessions"], // only run on specific table models (optional)
                query: db.posts.author.get(["{{child.authorID}}", "=", "{{parent.key}}"]).do("select"), // get child rows
                onUpsert: (parentRow, childRow) => {
                    return childRow; // modify child row

                    return false; // delete child row
                },
                /* (might do this later depending on javascript benchmarks)
                onUpsert: [ // eventArray
                    {do: "copy", from: "{{parent.email}}", to: "{{child.authorEmail}}"},
                    {do: "ifelse", if: [...condition], then: [
                        ...eventArray
                    ], else: [
                        ...eventArray
                    ]},
                    {do: "switch", value: "{{parent.level}}" case: {
                        "1": [...eventArray],
                        "2": [...eventArray],
                        "default": [...eventArray]
                    }}
                ],
                */
                onDelete: (parentRow, childRow) => {

                    return childRow; // modify child row

                    return false; // delete child row
                },
                /*
                onDelete: [
                    {do: "copy", from: "NULL", to: "{{child.authorEmail}}"}
                ]*/
                onDelete: false // just delete child rows on delete
            }
        ],
        mapReduce: [ // optional
            {
                name: "Session Analytics (Hourly)",
                table: "userUpdates", // push to what table
                scope: ["main", "sessions"], // only run on specific models
                condition: ["{{row.main.type}}", "=", "something specific"], // conditionally only run if this is true
                start: {date: 0, count: 0}, // starting value
                rowKey: (userToken, row) => {
                    var start = new Date();
                    start.setHours(0,0,0,0);
                    return start.getTime();
                },
                onUpdate: (userToken, prev, row) => {
                    prev.count++;
                    return prev;
                }
            }
        ],
        sync: [
            {
                name: "userPosts",
                read: {
                    auth: true, // no auth
                    call: (table) => table.main.get(["{{row.main.authorID}}", "=", "{{token.userID}}"]).do("select") // get these rows only
                    call: (table, token) => { // slow
                        return table.main.get(["{{row.main.authorID}}", "=", "{{token.userID}}"]).do("select");
                    }
                },
                write: {
                    auth: [ // fast
                        [`{{token.userid}}`, "=", `{{row.main.authorID}}`],
                        "OR",
                        [`{{token.superAdmin}}`, "=", true]
                    ],
                    auth: (table, token, rowData) => { // slow
                        return true; 
                    },
                    call: (table, token, rowData) => { // optional, lets you mutate or deny row updates
                        return rowData;
                    },
                    onConflict: (table, token, oldRow, newRow) => { // handle conflicts for this sync

                        return newRow // use new row;
                        
                        return oldRow // use old row;

                        return someMutatedRow; // use this instead

                        return false; // reject update
                    }
                }

            }
        ],
        actions: [ // optional
            {
                name: "updateEmail", // POST URL/databaseName/users/actions/updateEmail
                args: [
                    ["id", "uuid", {}],
                    ["email", "string", {}]
                ],
                auth: "/appEndpoint", // very slow
                auth: (token, args) => { // kinda slow
                    return token.userid === args.id;
                },
                auth: (table) => table.main.get(["{{row.main.userID}}", "=", "{{token.id}}"]).do("select"), // if a row is returned, auth passes.  False otherwise
                auth: [ // fast
                    [`{{token.userid}}`, "=", `{{args.id}}`]
                ],
                call: (table) => table.main.get(["{{row.key}}", "=", "{{args.id}}"]).do("update", {email: "{{args.email}}"}) // fast
                call: async (table, token, args) => { // slow
                    const results = await table.main.get([args.id, "=", "{{row.key}}"]).do("update", {email: args.email});
                    return results;
                }
                /*query: [ // eventArray
                    {do: "export", key: "update", query: (table) => table.get({"=": `{{args.id}}`}).do("upsert", {email: `{{args.email}}`})},
                ]*/
            }
        ],
        views: // same as views, except just reads data
    })
}

```