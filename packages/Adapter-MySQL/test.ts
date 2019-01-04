import { TestAdapter } from "nanoSQL-Adapter-Test";
import { MySQLAdapter } from "./source";

new TestAdapter(MySQLAdapter, [{
    host: "localhost",
    database: "test",
    user: "root",
    password: ""
}]);