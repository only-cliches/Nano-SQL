import { nSQL, NanoSQLInstance } from "../src/index";

export const usersDB = (dataModel: any[], ready: (nSQL: NanoSQLInstance) => void, enableHistory?: boolean) => {
    const n = new NanoSQLInstance();
    n.table("users")
    .model(dataModel)
    .config({history: enableHistory})
    .connect().then(() => {
        ready(n);
    });
};

export const ExampleUsers2 = [
    {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
    {id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]},
    {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]},
    {id: 4, name: "Bill", age: 23, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
    {id: 5, name: "Jeb", age: 30, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]},
    {id: 6, name: "Bob", age: 29, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
];

export const ExampleDataModel = [
    { key: "id", type: "int", props: ["pk()", "ai()"] },
    { key: "age", type: "int", props: ["idx()"] },
    { key: "name", type: "string", props: ["idx()"] },
    { key: "email", type: "string", props: ["trie()"] },
    { key: "meta", type: "map"},
    { key: "posts", type: "int[]"}
];

export const ExampleUsers = [
    {id: 1, name: "Bill", age: 20, email: "bill@gmail.com", meta: {value: 1}, posts: [1, 3]},
    {id: 2, name: "Jeb", age: 24, email: "jeb@gmail.com", meta: {value: 1}, posts: [1]},
    {id: 3, name: "Bob", age: 21, email: "bob@gmail.com", meta: {value: 1}, posts: [1, 2, 3]}
];