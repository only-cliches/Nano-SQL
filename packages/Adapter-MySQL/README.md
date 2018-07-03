# Nano-MySQL
MySQL Driver for [Nano SQL](https://nanosql.io/)

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">

[![NPM](https://nodei.co/npm/nano-mysql.png?downloads=true&stars=true)](https://nodei.co/npm/nano-mysql/)

## [Documentation](https://docs.nanosql.io/)

## Installation
```sh
npm i --save nano-mysql
```

## Usage
```ts
import { nSQL } from "nano-sql";
import { MySQLAdapter } from "nano-mysql";

nSQL("table")
.model([...])
.config({
    mode: new MySQLAdapter({ // required
            host: "localhost",
            database: "test",
            user: "root",
            password: "secret"
    }),
    ...other config options
}).connect()...
```

That's it, now everything NanoSQL can do you can do with MySQL.

Read about NanoSQL [here](https://nanosql.io/).

# API

When you call `new MySQLAdapter` the adapter internally calls `mysql.createPool()` from the [mysql package](https://www.npmjs.com/package/mysql#pooling-connections).

The default pool size is 20, you can modify this with the `connectionLimit` property.  All of the typical configuration options you would use are in the example above, refer the [mysql package documentation](https://www.npmjs.com/package/mysql#pooling-connections) for an exaustive list of options.
