var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("../utilities");
var lie_ts_1 = require("lie-ts");
var _NanoSQLORMQuery = (function () {
    function _NanoSQLORMQuery(db, table, action, column, relationIDs) {
        this._db = db;
        this._tableName = table;
        this._action = action;
        this._column = column || "";
        this._relationIDs = relationIDs || [];
    }
    _NanoSQLORMQuery.prototype.where = function (args) {
        this._whereArgs = args;
        return this;
    };
    _NanoSQLORMQuery.prototype.rebuild = function (callBack) {
        var _this = this;
        var jobQue = [];
        this._db._models[this._tableName].forEach(function (m) {
            if (_this._db._tableNames.indexOf(m.key.replace("[]", "")) !== -1) {
                jobQue.push(m);
            }
        });
        new utilities_1.CHAIN(jobQue.map(function (j) {
            return function (nextJ) {
                _this._rebuildSingleRelation(_this._tableName, j.key, nextJ);
            };
        })).then(function () {
            callBack(0);
        });
    };
    _NanoSQLORMQuery.prototype._rebuildSingleRelation = function (table, column, complete) {
        var _this = this;
        var pk = this._tablePK(table);
        var relatedColumn = this._getRelatedColumn(table, column);
        var relatedTable = this._getRelatedTable(table, column);
        if (!relatedColumn || !relatedTable) {
            complete();
            return;
        }
        var childRelateTable = this._getRelatedTable(relatedTable.table, relatedColumn);
        var ptr = 0;
        var loopRows = function () {
            _this._db.table(table).query("select").range(1, ptr).exec().then(function (rows) {
                if (rows.length && childRelateTable) {
                    var pk_1 = rows[_this._tablePK(table)];
                    _this._db.table(childRelateTable.table).query("select").where([relatedColumn, childRelateTable.isArray ? "HAVE" : "=", pk_1]).exec().then(function (childRows) {
                        _this._db.table(table).query("upsert", __assign({}, rows[0], (_a = {}, _a[column] = childRows.length ? relatedTable.isArray ? childRows.map(function (r) { return r[_this._tablePK(childRelateTable.table)]; }) : childRows[0][_this._tablePK(childRelateTable.table)] : null, _a)), true).exec().then(function () {
                            ptr++;
                            loopRows();
                        });
                        var _a;
                    });
                }
                else {
                    complete();
                }
            });
        };
        loopRows();
    };
    _NanoSQLORMQuery.prototype._tablePK = function (table) {
        return this._db._models[table].reduce(function (prev, cur) {
            return cur.props && cur.props.indexOf("pk") !== -1 ? cur.key : prev;
        }, "");
    };
    _NanoSQLORMQuery.prototype._getRelatedColumn = function (table, column) {
        return this._db._models[table].reduce(function (prev, cur) {
            if (cur.key === column) {
                return cur.props && cur.props.reduce(function (p, c) {
                    return c.indexOf("ref=>") !== -1 ? c.replace("ref=>", "") : p;
                }, null);
            }
            return prev;
        }, null);
    };
    _NanoSQLORMQuery.prototype._getRelatedTable = function (table, column) {
        return this._db._models[table].reduce(function (prev, cur) {
            if (cur.key === column) {
                return {
                    table: cur.type.replace("[]", ""),
                    isArray: cur.type.indexOf("[]") !== -1
                };
            }
            return prev;
        }, null);
    };
    _NanoSQLORMQuery.prototype._setRelationships = function (type, rows, column, setIds, complete) {
        var _this = this;
        var pk = this._tablePK(this._tableName);
        var changedParentRecords = rows.map(function (r) { return r[pk]; });
        var relatedColumn = this._getRelatedColumn(this._tableName, column);
        var relatedTable = this._getRelatedTable(this._tableName, column);
        var cleanUp = function () {
            _this._updateRelatedRecords(type, changedParentRecords, relatedColumn, relatedTable, complete);
        };
        if (setIds.length) {
            new utilities_1.ALL(rows.map(function (row) {
                return function (doneRow) {
                    var setColumn = function () {
                        switch (type) {
                            case "rm":
                                return relatedTable && relatedTable.isArray ?
                                    (row[column] || []).filter(function (id) { return setIds.indexOf(id) === -1; }) :
                                    setIds.indexOf(row[column]) !== -1 ? null : row[column];
                            case "set":
                                return relatedTable && relatedTable.isArray ? setIds : setIds[0];
                            case "add":
                                return relatedTable && relatedTable.isArray ? (row[column] || []).concat(setIds) : setIds[0];
                        }
                    };
                    _this._db.table(_this._tableName).query("upsert", __assign({}, row, (_a = {}, _a[column] = setColumn(), _a)), true).exec().then(doneRow);
                    var _a;
                };
            })).then(cleanUp);
        }
        else {
            this._db.table(this._tableName).query("upsert", (_a = {},
                _a[column] = relatedTable && relatedTable.isArray ? [] : null,
                _a), true).where([pk, "IN", rows.map(function (r) { return changedParentRecords; })]).exec().then(cleanUp);
        }
        var _a;
    };
    _NanoSQLORMQuery.prototype._updateRelatedRecords = function (type, changedParentRecords, relatedColumn, relatedTable, complete) {
        var _this = this;
        var childRelateTable = null;
        var childRleatePK;
        if (relatedColumn && relatedTable) {
            childRelateTable = this._getRelatedTable(relatedTable.table, relatedColumn);
        }
        if (!relatedColumn || !relatedTable || !childRelateTable) {
            complete();
            return;
        }
        var compare = childRelateTable.isArray ? "HAVE" : "IN";
        this._db.table(childRelateTable.table).query("select").where([relatedColumn, compare, changedParentRecords]).exec().then(function (rows) {
            new utilities_1.ALL(rows.map(function (r) {
                return function (done) {
                    if (!childRelateTable)
                        return;
                    var newColumn = function () {
                        if (!childRelateTable)
                            return null;
                        switch (type) {
                            case "rm":
                                return childRelateTable.isArray ? r[relatedColumn].filter(function (i) { return changedParentRecords.indexOf(i) === -1; }) : null;
                            case "set":
                            case "add":
                                return childRelateTable.isArray ? r[relatedColumn].concat(changedParentRecords).filter(function (val, idx, self) {
                                    return self.indexOf(val) === idx;
                                }) : changedParentRecords[0];
                        }
                    };
                    _this._db.table(childRelateTable.table).query("upsert", __assign({}, r, (_a = {}, _a[relatedColumn] = newColumn(), _a))).exec().then(done);
                    var _a;
                };
            })).then(complete);
        });
    };
    _NanoSQLORMQuery.prototype.exec = function () {
        var _this = this;
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            if (t._action === "rebuild") {
                return t.rebuild(res);
            }
            var q = t._db.table(t._tableName).query("select");
            if (t._whereArgs) {
                q.where(t._whereArgs);
            }
            q.exec().then(function (rows) {
                if (!rows.length) {
                    res([]);
                    return;
                }
                switch (_this._action) {
                    case "set":
                        _this._setRelationships("rm", rows, _this._column, [], function () {
                            _this._setRelationships("set", rows, _this._column, _this._relationIDs, function () {
                                res();
                            });
                        });
                        break;
                    case "add":
                        _this._setRelationships("add", rows, _this._column, _this._relationIDs, function () {
                            res();
                        });
                        break;
                    case "delete":
                        _this._setRelationships("rm", rows, _this._column, _this._relationIDs, function () {
                            res();
                        });
                        break;
                    case "drop":
                        _this._setRelationships("rm", rows, _this._column, [], function () {
                            res();
                        });
                        break;
                }
            });
        });
    };
    return _NanoSQLORMQuery;
}());
exports._NanoSQLORMQuery = _NanoSQLORMQuery;
