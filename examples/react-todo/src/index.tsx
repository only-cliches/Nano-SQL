import { EventHandler, FormEvent, Component } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { initStore } from "./store";
import { SomeSQL, DatabaseEvent, SomeSQLInstance } from "some-sql";


const TitleStyle = {
    width: "75%"
}

const Done = {
    textDecoration: "line-through"
}

interface Nothing {};

const TodoTable = (props: {todos: Array<any>, markDone: (todoID: string) => void}): JSX.Element => {
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
                            <td><input type="checkbox" disabled={todo.done} value={todo.done} onChange={() => todo.done ? null : props.markDone.apply(this,[todo.id])} /></td>
                        </tr>;
                    })
                }
            </tbody>
        </table>
    );
}

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
        SomeSQL("todos").doAction("add_todo", {title: this.state.value}).then(() => {
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
    todos?: Array<any>;
}

class TodoApp extends Component<Nothing, TodoAppState> {

    constructor() {
        super();
        this.state = {
            todos:[]
        };
        this.updateComponent = this.updateComponent.bind(this);
        this.markDone = this.markDone.bind(this);
    }

    public markDone(todoID: string): void {
        SomeSQL("todos").doAction("mark_todo_done", {id: todoID});
    }

    // Event handler for the db
    public updateComponent(e: DatabaseEvent, db: SomeSQLInstance): void {
        db.getView("list_all_todos").then((rows, db) => {
            this.setState({
                todos: rows
            });
        });
    }

    // Update this component when the table gets updated.
    public componentWillMount(): void {
        SomeSQL("todos").on("change", this.updateComponent);
    }

    // Clear the event handler, otherwise it's a memory leak!
    public componentWillUnmount(): void {
        SomeSQL("todos").off(this.updateComponent);
    }

    // Ahhh, that feels nice.
    public shouldComponentUpdate(nextProps, nextState): Boolean {
        return this.state.todos !== nextState.todos;
    }

    public render(): JSX.Element {
        return (
            <div className="container">
                <h1>Todo Items</h1>
                <TodoTable markDone={this.markDone} todos={this.state.todos} />
                <TodoForm />
            </div>
        )
    }
}



initStore().then(() => {
    ReactDOM.render(<TodoApp />, document.body);
});

