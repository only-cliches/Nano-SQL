import { TestAdapter } from "nanoSQL-Adapter-Test";
import { RedisAdapter } from "./source";
import { nSQL, nanoSQLInstance } from "nano-sql";
import { uuid, fastALL } from "nano-sql/lib/utilities";

new TestAdapter(RedisAdapter, [{
    host: "127.0.0.1",
    port: 6379
}]);