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
var blankRow = { affectedRowPKS: [], affectedRows: [] };
var runQuery = function (self, complete, error) {
    if (self._db.plugins.length === 1 && !self._db.hasAnyEvents) {
        // fast query path, only used if there's a single plugin and no event listeners
        self._db.plugins[0].doExec(self._query, function (newQ) {
            self._query = newQ;
            if (self._db.hasPK[self._query.table]) {
                complete(self._query.result);
            }
            else {
                complete(self._query.result.map(function (r) { return (__assign({}, r, { _id_: undefined })); }));
            }
        }, error);
    }
    else {
        utilities_1.fastCHAIN(self._db.plugins, function (p, i, nextP, pluginErr) {
            if (p.doExec) {
                p.doExec(self._query, function (newQ) {
                    self._query = newQ || self._query;
                    nextP();
                }, pluginErr);
            }
            else {
                nextP();
            }
        }).then(function () {
            if (self._db.hasPK[self._query.table]) {
                complete(self._query.result);
            }
            else {
                complete(self._query.result.map(function (r) { return (__assign({}, r, { _id_: undefined })); }));
            }
            if (self._db.hasAnyEvents || self._db.pluginHasDidExec) {
                var eventTypes = (function () {
                    switch (self._query.action) {
                        case "select": return [self._query.action];
                        case "delete":
                        case "upsert":
                        case "drop": return [self._query.action, "change"];
                        default: return [];
                    }
                })();
                var hasLength = self._query.result && self._query.result.length;
                var event_1 = {
                    table: self._query.table,
                    query: self._query,
                    time: Date.now(),
                    result: self._query.result,
                    notes: [],
                    types: eventTypes,
                    actionOrView: self._AV,
                    transactionID: self._query.transaction ? self._query.queryID : undefined,
                    affectedRowPKS: hasLength ? (self._query.result[0] || blankRow).affectedRowPKS : [],
                    affectedRows: hasLength ? (self._query.result[0] || blankRow).affectedRows : [],
                };
                utilities_1.fastCHAIN(self._db.plugins, function (p, i, nextP) {
                    if (p.didExec) {
                        p.didExec(event_1, function (newE) {
                            event_1 = newE;
                            nextP();
                        });
                    }
                    else {
                        nextP();
                    }
                }).then(function () {
                    self._db.triggerEvent(event_1);
                });
            }
        }).catch(error);
    }
};
var debounceTimers = {};
// tslint:disable-next-line
var _NanoSQLQuery = /** @class */ (function () {
    function _NanoSQLQuery(db, table, queryAction, queryArgs, actionOrView) {
        this._db = db;
        this._AV = actionOrView || "";
        this._query = {
            table: table,
            comments: [],
            state: "pending",
            queryID: Date.now() + "." + this._db.fastRand().toString(16),
            action: queryAction,
            actionArgs: queryArgs,
            result: []
        };
    }
    /**
     * Used to select specific rows based on a set of conditions.
     * You can pass in a single array with a conditional statement or an array of arrays seperated by "and", "or" for compound selects.
     * A single where statement has the column name on the left, an operator in the middle, then a comparison on the right.
     *
     * Where Examples:
     *
     * ```ts
     * .where(['username','=','billy'])
     * .where(['balance','>',20])
     * .where(['catgory','IN',['jeans','shirts']])
     * .where([['name','=','scott'],'and',['balance','>',200]])
     * .where([['id','>',50],'or',['postIDs','IN',[12,20,30]],'and',['name','LIKE','Billy']])
     * ```
     *
     * @param {(Array<any|Array<any>>)} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.where = function (args) {
        this._query.where = args;
        return this;
    };
    /**
     * Query to get a specific range of rows very efficiently.
     *
     * @param {number} limit
     * @param {number} offset
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.range = function (limit, offset) {
        this._query.range = [limit, offset];
        return this;
    };
    /**
     * When using "from" features specific what primary keys to update.
     *
     * @param {any[]} primaryKeys
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.on = function (primaryKeys) {
        this._query.on = primaryKeys;
        return this;
    };
    /**
     * Debounce aggregate function calls.
     *
     * @param {number} ammt
     * @memberof _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.debounce = function (ms) {
        this._query.debounce = ms || 250;
        return this;
    };
    /**
     * Trigge ORM queries for all result rows.
     *
     * @param {((string|ORMArgs)[])} [ormArgs]
     * @returns {_NanoSQLQuery}
     *
     * @memberof _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.orm = function (ormArgs) {
        this._query.orm = ormArgs;
        return this;
    };
    /**
     * Order the results by a given column or columns.
     *
     * Examples:
     *
     * ```ts
     * .orderBy({username:"asc"}) // order by username column, ascending
     * .orderBy({balance:"desc",lastName:"asc"}) // order by balance descending, then lastName ascending.
     * ```
     *
     * @param {Object} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.orderBy = function (args) {
        this._query.orderBy = args;
        return this;
    };
    /**
     * Group By command, typically used with an aggregate function.
     *
     * Example:
     *
     * ```ts
     * nSQL("users").query("select",["favoriteColor","count(*)"]).groupBy({"favoriteColor":"asc"}).exec();
     * ```
     *
     * This will provide a list of all favorite colors and how many each of them are in the db.
     *
     * @param {({[key: string]:"asc"|"desc"})} columns
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.groupBy = function (columns) {
        this._query.groupBy = columns;
        return this;
    };
    /**
     * Having statement, used to filter Group BY statements. Syntax is identical to where statements.
     *
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.having = function (args) {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Having condition requires an array!";
        }
        this._query.having = args;
        return this;
    };
    /**
     * Join command.
     *
     * Example:
     *
     * ```ts
     *  nSQL("orders")
     *  .query("select", ["orders.id","orders.title","users.name"])
     *  .where(["orders.status","=","complete"])
     *  .orderBy({"orders.date":"asc"})
     *  .join({
     *      type:"inner",
     *      table:"users",
     *      where:["orders.customerID","=","user.id"]
     *  }).exec();
     *```
     * A few notes on the join command:
     * 1. You muse use dot notation with the table names in all "where", "select", "orderby", and "groupby" arguments.
     * 2. Possible join types are `inner`, `left`, `right`, and `outer`.
     * 3. The "table" argument lets you determine the data on the right side of the join.
     * 4. The "where" argument lets you set what conditions the tables are joined on.
     *
     *
     *
     * @param {JoinArgs} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.join = function (args) {
        var _this = this;
        if (Array.isArray(this._query.table)) {
            throw new Error("Can't JOIN with instance table!");
        }
        var err = "Join commands requires table and type arguments!";
        if (Array.isArray(args)) {
            args.forEach(function (arg) {
                if (!arg.table || !arg.type) {
                    _this._error = err;
                }
            });
        }
        else {
            if (!args.table || !args.type) {
                this._error = err;
            }
        }
        this._query.join = args;
        return this;
    };
    /**
     * Limits the result to a specific amount.  Example:
     *
     * ```ts
     * .limit(20) // Limit to the first 20 results
     * ```
     *
     * @param {number} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.limit = function (args) {
        this._query.limit = args;
        return this;
    };
    /**
     * Perform a trie search on a trie column.
     *
     * @param {string} stringToSearch
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.trieSearch = function (column, stringToSearch) {
        this._query.trie = { column: column, search: stringToSearch };
        return this;
    };
    /**
     * Pass comments along with the query.
     * These comments will be emitted along with the other query datay by the event system, useful for tracking queries.
     *
     * @param {string} comment
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.comment = function (comment) {
        this._query.comments.push(comment);
        return this;
    };
    /**
     * Perform custom actions supported by plugins.
     *
     * @param {...any[]} args
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.extend = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this._query.extend = args;
        return this;
    };
    /**
     * Offsets the results by a specific amount from the beginning.  Example:
     *
     * ```ts
     * .offset(10) // Skip the first 10 results.
     * ```
     *
     * @param {number} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.offset = function (args) {
        this._query.offset = args;
        return this;
    };
    /**
     * Export the built query object.
     *
     * @returns {IdbQueryExec}
     * @memberof _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.emit = function () {
        return this._query;
    };
    /**
     * Export the current query to a CSV file, use in place of "exec()";
     *
     * Example:
     * nSQL("users").query("select").toCSV(true).then(function(csv, db) {
     *   console.log(csv);
     *   // Returns something like:
     *   id,name,pass,postIDs
     *   1,"scott","1234","[1,2,3,4]"
     *   2,"jeb","5678","[5,6,7,8]"
     * });
     *
     * @param {boolean} [headers]
     * @returns {Promise<string>}
     *
     * @memberOf NanoSQLInstance
     */
    _NanoSQLQuery.prototype.toCSV = function (headers) {
        var _this = this;
        var t = this;
        return new utilities_1.Promise(function (res, rej) {
            t.exec().then(function (json) {
                var useHeaders = typeof _this._query.table === "string" ? _this._db.dataModels[_this._query.table].map(function (k) { return k.key; }) : undefined;
                res(t._db.JSONtoCSV(json, headers || false, useHeaders));
            });
        });
    };
    /**
     * Pass in a query object to manually execute a query against the system.
     *
     * @param {IdbQuery} query
     * @param {(err: any, result: any[]) => void} [complete]
     * @returns {Promise<any>}
     * @memberof _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.manualExec = function (query) {
        this._query = __assign({}, this._query, query);
        return this.exec();
    };
    /**
     * Handle denormalization requests.
     *
     * @param {string} action
     * @returns
     * @memberof _NanoSQLQuery
     */
    _NanoSQLQuery.prototype.denormalizationQuery = function (action) {
        var _this = this;
        return new utilities_1.Promise(function (res, rej) {
            switch (action) {
                case "tocolumn":
                    var fnsToRun_1 = {};
                    if (_this._query.actionArgs && _this._query.actionArgs.length) {
                        Object.keys(_this._db.toColRules[_this._query.table]).filter(function (c) { return _this._query.actionArgs.indexOf(c) !== -1; }).forEach(function (col) {
                            fnsToRun_1[col] = _this._db.toColRules[_this._query.table][col];
                        });
                    }
                    else {
                        fnsToRun_1 = _this._db.toColRules[_this._query.table];
                    }
                    _this._query.action = "select";
                    _this._query.actionArgs = undefined;
                    var columns_1 = Object.keys(fnsToRun_1);
                    runQuery(_this, function (rows) {
                        utilities_1.fastCHAIN(rows, function (row, i, done) {
                            if (Object.isFrozen(row)) {
                                row = utilities_1._assign(row);
                            }
                            utilities_1.fastALL(columns_1, function (col, i, next) {
                                var fn = _this._db.toColFns[_this._query.table][fnsToRun_1[col][0]];
                                if (!fn) {
                                    next();
                                    return;
                                }
                                fn.apply(null, [row[col], function (newValue) {
                                        row[col] = newValue;
                                        next();
                                    }].concat(fnsToRun_1[col].filter(function (v, i) { return i > 0; }).map(function (c) { return row[c]; })));
                            }).then(function () {
                                _this._db.query("upsert", row).manualExec({ table: _this._query.table }).then(done).catch(done);
                            });
                        }).then(function () {
                            res({ msg: rows.length + " rows modified" });
                        });
                    }, rej);
                    break;
                case "torow":
                    var fnKey = (_this._query.actionArgs || "").replace("()", "");
                    if (_this._db.toRowFns[_this._query.table] && _this._db.toRowFns[_this._query.table][fnKey]) {
                        var fn_1 = _this._db.toRowFns[_this._query.table][fnKey];
                        var PK_1 = _this._db.tablePKs[_this._query.table];
                        if (_this._query.on && _this._query.on.length) {
                            utilities_1.fastALL(_this._query.on, function (pk, i, done) {
                                fn_1(pk, {}, function (newRow) {
                                    newRow[PK_1] = pk;
                                    _this._db.query("upsert", newRow).manualExec({ table: _this._query.table }).then(done).catch(done);
                                });
                            }).then(function () {
                                res([{ msg: (_this._query.on || []).length + " rows modified or added." }]);
                            });
                            return;
                        }
                        _this._query.action = "select";
                        _this._query.actionArgs = undefined;
                        runQuery(_this, function (rows) {
                            utilities_1.fastALL(rows, function (row, i, done) {
                                if (Object.isFrozen(row)) {
                                    row = utilities_1._assign(row);
                                }
                                fn_1(row[PK_1], row, function (newRow) {
                                    newRow[PK_1] = row[PK_1];
                                    _this._db.query("upsert", newRow).manualExec({ table: _this._query.table }).then(done).catch(done);
                                });
                            }).then(function () {
                                res({ msg: rows.length + " rows modified" });
                            });
                        }, rej);
                    }
                    else {
                        rej("No function " + _this._query.actionArgs + " found to perform updates!");
                        return;
                    }
                    break;
            }
        });
    };
    /**
     * Executes the current pending query to the db engine, returns a promise with the rows as objects in an array.
     *
     * Example:
     * nSQL("users").query("select").exec().then(function(rows) {
     *     console.log(rows) // <= [{id:1,username:"Scott",password:"1234"},{id:2,username:"Jeb",password:"1234"}]
     *     return nSQL().query("upsert",{password:"something more secure"}).where(["id","=",1]).exec();
     * }).then(function(rows) {
     *  ...
     * })...
     *
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    _NanoSQLQuery.prototype.exec = function () {
        var _this = this;
        // handle instance queries
        if (Array.isArray(this._query.table)) {
            return new utilities_1.Promise(function (res, rej) {
                if (_this._db.iB.doExec) {
                    _this._db.iB.doExec(_this._query, function (q) {
                        res(q.result);
                    }, rej);
                }
            });
        }
        if (this._query.table === "*")
            return;
        var t = this;
        var a = (this._query.action || "").toLowerCase().trim();
        if (["tocolumn", "torow"].indexOf(a) > -1) {
            if (this._query.debounce) {
                var denormalizationKey_1 = utilities_1.hash(JSON.stringify([this._query.table, a, this._query.actionArgs, this._query.on, this._query.where].filter(function (r) { return r; })));
                return new utilities_1.Promise(function (res, rej) {
                    if (debounceTimers[denormalizationKey_1]) {
                        clearTimeout(debounceTimers[denormalizationKey_1]);
                    }
                    debounceTimers[denormalizationKey_1] = setTimeout(function () {
                        _this.denormalizationQuery(a).then(res);
                    }, _this._query.debounce);
                });
            }
            return this.denormalizationQuery(a);
        }
        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) > -1) {
            var newArgs = this._query.actionArgs || (a === "select" ? [] : {});
            var setArgs_1 = [];
            if (a === "upsert") {
                if (Array.isArray(newArgs)) {
                    setArgs_1 = newArgs;
                }
                else {
                    setArgs_1 = [newArgs];
                }
                setArgs_1.forEach(function (nArgs, i) {
                    // Do Row Filter
                    if (_this._db.rowFilters[_this._query.table]) {
                        setArgs_1[i] = _this._db.rowFilters[_this._query.table](setArgs_1[i]);
                    }
                    // Cast row types and remove columns that don't exist in the data model
                    var inputArgs = {};
                    var models = _this._db.dataModels[_this._query.table];
                    var k = 0;
                    while (k < models.length) {
                        if (setArgs_1[i][models[k].key] !== undefined) {
                            inputArgs[models[k].key] = utilities_1.cast(models[k].type, setArgs_1[i][models[k].key]);
                        }
                        k++;
                    }
                    // insert wildcard columns
                    if (_this._db.skipPurge[_this._query.table]) {
                        var modelColumns_1 = models.map(function (m) { return m.key; });
                        var columns = Object.keys(setArgs_1[i]).filter(function (c) { return modelColumns_1.indexOf(c) === -1; }); // wildcard columns
                        columns.forEach(function (col) {
                            inputArgs[col] = setArgs_1[i][col];
                        });
                    }
                    setArgs_1[i] = inputArgs;
                });
            }
            else {
                setArgs_1 = this._query.actionArgs;
            }
            this._query.action = a;
            this._query.actionArgs = this._query.actionArgs ? setArgs_1 : undefined;
        }
        else {
            throw Error("nSQL: No valid database action!");
        }
        return new utilities_1.Promise(function (res, rej) {
            var runExec = function () {
                if (!t._db.plugins.length) {
                    t._error = "nSQL: No plugins, nothing to do!";
                }
                if (t._error) {
                    rej(t._error);
                    return;
                }
                if (_this._db.queryMod) {
                    _this._db.queryMod(_this._query, function (newQ) {
                        _this._query = newQ;
                        runQuery(_this, res, rej);
                    });
                }
                else {
                    runQuery(_this, res, rej);
                }
            };
            if (_this._db.isConnected || _this._query.table.indexOf("_") === 0) {
                runExec();
            }
            else {
                _this._db.onConnected(runExec);
            }
        });
    };
    return _NanoSQLQuery;
}());
exports._NanoSQLQuery = _NanoSQLQuery;
//# sourceMappingURL=std-query.js.map