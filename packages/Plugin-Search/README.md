<p align="center">
  <a href="https://github.com/ClickSimply/Nano-SQL/tree/master/packages/Core">
    <img src="https://github.com/ClickSimply/Nano-SQL/raw/master/graphics/logo.png" alt="nanoSQL Logo">
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

### Features
- Single word and phrase searches.
- Similar functionality as Elastic Search.
- Filter results by relevance to search.
- Use custom tokenizer function.
- Dynamic index can be updated on the fly.
- Works in NodeJS or any modern Browser.
- Only 10KB gzipped.

# Installation

For NodeJS or with a bundler (webpack, parcel, etc)
```sh
npm i @nano-sql/plugin-fuzzy-search --save
```

To use in the browser, just drop this into your head AFTER nanoSQL core script
```html
<script src="https://cdn.jsdelivr.net/npm/@nano-sql/plugin-fuzzy-search@2.0.2/dist/plugin-fuzzy-search.min.js" integrity="sha256-czgrUq1EccktG3O5AGuW/LoeMWeaQrkQzvj1S45ZiXw=" crossorigin="anonymous"></script>
```

# Usage

```ts
import { FuzzySearch } from "@nano-sql/plugin-fuzzy-search";
import { nSQL } from "@nano-sql/core";
// or with <script> usage
const { FuzzySearch } = window["@nano-sql/plugin-fuzzy-search"];
const { nSQL } = window["@nano-sql/core"];

nSQL().createDatabase({
    id: "my_db",
    mode: "PERM", // or any adapter
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
  // the first argument is the column, every following argument is a search term
  return nSQL("my_table").query("select").where(["SEARCH(document, 'crzy txt')", "=", 0]).exec();
}).then((results) => {
  console.log(results); // [{id: 1, document: "I put some crazy text here."});
})
```

# API

## Setting Up Fuzzy Indexes
In order to use the Fuzzy Search plugin it must be included in your initial `createDatabase` call in the `plugins` property.

```ts
import { FuzzySearch } from "@nano-sql/plugin-fuzzy-search";
import { nSQL } from "@nano-sql/core";

nSQL().createDatabase({
    plugins: [ // must include this
      FuzzySearch()
    ]
}).then..
```

Fuzzy search is enabled on secondary indexes by adding the `search` property to the index.  Fuzzy search indexes will only work on `string` type indexes.

```ts
nSQL().query("create table", {
  name: "my_table",
  model: {
    "id:int": {pk: true, ai: true},
    "document:string": {},
  },
  indexes: {
    "document:string": {
      search: true // enable fuzzy search
    }
  }
}).exec()...
```

You can optionally pass an object to the `search` property instead of `true`.  The object can be used to provide a customized tokenizer to be used by the fuzzy index.

By default the tokenizer will remove all special characters except numbers and letters, lowercase everything, remove english stop words, and use an english friendly stemmer and metaphone.  To adjust how tokenization happens you can either provide your own tokenizer or provide the built in tokenizer with different configuration options from the default.

The provided tokenizer function is used on search terms passed into the fuzzy search plugin as well as on terms being indexed.

The `defaultTokenizer` export is a function that accepts these arguments:

### type:string (required)
Should be one of "english", "english-meta", or "english-stem".  All options will remove special characters and only leave numbers and letters.  "english-stem" will cause the searches/indexes to also be stemmed with the Porter Stemmer algorithm, "english-meta" will cause the searches/indexes to also be metaphoned, "english" will cause both metaphone and stemmer algorithms to be ran on searches/indexes.

### stopWords:string[] (required)
An array of stop words to be excluded from indexes/searches.  The `stopWords` export contains the default list of english stop words.

### decimalPoints:number (optional, default is 4)
Since the fuzzy search can't use native number types, all numbers are stringified and formatted to a very specific format with a fixed number of decimal places.  For example, by default if 50 is found in a string it will be converted to "50.0000".  If 0.00001 is found it will be converted to "0.0000".  You can increase the decimalPoints argument to get more precise decimal searches at the cost of space in the database.

