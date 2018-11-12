Object.defineProperty(exports, "__esModule", { value: true });
var IndexedDB = /** @class */ (function () {
    function IndexedDB() {
        this.plugin = {
            name: "IndexedDB Adapter",
            version: 2.0,
            dependencies: {
                core: [2.0]
            }
        };
    }
    IndexedDB.prototype.connect = function (id, complete, error) {
    };
    IndexedDB.prototype.createAndInitTable = function (tableName, tableData, complete, error) {
    };
    IndexedDB.prototype.disconnectTable = function (table, complete, error) {
    };
    IndexedDB.prototype.dropTable = function (table, complete, error) {
    };
    IndexedDB.prototype.disconnect = function (complete, error) {
    };
    IndexedDB.prototype.write = function (table, pk, row, complete, error) {
    };
    IndexedDB.prototype.read = function (table, pk, complete, error) {
    };
    IndexedDB.prototype.delete = function (table, pk, complete, error) {
    };
    IndexedDB.prototype.readMulti = function (table, type, offsetOrLow, limitOrHeigh, reverse, onRow, complete, error) {
    };
    IndexedDB.prototype.getIndex = function (table, complete, error) {
    };
    IndexedDB.prototype.getNumberOfRecords = function (table, complete, error) {
    };
    return IndexedDB;
}());
exports.IndexedDB = IndexedDB;
//# sourceMappingURL=indexedDB.js.map