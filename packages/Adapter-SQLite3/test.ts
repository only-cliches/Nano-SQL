import { TestAdapter } from "NanoSQL-Adapter-Test";
import { nSQLiteAdapter } from "./src/index";

try {
    new TestAdapter(nSQLiteAdapter, [":memory:"]);
} catch (e) {
    console.error(e);
}


