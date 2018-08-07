const nSQL = require("./lib/index.js").nSQL;

nSQL("table").model([
    {key: "id", type: "int", props: ["pk()", "ai()"]},
    {key: "name", type: "string", props: ["unique()"]}
]).connect().then(() => {
    return nSQL().loadJS("table", [{name: "Billy"}]);
}).then(() => {
    return nSQL().query("upsert", {name: "Billy"}).exec();
}).then((rows) => {
    console.log(rows);
}).catch((err) => {
    console.log(err);
})