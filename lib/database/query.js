var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("../index");
var utilities_1 = require("../utilities");
var fuzzy = require("fuzzysearch");
var levenshtein = require("levenshtein-edit-distance");
var queryObj = {
    select: function (self, next, error) {
        self._select(next);
    },
    upsert: function (self, next, error) {
        if (self._store._doCache) {
            self._upsert(next, error);
        }
        else {
            self._store.queue.add(self._query.table, function (done) {
                self._upsert(function () {
                    done();
                    next(self._query);
                }, error);
            });
        }
    },
    delete: function (self, next, error) {
        if (self._store._doCache) {
            self._delete(next);
        }
        else {
            self._store.queue.add(self._query.table, function (done) {
                self._delete(function () {
                    done();
                    next(self._query);
                });
            });
        }
    },
    drop: function (self, next, error) {
        if (self._store._doCache) {
            self._drop(next);
        }
        else {
            self._store.queue.add(self._query.table, function (done) {
                self._drop(function () {
                    done();
                    next(self._query);
                });
            });
        }
    },
    "show tables": function (self, next, error) {
        self._query.result = Object.keys(self._store.tableInfo);
        next(self._query);
    },
    describe: function (self, next, error) {
        if (typeof self._query.table !== "string") {
            next(self._query);
            return;
        }
        self._query.result = self._store.models[self._query.table] ? utilities_1._assign(self._store.models[self._query.table]) : [{ error: "Table does not exist" }];
        next(self._query);
    },
};
/**
 * A new Storage Query class is inilitized for every query, performing the actions
 * against the storage class itself to get the desired outcome.
 *
 * @export
 * @class _NanoSQLStorageQuery
 */
