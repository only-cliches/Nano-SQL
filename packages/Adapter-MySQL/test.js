"use strict";
exports.__esModule = true;
var NanoSQL_Adapter_Test_1 = require("NanoSQL-Adapter-Test");
var source_1 = require("./source");
new NanoSQL_Adapter_Test_1.TestAdapter(source_1.MySQLAdapter, [{
        host: "localhost",
        database: "test",
        user: "root",
        password: ""
    }]);
