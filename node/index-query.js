Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./index");
var lie_ts_1 = require("lie-ts");
var _NanoSQLQuery = (function () {
    function _NanoSQLQuery(table, db, actionOrView) {
        this._db = db;
        this._modifiers = [];
        this._table = table;
        this._AV = actionOrView || "";
    }
    _NanoSQLQuery.prototype.tID = function (transactionID) {
        return this._transactionID = transactionID || 0, this;
    };
    _NanoSQLQuery.prototype.where = function (args) {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Where condition requires an array!";
        }
        return this._addCmd("where", args);
    };
    _NanoSQLQuery.prototype.range = function (limit, offset) {
        return this._addCmd("range", [limit, offset]);
    };
    _NanoSQLQuery.prototype.orm = function (ormArgs) {
        return this._addCmd("orm", ormArgs);
    };
    _NanoSQLQuery.prototype.orderBy = function (args) {
        return this._addCmd("orderby", args);
    };
    _NanoSQLQuery.prototype.groupBy = function (columns) {
        return this._addCmd("groupby", columns);
    };
    _NanoSQLQuery.prototype.having = function (args) {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Having condition requires an array!";
        }
        return this._addCmd("having", args);
    };
    _NanoSQLQuery.prototype.join = function (args) {
        if (!args.table || !args.type) {
            this._error = "Join command requires table and type arguments!";
        }
        return this._addCmd("join", args);
    };
    _NanoSQLQuery.prototype.limit = function (args) {
        return this._addCmd("limit", args);
    };
    _NanoSQLQuery.prototype.trieSearch = function (column, stringToSearch) {
        return this._addCmd("trie", [column, stringToSearch]);
    };
    _NanoSQLQuery.prototype.offset = function (args) {
        return this._addCmd("offset", args);
    };
    _NanoSQLQuery.prototype._addCmd = function (type, args) {
        return this._modifiers.push({ type: type, args: args }), this;
    };
    _NanoSQLQuery.prototype.toCSV = function (headers) {
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            t.exec().then(function (json) {
                json = index_1._assign(json);
                var header = t._action.args.length ? t._action.args.map(function (m) {
                    return t._db._models[t._table].filter(function (f) { return f["key"] === m; })[0];
                }) : t._db._models[t._table];
                if (headers) {
                    json.unshift(header.map(function (h) {
                        return h["key"];
                    }));
                }
                res(json.map(function (row, i) {
                    if (headers && i === 0)
                        return row;
                    return header.filter(function (column) {
                        return row[column["key"]] ? true : false;
                    }).map(function (column) {
                        var columnType = column["type"];
                        if (columnType.indexOf("[]") !== -1)
                            columnType = "any[]";
                        switch (columnType) {
                            case "map":
                            case "any[]":
                            case "array": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
                            case "string":
                            case "safestr": return '"' + row[column["key"]].replace(/"/g, '\"') + '"';
                            default: return row[column["key"]];
                        }
                    }).join(",");
                }).join("\n"), t);
            });
        });
    };
    _NanoSQLQuery.prototype._manualExec = function (table, modifiers) {
        var t = this;
        t._modifiers = modifiers;
        t._table = table;
        return t.exec();
    };
    _NanoSQLQuery.prototype.exec = function () {
        var t = this;
        var _t = t._table;
        if (t._db._hasEvents[_t]) {
            t._db._triggerEvents = (function () {
                switch (t._action.type) {
                    case "select": return [t._action.type];
                    case "delete":
                    case "upsert":
                    case "drop": return [t._action.type, "change"];
                    default: return [];
                }
            })();
        }
        return new lie_ts_1.Promise(function (res, rej) {
            if (t._error) {
                rej(t._error);
                throw Error;
            }
            if (!t._db.backend) {
                rej();
                throw Error;
            }
            var _tEvent = function (data, callBack, type, changedRows, changedRowPKS, isError) {
                if (t._db._hasEvents[_t]) {
                    t._db.triggerEvent({
                        name: "error",
                        actionOrView: t._AV,
                        table: _t,
                        query: [t._action].concat(t._modifiers),
                        time: new Date().getTime(),
                        result: data,
                        changeType: type,
                        changedRows: changedRows,
                        changedRowPKS: changedRowPKS
                    }, t._db._triggerEvents);
                }
                callBack(data, t._db);
            };
            var execArgs = {
                table: _t,
                transactionID: t._transactionID,
                query: [t._action].concat(t._modifiers),
                viewOrAction: t._AV,
                onSuccess: function (rows, type, affectedRows, affectedPKS) {
                    if (t._transactionID) {
                        res(rows, t._db);
                    }
                    else {
                        _tEvent(rows, res, type, affectedRows, affectedPKS, false);
                    }
                },
                onFail: function (err) {
                    if (t._transactionID) {
                        res(err, t._db);
                    }
                    else {
                        t._db._triggerEvents = ["error"];
                        if (rej)
                            _tEvent(err, rej, "error", [], [], true);
                    }
                }
            };
            if (t._db._queryMod) {
                t._db._queryMod(execArgs, function (newArgs) {
                    t._db.backend._exec(newArgs);
                });
            }
            else {
                t._db.backend._exec(execArgs);
            }
        });
    };
    return _NanoSQLQuery;
}());
exports._NanoSQLQuery = _NanoSQLQuery;
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
        var t = this;
        var relations = t._db._models[t._tableName].filter(function (m) {
            return t._db._tableNames.indexOf(m.type.replace("[]", "")) !== -1;
        }).map(function (m) {
            var tableName = m.type.replace("[]", "");
            return {
                key: m.key,
                tablePK: t._db._models[tableName].reduce(function (prev, cur) {
                    if (cur.props && cur.props.indexOf("pk") !== -1)
                        return cur.key;
                    return prev;
                }, ""),
                table: tableName,
                type: m.type.indexOf("[]") === -1 ? "single" : "array"
            };
        });
        var tablePK = t._db._models[t._tableName].reduce(function (prev, cur) {
            if (cur.props && cur.props.indexOf("pk") !== -1)
                return cur.key;
            return prev;
        }, "");
        var ptr = 0;
        var nextRow = function () {
            t._db.table(t._tableName).query("select").range(1, ptr).exec().then(function (rows) {
                if (rows.length) {
                    lie_ts_1.Promise.all(relations.map(function (r) {
                        return new lie_ts_1.Promise(function (res, rej) {
                            var ids;
                            if (rows[0][r.key] === undefined) {
                                ids = r.type === "single" ? "" : [];
                            }
                            else {
                                ids = index_1._assign(rows[0][r.key]);
                            }
                            if (r.type === "single")
                                ids = [ids];
                            ids = ids.filter(function (v, i, s) {
                                return s.indexOf(v) === i;
                            });
                            t._db.table(r.table).query("select").where([r.tablePK, "IN", ids]).exec().then(function (childRows) {
                                var activeIDs = childRows.length ? childRows.map(function (row) { return row[r.tablePK]; }) : [];
                                return t._db.table(t._tableName).updateORM("set", r.key, activeIDs).where([tablePK, "=", rows[0][tablePK]]).exec();
                            }).then(function () {
                                res();
                            });
                        });
                    })).then(function () {
                        ptr++;
                        nextRow();
                    });
                }
                else {
                    callBack(ptr);
                }
            });
        };
        nextRow();
    };
    _NanoSQLORMQuery.prototype.tID = function (transactionID) {
        return this._transactionID = transactionID || 0, this;
    };
    _NanoSQLORMQuery.prototype.exec = function () {
        var t = this;
        return new lie_ts_1.Promise(function (res, rej) {
            if (t._action === "rebuild") {
                return t.rebuild(res);
            }
            var pk = t._db._models[t._tableName].filter(function (m) {
                return m.props && m.props.indexOf("pk") !== -1;
            })[0].key;
            var rowModel = t._db._models[t._tableName].filter(function (m) { return m.key === t._column; })[0];
            var relationTable = rowModel.type.replace("[]", "");
            var relationPK = t._db._models[relationTable].filter(function (m) {
                return m.props && m.props.indexOf("pk") !== -1;
            })[0].key;
            var isArrayRelation = rowModel.type.indexOf("[]") !== -1;
            var mapTo = rowModel.props && rowModel.props.filter(function (p) { return p.indexOf("orm::") !== -1; })[0];
            var mapToIsArray = "single";
            if (mapTo) {
                mapTo = mapTo.replace("orm::", "");
                mapToIsArray = t._db._models[relationTable].filter(function (m) { return m.key === mapTo; })[0].type.indexOf("[]") === -1 ? "single" : "array";
            }
            if (!pk || !pk.length || !relationPK || !relationPK.length) {
                rej("Relation models require a primary key!");
            }
            var query = t._db.table(t._tableName).query("select");
            if (t._whereArgs)
                query.where(t._whereArgs);
            query.exec().then(function (rows) {
                var ptr = 0;
                var nextRow = function () {
                    if (ptr < rows.length) {
                        var newRow = index_1._assign(rows[ptr]);
                        var oldRelations_1 = [];
                        if (newRow[t._column] !== undefined)
                            oldRelations_1 = newRow[t._column];
                        if (!Array.isArray(oldRelations_1))
                            oldRelations_1 = [oldRelations_1];
                        switch (t._action) {
                            case "set":
                            case "add":
                                if (isArrayRelation) {
                                    if (newRow[t._column] === undefined)
                                        newRow[t._column] = [];
                                    if (!Array.isArray(newRow[t._column]))
                                        newRow[t._column] = [];
                                    if (t._action === "set") {
                                        newRow[t._column] = t._relationIDs;
                                    }
                                    else {
                                        newRow[t._column] = newRow[t._column].concat(t._relationIDs);
                                        newRow[t._column] = newRow[t._column].filter(function (v, i, s) {
                                            return s.indexOf(v) === i;
                                        });
                                    }
                                }
                                else {
                                    newRow[t._column] = t._relationIDs[0];
                                }
                                break;
                            case "delete":
                                if (isArrayRelation) {
                                    var loc = newRow[t._column].indexOf(rows[ptr][pk]);
                                    if (loc !== -1)
                                        newRow[t._column] = newRow[t._column].splice(loc, 1);
                                }
                                else {
                                    newRow[t._column] = "";
                                }
                                break;
                            case "drop":
                                newRow[t._column] = isArrayRelation ? [] : undefined;
                                break;
                        }
                        var updateRow_1 = function (newRow, callBack) {
                            t._db.table(relationTable).query("upsert", newRow, true).exec().then(callBack);
                        };
                        var removeOldRelations_1 = function () {
                            return lie_ts_1.Promise.all(oldRelations_1.map(function (id) {
                                return new lie_ts_1.Promise(function (resolve, reject) {
                                    t._db.table(relationTable).query("select").where([relationPK, "=", id]).exec().then(function (relateRows) {
                                        if (!relateRows.length) {
                                            resolve();
                                            return;
                                        }
                                        var modifyRow = index_1._assign(relateRows[0]);
                                        if (Array.isArray(modifyRow[mapTo])) {
                                            var idx = modifyRow[mapTo].indexOf(rows[ptr][pk]);
                                            if (idx !== -1) {
                                                modifyRow[mapTo] = modifyRow[mapTo].splice(idx, 1);
                                            }
                                        }
                                        else {
                                            modifyRow[mapTo] = "";
                                        }
                                        updateRow_1(modifyRow, resolve);
                                    });
                                });
                            }));
                        };
                        t._db.table(t._tableName).query("upsert", newRow, true).exec().then(function () {
                            if (mapTo) {
                                switch (t._action) {
                                    case "set":
                                    case "add":
                                        var ptr2_1 = 0;
                                        var appendRelations_1 = function () {
                                            if (ptr2_1 < t._relationIDs.length) {
                                                t._db.table(relationTable).query("select").where([relationPK, "=", t._relationIDs[ptr2_1]]).exec().then(function (relateRows) {
                                                    if (!relateRows.length) {
                                                        ptr2_1++;
                                                        appendRelations_1();
                                                        return;
                                                    }
                                                    var modifyRow = index_1._assign(relateRows[0]);
                                                    if (modifyRow[mapTo] === undefined)
                                                        modifyRow[mapTo] = mapToIsArray === "array" ? [] : "";
                                                    if (mapToIsArray === "array") {
                                                        if (!Array.isArray(modifyRow[mapTo]))
                                                            modifyRow[mapTo] = [];
                                                        modifyRow[mapTo].push(rows[ptr][pk]);
                                                        modifyRow[mapTo] = modifyRow[mapTo].filter(function (v, i, s) {
                                                            return s.indexOf(v) === i;
                                                        });
                                                        updateRow_1(modifyRow, function () {
                                                            ptr2_1++;
                                                            appendRelations_1();
                                                        });
                                                    }
                                                    else {
                                                        if (modifyRow[mapTo] && modifyRow[mapTo].length) {
                                                            t._db.table(t._tableName).query("select").where([pk, "=", modifyRow[mapTo]]).exec().then(function (relateRows2) {
                                                                var modifyRow2 = index_1._assign(relateRows2[0]);
                                                                if (Array.isArray(modifyRow2[t._column])) {
                                                                    var idx = modifyRow2[t._column].indexOf(modifyRow[mapTo]);
                                                                    if (idx === -1) {
                                                                        modifyRow2[t._column] = modifyRow2[t._column].splice(modifyRow2[t._column].indexOf(modifyRow[mapTo]), 1);
                                                                    }
                                                                }
                                                                else {
                                                                    modifyRow2[t._column] = "";
                                                                }
                                                                t._db.table(t._tableName).query("upsert", modifyRow2, true).where([pk, "=", modifyRow[mapTo]]).exec().then(function () {
                                                                    modifyRow[mapTo] = rows[ptr][pk];
                                                                    updateRow_1(modifyRow, function () {
                                                                        ptr2_1++;
                                                                        appendRelations_1();
                                                                    });
                                                                });
                                                            });
                                                        }
                                                        else {
                                                            modifyRow[mapTo] = rows[ptr][pk];
                                                            updateRow_1(modifyRow, function () {
                                                                ptr2_1++;
                                                                appendRelations_1();
                                                            });
                                                        }
                                                    }
                                                });
                                            }
                                            else {
                                                ptr++;
                                                nextRow();
                                            }
                                        };
                                        appendRelations_1();
                                        break;
                                    case "delete":
                                    case "drop":
                                        removeOldRelations_1().then(function () {
                                            ptr++;
                                            nextRow();
                                        });
                                        break;
                                }
                            }
                            else {
                                ptr++;
                                nextRow();
                            }
                        });
                    }
                    else {
                        res(ptr);
                    }
                };
                nextRow();
            });
        });
    };
    return _NanoSQLORMQuery;
}());
exports._NanoSQLORMQuery = _NanoSQLORMQuery;
