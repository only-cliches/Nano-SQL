import * as React from "react";
import * as ReactDOM from "react-dom";
import { initStore } from "./store";
import { SomeSQL } from "some-sql";


const TitleStyle = {
    width: "80%"
}

const TodoTable = (props: {todos: Array<any>}) => {
    return(
        <table>
            <thead>
                <tr>
                    <th style={TitleStyle}>Title</th>
                    <th>Done</th>
                </tr>
            </thead>
            <tbody>
                {props.todos.map((todo) => <tr><td>{ todo.title }</td><td></td></tr>)}
            </tbody>
        </table>
    );
}

class TodoForm extends React.Component<any, any> {

    constructor() {
        super();
        this.state = {};
        this.onSubmit = this.onSubmit.bind(this);
        this.updateTitle = this.updateTitle.bind(this);
    }

    public onSubmit(event) {
        event.preventDefault();
        SomeSQL("todos").doAction("add_todo", {title: this.state.value});
        this.setState({
            value: ""
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
                <label>
                Title:
                    <input type="text" value={this.state.value} onChange={this.updateTitle} />
                </label>
                <input type="submit" value="+" />
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
        /*SomeSQL("todos").doAction("add_todo", {title: "Test"}).then((result, db) => {
            db.getView("list_all_todos",{}).then((rows, db) => {
                this.setState({
                    todos: rows
                });
            });
        });*/
        SomeSQL("todos").on("change", (e, db) => {
            console.log(e, db);
            db.getView("list_all_todos").then((rows, db) => {
                this.setState({
                    todos: rows
                });
            });
        })
    }

    public shouldComponentUpdate(nextProps, nextState) {
        return this.state !== nextState;
    }

    public render() {
        return (
            <div className="container">
                <h1>Todo Items</h1>
                <TodoTable todos={this.state.todos} />
                <TodoForm />
            </div>
        )
    }
}



initStore().then(() => {
    ReactDOM.render(<TodoApp />, document.body);
});

