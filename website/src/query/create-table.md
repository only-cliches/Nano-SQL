# Create Table

The `create table` query can be used to add new tables to nanoSQL while it's running.  If you'd like to adjust an existing table use the `alter table` query instead.

NanoSQL data models and indexes are loosely defined, you can easily change the data models/indexes as often or as dramatically as you'd like.  The current data model for each table is used to restrict rows and updates going into the database.  Once you change the data model/indexes all the old rows might not match your new data model or be indexed correctly, so a `conform rows` query might be needed.

> **Extremely Important** After a table is created you can use `alter table` or tweak the table in your `connect()` call to adjust almost anything including adding or removing columns/indexes, changing the table name and many other things.  **The one thing you can't ever change is the primary key column or type.**  Once the table is created the primary key column and type is written in stone.  If you have to change the primary key column/type a new table has to be made and all the rows from the original table imported into it.

The `create table` query accepts a single argument that's an object described by the [InanoSQLTableConfig interface](https://nanosql.io/api/interfaces/_interfaces_.inanosqltableconfig.html).


## Making Tables

Let's look at a simple example:

```typescript
nSQL().query("create table", {
    name: "users",
    model: {
        "id:int": {pk: true, ai: true}, // pk = primary key, ai = auto increment
        "age:int": {default: 13, max: 110, min: 13},
        "name:string": {default: "none", notNull: true}
    }
}).exec().then..
```

In the above example, we have three columns.  `id` is a column containing an `int` or integer value, it's also the primary key column that will be auto incremented.  The `age` column is of type `int` as well, has a default value of 13, a min value of 13 and a max value of 110.  The final column is `name`, it's of type `string` and has a default value of "none" and must not be null.

> **Important** Table names and column names must contain only letters, numbers and underscores "\_".  They cannot begin with an underscore.

Rows from the above table would look like this:

```typescript
{id: 1, age: 25, name: "jeb"}
```

nanoSQL supports many types, including all primitive typescript types.  Here is a complete list of supported types you can use in your columns:

| Type | Description |
| :--- | :--- |
| any, blob | These types will not actually type cast, just pass through whatever value is provided. |
| safestr | A safe string type, automatically replaces HTML entities with HTML special characters. |
| string | Simple string type.  |
| int | Integer type, floating point numbers will be rounded to the nearest whole number.  Strings will be parsed into integers. Everything else becomes zero.  Works with auto increment as primary key type. |
| number, float | Floating point type, numbers will pass through, strings will be converted to numbers using parseFloat, everything else will become a zero. |
| array | Same as `any[]` |
| uuid, timeId, timeIdms | An extension of the `string` type.  Doesn't perform any validation beyond making sure the value is a string.  If any of these are used in a primary key column they will autogenerate as needed. |
| object, obj, map | Only allows javascript objects `{}` into the column. |
| boolean, bool | `true` and the number `1` resolve to `true`, everything else resolves to `false`. |
| date | ISO 8601 date field |
| geo | An object containing `lat` and `lon` properties, represents a geographic coordinate. |

Any type is also supported as an array or array of arrays, \(or arrays of arrays of arrays...\) examples: `any[]`, `any[][]`, `number[]`, `string[]`, etc.

When you use the `obj`, `object`, or `map` types you can also declare the inner structure of this type.  This can be nested infinitely, so if your rows contain complicated objects nanoSQL can type cast all the way down.  Objects are also supported as arrays, so if you need an array of objects type casted it's just as easy.

```typescript
nSQL().query("create table", {
    name: "users",
    model: {
        "id:uuid": {pk: true}, // pk = primary key
        "name:string" {},
        "meta:obj[]", { // array of objects
            model: {
                "key:string": {},
                "value:any": {},
                "details:obj": { // nested object
                    model: {
                        "detail1:string": {default: ""},
                        "detail2:string": {default: ""}
                    }
                }
            }
        }
    }
}).exec().then..

// example row for the above data model:
/*
{
    id: "de1decb9-5e8a-420a-a578-ae46555977d6",
    name: "Jeb",
    meta: [
        {
            key: "some key",
            value: "some value",
            details: {
                detail1: "hello",
                detail2: "world
            }
        }
    ]
}
*/
```

