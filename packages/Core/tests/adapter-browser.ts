import { TestAdapter } from "./adapter-test";
import { IndexedDB } from "../src/adapters/indexedDB";
import { WebSQL } from "../src/adapters/webSQL";
import { RSE } from "really-small-events";
window["RSE"] = RSE;

let errors = 0;
console.log("Testing IndexedDB");
new TestAdapter(IndexedDB, []).test().then(() => {
    console.log("Testing WebSQL");
    new TestAdapter(WebSQL, []).test().then(() => {
        console.log("Tests Complete");
        RSE.trigger("done", errors);
    }).catch((err) => {
        console.error(err);
        errors++;
    });
}).catch((err) => {
    console.error(err);
    errors++;
});