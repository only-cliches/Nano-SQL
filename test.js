var SomeSQL = require("./node/index.js");

SomeSQL.SomeSQLInstance.uuid();

let ids = [];
let count = 0;
let uuid = SomeSQL.SomeSQLInstance.uuid();

while(ids.indexOf(uuid) === -1) {
    ids.push(uuid);
    uuid = SomeSQL.SomeSQLInstance.uuid();
    count++;
}