## Indexes

NanoSQL supports secondary indexes on any column, including nested columns or values inside array columns.

The index syntax is very similar to data model syntax and supports these types: `int`, `float`, `number`, and `string`, these types can also be indexed as one dimensional arrays.  `geo` type can also be indexed, but not as an array.

### Standard Secondary Indexes

```typescript
nSQL().query("create table", {
    name: "users",
    model: {
        "id:uuid": {pk: true}, // pk = primary key
        "name:string" {},
        "age:int": {},
        "favorites:obj": {
            model: {
                "sport:string":{},
                "icecream:string": {}
            }
        }
    },
    indexes: {
        // one index on the age column
        "age:int":{}
        // one index on the nested favorite sport column
        "favorites.sport:string": {}
    }
}).exec().then..
```

Standard indexes can be used in `where` conditions with `=`, `IN`, `BETWEEN` , or `LIKE` conditions.

```typescript
// Indexed queries
// get all users with an age between 19 and 25
nSQL("users").query("select").where(["age", "BETWEEN", [19, 25]]).exec();
// get all users who have basebal OR soccor as their favorite sport
nSQL("users").query("select").where(["favorites.sport", "IN", ["baseball", "soccor"]]).exec();
// get all users who's favorite sports starts with "base".  Would return baseball, base jumping, etc.
nSQL("users").query("select").where(["favorites.sport", "LIKE", "base%"]).exec();
// get all users who's age is exactly 25.
nSQL("users").query("select").where(["age", "=", 25]).exec();

// Indexed queries also allow indexed orderBy results:
nSQL("users").query("select").orderBy(["age ASC"]).exec();
```

Using `LIKE` with indexes that are string type works like an autocomplete, pass in the beginning of the search term followed by "%" to signify the ending wildcard.  If this specific format isn't followed the `LIKE` condition will not use the index.

The indexed orderBy only works when you're using a single column in the `orderBy` query and that column is either a standard secondary index or primary key.

You can also safely index values inside arrays of your columns.  These don't count as "array type indexes" since each index is still holding a single value.

```typescript
// index values inside an array 
nSQL().query("create table", {
    name: "users",
    model: {
        "id:uuid": {pk: true}, // pk = primary key
        "name:string" {},
        "age:int": {},
        "meta:obj[]": {
            model: {
                "key:string":{},
                "value:string": {}
            }
        }
    },
    indexes: {
        // index the first meta value
        "meta[0].key:string": {}
    }
}).exec().then..
```

You can also set indexes to only allow a single row for each indexed value:

```typescript
// index values inside an array 
nSQL().query("create table", {
    name: "users",
    model: {
        "id:uuid": {pk: true}, // pk = primary key
        "name:string" {},
        "age:int": {},
        "email:string": {}
    },
    indexes: {
        "email:string": {unique: true} // only one account per email
    }
}).exec().then..
```

If unique is enabled, `upsert` queries that attempt to add a second row to a given secondary index value will fail.

### Array Indexes

You can also index arrays of values, like this:

```typescript
nSQL().query("create table", {
    name: "users",
    model: {
        "id:uuid": {pk: true}, // pk = primary key
        "name:string" {},
        "age:int": {},
        "favorites:obj": {
            model: {
                "sports:string[]":{},
            }
        }
    },
    indexes: {
        // now indexing an array of values
        "favorites.sports:string[]": {}
    }
}).exec().then..
```

 Indexed array values only work with `INCLUDES`, `INTERSECT ALL` , `INTERSECT`,  and `INCLUDES LIKE` where conditions.  They will not work with `=`, `BETWEEN`, `IN` or `LIKE` used with standard indexes.

You can safely array index with `int`, `number`, `string`, and `float` types.