// tslint:disable-next-line
var _NanoSQLStorageQuery = /** @class */ (function () {
    function _NanoSQLStorageQuery(_store) {
        this._store = _store;
    }
    /**
     * Execute the query against this class.
     *
     * @param {IdbQuery} query
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype.doQuery = function (query, next, error) {
        this._query = query;
        this._isInstanceTable = Array.isArray(query.table);
        queryObj[query.action](this, next, error);
    };
    /**
     * Retreive the selected rows for this query, works for instance tables and standard ones.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._getRows = function (complete) {
        if (this._isInstanceTable) {
            new InstanceSelection(this._query, this._store._nsql).getRows(complete);
        }
        else {
            new _RowSelection(this, this._query, this._store, function (rows) {
                complete(rows.filter(function (r) { return r; }));
            });
        }
    };
    /**
     * Initilze a SELECT query.
     *
     * @internal
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._select = function (next) {
        var _this = this;
        this._hash = JSON.stringify(__assign({}, this._query, { queryID: null }));
        var canCache = !this._query.join && !this._query.orm && this._store._doCache && !Array.isArray(this._query.table);
        // Query cache for the win!
        /*if (canCache && this._store._cache[this._query.table as any][this._hash]) {
            this._query.result = this._store._cache[this._query.table as any][this._hash];
            next(this._query);
            return;
        }*/
        this._getRows(function (rows) {
            // No query arguments, we can skip the whole mutation selection class
            if (!["having", "orderBy", "offset", "limit", "actionArgs", "groupBy", "orm", "join"].filter(function (k) { return _this._query[k]; }).length) {
                if (canCache)
                    _this._store._cache[_this._query.table][_this._hash] = rows;
                _this._query.result = rows;
                next(_this._query);
            }
            else {
                new _MutateSelection(_this._query, _this._store)._executeQueryArguments(rows, function (resultRows) {
                    if (canCache)
                        _this._store._cache[_this._query.table][_this._hash] = rows;
                    _this._query.result = resultRows;
                    next(_this._query);
                });
            }
        });
    };
    _NanoSQLStorageQuery.prototype._updateORMRows = function (relation, fromPKs, add, primaryKey, complete) {
        var _this = this;
        var fromPk = this._store.tableInfo[relation._fromTable]._pk;
        this._store._read(relation._fromTable, fromPKs, function (rows) {
            utilities_1.fastALL(rows, function (row, i, rowDone) {
                var newRow = Object.isFrozen(row) ? utilities_1._assign(row) : row;
                if (relation._fromType === "array") {
                    newRow[relation._fromColumn] = newRow[relation._fromColumn] || [];
                    var idxOf = newRow[relation._fromColumn].indexOf(primaryKey);
                    if (add) { // add
                        if (idxOf === -1) {
                            newRow[relation._fromColumn].push(primaryKey);
                        }
                        else {
                            rowDone();
                        }
                    }
                    else { // remove
                        if (idxOf !== -1) {
                            newRow[relation._fromColumn].splice(idxOf, 1);
                        }
                        else {
                            rowDone();
                        }
                    }
                    newRow[relation._fromColumn].sort();
                }
                else {
                    if (add) { // add
                        newRow[relation._fromColumn] = primaryKey;
                    }
                    else { // remove
                        newRow[relation._fromColumn] = null;
                    }
                }
                _this._store._nsql.query("upsert", newRow).comment("_orm_skip").manualExec({ table: relation._fromTable }).then(rowDone);
            }).then(complete);
        });
    };
    _NanoSQLStorageQuery.prototype._syncORM = function (type, oldRows, newRows, complete) {
        var _this = this;
        if (!this._store._hasORM) {
            complete();
            return;
        }
        var useRelations = this._store._relToTable[this._query.table];
        if (this._query.comments.indexOf("_orm_skip") !== -1) {
            complete();
            return;
        }
        if (!useRelations || !useRelations.length) {
            complete();
            return;
        }
        // go over every relation and every changed row to make the needed updates.
        var cnt = Math.max(oldRows.length, newRows.length);
        var arra = [];
        while (cnt--)
            arra.push(" ");
        utilities_1.fastCHAIN(arra, function (v, idx, rowDone) {
            utilities_1.fastALL(useRelations, function (relation, k, relationDone) {
                var equals = function (val1, val2) {
                    if (Array.isArray(val1) && Array.isArray(val2)) {
                        if (val1.length !== val2.length) {
                            return false;
                        }
                        return val1.filter(function (v, i) { return v !== val2[i]; }).length > 0;
                    }
                    else {
                        return val1 === val2;
                    }
                };
                switch (type) {
                    case "del":
                        var delPrimarykey = oldRows[idx][_this._store.tableInfo[_this._query.table]._pk];
                        var updateIDs = relation._thisType === "array" ? (oldRows[idx][relation._thisColumn] || []) : ([oldRows[idx][relation._thisColumn]].filter(function (v) { return v; }));
                        _this._updateORMRows(relation, updateIDs, false, delPrimarykey, relationDone);
                        break;
                    case "add":
                        var primaryKey_1 = newRows[idx][_this._store.tableInfo[_this._query.table]._pk];
                        // possibly update existing relation
                        // if adding oldRows[idx] is possibly undefined (if theres no previouse row record)
                        if (oldRows[idx]) {
                            // previouse record exists
                            if (equals(oldRows[idx][relation._thisColumn], newRows[idx][relation._thisColumn])) {
                                // no update needed
                                relationDone();
                            }
                            else {
                                if (relation._thisType === "array") {
                                    var addIds = (newRows[idx][relation._thisColumn] || []).filter(function (v) { return (oldRows[idx][relation._thisColumn] || []).indexOf(v) === -1; });
                                    var removeIds = (oldRows[idx][relation._thisColumn] || []).filter(function (v) { return (newRows[idx][relation._thisColumn] || []).indexOf(v) === -1; });
                                    utilities_1.fastALL([addIds, removeIds], function (list, i, done) {
                                        _this._updateORMRows(relation, list, i === 0, primaryKey_1, done);
                                    }).then(relationDone);
                                }
                                else {
                                    var addRelation = function () {
                                        // add new relation
                                        if (newRows[idx][relation._thisColumn] !== null && newRows[idx][relation._thisColumn] !== undefined) {
                                            _this._updateORMRows(relation, [newRows[idx][relation._thisColumn]], true, primaryKey_1, relationDone);
                                        }
                                        else {
                                            // no new relation
                                            relationDone();
                                        }
                                    };
                                    // remove old connection
                                    if (oldRows[idx][relation._thisColumn] !== null && oldRows[idx][relation._thisColumn] !== undefined) {
                                        _this._updateORMRows(relation, [oldRows[idx][relation._thisColumn]], false, primaryKey_1, addRelation);
                                    }
                                    else {
                                        // no old connection, just add the new one
                                        addRelation();
                                    }
                                }
                            }
                        }
                        else { // new relation
                            var valuesToAdd = relation._thisType === "array" ? (newRows[idx][relation._thisColumn] || []) : ([newRows[idx][relation._thisColumn]].filter(function (v) { return v; }));
                            if (valuesToAdd && valuesToAdd.length) {
                                _this._updateORMRows(relation, valuesToAdd, true, primaryKey_1, relationDone);
                            }
                            else {
                                relationDone();
                            }
                        }
                        break;
                }
            }).then(rowDone);
        }).then(complete);
    };
    _NanoSQLStorageQuery.prototype._tokenizer = function (column, value) {
        var args = this._store.tableInfo[this._query.table]._searchColumns[column];
        if (!args) {
            return [];
        }
        var userTokenizer = this._store._nsql.getConfig().tokenizer;
        if (userTokenizer) {
            var tokens = userTokenizer(this._query.table, column, args, value);
            if (tokens !== false)
                return tokens;
        }
        return utilities_1.tokenizer(this._query.table, column, args, value);
    };
    _NanoSQLStorageQuery.prototype._clearFromSearchIndex = function (pk, rowData, complete) {
        var _this = this;
        var table = this._query.table;
        var columns = Object.keys(this._store.tableInfo[table]._searchColumns);
        // No search indexes on this table OR
        // update doesn't include indexed columns
        if (columns.length === 0) {
            complete();
            return;
        }
        var tokenTable = "_" + table + "_search_tokens_";
        // const searchTable = "_" + table + "_search_";
        utilities_1.fastALL(columns, function (col, i, next, colError) {
            var tokens = _this._tokenizer(col, rowData[col]);
            var wordCache = {};
            tokens.forEach(function (t) {
                wordCache[t.w] = t.o;
            });
            // get token cache for this row and column
            _this._store.adapterRead(tokenTable + col, pk, function (row) {
                if (!row) {
                    next();
                    return;
                }
                utilities_1.fastALL(["_search_", "_search_fuzzy_"], function (tableSection, l, next, err) {
                    // reduce to a list of words to remove
                    var wordsToRemove = {};
                    row.tokens.forEach(function (token) {
                        if (!wordsToRemove[token.w]) {
                            if (l === 0)
                                wordsToRemove[token.w] = true;
                            if (l === 1)
                                wordsToRemove[wordCache[token.w]] = true;
                        }
                    });
                    // query those words and remove this row from them
                    utilities_1.fastALL(Object.keys(wordsToRemove), function (word, j, done, error) {
                        if (!word) {
                            done();
                            return;
                        }
                        _this._store.adapterRead("_" + table + tableSection + col, word, function (wRow) {
                            if (!wRow) {
                                done();
                                return;
                            }
                            if (Object.isFrozen(wRow)) {
                                wRow = utilities_1._assign(wRow);
                            }
                            wRow.rows = wRow.rows.filter(function (r) { return r.id !== pk; });
                            _this._store.adapterWrite("_" + table + tableSection + col, word, wRow, done, error);
                        }, true);
                    }).then(next).catch(err);
                }).then(function () {
                    // remove row hash and token cache
                    _this._store.adapters[0].adapter.delete(tokenTable + col, pk, next);
                }).catch(colError);
            }, true);
        }).then(complete);
    };
    _NanoSQLStorageQuery.prototype._updateSearchIndex = function (pk, newRowData, complete) {
        var _this = this;
        var table = this._query.table;
        var columns = Object.keys(this._store.tableInfo[table]._searchColumns);
        // No search indexes on this table OR
        // update doesn't include indexed columns
        if (columns.length === 0 || !utilities_1.intersect(Object.keys(newRowData), columns)) {
            complete();
            return;
        }
        var tokenTable = "_" + table + "_search_tokens_";
        utilities_1.fastALL(columns, function (col, i, next, colError) {
            if ([undefined, null, ""].indexOf(newRowData[col]) !== -1) { // columns doesn't contain indexable value
                next();
                return;
            }
            // get token cache and hash for this row/column
            _this._store.adapterRead(tokenTable + col, pk, function (row) {
                var existing = row || { id: pk, hash: "1505", tokens: [] };
                var thisHash = utilities_1.hash(newRowData[col]);
                if (thisHash === existing.hash) { // indexed/hashed value hasn't changed, no updates needed
                    next();
                    return;
                }
                var wordCache = {};
                var newTokens = _this._tokenizer(col, newRowData[col]); // tokenize the new string
                // next 5 lines or so are used to find what words
                // have changed so we have to perform the smallest number of index updates.
                var oldTokenIdx = existing.tokens.map(function (t) { return t.i + "-" + t.w; }).filter(function (t) { return t.split("-")[1]; });
                var newTokenIdx = newTokens.map(function (t) { return t.i + "-" + t.w; }).filter(function (t) { return t.split("-")[1]; });
                var addTokens = newTokenIdx.filter(function (i) { return oldTokenIdx.indexOf(i) === -1; }); // tokens that need to be added to index
                var removeTokens = oldTokenIdx.filter(function (i) { return newTokenIdx.indexOf(i) === -1; }); // tokens to remove from the index
                newTokens.forEach(function (token) {
                    wordCache[token.w] = token.o;
                });
                utilities_1.fastCHAIN([removeTokens, addTokens], function (tokens, j, nextTokens, tokenErr) {
                    // find the total number of words that need to be updated (each word is a single index entry)
                    var reduceWords = {};
                    tokens.forEach(function (token) {
                        var sToken = token.split(/-(.+)/);
                        var wToken = { w: sToken[1], i: parseInt(sToken[0]) };
                        if (!reduceWords[wToken.w]) {
                            reduceWords[wToken.w] = [];
                        }
                        reduceWords[wToken.w].push(wToken);
                    });
                    // Update all words in the index
                    utilities_1.fastALL(Object.keys(reduceWords), function (word, k, nextWord) {
                        // Update token index and standard index
                        // _search_ = tokenized index
                        // _search_fuzzy_ = non tokenized index
                        utilities_1.fastALL(["_search_", "_search_fuzzy_"], function (tableSection, l, next, error) {
                            var indexWord = l === 0 ? word : wordCache[word];
                            if (!indexWord) { // if the word/token is falsey no need to index it.
                                next();
                                return;
                            }
                            _this._store.adapterRead("_" + table + tableSection + col, indexWord, function (colRow) {
                                var searchIndex = colRow || { wrd: word, rows: [] };
                                if (Object.isFrozen(searchIndex)) {
                                    searchIndex = utilities_1._assign(searchIndex);
                                }
                                switch (j) {
                                    case 0: // remove
                                        var idx = searchIndex.rows.length;
                                        while (idx--) {
                                            if (searchIndex.rows[idx].id === pk) {
                                                searchIndex.rows.splice(idx, 1);
                                            }
                                        }
                                        break;
                                    case 1: // add
                                        searchIndex.rows.push({
                                            id: pk,
                                            i: reduceWords[word].map(function (w) { return w.i; }),
                                            l: newTokens.length
                                        });
                                        break;
                                }
                                _this._store.adapterWrite("_" + table + tableSection + col, l === 0 ? word : wordCache[word], searchIndex, next, error);
                            }, true);
                        }).then(nextWord);
                    }).then(nextTokens);
                }).then(function () {
                    _this._store.adapterWrite(tokenTable + col, pk, {
                        id: pk,
                        hash: thisHash,
                        tokens: newTokens.map(function (o) { return ({ w: o.w, i: o.i }); })
                    }, next, colError);
                });
            }, true);
        }).then(complete);
    };
    /**
     * For each updated row, update view columns from remote records that are related.
     *
     * @private
     * @param {any[]} rows
     * @param {() => void} complete
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._updateRowViews = function (newRowData, existingRow, complete) {
        var _this = this;
        if (!this._store._hasViews) {
            complete(newRowData);
            return;
        }
        // nothing to update
        if (newRowData === null || newRowData === undefined) {
            complete(newRowData || {});
            return;
        }
        utilities_1.fastALL(Object.keys(this._store.tableInfo[this._query.table]._views), function (table, i, done) {
            var pk = _this._store.tableInfo[_this._query.table]._views[table].pkColumn;
            // reference/pk column isn't being updated.
            if (newRowData[pk] === undefined) {
                done();
                return;
            }
            // no changes in reference, skip query and upate
            if (newRowData[pk] === existingRow[pk]) {
                done();
                return;
            }
            // remove reference
            if (newRowData[pk] === null) {
                _this._store.tableInfo[_this._query.table]._views[table].columns.forEach(function (col) {
                    newRowData[col.thisColumn] = null;
                });
                done();
                return;
            }
            // get reference record and copy everything over
            _this._store.adapterRead(table, newRowData[pk], function (refRows) {
                // record doesn't exist
                if (!refRows.length && _this._store.tableInfo[_this._query.table]._views[table].mode === "LIVE") {
                    _this._store.tableInfo[_this._query.table]._views[table].columns.forEach(function (col) {
                        newRowData[col.thisColumn] = null;
                    });
                    done();
                    return;
                }
                // record exists, copy over data
                _this._store.tableInfo[_this._query.table]._views[table].columns.forEach(function (col) {
                    newRowData[col.thisColumn] = refRows[0][col.otherColumn];
                });
                done();
            }, true);
        }).then(function () {
            complete(newRowData);
        });
    };
    /**
     * Go to tables that have views pointing to this one, and update their records.
     *
     * @private
     * @param {any[]} updatedRows
     * @param {() => void} complete
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._updateRemoteViews = function (updatedRows, doDel, complete) {
        var _this = this;
        var pk = this._store.tableInfo[this._query.table]._pk;
        // for every updated row
        utilities_1.fastALL(updatedRows, function (row, i, done) {
            // scan all related tables for records attached
            utilities_1.fastALL(_this._store.tableInfo[_this._query.table]._viewTables, function (view, i, rowDone) {
                // delete with echo mode, skip removing records
                if (doDel && _this._store.tableInfo[view.table]._views[_this._query.table].mode === "GHOST") {
                    rowDone();
                    return;
                }
                _this._store._secondaryIndexRead(view.table, "=", view.column, row[pk], function (relatedRows) {
                    // nothing to update
                    if (!relatedRows.length) {
                        rowDone();
                        return;
                    }
                    var columns = _this._store.tableInfo[view.table]._views[_this._query.table].columns;
                    var relPK = _this._store.tableInfo[view.table]._views[_this._query.table].pkColumn;
                    // update the records
                    utilities_1.fastALL(relatedRows, function (rRow, j, rDone, rError) {
                        var i = columns.length;
                        var doUpdate = false;
                        if (doDel) {
                            if (_this._store.tableInfo[view.table]._views[_this._query.table].mode === "LIVE") {
                                doUpdate = true;
                                rRow[relPK] = null;
                                while (i--) {
                                    rRow[columns[i].otherColumn] = null;
                                }
                            }
                        }
                        else {
                            while (i--) {
                                if (rRow[columns[i].otherColumn] !== row[columns[i].thisColumn]) {
                                    rRow[columns[i].otherColumn] = row[columns[i].thisColumn];
                                    doUpdate = true;
                                }
                            }
                        }
                        if (!doUpdate) {
                            rDone();
                            return;
                        }
                        var rPk = _this._store.tableInfo[view.table]._pk;
                        _this._store.adapterWrite(view.table, rRow[rPk], rRow, rDone, rError);
                    }).then(rowDone);
                });
            }).then(done);
        }).then(complete);
    };
    _NanoSQLStorageQuery.prototype._doAfterQuery = function (newRows, doDel, next) {
        var _this = this;
        // no views at all OR this table doesn't have any views pointing to it.
        if (!this._store._hasViews || !this._store.tableInfo[this._query.table]._viewTables.length) {
            next(this._query);
            return;
        }
        this._updateRemoteViews(newRows, doDel, function () {
            next(_this._query);
        });
    };
    /**
     * Initilize an UPSERT query.
     *
     * @internal
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._upsert = function (next, error) {
        var _this = this;
        var pk = this._store.tableInfo[this._query.table]._pk;
        if (this._isInstanceTable) {
            this._getRows(function (rows) {
                _this._query.result = _this._query.table.map(function (r) {
                    if (rows.indexOf(r) === -1) {
                        return r;
                    }
                    return __assign({}, _this._query.actionArgs, r);
                });
                next(_this._query);
            });
            return;
        }
        var hasError = false;
        if (this._query.where) { // has where statement, select rows then modify them
            this._getRows(function (rows) {
                if (rows.length) {
                    // any changes to this table invalidates the cache
                    _this._store._cache[_this._query.table] = {};
                    var newRows_1 = [];
                    utilities_1.fastCHAIN(_this._query.actionArgs, function (inputData, k, nextRow, actionErr) {
                        utilities_1.fastCHAIN(rows, function (row, i, rowDone, rowError) {
                            _this._updateSearchIndex(row[pk], row, function () {
                                _this._updateRowViews(inputData || {}, row, function (updatedRowData) {
                                    if (_this._store.tableInfo[_this._query.table]._hasDefaults) {
                                        Object.keys(_this._store.tableInfo[_this._query.table]._defaults).forEach(function (col) {
                                            if (row[col] === undefined && updatedRowData[col] === undefined) {
                                                updatedRowData[col] = _this._store.tableInfo[_this._query.table]._defaults[col];
                                            }
                                        });
                                    }
                                    _this._store._write(_this._query.table, row[pk], row, updatedRowData, rowDone, function (err) {
                                        hasError = true;
                                        rowError(err);
                                    });
                                });
                            });
                        }).then(function (nRows) {
                            if (hasError)
                                return;
                            newRows_1 = nRows;
                            nextRow();
                        }).catch(actionErr);
                    }).then(function () {
                        if (hasError)
                            return;
                        var pks = newRows_1.map(function (r) { return r[pk]; });
                        _this._query.result = [{ msg: newRows_1.length + " row(s) modfied.", affectedRowPKS: pks, affectedRows: newRows_1 }];
                        _this._syncORM("add", rows, newRows_1, function () {
                            _this._doAfterQuery(newRows_1, false, next);
                        });
                    }).catch(error);
                }
                else {
                    if (hasError)
                        return;
                    _this._query.result = [{ msg: "0 row(s) modfied.", affectedRowPKS: [], affectedRows: [] }];
                    next(_this._query);
                }
            });
        }
        else { // no where statement, perform direct upsert
            var rows = this._query.actionArgs || [];
            this._store._cache[this._query.table] = {};
            var oldRows_1 = [];
            var addedRows_1 = [];
            utilities_1.fastCHAIN(rows, function (row, k, nextRow, rowError) {
                var write = function (oldRow) {
                    _this._updateRowViews(row, oldRow, function (updatedRowData) {
                        if (_this._store.tableInfo[_this._query.table]._hasDefaults) {
                            Object.keys(_this._store.tableInfo[_this._query.table]._defaults).forEach(function (col) {
                                if ((oldRow || {})[col] === undefined && updatedRowData[col] === undefined) {
                                    updatedRowData[col] = _this._store.tableInfo[_this._query.table]._defaults[col];
                                }
                            });
                        }
                        _this._store._write(_this._query.table, row[pk], oldRow, updatedRowData, function (result) {
                            _this._updateSearchIndex(result[pk], result, function () {
                                oldRows_1.push(oldRow || {});
                                addedRows_1.push(result);
                                nextRow();
                            });
                        }, function (err) {
                            hasError = true;
                            rowError(err);
                        });
                    });
                };
                if (row[pk] !== undefined && _this._query.comments.indexOf("_rebuild_search_index_") === -1) {
                    _this._store._read(_this._query.table, [row[pk]], function (rows) {
                        if (rows.length) {
                            write(rows[0]);
                        }
                        else {
                            write(null);
                        }
                    });
                }
                else {
                    write(null);
                }
            }).then(function () {
                if (hasError)
                    return;
                _this._query.result = [{ msg: addedRows_1.length + " row(s) inserted.", affectedRowPKS: addedRows_1.map(function (r) { return r[pk]; }), affectedRows: addedRows_1 }];
                if (_this._store._hasORM) {
                    _this._syncORM("add", oldRows_1, addedRows_1, function () {
                        _this._doAfterQuery(addedRows_1, false, next);
                    });
                }
                else {
                    _this._doAfterQuery(addedRows_1, false, next);
                }
            }).catch(error);
        }
    };
    /**
     * Initilize a DELETE query.
     *
     * @internal
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._delete = function (next) {
        var _this = this;
        if (this._isInstanceTable) {
            if (this._query.where) {
                this._getRows(function (rows) {
                    _this._query.result = _this._query.table.filter(function (row) {
                        return rows.indexOf(row) === -1;
                    });
                    next(_this._query);
                });
            }
            else {
                this._query.result = [];
                next(this._query);
            }
            return;
        }
        if (this._query.where) { // has where statement, select rows then delete them
            this._getRows(function (rows) {
                rows = rows.filter(function (r) { return r; });
                if (rows.length) {
                    utilities_1.fastALL(rows, function (r, i, done) {
                        _this._clearFromSearchIndex(r[_this._store.tableInfo[_this._query.table]._pk], r, function () {
                            _this._store._delete(_this._query.table, r[_this._store.tableInfo[_this._query.table]._pk], done);
                        });
                    }).then(function (affectedRows) {
                        // any changes to this table invalidate the cache
                        _this._store._cache[_this._query.table] = {};
                        var pks = rows.map(function (r) { return r[_this._store.tableInfo[_this._query.table]._pk]; });
                        _this._query.result = [{ msg: rows.length + " row(s) deleted.", affectedRowPKS: pks, affectedRows: rows }];
                        _this._syncORM("del", rows, [], function () {
                            _this._doAfterQuery(rows, true, next);
                        });
                    });
                }
                else {
                    _this._query.result = [{ msg: "0 row(s) deleted.", affectedRowPKS: [], affectedRows: [] }];
                    next(_this._query);
                }
            });
        }
        else { // no where statement, perform drop
            this._drop(next);
        }
    };
    /**
     * Initilize a DROP query.
     *
     * @internal
     * @param {(q: IdbQuery) => void} next
     * @returns
     * @memberof _NanoSQLStorageQuery
     */
    _NanoSQLStorageQuery.prototype._drop = function (next) {
        var _this = this;
        if (this._isInstanceTable) {
            this._query.result = [];
            next(this._query);
            return;
        }
        this._store._rangeRead(this._query.table, undefined, undefined, false, function (rows) {
            _this._store._cache[_this._query.table] = {};
            var table = _this._query.table;
            _this._store._drop(_this._query.table, function () {
                _this._query.result = [{ msg: "'" + _this._query.table + "' table dropped.", affectedRowPKS: rows.map(function (r) { return r[_this._store.tableInfo[_this._query.table]._pk]; }), affectedRows: rows }];
                _this._syncORM("del", rows, [], function () {
                    _this._doAfterQuery(rows, true, next);
                });
            });
        });
    };
    return _NanoSQLStorageQuery;
}());
exports._NanoSQLStorageQuery = _NanoSQLStorageQuery;
/**
 * Takes a selection of rows and applys modifiers like orderBy, join and others to the rows.
 * Returns the affected rows updated in the way the query specified.
 *
 * @export
 * @class MutateSelection
 */
