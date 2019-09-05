---
home: true
heroImage: /logo.png
actionText: Get Started →
actionLink: /setup.html
features:
- title: Runs Everywhere
  details: Works in IE9+, NodeJS, Electron, NativeScript, React Native and everywhere else javascript does.
- title: Powered By Typescript
  details: Built from the ground up with Typescript to make API discovery and usage a brease.
- title: Dynamic Queries
  details: Graph, Join, Filter, Select and Order your data in dozens of ways.
footer: MIT Licensed | Copyright © 2019-present Scott Lott
---

<center>
<h1>Install</h1>
</center>

## Browser
Simply copy one of the script links below and drop it into your page head.
```html
<!-- ES6 Only (Faster & Smaller) -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.3.7/dist/nano-sql.min.js" integrity="sha256-W1pVgKda7GC4fwXqq9jfOrssBDJJXZqck+ultRPVzmc=" crossorigin="anonymous"></script>
<!-- ES5 (Internet Explorer/Old Browser Support) -->
<!-- Promise must be polyfilled as well -->
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/core@2.3.7/dist/nano-sql.min.es5.js" integrity="sha256-1t9VlpFUgHaxlLQy6HM9ROQvTiuUv2M12Fp1oTh3+yg=" crossorigin="anonymous"></script>
```

## NodeJS / Webpack / Browserify / etc
Run this in your project directory:
```sh
npm i @nano-sql/core --save
```

Then use in your project:
```ts
// typescript & babel
import { nSQL } from "@nano-sql/core";

// commonjs / node syntax
const nSQL = require("@nano-sql/core").nSQL;
```

<center>
<h1>Usage</h1>
</center>

## Use With An Array Of Objects

<iframe height="265" style="width: 100%;" scrolling="no" title="nanoSQL2 Example 1" src="//codepen.io/clicksimply/embed/KEEBQR/?height=265&theme-id=0&default-tab=js,result" frameborder="no" allowtransparency="true" allowfullscreen="true">
  See the Pen <a href='https://codepen.io/clicksimply/pen/KEEBQR/'>nanoSQL2 Example 1</a> by Scott Lott
  (<a href='https://codepen.io/clicksimply'>@clicksimply</a>) on <a href='https://codepen.io'>CodePen</a>.
</iframe>

## Use As A Database / Datastore

<iframe height="265" style="width: 100%;" scrolling="no" title="nanoSQL2 Example 2" src="//codepen.io/clicksimply/embed/EMMppB/?height=265&theme-id=0&default-tab=js,result" frameborder="no" allowtransparency="true" allowfullscreen="true">
  See the Pen <a href='https://codepen.io/clicksimply/pen/EMMppB/'>nanoSQL2 Example 2</a> by Scott Lott
  (<a href='https://codepen.io/clicksimply'>@clicksimply</a>) on <a href='https://codepen.io'>CodePen</a>.
</iframe>

<center>
<h1>Save Your Data Anywhere</h1>
</center>
NanoSQL supports a wide range of ways to save your data in the browser, on the phone, and on the server.

1. **Included In The Box**
    - Memory (Browser/NodeJS/Electron)
    - Snap DB (NodeJS/Electron)
    - Indexed DB (Browser)
    - WebSQL (Browser)
    - Local Storage (Browser)

2. **[RocksDB (NodeJS/Electron)](https://www.npmjs.com/package/@nano-sql/adapter-rocksdb)**
3. **[LevelDB (NodeJS/Electron)](https://www.npmjs.com/package/@nano-sql/adapter-leveldb)**
4. **[SQLite (NodeJS/Electron)](https://www.npmjs.com/package/@nano-sql/adapter-sqlite)**
5. **[SQLite (Cordova)](https://www.npmjs.com/package/@nano-sql/adapter-sqlite-cordova)**
6. **[SQLite (NativeScript)](https://www.npmjs.com/package/@nano-sql/adapter-sqlite-nativescript)**
7. **[React Native](https://www.npmjs.com/package/@nano-sql/adapter-react-native)**
8. **[Redis](https://www.npmjs.com/package/@nano-sql/adapter-redis)**
9. **[MySQL](https://www.npmjs.com/package/@nano-sql/adapter-mysql)**
10. **[Amazon Dynamo DB](https://www.npmjs.com/package/@nano-sql/adapter-dynamo)**
11. **[MongoDB](https://www.npmjs.com/package/@nano-sql/adapter-mongo)**
12. **[ScyllaDB](https://www.npmjs.com/package/@nano-sql/adapter-scylla)**

<center>
<h1>Get Help</h1>
</center>

- [Documentation →](/setup.html) 
- [API Docs →](https://api.nanosql.io)
- [Bugs →](https://github.com/ClickSimply/Nano-SQL/issues) 
- [Chat →](https://gitter.im/nano-sql/community)

## Older Versions
You can get nanoSQL 1.X versions [here](https://github.com/ClickSimply/Nano-SQL/tree/1.X/).