```typescript
// some valid queries with indexed array values
nSQL("users").query("select").where(["favorites.sports", "INCLUDES", "baseball"]).exec();
nSQL("users").query("select").where(["favorites.sports", "INTERSECT", ["soccor", "baseball"]]).exec();

// INCLUDES LIKE only works for string array indexes: string[]
// get all users who's favorite sports array includes a string that starts with "base".
nSQL("users").query("select").where(["favorites.sports", "INCLUDES LIKE", "base%"]).exec();
```

### Geo Data Type

Finally, the `geo` data type has some special conditions with its indexing behavior.  First, the geo data type cannot be indexed if it's an array index type.

```typescript
nSQL().query("create table", {
    name: "users",
    model: {
        "id:uuid": {pk: true}, // pk = primary key
        "name:string" {},
        "loc:geo": {}
        // "loc:geo[]": {} <= can't index this
    },
    indexes: {
        // index geo data type
        "loc:geo": {},
        // "loc:geo[]": {} <= can't index this
    }
}).exec().then..

```

When inserting/reading values from the `geo` data type, you should be using or expecting an object with a `lat` and `lon` property containing the latitude and longitude coordinates.

The only way to take advantage of the `geo` index is with the `CROW` function, like this:

```typescript
// get all users within 3 km of -20, 30
nSQL("users").query("select").where(["CROW(loc, -20, 30)", "<", 3]).exec()
```

The `CROW` function uses kilometers by default, you can change the value at `nSQL().planetRadius` to a different unit value to change this.

The only supported compare in the `where` statement for geo the index are `<` and `<=`, all other compares will lead to a full table scan.

### Case Insensitive Indexes

You can optionally setup the index to ignore casing. 

```typescript
nSQL().query("create table", {
    name: "users",
    model: {
        "id:uuid": {pk: true}, // pk = primary key
        "name:string" {}
    },
    indexes: {
        "name:string": {ignore_case: true}
    }
}).exec().then..
```

When this is enabled, the secondary index will ignore casing on updates and queries.

```typescript
nSQL("users").query("upsert", {name: "Jeb"}).exec().then(() => {
    return nSQL().query("select").where(["name", "=", "jeB"]).exec();
}).then((rows) => {
    console.log(rows); // [{id: "xxx", name: "Jeb"}]
});
```

This also works with the autocomplete feature for indexes:

```typescript
nSQL().query("select").where(["name", "LIKE", "j%"]).exec().then((rows) => {
    console.log(rows); // [{id: "xxx", name: "Jeb"}]
});
```

### Index Offsets

When indexing `int`, `float` and `number` types you'll find that negative values don't always work with `BETWEEN` queries.  Database engines typically have problems with negative numbers since there isn't a real way to sort them correctly with positive numbers using binary.

This doesn't really matter if you're indexing an array type like `int[]`, `float[]`, or `number[]` since `BETWEEN` queries don't work with these types anyway.  But if you're using a standard index where range queries will be needed, this can represent a problem.

The solution is using an offset, where all numbers are raised by a specific amount so that no negative numbers make it into the index.  This would normally be a big pain in the neck to keep track of, but nanoSQL automates this for you.

```typescript
nSQL().query("create table", {
    name: "users",
    model: {
        "id:uuid": {pk: true}, // pk = primary key
        "name:string" {},
        "balance:int": {}
    },
    indexes: {
        // offset all balances by 100
        "balance:int": {offset: 100}
    }
}).exec().then..
```

With the optional `offfset` property, you can have nanoSQL automatically adjust the values as they are added to the index, then adjust your queries when they request values from the index.  It all happens behind the scenes, so you can be oblivious to the complexity besides this small adjustment to your data model.

> **Important** If you add or adjust an offset to an existing index, you MUST rebuild the index after the change or you'll have a bad time.

The offset should be set to the opposite of the lowest number you expect in the index.  For example, if you expect the values in the index to go as low as -500, you should set the offset to be 500 or maybe even a bit higher.  If you set the offset to something insane like 99999999 the database will take longer to insert and query the rows with longer digits so there is a cost to just throwing a big number in there.  Try to keep the offset as low as possible while still keeping in range of your negative numbers.

