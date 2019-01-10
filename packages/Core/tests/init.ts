import * as sqlite3 from "sqlite3";
import { nanoSQL } from "../src/index";
import { InanoSQLInstance } from "../src/interfaces";


import { comments, users, posts } from "./data";
import { objectsEqual, assign } from "../src/utilities";
const Json2csvParser = require("json2csv").Parser;
import * as papaparse from "papaparse";

declare const process: any;

const doRace = false;

export const maybeStringify = (obj) => typeof obj === "object" ? JSON.stringify(obj) : obj;

export const JSON2CSV = (json: any[]): string => {
    if (!json.length) return "";
    try {
        const parser = new Json2csvParser({
            fields: Object.keys(json[0])
        });
        return parser.parse(json);
    } catch (err) {
        console.error(err);
        return "";
    }
};

export const CSV2JSON = (csv: string): any[] => {
    return papaparse.parse(csv, {header: true, dynamicTyping: true}).data.map((row) => {
        return Object.keys(row).reduce((prev, cur) => {
            try {
                prev[cur] = JSON.parse(row[cur]);
            } catch (e) {
                prev[cur] = row[cur];
            }
            return prev;
        }, {});
    });
};

export const cleanNsqlJoin = (rows: any[]): any[] => {
    return rows.map(r => Object.keys(r).reduce((p, c) => {
        const key: any = c.split(".").pop();
        p[key] = r[c];
        return p;
    }, {}));
};

export function TestDBs(): Promise<{ runQuery: (sql: string, sqlArgs: any[], nsql: (nSQL: InanoSQLInstance) => Promise<any>) => Promise<[any[], any[]]> }> {
    const nSQL = new nanoSQL();
    const db = new sqlite3.Database(":memory:");

    return new Promise((res, rej) => {

        Promise.all([
            nSQL.connect({
                id: "temp",
                mode: "TEMP",
                tables: [
                    {
                        name: "users",
                        model: {
                            "id:int": { pk: true, ai: true },
                            "name:string": {},
                            "username:string": {},
                            "email:string": {},
                            "subscribed:boolean": {},
                            "age:int": {},
                            "balance:float": {},
                            "address:obj": {
                                model: {
                                    "street:string": {},
                                    "suite:string": {},
                                    "city:string": {},
                                    "zipcode:string": {},
                                    "geo:obj": { model: { "lat:string": {}, "lng:string": {} } }
                                }
                            },
                            "phone:string": {},
                            "website:string": {},
                            "company:obj": {
                                model: {
                                    "name:string": {},
                                    "catchPhrase:string": {},
                                    "bs:string": {}
                                }
                            }
                        }
                    },
                    {
                        name: "posts",
                        model: {
                            "id:int": { ai: true, pk: true },
                            "userId:int": {},
                            "title:string": {},
                            "body:string": {}
                        }
                    },
                    {
                        name: "comments",
                        model: {
                            "id:int": { ai: true, pk: true },
                            "postId:int": {},
                            "name:string": {},
                            "email:string": {},
                            "body:string": {}
                        }
                    }
                ]
            }).then(() => {
                return Promise.all([
                    nSQL.selectTable("comments").loadJS(assign(comments)),
                    nSQL.selectTable("users").loadJS(assign(users)),
                    nSQL.selectTable("posts").loadJS(assign(posts))
                ]);
            }),
            Promise.all([0, 1, 2].map((i) => {
                return new Promise((res2, rej2) => {
                    switch (i) {
                        case 0:
                            db.run(`
                                CREATE TABLE users (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    name VARCHAR,
                                    username VARCHAR,
                                    email VARCHAR,
                                    subscribed BOOLEAN,
                                    age INTENGER,
                                    balance FLOAT,
                                    address VARCHAR,
                                    phone VARCHAR,
                                    website VARCHAR,
                                    company VARCHAR
                                );
                            `, [], (err) => {
                                    if (err) {
                                        rej2(err);
                                        return;
                                    }
                                    res2();
                                });
                            break;
                        case 1:
                            db.run(`
                                CREATE TABLE posts (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    userId INT,
                                    title VARCHAR,
                                    body VARCHAR
                                );
                            `, [], (err) => {
                                    if (err) {
                                        rej2(err);
                                        return;
                                    }
                                    res2();
                                });
                            break;
                        case 2:
                            db.run(`
                                CREATE TABLE comments (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    postId INT,
                                    name VARCHAR,
                                    email VARCHAR,
                                    body VARCHAR
                                );
                            `, [], (err) => {
                                    if (err) {
                                        rej2(err);
                                        return;
                                    }
                                    res2();
                                });
                            break;
                    }
                });
            })).then(() => {
                return Promise.all(["comments", "users", "posts"].map((table) => {
                    return Promise.all({
                        comments, users, posts
                    }[table].map((newRow) => {
                        return new Promise((res3, rej3) => {

                            switch (table) {
                                case "users":
                                    db.run(`INSERT INTO users (id, name, username, email, subscribed, age, balance, address, phone, website, company) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                        [newRow.id, newRow.name, newRow.username, newRow.email, newRow.subscribed, newRow.age, newRow.balance, newRow.address, newRow.phone, newRow.website, newRow.company].map(maybeStringify), (err) => {
                                            if (err) {
                                                rej3(err);
                                                return;
                                            }
                                            res3();
                                        });
                                    break;
                                case "comments":
                                    db.run(`INSERT INTO comments (id, postId, name, email, body) VALUES (?, ?, ?, ?, ?)`,
                                        [newRow.id, newRow.postId, newRow.name, newRow.email, newRow.body].map(maybeStringify), (err) => {
                                            if (err) {
                                                rej3(err);
                                                return;
                                            }
                                            res3();
                                        });
                                    break;
                                case "posts":
                                    db.run(`INSERT INTO posts (id, userId, body, title) VALUES (?, ?, ?, ?)`,
                                        [newRow.id, newRow.userId, newRow.body, newRow.title].map(maybeStringify), (err) => {
                                            if (err) {
                                                rej3(err);
                                                return;
                                            }
                                            res3();
                                        });
                                    break;
                            }
                        });
                    }));
                }));
            })
        ]).then(() => {
            res({
                runQuery: (sql, sqlArgs, runNano) => {
                    return new Promise((res, rej) => {

                        if (doRace) console.time("SQLITE");
                        db.all(sql || "SELECT * FROM users", sqlArgs, (err, result) => {
                            if (err) {
                                rej(err);
                                return;
                            }

                            const sqlRows = result.map(r => {
                                return Object.keys(r).reduce((p, c) => {
                                    switch (typeof r[c]) {
                                        case "string":
                                            try {
                                                p[c] = JSON.parse(r[c]);
                                            } catch (e) {
                                                p[c] = r[c];
                                            }
                                            break;
                                        default:
                                            if (c === "subscribed") {
                                                p[c] = r[c] === 1 ? true : false;
                                            } else {
                                                p[c] = r[c];
                                            }
                                    }
                                    return p;
                                }, {});
                            });

                            if (doRace) console.timeEnd("SQLITE");
                            if (doRace) console.time("nSQL");
                            runNano(nSQL).then((rows) => {
                                if (doRace) console.timeEnd("nSQL");
                                res([rows, sqlRows]);
                            });
                        });
                    });
                }
            });
        }).catch(rej);
    });
}