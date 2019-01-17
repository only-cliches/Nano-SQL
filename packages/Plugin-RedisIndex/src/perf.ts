import { nSQL } from "@nano-sql/core";
import { RedisIndex } from "./index";
import { MySQL } from "../../Adapter-MySQL/src";
import { SQLite } from "../../Adapter-SQLite3/src";

function makeid(): string {
    let text: string = "";
    let possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (let i = 0; i < 10; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

nSQL().connect({
    id: "perf",
    mode: new SQLite(),
    plugins: [
        // RedisIndex()
    ],
    tables: [
        {
            name: "testing",
            model: {
                "id:uuid": { pk: true },
                "name:string": {},
                "balance:int": {}
            },
            indexes: {
                "name:string": {},
                "balance:int": {}
            }
        }
    ]
}).then(() => {
    let rows: any[] = [];
    for (let i = 0; i < 50000; i++) {
        rows.push({name: makeid(), balance: Math.round(Math.random() * 500)})
    }
    console.time("INSERT");
    return nSQL("testing").loadJS(rows);
}).then(() => {
    console.timeEnd("INSERT");
    console.time("SELECT");
    return nSQL("testing").query("select").where(["name", "BETWEEN", ["F", "K"]]).exec();
}).then(() => {
    console.timeEnd("SELECT");
})