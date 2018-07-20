# Nano-SQL-Vue
VueJS Mixin for use with [nanoSQL](https://nanosql.io/).

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">

NanoSQL is a powerful database/datastore with tons of RDBMS features, Undo/Redo, and optional built in persistence to Indexed DB, WebSQL or LocalStorage.

This module lets you easily attach the rendering for your Vue components to specific nanoSQL tables and queries.

Automatically handles binding and unbinding event listeners, triggering changes and returning them to your component.

Only adds 1.2Kb to your project. :)

## Examples
- [CodePen](https://codepen.io/clicksimply/pen/rpWPmz)

Includes Typescript typings but still plays nice with Babel and ES5 projects.

## Installation

### Typescript/Webpack/NodeJS/etc
```sh
npm i nano-sql-vue --save
```

### Browser
You can simply include this script in your head:
```html
<!-- nanoSQL Vue Mixin -->
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/nano-sql-vue@1.1.3/nano-sql-vue.min.js"></script>
<!-- nanoSQL -->
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/nano-sql@1.7.1/dist/nano-sql.min.js"></script>
```
Make sure you have NanoSQL also loaded on the page for this to work.

## Usage

```ts
// if not using in the browser...
import { nSQLVue } from "nano-sql-vue";
import { nsQL } from "nano-sql";

const App = new Vue({
    mixins: [
        nSQLVue({ // call nSQLVue to generate mixin
            tables: ["tables", "to", "listen"], // tables to listen for changes
            callback: function(event, complete) {
                nSQL("table").query("select").exec()
                .then(rows => {
                    // result gets passed to nSQLonChange method.
                    complete(rows);
                });
            },
            // optional, nanoSQL instance to attach to.
            // uses global nSQL by default.
            store: nanoSQLInstance
        })
    ],
    template: `<p># of Records: {{ data.length }}</p>`,
    data: {
        data: [],
    },
    methods: {
        // must have this specific method name to recieve data updates.
        nSQLonChange: function(data) {
            this.data = data
        }
    }
});

```

As an additional note, the nSQLonChange method will be called once on component mount to bring in any state from nanoSQL, then any subsequent nSQLonChange calls will be due to actual events from the database.

You can check to see if it's the first mount call by doing this check in the onChange function: `event.notes === ["mount"]`.  That will return `false` for all standard queries from nanoSQL but `true` for the first call on the component mount.

You can learn more about nanoSQL [here](https://nanosql.io/).