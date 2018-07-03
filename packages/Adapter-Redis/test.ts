import { TestAdapter } from "NanoSQL-Adapter-Test";
import { RedisAdapter } from "./source";
import { nSQL, NanoSQLInstance } from "nano-sql";
import { uuid, fastALL } from "nano-sql/lib/utilities";

new TestAdapter(RedisAdapter, [{
    host: "127.0.0.1",
    port: 6379
}]);