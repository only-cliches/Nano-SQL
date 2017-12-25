// Just started adding proper tests....

import { expect, assert } from "chai";
import "mocha";
const mochaTestData = require("mocha-testdata");
const colors = require("colors");

console.log(("Tests Beginning at " + new Date().toLocaleTimeString() + ", " + new Date().toDateString() as any).magenta);

import "./01-json";
import "./02-primaryKeys";
import "./03-integrity";
import "./04-select";
import "./05-where";
import "./06-upsert";
import "./07-deleteDrop";
import "./08-join";
import "./09-orderby";
import "./10-groupbyFns";
import "./11-orm";
import "./12-events";
// import "./12-history";