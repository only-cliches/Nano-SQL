# Nano-SQLite3
SQLite3 Driver for [Nano SQL](https://nanosql.io/)

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">

[![NPM](https://nodei.co/npm/nano-sqlite.png?downloads=true&stars=true)](https://nodei.co/npm/nano-sqlite/)

## [Documentation](https://docs.nanosql.io/)

## Installation
```sh
npm i --save nano-sqlite
```

## Usage
```ts
import { nSQL } from "nano-sql";
import { nSQLiteAdapter, sqlite3 } from "nano-sqlite";

nSQL("table")
.model([...])
.config({
    mode: new nSQLiteAdapter(":memory:", sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE),
    ...other config options
}).connect()...
```

That's it, now everything NanoSQL can do you can do with SQLite.

Read about NanoSQL [here](https://nanosql.io/).

# API

When you call `new nSQLiteAdapter` the arguments are exactly the same as for [`node-sqlite`](https://github.com/mapbox/node-sqlite3).

The first argument is optional, it's the name of the SQLite database to create. Leaving the argument empty is the same as passing in ":memory:", which will cause the SQLite database to operate in memory only mode.  Passing in a string will cause it to make a database and use that as it's name.

The second argument is optional, One or more of `sqlite3.OPEN_READONLY`, `sqlite3.OPEN_READWRITE` and `sqlite3.OPEN_CREATE`. The default value is `OPEN_READWRITE | OPEN_CREATE`.

When using this adapter the id you pass into the config object will be ignored.

