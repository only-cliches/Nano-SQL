Object.defineProperty(exports, "__esModule", { value: true });
var WebSQL = /** @class */ (function () {
    function WebSQL() {
        this.plugin = {
            name: "WebSQL Adapter",
            version: 2.0,
            dependencies: {
                core: [2.0]
            }
        };
    }
    WebSQL.prototype.connect = function (id, complete, error) {
    };
    WebSQL.prototype.createAndInitTable = function (tableName, tableData, complete, error) {
    };
    WebSQL.prototype.disconnectTable = function (table, complete, error) {
    };
    WebSQL.prototype.dropTable = function (table, complete, error) {
    };
    WebSQL.prototype.disconnect = function (complete, error) {
    };
    WebSQL.prototype.write = function (table, pk, row, complete, error) {
    };
    WebSQL.prototype.read = function (table, pk, complete, error) {
    };
    WebSQL.prototype.delete = function (table, pk, complete, error) {
    };
    WebSQL.prototype.readMulti = function (table, type, offsetOrLow, limitOrHeigh, reverse, onRow, complete, error) {
    };
    WebSQL.prototype.readMultiPK = function (table, type, offsetOrLow, limitOrHeigh, reverse, onPK, complete, error) {
    };
    WebSQL.prototype.getIndex = function (table, complete, error) {
    };
    WebSQL.prototype.getNumberOfRecords = function (table, complete, error) {
    };
    return WebSQL;
}());
exports.WebSQL = WebSQL;
//# sourceMappingURL=webSQL.js.map