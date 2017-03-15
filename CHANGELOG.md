# Change Log

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