<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/2.0/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/2.0/graphics/logo.png" alt="nanoSQL Logo">
  </a>
</p>
<p align="center">
  <a href="https://badge.fury.io/js/%40nano-sql%2Fplugin-fuzzy-search">
    <img src="https://badge.fury.io/js/%40nano-sql%2Fplugin-fuzzy-search.svg" alt="nanoSQL Logo">
  </a>
  <a href="https://github.com/ClickSimply/@nano-sql/core/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/express.svg?style=flat-square" alt="nanoSQL Logo">
  </a>
</p>

<h1 align="center">nanoSQL 2 Fuzzy Search Plugin</h1>
<p align="center">
  <strong>Allows you to build and use dynamic fuzzy search with <a href="https://www.npmjs.com/package/@nano-sql/core">nanoSQL 2</a></strong>
</p>

[Documentation](https://nanosql.io/plugins/search.html) | [Bugs](https://github.com/ClickSimply/Nano-SQL/issues) | [Chat](https://gitter.im/nano-sql/community)

# What's This For?
Add fuzzy search capability to your NanoSQL apps, the special indexing in this plugin is well suited for fuzzy name matching, document search, or anywhere else you need to match words that sound or look similar together.

# Installation

```sh
npm i @nano-sql/plugin-fuzzy-search --save
```

# Usage

```ts
import { FuzzySearch } from "@nano-sql/plugin-fuzzy-search";
import { nSQL } from "@nano-sql/core";

nSQL().createDatabase({
    id: "my_db",
    mode: "PERM", // or any NodeJS adapter
    plugins: [
      FuzzySearch()
    ]
}).then(() => {
    return nSQL().query("create table", {
      name: "my_table",
      model: {
        "id:int": {pk: true, ai: true},
        "document:string": {},
      },
      indexes: {
        "document:string": {
          search: true // <== required to index this column with fuzzy search engine.
        }
      }
    })
}).then(() => {
  return nSQL("my_table").query("upsert", {document: "I put some crazy text here."}).exec();
}).then(() => {
  // the SEARCH function returns 0 for exact phrase matches and higher numbers for less strict matches
  return nSQL("my_table").query("select").where(["SEARCH(document, 'crzy txt')", "=", 0]).exec();
}).then((results) => {
  console.log(results); // [{id: 1, document: "I put some crazy text here."});
})
```

# MIT License

Copyright (c) 2019 Scott Lott

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

# Changelog

## [2.0.0]
- First release