// Working on performance testing between alasql and some-sql

const SomeSQL = require("./node/index.js").SomeSQL;
const alasql = require("alasql");

let blank = () => {
    return {
        title: "Hello, world!",
        name: Math.round(Math.random()*100000).toString(16)
    }
}

/*
// 34ms
alasql("CREATE TABLE test (id int PRIMARY KEY AUTOINCREMENT, title string, name string)");
console.time("DB");
let i = 0;
let insert = () => {
    alasql.promise("INSERT INTO test VALUES ?",[blank()]).then(() => {
        i++;
        if(i < 1000) {
            insert();
        } else {
            console.timeEnd("DB");
            process.exit();
        }
    });
};

insert();


// 106ms
SomeSQL("test").model([
    {key:"id",type:"int",props:["ai","pk"]},
    {key: "title", type: "string"},
    {key: "name", type: "string"}
]).connect().then(() => {
    console.time("DB");
    let i = 0
    let upsert = () => {
        SomeSQL("test").query("upsert",blank()).exec().then((rows, db) => {
            i++;
            if(i < 1000) {
                upsert();
            } else {
                console.timeEnd("DB");
                process.exit();
            }
        });
    }

    upsert();
});
*/

/*const crypto = require("crypto");

function uuid() {
    let r, s, buf;
    const random16Bits = () => {
        if(typeof crypto === "undefined") {
            return Math.round(Math.random() * Math.pow(2, 16)); // Oh god, please no.
        } else {
            if (crypto.getRandomValues) { // Browser crypto
                buf = new Uint16Array(1);
                window.crypto.getRandomValues(buf);
                return buf[0];
            } else if (crypto.randomBytes) {
                return crypto.randomBytes(2).reduce((prev, cur) => cur * prev);
            } else {
                return Math.round(Math.random() * Math.pow(2, 16)); // Oh god, please no.
            }
        }
    }, b = "";

    return [b, b, b, b, b, b, b, b, b].reduce((prev, cur, i) => {
        r = random16Bits();
        s = (i === 4 ? i : (i === 5 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
        r = r.toString(16);
        while (r.length < 4) r = "0" + r;
        return prev + ([3, 4, 5, 6].indexOf(i) >= 0 ? "-" : b) + (s + r).slice(0, 4);
    }, b);
};

let id = uuid();
console.log(id, id.replace(/-/g,"").match(/.{1,4}/g).map((value) => parseInt(value, 16)));*/