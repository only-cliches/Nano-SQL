// const mochaTestData = require("mocha-testdata");
const colors = require("colors");

console.log(("Tests Beginning at " + new Date().toLocaleTimeString() + ", " + new Date().toDateString() as any).magenta);

global["_crypto"] = require("crypto");

require("./01-import&export");
require("./02-primarykeys");
require("./03-sqlite");
require("./04-query");
// require("./05-adapters");