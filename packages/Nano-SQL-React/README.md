# Nano-SQL-React
High Order Component for using [nanoSQL](https://nanosql.io/) with React

<img src="https://raw.githubusercontent.com/ClickSimply/Nano-SQL/master/logo.png" alt="nanoSQL Logo">

NanoSQL is a database/datastore with tons of RDBMS features, Undo/Redo, and optional built in persistence to Indexed DB, WebSQL or LocalStorage.

This module lets you easily attach the rendering for your components to specific nanoSQL tables and queries.

Automatically handles binding and unbinding event listeners, triggering changes and returning them to your component.

## Examples
- [Super Minimal CodePen](https://codepen.io/clicksimply/pen/jYVdwr)
- [Complete Todo App](https://www.nanosql.io/react-todo/)

Includes Typescript typings but still plays nice with Babel and ES5 projects.

## Installation

```
npm i nano-sql-react --save
```

## Usage

```ts
import { bindNSQL } from "nano-sql-react";
import { DatabaseEvent } from "nano-sql";
import * as React from "react";

/*
Step 1: Make your component as usual, just add the two additional nSQL* props below.
Step 2: Add the two static methods below, tables() and onChange().
*/
export class MyComponent extends React.Component<{
    some: any;
    other: any;
    props: any; // any number of props you need
    nSQLdata: any; // holds data from nanoSQL
    nSQLloading: boolean; // if a query is pending
}, {}> {

    // Tables to listen for changes on 
    static tables() {
        return ["tables", "to", "listen"];
    }

    // Method is called on each change
    static onChange: (event, complete) => { 
        nSQL("table").query("select").exec().then((rows) => {
            if (!rows.length) return;
            // whatever you pass into complete() 
            // will become this.props.nSQLdata in the render method
            complete({message: rows[0].message});
        });
    }

    render() {
        return this.props.nSQLloading ? 
        "Loading..." : 
        this.props.nSQLdata.message + this.props.some;
    }
}

/*
Step 2: In the parent component, call the bindNSQL function against a new variable.
Step 3. Pass in the arguments as described.
Step 4: Use the new variable as your component.
*/
export class ParentComponnt extends React.Component<{}, {}> {

    public messageComponent: React.ComponentClass<P>;

    constructor(p) {
        super(p);
        this.messageComponent = bindNSQL(MyComponent);
    }

    render() {
        // You can pass in your other props while you're at it.
        return <this.messageComponent some={"1"} other={"2"} props={"3"} />;
    }
}

```

As an additional note, the onChange function will be called once on component mount to bring in any state from nanoSQL, then any subsequent onChange calls will be due to actual events from the database.

You can check to see if it's the first mount call by doing this check in the onChange function: `event.notes === ["mount"]`.  That will return `false` for all standard queries from nanoSQL but `true` for the first call on the component mount.

You can learn more about nanoSQL [here](https://nanosql.io/).