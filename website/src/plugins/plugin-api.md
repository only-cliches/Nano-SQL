# Plugin API

The plugin api lets you use several dozen lifecycle hooks to adjust almost any behavior in nanoSQL.  You can add custom queries, add query functions, adjust or prevent event triggering, adjust rows as they go into or come out of the database adapters and many other things.

Each plugin is a JSON object that conforms to the `InanoSQLPlugin` interface. 

```typescript
import { InanoSQLPlugin, customQueryFilter } from "@nano-sql/core/lib/interfaces";

export const myPlugin = (): InanoSQLPlugin => {
    return {
        name: "My Plugin",
        version: 1.0,
        dependencies: {
            "core": [2.0] // @nano-sql/core v2 or greater
            "other plugin": [1.0, 2.0] // other plugin greater than v1.0 and less than v2.0
        },
        filters: [
            {
                name: "customQuery",
                priority: 1000,
                call: (inputArgs: customQueryFilter, complete: (args: customQueryFilter) => void, cancel: (info: any) => void) => {
                    complete(inputArgs);
                }
            }
        ]
    }
}

// using your plugin:
nSQL().createDatabase({
    id: "my_db",
    mode: "PERM",
    plugins: [
        myPlugin()
    ]
}).then...
```

## Dependencies

The dependencies object lets you declare that this plugin needs other plugins or adapters to run and even lets you specify which versions are compatible.

Besides the keyword `core` the object keys are other plugin or adapter names, the array for each key is either the minimum version \(if one value\) or the minimum and maximum version \(if two values\).

The dependencies are checked each time nanoSQL is booted up, so if the dependencies aren't met nanoSQL will fail to connect and let the user know of the other needed dependencies.

## Filters

Filters are used to hook into various parts of nanoSQL and adjust its behavior.  A majority of the filters allow you to directly adjust elements before they are activated, for example there is a filter that lets you adjust queries before they are sent into the database.  You could use this filter to prevent specific queries entirely, listen for queries or adjust queries based on specific conditions.

The `priority` property allows you to control what order filters are applied in.  If multiple plugins attach to the same filter, the plugin with the highest priority is ran first, followed by the next highest and so on.  If at any point a plugin cancels the filter outright the plugins with a lower priority for that filter will not receive the filter call at all.  It's important to keep in mind the filters are called in series one after another asynchronously, so try not to put expensive or time consuming operations in the filters.

The `call` property contains the callback for the filter.  The `inputArgs` argument will almost always be an object with at least one property: `res`.  The `res` property contains the actual data passing through the filter that can be mutated.  Other properties may exist as a convenience to get more information about the object being filtered.  When you're done mutating the `res` property the entire `inpurtArgs` object should be passed into the `complete` callback to continue or complete the filtering process, or you can call `cancel` to abort it.  Once `cancel` is called the filter process is aborted and so is the action the filter was performing.  For example if you're filtering against a row insert and you call `cancel`, the row will not be inserted.

> **Filters VS Events** Events are called after an action completes and doesn't let you control the query lifecycle at all.  For example, if you needed to make an adjustment to custom indexes as a result of a query, the filters would let you cancel the query if the index adjustments failed and also force the query to wait until the adjustments completed before finishing.  These things aren't possible with events.

Here are all the filters supported by nanoSQL:

## Primary Filters

### config

Allows you to adjust the config object passed in by the user.  You can even use this filter to remove plugins from being activated.

**Filter Properties**

| Property | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLConfig | The config object passed in by the user. |

### willConnect

Called after config filter, just before detecting and connecting to the adapter.  Useful for grabbing a reference to the parent nanoSQL instance.  Once you have this reference you can modify/adjust query functions and lots of other things.

**Filter Properties**

| Property | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLInstance | The nanoSQL instance about to connect |

### postConnect

Called after willConnect, the adapter is now connected but no tables have been created or setup.  Adjusting the config property at this point won't have much of an effect.

**Filter Properties**

| Property | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLConfig | The config object passed in by the user, possibly already adjusted by config filter. |

### ready

Called after postConnect, the adapter is now connected and all tables and indexes are setup and ready to go.

Can be used to prevent or listen for nanoSQL finalizing the `connect` process and reaching a ready state.

**Filter Properties**

| Property | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLDatabaseEvent | The event fired by `.on("ready"` |

### onEvent / offEvent

Called when `nSQL().on("someEvent"...)` or `nSQL().off("someEvent"...)` is called, respectively.

Can be used to reject specific events, add new event triggers or adjust events before they are added.

**Filter Properties**

