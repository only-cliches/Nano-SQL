"use strict";
var index_1 = require("./index");
var typescript_promise_1 = require("typescript-promise");
var typescript_map_1 = require("typescript-map");
var someSQL_MemDB = (function () {
    function someSQL_MemDB() {
        var t = this;
        t._tables = new typescript_map_1.tsMap();
        t._tIndex = new typescript_map_1.tsMap();
        t._models = new typescript_map_1.tsMap();
        t._tCacheI = new typescript_map_1.tsMap();
        t._immu = new typescript_map_1.tsMap();
        t._i = new typescript_map_1.tsMap();
    }
    someSQL_MemDB.prototype.connect = function (models, callback) {
        var t = this;
        models.forEach(function (model, table) {
            t._newModel(table, model);
        });
        callback();
    };
    someSQL_MemDB.prototype._newModel = function (table, args) {
        this._models.set(table, args);
        this._tables.set(table, []);
        this._tIndex.set(table, []);
        this._i.set(table, 1);
    };
    someSQL_MemDB.prototype.exec = function (table, query, onSuccess, onFail) {
        var t = this;
        t._sT = table;
        t._mod = [];
        t._act = null;
        t._cacheKey = index_1.someSQL_Instance.hash(JSON.stringify(query));
        typescript_promise_1.tsPromise.all(query.map(function (q) {
            return new typescript_promise_1.tsPromise(function (resolve, reject) {
                t._query(q, resolve);
            });
        })).then(function () {
            t._exec(onSuccess);
        });
    };
    someSQL_MemDB.prototype._query = function (queryArg, resolve) {
        if (['upsert', 'select', 'delete', 'drop'].indexOf(queryArg.get("type")) != -1) {
            this._act = queryArg;
        }
        if (['where', 'orderby', 'limit', 'offset', 'andWhere', 'orWhere'].indexOf(queryArg.get("type")) != -1) {
            this._mod.push(queryArg);
        }
        resolve();
    };
    someSQL_MemDB.prototype._exec = function (callBack) {
        var t = this;
        switch (t._act.get('type')) {
            case "upsert":
                var msg_1 = 0;
                var cacheInvalidate_1 = function (index) {
                    t._tCacheI.forEach(function (v, key2) {
                        if (v && v.indexOf(index) != -1) {
                            t._tCacheI.delete(key2);
                            t._immu.delete(key2);
                        }
                    });
                };
                var hasWhere = t._mod.filter(function (v) {
                    return ['where', 'andWhere', 'orWhere'].indexOf(v.get('type')) == -1 ? false : true;
                });
                if (hasWhere.length) {
                    var rows_1 = t._where(t._tIndex.get(t._sT));
                    var ta_1 = t._tables.get(t._sT);
                    rows_1.forEach(function (v, k) {
                        for (var key in t._act.get('args')) {
                            ta_1[v][key] = t._act.get('args')[key];
                        }
                        cacheInvalidate_1(k);
                        msg_1++;
                    });
                }
                else {
                    var key_1 = "";
                    t._models.get(t._sT).forEach(function (m) {
                        if (m['type'] == 'uuid' && !t._act.get('args')[m['key']]) {
                            t._act.get('args')[m['key']] = index_1.someSQL_Instance.uuid();
                        }
                        if (m['props'] && m['props'].indexOf('pk') != -1) {
                            key_1 = m['key'];
                            if (m['props'].indexOf('ai') != -1 && !t._act.get('args')[m['key']]) {
                                t._act.get('args')[m['key']] = t._i.get(t._sT);
                                t._i.set(t._sT, t._i.get(t._sT) + 1);
                            }
                        }
                    });
                    var i = t._act.get('args')[key_1];
                    if (t._tIndex.get(t._sT).indexOf(i) == -1) {
                        t._tIndex.get(t._sT).push(i);
                    }
                    else {
                        cacheInvalidate_1(i);
                    }
                    t._tables.get(t._sT)[i] = t._act.get('args');
                    msg_1++;
                }
                callBack(msg_1 + " row(s) upserted");
                break;
            case "select":
                if (!t._immu.has(t._cacheKey)) {
                    var ta_2 = t._tables.get(t._sT);
                    t._tCacheI.set(t._cacheKey, []);
                    t._immu.set(t._cacheKey, JSON.parse(JSON.stringify(t._where(t._tIndex.get(t._sT))
                        .sort(function (a, b) {
                        return t._mod.filter(function (v) {
                            return v['type'] == 'orderby';
                        }).map(function (v) {
                            for (var prop in v.get('args')) {
                                if (ta_2[a][prop] == ta_2[b][prop])
                                    return 0;
                                var result = ta_2[a][prop] > ta_2[b][prop] ? 1 : -1;
                                return v.get('args')[prop] == 'asc' ? result : -result;
                            }
                        }).reduce(function (c, d) { return c + d; }, 0) || 0;
                    })
                        .filter(function (v, k) {
                        var os = 0;
                        return !t._mod.filter(function (f) {
                            return ['limit', 'offset'].indexOf(f['type']) != -1;
                        }).sort(function (a, b) {
                            return a['type'] < b['type'] ? 1 : -1;
                        }).map(function (f, i) {
                            switch (f['type']) {
                                case "offset":
                                    os = f.get('args');
                                    return k >= f.get('args') ? 0 : 1;
                                case "limit": return k < (os + f.get('args')) ? 0 : 1;
                            }
                        }).reduce(function (c, d) { return c + d; }, 0);
                    })
                        .map(function (v, k) {
                        t._tCacheI.get(t._cacheKey).push(k);
                        if (t._act.get('args') && t._act.get('args').length) {
                            var obj_1 = JSON.parse(JSON.stringify(ta_2[v]));
                            t._models.get(t._sT).forEach(function (m) {
                                if (t._act.get('args').indexOf(m['key']) == -1) {
                                    delete obj_1[m['key']];
                                }
                            });
                            return obj_1;
                        }
                        else {
                            return ta_2[v];
                        }
                    }))));
                }
                callBack(t._immu.get(t._cacheKey));
                break;
            case "delete":
                var rows = t._where(t._tIndex.get(t._sT));
                var ta_3 = t._tables.get(t._sT);
                rows.forEach(function (v, k) {
                    delete ta_3[v];
                    t._tIndex.get(t._sT).splice(t._tIndex.get(t._sT).indexOf(v), 1);
                    t._tCacheI.forEach(function (val, key2) {
                        if (val && val.indexOf(v) != -1) {
                            t._tCacheI.delete(key2);
                            t._immu.delete(key2);
                        }
                    });
                });
                callBack(rows.length + " row(s) deleted");
                break;
            case "drop":
                t._tables.set(t._sT, []);
                t._tIndex.set(t._sT, []);
                t._i.set(t._sT, 1);
                callBack('Success');
                break;
        }
    };
    someSQL_MemDB.prototype._where = function (tableIndexes) {
        var t = this;
        var ta = t._tables.get(t._sT);
        return tableIndexes.filter(function (v, k) {
            var andWhere = [];
            t._mod.filter(function (f) {
                return f.get('type') == 'andWhere';
            }).forEach(function (f) {
                f.get('args').forEach(function (f2) {
                    andWhere.push({
                        type: 'where',
                        args: f2
                    });
                });
            });
            return t._mod.filter(function (f) {
                return f.get('type') == 'where';
            }).concat(andWhere).map(function (f) {
                return t._models.get(t._sT).map(function (m) {
                    return m['key'] == f.get('args')[0] ? t._compare(f.get('args')[2], f.get('args')[1], ta[v][m['key']]) : 0;
                }).reduce(function (a, b) { return a + b; }, 0);
            }).reduce(function (a, b) { return a + b; }, 0) == 0 ? true : false;
        }).filter(function (index) {
            var ors = [];
            t._mod.map(function (mo) {
                if (mo['type'] == 'orWhere') {
                    mo['args'].forEach(function (a) {
                        ors.push(a);
                    });
                }
            });
            if (ors.length == 0)
                return true;
            return t._models.get(t._sT).map(function (m) {
                return ors.filter(function (arg) {
                    return t._compare(arg[2], arg[1], ta[index][m['key']]) == 1 ? false : true;
                }).length;
            }).filter(function (f) { return f > 0; }).length > 0 ? true : false;
        });
    };
    someSQL_MemDB.prototype._compare = function (val1, compare, val2) {
        switch (compare) {
            case "=": return val2 == val1 ? 0 : 1;
            case ">": return val2 > val1 ? 0 : 1;
            case "<": return val2 < val1 ? 0 : 1;
            case "<=": return val2 <= val1 ? 0 : 1;
            case ">=": return val2 >= val1 ? 0 : 1;
            case "IN": return val1.indexOf(val2) == -1 ? 1 : 0;
            case "NOT IN": return val1.indexOf(val2) == -1 ? 0 : 1;
            case "LIKE": return val2.search(val1) == -1 ? 1 : 0;
            default: return 0;
        }
    };
    return someSQL_MemDB;
}());
exports.someSQL_MemDB = someSQL_MemDB;
