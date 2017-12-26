import { EventHandler, FormEvent, Component, PureComponent } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { initStore, ItodoItem } from "./store";
import { nSQL, DatabaseEvent, NanoSQLInstance } from "nano-sql";
import { bindNSQL } from "nano-sql-react";
import { TodoTable } from "./component.table";
import { TodoForm } from "./component.form";
import { TodoButtons } from "./component.buttons";


interface Nothing {}

class TodoApp extends PureComponent<Nothing, Nothing> {

    public todoTableHOC: React.ComponentClass<any>;
    public todoButtonHOC: React.ComponentClass<any>;

    constructor() {
        super();

        this.todoTableHOC = bindNSQL(TodoTable, {
            tables: TodoTable.tables,
            onChange: TodoTable.onChange
        });

        this.todoButtonHOC = bindNSQL(TodoButtons, {
            tables: TodoButtons.tables,
            onChange: TodoButtons.onChange
        });
    }

    public render(): JSX.Element {
        return (
            <div className="uk-container uk-container-small" style={{maxWidth: "400px"}}>
                <br/>
                <h3 style={{marginTop: "0px"}} className="uk-heading-divider">Todos</h3>
                <this.todoButtonHOC />
                <TodoForm />
                <this.todoTableHOC />
                <a href="https://github.com/ClickSimply/Some-SQL/tree/master/examples/react-todo" target="_blank">View Source</a>
            </div>
        );
    }
}

initStore().then(() => {
    ReactDOM.render(<TodoApp />, document.body);
});