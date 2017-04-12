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
        console.time("WRITE");
        console.log("CONNECTED");

        const step = () => {
            // if (i === 0) nsql("users").beginTransaction();
            if (i < 1000) {
                nsql("users")
                    .query("upsert", {
                        name: makeid(),
                        pass: makeid(),
                        email: makeid()
                    }).exec().then(() => {
                        i++;
                        if (i % 100 === 0) {
                            console.log(i);
                        }
                        step();
                    })
            } else {
                // nsql("users").endTransaction();
                console.timeEnd("WRITE");
            }
        }
        step();
        //setTimeout(step, 10000);
        /*nsql("users")
            .query("upsert", {
                name: "scott",
                pass: "",
                email: "scott33@clicksimply.com"
            }).exec()*/
        console.time("READ");

        //nsql("users").query("select").where(["name", "=", "SYDOgB6WPR"]).exec().then((rows) => {

        nsql("users").query("select").exec().then((rows) => {
            console.timeEnd("READ");
            console.log(rows.length);
        })
    });
//}, 10000)