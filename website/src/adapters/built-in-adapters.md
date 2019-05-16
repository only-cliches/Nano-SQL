# Built in Adapters

NanoSQL comes with several adapters built into the library, you can use them without any additional libraries.

By default no data is saved, an in memory database is created and used.

Using the methods below you can instead tell nanoSQL to persist its data to a multitude of places.

## Browser

In the browser you can use IndexedDB, WebSQL or Local Storage. The best way to go here is just let nanoSQL autodetect the best method to persist data depending on the browser the user is on.

### Autodetect

```typescript
nSQL().createDatabase({
    mode: "PERM" // autodetect best method and persist data.
    id: "my_db",
    tables: [...]
}).then...
```

If you want specify which persistent method to use you can pass different strings into `mode` and nanoSQL will attempt to use that instead. If you pass in a datastore that doesn't work in the environment nanoSQL is in then it will not attempt any fallbacks but just fail to work.

|  | Uses | Supports | Max Data |
| :--- | :--- | :--- | :--- |
| TEMP | Memory | Everything | 100MB+ |
| PERM | Autodetect | All Browsers | 5 - 100MB+ |
| IDB | Indexed DB | All Browsers\*\* | 50MB+ |
| WSQL | Web SQL | Chrome & Safari\*\* | 100MB+ |
| LS | Local Storage | All Browsers | 5MB |

* \*\* Indexed DB and WebSQL aren't supported by older browsers.

As a result of the chart above, when you pass in `PERM` the autodetect method typically drops the browsers in like this:

* **Chrome, Firefox, Edge & IE**: IndexedDB
* **Safari & iOS**: WebSQL

## NodeJS

With NodeJS you really have only two choices: Memory or RocksDB. The same API in the browser also works in nodeJS:

```typescript
nSQL().createDatabase({
    mode: "PERM" // autodetect best method and persist data.
    id: "my_db",
    tables: [...]
}).then...
```

You can pass `PERM` or `SNP` into the config `mode` property and end up with the same result: All data will be saved to [SnapDB](https://www.npmjs.com/package/snap-db).

The SnapDB store isn't good for high volume, production systems.  It's recommended you switch to [LevelDB](https://www.npmjs.com/package/@nano-sql/adapter-leveldb) or [RocksDB](https://www.npmjs.com/package/@nano-sql/adapter-rocksdd) if performance is important or if you plan to have a very large database (10 GB+).

You can also use the `TEMP` mode which just saves to memory.

There are other options to store data with NodeJS and they all use an adapter plugin. Installation and usage of these is always straightforward. You can read about them in the other sections.