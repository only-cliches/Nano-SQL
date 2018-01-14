const nSQL = require("../lib/index-server").nSQL;

nSQL("test")
.model([
    {key: "id", type: "int", props: ["pk", "ai"]},
    {key: "name", type: "string"}
])
.config({
    mode: "PERM"
})
.connect().then(() => {
    nSQL().query("upsert", {id: 1, name: "hello!"}).exec().then(() => {
        nSQL().query("select").exec().then((rows) => {
            console.log(rows);
        })
    });
});