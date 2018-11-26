const mochaTestData = require("mocha-testdata");
const colors = require("colors");

console.log(("Tests Beginning at " + new Date().toLocaleTimeString() + ", " + new Date().toDateString() as any).magenta);

require("./01-import&export");
require("./02-primarykeys");
require("./03-sqlite");