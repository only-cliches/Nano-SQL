var __extends = (this && this.__extends) || (function() {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] }
            instanceof Array && function(d, b) { d.__proto__ = b; }) ||
        function(d, b) {
            for (var p in b)
                if (b.hasOwnProperty(p)) d[p] = b[p];
        };
    return function(d, b) {
        extendStatics(d, b);

        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
define("store", ["require", "exports", "nano-sql"], function(require, exports, nano_sql_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });

    function initStore() {
        nano_sql_1.nSQL("todos")
            .model([
                { key: "id", type: "int", props: ["pk", "ai"] },
                { key: "done", type: "bool", default: false },
                { key: "title", type: "string", default: "" }
            ])
            .actions([{
                    name: "add_todo",
                    args: ["title:string"],
                    call: function(args, db) {
                        return db.query("upsert", {
                            title: args.title,
                            done: false,
                        }).exec();
                    }
                },
                {
                    name: "mark_todo_done",
                    args: ["id:int"],
                    call: function(args, db) {
                        return db.query("upsert", { done: true }).where(["id", "=", args.id]).exec();
                    }
                }
            ])
            .views([{
                name: "list_all_todos",
                call: function(args, db) {
                    return db.query("select").exec();
                }
            }]);
        return nano_sql_1.nSQL().config({ id: "Todo-App", persistent: true }).connect();
    }
    exports.initStore = initStore;
});
define("index", ["require", "exports", "react", "react", "react-dom", "store", "nano-sql"], function(require, exports, react_1, React, ReactDOM, store_1, nano_sql_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var TitleStyle = {
        width: "75%"
    };
    var Done = {
        textDecoration: "line-through"
    };;
    var TodoTable = function(props) {
        return (React.createElement("table", null,
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", { style: TitleStyle }, "Title"),
                    React.createElement("th", null, "Done"))),
            React.createElement("tbody", null, props.todos.map(function(todo) {
                return React.createElement("tr", null,
                    React.createElement("td", { style: todo.done ? Done : {} }, todo.title),
                    React.createElement("td", null,
                        React.createElement("input", { type: "checkbox", checked: todo.done ? true : false, disabled: todo.done, onChange: function() { return todo.done ? null : props.markDone(todo.id); } })));
            }))));
    };
    var TodoForm = (function(_super) {
        __extends(TodoForm, _super);

        function TodoForm() {
            var _this = _super.call(this) || this;
            _this.state = { value: "" };
            _this.onSubmit = _this.onSubmit.bind(_this);
            _this.updateTitle = _this.updateTitle.bind(_this);
            return _this;
        }
        TodoForm.prototype.onSubmit = function(event) {
            var _this = this;
            event.preventDefault();
            if (!this.state.value.length)
                return;
            nano_sql_2.nSQL("todos").doAction("add_todo", { title: this.state.value }).then(function() {
                _this.setState({
                    value: ""
                });
            });
        };
        TodoForm.prototype.updateTitle = function(event) {
            this.setState({
                value: event.currentTarget.value
            });
        };;
        TodoForm.prototype.shouldComponentUpdate = function(nextProps, nextState) {
            return this.state.value !== nextState.value;
        };
        TodoForm.prototype.render = function() {
            return (React.createElement("form", { onSubmit: this.onSubmit },
                React.createElement("div", { className: "row" },
                    React.createElement("div", { className: "column column-75" },
                        React.createElement("input", { placeholder: "New Todo Title", type: "text", value: this.state.value, onChange: this.updateTitle })),
                    React.createElement("div", { className: "column column-25" },
                        React.createElement("input", { className: "button button-outline", type: "submit", value: "+" })))));
        };
        return TodoForm;
    }(react_1.Component));
    var TodoApp = (function(_super) {
        __extends(TodoApp, _super);

        function TodoApp() {
            var _this = _super.call(this) || this;
            _this.state = {
                todos: [],
                redos: [0, 0]
            };
            _this.updateComponent = _this.updateComponent.bind(_this);
            _this.markDone = _this.markDone.bind(_this);
            _this.undo = _this.undo.bind(_this);
            _this.redo = _this.redo.bind(_this);
            _this.clearHist = _this.clearHist.bind(_this);
            _this.clearAll = _this.clearAll.bind(_this);
            return _this;
        }
        TodoApp.prototype.clearHist = function() {
            nano_sql_2.nSQL().extend("flush_history");
        };
        TodoApp.prototype.clearAll = function() {
            nano_sql_2.nSQL().extend("flush_db");
        };
        TodoApp.prototype.markDone = function(todoID) {
            nano_sql_2.nSQL("todos").doAction("mark_todo_done", { id: todoID });
        };
        TodoApp.prototype.undo = function() {
            nano_sql_2.nSQL().extend("<").then((res) => {
                console.log("UNDO", res);
            })
        };
        TodoApp.prototype.redo = function() {
            nano_sql_2.nSQL().extend(">").then((res) => {
                console.log("REDO", res);
            })
        };
        TodoApp.prototype.updateComponent = function(e, db) {
            var t = this;
            nano_sql_2.nSQL("todos").getView("list_all_todos").then(function(rows, db) {
                nano_sql_2.nSQL().extend("?").then(function(historyArray) {
                    t.setState({
                        todos: rows,
                        redos: historyArray
                    });
                });
            });
        };
        TodoApp.prototype.componentWillMount = function() {
            nano_sql_2.nSQL("todos").on("change", this.updateComponent);
            this.updateComponent();
        };
        TodoApp.prototype.componentWillUnmount = function() {
            nano_sql_2.nSQL("todos").off(this.updateComponent);
        };
        TodoApp.prototype.shouldComponentUpdate = function(nextProps, nextState) {
            return this.state.todos !== nextState.todos;
        };
        TodoApp.prototype.render = function() {
            return (React.createElement("div", { className: "container" },
                React.createElement("br", null),
                React.createElement("br", null),
                React.createElement("a", { href: "https://github.com/ClickSimply/Some-SQL/tree/master/examples/react-todo", target: "_blank" }, "View Source"),
                React.createElement("div", { className: "row" },
                    React.createElement("div", { className: "column column-50" },
                        React.createElement("h2", null, "Todo Items")),
                    React.createElement("div", { className: "column column-25" },
                        React.createElement("button", { disabled: this.state.redos[1] === 0, onClick: this.undo, className: "noselect button" }, "Undo")),
                    React.createElement("div", { className: "column column-25" },
                        React.createElement("button", { disabled: this.state.redos[0] === 0 || this.state.redos[0] === this.state.redos[1], onClick: this.redo, className: "noselect button" }, "Redo"))),
                React.createElement(TodoForm, null),
                React.createElement(TodoTable, { markDone: this.markDone, todos: this.state.todos }),
                React.createElement("button", { disabled: this.state.redos[0] === 0 && this.state.redos[0] === 0, onClick: this.clearHist, className: "noselect button" }, "Clear History"),
                React.createElement("span", null, "\u00A0\u00A0"),
                React.createElement("button", { onClick: this.clearAll, className: "noselect button" }, "Clear Everything")));
        };
        return TodoApp;
    }(react_1.Component));
    store_1.initStore().then(function() {
        ReactDOM.render(React.createElement(TodoApp, null), document.body);
    });
});