var nSQL = require("./node/index-server.js").nSQL;
nSQL()
    .config({ persistent: true })
    .model([
        { key: "int", type: "int" }
    ])
    .connect()