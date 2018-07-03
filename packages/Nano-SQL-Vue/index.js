"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var nano_sql_1 = require("nano-sql");
exports.nSQLVue = function (props) {
    return {
        methods: {
            _nSQLDoRunUpdate: function (event) {
                if ((props.store || nano_sql_1.nSQL()).isConnected && this.nSQLonChange) {
                    props.callback.apply(this, [event, this.nSQLonChange]);
                }
            }
        },
        created: function () {
            var k = props.tables.length;
            while (k--) {
                (props.store || nano_sql_1.nSQL()).table(props.tables[k]).on("change", this._nSQLDoRunUpdate);
                this._nSQLDoRunUpdate({
                    table: props.tables[k],
                    query: {
                        table: props.tables[k],
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
        },
        destroyed: function () {
            var k = props.tables.length;
            while (k--) {
                (props.store || nano_sql_1.nSQL()).table(props.tables[k]).on("change", this._nSQLDoRunUpdate);
            }
        }
    };
};
