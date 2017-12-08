import { nSQL } from "nano-sql";

export interface ItodoItem {
    id: number;
    done: boolean;
    title: string;
}

export function initStore() {

    nSQL("todos")
    .model([
        {key: "id", type: "int", props: ["pk", "ai"]},
        {key: "done", type: "bool", default: false},
        {key: "title", type: "string", default: ""}
    ])
    .actions([
        {
            name: "add_todo",
            args: ["title:string"],
            call: (args, db) => {
                return db.query("upsert", {
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
    ]);

    window["nSQL"] = nSQL;

    return nSQL().config({id: "Todo-App", history: true, persistent: true}).connect();

}
