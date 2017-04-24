# Change Log

## TODO
Recent benchmarks with LevelDB on a low end laptop:
Write:  ~2 record/ms 
Read: ~100 records/ms
- Test and improve performance of LevelDB on the server.
- Complete the SQLite driver.
- Use the SQLite driver to write integration tests.
- Write LevelDB Cordova plugin.

## [0.8.0] 4-24-2017
- Added new `safestr` type, identical to `string` except it escapes all HTML and unsafe JSON charecters.
- Fixed drop/delete bug.

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