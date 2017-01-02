import * as React from "react";
import * as ReactDOM from "react-dom";
import { initStore } from "./store";
import { SomeSQL } from "some-sql";

const TodoItem = (props) => {
    return(
        <div>yo</div>
    );
};

const TitleStyle = {
    width: "80%"
}

const TodoTable = (props) => {
    return(
        <table>
            <thead>
                <tr>
                    <th style={TitleStyle}>Title</th>
                    <th>Done</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td>2</td>
                </tr>
            </tbody>
        </table>
    );
}

interface TodoAppState {
    todos?: Array<any>;
}

class TodoApp extends React.Component<any, TodoAppState> {

    constructor() {
        super();
        SomeSQL("todos").doAction("add_todo",{name:"Test"}).then(() => {
            SomeSQL("todos").getView("list_all_todos",{}).then((rows) => {
                this.setState({
                    todos: rows
                });
            });
        });

    }

    public shouldComponentUpdate(nextProps, nextState) {
        return this.state !== nextState;
    }

    public render() {
        return (
            <div className="container">
                <h1>Todo Items</h1>
                <TodoTable />
            </div>
        )
    }
}



initStore().then(() => {
    ReactDOM.render(<TodoApp />, document.body);
});

