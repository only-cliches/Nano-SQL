"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var React = require("react");
var nano_sql_1 = require("nano-sql");
function bindNSQL(Comp, props) {
    return (function (_super) {
        __extends(class_1, _super);
        function class_1(p) {
            var _this = _super.call(this, p) || this;
            _this.state = { data: undefined, isLoading: true };
            _this.updateState = _this.updateState.bind(_this);
            return _this;
        }
        class_1.prototype.componentWillMount = function () {
            var _this = this;
            if (props && props.tables && props.tables.length) {
                this.tables = props.tables;
            }
            else if (Comp.tables) {
                this.tables = Comp.tables();
            }
            else {
                throw Error("nSQL React: Need tables for nanoSQL HOC!");
            }
            if (props && props.onChange) {
                this.onChange = props.onChange;
            }
            else if (Comp.onChange) {
                this.onChange = Comp.onChange;
            }
            else {
                throw Error("nSQL React: Need tables for nanoSQL HOC!");
            }
            if (props && props.store) {
                this.store = props.store;
            }
            else {
                this.store = nano_sql_1.nSQL();
            }
            this.store.onConnected(function () {
                var prevTable = _this.store.sTable;
                var k = _this.tables.length;
                while (k--) {
                    _this.store.table(_this.tables[k]).on("change", _this.updateState);
                    _this.updateState({
                        table: _this.tables[k],
                        query: {
                            table: _this.tables[k],
                            action: null,
                            actionArgs: null,
                            state: "complete",
                            result: [],
                            comments: []
                        },
                        time: Date.now(),
                        notes: ["mount"],
                        result: [],
                        types: ["change"],
                        actionOrView: "",
                        affectedRows: []
                    });
                }
                _this.store.table(prevTable);
            });
        };
        class_1.prototype.componentWillUnmount = function () {
            var prevTable = this.store.sTable;
            var k = this.tables.length;
            while (k--) {
                this.store.table(this.tables[k]).off("change", this.updateState);
            }
            this.store.table(prevTable);
        };
        class_1.prototype.updateState = function (e) {
            var _this = this;
            this.setState({ isLoading: true }, function () {
                _this.onChange(e, function (data) {
                    _this.setState({ isLoading: false, data: data });
                });
            });
        };
        class_1.prototype.render = function () {
            return React.createElement(Comp, __assign({ nSQLloading: this.state.isLoading, nSQLdata: this.state.data }, this.props));
        };
        return class_1;
    }(React.Component));
}
exports.bindNSQL = bindNSQL;
