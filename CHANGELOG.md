# Change Log

## [1.7.0]
- Merged PR from [dtiem](https://github.com/ditiem) that increased limit/offset performance by 17%.
- Combined NanoSQL into a monorepo as suggested in [issue 58](https://github.com/ClickSimply/Nano-SQL/issues/58).
- Fixed issue [59](https://github.com/ClickSimply/Nano-SQL/issues/59) regarding primary key write errors not propagating.
- Fixed Issue [57](https://github.com/ClickSimply/Nano-SQL/issues/57), IndxedDB versions can now be specified with `idbVersion` in the config object.

## [1.6.9] 6-14-2018
- Removed `HAVE` from sanity check.
- Merged PR [54](https://github.com/ClickSimply/Nano-SQL/pull/54) for LevelDB optional requires.
- Removed `src` folder from `.npmignore` becuase it's needed by the new source maps.

## [1.6.8] 6-13-2018
- Added sanity checking for where queries that require an array value.
- Issue [49](https://github.com/ClickSimply/Nano-SQL/issues/49) moved LevelDB to optional dependencies.

## [1.6.7] 6-12-2018
- Issue [49](https://github.com/ClickSimply/Nano-SQL/issues/49) actually resolved this time with new LevelDB API.
- Resovled Issue [52](https://github.com/ClickSimply/Nano-SQL/issues/52), added .npmignore file as suggested.
- Fixed typedoc build.
- Sourcemaps are now included in the build.

## [1.6.6] 6-6-2018
- Fixed an issue with secondary indexes not writing on empty string value.

## [1.6.5] 6-5-2018
- Added support for deeply nested where statements, used to group conditions together.  Like this:
```ts
nSQL("table").query("select").where([
    ["age", "=", 23], "AND" [
        ["favoriteColor", "=", "blue"], "OR", ["favoriteColor", "=", "orange"]
    ]
]).exec()...
```

## [1.6.4] 6-4-2018
- Disabled query cache again as it's causing issues with offset/limit. Fixed [50](https://github.com/ClickSimply/Nano-SQL/issues/50).
- Added optional constructor argument to LevelDB adapter for issue [49](https://github.com/ClickSimply/Nano-SQL/issues/49).

## [1.6.3] 5-27-2018
- Using cache secondary index performance penalty is now only 10-50% depending on the adapter being used.
- Query queue is only used when cache is disabled now.
- Restored cache feature with peer mode.
- You no longer need to call `connect()` before performing queries.  The queries will now wait until `connect()` completes to execute.

## [1.6.2] 5-24-2018
- Fixed [46](https://github.com/ClickSimply/Nano-SQL/issues/46) with LevelDB not handling auto incriment correctly.
- Fixed [45](https://github.com/ClickSimply/Nano-SQL/issues/45) with IndexedDB not reconnecting if new databases were added to an existing indexed db store.
- Progress on [47](https://github.com/ClickSimply/Nano-SQL/issues/47).  Secondary index performance increase substantially, went from 10-30x  to 3-5x.
- Fixed bug where passing in a non existent table to "describe table" query would lead to an error.  Now it returns a valid response.
- Fixed bug where passing falsey values into secondary index didn't work, now the secondary index will only fail to index `undefined` values.

## [1.6.1] 5-20-2018
- Added observable queries with a small collection of observable modifiers.
- Cache feature has been restored, [#34](https://github.com/ClickSimply/Nano-SQL/issues/34) example is now working.
- Added multitab syncing for web browser based databases.
- Added `peer` mode where multiple tabs can communicate events about the same database.  Only works in the browser and should be used on combination with IndexedDB/WebSQL/LocalStorage.  Example Usage: `.config({peer: true, mode: "PERM"})`.
- Finally found the problem with mangling the props, restored that and it's reduced the browser build size by quite a bit.
- Added tests.

## [1.6.0] 5-19-2018
- Fixed an issue with search() queries not working anymore.
- Now using better, more reliable queue implementation courtesy of [queue](https://www.npmjs.com/package/queue).
- Updated all dependencies with ncu -u.
- Added tests for new search feature.
- Improved LIKE query behavior, matches much closer to MySQL behavior now.
- Fixed primary key range select.

## [1.5.9] 5-18-2018
- Fixed secondary index range select issue.
- Added secondary index range tests.
- Better upsert performance on WebSQL.

## [1.5.8] 5-17-2018
- Fixed issue [43](https://github.com/ClickSimply/Nano-SQL/issues/43), secondary indexes, ORM queries and denormalization queries are now ran in a queue to prevent conflicts.
- Cleaned up build system a little.

## [1.5.7] 5-15-2018
- Fixed LIKE queries when column value isn't string.

## [1.5.6] 5-14-2018
- Fixed LIKE queries when column value is undefined.

## [1.5.5] 5-13-2018
- Added feature to allow multiple joins in a single query. [41](https://github.com/ClickSimply/Nano-SQL/issues/41).
- Fixed issue [42](https://github.com/ClickSimply/Nano-SQL/issues/42) with range queries on secondary indexes.

## [1.5.4] 5-2-2018
- Fixed an issue with the default database index.

## [1.5.3] 5-1-2018
- Added `ns()` prop to disable primary key sorting, useful for speeding up inserts on large data sets.
- Fuzzy search indexes don't use sorted indexes by default now.
- Added stop word index to fuzzy search system tokenizer.
- Improved tokenizer to normalize numbers and fractions.
- Added `crow()` query capability, now you can grab rows by their distance from a given GPS point. Usage: `nSQL("table").query("select").where(["crow(latitude, longitude)", "<", 3.5]).exec()`.  Defaults to kilometers for the distance.  Rows must have columns of `lat` and `lon` to work.  If `lat` and `lon` are secondary indexes the query uses an optimized read path and goes MUCH faster.
- Fixed bug with NULL and NOT NULL.
- More work on the new readme.
- Added new `whereFunction` capability used by levenshtein and crow features.  Developers will be able to add their own where functions as they want.

## [1.5.2] 4-24-2018
- Added better error handling for IndexedDB.
- Added support to upsert multiple records when using an array: `nSQL("table").query("upsert", [{name: "billy"}, {name: "joel"}]).exec();`
- Fixed issue [#37](https://github.com/ClickSimply/Nano-SQL/issues/37) with the database not connecting when history is enabled.
- Fixed issue [#36](https://github.com/ClickSimply/Nano-SQL/issues/36) with ORM queries not working against non array values.
- Fixed issue [#34](https://github.com/ClickSimply/Nano-SQL/issues/34), cache was not disabeling when `cache:false` was passed into the config object.
- Cache is temporarily disabled until I can find the root cause of the cache issue described in [#34](https://github.com/ClickSimply/Nano-SQL/issues/34).

## [1.5.1] 4-22-2018
- LIKE now uses MySQL LIKE syntax with `%` and `_` characters.
- Added `levenshtein` query operator to allow you to get rows based on levenshtien distance. Usage: `nSQ("users").query("select").where(["levenshtein(wordToCompare, column)", "<", 4]).exec()..`
- Moved to a different, much faster (3x), Levenshtein implementation.
- Fixed `.range()` implementation to match `.limit().offset()` behavior, added test to make sure it stays that way.
- Added is connected check on each query to return better error messages.
- All errors now show `nSQL` prefix.
- IndexedDB no longer has a "Webworkers" option, this reduces the build size and increases security since we no longer need to use blob workers or eval.
- Added a new browser based test for all the browser based adapters.
- Updated binary search again, it wasn't working with the new adapter tests. 

## [1.5.0] 4-18-2018
BREAKING CHANGE (Custom Function API), PLEASE READ THE [MIGRATION GUIDE](https://docs.nanosql.io/fine-print/migration)
- Raw import now happens incrimentally and has a onProgress callback.
- Rebuilding search index and secondary indexes now have onProgress callback.
- `default` was overwriting at incorrect times, fixed bug and added tests.
- Functions weren't working on JOIN queries, fixed and added tests.
- New faster binary search implimentation.

## [1.4.9] 4-17-2018
- Fixed search bug with null rows.
- Fixed CSV import bug.

## [1.4.8] 4-16-2018
- Added levenshtien distance to fuzzy search relevance calculations.
- Added further optimizations to the new elastic search features.
- Added MySQL Adapter and React Native to README.
- Restored `default` column behavior and added test for it.

## [1.4.7] 4-15-2018
- Fixed issue with LevelDB and search feature.
- Fixed issue with search feature and optimized query checking.
- Forgot to do `return this` on `.rowFilter`.

## [1.4.6] 4-15-2018
- Fixed CSV Export and Import formating.
- Restored `.rowFilter` feature.
- Added fuzzy search capability to elastic search features.

## [1.4.5] 4-15-2018
- Fixed and restored query cache features.
- Added elastic search style feature, where rows can be indexed, words stemmed, and searches happen much faster.  Will add testing and documentation later as the feature is found to be stable.

## [1.4.4] 4-14-2018
- Fixed `.where()` statement bugs, added a bunch of test conditions to prevent this kind of thing from popping up again.
- Fixed issue with `_util` table.

## [1.4.3] 4-9-2018
- Moved package.json dependencies into their appropriate sections.
- Added a new `.extend("flush")` command to clear all contents of the database.

## [1.4.2] 4-7-2018
- Fixed minifaction of IndexedDB web worker in build.
- Better performance on range selects.
- Added `.disconnect()` method.
- Table scan `.where()` conditions are much faster now.
- Fixed for React Native compability.
- Adjusting the props API: `"pk"` is now `"pk()"`, `"ai"` is now `"ai()"`, etc..

## [1.4.1] 4-5-2018
- Added `onProgress` function to `loadCSV` and `loadJS` methods.
- Trie objects are populated much faster now on connect.
- A few minor performance and code optimizations.
- Typedoc now works with newest version of Typescript!  Joyously restored Typedocs.
- Updated all dependencies.
- Cleaned up comments a bunch since they're visible in Typedocs again.

## [1.4.0] 3-23-2018
- Fixed denormalization `toColumn` bug.
- Fixed aggregate functions returning nothing if there are no result rows.

## [1.3.9] 3-20-2018
- Added ability to debounce denormalization calculations.
- CSVs are handled much better now.
- Added optional `filter` function argument to `.loadCSV` method, lets you adjust the rows after they've been parsed from the CSV and before they're put into the db.

## [1.3.8] 3-19-2018
- Added way to access data models for each table.

## [1.3.7] 3-18-2018
- Added aggregate denormalization features.

## [1.3.6] 3-6-2018
- Fixed an issue with event triggering.

## [1.3.5] 2-17-2018
- Fixed an issue with sub optimized queries.
- Added optional disconnect method to adapters.

## [1.3.4] 2-13-2018
- Fixed issue with `.extend("clone"...)`.
- Now supports secondary adapters for live backups.

## [1.3.3] 2-11-2018
- Removed unnecessary argument from database adapter implimentation.
- Working on new readme.
- Working on denormalization features.
- Added wildcard column `{key: "*", type: "*"}` that disables column sanitization.

## [1.3.2] 2-9-2018
- Removed the query pool feature for now for better stability.
- Fixed issue with WebSQL batch and range reads.

## [1.3.1] 2-6-2018
- Added Redis to supported database adapters.

## [1.3.0] 2-4-2018
- Fixed an issue with scoping on loadJS and loadCSV

## [1.2.9] 2-3-2018
- Added storage adapter passthrough.  Can be used with `.extend("get_adapter")`.

## [1.2.8] 2-2-2018
- Fixed issue with primary key detection.

## [1.2.7] 2-2-2018
- Fixed an issue with optimized reads.

## [1.2.6] 1-29-2018
- Started work for adding denormilzed view feature.
- Updated fastALL to use `Promise.all`.

## [1.2.5] 1-28-2018
- Added methods to access views and actions for a given table.

## [1.2.4] 1-25-2018
- Fixed an issue with secondary index rebuild process.
- Fixed an issue with plugin initialization.
- Added primary key/secondary index `.where()` optimization to search within a result set.
- Better optmimized the select statement read path.

## [1.2.3] 1-22-2018
- Fixed an issue with the primary keyless implementation.

## [1.2.2] 1-22-2018
- Added Google Cloud Datastore adapter to readme.
- Fixed issue with `.extend("clone")`.
- We support tables without primary keys again (yay!).
- Secondary indexes better support range queries with number columns.
- UUID format was incorrect, fixed now.
- Updated dependencies.

## [1.2.1] 1-19-2018
- Added new optional `batchRead` method to adapaters, handles parallel key requests on the same table.
- Fixed secondary index range query issue.
- `.extend("clone")` copies over one table at a time now instead of all at once.
- Added `batchRead` method to WebSQL. Fixed bug with WebSQL string based primary keys.

## [1.2.0] 1-14-2018
- Fixed secondary index rebuild doing redudant work.
- Fixed seconday index read issue.
- Added new `.extend("clone")` that lets you copy all data from the current adapter being used to another one.
- Fixed an issue with a LevelDB dependency.

## [1.1.9] 1-7-2018
- Added safety checks on data model creation.
- ReadME updates.
- Removed depreciated `CHAIN` and `ALL` classes.  Use `fastCHAIN` and `fastALL` instead.
- Added `groupBy` option to ORM queries.

## [1.1.8] 1-5-2018
- The npm package `marked` was in package-lock.json, has since been removed.

## [1.1.7] 12-31-2017
- Fixed nodejs dependency issue.

## [1.1.6] 12-31-2017
- Added `.onConnected()` method.  You can pass a callback that will either get called right away if the database is already connected or it'll get called once the database connects.
- Added `.rawDump()` method, kicks out the contents of all database tables and their rows.
- Added `.rawImport()` method, lets you import table contents directly without type checking, indexing or anything else fancy.

## [1.1.5] 12-27-2017
- If you were using webpack/browserify with nanoSQL then your bundler was smelling a nodejs specific dependency and bloating your bundle by about a hundred kilobytes... for no reason (sorry about that).  The lib has been adjusted to resolve this.

## [1.1.4] 12-26-2017
- Wrote a [Vue Mixin](https://www.npmjs.com/package/nano-sql-vue).
- Added `.isConnected` property needed by Vue Mixin.

## [1.1.3] 12-26-2017
- Wrote a [React HOC](https://www.npmjs.com/package/nano-sql-react) and refactored todo example using it.
- `window["nano-sql"]` is now exposed as an entry point.

## [1.1.2] 12-25-2017
- Removed minify settings to fix history bug.

## [1.1.1] 12-25-2017
- Fixed bug with event system.
- Added integration test for event system.

## [1.1.0] 12-25-2017
- Over 2x write and read performance in this update.
- Updated promise library to get better setImediate polyfill.
- ALL and CHAIN methods now return a real Promise.
- ALL and CHAIN methods rewritten to improve performance.
- Several more performance improvements.
- Simple write test for 100 rows: Before: ~35ms, After: ~15ms

## [1.0.5] 12-21-2017
BREAKING CHANGE, PLEASE READ THE [MIGRATION GUIDE](https://docs.nanosql.io/fine-print/migration)
- This release is focused on performance, 2 - 4x increase in query speed should be seen most of the time.
- Promise lib now only polyfills, otherwise the native browser/NodeJS Promise implimentation is used.  Benchmarks show a double in query performance from this one change...
- Removed secondary index queries on upsert if there are none.
- Added conditional to skip event logic if it's not needed.
- Simple write test for 100 rows: Before: ~140ms, After: ~35ms

## [1.0.4] 12-17-2017
- Added table types to action/view arguments.  You can now use table names as a type in action/view arguments to cast an argument to a specific table's data model.
- Fixed a bug with avFilter function.

## [1.0.3] 12-15-2017
- Updated all history and ORM queries to keep them from changing the table pointer set by the user.
- Added NanoSQL Cordova plugin to readme.
- Fixed `.manualExec()` method and query to work correctly.

## [1.0.2] 12-15-2017
- Added public `getConfig()` method that allows you to read the config parameters.
- Updated to a hashing function that is 3x faster.

## [1.0.1] 12-12-2017
- Moved adapter tests to their [own git repository](https://github.com/ClickSimply/NanoSQL-Adapter-Test).
- Added selective cache invalidation.  Now the cache will store the primary keys for each select statement, then only invalidate the cache when that primary key is affected in some way.

## [1.0.0] 12-10-2017
MANY BREAKING CHANGES, PLEASE READ THE [MIGRATION GUIDE](https://docs.nanosql.io/fine-print/migration)
This build is intended to stabilize the library, increase performance and make it easy to extend in the future.  The API for v1.X.X releases will be very stable moving forward.
*****
- Complete rewrite of the database engine, ORM system, and history system.
- History can now be database wide (default), table wide or row wide.
- Implimemented new plugin system with lifecycle events of every query.
- The new built in storage engine uses the new plugin system, allowing you to remove/adjust how queries are handled.
- Completely removed the old custom backend system and added a new adapter system.
- You can no longer run the built in memory db with persistence.
- All database adapters now use a sorted B-Tree index to gaurantee consistency.
- You can use instance tables with nSQL queries. ex: nSQL([{name: "Bill"}, {name: "Bob"}]).query("select")....
- History is no longer enabled by default.
- Added WebSQL support. Safari in iOS/macOS will use WebSQL by default.
- Added support for running IndexedDB in a webworker.
- Added new INTERSECT and NOT INTERSECT .where() comparators.  To check if any array values intersect with any values in an array of the database column.
- .where() statements now accept a function, much like filter: `nSQL("table").query("select").where(row => row.age > 20).exec()`
- Tables without a primary key are no longer supported, unless it's an instance table.
- Added `loadCSV` method to automate importing CSVs into the database.
- You can now get the version of NanoSQL being used with `nSQL().version`.
- Database versions will now be tracked to make automatic migration changes in the future.
- `updateORM` query has been removed entirely.
- ORM updates now happen along side `upsert`, `delete` and `drop` queries.
- ORM updates are more consistent and way more performant.
- Added a large number of integration tests.

## [0.9.3] 10-15-2017
- Added changed rows property to database events.

## [0.9.2] 10-2-2017
- Fixed a bug with the event system running into an error and preventing further errors from being fired.

## [0.9.1] 8-26-2017
- Added "NOT LIKE" and "!=" comparisons for queries.  Not sure how I got by without using these for so long.

## [0.9.0] 6-21-2017
- Added "NULL" and "NOT NULL" as valid query values; example: `["column", "=", "NULL"]`.
- Changed type casting system to allow null values into the database if no default is set.
- `.length` queries now work on all columns that have a valid length property, example `string` and `safestr`.
- Added bracket notation to where statements to let you check against sub propertys, example: `["meta[hairColor]", "LIKE", "blue"]`.
- The bracket notation also works for `orderBy` and `groupBy` queries.
- Bracket notation also works with `.length` queries: `["meta[postIDs].length", ">", 2]`.

## [0.8.92] 6-14-2017
- Updated to the newest version of Lie-TS, fixing an issue with MS Edge and IE.

## [0.8.91] 6-13-2017
- Small size improvement.
- Added two new config options to the default DB: `writeCache` and `readCache`.  Lets you adjust those values for LevelDB (in MB).

## [0.8.9] 6-9-2017
- Merged Pull request #14.

## [0.8.82] 6-9-2017
- Resolved another issue with complicated `where` statements.

## [0.8.81] 6-6-2017
- Fixed an issue with combined `where` statements.

## [0.8.8] 6-3-2017
- Made `manualExec` a public method of `query`, allowing you to pass the query object itself instead of using `.where().join()...`.
- Added `*` event to trigger on all database events.
- Made selected table variable public.
- Fixed event handler always showing the event type as "error".

## [0.8.72] 6-3-2017
- BREAKING CHANGE: `describe` queries have been reshaped and now also return the primary key and number of rows of the selected table.
- Fixed an issue with ORM updates on deletes.

## [0.8.71] 6-1-2017
- Added `NOT HAVE` where condition, to find records that don't have a specific value inside an array column.

## [0.8.7] 5-31-2017
- Fixed an issue with combined where statements.
- Fixed an issue causing the event objects not to populate in time.
- Slightly optimized full table scans with `where` statements.

## [0.8.63] 5-30-2017
- Fixed ORM issue with accidental duplication of references.

## [0.8.62] 5-29-2017
- Fixed an issue with default row values not being set.
- Adjusted the internal `_assign` method to check if the object is frozen before running JSON operations.

## [0.8.61] 5-27-2017
- Fixed some ORM issues, the ORM system is a much more stable feature now.
- Promise.chain method was not actually chaining methods but running them all at once, causing big problems when sequential processing is needed.  Switched to a different chaining method, helping to stabilize the history and ORM system more.

## [0.8.6] 5-25-2017
- The NanoSQLInstance method `random16bits` is now public instead of private.
- Fixed an issue with the ORM not correctly removing entries.

## [0.8.54] 5-23-2017
- Fixed an issue where CSV export would skip undefined/false columns entirely, breaking the column alignment.

## [0.8.53] 5-22-2017
- Fixed an issue where the query would error when using columns containing `undfined`.

## [0.8.52] 5-20-2017
- Fixed an issue with compound where statements using primary or secondary keys.
- Added optional argument to `loadJS` and `loadCSV` to disable transactions for the import.
- More history bugfixes.

## [0.8.51] 5-19-2017
- BREAKING CHANGE: `["orm::..."]` model props should be changed to `["ref=>..."]`.
- Fixed a few issues with the history system.
- Updated Todo example with different CSS lib.

## [0.8.5] 5-17-2017
- BREAKING CHANGE: Reworked transaction system to allow parallel transactions. See new API in the documentation.
- Restored query memoization.
- [Issue #11](https://github.com/ClickSimply/Nano-SQL/issues/11) fully resolved.

## [0.8.41] 5-16-2017
- [Issue #11](https://github.com/ClickSimply/Nano-SQL/issues/11) partially implimented, history triggered events now return the rows after the history action was performed.
- Fixed an issue with the ORM imports with loadJS and loadCSV.

## [0.8.4] 5-13-2017
- Updated the lib logo and chose a mascot, the hummingbird. :)
- Added a complete ORM system.
- `.length` can now be used with array/orm columns for most queries:
    select: `.query("select",["arrayColumn.length AS Total"])`
    where: `.where(["arrayColumn.length", ">", 2])`
    groupBy: `.groupBy({"arrayColumn.length":"asc"})`
    orderBy: `.orderBy({"arrayColumn.length":"asc"})`
- Temprarily disabled query memoization to resolve ORM issue.  Memoization does not get along with transactions very well.

## [0.8.31] 5-11-2017
- Fixed an issue preventing falsy like values from being inserted into the database.

## [0.8.3] 5-9-2017
- Fixed an issue with history not working for the memory only store.

## [0.8.21] 4-28-2017
- Restored `blob` and `any` as valid types.

## [0.8.2] 4-28-2017
- Integration tests written, all basic SQL functions covered now.
- Fixed a variety of small bugs discovered by the tests.
- A few small code optimizations.

## [0.8.1] 4-24-2017
- Added new `safestr` type, identical to `string` except it escapes all HTML and unsafe JSON charecters.
- Fixed drop/delete bug.
- Fixed an issue with callstack exceeded when type casting specific types.

## [0.7.92] 4-17-2017
- Fixed `null` values in string columns being type casted to `"null"`.

## [0.7.91] 4-13-2017
- Fixed secondary indexes not removing old entries.
- Moved secondary index updates out of the transaction loop, writes twice as fast now.

## [0.7.9] 4-11-2017
- Updated promise lib with smaller setImediate polyfill, in browser performance is 10x and lib is only 200 bytes larger.
- Moved Trie implimintation to external lib.
- Increased leveldown write buffer size.
- Added trie to primary key indexes, writes are 10 - 20x faster now.

## [0.7.8] 4-11-2017
- Fixed an issue with joins.
- Tries now rebuild after transactions.
- Fixed an issue with tries not pulling results from the data store correctly.

## [0.7.75] 4-11-2017
- Fixed UglifyJS breaking the history system.
- Small size/performance optimizations.

## [0.7.7] 4-10-2017
- Switched to internal, smaller trie implimentation, reduced gzip size by more than half a kb.
- Removed setImediate polyfill, saved another gzip half kb.
- Fixed multiple bugs with the history system:
1. Changes to the same row would sometimes overwrite previous row edits.
2. History state wouldn't persist correctly into indexedDB/LevelUP
3. The code that cleans future history points wasn't working correctly.
- Improved write speed significantly.
- History Points now have an in memory secondary index, increasing the history undo/redo performance significantly.

## [0.7.61] 4-9-2017
- Trigger change events after transactions now only affect the tables that the transaction touched.
- Restored memory db usage.

## [0.7.6] 4-8-2017
- Secondary indexes and trie indexing now support multiple rows per entry. Existing secondary indexes should be rebuilt with `rebuildIndexes:true` before using this version.
- Added naive event triggering on all tables after a transaction.

## [0.7.5] 4-7-2017
- Removed transactions from index rebuilding, this was causing the index rebuild to fail on data sets in the thousands.
- Removed automatic index sorting to speed up inserts again.
- Added a trie implimentation that can be taken advantage of by entering `props: ["trie"]` into the data model.  The trie will always create a secondary index as well meaing `props: ["trie", "idx"]` is identical to `props:["trie"]`.
- Added setImmediate polyfill to increase promise speed, a significant factor contributing to poor performance.

## [0.7.4] 4-6-2017
- Finished secondary index support.  You can now add `props: ["idx"]` to a data model, when a secondary index or primary key is used in a where statement the data will be retrieved much faster.
- Added `rebuildIndexes:true` config parameter.  When passed, the lib will rebuild all secondary indexes before finishing the `connect()` command.  This is mainly to let folks add secondary indexes to existing data models.

## [0.7.3] 4-6-2017
- Added `range()` functionality to `join()` queries.

## [0.7.21] 4-6-2017
- Added a new `.range()` query modifier optimized for pagination style queries.
- Added a new `timeId` and `timeIdms` types that generates a unique, random sortable id with 32 bits of randomness.

## [0.7.1] 4-5-2017
- Implimented a new TS style array api for data models, the old style is kept around to prevent breaking changes but moving forward types of `array` should become `any[]`.  You can also typecast the array like `bool[]` and even nest the arrays like `string[][]`.
- Added new `any` type for data models, can be used with array type casting as well with `any` and `any[]`.
- Switched to setImmediate in NodeJS, write speed is now 8 records/ms, 800 times faster.
- Disabled history/event triggering for transactions to increase transaction speed.

## [0.7.0] 4-3-2017
- Added `uuid` interface.
- Fixed issue with existing indexes not being imported when memory: false and persistent: true.
- Removed code that added history meta for every row, even if history is disabled.
- Added transaction support to level DB.

## [0.6.93] 4-2-2017
- Added `id` config option to default storage driver.

## [0.6.92] 4-1-2017
- Code optimizations, removed local storage from clearing everything on setup.
- Removed global polyfill.

## [0.6.91] 3-31-2017
- Made `cleanArgs` method public.
- Added primary key range optimizations for Level DB and Indexed DB.
- Fixed issue with history when using UUIDs
- History is now disabled for tables with no primary key.
- Adjusted `BETWEEN` to be consistent regardless of data store being used.

## [0.6.8] 3-30-2017
- Added selected table to Action/View filter function.
- Added a misc data object to make passing around information easier.

## [0.6.6] 3-30-2017
- Added filter function for actions & views.
- Refactored Actions/views to take less space.
- Fixed bug with group by being used with functions.
- Adjusted events system a little.

## [0.6.5] 3-29-2017
- Added `HAVE` where condition useful for searching arrays in the database.
- Changed `LIKE` behavior where strings will be lowercased to match string values with different casing.
- Added error condition if `WHERE` or `HAVING` aren't passed any arguments.

## [0.6.4] 3-28-2017
- Fixed a bug that prevented LevelDB stores from restoring into the memory DB in some situations.
- Switched levelDB to JSON encoding.
- Fixed clear history bug.

## [0.6.3] 3-27-2017
- Fixed a bug caused by the primary key optimization that prevented compound where statements from working correctly.

## [0.6.2] 3-26-2017
- Added function to clear all history
- Added primary key opitmization to reads when you do `.where(["primaryKey","=",rowID])`. 
- Fixed some issues caused by uglifyJS.
- History flush and database flush now implimented completely.

## [0.6.1] 3-25-2017
- Cleaned up some of the code.
- Did some size optimizations.
- Fixed issue where resetting the database mode prevented the store from loading.
- Adjusted node/browser build.  Lib should work when being webpack included AND in node without work from the dev using it.

## [0.6.0] 3-25-2017
- Fixed an issue with UUIDs
- Refactored the abstraction layer and memory store to handle parallel queries.
- BREAKING CHANGE: loadCSV and loadJS now require you pass in the table as the first argument, then the data to import
- Added query filter method.
- Changed the way nodejs packages are being brought in.
- Added OPEN open contribution stuff to the ReadMe.
- Added license to ReadMe
- Fixed issue with NodeJS crypto

## [0.5.1] 3-24-2017
- Small bugfixes.

## [0.5.0] 3-24-2017
- BREAKING CHANGE: `before_import` and `after_import` have now been switched to `.beginTransaction()` and `.endTransaction()` syntax. See the docs.
- BREAKING CHANGE: The delete syntax was not deleting entire rows when no arguments were passed as it should, now it is.
- `config` parameters have been added to handle history, immutable functionionality, and persistent storage type.
- BREAKING CHANGE: `flush_db` now deletes in memory store and history as well, not just the persistent storage.
- Default store changes:
    - Persists history states to IndexedDB or localStorage.
    - Falls back to localStorage if IndexedDB isn't availble.
    - Persists in NodeJS using [LevelDB](https://github.com/Level/levelup). 
    - Rewritten to reduce memory usage dramatically when persist is true and memory is false.
    - Using transactions now allow you to chain multiple table updates/changes inside the same history point.
    - Added extra functions to the history system to give more control.
    - Join commands are twice as fast as before.

## [0.4.5] 3-14-2017
- BREAKING CHANGE: Did more research on how functions typically work in a SQL envrionment, changed the function implemintation again.
- Fixed a bug related to cross joins.

## [0.4.4] 3-13-2017
- Added `BETWEEN` condition.
- Fixed demo links.

## [0.4.3] 3-13-2017
- Changed Readme code sections to js to work with NPM better.

## [0.4.2] 3-13-2017
- Readme changes again.

## [0.4.1] 3-13-2017
- Readme changes.

## [0.4.0] 3-13-2017
- Switched (again) to another promise lib, ported from lie.js
- Changing lib name to "NanoSQL". Way cooler.
- Refactored data store: selects, upserts & joins are now twice as fast.
- Now supports tables without primary keys.
- Much better conformance to SQL standards.
- Added outer joins.
- Added more documentation.
- Added GroupBy statement.
- Added Having statement.
- Added `AS` handling in the select queries.
- Removed filter statement, changed filter/function handling.
- BREAKING CHANGE: The history pointer is now reversed from it's previous behavior. 
- BREAKING CHANGE: Filters are now Functions and no longer work like they did before, check the API docs. 

## [0.3.4] 3-7-2017
- ReadMe changes
- Fixed event handling bug.

## [0.3.3] 3-6-2017
- Changed the event handling.
- Adjusted examples a bit.

## [0.3.2] 3-5-2017
- Finished react draw example.
- Added error handling for improper connect() usage.

## [0.3.1] 3-4-2017
- Added a new "blob" row type that bypasses the JSON parsing and freeze functions.

## [0.3.0] 3-3-2017
- Fixed nodejs behavior if you have indexed db enabled.
- Fixed nodejs behavior with UUID crypto.
- Some performance and stability improvements.
- Switched to a better promise implementation.

## [0.2.9] 2-28-2017
- Restored JSON.parse(JSON.stringify()) in some places where recursive deep cloning is needed.
- Fixed a few small bugs.
- Added NodeJS Crypto to the UUID function.

## [0.2.8] 2-28-2017
- Added "default" behavior to data models.
- Added insert filters option to data models.
- All upserts are type casted now, regardless of their source.
- Upgraded to Typescript 2.2

## [0.2.7] 2-24-2017
- Fixed iOS bug with indexedDB.

## [0.2.6] 2-15-2017
- Fixed delete bug in Memory DB.
- Fixed event trigger issue with ReactJS.
- Cleaned up Readme a bit.

## [0.2.5] 2-14-2017
- Fixed some readme typos
- Added "clear" ability to indexedDB.

## [0.2.4] 2-13-2017
- Updated & cleaned up documentation a bit.
- Changed the few JSON.parse(JSON.stringify()) statements to Object.assign.
- Added Indexed DB functionality to memory db.
- Upgraded to Webpack 2.
- Restored UUID functionality.
- Added IndexedDB functionality.

## [0.2.3] 2-6-2017
- Fixed typo in package.json

## [0.2.2] 2-6-2017
- Fixed typings reference.

## [0.2.1] 2-6-2017
- Added Join API.
- Adjusted the node build.
- Started adding tests.
- Completely rewrote the Memory DB with significant performance and memory improvements.
- Memory DB now uses hash maps and indexes; no more deep copying.
- Memory DB now only returns immutable structures.
- Added history API to memory DB for stupid simple version control.
- Removed UUID function.
- Only marginal increase in lib size.

## [0.2.0] 1-28-2017
- Some size & speed optimizations.
- Fixed orderby bug.

## [0.1.9] 1-14-2017
- Added `strictNullChecks`, `noImplicitAny`, `noImplicitReturns`, and `noImplicitThis` to tsconfig.
- Made changes to code to remove errors introduced by stricter coding standards.
- Removed TSMap from the lib.
- Updated strongly typed TSPromise.

## [0.1.8] 1-7-2017
- Cleaned up README.
- Added "db" var to connect promise.
- Added extend capability to views and actions.

## [0.1.7] 1-3-2017
- Cleaned up typings on React Todo example.
- Removed some unneeded abstractions in the Memory DB
- Updated to new promise implementation.
- Updated README to reflect API changes.

## [0.1.6] 1-1-2017
- Added more typings data.
- Made some small changes to the ReadMe and Docs.
- Modified memory DB queries to always return an array of objects.
- Fixed Action/Views bug if you didn't pass arguments.
- Typescript now forces 'this' scoping, added DB argument to queries to resolve it.
- Added database variable to events.
- Added ReactJS Todo Example.

## [0.1.5] 12-31-2016
- Added optional "default" value in data models.
- Modified memory DB filters to always return an array of objects.

## [0.1.4] 12-30-2016
- Readme typos Fixed
- Added ability for custom functions to be called before the db is connected.
- Changed the way the custom arguments are handled to be more dynamic.
- Fixed the build so comments make it to the TSD files.

## [0.1.3] 12-28-2016
- Added a ton of documentation.
- Implemented TypeDoc
- Cleaned up a bunch of typings.

## [0.1.2] 12-28-2016
- Fixed a typo in one of the interface declarations.
- Cleaned up the readme a bit.
- Updated to newest Typescript map lib. 

## [0.1.1] 12-28-2016
- Updated TSPromise to newest version with scoping built in.
- Removed the special scoped promise class.
- Fixed examples to reflect the new class name to conform to TSLint standards.

## [0.1.0] 12-24-2016
First stable release, code is safe to start *thinking* about using in production environment.
- Added TSLint, the project now passes all TSLint checks.
- Settled the API down, shouldn't be changing much more moving forward.
- Two optimized builds are now generated, one for the browser and another for node.