# Utilities

nanoSQL uses numerous utility functions that you can take advantage of in your projects.

## Usage / Installation

**Using with &lt;script&gt;**

```typescript
const utils = window["@nano-sql"].core.utilities;
// uuid function:
utils.uuid();
```

**Using with module loader**

```typescript
import * as utils from "@nano-sql/core/lib/utilities";
// uuid function:
utils.uuid();
```

## Functions

### binarySearch

Uses fast binary search to a find value in a _sorted array_. Returns location of the value.  Orders of magnitude faster than `.indexOf` but only works with sorted arrays.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Sorted Array | Any\[\] | Yes | The sorted array to search. |
| Value | Any | Yes | The value to search for. |
| indexOf | Boolean | No | If true, function will return `-1`if the value isn't found, otherwise the position where the value could be is returned, useful to `splice` into the array. |

**Examples**

```typescript
utils.binarySearch([1, 2, 3], 2.5) // 2
utils.binarySearch([1, 2, 3], 2.5, true) // -1
utils.binarySearch([1, 2, 3], 2, true) // 1
```

### **titleCase**

Converts a single word into title case.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Str | String | Yes | The string to convert into title case. |

**Examples**

```typescript
utils.titleCase("hellO") // Hello
utils.titleCase("hello, WORLD!") // Hello, world!
```

### **slugify**

Converts a word, phrase, or sentence into a slug friendly format. Spaces are replaced with dashes, the whole string is lowercased and all non alphanumeric characters are removed.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Str | String | Yes | The string to convert into a slug. |

**Examples**

```typescript
utils.slugify("hello, WORLD!") // hello-world
```

### noop

Does nothing. Takes no arguments, returns nothing.

**Examples**

```typescript
utils.noop();
```

### nan

Takes anything and converts it into a float.  If it's already float does nothing.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Input | Any | Yes | The value to convert into a float |

**Examples**

```typescript
utils.nan(NaN) // 0
utils.nan("hello, world!") // 0
utils.nan(20) // 20
utils.nan(200.290) // 200.290
```

### assign

A faster Object.assign for dereferencing objects.  Internally just uses `JSON.parse(JSON.stringify(obj))`.  This is considerably faster than iterating through the object recursively and cloning the properties.

If there are any functions in the object they will be ignored.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Input Object | Object | Yes | The object you'd like a clone of |

**Examples**

```typescript
utils.assign({key: "value"}) // {key: "value"}
```

### maybeAssign

Checks if an object is frozen, returns a deep copy if it's frozen.  Otherwise does nothing.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Input Object | Object | Yes | The object you'd like a mutable copy of. |

**Examples**

```typescript
utils.maybeAssign({key: "value"}) // {key: "value"}
```

### objectsEqual

Recursively compare two javascript variables to see if they match.  Works for primitives, objects, and arrays.  Arrays must be in the same order to be considered equal.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Object 1 | Any | Yes | The first object you'd like to compare. |
| Object 2 | Any | Yes | The second object you'd like to compare. |

**Examples**

```typescript
utils.objectsEqual(20, 20) // true
utils.objectsEqual([20], [20]) // true
utils.objectsEqual([10, 20], [20, 10]) // false
utils.objectsEqual({key: "value"}, {key: "value"}) // true
```

### chainAsync

Execute a series of items serially \(one after another\) with an asynchronous function.  Returns a promise.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Items | Any\[\] | Yes | List of items to serialize over. |
| callback | \(item: any, i: number, next: \(value\) =&gt; void, error: \(msg\) =&gt; void\) =&gt; void | Yes | The function to call on each item.  `next` should be called to go to the next item, or `error` to cancel execution. |

**Examples**

```typescript
utils.chainAsync(["1", "2", "3"], (item, i, next, err) => {
    next(item + "-0");
}).then((result) => {
    console.log(result);
    // ["1-0", "2-0", 3-0"]
}).catch((err) => {
    // error happend
});
```

### allAsync

Execute a series of items in parallel with an asynchronous function.  Returns a promise.

The order of items in the result set is maintained regardless of the order the execution finishes in.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Items | Any\[\] | Yes | List of items to serialize over. |
| callback | \(item: any, i: number, next: \(value\) =&gt; void, error: \(msg\) =&gt; void\) =&gt; void | Yes | The function to call on each item.  `next` should be called to go to the next item, or `error` to cancel execution. |

**Examples**

```typescript
utils.allAsync(["1", "2", "3"], (item, i, next, err) => {
    next(item + "-0");
}).then((result) => {
    console.log(result);
    // ["1-0", "2-0", 3-0"]
}).catch((err) => {
    // error happend
});
```

### random16Bits

Produces a random number between 0 and 65,536. Uses feature detection to use the strongest entropy & crypto available in NodeJS or the browser.  Falls back to `Math.random`.

Takes no arguments.

**Examples**

```typescript
utils.random16Bits() // 2938
utils.random16Bits() // 10930
utils.random16Bits() // 20029
```

### throttle

Provided a function and time, guarantees the function will not fire more frequently than the time provided.    Does not fire on the first call.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Scope | Function/Class | Yes | The scope the function will be called with, can be undefined. |
| Callback | Function | Yes | The function that will be throttled. |
| Limit | Integer | Yes | The minimum time between callback calls. |

**Examples**

```typescript
let count = 0;
const throttledFn = utils.throttle(undefined, (passedArg) => {
    count++;
    console.log(count, passedArg);
}, 1000);
setInterval(() => {
    throttledFn("hello");
}, 50);
// every second on the console:
// 1 "hello"
// 2 "hello"
....
```

### timeid

Returns a `timeId` or `timeIdms`, depending on the argument passed in.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| ms | Boolean | No | If true, returns `timeIdms`, otherwise returns `timeId` |

