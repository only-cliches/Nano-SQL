Object.defineProperty(exports, "__esModule", { value: true });
var _NanoSQLTransactionORMQuery = (function () {
    function _NanoSQLTransactionORMQuery(queries, table, action, column, relationIDs) {
        this._queries = queries;
        this._query = {
            type: "orm",
            table: table,
            action: action,
            column: column,
            relationIDs: relationIDs
        };
    }
    _NanoSQLTransactionORMQuery.prototype.where = function (args) {
        this._query.where = args;
        return this;
    };
    _NanoSQLTransactionORMQuery.prototype.exec = function () {
        this._queries.push(this._query);
    };
    return _NanoSQLTransactionORMQuery;
}());
exports._NanoSQLTransactionORMQuery = _NanoSQLTransactionORMQuery;
var _NanoSQLTransactionQuery = (function () {
    function _NanoSQLTransactionQuery(action, args, table, queries) {
        this._action = action;
        this._actionArgs = args;
        this._modifiers = [];
        this._table = table;
        this._queries = queries;
    }
    _NanoSQLTransactionQuery.prototype.where = function (args) {
        return this._addCmd("where", args);
    };
    _NanoSQLTransactionQuery.prototype.orm = function (ormArgs) {
        return this._addCmd("orm", ormArgs);
    };
    _NanoSQLTransactionQuery.prototype._addCmd = function (type, args) {
        return this._modifiers.push({ type: type, args: args }), this;
    };
    _NanoSQLTransactionQuery.prototype.exec = function () {
        this._queries.push({
            type: "std",
            action: this._action,
            actionArgs: this._actionArgs,
            table: this._table,
            query: this._modifiers
        });
    };
    return _NanoSQLTransactionQuery;
}());
exports._NanoSQLTransactionQuery = _NanoSQLTransactionQuery;
