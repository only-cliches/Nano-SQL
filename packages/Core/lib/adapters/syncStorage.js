Object.defineProperty(exports, "__esModule", { value: true });
var SyncStorage = /** @class */ (function () {
    function SyncStorage(useLS) {
        this.useLS = useLS;
        this.plugin = {
            name: "Sync Storage Adapter",
            version: 2.0,
            dependencies: {
                core: [2.0]
            }
        };
    }
    SyncStorage.prototype.connect = function (id, complete, error) {
    };
    SyncStorage.prototype.createTable = function (tableName, tableData, complete, error) {
    };
    SyncStorage.prototype.disconnectTable = function (table, complete, error) {
    };
    SyncStorage.prototype.dropTable = function (table, complete, error) {
    };
    SyncStorage.prototype.disconnect = function (complete, error) {
    };
    SyncStorage.prototype.write = function (table, pk, row, complete, error) {
    };
    SyncStorage.prototype.read = function (table, pk, complete, error) {
    };
    SyncStorage.prototype.delete = function (table, pk, complete, error) {
    };
    SyncStorage.prototype.readMulti = function (table, type, offsetOrLow, limitOrHeigh, reverse, onRow, complete, error) {
    };
    SyncStorage.prototype.readMultiPK = function (table, type, offsetOrLow, limitOrHeigh, reverse, onPK, complete, error) {
    };
    SyncStorage.prototype.getIndex = function (table, complete, error) {
    };
    SyncStorage.prototype.getNumberOfRecords = function (table, complete, error) {
    };
    return SyncStorage;
}());
exports.SyncStorage = SyncStorage;
//# sourceMappingURL=syncStorage.js.map