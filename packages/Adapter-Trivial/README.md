# Nano-Trivial
[TrivialDB](https://www.npmjs.com/package/trivialdb) Driver for [nanoSQL](https://nanosql.io/)

Lets you use TrivialDB as a backend datastore for nanoSQL.

TrivialDB is a simple JSON file storage database.  All changes are saved to disk as JSON files allowing you to easily view and edit database contents.

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">

[![NPM](https://nodei.co/npm/nano-sqlite.png?downloads=true&stars=true)](https://nodei.co/npm/nano-sqlite/)

## [Documentation](https://docs.nanosql.io/)

## Installation
```sh
npm i --save nano-trivial
```

## Usage
```ts
import { nSQL } from "nano-sql";
import { TrivialAdapter } from "nano-trivial";

nSQL("table")
.model([...])
.config({
    mode: new TrivialAdapter(),
    ...other config options
}).connect()...
```

That's it, now everything NanoSQL can do you can do with TrivialDB.

Read about NanoSQL [here](https://nanosql.io/).

# API

When you call `new TrivalAdapter` there are two optional arguments, namespace arguments and database arguments.

The namespace arguments are documented [here](https://github.com/trivialsoftware/trivialdb#creating-a-namespace) and mostly allow you to adjust the location the files are saved to.

The database arguments are documented [here](https://github.com/trivialsoftware/trivialdb#options-1) and allow you to do more advanced things like controlling wethere the JSON files are pretty printed or not.