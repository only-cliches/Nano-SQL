import { EventHandler, FormEvent, Component, PureComponent } from "react";
import * as React from "react";
import { nSQL, DatabaseEvent, NanoSQLInstance } from "nano-sql";
import { initStore, ItodoItem } from "./store";

const Done = {
    textDecoration: "line-through"
};

export class TodoTable extends PureComponent<{
    nSQLdata: ItodoItem[];
    nSQLloading: boolean;
}, any> {

    constructor(p) {
        super(p);
        this.markDone = this.markDone.bind(this);
    }

    public markDone(todoID: number): void {
        nSQL("todos").doAction("mark_todo_done", {id: todoID});
    }

    public static tables = ["todos"];

    public static onChange(event: DatabaseEvent, complete: (data: ItodoItem[]) => void) {
        nSQL("todos").getView("list_all_todos").then(complete);
    }

    render() {

        let noTodos;
        if (!this.props.nSQLdata || !this.props.nSQLdata.length) {
            noTodos = <h3 className="uk-text-center">No todos yet!<br/><br/></h3>;
        }

        return (
            <div>
                {noTodos ? noTodos : <table  className="uk-table uk-table-striped uk-table-hover">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th className="uk-table-shrink">Done</th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.props.nSQLdata.map(todo => {
                                return <tr>
                                    <td style={todo.done ? Done : {}} >{ todo.title }</td>
                                    <td><input className="uk-checkbox uk-padding-small" type="checkbox" checked={todo.done ? true : false} disabled={todo.done} onChange={() => todo.done ? null : this.markDone(todo.id)} /></td>
                                </tr>;
                            })
                        }
                    </tbody>
                </table>}
            </div>
        );
    }
}