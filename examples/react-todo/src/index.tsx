import { EventHandler, FormEvent, Component } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { initStore, ItodoItem } from "./store";
import { nSQL, DatabaseEvent, NanoSQLInstance } from "nano-sql";


const TitleStyle = {
    width: "75%"
};

const Done = {
    textDecoration: "line-through"
};

interface Nothing {};

const TodoTable = (props: {todos: Array<ItodoItem>, markDone: (todoID: number) => void}): JSX.Element => {
    return(
        <table>
            <thead>
                <tr>
                    <th style={TitleStyle}>Title</th>
                    <th>Done</th>
                </tr>
            </thead>
            <tbody>
                {props.todos.map(todo => {
                        return <tr>
                            <td  style={todo.done ? Done : {}} >{ todo.title }</td>
                            <td><input type="checkbox" checked={todo.done ? true : false} disabled={todo.done} onChange={() => todo.done ? null : props.markDone(todo.id)} /></td>
                        </tr>;
                    })
                }
            </tbody>
        </table>
    );
};

interface FormState {
    value: string;
}

class TodoForm extends Component<Nothing, FormState> {

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
    };

    public shouldComponentUpdate(nextProps, nextState): boolean {
        return this.state.value !== nextState.value;
    }

    public render(): JSX.Element {
        return (
            <form onSubmit={this.onSubmit}>
                <div className="row">
                    <div className="column column-75">
                        <input placeholder="New Todo Title" type="text" value={this.state.value} onChange={this.updateTitle} />
                    </div>
                    <div className="column column-25">
                        <input className="button button-outline" type="submit" value="+" />
                    </div>
                </div>
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
        nSQL().extend("flush_history");
    }

    public clearAll() {
        nSQL().extend("flush_db");
    }

    public markDone(todoID: number): void {
        nSQL("todos").doAction("mark_todo_done", {id: todoID});
    }

    public undo(): void {
        nSQL().extend("<");
    }

    public redo(): void {
        nSQL().extend(">");
    }

    // Event handler for the db
    public updateComponent(e?: DatabaseEvent, db?: NanoSQLInstance): void {
        let t = this;

        nSQL("todos").getView("list_all_todos").then((rows: Array<ItodoItem>, db: NanoSQLInstance) => {
            nSQL().extend("?").then((historyArray) => {
                t.setState({
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
        return this.state.todos !== nextState.todos;
    }

    public render(): JSX.Element {
        return (
            <div className="container">
                <br/><br/>
                <a href="https://github.com/ClickSimply/Some-SQL/tree/master/examples/react-todo" target="_blank">View Source</a>
                <div className="row">
                    <div className="column column-50">
                        <h2>Todo Items</h2>
                    </div>
                    <div className="column column-25">
                        <button disabled={this.state.redos[1] === 0} onClick={this.undo} className="noselect button" >Undo</button>
                    </div>
                    <div className="column column-25">
                        <button disabled={this.state.redos[0] === 0 || this.state.redos[0] === this.state.redos[1]} onClick={this.redo} className="noselect button">Redo</button>
                    </div>
                </div>
                <TodoForm />
                <TodoTable markDone={this.markDone} todos={this.state.todos} />
                <button disabled={this.state.redos[0] === 0 && this.state.redos[0] === 0} onClick={this.clearHist} className="noselect button" >Clear History</button>
                <span>&nbsp;&nbsp;</span>
                <button onClick={this.clearAll} className="noselect button" >Clear Everything</button>
            </div>
        );
    }
}

initStore().then(() => {
    ReactDOM.render(<TodoApp />, document.body);
});