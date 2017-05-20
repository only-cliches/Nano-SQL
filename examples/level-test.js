var nsql = require("../node/index-server.js").nSQL;

function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 10; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

// setTimeout(() => {
nsql("users")
    .model([
        { key: "id", type: "uuid", props: ["pk"] },
        { key: "name", type: "string", props: ["trie"] },
        { key: "pass", type: 'string' },
        { key: "email", type: "string" }
    ])
    .config({ id: "testing", memory: false, persistent: true, history: false })
    .connect().then(() => {
        let i = 0;

        console.log("CONNECTED");

        /*nsql().doTransaction((db, complete) => {
            console.time("WRITE");
            for (let i = 0; i < 8000; i++) {
                db("users")
                    .query("upsert", {
                        name: makeid(),
                        pass: makeid(),
                        email: makeid()
                    }).exec();
            }
            complete();
        }).then(() => {

            console.timeEnd("WRITE");*/
        console.time("READ");

        //nsql("users").query("select").where(["name", "=", "SYDOgB6WPR"]).exec().then((rows) => {
        nsql("users").query("select").exec().then((rows) => {
            console.timeEnd("READ");
            console.log(rows.length);
        });
        // });
    });
//}, 10000)