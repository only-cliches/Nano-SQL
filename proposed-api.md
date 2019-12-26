## Query API

```ts


// start query (select table)
db.table
// or
db.table.index
// or
db.table.analyticsTable
// or
db.table.analyticsTable.index
 
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
.filter(["{{row.id}}", "=", "something"]) // slow
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

    // create database
    db.createDatabase({
        name: "databaseName",
        secretKey: "somethingcrazylongandsecure",
        appURL: "http://localhost:3000",
        usersTable: "users",
        hooks: {
            logout: "/appEndpoint", // POST URL/databaseName/hooks/logout
            login: "/appEndpoint", // slowest
            login: (token, userData) => { // slow 
                token.email = userData.email;
                return token;
            },
            login: [ // fast POST URL/databaseName/hooks/login
                {do: "copy", from: "{{user.email}}", to: "{{token.email}}"}
            ],
            changePerms: { // call with something like POST URL/databaseName/hooks/changePerms
                auth: (token, user, args) => { // slow
                    return token.userType == "admin";
                },
                auth: [ // fast
                    ["{{token.userType}}", "=", "admin"]
                ],
                update: (token, user, args) => { // slow
                    token.level = args.level;
                    return token;
                },
                update: [ // fast
                    {do: "copy", from: "{{args.level}}", to: "{{token.level}}"}
                ]
            },
            anyOtherEndPoint: "/redirect-here"
        },
        channels: { // pub/sub channels
            anything: {
                auth: (token) => { // slow
                    return token.userType == "admin";
                },
                auth: [ // fast
                    ["{{token.userType}}", "=", "admin"]
                ]
            }
        },
        jobs: [
            {
                name: "send-emails",
                call: () => {

                },
            }
        ]
    })

    // Create Table
    db.createTable({
        database: "databaseName",
        name: "users",
        type:"lww", // last write wins
        model: {
            "id:uuid": {pk: true}, 
            "name:string": {immutable: true},
            "email:string": {},
            "pass:string": {default: "", hidden: true},
            "tags:string[]": {},
            "age:int": {max: 130, min: 13, default: 0, notNull: tru e},
        },
        filters: { // optional
            select: (token, row) => {
                row.age += 20;
                return row;

                return false; // stop select 
            },
            upsert: (token, row) => {
                if (row.value !== "error") return false; // do not insert this row
                return row;

                return false; // stop upsert
            }, 
            delete: (token, row) => {

                return false; // do not delete any rows
            },
            delete:"/appEndpoint"
        }, 
        indexes: [ // optional
            {name: "email", columns: ["email"], caseSensative: false, unique: true}
        ],
        denormalize: [ // optional
            {
                name: "posts",
                query: db.posts.get({"=": "{{row.id}}"}).do("select"),
                onUpsert: (parentRow, childRow) => {
                    return childRow; // modify child row

                    return false; // delete child row
                },
                onUpsert: [
                    {do: "copy", from: "{{parent.email}}", to: "{{child.authorEmail}}"}
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
        analytics: [ // optional
            {
                name: "updates",
                model: {
                    "date:int": {pk: true},
                    "count:int": {}
                },
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
            liveStream: "/appEndpoint",
            liveStream: false; // no one can!
            liveSync: "/appEndpoint",
            liveSync: [
                    [`{{token.userid}}`, "=", `{{row.id}}`],
                    "OR",
                    [`{{token.superAdmin}}`, "=", true]
                ]
            }
        },
        actions: [ // optional
            {
                name: "updateEmail",
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
                call: [ // array of queries to execute in parallel
                    db.users.get({"=": `{{args.id}}`}).do("upsert", {email: `{{args.email}}`})
                ],
                before: "/appEndpoint", // optional
                onRow: "/appEndpoint",
                after: "/appEndpoint" // optional
            }
        ],
        views: // same as views, except just reads data
    })
}

```