// Just started adding proper tests....

import { nSQL } from "../src/index";
import { expect, assert } from "chai";
import "mocha";
const mochaTestData = require("mocha-testdata");
const colors = require("colors");

console.log(("Integration Tests Beginning at " + new Date().toLocaleTimeString() + ", " + new Date().toLocaleDateString() as any).magenta);

import "./0-setup";
import "./1-json";
import "./2-primaryKeys";
import "./3-integrity";
import "./4-select";
import "./5-where";
import "./6-upsert";
import "./7-deleteDrop";
import "./8-join";
import "./9-orderby";
import "./10-groupbyFns";