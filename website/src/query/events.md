# Events

Events can be used to listen for specific events that happen in the database.  All events will conform to the `InanoSQLDatabaseEvent` interface.

You can listen to events with `nSQL().on("event", callback")` and disable listening with `nSQL().off("even", callback)`.

The supported database events are:

* **connect** called when the database adapter successfully connects to the backend
* **ready** called when tables are configured and the nanoSQL is ready for queries.
* **disconnect** called when the database adapter has disconnected.

Database events ignore table selection and aren't effected by which table is selected in the query.  For example `nSQL("users").on("ready", ...)` will do exactly the same thing as `nSQL().on("ready", ...)`.

Supported table specific events are:

* **select** called when a row is selected on this table
* **change** called when a row is updated, inserted or deleted from this table
* **delete** called when a row is removed from this table
* **upsert** called when a row is updated or added to this table.

With table specific events, you must select the table you intend to listen to before calling the `.on()` or `.off()` event listeners.

**Important note about `change` and `upsert` events**

When the event is triggered, there will always be a `result` property in the event object containing the final row that was added or modified.  However, if the row was modified an additional property named `oldRow` will be present which contains the state of the row before the query.  New rows will not have a `oldRow` property in the event object.
