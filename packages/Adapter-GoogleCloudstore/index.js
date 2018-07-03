var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var lie_ts_1 = require("lie-ts");
var utilities_1 = require("nano-sql/lib/utilities");
var db_idx_1 = require("nano-sql/lib/database/db-idx");
var Datastore = require("@google-cloud/datastore");
var GDatastoreAdapter = (function () {
    function GDatastoreAdapter(args) {
        this._pkKey = {};
        this._dbIndex = {};
        this._dbColumns = {};
        this._doStrong = args.strongConsistency || false;
        this._distributedMode = args.distributedMode || false;
        this._dataStore = new Datastore(args);
    }
    GDatastoreAdapter.prototype.connect = function (complete) {
        var _this = this;
        if (this._distributedMode) {
            complete();
            return;
        }
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            _this._getIndexFromGoogle(table, function (idx) {
                if (idx.length) {
                    _this._dbIndex[table].set(idx.map(function (i) { return String(i); }));
                }
                done();
            });
        }).then(complete);
    };
    GDatastoreAdapter.prototype.setID = function (id) {
        this._id = id;
    };
    GDatastoreAdapter.prototype.makeTable = function (tableName, dataModels) {
        var _this = this;
        this._dbIndex[tableName] = new db_idx_1.DatabaseIndex();
        this._dbColumns[tableName] = [];
        dataModels.forEach(function (d) {
            if (d.props && utilities_1.intersect(["pk", "pk()"], d.props)) {
                _this._dbIndex[tableName].pkType = d.type;
                _this._pkKey[tableName] = d.key;
                if (d.props && utilities_1.intersect(["ai", "ai()"], d.props) && (d.type === "int" || d.type === "number")) {
                    _this._dbIndex[tableName].doAI = true;
                }
                if (d.props && utilities_1.intersect(["ns", "ns()"], d.props) || ["uuid", "timeId", "timeIdms"].indexOf(_this._dbIndex[tableName].pkType) !== -1) {
                    _this._dbIndex[tableName].sortIndex = false;
                }
            }
        });
    };
    GDatastoreAdapter.prototype.write = function (table, pk, data, complete) {
        var _this = this;
        pk = pk || utilities_1.generateID(this._dbIndex[table].pkType, this._dbIndex[table].ai);
        if (!pk) {
            throw Error("Can't add a row without a primary key!");
        }
        if (!this._distributedMode && this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
        }
        var r = __assign({}, data, (_a = {}, _a[this._pkKey[table]] = pk, _a));
        var d = {
            key: this._dataStore.key({
                namespace: this._id,
                path: [table, String(pk)]
            }),
            data: Object.keys(r).map(function (k) { return ({
                name: k,
                value: (r[k] === undefined || r[k] === null) ? "" : r[k],
                excludeFromIndexes: k !== _this._pkKey[table]
            }); })
        };
        this.doRetry(new utilities_1.Promise(function (res, rej) {
            _this._dataStore.save(d, function (err) {
                if (err) {
                    rej(err);
                }
                else {
                    res();
                }
            });
        })).then(function () {
            complete(r);
        }).catch(function (err) {
            throw err;
        });
        var _a;
    };
    GDatastoreAdapter.prototype.delete = function (table, pk, complete) {
        var _this = this;
        var idx = this._dbIndex[table].indexOf(pk);
        this.doRetry(new utilities_1.Promise(function (res, rej) {
            _this._dataStore.delete(_this._dataStore.key({
                namespace: _this._id,
                path: [table, String(pk)]
            }), function (err) {
                if (err) {
                    rej(err);
                }
                else {
                    if (!_this._distributedMode && idx !== -1) {
                        _this._dbIndex[table].remove(pk);
                    }
                    res();
                }
            });
        })).then(function () {
            complete();
        }).catch(function (err) {
            throw err;
        });
    };
    GDatastoreAdapter.prototype._clean = function (table, row) {
        var obj = {};
        var i = this._dbColumns[table].length;
        while (i--) {
            obj[this._dbColumns[table][i]] = row[this._dbColumns[table][i]];
        }
        return obj;
    };
    GDatastoreAdapter.prototype.batchRead = function (table, pks, callback) {
        var _this = this;
        var keys = pks.map(function (pk) { return _this._dataStore.key({
            namespace: _this._id,
            path: [table, String(pk)]
        }); });
        this.doRetry(new utilities_1.Promise(function (res, rej) {
            _this._dataStore.get(keys, function (err, entities) {
                if (err) {
                    rej(err);
                    return;
                }
                res(entities.map(function (e) { return _this._clean(table, e); }));
            });
        })).then(function (entity) {
            callback(entity);
        }).catch(function (err) {
            throw err;
        });
    };
    GDatastoreAdapter.prototype.read = function (table, pk, callback) {
        var _this = this;
        if (!this._distributedMode && this._dbIndex[table].indexOf(pk) === -1) {
            callback(null);
            return;
        }
        this.doRetry(new utilities_1.Promise(function (res, rej) {
            _this._dataStore.get(_this._dataStore.key({
                namespace: _this._id,
                path: [table, String(pk)]
            }), function (err, entity) {
                if (err) {
                    rej(err);
                    return;
                }
                res(_this._clean(table, entity));
            });
        })).then(function (entity) {
            callback(entity);
        }).catch(function (err) {
            throw err;
        });
    };
    GDatastoreAdapter.prototype.doRetry = function (doThis, maxRetries) {
        return new utilities_1.Promise(function (res, rej) {
            var retries = 0;
            var runThis = function () {
                doThis.then(res).catch(function (err) {
                    if (retries > (maxRetries || 2)) {
                        rej(err);
                    }
                    else {
                        setTimeout(function () {
                            retries++;
                            runThis();
                        }, retries * 50);
                    }
                });
            };
            runThis();
        });
    };
    GDatastoreAdapter.prototype._pkRangeRead = function (table, rowCallback, complete, from, to) {
        var _this = this;
        var rows = [];
        this.doRetry(new utilities_1.Promise(function (res, rej) {
            var q = _this._dataStore.createQuery(_this._id, table);
            q.order(_this._pkKey[table]);
            if (from || to) {
                q.filter(_this._pkKey[table], ">=", from).filter(_this._pkKey[table], "<=", to);
            }
            _this._dataStore.runQueryStream(q, _this._doStrong ? undefined : { consistency: "eventual" })
                .on("data", function (entity) {
                rows.push(_this._clean(table, entity));
            })
                .on("end", res)
                .on("error", rej);
        })).then(function () {
            var i = 0;
            var getRow = function () {
                if (i < rows.length) {
                    rowCallback(rows[i], i, function () {
                        i++;
                        i > 1000 ? lie_ts_1.setFast(getRow) : getRow();
                    });
                }
                else {
                    complete();
                }
            };
            getRow();
        }).catch(function (err) {
            throw err;
        });
    };
    GDatastoreAdapter.prototype._offsetRangeRead = function (table, rowCallback, complete, from, to) {
        var _this = this;
        var rows = [];
        var pkIsNum = ["int", "float", "number"].indexOf(this._dbIndex[table].pkType) !== -1;
        var pk = this._pkKey[table];
        this.doRetry(new utilities_1.Promise(function (res, rej) {
            _this.getIndex(table, false, function (idx) {
                var PKs = idx.map(function (k) { return pkIsNum ? parseFloat(k) : k; }).filter(function (k, i) {
                    return i >= from && i <= to;
                }).sort(function (a, b) { return a > b ? 1 : -1; });
                var pageNum = 0;
                var perPage = 250;
                var getBatch = function () {
                    var start = pageNum * perPage;
                    var end = start + perPage;
                    var getKeys = PKs.filter(function (k, i) { return i >= start && i < end; }).map(function (pk) { return _this._dataStore.key({
                        namespace: _this._id,
                        path: [table, String(pk)]
                    }); });
                    if (!getKeys.length) {
                        res();
                        return;
                    }
                    _this._dataStore.get(getKeys, function (err, entities) {
                        if (err) {
                            rej(err);
                            return;
                        }
                        var i = 0;
                        var rows = entities.map(function (e) { return _this._clean(table, e); }).sort(function (a, b) { return a[pk] > b[pk] ? 1 : -1; });
                        var getRow = function () {
                            if (i < rows.length) {
                                rowCallback(rows[i], i + (pageNum * perPage), function () {
                                    i++;
                                    getRow();
                                });
                            }
                            else {
                                pageNum++;
                                getBatch();
                            }
                        };
                        getRow();
                    });
                };
                getBatch();
            });
        })).then(complete);
    };
    GDatastoreAdapter.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
        var usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        if (usePK && usefulValues) {
            this._pkRangeRead(table, rowCallback, complete, from, to);
        }
        else if (usefulValues) {
            this._offsetRangeRead(table, rowCallback, complete, from, to);
        }
        else {
            this._pkRangeRead(table, rowCallback, complete);
        }
    };
    GDatastoreAdapter.prototype.drop = function (table, callback) {
        var _this = this;
        this.rangeRead(table, function (row, idx, next) {
            _this._dataStore.delete(_this._dataStore.key({
                namespace: _this._id,
                path: [table, String(row[_this._pkKey[table]])]
            }), next);
        }, function () {
            var idx = new db_idx_1.DatabaseIndex();
            idx.doAI = _this._dbIndex[table].doAI;
            _this._dbIndex[table] = idx;
            callback();
        });
    };
    GDatastoreAdapter.prototype._getIndexFromGoogle = function (table, complete) {
        var _this = this;
        this.doRetry(new utilities_1.Promise(function (res, rej) {
            var q = _this._dataStore.createQuery(_this._id, table);
            q
                .select('__key__')
                .run(_this._doStrong ? undefined : { consistency: "eventual" }).then(function (entities) {
                res(entities[0].map(function (e) { return e[_this._dataStore.KEY].name; }));
            }).catch(rej);
        }))
            .then(complete)
            .catch(function (err) {
            throw err;
        });
    };
    GDatastoreAdapter.prototype.getIndex = function (table, getLength, complete) {
        if (this._distributedMode) {
            this._getIndexFromGoogle(table, function (idx) {
                complete(getLength ? idx.length : idx);
            });
        }
        else {
            complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
        }
    };
    GDatastoreAdapter.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            var pk = _this._pkKey[table];
            _this._dataStore.createQuery(_this._id, table).select('__key__').run().then(function (entities) {
                utilities_1.fastALL(entities[0].map(function (e) { return e[_this._dataStore.KEY].name; }), function (primaryKey, i, delDone) {
                    _this.delete(table, primaryKey, delDone);
                }).then(done);
            });
        }).then(function () {
            complete();
        });
    };
    return GDatastoreAdapter;
}());
exports.GDatastoreAdapter = GDatastoreAdapter;