// tslint:disable-next-line
var _MutateSelection = /** @class */ (function () {
    function _MutateSelection(q, s) {
        this.q = q;
        this.s = s;
        this._groupByColumns = [];
    }
    /**
     * Peform a join command.
     *
     * @internal
     * @param {DBRow[]} rows
     * @param {(rows: DBRow[]) => void} complete
     * @returns {void}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._join = function (rows, complete) {
        var _this = this;
        if (!this.q.join) {
            complete(rows);
            return;
        }
        var joinData = Array.isArray(this.q.join) ? this.q.join : [this.q.join];
        var leftTablePK = this.q.table + "." + this.s.tableInfo[this.q.table]._pk;
        utilities_1.fastCHAIN(joinData, function (join, ji, next) {
            var joinConditions = {};
            if (join.type !== "cross" && join.where) {
                joinConditions = {
                    _left: join.where[0],
                    _check: join.where[1],
                    _right: join.where[2]
                };
            }
            var leftTable = _this.q.table;
            var rightTable = join.table;
            _this._doJoin(join.type, leftTable, rightTable, joinConditions, function (joinedRows) {
                next(joinedRows);
            });
        }).then(function (result) {
            // handle bringing the multiple joins into a single result set.
            // we're essentially doing a left outer join on the results.
            var i = 1;
            while (i < result.length) {
                result[i].forEach(function (row) {
                    var found = false;
                    if ([undefined, null].indexOf(row[leftTablePK]) === -1) {
                        result[0].forEach(function (row2, j) {
                            if (row2[leftTablePK] && row[leftTablePK] === row2[leftTablePK]) {
                                found = true;
                                Object.keys(row).forEach(function (key) {
                                    if (result[0][j][key] === undefined) {
                                        result[0][j][key] = row[key];
                                    }
                                });
                            }
                        });
                    }
                    if (!found) {
                        result[0].push(row);
                    }
                });
                i++;
            }
            if (_this.q.where) { // apply where statement to join
                complete(result[0].filter(function (row, idx) {
                    return Array.isArray(_this.q.where) ? _where(row, _this.q.where || [], idx, true) : _this.q.where(row, idx);
                }));
            }
            else if (_this.q.range) { // apply range statement to join
                complete(result[0].filter(function (row, idx) {
                    return _this.q.range && _this.q.range[0] >= idx && (_this.q.range[0] + _this.q.range[1]) - 1 <= idx;
                }));
            }
            else { // send the whole result
                complete(result[0]);
            }
        });
    };
    /**
     * Generate a unique group by key given a group by object and a row.
     *
     * @internal
     * @param {string[]} columns
     * @param {*} row
     * @returns {string}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._groupByKey = function (columns, row) {
        return columns.reduce(function (p, c) {
            // handle ".length"
            if (c.indexOf(".length") !== -1) {
                return p + "." + String((row[c.replace(".length", "")] || []).length);
            }
            else {
                return p + "." + String(row[c]);
            }
        }, "").slice(1);
    };
    /**
     * Perform the Group By mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._groupBy = function (rows) {
        var _this = this;
        var columns = this.q.groupBy || {};
        var sortedRows = rows.sort(function (a, b) {
            return _this._sortObj(a, b, columns, true);
        });
        sortedRows.forEach(function (val, idx) {
            var groupByKey = Object.keys(columns).map(function (k) { return String(val[k]) || ""; }).join(".");
            if (!_this._sortGroups) {
                _this._sortGroups = {};
            }
            if (!_this._sortGroups[groupByKey]) {
                _this._sortGroups[groupByKey] = [];
            }
            _this._sortGroups[groupByKey].push(idx);
        });
        return sortedRows;
    };
    /**
     * Perform HAVING mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._having = function (rows) {
        var _this = this;
        return rows.filter(function (row, idx) {
            return Array.isArray(_this.q.having) ? _where(row, _this.q.having || [], idx, true) : _this.q.having(row, idx);
        });
    };
    /**
     * Perform the orderBy mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._orderBy = function (rows) {
        var _this = this;
        return rows.sort(function (a, b) {
            return _this._sortObj(a, b, _this.q.orderBy || {}, false);
        });
    };
    /**
     * Perform the Offset mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._offset = function (rows) {
        return rows.slice(this.q.offset);
    };
    /**
     * Perform the limit mutation.
     *
     * @internal
     * @param {DBRow[]} rows
     * @returns {any[]}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._limit = function (rows) {
        return rows.slice(0, this.q.limit);
    };
    /**
     * Add ORM values to rows based on query.
     *
     * @internal
     * @param {DBRow[]} rows
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._orm = function (rows, complete) {
        var _this = this;
        var ormQueries = this.q.orm ? this.q.orm.map(function (o) {
            if (typeof o === "string") {
                return {
                    key: o,
                    limit: 5
                };
            }
            return o;
        }) : [];
        utilities_1.fastALL(rows, function (row, i, rowResult) {
            row = Object.isFrozen(row) ? utilities_1._assign(row) : row;
            utilities_1.fastALL(ormQueries, function (orm, k, ormResult) {
                if (typeof row[orm.key] === "undefined") {
                    ormResult();
                    return;
                }
                var relateData = _this.s._columnsAreTables[_this.q.table][orm.key];
                if (relateData) {
                    _this.s._nsql.query("select").where([_this.s.tableInfo[relateData._toTable]._pk, relateData._thisType === "array" ? "IN" : "=", row[orm.key]]).manualExec({ table: relateData._toTable }).then(function (rows) {
                        var q = index_1.nSQL().query("select", orm.select);
                        if (orm.where) {
                            q.where(orm.where);
                        }
                        if (orm.limit !== undefined) {
                            q.limit(orm.limit);
                        }
                        if (orm.offset !== undefined) {
                            q.offset(orm.offset);
                        }
                        if (orm.orderBy) {
                            q.orderBy(orm.orderBy);
                        }
                        if (orm.groupBy) {
                            q.groupBy(orm.groupBy);
                        }
                        q.manualExec({ table: rows }).then(function (result) {
                            if (!rows.filter(function (r) { return r; }).length) {
                                row[orm.key] = relateData._thisType === "array" ? [] : undefined;
                            }
                            else {
                                row[orm.key] = relateData._thisType === "array" ? result : result[0];
                            }
                            ormResult();
                        });
                    });
                }
                else {
                    ormResult();
                }
            }).then(function () {
                rowResult(row);
            });
        }).then(complete);
    };
    /**
     * Performs the actual JOIN mutation, including the O^2 select query to check all rows against every other row.
     *
     * @internal
     * @param {("left" | "inner" | "right" | "cross" | "outer")} type
     * @param {string} leftTable
     * @param {string} rightTable
     * @param {(null | { _left: string, _check: string, _right: string })} joinConditions
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._doJoin = function (type, leftTable, rightTable, joinConditions, complete) {
        var L = "left";
        var R = "right";
        var O = "outer";
        var C = "cross";
        var t = this;
        var firstTableData = t.s.tableInfo[type === R ? rightTable : leftTable];
        var seconTableData = t.s.tableInfo[type === R ? leftTable : rightTable];
        var doJoinRows = function (leftRow, rightRow) {
            return [firstTableData, seconTableData].reduce(function (prev, cur, i) {
                cur._keys.forEach(function (k) {
                    prev[cur._name + "." + k] = ((i === 0 ? leftRow : rightRow) || {})[k];
                });
                return prev;
            }, {});
        };
        var joinTable = [];
        var rightKey = joinConditions && joinConditions._right ? joinConditions._right.split(".").pop() || "" : "";
        var usedSecondTableRows = {};
        var secondRowCache = [];
        // O^2, YAY!
        t.s._read(firstTableData._name, function (firstRow, idx, keep) {
            var hasOneRelation = false;
            t.s._read(seconTableData._name, function (secondRow, idx2, keep2) {
                if (!joinConditions || type === C) { // no conditional to check OR cross join, always add
                    joinTable.push(doJoinRows(firstRow, secondRow));
                    hasOneRelation = true;
                }
                else { // check conditional statement to possibly join
                    var willJoinRows = _where((_a = {},
                        _a[firstTableData._name] = firstRow,
                        _a[seconTableData._name] = secondRow,
                        _a), [joinConditions._left, joinConditions._check, type === R ? firstRow[rightKey] : secondRow[rightKey]], 0, false);
                    if (willJoinRows) {
                        if (type === O)
                            usedSecondTableRows[idx2] = true;
                        joinTable.push(doJoinRows(firstRow, secondRow));
                        hasOneRelation = true;
                    }
                    else {
                        if (type === O)
                            secondRowCache[idx2] = secondRow;
                    }
                }
                keep2(false);
                var _a;
            }, function () {
                // left, right or outer join will cause rows without a relation to be added anyway with null relation
                if (!hasOneRelation && [L, R, O].indexOf(type) > -1) {
                    joinTable.push(doJoinRows(firstRow, null));
                }
                keep(false);
            });
        }, function () {
            // full outer join, add the secondary rows that haven't been added yet
            if (type === O) {
                var addRows = secondRowCache.filter(function (val, i) { return !usedSecondTableRows[i]; });
                var i = 0;
                while (i < addRows.length) {
                    joinTable.push(doJoinRows(null, addRows[i]));
                    i++;
                }
                complete(joinTable);
            }
            else {
                complete(joinTable);
            }
        });
    };
    /**
     * Get the sort direction for two objects given the objects, columns and resolve paths.
     *
     * @internal
     * @param {*} objA
     * @param {*} objB
     * @param {{ [key: string]: string }} columns
     * @param {boolean} resolvePaths
     * @returns {number}
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._sortObj = function (objA, objB, columns, resolvePaths) {
        return Object.keys(columns).reduce(function (prev, cur) {
            var A = resolvePaths ? utilities_1.objQuery(cur, objA) : objA[cur];
            var B = resolvePaths ? utilities_1.objQuery(cur, objB) : objB[cur];
            if (!prev) {
                if (A === B)
                    return 0;
                return (A > B ? 1 : -1) * (columns[cur] === "desc" ? -1 : 1);
            }
            else {
                return prev;
            }
        }, 0);
    };
    /**
     * Apply AS, functions and Group By
     *
     * @internal
     * @param {DBRow[]} rows
     * @param {(rows: DBRow[]) => void} complete
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._mutateRows = function (rows, complete) {
        var _this = this;
        var columnSelection = this.q.actionArgs;
        var functionResults = {};
        var fnGroupByResults = {};
        if (columnSelection && columnSelection.length) {
            // possibly has functions, AS statements
            var hasAggregateFun_1 = false;
            var columnData_1 = {};
            columnSelection.forEach(function (column) {
                if (column.indexOf("(") === -1) { // no functions
                    return;
                }
                var fnName = (column.match(/^.*\(/g) || [""])[0].replace(/\(|\)/g, "").toUpperCase();
                var fn = index_1.NanoSQLInstance.functions[fnName];
                var key = column.split(" AS ").length === 1 ? fnName : (column.split(" AS ").pop() || "").trim();
                if (!fn) {
                    throw new Error("nSQL: '" + fnName + "' is not a valid function!");
                }
                if (fn.type === "A") { // agregate function
                    hasAggregateFun_1 = true;
                }
                columnData_1[column] = {
                    fn: fn,
                    key: key
                };
            });
            utilities_1.fastALL(columnSelection, function (column, j, columnDone) {
                if (column.indexOf("(") > -1) { // function exists
                    var fnArgs_1 = (column.match(/\(.*\)/g) || [""])[0].replace(/\(|\)/g, "").split(",").map(function (v) { return v.trim(); });
                    if (_this._sortGroups && hasAggregateFun_1) { // group by exists with aggregate function
                        utilities_1.fastALL(Object.keys(_this._sortGroups), function (k, l, fnDone) {
                            if (!fnGroupByResults[k]) {
                                fnGroupByResults[k] = {};
                            }
                            (_a = columnData_1[column].fn).call.apply(_a, [rows.filter(function (r, i) { return _this._sortGroups[k].indexOf(i) > -1; }), function (result) {
                                    fnGroupByResults[k][columnData_1[column].key] = result;
                                    fnDone();
                                }, _this.q.join !== undefined].concat(fnArgs_1));
                            var _a;
                        }).then(columnDone);
                    }
                    else { // no group by
                        (_a = columnData_1[column].fn).call.apply(_a, [rows, function (result) {
                                functionResults[columnData_1[column].key] = result;
                                columnDone();
                            }, _this.q.join !== undefined].concat(fnArgs_1));
                    }
                }
                else {
                    columnDone(); // no function
                }
                var _a;
            }).then(function () {
                // time to rebuild row results
                var doMuateRows = function (row, idx, fnResults) {
                    var newRow = {};
                    // remove unselected columns, apply AS and integrate function results
                    columnSelection.forEach(function (column) {
                        var hasFunc = column.indexOf("(") > -1;
                        var type = hasFunc ? columnData_1[column].fn.type : "";
                        if (column.indexOf(" AS ") > -1) { // alias column data
                            var alias = column.split(" AS ");
                            var key = hasFunc ? columnData_1[column].key : alias[0].trim();
                            newRow[alias[1]] = hasFunc ? (type === "A" ? fnResults[key] : fnResults[key][idx]) : utilities_1.objQuery(key, row, _this.q.join !== undefined);
                        }
                        else {
                            var key = hasFunc ? columnData_1[column].key : column;
                            newRow[column] = hasFunc ? (type === "A" ? fnResults[key] : fnResults[key][idx]) : utilities_1.objQuery(key, row, _this.q.join !== undefined);
                        }
                    });
                    return newRow;
                };
                if (!rows.length && hasAggregateFun_1) {
                    var oneRow_1 = [{}];
                    Object.keys(columnData_1).forEach(function (fnName) {
                        if (typeof functionResults[columnData_1[fnName].key] !== "undefined") {
                            oneRow_1[0][fnName] = functionResults[columnData_1[fnName].key];
                        }
                    });
                    complete(oneRow_1);
                    return;
                }
                if (_this._sortGroups && hasAggregateFun_1) { // group by with aggregate
                    var newRows_2 = [];
                    Object.keys(_this._sortGroups).forEach(function (k) {
                        var thisRow = rows.filter(function (r, i) { return _this._sortGroups[k].indexOf(i) > -1; }).filter(function (v, i) { return i < 1; });
                        if (thisRow && thisRow.length) {
                            newRows_2.push(doMuateRows(thisRow[0], 0, fnGroupByResults[k]));
                        }
                    });
                    complete(newRows_2);
                }
                else if (hasAggregateFun_1) { // just aggregate (returns 1 row)
                    complete(rows.filter(function (v, i) { return i < 1; }).map(function (v, i) { return doMuateRows(v, i, functionResults); }));
                }
                else { // no aggregate and no group by, easy peasy
                    complete(rows.map(function (v, i) { return doMuateRows(v, i, functionResults); }));
                }
            });
        }
        else {
            // just pass through
            complete(rows);
        }
    };
    /**
     * Triggers the mutations in the order of operations.
     *
     * @param {DBRow[]} inputRows
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _MutateSelection
     */
    _MutateSelection.prototype._executeQueryArguments = function (inputRows, callback) {
        var _this = this;
        var afterMutate = function () {
            if (_this.q.having) {
                inputRows = _this._having(inputRows);
            }
            if (_this.q.orderBy) {
                inputRows = _this._orderBy(inputRows);
            }
            if (_this.q.offset) {
                inputRows = _this._offset(inputRows);
            }
            if (_this.q.limit) {
                inputRows = _this._limit(inputRows);
            }
            callback(inputRows);
        };
        var afterORM = function () {
            if (_this.q.actionArgs && _this.q.actionArgs.length) {
                _this._mutateRows(inputRows, function (newRows) {
                    inputRows = newRows;
                    afterMutate();
                });
            }
            else {
                afterMutate();
            }
        };
        var afterJoin = function () {
            if (_this.q.groupBy) {
                inputRows = _this._groupBy(inputRows);
            }
            if (_this.q.orm) {
                _this._orm(inputRows, function (newRows) {
                    inputRows = newRows;
                    afterORM();
                });
            }
            else {
                afterORM();
            }
        };
        if (this.q.join) {
            this._join(inputRows, function (rows) {
                inputRows = rows;
                afterJoin();
            });
        }
        else {
            afterJoin();
        }
    };
    return _MutateSelection;
}());
exports._MutateSelection = _MutateSelection;
/**
 * Selects the needed rows from the storage system.
 * Uses the fastes possible method to get the rows.
 *
 * @export
 * @class _RowSelection
 */
