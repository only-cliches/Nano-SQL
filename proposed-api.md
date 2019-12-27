## Query API

```ts


// start query (select table)
db.table
// or
db.table.index
 
// pick one
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
.getTotal()
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
.filter(["{{row.id}}", "=", "something"]) // slow, do not use!
.graph([
    {
        key: "posts",
        query: db.posts.author.get({"=": "{{row.id}}"}).do("select")
    }
])

// do what? (pick one)
.do("select", ["select", "arguments"])
.do("upsert", {key: value})
.do("delete");
.do("drop");

// quick example
db.users.get({"=": "scott"}).do("select");
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
        dbPath: "/db" // what URL path does the db live at?
    })

    // create database
    db.createOrReplaceDatabase({
        name: "databaseName",
        secretKey: "somethingcrazylongandsecure",
        appURL: "http://localhost:3000",
        usersTable: "users",
        session: { // session options (WIP)
            update: 60, // how often should the session be refreshed? (session refresh is expensive)
            timeout: 24 * 60 * 60, // how long should each session be active for?
        },
        peers: { // sync with other database servers (WIP)

        },
        hooks: {
            logout: "/appEndpoint", // POST URL/databaseName/hooks/logout
            login: [ // fast POST URL/databaseName/hooks/login
                {do: "copy", from: "{{user.email}}", to: "{{token.email}}"},
                {do: "query", query: db.otherTable.do("upsert", {time: "{{time()}}", userId: "{{user.id}}"})}
                {do: "filter", callback: "/appEndpoint", callback: (token, userData) => token}, // waits to complete
                {do: "event", condition: ["{{user.id}}", "=", "something"], callback: "/appEndpoint", callback: (token, userData) => token} // doesn't wait
            ],
            changePerms: { // call with something like POST URL/databaseName/hooks/changePerms
                auth: (token, user, args) => { // slow
                    return token.userType == "admin";
                },
                auth: [ // fast
                    ["{{token.userType}}", "=", "admin"]
                ],
                actions: [ // fast
                    {do: "copy", from: "{{args.level}}", to: "{{token.level}}"}
                ]
            },
            anyOtherEndPoint: "/redirect-here"
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

    // Create Table
    db.createOrReplaceTable({
        database: "databaseName",
        name: "users",
        type:"lww", // last write wins
        model: {
            "id:uuid": {pk: true}, 
            "username:string": {immutable: true, login: true},
            "email:string": {login: true},
            "pass:string": {default: "", hidden: true, pass: "scrypt"},
            "tags:string[]": {},
            "age:int": {max: 130, min: 13, default: 0, notNull: true},
        },
        hooks: { // nested token updates that are scoped to this table, only affects token.users
            changePerms: ... // POST URL/databaseName/users/hooks/changePerms
        },
        channels: { // pub/sub channels (only needed to declare here if AUTH is used)
            anything: {
                auth: (token) => { // slow
                    return token.userType == "admin";
                },
                auth: [ // fast
                    ["{{token.userType}}", "=", "admin"]
                ]
            }
        },
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
        indexes: [ // optional
            {name: "email", columns: ["email"], caseSensative: false, unique: true}
        ],
        denormalize: [ // optional
            {
                name: "posts",
                query: db.posts.author.get({"=": "{{row.id}}"}).do("select"),
                onUpsert: (parentRow, childRow) => {
                    return childRow; // modify child row

                    return false; // delete child row
                },
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
                onDelete: (parentRow, childRow) => {

                    return childRow; // modify child row

                    return false; // delete child row
                },
                onDelete: [
                    {do: "copy", from: "NULL", to: "{{child.authorEmail}}"}
                ]
                onDelete: false // just delete child rows on delete
            }
        ],
        mapReduce: [ // optional
            {
                table: "userUpdates",
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
        sync: { // optional
            read: {
                auth: true,
                query: (table) => table.authorId.get({"=": "{{token.userID}}"}).do("select"), // only livestream these rows
                actions: [
                    {do: "query", query: db.changesTable.do("upsert", {time: `{{time()}}`, who: "{{token.userID}}", what: "{{event.type}}"}))},
                    {do: "event", condition: ["{{user.id}}", "=", "something"], callback: "/appEndpoint", callback: (token, userData) => token}
                ]
            },
            write: {
                auth: [
                    [`{{token.userid}}`, "=", `{{row.id}}`],
                    "OR",
                    [`{{token.superAdmin}}`, "=", true]
                ],
                actions: [
                    {do: "query", query: db.changesTable.do("upsert", {time: `{{time()}}`, who: "{{token.userID}}", what: "{{event.type}}"}))},
                    {do: "event", condition: ["{{user.id}}", "=", "something"], callback: "/appEndpoint", callback: (token, userData) => token}
                ]
            }
        },
        actions: [ // optional
            {
                name: "updateEmail", // POST URL/databaseName/users/actions/updateEmail
                args: {
                    "id:uuid": {},
                    "email:string": {}
                },
                auth: "/appEndpoint", // very slow
                auth: (token, args) => { // kinda slow
                    return token.userid === args.id;
                },
                auth: [ // fast
                    [`{{token.userid}}`, "=", `{{args.id}}`]
                ],
                query: (table) => table.get({"=": `{{args.id}}`}).do("upsert", {email: `{{args.email}}`}),
                query: { // nested call
                    email: (table) => table.get({"=": `{{args.id}}`}).do("upsert", {email: `{{args.email}}`})
                }
                before: eventArray
                onRow: eventArray
                after: eventArray
            }
        ],
        views: // same as views, except just reads data
    })
}

```