<table>
  <thead>
    <tr>
      <th style="text-align:left">Property</th>
      <th style="text-align:left">Type</th>
      <th style="text-align:left">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>action: string,</p>
        <p>callback: event function</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The action passed into the first argument, and the callback function passed
        into the second one.</td>
    </tr>
  </tbody>
</table>

### customEvent

Called after onEvent/offEvent filter and when the action did not match any built in event listeners for nanoSQL, mostly useful for making your own event listeners.

The event system in nanoSQL uses namespaces and paths to scope events together, you can adjust the namespace and path for your custom event listener with this filter.

**Filter Properties**

<table>
  <thead>
    <tr>
      <th style="text-align:left">Property</th>
      <th style="text-align:left">Type</th>
      <th style="text-align:left">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>nameSpace: string,</p>
        <p>path: string</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The namespace and path of the requested event.</td>
    </tr>
    <tr>
      <td style="text-align:left">selectedTable</td>
      <td style="text-align:left">String</td>
      <td style="text-align:left">The current selected table</td>
    </tr>
    <tr>
      <td style="text-align:left">action</td>
      <td style="text-align:left">String</td>
      <td style="text-align:left">The action passed into the event listener function</td>
    </tr>
    <tr>
      <td style="text-align:left">on</td>
      <td style="text-align:left">boolean</td>
      <td style="text-align:left">True if this filter was called from <code>nSQL().on</code>, false otherwise.</td>
    </tr>
  </tbody>
</table>

### event

Called when `nSQL().triggerEvent` is called, can be used to adjust events being fired or prevent them from being fired at all.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLDatabaseEvent | The database event that's about to be triggered. |

### actionView

Called when `.doAction` or `.getView` is called, allows you to adjust or suppress actions and views.

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>AVType: "a" | "v",</p>
        <p>table: String,</p>
        <p>AVName: String,</p>
        <p>AVArgs: Object</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties that describe the action/view being called.</td>
    </tr>
  </tbody>
</table>

### query

The earliest query filter, is called for all queries immediately after `nSQL().triggerQuery` is called. Can be used to adjust or suppress queries.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLQuery | The query object about to be executed |

### disconnect

Called just after `nSQL().disonnect()`, allows you to adjust or suppress disconnect behavior.

**Filter Properties**

**No filter properties**

### **extend**

Called when `nSQL().extend()` is used.  There is no default behavior for `.extend()` so there is nothing really to filter, just useful for creating custom behaviors.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| scope | String | The first argument passed into `nSQL().extend()` |
| args | Any\[\] | An array holding the remaining arguments passed into `nSQL().extend()` |

## Query Filters

These filters are called inside the query as its executing, allowing you to modify, suppress or listen for specific behavior inside the query lifecycle.

### customQuery

Can be used to support query actions that aren't native to nanoSQL.  Only called when someone executes a query using a query action not supported by nanoSQL.  For example this would trigger the customQuery filter: `nSQL().query("some query").exec()`

Since there is no default behavior for this, the `complete` callback shouldn't be called unless you don't want to handle the query.  If your plugin is taking care of the query, use the filter properties to complete the query and never call the `complete` callback.  If you do call `complete` an error will occur and the query will fail.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| query | InanoSQLQuery | The query object describing the query action, arguments and other properties. |
| onRow | \(row: any, idx: number\) =&gt; void | The callback to send each record/row into as it's selected or adjusted. |
| complete | \(\) =&gt; void | The callback to use once the query is finished. |
| error | \(error: any\) =&gt; void | The callback to use if the query encounters an error. |

### conformRow

Used to adjust or suppress rows being conformed using the `conform rows` query.  Called for every row being conformed.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | Object | The row after it's been conformed to the data model. |
| oldRow | Object | The old row, before it was conformed. |
| query | InanoSQLQuery | The query object for this action. |

### updateRow

Called every time a row is updated, will not be called for new rows.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | Object | The data being updated into the row record, might be a whole or partial update. |
| row | Object | The row being updated, before the update. |
| query | InanoSQLQuery | The query object for this action. |

### updateRowEvent

Called every time a row is updated AFTER updateRow filter, will not be called for new rows.

Useful for adjusting the events triggered from the updated row or seeing the final results of an update.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLDatabaseEvent | The event that's about to be triggered against the event listeners. |
| query | InanoSQLQuery | The query object for this action. |

### updateIndex

Called every time a secondary index is updated.  Useful for adjusting or suppressing the index update.

This filter is called when indexes have values added or removed.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLupdateIndex | All of the properties describing the index update. |
| query | InanoSQLQuery | The query object for this action. |

### addRow

Called every time a row is added, will not be called for updated rows.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | Object | The new row data before it's passed into the database backend. |
| query | InanoSQLQuery | The query object for this action. |

