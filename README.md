# SomeSQL
Small and efficient database abstraction layer.

I looked everywhere for a data store with these features and couldn't find it:

1. Backend agnostic & can be extended to use any possible backend (like Knex).
2. Can store data in memory and run in nodeJS (like TaffyDB).
3. Used a strong data model to force data consistency (like Lovefield DB).
4. Had RDBMS capability out of the box (also like Lovefield DB).
5. Allowed you to declare actions and views in a simple way (like Redux).
6. Returned immutable data sets to improve React performance (like ImmutableJS).
7. Isn't ten million kilobytes in size (like TaffyDB).


SomeSQL was born to bring all this together.  It's an extensible database abstraction layer first, then includes an in memory store to make immediate use easy.

## Features
* Includes a fast built in memory only DB.
* Handles sorting, filtering, etc.
* Uses explicit model declarations.
* Returns immutable objects.
* Flux like usage pattern.
* Written in Typescript.
* Extensible.
* Under 5KB Gzipped.

## Simple Usage

1 minute minimal quick start:

```
SomeSQL('users') //  "users" is our table name.
.model([ // Declare data model
    {key:'id',type:'int',props:['pk','ai']},
    {key:'name',type:'string'},
    {key:'age',type:'int'}, 
])
.connect() // Init the data store for usage.
.then(function() {
    return this.query('upsert',{ // Add a record
        name:"Billy",
        age:5
    }).exec();
})
.then(function() {
    return this.query('select').exec(); // select all rows from the current active table
})
.then(function(rows) {
    console.log(rows) // <= [{id:1,name:"Billy",age:5}]
})

```

## Detailed Usage
First you declare your models, connect the db, then you execute queries.

### Declare DB model
```
SomeSQL('users')// Table/Store Name, required to declare model and attach it to this store.
.model([ // Data Model, required
    {key:'id',type:'int',props:['pk','ai']}, // This has the primary key and auto incriment values
    {key:'name',type:'string'},
    {key:'age',type:'int'},
    {key:'balance',type:'float'},
    {key:'postIDs',type:'array'},
    {key:'meta',type:'map'}
])
.actions([ // Optional
    {
        name:'add_new_user',
        args:['user:map'],
        call:function(args) {
            return this.query('upsert',args.user).exec();
        }
    }
])
.views([ // Optional
    {
        name: 'get_user_by_name',
        args: ['name:string'],
        call: function(args) {
            return this.query('select').where(['name','=',args.name]).exec();
        }
    },
    {
        name: 'list_all_users',
        args: ['page:int'],
        call: function(args) {
            return this.query('select',['id','name']).exec();
        }
    }                       
])

```

### Connect the DB and execute queries
```
// Initializes the db.
SomeSQL().connect().then(function() {
    // DB ready to use.
    this.doAction('add_new_user',{user:{
        id:null,
        name:'jim',
        age:30,
        balance:25.02,
        postIDs:[0,20,5],
        meta:{
            favorteColor:'blue'
        }
    }}).then(function(result) {
        console.log(result) //  <- "1 Row(s) upserted"
        return this.getView('list_all_users');
    }).then(function(result) {
        console.log(result) //  <- single object array containing the row we inserted.
    });
});

```

### Arbitrary Commands

You can execute a db command at any point from the `SomeSQL` object after the DB is connected.

Every query follows the same pattern:
`SomeSQL(#TABLE_NAME#).query(#ACTION#,#ARGS#)....optional filtering, sorting, etc...exec()`

For example a query to get all rows from the users table looks like this:
`SomeSQL('users').query('select').exec()`

Here are some more examples:
```
// Get all records but only return the name and id columns
SomeSQL('users').query('select',['name','id']).exec(); 

// only show rows where the name == "scott"
SomeSQL('users').query('select').where(['name','=','scott']).exec() 

// Compound where statement with AND
SomeSQL('users).query('select').where([['name','=','billy'],'and',['balance','>',20]]).exec();

// Compund where statement with OR
SomeSQL('users).query('select').where([['name','=','billy'],'or',['balance','>',20]]).exec();

// Order the results by name ascending, then age descending.
SomeSQL('users').query('select').orderBy({name:'asc',age:'desc'}).exec() 

// Limit and Offset
SomeSQL('users').query('select').limit(20).offset(10).exec();

// Filters (Must be supported by the database driver)
SomeSQL('users').query('select',['age']).filter('average').exec();

// The Memory DB supports sum, first, last, min, max, average, and count

// combine any patterns as you'd like.
SomeSQL('users').query('select',['name']).where(['age','>',20]).orderBy({age:'desc'}).exec() 

// Where statements work on upserts as well.
SomeSQL('users').query('upsert',{name:"Account Closed"}).where(['balance','<',0]).exec() 

```

