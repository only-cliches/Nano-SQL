Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = 2.12;
;
var InanoSQLFKActions;
(function (InanoSQLFKActions) {
    InanoSQLFKActions[InanoSQLFKActions["NONE"] = 0] = "NONE";
    InanoSQLFKActions[InanoSQLFKActions["CASCADE"] = 1] = "CASCADE";
    InanoSQLFKActions[InanoSQLFKActions["RESTRICT"] = 2] = "RESTRICT";
    InanoSQLFKActions[InanoSQLFKActions["SET_NULL"] = 3] = "SET_NULL";
})(InanoSQLFKActions = exports.InanoSQLFKActions || (exports.InanoSQLFKActions = {}));
var IWhereType;
(function (IWhereType) {
    IWhereType[IWhereType["fast"] = 0] = "fast";
    IWhereType[IWhereType["medium"] = 1] = "medium";
    IWhereType[IWhereType["slow"] = 2] = "slow";
    IWhereType[IWhereType["fn"] = 3] = "fn";
    IWhereType[IWhereType["none"] = 4] = "none"; // no where, return all rows
})(IWhereType = exports.IWhereType || (exports.IWhereType = {}));
//# sourceMappingURL=interfaces.js.map