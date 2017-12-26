var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
define("store", ["require", "exports", "nano-sql"], function (require, exports, nano_sql_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function initStore() {
        nano_sql_1.nSQL("todos")
            .model([
            { key: "id", type: "int", props: ["pk", "ai"] },
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
        window["nSQL"] = nano_sql_1.nSQL;
        return nano_sql_1.nSQL().config({ id: "Todo-App", history: true }).connect();
    }
    exports.initStore = initStore;
});
define("component.table", ["require", "exports", "react", "react", "nano-sql"], function (require, exports, react_1, React, nano_sql_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var Done = {
        textDecoration: "line-through"
    };
    var TodoTable = (function (_super) {
        __extends(TodoTable, _super);
        function TodoTable(p) {
            var _this = _super.call(this, p) || this;
            _this.markDone = _this.markDone.bind(_this);
            return _this;
        }
        TodoTable.prototype.markDone = function (todoID) {
            nano_sql_2.nSQL("todos").doAction("mark_todo_done", { id: todoID });
        };
        TodoTable.onChange = function (event, complete) {
            nano_sql_2.nSQL("todos").getView("list_all_todos").then(complete);
        };
        TodoTable.prototype.render = function () {
            var _this = this;
            var noTodos;
            if (!this.props.nSQLdata || !this.props.nSQLdata.length) {
                noTodos = React.createElement("h3", { className: "uk-text-center" },
                    "No todos yet!",
                    React.createElement("br", null),
                    React.createElement("br", null));
            }
            return (React.createElement("div", null, noTodos ? noTodos : React.createElement("table", { className: "uk-table uk-table-striped uk-table-hover" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Title"),
                        React.createElement("th", { className: "uk-table-shrink" }, "Done"))),
                React.createElement("tbody", null, this.props.nSQLdata.map(function (todo) {
                    return React.createElement("tr", null,
                        React.createElement("td", { style: todo.done ? Done : {} }, todo.title),
                        React.createElement("td", null,
                            React.createElement("input", { className: "uk-checkbox uk-padding-small", type: "checkbox", checked: todo.done ? true : false, disabled: todo.done, onChange: function () { return todo.done ? null : _this.markDone(todo.id); } })));
                })))));
        };
        TodoTable.tables = ["todos"];
        return TodoTable;
    }(react_1.PureComponent));
    exports.TodoTable = TodoTable;
});
define("component.form", ["require", "exports", "react", "react", "nano-sql"], function (require, exports, react_2, React, nano_sql_3) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
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
            nano_sql_3.nSQL("todos").doAction("add_todo", { title: this.state.value }).then(function () {
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
        TodoForm.prototype.shouldComponentUpdate = function (nextProps, nextState) {
            return this.state.value !== nextState.value;
        };
        TodoForm.prototype.render = function () {
            return (React.createElement("form", { onSubmit: this.onSubmit },
                React.createElement("input", { placeholder: "New Todo Title", className: "uk-input", type: "text", value: this.state.value, onChange: this.updateTitle })));
        };
        return TodoForm;
    }(react_2.PureComponent));
    exports.TodoForm = TodoForm;
});
define("component.buttons", ["require", "exports", "react", "react", "nano-sql"], function (require, exports, react_3, React, nano_sql_4) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var TodoButtons = (function (_super) {
        __extends(TodoButtons, _super);
        function TodoButtons(p) {
            return _super.call(this, p) || this;
        }
        TodoButtons.prototype.undo = function () {
            nano_sql_4.nSQL().extend("hist", "<");
        };
        TodoButtons.prototype.redo = function () {
            nano_sql_4.nSQL().extend("hist", ">");
        };
        TodoButtons.onChange = function (event, complete) {
            nano_sql_4.nSQL("todos").extend("hist", "?").then(complete);
        };
        TodoButtons.prototype.render = function () {
            if (!this.props.nSQLdata) {
                return React.createElement("div", null);
            }
            return (React.createElement("div", { style: {
                    float: "right",
                    position: "relative",
                    top: "-59px",
                    marginBottom: "-40px"
                } },
                React.createElement("button", { disabled: this.props.nSQLdata[1] === 0, onClick: this.undo, className: "uk-button uk-button-default uk-button-small" }, "Undo"),
                React.createElement("button", { disabled: this.props.nSQLdata[0] === 0 || this.props.nSQLdata[0] === this.props.nSQLdata[1], onClick: this.redo, className: "uk-button uk-button-default uk-button-small" }, "Redo")));
        };
        TodoButtons.tables = ["todos"];
        return TodoButtons;
    }(react_3.PureComponent));
    exports.TodoButtons = TodoButtons;
});
define("index", ["require", "exports", "react", "react", "react-dom", "store", "nano-sql-react", "component.table", "component.form", "component.buttons"], function (require, exports, react_4, React, ReactDOM, store_1, nano_sql_react_1, component_table_1, component_form_1, component_buttons_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var TodoApp = (function (_super) {
        __extends(TodoApp, _super);
        function TodoApp() {
            var _this = _super.call(this) || this;
            _this.todoTableHOC = nano_sql_react_1.bindNSQL(component_table_1.TodoTable, {
                tables: component_table_1.TodoTable.tables,
                onChange: component_table_1.TodoTable.onChange
            });
            _this.todoButtonHOC = nano_sql_react_1.bindNSQL(component_buttons_1.TodoButtons, {
                tables: component_buttons_1.TodoButtons.tables,
                onChange: component_buttons_1.TodoButtons.onChange
            });
            return _this;
        }
        TodoApp.prototype.render = function () {
            return (React.createElement("div", { className: "uk-container uk-container-small", style: { maxWidth: "400px" } },
                React.createElement("br", null),
                React.createElement("h3", { style: { marginTop: "0px" }, className: "uk-heading-divider" }, "Todos"),
                React.createElement(this.todoButtonHOC, null),
                React.createElement(component_form_1.TodoForm, null),
                React.createElement(this.todoTableHOC, null),
                React.createElement("a", { href: "https://github.com/ClickSimply/Some-SQL/tree/master/examples/react-todo", target: "_blank" }, "View Source")));
        };
        return TodoApp;
    }(react_4.PureComponent));
    store_1.initStore().then(function () {
        ReactDOM.render(React.createElement(TodoApp, null), document.body);
    });
});
