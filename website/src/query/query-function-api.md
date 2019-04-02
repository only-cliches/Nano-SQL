# Query Function API

You can add your own query functions into nanoSQL or even overwrite the built in ones.

Functions exist as properties of `nSQL().functions`, each function is just a property of that object.  For example, the `COUNT` function is located at `nSQL().functions.COUNT`.  So you could assign a new function to that property to overwrite the built in `COUNT` function.

Every function can be used in `select` statements, `where` statements, `orderBy` and `groupBy`.  

```typescript
// using a function everywhere possible
nSQL("users").query("select", ["COUNT(*)"]).where(["COUNT(age)", "=", 1]).orderBy(["COUNT(name) ASC"]).exec();
```

Functions must conform to the `InanoSQLFunction` interface and can be of an aggregate type or simple type.

Built in functions are located in [this source file](https://github.com/ClickSimply/Nano-SQL/blob/2.0/packages/Core/src/functions.ts) and might prove a useful resource for helping you explore how the API works.

## Simple Functions

Simple functions mutate row columns or values into other values.

A good way to think about simple functions is there should be a result for every row selected by the query.

Let's make a simple function that will turn any number into a money format.

```typescript
import { InanoSQLFunction, InanoSQLQuery } from "@nano-sql/core/lib/interfaces";
import { getFnValue } from "@nano-sql/core/lib/utilities";

 // getFnValue will turn function arguments into intended values
 // if a row column is passed in like "meta.property.value" the value will be resolved from the row passed in.
 // if a value with quotes is passed in, like "hello, bob!", you'll get that instead. 
 
 nSQL().functions.MONEY: InanoSQLFunction = {
     type: "S" // Simple function
     call: (q: InanoSQLQuery, row: any, prev: any, ...args: any[]) => {
         // q is the query object that called this function
         // row is the row we should mutate
         // prev is used by aggregate functions, undefined here
         // ...args is an array of strings passed into the function as arguments
         // if the user called MONEY(arg1, arg2) you'd get ["arg1", "arg2"]
         return {
             result: "$" + parseFloat(getFnValue(row, args[0])).toFixed(2)
         }
     }
 }
 
 // using our new function
 nSQL("users").query("select", ["name", "MONEY(balance)"]).exec().then((rows) => {
     // something like [{name: "bill", "MONEY(balance)": "$200.28"}]
 });
```

## Aggregate Functions

Aggregate functions are used to combine many rows into a single result, similar to how `.reduce()` works with javascript arrays.

Let's make an aggregate function that averages the string length for a given column.

```typescript
import { InanoSQLFunction, InanoSQLQuery } from "@nano-sql/core/lib/interfaces";
import { getFnValue } from "@nano-sql/core/lib/utilities";
 
 nSQL().functions.AVG_STR_LEN: InanoSQLFunction = {
     type: "A" // Aggregate Function
     // the starting value for "prev" argument in function call
     aggregateStart: {result: 0, total: 0, records: 0, row: {}}
     call: (q: InanoSQLQuery, row: any, prev: any, ...args: any[]) => {
         // q is the query object that called this function
         // row is the row we should get our values from
         // prev is the previous value for the aggregate result
         // ...args is an array of strings passed into the function as arguments
         // if the user called AVG_STR_LEN(arg1, arg2) you'd get ["arg1", "arg2"]
         const rowString = String(getFnValue(row, args[0]));
         prev.total += rowString.length;
         prev.records++;
         prev.result = Math.round(prev.total / prev.records);
         prev.row = row; // if other row columns are selected, they'll come from this
         return prev;
     }
 }
 
 // using our new function
 nSQL("users").query("select", ["AVG_STR_LEN(name) AS averageNameLen"]).exec().then((rows) => {
     // something like [{averageNameLen: 12}]
 });
```

## Indexing Functions

In addition to the abilities above, you can optionally have your function work with indexes to speed up results.  This only works for simple functions being used in `where` conditions.

For example, the built in `CROW` function is able to dramatically increase query performance when geo data types are indexed.  [The source code is a good read](https://github.com/ClickSimply/Nano-SQL/blob/5897851b3a9a4ba35489d421bfbaeeb60b304167/packages/Core/src/functions.ts#L256) to see how this works.

There are two additional properties that must be added to the function object in order for this to work.  The first is `checkIndex`, this is to allow you to determine if the function can use indexes for better performance or not.  The second is `queryIndex` and is used to actually query the index.

### checkIndex

If you have a checkIndex property on your function and it's used in a `where` statement, this will be called to allow you to check if the function can use indexes in this query.

**Function Arguments**

| **Argument** | Type | Description |
| :--- | :--- | :--- |
| Query | InanoSQLQuery | The query that triggered this function call. |
| fnArgs | String\[\] | An array of strings that represent the arguments passed into the function. |
| where | Any\[\] | The single where statement including the function call, you won't ever see nested where statements here. |

The function must either return `false` if no index can be used to drop to normal behavior, or must return an object defined by the `IWhereCondition` interface to allow indexing to be used.  

**IWhereCondition Interface**

<table>
  <thead>
    <tr>
      <th style="text-align:left"><b>Property</b>
      </th>
      <th style="text-align:left">Type</th>
      <th style="text-align:left">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:left">index</td>
      <td style="text-align:left">String</td>
      <td style="text-align:left">The name of the index being used.</td>
    </tr>
    <tr>
      <td style="text-align:left">parsedFn</td>
      <td style="text-align:left">
        <p>{</p>
        <p>name: String,</p>
        <p>args: String[]</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The function name and arguments being used.</td>
    </tr>
    <tr>
      <td style="text-align:left">comp</td>
      <td style="text-align:left">String</td>
      <td style="text-align:left">The where comparison value being used. Ex: <code>=</code>, <code>!=</code>, <code>IN</code>,
        etc.</td>
    </tr>
    <tr>
      <td style="text-align:left">value</td>
      <td style="text-align:left">Any</td>
      <td style="text-align:left">The where value being compared against.</td>
    </tr>
  </tbody>
</table>### queryIndex

If you don't return `false` from `checkIndex`, this will be called to perform the actual indexed query.

**Function Arguments**

| **Argument** | Type | Description |
| :--- | :--- | :--- |
| Query | InanoSQLQuery | The query that triggered this function call. |
| where | IWhereCondition | The object you returned from `checkIndex`. |
| onlyPKs | boolean | If this is true, only provide the primary keys of the rows selected by the index instead of the whole row. |
| onRow | \(rowOrPk: any, idx: number\) =&gt; void | Call for each row / primary key selected. |
| complete | \(\) =&gt; void | Call once all rows have been selected. |
| error | \(err: any\) =&gt; void | Call if the query runs into any errors. |

The [source code for the CROW function](https://github.com/ClickSimply/Nano-SQL/blob/5897851b3a9a4ba35489d421bfbaeeb60b304167/packages/Core/src/functions.ts#L256) is the best example on how this whole process works.
