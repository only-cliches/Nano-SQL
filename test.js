const nSQL = require("./lib/index-server.js").nSQL;

nSQL("users")
.model([
    {key: "id", type: "int", props: ["pk", "ai"]}
])
.config({id: "TEST", mode: "PERM"})
.connect().then(() => {

})