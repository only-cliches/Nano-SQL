var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define("store", ["require", "exports", "some-sql"], function (require, exports, some_sql_1) {
    "use strict";
    function initStore() {
        some_sql_1.SomeSQL("todos")
            .model([
            { key: "id", type: "uuid", props: ["pk"] },
            { key: "done", type: "bool" },
            { key: "title", type: "string" }
        ])
            .actions([
            {
                name: "add_todo",
                args: ["title:string"],
                call: function (args, db) {
                    return db.query("upsert", {
                        title: args["title"],
                        done: false,
                    }).exec();
                }
            },
            {
                name: "mark_todo_done",
                args: ["id:string"],
                call: function (args, db) {
                    return db.query("upsert", { done: true }).where(["id", "=", args["id"]]).exec();
                }
            }
        ])
            .views([
            {
                name: "list_all_todos",
                call: function (args, db) {
                    return db.query("select").exec();
                }
            }
        ]);
        return some_sql_1.SomeSQL().connect();
    }
    exports.initStore = initStore;
});
define("index", ["require", "exports", "react", "react", "react-dom", "store", "some-sql"], function (require, exports, react_1, React, ReactDOM, store_1, some_sql_2) {
    "use strict";
    var _this = this;
    var TitleStyle = {
        width: "75%"
    };
    var Done = {
        textDecoration: "line-through"
    };
    ;
    var TodoTable = function (props) {
        return (React.createElement("table", null,
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", { style: TitleStyle }, "Title"),
                    React.createElement("th", null, "Done"))),
            React.createElement("tbody", null, props.todos.map(function (todo) {
                return React.createElement("tr", null,
                    React.createElement("td", { style: todo.done ? Done : {} }, todo.title),
                    React.createElement("td", null,
                        React.createElement("input", { type: "checkbox", disabled: todo.done, value: todo.done, onChange: function () { return todo.done ? null : props.markDone.apply(_this, [todo.id]); } })));
            }))));
    };
    var TodoForm = (function (_super) {
        __extends(TodoForm, _super);
        function TodoForm() {
            var _this = _super.call(this) || this;
            _this.state = { value: "" };
            _this.onSubmit = _this.onSubmit.bind(_this);
            _this.updateTitle = _this.updateTitle.bind(_this);
            return _this;
        }
        TodoForm.prototype.onSubmit = function (event) {
            var _this = this;
            event.preventDefault();
            if (!this.state.value.length)
                return;
            some_sql_2.SomeSQL("todos").doAction("add_todo", { title: this.state.value }).then(function () {
                _this.setState({
                    value: ""
                });
            });
        };
        TodoForm.prototype.updateTitle = function (event) {
            this.setState({
                value: event.currentTarget.value
            });
        };
        ;
        TodoForm.prototype.render = function () {
            return (React.createElement("form", { onSubmit: this.onSubmit },
                React.createElement("div", { className: "row" },
                    React.createElement("div", { className: "column column-75" },
                        React.createElement("input", { placeholder: "New Todo Title", type: "text", value: this.state.value, onChange: this.updateTitle })),
                    React.createElement("div", { className: "column column-25" },
                        React.createElement("input", { className: "button button-outline", type: "submit", value: "+" })))));
        };
        return TodoForm;
    }(react_1.Component));
    var TodoApp = (function (_super) {
        __extends(TodoApp, _super);
        function TodoApp() {
            var _this = _super.call(this) || this;
            _this.state = {
                todos: []
            };
            _this.updateComponent = _this.updateComponent.bind(_this);
            _this.markDone = _this.markDone.bind(_this);
            return _this;
        }
        TodoApp.prototype.markDone = function (todoID) {
            some_sql_2.SomeSQL("todos").doAction("mark_todo_done", { id: todoID });
        };
        TodoApp.prototype.updateComponent = function (e, db) {
            var _this = this;
            db.getView("list_all_todos").then(function (rows, db) {
                _this.setState({
                    todos: rows
                });
            });
        };
        TodoApp.prototype.componentWillMount = function () {
            some_sql_2.SomeSQL("todos").on("change", this.updateComponent);
        };
        TodoApp.prototype.componentWillUnmount = function () {
            some_sql_2.SomeSQL("todos").off(this.updateComponent);
        };
        TodoApp.prototype.shouldComponentUpdate = function (nextProps, nextState) {
            return this.state.todos !== nextState.todos;
        };
        TodoApp.prototype.render = function () {
            return (React.createElement("div", { className: "container" },
                React.createElement("h1", null, "Todo Items"),
                React.createElement(TodoTable, { markDone: this.markDone, todos: this.state.todos }),
                React.createElement(TodoForm, null)));
        };
        return TodoApp;
    }(react_1.Component));
    store_1.initStore().then(function () {
        ReactDOM.render(React.createElement(TodoApp, null), document.body);
    });
});
