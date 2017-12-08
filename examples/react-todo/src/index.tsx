import { EventHandler, FormEvent, Component, PureComponent } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { initStore, ItodoItem } from "./store";
import { nSQL, DatabaseEvent, NanoSQLInstance } from "nano-sql";

const Done = {
    textDecoration: "line-through"
};

interface Nothing {}

const TodoTable = (props: {todos: Array<ItodoItem>, markDone: (todoID: number) => void}): JSX.Element => {

    let noTodos = <span></span>;
    if (!props.todos.length) {
        noTodos = <h3 className="uk-text-center">No todos yet!<br/><br/></h3>;
    }

    return(
        <div>
            <table  className="uk-table uk-table-striped uk-table-hover">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th className="uk-table-shrink">Done</th>
                    </tr>
                </thead>
                <tbody>
                    {props.todos.map(todo => {
                            return <tr>
                                <td style={todo.done ? Done : {}} >{ todo.title }</td>
                                <td><input className="uk-checkbox uk-padding-small" type="checkbox" checked={todo.done ? true : false} disabled={todo.done} onChange={() => todo.done ? null : props.markDone(todo.id)} /></td>
                            </tr>;
                        })
                    }
                </tbody>
            </table>
            {noTodos}
        </div>
    );
};

interface FormState {
    value: string;
}

class TodoForm extends PureComponent<Nothing, FormState> {

    constructor() {
        super();
        this.state = {value: ""};
        this.onSubmit = this.onSubmit.bind(this);
        this.updateTitle = this.updateTitle.bind(this);
    }

    public onSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (!this.state.value.length) return;
        nSQL("todos").doAction("add_todo", {title: this.state.value}).then(() => {
            this.setState({
                value: ""
            });
        });

    }

    public updateTitle(event: FormEvent<HTMLInputElement>): void {
        this.setState({
            value: event.currentTarget.value
        });
    }

    public shouldComponentUpdate(nextProps, nextState): boolean {
        return this.state.value !== nextState.value;
    }

    public render(): JSX.Element {
        return (
            <form onSubmit={this.onSubmit}>
                <input placeholder="New Todo Title" className="uk-input" type="text" value={this.state.value} onChange={this.updateTitle} />
            </form>
        );
    }
}

interface TodoAppState {
    todos: Array<ItodoItem>;
    redos: Array<any>;
}

class TodoApp extends Component<Nothing, TodoAppState> {

    constructor() {
        super();
        this.state = {
            todos: [],
            redos: [0, 0]
        };
        this.updateComponent = this.updateComponent.bind(this);
        this.markDone = this.markDone.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.clearHist = this.clearHist.bind(this);
        this.clearAll = this.clearAll.bind(this);
    }

    public clearHist() {
        nSQL().extend("hist", "clear").then(() => {
            nSQL().extend("hist", "?").then((historyArray) => {
                this.setState({
                    ...this.state,
                    redos: historyArray
                });
            });
        });
    }

    public clearAll() {
        nSQL().extend("flush_db");
    }

    public markDone(todoID: number): void {
        nSQL("todos").doAction("mark_todo_done", {id: todoID});
    }

    public undo(): void {
        nSQL().extend("hist", "<");
    }

    public redo(): void {
        nSQL().extend("hist", ">");
    }

    // Event handler for the db
    public updateComponent(e?: DatabaseEvent, db?: NanoSQLInstance): void {

        nSQL("todos").getView("list_all_todos").then((rows: ItodoItem[], db: NanoSQLInstance) => {
            nSQL().extend("hist", "?").then((historyArray) => {
                this.setState({
                    todos: rows,
                    redos: historyArray
                });
            });
        });
    }

    // Update this component when the table gets updated.
    public componentWillMount(): void {
        nSQL("todos").on("change", this.updateComponent);
        this.updateComponent();
    }

    // Clear the event handler, otherwise it's a memory leak!
    public componentWillUnmount(): void {
        nSQL("todos").off(this.updateComponent);
    }

    // Ahhh, that feels nice.
    public shouldComponentUpdate(nextProps, nextState): boolean {
        return this.state.todos !== nextState.todos || this.state.redos !== this.state.redos;
    }

    public render(): JSX.Element {
        return (
            <div className="uk-container uk-container-small" style={{maxWidth: "400px"}}>
                <br/>
                <h3 style={{marginTop: "0px"}} className="uk-heading-divider">Todos</h3>
                <div style={{
                    float: "right",
                    position: "relative",
                    top: "-59px",
                    marginBottom: "-40px"
                }}>
                    <button disabled={this.state.redos[1] === 0} onClick={this.undo}  className="uk-button uk-button-default uk-button-small" >Undo</button>
                    <button disabled={this.state.redos[0] === 0 || this.state.redos[0] === this.state.redos[1]} onClick={this.redo}  className="uk-button uk-button-default uk-button-small">Redo</button>
                </div>
                <TodoForm />
                <TodoTable markDone={this.markDone} todos={this.state.todos} />
                <button disabled={this.state.redos[0] === 0 && this.state.redos[0] === 0} onClick={this.clearHist}  className="uk-button uk-button-default uk-button-small" >Clear History</button>
                <button onClick={this.clearAll}  className="uk-button uk-button-default uk-button-small" >Clear Everything</button>
                <br/><br/>
                <a href="https://github.com/ClickSimply/Some-SQL/tree/master/examples/react-todo" target="_blank">View Source</a>
            </div>
        );
    }
}

initStore().then(() => {
    ReactDOM.render(<TodoApp />, document.body);
});