// tslint:disable-next-line
var _RowSelection = /** @class */ (function () {
    function _RowSelection(qu, q, s, callback) {
        var _this = this;
        this.qu = qu;
        this.q = q;
        this.s = s;
        if (this.q.join && this.q.orm) {
            throw new Error("nSQL: Cannot do a JOIN and ORM command at the same time!");
        }
        if ([this.q.where, this.q.range, this.q.trie].filter(function (i) { return i; }).length > 1) {
            throw new Error("nSQL: Can only have ONE of Trie, Range or Where!");
        }
        // join command requires n^2 scan that gets taken care of in join logic.
        if (this.q.join) {
            callback([]);
            return;
        }
        // trie search, nice and fast.
        if (this.q.trie && this.q.trie.column && this.q.trie.search) {
            this._selectByTrie(callback);
            return;
        }
        // range select, very fast
        if (this.q.range && this.q.range.length) {
            this._selectByRange(callback);
            return;
        }
        // no where statement, read whole db :(
        // OR
        // where statement is function, still gotta read the whole db.
        if ((!this.q.where || !this.q.where.length) || !Array.isArray(this.q.where)) {
            this._fullTableScan(callback);
            return;
        }
        // where statement possibly contains only primary key and secondary key queries, do faster query if possible.
        var doFastRead = false;
        if (typeof this.q.where[0] === "string") { // Single WHERE
            doFastRead = this._isOptimizedWhere(this.q.where) === 0;
        }
        else { // combined where statements
            doFastRead = (this.q.where || []).reduce(function (prev, cur, i) {
                if (i % 2 === 1)
                    return prev;
                return prev + _this._isOptimizedWhere(cur);
            }, 0) === 0;
        }
        if (doFastRead) { // can go straight to primary or secondary keys, wee!
            this._selectByKeysOrSeach(this.q.where, callback);
            return;
        }
        // if compound where statement includes primary key/secondary index queries followed by AND with other conditions.
        // grabs the section of data related to the optimized read, then full table scans the result.
        var whereSlice = this._isSubOptimizedWhere(this.q.where);
        if (whereSlice > 0) {
            var fastWhere = this.q.where.slice(0, whereSlice);
            var slowWhere_1 = this.q.where.slice(whereSlice + 1);
            this._selectByKeysOrSeach(fastWhere, function (rows) {
                callback(rows.filter(function (r, i) { return _where(r, slowWhere_1, i, false); }));
            });
            return;
        }
        // Full table scan :(
        this._fullTableScan(callback);
    }
    /**
     * Does super fast primary key or secondary index select.
     * Handles compound WHERE statements, combining their results.
     * Works as long as every WHERE statement is selecting against a primary key or secondary index.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _RowSelection
     */
    _RowSelection.prototype._selectByKeysOrSeach = function (where, callback) {
        var _this = this;
        if (where && typeof where[0] === "string") { // single where
            this._selectRowsByIndexOrSearch(where, callback);
        }
        else if (where) { // compound where
            var resultRows_1 = [];
            var lastCommand_1 = "";
            var PK_1 = this.s.tableInfo[this.q.table]._pk;
            utilities_1.fastCHAIN(where, function (wArg, i, nextWArg) {
                if (i % 2 === 1) {
                    lastCommand_1 = wArg;
                    nextWArg();
                    return;
                }
                _this._selectRowsByIndexOrSearch(wArg, function (rows) {
                    if (lastCommand_1 === "AND") {
                        var idx_1 = {};
                        var i_1 = rows.length;
                        while (i_1--) {
                            idx_1[rows[i_1][PK_1]] = true;
                        }
                        resultRows_1 = resultRows_1.filter(function (row) { return idx_1[row[PK_1]]; });
                    }
                    else {
                        resultRows_1 = resultRows_1.concat(rows);
                    }
                    nextWArg();
                });
            }).then(function () {
                var pks = {};
                // remove duplicates
                callback(resultRows_1.filter(function (row) {
                    if (pks[row[PK_1]])
                        return false;
                    pks[row[PK_1]] = true;
                    return true;
                }));
            });
        }
    };
    /**
     * Much faster SELECT by primary key or secondary index.
     * Accepts a single WHERE statement, no compound statements allowed.
     *
     * @internal
     * @param {any[]} where
     * @param {(rows: DBRow[]) => void} callback
     * @returns
     * @memberof _RowSelection
     */
    _RowSelection.prototype._selectRowsByIndexOrSearch = function (where, callback) {
        var _this = this;
        if (where[0].indexOf("search(") === 0) {
            var whereType_1 = 0;
            if (where[1].indexOf(">") !== -1) {
                whereType_1 = parseFloat(where[1].replace(">", "")) + 0.0001;
            }
            else if (where[1].indexOf("<") !== -1) {
                whereType_1 = (parseFloat(where[1].replace("<", "")) * -1) + 0.0001;
            }
            var columns = where[0].replace(/search\((.*)\)/gmi, "$1").split(",").map(function (c) { return c.trim(); });
            var weights_1 = {};
            var searchTermsToFound_1 = {};
            utilities_1.fastALL(columns, function (col, i, nextCol) {
                // tokenize search terms
                var searchTerms = _this.qu._tokenizer(col, where[2]);
                var args = _this.s.tableInfo[_this.q.table]._searchColumns[col];
                var reducedResults = {};
                var reducedFirstLocations = [];
                var tokenToTerm = {};
                var termToToken = {};
                searchTerms.forEach(function (search) {
                    tokenToTerm[search.w] = search.o;
                    termToToken[search.o] = search.w;
                });
                // get all rows that have at least one search term
                utilities_1.fastALL(["_search_", "_search_fuzzy_"], function (tableSection, j, nextTable) {
                    var indexTable = "_" + _this.q.table + tableSection + col;
                    switch (j) {
                        case 0:
                            // Search the tokenized index for matches (super quick);
                            utilities_1.fastALL(searchTerms, function (term, j, nextTerm) {
                                _this.s.adapterRead(indexTable, term.w, function (row) {
                                    if (!row) {
                                        nextTerm();
                                        return;
                                    }
                                    row.rows.forEach(function (r) {
                                        if (!reducedResults[r.id]) {
                                            reducedResults[r.id] = {};
                                        }
                                        reducedFirstLocations.push(r.i[0]);
                                        reducedResults[r.id][term.w] = r;
                                    });
                                    nextTerm();
                                });
                            }).then(nextTable);
                            break;
                        case 1:
                            if (whereType_1 === 0) {
                                nextTable();
                                return;
                            }
                            // Grab the fuzzy search index then compare each string for match
                            // WAY slower than the tokenizer match but gets you fuzzy results.
                            _this.s.adapters[0].adapter.getIndex(indexTable, false, function (index) {
                                var wordsToGet = [];
                                index.forEach(function (word) {
                                    searchTerms.forEach(function (term) {
                                        if (fuzzy(term.o, word)) {
                                            searchTermsToFound_1[term.o] = word;
                                            tokenToTerm[word] = term.o;
                                            wordsToGet.push(word);
                                        }
                                    });
                                });
                                // remove duplicates
                                wordsToGet = wordsToGet.filter(function (v, i, s) { return s.indexOf(v) === i; });
                                utilities_1.fastALL(wordsToGet, function (term, j, nextTerm) {
                                    _this.s.adapterRead(indexTable, term, function (row) {
                                        if (!row) {
                                            nextTerm();
                                            return;
                                        }
                                        row.rows.forEach(function (r) {
                                            // if the non fuzzy search already got this row then ignore it
                                            var exists = false;
                                            if (!reducedResults[r.id]) {
                                                reducedResults[r.id] = {};
                                            }
                                            else {
                                                if (reducedFirstLocations.indexOf(r.i[0]) !== -1) {
                                                    exists = true;
                                                }
                                            }
                                            if (!exists) {
                                                var key = termToToken[term] || term;
                                                reducedResults[r.id][key] = r;
                                            }
                                        });
                                        nextTerm();
                                    });
                                }).then(nextTable);
                            });
                            break;
                    }
                }).then(function () {
                    // now get the weights and locations for each row
                    Object.keys(reducedResults).forEach(function (rowPK) {
                        if (whereType_1 === 0) { // exact match, row results must have same number of terms as search
                            if (Object.keys(reducedResults[rowPK]).length !== searchTerms.length) {
                                delete reducedResults[rowPK];
                                return;
                            }
                        }
                        if (!weights_1[rowPK]) {
                            weights_1[rowPK] = { weight: 0, locations: {} };
                        }
                        var docLength = 0;
                        var wordLocs = Object.keys(reducedResults[rowPK]).map(function (w) {
                            docLength = reducedResults[rowPK][w].l;
                            if (tokenToTerm[w]) {
                                // if we got something from fuzzy search, boost it up.
                                // this is to balance against the idxsTerm code below
                                weights_1[rowPK].weight += 5;
                            }
                            return { word: tokenToTerm[w] || w, loc: reducedResults[rowPK][w].i };
                        });
                        var totalLocations = wordLocs.reduce(function (p, c) { return p + c.loc.length; }, 0);
                        weights_1[rowPK].weight += (totalLocations / docLength) + parseInt(args[0]);
                        weights_1[rowPK].locations[col] = wordLocs;
                        if (whereType_1 !== 0) { // fuzzy term match
                            // We're checking each result to see how closely it matches the search phrase.
                            // Closer proximity === higher weight
                            searchTerms.forEach(function (sTerm) {
                                // all instances of this term in this row/column, only runs against tokenizer results
                                var idxsTerm = reducedResults[rowPK][sTerm.w];
                                if (idxsTerm) {
                                    idxsTerm.i.forEach(function (refLocation) {
                                        // now check to see where the other parts of the terms are located in reference to this one
                                        Object.keys(reducedResults[rowPK]).forEach(function (sTerm2) {
                                            if (sTerm2 !== sTerm.w) {
                                                // check all instances of other terms
                                                reducedResults[rowPK][sTerm2].i.forEach(function (wordLoc) {
                                                    var distance = Math.abs(wordLoc - refLocation);
                                                    if (distance)
                                                        weights_1[rowPK].weight += (10 / (distance * 10));
                                                });
                                            }
                                        });
                                    });
                                }
                                // the fuzzy() search algorithm used in the previouse step is orders of magnitude faster than levenshtein distance,
                                // however it only returns boolean values, so we use levenshtein to get relevance on the much smaller set
                                // of result records
                                if (searchTermsToFound_1[sTerm.o]) {
                                    wordLocs.forEach(function (loc) {
                                        if (searchTermsToFound_1[sTerm.o] === loc.word) {
                                            var lev = levenshtein(sTerm.o, loc.word);
                                            if (lev <= 1) {
                                                weights_1[rowPK].weight += 10;
                                            }
                                            else {
                                                weights_1[rowPK].weight += 10 / (lev * 5);
                                            }
                                        }
                                    });
                                }
                            });
                        }
                        else { // exact term match
                            if (searchTerms.length > 1) {
                                var startingWord_1 = [];
                                Object.keys(reducedResults[rowPK]).forEach(function (term) {
                                    if (term === searchTerms[0].w) {
                                        startingWord_1 = reducedResults[rowPK][term].i;
                                    }
                                });
                                var doingGood_1 = true;
                                startingWord_1.forEach(function (location, i) {
                                    var nextWord = searchTerms[i + 1];
                                    if (nextWord) {
                                        Object.keys(reducedResults[rowPK]).forEach(function (term) {
                                            if (term === nextWord.w) {
                                                var offset = nextWord.i + location;
                                                if (reducedResults[rowPK][term].i.indexOf(offset) === -1) {
                                                    doingGood_1 = false;
                                                }
                                            }
                                        });
                                    }
                                });
                                if (!doingGood_1) {
                                    delete weights_1[rowPK];
                                }
                            }
                        }
                    });
                    nextCol();
                });
            }).then(function (results) {
                // normalize the weights
                var max = 0;
                var rowKeys = Object.keys(weights_1);
                var ii = rowKeys.length;
                while (ii--) {
                    max = Math.max(max, weights_1[rowKeys[ii]].weight);
                }
                ii = rowKeys.length;
                while (ii--) {
                    weights_1[rowKeys[ii]].weight = weights_1[rowKeys[ii]].weight / max;
                }
                utilities_1.fastALL(rowKeys.filter(function (pk) {
                    if (whereType_1 === 0)
                        return true;
                    if (whereType_1 > 0) {
                        return whereType_1 < weights_1[pk].weight;
                    }
                    if (whereType_1 < 0) {
                        return whereType_1 * -1 > weights_1[pk].weight;
                    }
                    return true;
                }), function (pk, i, done) {
                    // get result rows
                    _this.s.adapterRead(_this.q.table, pk, done);
                }).then(function (rows) {
                    var pk = _this.s.tableInfo[_this.q.table]._pk;
                    rows = rows.filter(function (r) { return r; });
                    // run levenshtein again against the results.
                    // We're doing this again because there's no way to know the values of the tokenized result rows that we've matched
                    // without querying them, so we reduce the problem set to the smallest possible, then levenshtein against it.
                    rows.forEach(function (row) {
                        var rowPK = row[pk];
                        Object.keys(weights_1[rowPK].locations).forEach(function (col) {
                            var rowCol = _this.qu._tokenizer(col, row[col]).map(function (w) { return w.o; });
                            weights_1[rowPK].locations[col].forEach(function (matches) {
                                matches.loc.forEach(function (idx) {
                                    var lev = levenshtein(rowCol[idx], matches.word);
                                    if (lev <= 1) {
                                        weights_1[rowPK].weight += 10;
                                    }
                                    else {
                                        weights_1[rowPK].weight += 10 / (lev * 10);
                                    }
                                });
                            });
                        });
                    });
                    // normalize weights again
                    var max = 0;
                    var rowKeys = Object.keys(weights_1);
                    var ii = rowKeys.length;
                    while (ii--) {
                        max = Math.max(max, weights_1[rowKeys[ii]].weight);
                    }
                    ii = rowKeys.length;
                    while (ii--) {
                        weights_1[rowKeys[ii]].weight = weights_1[rowKeys[ii]].weight / max;
                    }
                    callback(rows.filter(function (r) {
                        if (whereType_1 === 0)
                            return true;
                        if (whereType_1 > 0) {
                            return whereType_1 < weights_1[r[pk]].weight;
                        }
                        if (whereType_1 < 0) {
                            return whereType_1 * -1 > weights_1[r[pk]].weight;
                        }
                        return true;
                    }).map(function (r) { return (__assign({}, r, { _weight: weights_1[r[pk]].weight, _locations: weights_1[r[pk]].locations })); }));
                });
            });
            return;
        }
        // get rows based on crow distance from given GPS coordinates
        if (where[0].indexOf("crow(") === 0) {
            var gps_1 = where[0].replace(/crow\((.*)\)/gmi, "$1").split(",").map(function (c, i) { return i < 2 ? parseFloat(c.trim()) : c.trim(); });
            var latTable = "_" + this.q.table + "_idx_" + (gps_1.length > 2 ? gps_1[2] : "lat");
            var lonTable = "_" + this.q.table + "_idx_" + (gps_1.length > 2 ? gps_1[3] : "lon");
            var distance_1 = parseFloat(where[2] || "0");
            // get latitudes that are distance north and distance south from the search point
            var latRange_1 = [-1, 1].map(function (i) {
                return gps_1[0] + ((distance_1 * i) / index_1.NanoSQLInstance.earthRadius) * (180 * Math.PI);
            });
            // get the longitudes that are distance west and distance east from the search point
            var lonRange_1 = [-1, 1].map(function (i) {
                return gps_1[1] + ((distance_1 * i) / index_1.NanoSQLInstance.earthRadius) * (180 * Math.PI) / Math.cos(gps_1[0] * Math.PI / 180);
            });
            // We're getting all rows that are within the latitude OR longitude range.
            // the final result will be a square giving us an approximation of the final result set.
            utilities_1.fastALL([latTable, lonTable], function (table, i, next) {
                var ranges = i === 0 ? latRange_1 : lonRange_1;
                _this.s._rangeRead(table, ranges[0], ranges[1], true, next);
            }).then(function (result) {
                // if the lat or lon results are empty then we have no records that match
                if (!result[0].length || !result[1].length) {
                    callback([]);
                    return;
                }
                // build an array of row primary keys and calculate their distance
                // doesn't calculate distance if row doesn't fit inside the approximation square.
                var rows = {};
                var keys = [];
                [0, 1].forEach(function (i) {
                    result[i].forEach(function (r) {
                        r.rows.forEach(function (pk) {
                            switch (i) {
                                case 0:
                                    rows[pk] = r.id;
                                    break;
                                case 1:
                                    // record is inside the search radius
                                    if (rows[pk] && utilities_1.crowDistance(gps_1[0], gps_1[1], rows[pk], r.id, index_1.NanoSQLInstance.earthRadius) < distance_1) {
                                        keys.push(pk);
                                    }
                                    break;
                            }
                        });
                    });
                });
                // Get the rows
                var pk = _this.qu._store.tableInfo[_this.q.table]._pk;
                _this.s._read(_this.q.table, keys, function (records) {
                    callback(records.map(function (r) { return (__assign({}, r, { _distance: rows[r[pk]] })); }));
                });
            });
            return;
        }
        if (where[1] === "BETWEEN") {
            var secondaryIndexKey = where[0] === this.s.tableInfo[this.q.table]._pk ? "" : where[0];
            if (!Array.isArray(where[2])) {
                throw new Error("nSQL: BETWEEN query must use an array!");
            }
            if (secondaryIndexKey) {
                var idxTable_1 = "_" + this.q.table + "_idx_" + secondaryIndexKey;
                if (this.s._doCache) {
                    var pks = this.s._secondaryIndexes[idxTable_1].idx.filter(function (idx) { return where[2][0] <= idx && where[2][1] >= idx; });
                    var keys_1 = pks.map(function (r) { return _this.s._secondaryIndexes[idxTable_1].rows[r]; }).reverse().reduce(function (prev, cur) {
                        return prev.concat(cur.rows);
                    }, []);
                    this.s._read(this.q.table, keys_1, callback);
                }
                else {
                    this.s._rangeRead(idxTable_1, where[2][0], where[2][1], true, function (rows) {
                        var keys = [];
                        var i = rows.length;
                        while (i--) {
                            keys = keys.concat(rows[i].rows);
                        }
                        _this.s._read(_this.q.table, keys, callback);
                    });
                }
            }
            else {
                this.s._rangeRead(this.q.table, where[2][0], where[2][1], true, function (rows) {
                    callback(rows);
                });
            }
            return;
        }
        var keys = [];
        var condition = "";
        switch (where[1]) {
            case "IN":
                keys = where[2];
                if (!Array.isArray(keys)) {
                    throw new Error("nSQL: IN query must use array!");
                }
                condition = "=";
                break;
            case "=":
            case ">":
            case ">=":
            case "<":
            case "<=":
                keys = [where[2]];
                condition = where[1];
                break;
        }
        if (where[0] === this.s.tableInfo[this.q.table]._pk) { // primary key select
            if (condition === "=") {
                this.s._read(this.q.table, keys, callback);
            }
            else {
                this.s.adapters[0].adapter.getIndex(this.q.table, false, function (index) {
                    var searchVal = keys[0];
                    var getPKs = index.filter(function (val) {
                        switch (condition) {
                            case ">": return val > searchVal;
                            case ">=": return val >= searchVal;
                            case "<": return val < searchVal;
                            case "<=": return val <= searchVal;
                        }
                        return false;
                    });
                    if (!getPKs.length) {
                        callback([]);
                        return;
                    }
                    _this.s._read(_this.q.table, getPKs, callback);
                });
            }
        }
        else { // secondary index select
            utilities_1.fastALL(keys, function (idx, i, complete) {
                _this.s._secondaryIndexRead(_this.q.table, condition, where[0], idx, complete);
            }).then(function (rows) {
                callback([].concat.apply([], rows));
            });
        }
    };
    /**
     * Select rows within a numerical range using limit and offset values.
     * Negative limit values will start the range from the bottom of the table.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _RowSelection
     */
    // [limit, offset]
    _RowSelection.prototype._selectByRange = function (callback) {
        var _this = this;
        if (this.q.range) {
            var r_1 = this.q.range;
            if (r_1[0] > 0) { // positive limit value, we can send this straight to the adapter
                this.s._rangeRead(this.q.table, r_1[1], (r_1[1] + r_1[0]) - 1, false, callback);
            }
            else { // using negative limit value to get rows at the end of the database.
                this.s.adapters[0].adapter.getIndex(this.q.table, true, function (count) {
                    var fromIdx = count + r_1[0] - r_1[1];
                    var toIdx = fromIdx;
                    var counter = Math.abs(r_1[0]) - 1;
                    while (counter--) {
                        toIdx++;
                    }
                    _this.s._rangeRead(_this.q.table, fromIdx, toIdx, false, callback);
                });
            }
        }
        else {
            callback([]);
        }
    };
    /**
     * Select rows based on a Trie Query.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _RowSelection
     */
    _RowSelection.prototype._selectByTrie = function (callback) {
        if (this.q.trie) {
            this.s._trieRead(this.q.table, this.q.trie.column, this.q.trie.search, callback);
        }
        else {
            callback([]);
        }
    };
    /**
     * Do a full table scan, checking every row against the WHERE statement.
     *
     * @internal
     * @param {(rows: DBRow[]) => void} callback
     * @memberof _RowSelection
     */
    _RowSelection.prototype._fullTableScan = function (callback) {
        var _this = this;
        var hasWhere = this.q.where !== undefined;
        var arrWhere = hasWhere && Array.isArray(this.q.where);
        var PK = this.s.tableInfo[this.q.table]._pk;
        var arraySearchCache = [];
        var rowCache = [];
        var scanTable = function () {
            _this.s._read(_this.q.table, function (row, i, keep) {
                if (!hasWhere) { // no where statement
                    keep(true);
                    return;
                }
                if (arrWhere) { // where is array
                    keep(_where(row, _this.q.where, i, false, arraySearchCache, PK));
                }
                else { // where is function
                    keep(_this.q.where(row, i));
                }
            }, callback);
        };
        var where = this.q.where || [];
        if (arrWhere && typeof where[0] !== "string") { // array and compount where
            // compound where, handle search() queries inside an unoptimized query.
            utilities_1.fastCHAIN(where, function (wAr, i, done) {
                if (wAr[0].indexOf("search(") === -1) {
                    done();
                    return;
                }
                // perform optimized search query, then store the results to compare aginst the rest of the .where() conditions
                _this.qu._store._nsql.query("select").where(wAr).manualExec({ table: _this.q.table }).then(function (rows) {
                    arraySearchCache[i] = rows.map(function (r) { return r[PK]; });
                    done();
                });
            }).then(function () {
                scanTable();
            });
        }
        else {
            scanTable();
        }
    };
    /**
     * Given a compound where statement like [[value, =, key], AND, [something, =, something]]
     * Check if first where conditions are primary key/ secondary index followed by unoptimized/unindexed conditions
     *
     * In this case we can grab the primary key/secondary index query from the database and do a faster query on the smaller result set.
     *
     * Returns 0 if this isn't a suboptimized where condition.
     * Returns the index of the where array where the AND splits between optimized and unoptimized conditions otherwise.
     *
     * @private
     * @param {any[]} wArgs
     * @returns {number}
     * @memberof _RowSelection
     */
    _RowSelection.prototype._isSubOptimizedWhere = function (wArgs) {
        var _this = this;
        if (typeof wArgs[0] === "string") { // not compound where
            return 0;
        }
        if (this._isOptimizedWhere(wArgs[0]) === 0) { // at least first value is optimized
            // last primary key/secondary index condition MUST be followed by AND
            var lastCheck_1 = 0;
            wArgs.forEach(function (wArg, i) {
                if (i % 2 === 0) {
                    if (_this._isOptimizedWhere(wArg) === 0 && wArgs[i + 1]) {
                        lastCheck_1 = i + 1;
                    }
                }
            });
            // AND must follow the last secondary index/primary key condition
            if (wArgs[lastCheck_1] !== "AND")
                return 0;
            return lastCheck_1;
        }
        return 0;
    };
    /**
     * Checks if a single WHERE statement ["row", "=", value] uses a primary key or secondary index as it's row.
     * If so, we can use a much faster SELECT method.
     *
     * @internal
     * @param {any[]} wArgs
     * @returns {number}
     * @memberof _RowSelection
     */
    _RowSelection.prototype._isOptimizedWhere = function (wArgs) {
        var tableData = this.s.tableInfo[this.q.table];
        var wQuery = wArgs[0] || "";
        var wCondition = wArgs[1] || "";
        if (Array.isArray(wQuery)) { // nested where statement
            return 0;
        }
        // is a valid crow query with secondary indexes
        if (wQuery.indexOf("crow(") !== 1 && wCondition === "<") {
            var crowArgs = wQuery.replace(/crow\((.*)\)/gmi, "$1").split(",").map(function (c) { return c.trim(); });
            var latTable = crowArgs[2] || "lat";
            var lonTable = crowArgs[3] || "lon";
            if (tableData._secondaryIndexes.indexOf(latTable) === -1 || tableData._secondaryIndexes.indexOf(lonTable) === -1)
                return 1;
            return 0;
        }
        // is a valid search query
        if (wQuery.indexOf("search(") !== -1 && ["=", ">", "<"].reduce(function (p, c) { return p + wArgs[1].indexOf(c); }, 0) !== -3) {
            var searchArgs = wQuery.replace(/search\((.*)\)/gmi, "$1").split(",").map(function (c) { return c.trim(); });
            // all search columns are indexed
            if (searchArgs.filter(function (s) { return Object.keys(tableData._searchColumns).indexOf(s) !== -1; }).length) {
                return 0;
            }
            return 1;
        }
        // primary or secondary index with valid where condition
        if (wQuery === tableData._pk || tableData._secondaryIndexes.indexOf(wQuery) !== -1) {
            if (["=", "IN", "BETWEEN", ">", ">=", "<", "<="].indexOf(wArgs[1]) > -1)
                return 0;
            return 1;
        }
        return 1;
    };
    return _RowSelection;
}());
exports._RowSelection = _RowSelection;
/**
 * Select rows from an instance table. Supports RANGE and WHERE statements.
 *
 * @export
 * @class InstanceSelection
 */
