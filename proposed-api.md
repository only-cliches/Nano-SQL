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
    ">": "higher", 
    "<": "lower", 
    ">=": ..., 
    "<=": ...
})
.getInList({ // only works for array indexes
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
    table.getList(...).limit(50).filter(...).graph(...),
    table.getGeo(...)
]) 
.getUnion((table) => [ // OR
    table.getList(...),
    table.getGeo(...)
    table.getIntersect((table) => [ // Nested AND
        table.getList(...),
        table.getGeo(...)
    ])
]) 

// arguments
.reverse()
.limit(50)
.filter(["{{row.id}}", "=", "something"]) // slow af
.graph([
    {
        key: "posts",
        query: db.query("posts.author").get({"=": "{{row.id}}"}).exec("select")
    }
])

// do what? (pick one)
.exec("select", ["select", "arguments"])
.exec("upsert", {key: value})
.exec("delete");
.exec("drop");

// quick example
db.users.get({"=": "scott"}).exec("select");
// SELECT * FROM users WHERE id = "scott";

db.users.exec("upsert", {key: value});
``` 

## Transactions

```ts
db.batch([
    db.table.exec("upsert", {key: value}),
    db.table.get({"=": "scott"}).exec("delete")
])
```

## Create Database

```ts
db.createDatabase({
    name: "databaseName",
    secretKey: "somethingcrazylongandsecure",
    appURL: "http://localhost:3000",
    userTable: "users",
    hooks: {
        logout: "/appEndpoint",
        login: "/appEndpoint", // slowest
        login: (token, userData) => { // slow
            token.email = userData.email;
            return token;
        },
        login: [ // fast
            // action, user column, token column
            ["copy", "{{user.email}}", "{{token.email}}"]
        ],
        changePerms: { // call with something like GET databaseURL/databaseName/auth/changePerms
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
                ["copy", "{{args.level}}", "{{token.level}}"]
            ]
        },
        anyOtherEndPoint: "/redirect-here"
    },
    jobs: [
        {
            name: "send-emails",
            call: () => {

            },
        }
    ]
})

```

## Create Table 

```ts
db.createTable({
    database: "databaseName",
    name: "users",
    type:"lww", // last write wins
    model: {
        "id:uuid": {pk: true}, 
        "name:string": {},
        "email:string": {},
        "pass:string": {default: ""},
        "tags:string[]": {},
        "age:int": {max: 130, min: 13, default: 0, notNull: true},
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
            query: db.posts.get({"=": "{{row.id}}"}).exec("select"),
            onUpsert: (parentRow, childRow) => {
                return childRow; // modify child row

                return false; // delete child row
            },
            onUpsert: [
                ["copy", "{{parent.email}}", "{{child.authorEmail}}"]
            ],
            onDelete: (parentRow, childRow) => {

                return childRow; // modify child row

                return false; // delete child row
            },
            onDelete: [
                ["delete", "{{child.authorEmail}}"]
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
            call: db.users.get({"=": `{{args.id}}`}).exec("upsert", {email: `{{args.email}}`}),
            before: (userToken, args) => {}, // optional
            onUpdate: (userToken, args, row) => {}, // optional
            after: (userToken, args) => {} // optional
            before: "/appEndpoint"
        }
    ],
    views: // same as views, except just reads data
})

```