import * as React from "react";
import * as ReactDOM from "react-dom";
import { initStore } from "./store";
import { SomeSQL } from "some-sql";

const TodoItem = (props) => {
    return(
        <div>yo</div>
    );
};

const TodoTable = (props) => {
    return(
        <table>
            <thead>
                <tr>
                    <th>Title</th>
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

class TodoApp extends React.Component<any, any> {

    constructor() {
        super();
        this.state = {};
        SomeSQL("todos").getView("list_all_todos",{}).then((rows) => {
            console.log(rows);
        });
    }

    public shouldComponentUpdate(nextProps, nextState) {
        return this.props !== nextProps;
    }

    public setState(prevState?:any, props?:any) {
        console.log("SET STATE", prevState, props);
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

