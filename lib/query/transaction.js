Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable-next-line
var _NanoSQLTransactionQuery = /** @class */ (function () {
    function _NanoSQLTransactionQuery(action, args, table, queries, transactionID) {
        this.thisQ = {
            state: "pending",
            table: table,
            action: action,
            actionArgs: args,
            queryID: transactionID,
            transaction: true,
            result: [],
            comments: []
        };
        this._queries = queries;
    }
    _NanoSQLTransactionQuery.prototype.where = function (args) {
        this.thisQ.where = args;
        return this;
    };
    _NanoSQLTransactionQuery.prototype.exec = function () {
        this._queries.push(this.thisQ);
    };
    return _NanoSQLTransactionQuery;
}());
exports._NanoSQLTransactionQuery = _NanoSQLTransactionQuery;
//# sourceMappingURL=transaction.js.map