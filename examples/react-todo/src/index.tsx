import * as React from "react";
import { EventHandler, FormEvent } from "react";
import * as ReactDOM from "react-dom";
import { initStore } from "./store";
import { SomeSQL } from "some-sql";


const TitleStyle = {
    width: "75%"
}

const Done = {
    textDecoration: "line-through"
}

const TodoTable = (props: {todos: Array<any>, markDone: EventHandler<FormEvent<HTMLInputElement>>}) => {
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

class TodoForm extends React.Component<any, any> {

    constructor() {
        super();
        this.state = {value: ""};
        this.onSubmit = this.onSubmit.bind(this);
        this.updateTitle = this.updateTitle.bind(this);
    }

    public onSubmit(event) {
        event.preventDefault();
        if (!this.state.value.length) return;
        SomeSQL("todos").doAction("add_todo", {title: this.state.value}).then(() => {
            this.setState({
                value: ""
            });
        });

    }

    public updateTitle(event) {
        this.setState({
            value: event.target.value
        });
    };

    public render() {
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

class TodoApp extends React.Component<any, TodoAppState> {

    constructor() {
        super();
        this.state = {
            todos:[]
        };
        this.updateComponent = this.updateComponent.bind(this);
        this.markDone = this.markDone.bind(this);
    }

    public markDone(todoID) {
        SomeSQL("todos").doAction("mark_todo_done", {id: todoID});
    }

    // Event handler for the db
    public updateComponent(e, db) {
        db.getView("list_all_todos").then((rows, db) => {
            this.setState({
                todos: rows
            });
        });
    }

    // Update this component when the table gets updated, load initial data.
    public componentWillMount() {
        SomeSQL("todos").on("change", this.updateComponent);
        this.updateComponent({}, SomeSQL("todos"));
    }

    // Clear the event handler, otherwise it's a memory leak!
    public componentWillUnmount() {
        SomeSQL("todos").off(this.updateComponent);
    }

    // Ahhh, that feels nice.
    public shouldComponentUpdate(nextProps, nextState) {
        return this.state !== nextState;
    }

    public render() {
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