Possible query commands are `select`, `drop`, `upsert`, and `delete`.

All calls to the `exec()` return a promise, with the result of the promise being the response from the database.  The `this` of the returned promise is always the current SomeSQL function with the last table you selected.

This makes it easy to chain commands:

```
SomeSQL('users').query('select').exec().then(function() {
    return this.query('upsert',{name:"Bill"}).where(['name','=','billy']).exec();
}).then(function(result) {
    return this.query('drop').exec();
})

```


### Events

You can listen to any number of database events on any table or all tables.

```
SomeSQL("users").on('select',function(eventData) {}) // Listen to "select" commands from the users table
SomeSQL("*").on('change',function(eventData) {}) // Listen for any changes to any table in the database.

```

Possible events are `change`, `delete`, `upsert`, `drop`, `select` and `error`.


### Multiple Tables

You can create a new table by selecting it and creating a new data model:

```
SomeSQL('newTable').model([
    {key:'name',type:'string'}
])

```

Keep in mind you MUST declare all your models and tables BEFORE calling the `connect()` command.

### Multiple Data Stores

If you need more than one data store with a collection of separate tables, you can declare a completely new SomeSQL db at any point.

```
var myDB = new SomeSQL_Instance().table;

// And now use it just like you use the SomeSQL var.
myDB('users').query("select").exec()...

Keep in mind that the tables and models are completely separate for each instance; there is no shared data, events or anything else.

```

# API Index

Possible commands are split into three groups, one group is used before you connect to the database.  
The other group is used after you connect to the database, and it's used to query the database data.

All commands can be chained or return a promise unless otherwise noted.

## Events

Events can be called before or after setup mode, at any time.

| Command      | Definition                                                                  |          |
|--------------|-----------------------------------------------------------------------------|----------|
| .on()        | Listen to specific database events with a callback function.                | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#on) |
| .off()       | Remove a listening function from being triggered by events.                 | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#off) |

## Group 1: Setup Mode

| Command      | Definition                                                                  |          |
|--------------|-----------------------------------------------------------------------------|----------|
| .model()     | Declare database model, required.                                           | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#model) |
| .views()     | Declare views to use.                                                       | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#views) |
| .actions()   | Declare actions to use.                                                     | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#actions) |
| .addFilter() | Add a filter that can be used on queries.                                   | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#addfilter) |
| .connect()   | Complete setup mode and optionally connect to a specific backend, required. | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#connect) |

## Group 2: Query Mode 

Every database query looks like this:
`SomeSQL(#Table Name#).query(#Query Type#, #Query Args#)...Optional Query Modifiers...exec()`

This gives each query three distinct sections, the query section, the query modifier section, and the execute section.

### Query Init

There is only one possible function to start a query, and it has several different possible arguments.  Check out the examples to see those.

| Command    | Definition                                                   |          |
|------------|--------------------------------------------------------------|----------|
| .query()   | Starts a database query.                                     | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#query) |

### Query Modifiers

Each modifier can take up to two arguments and normally can only be used once.  Check each example for usage.

| Command    | Definition                                                   |          |
|------------|--------------------------------------------------------------|----------|
| .where()   | Adds a search component to the current query.                | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#where) |
| .orderBy() | Adds a order by component to the current query.              | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#orderby) |
| .offset()  | Offset the current query by a given value                    | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#offset) |
| .limit()   | Limits the current query by a given value                    | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#limit) |
| .filter()  | Applies a custom filter to the current query                 | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#filter) |
| .extend()  | Use a extend query modifier provided by the database driver. | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#extend) |

### Query Execution

These come at the end of a query to execute it on the database.  All of these return a promise with the result, the promise also keeps the `this` scope of the query, so you can chain additional commands afterwards.

| Command    | Definition                                                             |          |
|------------|------------------------------------------------------------------------|----------|
| .exec()    | Executes a pending query, returns a promise.                           | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#exec) |
| .toCSV()   | Executes the pending query and returns a CSV of it, returns a promise. | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#tocsv) |


### Actions & Views

These can be used in replacement of the query..exec pattern to execute a given view or action.

| Command     | Definition                                                             |          |
|-------------|------------------------------------------------------------------------|----------|
| .getView()  | Gets a specific view, returns a promise.                               | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#getview) |
| .doAction() | Does a specific action, returns a promise.                             | [Examples](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html#doaction) |


[View Complete Official Docs](https://clicksimply.github.io/Some-SQL/classes/_index_.somesqlinstance.html)