var InstanceSelection = /** @class */ (function () {
    function InstanceSelection(q, p) {
        this.q = q;
        this.p = p;
    }
    InstanceSelection.prototype.getRows = function (callback) {
        var _this = this;
        if (this.q.join || this.q.orm || this.q.trie) {
            throw new Error("nSQL: Cannot do a JOIN, ORM or TRIE command with instance table!");
        }
        if (this.q.range && this.q.range.length) { // range select [limit, offset]
            var range = this.q.range, from_1, to_1;
            if (range[0] < 0) {
                from_1 = (this.q.table.length) + range[0] - range[1];
            }
            else {
                from_1 = range[1];
            }
            var cnt = Math.abs(range[0]) - 1;
            to_1 = from_1;
            while (cnt--) {
                to_1++;
            }
            callback(this.q.table.filter(function (val, idx) {
                return idx >= from_1 && idx <= to_1;
            }));
            return;
        }
        callback(this.q.table.filter(function (row, i) {
            if (_this.q.where) {
                return Array.isArray(_this.q.where) ? _where(row, _this.q.where || [], i, false) : _this.q.where(row, i);
            }
            return true;
        }));
    };
    return InstanceSelection;
}());
exports.InstanceSelection = InstanceSelection;
/**
 * Handles WHERE statements, combining multiple compared statements aginst AND/OR as needed to return a final boolean value.
 * The final boolean value is wether the row matches the WHERE conditions or not.
 *
 * @param {*} singleRow
 * @param {any[]} where
 * @param {number} rowIDX
 * @param {boolean} [ignoreFirstPath]
 * @returns {boolean}
 */
