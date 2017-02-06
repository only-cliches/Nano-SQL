import { SomeSQL } from "some-sql";

export function initStore() {

    SomeSQL("todos")
    .model([
        {key: "id" ,type: "int", props: ["pk"]},
        {key: "done", type: "bool", default: false},
        {key: "title", type: "string", default: ""}
    ])
    .actions([
        {
            name: "add_todo",
            args: ["title:string"],
            call: (args, db) => {
                return db.query("upsert",{
                    title: args.title,
                    done: false,
                }).exec();
            }
        },
        {
            name: "mark_todo_done",
            args: ["id:int"],
            call: (args, db) => {
                return db.query("upsert", {done: true}).where(["id", "=", args.id]).exec();
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
