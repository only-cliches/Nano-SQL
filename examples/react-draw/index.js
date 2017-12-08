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
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
define("store", ["require", "exports", "nano-sql"], function (require, exports, nano_sql_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DrawStore = function () {
        nano_sql_1.nSQL("paths")
            .model([
            { key: "id", type: "int", props: ["pk", "ai"] },
            { key: "color", type: "string" },
            { key: "size", type: "int" },
            { key: "path", type: "array" }
        ]);
        return nano_sql_1.nSQL().config({ persistent: true, history: true, id: "Draw-App" }).connect();
    };
});
define("index", ["require", "exports", "react", "react", "react-dom", "store", "nano-sql", "jquery"], function (require, exports, react_1, React, ReactDOM, store_1, nano_sql_2, $) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var DrawingApp = (function (_super) {
        __extends(DrawingApp, _super);
        function DrawingApp() {
            var _this = _super.call(this) || this;
            _this.state = {
                color: "#555555",
                size: 5,
                redos: [0, 0],
                rendering: false,
                canErase: false
            };
            _this.colors = [
                "#d9e3f0",
                "#f47373",
                "#697689",
                "#37d67a",
                "#2ccce4",
                "#555555",
                "#dce775",
                "#ba68c8"
            ];
            _this.updateComponent = _this.updateComponent.bind(_this);
            _this.undo = _this.undo.bind(_this);
            _this.redo = _this.redo.bind(_this);
            _this.setColor = _this.setColor.bind(_this);
            _this.canDo = _this.canDo.bind(_this);
            _this.erase = _this.erase.bind(_this);
            return _this;
        }
        DrawingApp.prototype.erase = function () {
            var t = this;
            if (!this.state.canErase)
                return;
            t.ctx.clearRect(0, 0, t.ctx.canvas.width, t.ctx.canvas.height);
            nano_sql_2.nSQL("paths").query("upsert", {
                color: "",
                size: -1,
                path: []
            }).exec();
            this.setState(__assign({}, this.state, { canErase: false }));
        };
        DrawingApp.prototype.undo = function () {
            var _this = this;
            nano_sql_2.nSQL().extend("hist", "<").then(function (result) {
                if (result)
                    _this.drawFromStore();
            });
        };
        DrawingApp.prototype.redo = function () {
            var _this = this;
            nano_sql_2.nSQL().extend("hist", ">").then(function (result) {
                if (result)
                    _this.drawFromStore();
            });
        };
        DrawingApp.prototype.setSize = function (size) {
            this.setState(__assign({}, this.state, { size: size }));
        };
        DrawingApp.prototype.setColor = function (color) {
            this.setState(__assign({}, this.state, { color: color }));
        };
        DrawingApp.prototype.updateComponent = function (e, db) {
            var t = this;
            nano_sql_2.nSQL().extend("hist", "?").then(function (historyArray) {
                t.setState(__assign({}, t.state, { redos: historyArray }));
            });
        };
        DrawingApp.prototype.drawFromStore = function () {
            var _this = this;
            var t = this;
            this.setState(__assign({}, this.state, { rendering: true }));
            console.time("Redraw");
            t.ctx.clearRect(0, 0, t.ctx.canvas.width, t.ctx.canvas.height);
            var lastAction = "draw";
            nano_sql_2.nSQL("paths").query("select").exec().then(function (rows) {
                var prevPath = { x: 0, y: 0 };
                rows.forEach(function (row, i) {
                    if (row.size !== -1) {
                        lastAction = "draw";
                        row.path.forEach(function (p, k) {
                            if (k > 0)
                                prevPath = row.path[k - 1];
                            if (k > 0)
                                t.draw(row.color, row.size, prevPath.y, prevPath.x, p.y, p.x);
                        });
                    }
                    else {
                        lastAction = "erase";
                        t.ctx.clearRect(0, 0, t.ctx.canvas.width, t.ctx.canvas.height);
                    }
                });
                console.timeEnd("Redraw");
                _this.setState(__assign({}, _this.state, { rendering: false, canErase: rows.length > 0 && lastAction !== "erase" }));
            });
        };
        DrawingApp.prototype.draw = function (color, size, prevY, prevX, currY, currX) {
            var t = this;
            if (t.currentPath)
                t.currentPath.path.push({ x: currX, y: currY });
            t.ctx.beginPath();
            t.ctx.moveTo(prevX, prevY);
            t.ctx.lineTo(currX, currY);
            t.ctx.strokeStyle = color;
            t.ctx.lineWidth = size;
            t.ctx.lineJoin = "round";
            t.ctx.closePath();
            t.ctx.stroke();
        };
        DrawingApp.prototype.componentDidMount = function () {
            var canvas = document.getElementById("DrawingContainer");
            this.ctx = canvas.getContext("2d");
            this.drawFromStore();
            this.activateDrawingSurface(canvas);
        };
        DrawingApp.prototype.activateDrawingSurface = function (cnvs) {
            var t = this;
            var w = cnvs.width;
            var h = cnvs.height;
            var flag = false, prevX = 0, currX = 0, prevY = 0, currY = 0, dot_flag = false;
            var offset = $("#DrawingContainer").offset();
            $(window).on("resize", function () {
                offset = $("#DrawingContainer").offset();
            });
            var findxy = function (res, e) {
                if (res === "down") {
                    prevX = currX;
                    prevY = currY;
                    currX = e.clientX - offset.left;
                    currY = e.clientY - offset.top;
                    flag = true;
                    t.currentPath = {
                        id: null,
                        color: t.state.color,
                        size: t.state.size,
                        path: [{ x: currX, y: currY }]
                    };
                }
                if (res === "up" || res === "out") {
                    if (flag === true && t.currentPath.path.length) {
                        nano_sql_2.nSQL("paths").query("upsert", t.currentPath).exec();
                        if (t.state.canErase === false) {
                            t.setState(__assign({}, t.state, { canErase: true }));
                        }
                    }
                    flag = false;
                }
                if (res === "move") {
                    if (flag) {
                        prevX = currX;
                        prevY = currY;
                        currX = e.clientX - offset.left;
                        currY = e.clientY - offset.top;
                        t.draw(t.state.color, t.state.size, prevY, prevX, currY, currX);
                    }
                }
            };
            var renderCursor = function (type, e) {
                if (type === "out") {
                    $(".cursor").css("opacity", 0);
                }
                else {
                    $(".cursor").css("left", e.screenX - offset.left).css("top", e.screenY - offset.top - 52).css("opacity", 1);
                }
            };
            cnvs.addEventListener("mousemove", function (e) {
                findxy("move", e);
                renderCursor("move", e);
            }, false);
            cnvs.addEventListener("mousedown", function (e) {
                findxy("down", e);
            }, false);
            cnvs.addEventListener("mouseup", function (e) {
                findxy("up", e);
            }, false);
            cnvs.addEventListener("mouseout", function (e) {
                findxy("out", e);
                renderCursor("out", e);
            }, false);
        };
        DrawingApp.prototype.componentWillMount = function () {
            nano_sql_2.nSQL("paths").on("change", this.updateComponent);
            nano_sql_2.nSQL("paths").on("select", this.updateComponent);
        };
        DrawingApp.prototype.componentWillUnmount = function () {
            nano_sql_2.nSQL("paths").off(this.updateComponent);
        };
        DrawingApp.prototype.canDo = function (type) {
            if (this.state.redos[0] === 0) {
                return "is-disabled";
            }
            else {
                switch (type) {
                    case ">": return this.state.redos[1] < this.state.redos[0] ? "" : "is-disabled";
                    case "<": return this.state.redos[1] > 0 ? "" : "is-disabled";
                }
            }
        };
        DrawingApp.prototype.render = function () {
            var _this = this;
            return (React.createElement("div", { className: "container" },
                React.createElement("nav", { className: "level", style: { padding: "1.25rem 0", marginBottom: "0px" } },
                    React.createElement("div", { className: "level-left" },
                        React.createElement("div", { className: "level-item" }, "Color"),
                        React.createElement("div", { className: "level-item" },
                            React.createElement("div", { className: "colorPicker" }, this.colors.map(function (c) {
                                return React.createElement("span", { onClick: function () {
                                        _this.setColor(c);
                                    }, style: { background: c }, className: _this.state.color === c ? "picked" : "" });
                            }))),
                        React.createElement("div", { className: "level-item" }, "Size"),
                        React.createElement("div", { className: "level-item" },
                            React.createElement("input", { value: this.state.size, onChange: function (e) {
                                    _this.setSize(parseInt(e.target.value));
                                }, style: { width: "60px" }, className: "input", type: "number", min: "2" })),
                        React.createElement("div", { className: "level-item" },
                            React.createElement("a", { title: "Clear", onClick: this.erase, className: "button is-danger " + (this.state.canErase ? "" : "is-disabled") },
                                React.createElement("span", { className: "typcn typcn-times" })))),
                    React.createElement("div", { className: "level-right undo-redo" },
                        React.createElement("a", { title: "Undo", onClick: this.undo, className: "button is-primary " + this.canDo("<") },
                            React.createElement("span", { className: "typcn typcn-arrow-back" })),
                        React.createElement("a", { title: "Redo", onClick: this.redo, className: "button is-primary " + this.canDo(">") },
                            React.createElement("span", { className: "typcn typcn-arrow-forward" })))),
                React.createElement("div", null,
                    React.createElement("canvas", { className: this.state.rendering ? "loading" : "", id: "DrawingContainer", width: "838", height: "600" })),
                React.createElement("div", { className: "cursor" },
                    React.createElement("span", { className: "typcn typcn-pen" })),
                React.createElement("a", { href: "https://github.com/ClickSimply/Some-SQL/tree/master/examples/react-draw", target: "_blank" }, "View Source")));
        };
        return DrawingApp;
    }(react_1.Component));
    store_1.DrawStore().then(function () {
        ReactDOM.render(React.createElement(DrawingApp, null), document.body);
    });
});
