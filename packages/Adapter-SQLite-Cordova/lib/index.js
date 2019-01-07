var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var nano_sql_1 = require("nano-sql");
var sqlite_adapter_1 = require("./sqlite-adapter");
var lie_ts_1 = require("lie-ts");
var initNanoSQL = (function () {
    function initNanoSQL(setup, doNotSetGlobal) {
        var _this = this;
        this._noGlobal = doNotSetGlobal || false;
        this._nsql = new nano_sql_1.NanoSQLInstance();
        setup(function (table) {
            return _this._nsql.table(table);
        });
    }
    initNanoSQL.prototype.connect = function () {
        var _this = this;
        return new lie_ts_1.Promise(function (res, rej) {
            if (!_this._noGlobal) {
                window.nSQL = function (table) {
                    return _this._nsql.table(table);
                };
            }
            var config = _this._nsql.getConfig();
            _this._nsql.config(__assign({}, config, { mode: sqlite_adapter_1.getMode() })).connect().then(function () {
                res(function (table) {
                    return _this._nsql.table(table);
                });
            }).catch(rej);
        });
    };
    return initNanoSQL;
}());
exports.initNanoSQL = initNanoSQL;
