Super flexible database/datastore for the client, server & mobile devices.
<center>
<img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/logo.png" alt="nanoSQL Logo">


[![npm](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/ClickSimply/nano-sql/blob/master/LICENSE)
![TSlint](https://img.shields.io/badge/tslint-passing-green.svg?style=flat-square)
[![npm downloads](https://img.shields.io/npm/dm/nano-sql.svg?style=flat-square)](https://www.npmjs.com/package/nano-sql)

[![NPM](https://nodei.co/npm/nano-sql.png?downloads=true&stars=true)](https://nodei.co/npm/nano-sql/)
</center>

NanoSQL 2.0 is in BETA state right now, tons of (undocumented) breaking changes.

Current minified build:
https://cdn.jsdelivr.net/npm/@nano-sql/core@2.0.0-rc2/dist/nano-sql.min.js

NPM Install
```sh
npm i @nano-sql/core
```

#Example

```ts
nSQL().connect({
    id: "test",
    tables: [
        {
            name: "users",
            model: [
                { key: "id:uuid", props: ["pk()"] },
                { key: "name:string" },
                { key: "age:int", default: 18 },
                { key: "meta:obj", model: [
                    {key: "color:string"}
                ] },
                { key: "tags:string[]", default: [] }
            ],
            indexes: [
                { name: "Tags", key: "tags:string[]" },
                { name: "Color", key: "meta.color:string" },
                { name: "Age", key: "age:int"}
            ]
        }
    ],
}).then(() => {
    return nSQL("users").query("upsert", {name: "Jeb", age: 20, meta: {}, tags: []}).exec();
}).then(() => {
    return nSQL("users").query("select").exec();
}).then((rows) => {
    console.log(rows);
})

```

#2.0 Progress
- [x] Query Engine
- [x] Hook/Filter System
- [x] Memory/Local Storage Adapter
- [ ] ORM Updates
- [ ] Event System
- [ ] Core Tests
- [ ] Adapter Tests
- [ ] Indexed DB/WebSQL/RocksDB Adapters
- [ ] 1.x migration script
- [ ] 2.0 documentation
- [ ] 2.0 release
- [ ] SQLite3, Cordova, Redis, ReactNative, MySQL Adapters
- [ ] Net Plugin (Offline Syncing)
- [ ] Search Plugin
- [ ] History Plugin
- [ ] SQLite Query Support
- [ ] GraphQL Query Support
- [ ] MongoDB Query Support
- [ ] ReQL Query Support