### addRowEvent

Called every time a row is added AFTER addRow filter, will not be called for updating rows.

Useful for adjusting the events triggered from the added row or seeing the final results of an added row.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLDatabaseEvent | The event that's about to be triggered against the event listeners. |
| query | InanoSQLQuery | The query object for this action. |

### deleteRow

Called every time a row is deleted, will not be called for other row actions.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | Object | The row that is to be deleted. |
| query | InanoSQLQuery | The query object for this action. |

### deleteRowEvent

Called every time a row is deleted AFTER deleteRow filter, will not be called for other row actions.

Useful for adjusting the events triggered from the deleted row.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLDatabaseEvent | The event that's about to be triggered against the event listeners. |
| query | InanoSQLQuery | The query object for this action. |

### configTable

Called on `alter table` or `create table` queries.  This filter is called just before the table is actually created in the backend database, can be used to adjust data models, indexes, etc or suppress tables from being created based on specific conditions.

**Filter Properties**

| **Property** | Type | Description |
| :--- | :--- | :--- |
| res | InanoSQLTableConfig | The data model and other properties describing this table. |
| query | InanoSQLQuery | The query object for this action. |

## Adapter Filters

These filters sit right on top of the selected database adapter, allowing you to adjust, suppress or completely take over requests sent into the backend database.

These filters are unique, you can use the callbacks to complete the request being passed through the filter, meaning you can replace or enhance the behavior of the built in adapter being used.

If you decide to use the callbacks to complete the request in your filter, make sure you don't call the filter`complete` callback.

### adapterWrite

Can be used to adjust, suppress or listen for write requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>pk: Any,</p>
        <p>row: Any,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterRead

Can be used to adjust, suppress or listen for read requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>pk: Any,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterReadMulti

Can be used to adjust, suppress or listen for multi row read requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>type: "range" | "offset" | "all"</p>
        <p>offsetOrLow: number,</p>
        <p>limitOrHigh: number,</p>
        <p>reverse: boolean,</p>
        <p>onRow: (row: any) => void,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterDelete

Can be used to adjust, suppress or listen for delete requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>pk: Any,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterConnect

Can be used to adjust, suppress or listen for the connect request into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>id: String,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterDisconnect

Can be used to adjust, suppress or listen for the disconnect request into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterCreateTable

Can be used to adjust, suppress or listen for create table requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>tableName: String,</p>
        <p>tableData: InanoSQLTable,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterDropTable

Can be used to adjust, suppress or listen for write requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterGetTableIndex

Can be used to adjust, suppress or listen for get table index requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action</td>
    </tr>
  </tbody>
</table>

### adapterGetTableIndexLength

Can be used to adjust, suppress or listen for requests to get a length of records for a table in the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterCreateIndex

Can be used to adjust, suppress or listen for create index requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>indexName: String,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterDeleteIndex

Can be used to adjust, suppress or listen for delete index requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>indexName: String,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterAddIndexValue

Can be used to adjust, suppress or listen for requests to add an index value into a database index

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>indexName: String,</p>
        <p>key: any,</p>
        <p>value: any,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterDeleteIndexValue

Can be used to adjust, suppress or listen for requests to remove an index value into a database index

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>indexName: String,</p>
        <p>key: any,</p>
        <p>value: any,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterReadIndexKey

Can be used to adjust, suppress or listen for index key read requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>indexName: String,</p>
        <p>pk: Any,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

### adapterReadIndexKeys

Can be used to adjust, suppress or listen for multi key index read requests into the database

**Filter Properties**

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
      <td style="text-align:left">res</td>
      <td style="text-align:left">
        <p>{</p>
        <p>table: String,</p>
        <p>indexName: String,</p>
        <p>type: "range" | "offset" | "all"</p>
        <p>offsetOrLow: number,</p>
        <p>limitOrHigh: number,</p>
        <p>reverse: boolean,</p>
        <p>onRow: (row: any) => void,</p>
        <p>complete: (pk: any) => void,</p>
        <p>error: (err: any) => void</p>
        <p>}</p>
      </td>
      <td style="text-align:left">The properties and callbacks used to complete this action.</td>
    </tr>
    <tr>
      <td style="text-align:left">query</td>
      <td style="text-align:left">InanoSQLQuery</td>
      <td style="text-align:left">The query object for this action.</td>
    </tr>
  </tbody>
</table>

## More Filters

If your plugin could use a filter that hasn't been provided, please [submit an issue](https://github.com/ClickSimply/Nano-SQL/issues) describing where you'd like to see the new filter\(s\).

Adding filters has a size and performance cost, so they'll only be added where absolutely needed.