**Examples**

```typescript
utils.timeid() // "1546890739-0aae8"
utils.timeid(true) // "1546890778707-03aa2"
```

### uuid

Returns a V4 UUID.  There are no arguments.

**Examples**

```typescript
utils.uuid() // "8eeff8e6-934a-4920-83d7-6d9a01583b20"
```

### hash

A quick and dirty hashing function, returns a string representing the hash of the passed in value.  Stolen from [https://github.com/darkskyapp/string-hash](https://github.com/darkskyapp/string-hash)

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| String to hash | String | Yes | The string you'd like converted into a hash. |

**Examples**

```typescript
utils.hash("hello, world!"); // 147bde48
```

### intersect

Given two arrays, check to see if any values in the two arrays are the same.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Array | Any\[\] | Yes | The first array to check. |
| Array 2 | Any\[\] | Yes | The second array to check. |

**Examples**

```typescript
utils.intersect([1, 2], [2, 3]) // true
utils.intersect([1, 2], [4, 3]) // false
```

### isObject

Checks to see if the provided argument is a javascript object, does NOT include arrays, functions, null, etc.  Only `{}` objects.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Variable to check | Any | Yes | The variable you'd like to check. |

**Examples**

```typescript
utils.isObject([]); // false
utils.isObject(2); // false
utils.isObject({}); // true
utils.isObject(() => {}) // false
```

### objSort

Useful for sorting arrays of objects based on nested values.  Returns a function that can be used in Array.sort

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Path of value to sort by | String | Yes | The path you'd like to sort against. |
| Reverse | Boolean | No | Pass true to sort ascending. |

**Examples**

```typescript
const sortFn = utils.objSort("nested.value");
[
    {nested: {value: 2}},
    {nested: {value: 3}},
    {nested: {value: 1}}
].sort(sortFn);
/*
[
    {nested: {value: 1}},
    {nested: {value: 2}},
    {nested: {value: 3}}
]
*/
```

### rad2deg

Converts radians to degrees.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Radian Value | Number | Yes | The radian you want to turn into degrees |

**Examples**

```typescript
utils.rad2deg(2.29) // 131.20733508495852
utils.rad2deg(Math.PI) // 180
```

### deg2rad

Converts degrees to radians.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Degree Value | Number | Yes | The degree value you'd like in radians. |

**Examples**

```typescript
utils.deg2rad(29.8) // 0.5201081170943103
utils.deg2rad(180) // 3.141592653589793
```

### crowDistance

[Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula) to determine the distance between two GPS points.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| P1 Latitude | Number | Yes | The first point latitude. |
| P1 Longitude | Number | Yes | The first point longitude. |
| P2 Latitude | Number | Yes | The second point latitude. |
| P2 Longitude | Number | Yes | The second point longitude. |
| Radius | Number | No | Default is 6371, which is the radius of Earth in kilometers.  Provide a different unit radius to get results in different units. |

**Examples**

```typescript
utils.crowDistance(10, 20, -10, 20); // 2223.8985328911745
```

### levenshtein

[Levenshtein](https://en.wikipedia.org/wiki/Levenshtein_distance) distance between two strings.  [This small library](https://www.npmjs.com/package/levenshtein-edit-distance) is used for this feature, so you can think of this function as an alias for that library.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Word 1 | String | Yes | The first word to compare. |
| Word 2 | String | Yes | The second word to compare. |

**Examples**

```typescript
utils.levenshtein("hello", "hello, world!") // 8
```

### resolvePath

Turns a string describing an object path into an array of strings.  Accepts any JSON notation for the path.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Path | String | Yes | The javascript path to resolve. |

**Examples**

```typescript
utils.resolvePath("nested[0].value.here") // ["nested", "0", "value", "here"]
```

### deepFreeze

Recursively freeze a javascript object to prevent it from being modified or mutated.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Object | Object | Yes | The object to freeze. |

**Examples**

```typescript
const frozenArray = utils.deepFreeze([1, 2, 3]);
frozenArray[0] = 2; // throws error, doesn't work.
```

### deepSet

Given an object, path, and value set the value at the path in the object.  If any of the nested objects don't exist they will be created.

Returns the modified object, also mutates the object in place.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Path | String | Yes | The path to the value to be set. |
| Object | Object | Yes | The object to freeze. |
| Value | Any | Yes | The value to set. |

**Examples**

```typescript
let obj = {nested: {value: 20}}
utils.deepSet("nested.value", obj, 30);
// {nested: {value: 30}}
utils.deepSet("nested.arr[0]", obj, true);
// {nested: {value: 30, arr: [true]}}
utils.deepSet("nested.value.obj", obj, {});
// {nested: {value: {obj: {}}, arr: [true]}}
```

### deepGet

Given an object and path get the value at the path.  Doesn't cause an error if any part of the path is undefined, making this safer than the typical method for getting objects.

Returns the value or undefined.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Path | String | Yes | The path to the value to get. |
| Object | Object | Yes | The object to query. |

**Examples**

```typescript
utils.deepGet("nested.value", {nested: {value: 20}); // 20
utils.deepGet("nested.arr[0]", {nested: {value: 20}); // undefined
```

### setFast

A universal/isomorphic setImmediate.  Works just like `setTimeout(callback, 0)`, but orders of magnitude faster.

**Arguments:**

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| Callback | Function | Yes | The function to call on the next event loop. |

**Examples**

```typescript
utils.setFast(() => {
    console.log("YO!");
})
// "YO!"
```

## Constants

### isSafari

Detects if the environment is Safari web browser \(desktop\) or ANY web browser on iOS.  

### **isMSBrowser**

Detects if the running browser is IE or Edge

### isAndroid

Detects if the running environment is on an android based browser.

