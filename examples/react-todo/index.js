var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define("store", ["require", "exports", "some-sql"], function (require, exports, some_sql_1) {
    "use strict";
    function initStore() {
        var _this = this;
        some_sql_1.SomeSQL("todos")
            .model([
            { key: "id", type: "uuid", props: ["pk"] },
            { key: "done", type: "bool" },
            { key: "title", type: "string" }
        ])
            .actions([
            {
                name: "add_todo",
                args: ["name:string"],
                call: function (args) {
                    return _this.query("upsert", {
                        title: args["title"],
                        done: false,
                    }).exec();
                }
            },
            {
                name: "delete_todo",
                args: ["id:string"],
                call: function (args) {
                    return _this.query("delete").where(["id", "=", args["id"]]).exec();
                }
            },
            {
                name: "mark_todo_done",
                args: ["id:string"],
                call: function (args) {
                    return _this.query("upsert", { done: true }).where(["id", "=", args["id"]]).exec();
                }
            }
        ])
            .views([
            {
                name: "list_all_todos",
                call: function () {
                    return _this.query("select").exec();
                }
            }
        ]);
        return some_sql_1.SomeSQL().connect();
    }
    exports.initStore = initStore;
});
define("index", ["require", "exports", "react", "react-dom", "store", "some-sql"], function (require, exports, React, ReactDOM, store_1, some_sql_2) {
    "use strict";
    var TodoItem = function (props) {
        return (React.createElement("div", null, "yo"));
    };
    var TodoTable = function (props) {
        return (React.createElement("table", null,
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Title"),
                    React.createElement("th", null, "Done"))),
            React.createElement("tbody", null,
                React.createElement("tr", null,
                    React.createElement("td", null, "1"),
                    React.createElement("td", null, "2")))));
    };
    var TodoApp = (function (_super) {
        __extends(TodoApp, _super);
        function TodoApp() {
            var _this = _super.call(this) || this;
            _this.state = {};
            some_sql_2.SomeSQL("todos").getView("list_all_todos", {}).then(function (rows) {
                console.log(rows);
            });
            return _this;
        }
        TodoApp.prototype.shouldComponentUpdate = function (nextProps, nextState) {
            return this.props !== nextProps;
        };
        TodoApp.prototype.setState = function (prevState, props) {
            console.log("SET STATE", prevState, props);
        };
        TodoApp.prototype.render = function () {
            return (React.createElement("div", { className: "container" },
                React.createElement("h1", null, "Todo Items"),
                React.createElement(TodoTable, null)));
        };
        return TodoApp;
    }(React.Component));
    store_1.initStore().then(function () {
        ReactDOM.render(React.createElement(TodoApp, null), document.body);
    });
});