A quick example:
```ts
import { nSQL } from "@nano-sql/core";
import { FuzzySearch, defaultTokenizer, stopWords} from "@nano-sql/plugin-fuzzy-search";

nSQL().query("create table", {
  name: "my_table",
  model: {
    "id:int": {pk: true, ai: true},
    "document:string": {},
  },
  indexes: {
    "document:string": {
      search: { // customize the default tokenizer
        tokenizer: defaultTokenizer("english-meta", stopWords, 1)
      }
    }
  }
}).exec()...
```

You don't have to use the `defaultTokenizer` at all, you can build your own tokenizing functions from scratch.

The `tokenizer` property accepts a function with these arguments:
- `tableName:string` The name of the table currently being tokenized.
- `tableId:string` The id of the table in the first argument.
- `path:string[]` The parsed path of the column being tokenized.
- `value:string` The value being tokenized.

The function should return an array of objects, each object should have these properties:
- `w`: The token of the word at a given position in the provided string.
- `i`: The position of this tokenized word in the original string.

The ordering of the result array is irrelevant.

A quick example of using a custom tokenizer:
```ts
import { nSQL } from "@nano-sql/core";
import { FuzzySearch} from "@nano-sql/plugin-fuzzy-search";

nSQL().query("create table", {
  name: "my_table",
  model: {
    "id:int": {pk: true, ai: true},
    "document:string": {},
  },
  indexes: {
    "document:string": {
      search: {
        tokenizer: (tableName, tableId, path, value) => {
          return String(value).split(" ").map((s, i) => {
            return {w: s.trim().toLowerCase(), i: i}
          })
        }
      }
    }
  }
}).exec()...
```

On a final note, if you change the tokenizer at all for an index, you must rebuild the index using the steps below.

## Rebuilding Indexes
Fuzzy indexes can be rebuilt with the new query `rebuild search`.

```ts
// rebuilid the fuzzy search index for all rows in "myTable"
nSQL("myTable").query("rebuild search").exec()..

// rebuilid the fuzzy search index for specific rows in "myTable"
nSQL("myTable").query("rebuild search").where(["some condition", "=", true]).exec()..
```

If you add fuzzy search to an existing secondary index or change the tokenizer for a fuzzy search index you must rebuild the fuzzy indexes on that table to get consistent results.

## Using Fuzzy Indexes
The new `SEARCH` function is used to take advantage of fuzzy indexes.  The search function accepts between 2 and any number of arguments, the first argument must always be the column/path the fuzzy search is being performed on and every following argument is a search phrase.

The `SEARCH` function will return a number from 0 and up where 0 means an exact match was found and every number above zero represents an increasingly less relevant match.  

You can also pass a `*` into the first argument of the `SEARCH` function to search all fuzzy indexes on a given table.

Since search terms must be surrounded by quotes and seperated by commas, it's important that any user supplied data is escaped of these values.  This can be done automatically with the `FuzzyUserSanitize` exported function.

```ts
import { FuzzyUserSanitize } from "@nano-sql/core/plugin-fuzzy-search";

// find matches for "crzy txt" on the document column.
nSQL("my_table").query("select").where(["SEARCH(document, 'crzy txt')", "=", 0]).exec();

// find users who's name closely or exactly matches "bill" OR "jeb"
nSQL("users").query("select").where(["SEARCH(firstName, 'bill', 'jeb')", "=", 0]).exec();

// search the body of posts for text provided by a user
nSQL("posts").query("select").where([`SEARCH(body, "${FuzzyUserSanitize(userProvidedSearch)}")`, "<=", 4]).exec();

// search all indexed columns for "something crazy" in the posts table
nSQL("posts").query("select").where([`SEARCH(*, "something crazy")`, "<=", 4]).exec();
```

One final note, the `SEARCH` function will also perform an exact match search of the *entire untokenized search phrase* against the initial secondary index the fuzzy search is based on, in addition to doing the fuzzy search.  So any matches in the original secondary index will also be in the results.


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

## [2.0.3]
- Added `o` property to tokenizer, allows prefix searches now.

## [2.0.2]
- Added script install option.
- Readme updates.

## [2.0.1]
- Fixed a bug with non string indexes.
- Added more documentation.
- Added new `*` feature to `SEARCH` function.
- Added conditional rebuilding to the `search rebuild` query.

## [2.0.0]
- First release