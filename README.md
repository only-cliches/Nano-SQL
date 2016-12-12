# some-sql
Typescript database abstraction layer

## Minimalist JS Database Engine
* Includes a fast built in memory only DB.
* Handles sorting, filtering, etc.
* Uses explicit model declerations.
* Flux like usage pattern.
* Modular and extensable.
* 4KB Gzipped.

## Usage
First you declare your models, connect the db, then you execute queries.

### Declare DB model
```
someSQL('users')//Table/Store Name, required to declare model and attach it to this store.
.model([ //Data Model, required
    {key:'id',type:'int',props:['pk','ai']}, //This has the primary key and auto incriment values
    {key:'name',type:'string'},
    {key:'age',type:'int'},
    {key:'balance',type:'float'},
    {key:'postIDs',type:'array'},
    {key:'meta',type:'map'}
])
.actions({ //Optional
    'add_new_user':[['user:map'],function(args) {
        return this.query('upsert',args.user).exec();
    }]
})
.views({ //Optional
    'get_user_by_name':[['name:string'],function(args) {
        return this.query('select').where(['name','=',args.name]).exec();
    }],
    'list_all_users':[[],function(args) {
        return this.query('select',['id','name']).exec();
    }],                       
})

```

### Connect the DB and execute queries
```
//Initializes the db.
someSQL().connect().then(function() {
    //DB ready to use.
    someSQL('users').doAction('add_new_user',{user:{
        id:null,
        name:'jim',
        age:30,
        balance:25.02,
        postIDs:[0,20,5],
        meta:{
            favorteColor:'blue'
        }
    }}).then(function(result) {
        console.log(result) // <- "1 Row(s) upserted"
        return this.getView('list_all_users');
    }).then(function(result) {
        console.log(result) // <- single object array containing the row we inserted.
    });
});

```

### Arbitraty Commands

You can execute a db command at any point from the `someSQL` object after the DB is connected.

Every query follows the same pattern:
`someSQL(#TABLE_NAME#).query(#ACTION#,#VARS#)....optional filtering, sorting, etc...exec()`

For example a query to get all rows from the users table might look like this:
`someSQL('users').query('select').exec()`

Here are some more examples:
```
someSQL('users').query('select',['name','id']).exec(); //Get all records but only return the name and id columns

someSQL('users').query('select').where(['name','=','scott']).exec() //only show rows where the name == "scott"

someSQL('users').query('select').orderBy({name:'asc',age:'desc'}).exec() //Order the results by name ascending, then age descending.

someSQL('users').query('select',['name']).where(['age','>',20]).orderBy([{age:'desc'}]).exec() //combine any patterns as you'd like.

someSQL('users').query('upsert',{name:"Account Closed"}).where(['balance','<',0]).exec() //Where statements work on upserts as well.

```

Possible query commands are `select`, `drop`, `upsert`, and `delete`.

All calls to the `exec()` return a promise, with the result of the promise being the response from the database.  The `this` of the returned promise is always the current someSQL function with the last table you selected.

This makes it easy to chain commands:

```
someSQL('users').query('select').exec().then(function() {
    return this.query('upsert',{name:"Bill"}).where(['name','=','billy']).exec();
}).then(function(result) {
    return this.query('drop').exec();
})

```


### Events

You can listen to any number of database events on any table or all tables.

```
someSQL("users").on('select',function(eventData) {}) //Listen to "select" commands from the users table
someSQL("*").on('change',function(eventData) {}) //Listen for any changes to any table in the database.

```

Possible events are `change`, `delete`, `upsert`, `drop`, `select` and `error`.


### Multiple Tables

You can create a new table by selecting it and creating a new data model:

```
someSQL('newTable').model([
    {key:'name',type:'string'}
])

```

Keep in mind you MUST declare all your models and tables BEFORE calling the `connect()` command.

### Multiple Data Stores

If you need more than one data store with a collection of seperate tables, you can declare a completely new someSQL db at any point.

```
var myDB = new someSQL_Instance().init;

//And now use it just like you use the someSQL var.
myDB('users').query("select").exec()...

Keep in mind that the tables and models are completely seperate for each instance; there is no shared data, events or anything else.

```

The code is heavily comented so that will have to stand in for full API docs for now. :)