import { SomeSQL } from "some-sql";

export function initStore() {

    SomeSQL("todos")
    .model([
        {key: "id" ,type: "uuid", props: ["pk"]},
        {key: "done", type: "bool"},
        {key: "title", type: "string"}
    ])
    .actions([
        {
            name: "add_todo",
            args: ["name:string"],
            call: (args, db) => {
                return db.query("upsert",{
                    title: args["title"],
                    done: false,
                }).exec();
            }
        },
        {
            name: "delete_todo",
            args: ["id:string"],
            call: (args, db) => {
                return db.query("delete").where(["id", "=", args["id"]]).exec();
            }
        },
        {
            name: "mark_todo_done",
            args: ["id:string"],
            call: (args, db) => {
                return db.query("upsert", {done: true}).where(["id", "=", args["id"]]).exec();
            }
        }
    ])
    .views([
        {
            name: "list_all_todos",
            call: (args, db) => {
                return db.query("select").exec();
            }
        }
    ])

    return SomeSQL().connect();

}
