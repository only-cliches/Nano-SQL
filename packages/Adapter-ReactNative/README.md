# Nano-React-Native
React Native Driver for [nanoSQL](https://nanosql.io/)

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">

[![NPM](https://nodei.co/npm/nano-react-native.png?downloads=true&stars=true)](https://nodei.co/npm/nano-react-native/)

## [Documentation](https://docs.nanosql.io/)

This is an adapter written for NanoSQL that wraps React Native's built in AsyncStorage class, lets you use nanoSQL in your React Native projects with persistence to disk.

## Installation
```sh
npm i --save nano-react-native
```

## Usage
```ts
import { nSQL } from "nano-sql";
import { ReactNativeAdapter } from "nano-react-native";

nSQL("users")
.model([
    {key: "id", type: "uuid", props: ["pk"]},
    {key: "name", type: "string"}
])
.config({
    mode: new ReactNativeAdapter() // required
}).connect().then(() => {
    nSQL("users").query("upsert", {name: "Billy"}).exec().then(() => {
        return nSQL("users").query("select").exec();
    }).then((rows) => {
        console.log(rows);
    })
})
```

That's it, now everything nanoSQL can do you can do with React Native.

Read about nanoSQL [here](https://nanosql.io/).