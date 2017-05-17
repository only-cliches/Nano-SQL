Object.defineProperty(exports, "__esModule", { value: true });
var lie_ts_1 = require("lie-ts");
var _NanoSQLNullStore = (function () {
    function _NanoSQLNullStore() {
    }
    _NanoSQLNullStore.prototype._connect = function (connectArgs) {
        connectArgs._onSuccess();
    };
    _NanoSQLNullStore.prototype._exec = function (execArgs) {
        execArgs.onSuccess([], "null", [], []);
    };
    _NanoSQLNullStore.prototype._extend = function (instance) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return null;
    };
    _NanoSQLNullStore.prototype._transaction = function () {
        return new lie_ts_1.Promise(function (res) { return res(); });
    };
    return _NanoSQLNullStore;
}());
exports._NanoSQLNullStore = _NanoSQLNullStore;