var _where = function (singleRow, where, rowIDX, ignoreFirstPath, searchCache, pk) {
    if (typeof where[0] !== "string") { // compound where statements
        var hasOr_1 = where.indexOf("OR") !== -1;
        var decided_1;
        var prevCondition_1;
        return where.reduce(function (prev, wArg, idx) {
            if (decided_1 !== undefined)
                return decided_1;
            if (idx % 2 === 1) {
                prevCondition_1 = wArg;
                return prev;
            }
            var compareResult = false;
            if (wArg[0].indexOf("search(") === 0 && searchCache) {
                compareResult = searchCache[idx].indexOf(singleRow[pk]) !== -1;
            }
            else if (Array.isArray(wArg[0])) {
                compareResult = _where(singleRow, wArg, rowIDX, ignoreFirstPath || false, searchCache, pk);
            }
            else {
                compareResult = _compare(wArg, singleRow, ignoreFirstPath || false);
            }
            // if all conditions are "AND" we can stop checking on the first false result
            if (!hasOr_1 && compareResult === false) {
                decided_1 = false;
                return decided_1;
            }
            if (idx === 0)
                return compareResult;
            if (prevCondition_1 === "AND") {
                return prev && compareResult;
            }
            else {
                return prev || compareResult;
            }
        }, false);
    }
    else { // single where statement
        return _compare(where, singleRow, ignoreFirstPath || false);
    }
};
var likeCache = {};
var whereFuncCache = {};
/**
 * Compare function used by WHERE to determine if a given value matches a given condition.
 *
 * Accepts single where arguments (compound arguments not allowed).
 *
 *
 * @param {*} val1
 * @param {string} compare
 * @param {*} val2
 * @returns {boolean}
 */
