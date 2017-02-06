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
            { key: "id", type: "int", props: ["pk"] },
            { key: "done", type: "bool", default: false },
            { key: "title", type: "string", default: "" }
        ])
            .actions([
            {
                name: "add_todo",
                args: ["title:string"],
                call: function (args, db) {
                    return db.query("upsert", {
                        title: args.title,
                        done: false,
                    }).exec();
                }
            },
            {
                name: "mark_todo_done",
                args: ["id:int"],
                call: function (args, db) {
                    return db.query("upsert", { done: true }).where(["id", "=", args.id]).exec();
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
                    React.createElement("th", {style: TitleStyle}, "Title"), 
                    React.createElement("th", null, "Done"))
            ), 
            React.createElement("tbody", null, props.todos.map(function (todo) {
                return React.createElement("tr", null, 
                    React.createElement("td", {style: todo.done ? Done : {}}, todo.title), 
                    React.createElement("td", null, 
                        React.createElement("input", {type: "checkbox", checked: todo.done ? true : false, disabled: todo.done, value: todo.done, onChange: function () { return todo.done ? null : props.markDone.apply(_this, [todo.id]); }})
                    ));
            }))));
    };
    var TodoForm = (function (_super) {
        __extends(TodoForm, _super);
        function TodoForm() {
            _super.call(this);
            this.state = { value: "" };
            this.onSubmit = this.onSubmit.bind(this);
            this.updateTitle = this.updateTitle.bind(this);
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
        TodoForm.prototype.shouldComponentUpdate = function (nextProps, nextState) {
            return this.state.value !== nextState.value;
        };
        TodoForm.prototype.render = function () {
            return (React.createElement("form", {onSubmit: this.onSubmit}, 
                React.createElement("div", {className: "row"}, 
                    React.createElement("div", {className: "column column-75"}, 
                        React.createElement("input", {placeholder: "New Todo Title", type: "text", value: this.state.value, onChange: this.updateTitle})
                    ), 
                    React.createElement("div", {className: "column column-25"}, 
                        React.createElement("input", {className: "button button-outline", type: "submit", value: "+"})
                    ))
            ));
        };
        return TodoForm;
    }(react_1.Component));
    var TodoApp = (function (_super) {
        __extends(TodoApp, _super);
        function TodoApp() {
            _super.call(this);
            this.state = {
                todos: [],
                redos: [0, 0]
            };
            this.updateComponent = this.updateComponent.bind(this);
            this.markDone = this.markDone.bind(this);
            this.undo = this.undo.bind(this);
            this.redo = this.redo.bind(this);
        }
        TodoApp.prototype.markDone = function (todoID) {
            some_sql_2.SomeSQL("todos").doAction("mark_todo_done", { id: todoID });
        };
        TodoApp.prototype.undo = function () {
            some_sql_2.SomeSQL().extend("<");
        };
        TodoApp.prototype.redo = function () {
            some_sql_2.SomeSQL().extend(">");
        };
        TodoApp.prototype.updateComponent = function (e, db) {
            var t = this;
            var oldRedo = this.state.redos;
            db.getView("list_all_todos").then(function (rows, db) {
                some_sql_2.SomeSQL().extend("?").then(function (historyArray) {
                    t.setState({
                        todos: rows,
                        redos: historyArray
                    });
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
            return (React.createElement("div", {className: "container"}, 
                React.createElement("br", null), 
                React.createElement("br", null), 
                React.createElement("div", {className: "row"}, 
                    React.createElement("div", {className: "column column-50"}, 
                        React.createElement("h2", null, "Todo Items")
                    ), 
                    React.createElement("div", {className: "column column-25"}, 
                        React.createElement("button", {disabled: this.state.redos[0] === 0 || this.state.redos[0] === this.state.redos[1], onClick: this.undo, className: "noselect button"}, "Undo")
                    ), 
                    React.createElement("div", {className: "column column-25"}, 
                        React.createElement("button", {disabled: this.state.redos[1] === 0, onClick: this.redo, className: "noselect button"}, "Redo")
                    )), 
                React.createElement(TodoForm, null), 
                React.createElement(TodoTable, {markDone: this.markDone, todos: this.state.todos})));
        };
        return TodoApp;
    }(react_1.Component));
    store_1.initStore().then(function () {
        ReactDOM.render(React.createElement(TodoApp, null), document.body);
    });
});
