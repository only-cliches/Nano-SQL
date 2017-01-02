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
                name: "delete_todo",
                args: ["id:string"],
                call: function (args, db) {
                    return db.query("delete").where(["id", "=", args["id"]]).exec();
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
define("index", ["require", "exports", "react", "react-dom", "store", "some-sql"], function (require, exports, React, ReactDOM, store_1, some_sql_2) {
    "use strict";
    var TitleStyle = {
        width: "80%"
    };
    var TodoTable = function (props) {
        return (React.createElement("table", null,
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", { style: TitleStyle }, "Title"),
                    React.createElement("th", null, "Done"))),
            React.createElement("tbody", null, props.todos.map(function (todo) { return React.createElement("tr", null,
                React.createElement("td", null, todo.title),
                React.createElement("td", null)); }))));
    };
    var TodoForm = (function (_super) {
        __extends(TodoForm, _super);
        function TodoForm() {
            var _this = _super.call(this) || this;
            _this.state = {};
            _this.onSubmit = _this.onSubmit.bind(_this);
            _this.updateTitle = _this.updateTitle.bind(_this);
            return _this;
        }
        TodoForm.prototype.onSubmit = function (event) {
            event.preventDefault();
            some_sql_2.SomeSQL("todos").doAction("add_todo", { title: this.state.value }).then(function () {
                some_sql_2.SomeSQL("todos").query("select").exec().then(function (rows) {
                    console.log(rows);
                });
            });
            this.setState({
                value: ""
            });
        };
        TodoForm.prototype.updateTitle = function (event) {
            this.setState({
                value: event.target.value
            });
        };
        ;
        TodoForm.prototype.render = function () {
            return (React.createElement("form", { onSubmit: this.onSubmit },
                React.createElement("label", null,
                    "Title:",
                    React.createElement("input", { type: "text", value: this.state.value, onChange: this.updateTitle })),
                React.createElement("input", { type: "submit", value: "+" })));
        };
        return TodoForm;
    }(React.Component));
    var TodoApp = (function (_super) {
        __extends(TodoApp, _super);
        function TodoApp() {
            var _this = _super.call(this) || this;
            _this.state = {
                todos: []
            };
            some_sql_2.SomeSQL("todos").on("change", function () {
                some_sql_2.SomeSQL("todos").getView("list_all_todos").then(function (rows, db) {
                    _this.setState({
                        todos: rows
                    });
                });
            });
            return _this;
        }
        TodoApp.prototype.shouldComponentUpdate = function (nextProps, nextState) {
            return this.state !== nextState;
        };
        TodoApp.prototype.render = function () {
            return (React.createElement("div", { className: "container" },
                React.createElement("h1", null, "Todo Items"),
                React.createElement(TodoTable, { todos: this.state.todos }),
                React.createElement(TodoForm, null)));
        };
        return TodoApp;
    }(React.Component));
    store_1.initStore().then(function () {
        ReactDOM.render(React.createElement(TodoApp, null), document.body);
    });
});
