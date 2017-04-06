var nsql = require("../node/index-server.js").NanoSQLInstance;

function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 10; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function makRandom() {
    let number = Math.floor(Math.random() * 1000);
    return number.toString();
}
let r = [];
const step = () => {
    r.push(nsql.timeid(true));
    if (r.length < 10) {
        setTimeout(step, 500);
    } else {
        r = r.sort();
        console.log(r);
    }
}
step();

/*
nsql("users")
    .model([
        { key: "id", type: "uuid", props: ["pk"] },
        { key: "name", type: "string" },
        { key: "pass", type: 'string' },
        { key: "email", type: "string" }
    ])
    // .config({ memory: false, persistent: true, history: false })
    .connect().then(() => {
        let i = 0;
        console.time("WRITE");
        nsql("users").beginTransaction();
        const step = () => {
            if (i < 1000) {
                nsql("users")
                    .query("upsert", {
                        name: makeid(),
                        pass: makeid(),
                        email: makeid()
                    }).exec().then(() => {
                        i++;
                        if (i % 100 === 0) {
                            // console.log(i);
                        }
                        step();
                    })
            } else {
                nsql("users").endTransaction();
                console.timeEnd("WRITE");
            }
        }
        step();
        console.time("READ");
        nsql("users").query("select").exec().then((rows) => {
            console.timeEnd("READ");
            console.log(rows.length);
        })
    });*/