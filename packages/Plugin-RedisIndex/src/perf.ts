import { nSQL } from "@nano-sql/core";
import { Scylla } from "@nano-sql/adapter-scylla";
const compose = require("composeaddresstranslator");
import * as cassandra from "cassandra-driver";
import { chainAsync } from "@nano-sql/core/lib/utilities";

const authProvider = new cassandra.auth.PlainTextAuthProvider('scylla', 'XXX');

let translator = new compose.ComposeAddressTranslator();

translator.setMap({

});

function makeid(): string {
    let text: string = "";
    let possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (let i = 0; i < 10; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

nSQL().connect({
    id: "perf",
    /*mode: new Scylla({
        contactPoints: translator.getContactPoints(),
        policies: {
            addressResolution: translator
        },
        authProvider: authProvider,
        sslOptions: true as any
    }),*/
    mode: "PERM",
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
                // "name:string": {},
                // "balance:int": {}
            }
        }
    ]
}).then(() => {
    let rows: any[] = [];
    for (let i = 0; i < 50000; i++) {
        rows.push({ name: makeid(), balance: Math.round(Math.random() * 500) })
    }
    console.log("OPEN");
    console.time("INSERT");
    return nSQL("testing").loadJS(rows);
}).then(() => {
    console.timeEnd("INSERT");
    console.time("SELECT");
    return nSQL("testing").query("select").where(["name", ">", "E"]).exec();
}).then(() => {
    console.timeEnd("SELECT");
})