var _compare = function (where, wholeRow, isJoin) {
    if (!whereFuncCache[where[0]]) {
        // "levenshtein(word, column)"" => ["levenshtein", "word", "column"]
        // "crow(-49, 29, lat_main, lon_main)" => ["crow", -49, 29, "lat_main", "lon_main"]
        // notAFunction => []
        whereFuncCache[where[0]] = where[0].indexOf("(") !== -1 ?
            where[0].replace(/(.*)\((.*)\)/gmi, "$1,$2").split(",").map(function (c) { return isNaN(c) ? c.trim() : parseFloat(c.trim()); })
            : [];
    }
    var processLIKE = function (columnValue, givenValue) {
        if (!likeCache[givenValue]) {
            var prevChar_1 = "";
            likeCache[givenValue] = new RegExp(givenValue.split("").map(function (s) {
                if (prevChar_1 === "\\") {
                    prevChar_1 = s;
                    return s;
                }
                prevChar_1 = s;
                if (s === "%")
                    return ".*";
                if (s === "_")
                    return ".";
                return s;
            }).join(""), "gmi");
        }
        if (typeof columnValue !== "string") {
            if (typeof columnValue === "number") {
                return String(columnValue).match(likeCache[givenValue]) !== null;
            }
            else {
                return JSON.stringify(columnValue).match(likeCache[givenValue]) !== null;
            }
        }
        return columnValue.match(likeCache[givenValue]) !== null;
    };
    var givenValue = where[2];
    var compare = where[1];
    var columnValue = (function () {
        if (whereFuncCache[where[0]].length) {
            var whereFn = index_1.NanoSQLInstance.whereFunctions[whereFuncCache[where[0]][0]];
            if (whereFn) {
                return whereFn.apply(null, [wholeRow, isJoin].concat(whereFuncCache[where[0]].slice(1)));
            }
            return undefined;
        }
        else {
            return utilities_1.objQuery(where[0], wholeRow, isJoin);
        }
    })();
    if (givenValue === "NULL" || givenValue === "NOT NULL") {
        var isNull = [undefined, null, ""].indexOf(columnValue) !== -1;
        var isEqual = compare === "=" || compare === "LIKE";
        switch (givenValue) {
            case "NULL": return isEqual ? isNull : !isNull;
            case "NOT NULL": return isEqual ? !isNull : isNull;
        }
    }
    if (["IN", "BETWEEN", "INTERSECT", "INTERSECT ALL", "NOT INTERSECT"].indexOf(compare) !== -1) {
        if (!Array.isArray(givenValue)) {
            throw new Error("nSQL: " + compare + " requires an array value!");
        }
    }
    switch (compare) {
        // if column equal to given value
        case "=": return columnValue === givenValue;
        // if column not equal to given value
        case "!=": return columnValue !== givenValue;
        // if column greather than given value
        case ">": return columnValue > givenValue;
        // if column less than given value
        case "<": return columnValue < givenValue;
        // if column less than or equal to given value
        case "<=": return columnValue <= givenValue;
        // if column greater than or equal to given value
        case ">=": return columnValue >= givenValue;
        // if column value exists in given array
        case "IN": return (givenValue || []).indexOf(columnValue) !== -1;
        // if column does not exist in given array
        case "NOT IN": return (givenValue || []).indexOf(columnValue) === -1;
        // regexp search the column
        case "REGEXP":
        case "REGEX": return (columnValue || "").match(givenValue) !== null;
        // if given value exists in column value
        case "LIKE": return processLIKE((columnValue || ""), givenValue);
        // if given value does not exist in column value
        case "NOT LIKE": return !processLIKE((columnValue || ""), givenValue);
        // if the column value is between two given numbers
        case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] >= columnValue;
        // if single value exists in array column
        case "HAVE": return (columnValue || []).indexOf(givenValue) !== -1;
        // if single value does not exist in array column
        case "NOT HAVE": return (columnValue || []).indexOf(givenValue) === -1;
        // if array of values intersects with array column
        case "INTERSECT": return (columnValue || []).filter(function (l) { return (givenValue || []).indexOf(l) > -1; }).length > 0;
        // if every value in the provided array exists in the array column
        case "INTERSECT ALL": return (columnValue || []).filter(function (l) { return (givenValue || []).indexOf(l) > -1; }).length === givenValue.length;
        // if array of values does not intersect with array column
        case "NOT INTERSECT": return (columnValue || []).filter(function (l) { return (givenValue || []).indexOf(l) > -1; }).length === 0;
        default: return false;
    }
};
//# sourceMappingURL=query.js.map