If you aren't planning on querying negative numbers with `BETWEEN` on your index, the offset isn't needed.

### Foreign Keys

You can also setup foreign keys in your database.  Foreign keys must exist as a property of an existing index, they're used to keep rows in sync across tables.

Let's take a look at a simple example, keeping track of user posts.

```typescript
import { nSQL } from "nano-sql";
import { InanoSQLFKActions } from "@nano-sql/core/lib/interfaces";

nSQL.connect({
    tables: [
        {
            name: "users",
            model: {
                "id:int":{pk: true},
                "num:int":{}
            }
        },
        {
            name: "posts",
            model: {
                "id:int":{pk:true},
                "title:string":{},
                "user:int":{}
            },
            indexes: {
                "user:int":{
                    foreignKey: { // foreign key property
                        target: "users.id", // parent Table.column or Table.nested.column
                        onDelete: InanoSQLFKActions.RESTRICT
                    }
                }
            }
        }
    ]
})
```

The supported `onDelete` properties are:

| On Delete | Does... |
| :--- | :--- |
| RESTRICT | Don't allow a parent row to be deleted if child rows exist attached to it. |
| CASCADE | Delete child records when a parent is deleted |
| SET\_NULL | Set child record columns to NULL on delete |
| NONE | Do nothing with the foreign key restriction, default. |

Foreign keys are a pretty complicated topic, you can read more [on this website](https://www.hostingadvice.com/how-to/mysql-foreign-key-example/) about how they work.

## Preset Queries

You can setup preset queries, these are useful for securing server side requests coming from clients or declaring all the data setters/getters inline with the table.

```typescript
nSQL().connect({
    tables: [
        {
            name: "users",
            model: {
                "id:uuid": {pk: true},
                "name:string" {},
                "balance:int": {}
            },
            queries: [
                {
                    name: "getById",
                    args: {
                        "id:uuid":{}
                    },
                    call: (db, args, onRow, complete, error) => {
                        db.query("select").where(["id", "=", args.id]).stream(onRow, complete, error);
                    }
                }
            ]     
        }
    ]
})
```

Then, to use the above preset query you can use one of two methods:

```typescript
// use promise
nSQL("users").presetQuery("getById").promise({id: "xxx"}).then((results) => {

}).catch((err) => {

});

// use stream
nSQL("users").presetQuery("getById").stream({id: "xxx"}, (row) => {
    // row recieved
}, () => {
    // query complete
}, () => {
    // query error
})
```

If you always expect a specific query to return a small number of results, it's fine to use `.promise()`, but if there's a chance the records will be in the thousands the streaming api is usually a better choice.

## Actions & Views \(Depreciated\)

> This feature is still in place to make 1.X migration easier but planned to be depreciated since it doesn't support the new types syntax or streaming api.

Think of Actions kind of like Redux reducers and Views are a way to declare all the ways you plan to display data in your app. Both views and actions are completely optional and work identically.

#### Example

```typescript
nSQL().query("create table", {
    name: "users",
    model: {
        "id:uuid": {pk: true}, // pk = primary key
        "name:string" {},
        "balance:int": {}
    },
    views: [
        {
            name: 'get_user_by_name',
            args: ['name:string'], //<= notice the optional type casting, you could also just do ['name']
            call: function(opts, db) {
                // Because of the args property our "opts" argument looks like this:
                // {name:"SomeString"}
                // nanoSQL will force the name property to a string and prevent any other arguments from being passed through.
    
                // Finally, the "db" argument is the nSQL var with the most recent selected table still selected.
                return db.query('select').where(['name', '=', opts.name]).exec();
            }
        }
    ]
}).exec()...

// using our view
nSQL("users").getView("get_user_by_name",{name:"Scott"}).then((rows) => {
    console.log(rows) // <= result of the view
});


```

Actions are called with `.doAction()` and views are called with `.getView()`, they both have the same syntax and work identically.

## 
