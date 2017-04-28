import { nSQL } from "../src/index";

before((done) => {
    nSQL("users")
        .model([
            { key: "id", type: "int", props: ["pk", "ai"] },
            { key: "age", type: "int" },
            { key: "name", type: "string", props: ["idx"] }
        ]);
    nSQL("ships")
        .model([
            { key: "id", type: "int", props: ["pk", "ai"] },
            { key: "pilotId", type: "int" },
            { key: "name", type: "string" },
            { key: "meta", type: "map"},
            { key: "partIds", type: "int[]"},
            { key: "year", type: "int" }
        ])
    nSQL("uuid")
        .model([
            { key: "id", type: "uuid", props: ["pk"] },
        ])
    nSQL("timeId")
        .model([
            { key: "id", type: "timeId", props: ["pk"] },
        ])
    nSQL("timeIdms")
        .model([
            { key: "id", type: "timeIdms", props: ["pk"] },
        ])
        .connect().then(done);
});