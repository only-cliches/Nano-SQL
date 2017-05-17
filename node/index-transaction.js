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
    _NanoSQLTransactionQuery.prototype.range = function (limit, offset) {
        return this._addCmd("range", [limit, offset]);
    };
    _NanoSQLTransactionQuery.prototype.orm = function (ormArgs) {
        return this._addCmd("orm", ormArgs);
    };
    _NanoSQLTransactionQuery.prototype.orderBy = function (args) {
        return this._addCmd("orderby", args);
    };
    _NanoSQLTransactionQuery.prototype.groupBy = function (columns) {
        return this._addCmd("groupby", columns);
    };
    _NanoSQLTransactionQuery.prototype.having = function (args) {
        return this._addCmd("having", args);
    };
    _NanoSQLTransactionQuery.prototype.join = function (args) {
        return this._addCmd("join", args);
    };
    _NanoSQLTransactionQuery.prototype.limit = function (args) {
        return this._addCmd("limit", args);
    };
    _NanoSQLTransactionQuery.prototype.trieSearch = function (column, stringToSearch) {
        return this._addCmd("trie", [column, stringToSearch]);
    };
    _NanoSQLTransactionQuery.prototype.offset = function (args) {
        return this._addCmd("offset", args);
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
