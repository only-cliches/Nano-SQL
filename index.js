"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var typescript_map_1 = require("typescript-map");
var typescript_promise_1 = require("typescript-promise");
var memory_db_ts_1 = require("./memory-db.ts");
var someSQL_Instance = (function () {
    function someSQL_Instance() {
        var t = this;
        t._actions = new typescript_map_1.tsMap();
        t._views = new typescript_map_1.tsMap();
        t._models = new typescript_map_1.tsMap();
        t._query = [];
        t._events = ['change', 'delete', 'upsert', 'drop', 'select', 'error'];
        t._callbacks = new typescript_map_1.tsMap();
        t._callbacks.set("*", new typescript_map_1.tsMap());
        t._events.forEach(function (e) {
            t._callbacks.get("*").set(e, []);
        });
        t._filters = new typescript_map_1.tsMap();
        t._permanentFilters = [];
    }
    someSQL_Instance.prototype.init = function (table) {
        if (table)
            this._selectedTable = table;
        return this;
    };
    someSQL_Instance.prototype.connect = function (backend) {
        var t = this;
        t._backend = backend || new memory_db_ts_1.someSQL_MemDB();
        return new someSQL_Promise(t, function (res, rej) {
            t._backend.connect(t._models, t._actions, t._views, t._filters, res, rej);
        });
    };
    someSQL_Instance.prototype.on = function (actions, callBack) {
        var t = this;
        var l = t._selectedTable;
        if (!t._callbacks.get(l)) {
            t._events.forEach(function (v) {
                t._callbacks.get(l).set(v, []);
            });
        }
        actions.split(' ').forEach(function (a) {
            if (t._events.indexOf(a) != -1) {
                t._callbacks.get(l).get(a).push(callBack);
            }
        });
        return t;
    };
    someSQL_Instance.prototype.off = function (callBack) {
        this._callbacks.forEach(function (tables) {
            tables.forEach(function (actions) {
                actions.filter(function (cBs) {
                    return cBs != callBack;
                });
            });
        });
        return this;
    };
    someSQL_Instance.prototype.alwaysApplyFilter = function (filterName) {
        if (this._permanentFilters.indexOf(filterName) == -1) {
            this._permanentFilters.push(filterName);
        }
        return this;
    };
    someSQL_Instance.prototype.model = function (dataModel) {
        var t = this;
        var l = t._selectedTable;
        t._callbacks.set(l, new typescript_map_1.tsMap());
        t._callbacks.get(l).set("*", []);
        t._events.forEach(function (e) {
            t._callbacks.get(l).set(e, []);
        });
        t._models.set(l, dataModel);
        t._views.set(l, []);
        t._actions.set(l, []);
        return this;
    };
    someSQL_Instance.prototype.views = function (viewArray) {
        this._views.set(this._selectedTable, viewArray);
        return this;
    };
    someSQL_Instance.prototype.getView = function (viewName, viewArgs) {
        var t = this;
        var l = t._selectedTable;
        var selView;
        t._views.get(l).forEach(function (view) {
            if (view.name == viewName) {
                selView = view;
            }
        });
        if (!selView)
            throw Error('View does not exist');
        t._activeActionOrView = viewName;
        return selView.call.apply(t, [t._cleanArgs(selView.args, viewArgs)]);
    };
    someSQL_Instance.prototype._cleanArgs = function (argDeclarations, args) {
        var t = this;
        var l = t._selectedTable;
        var a = {};
        argDeclarations.forEach(function (k) {
            var k2 = k.split(':');
            if (k2.length > 1) {
                a[k2[0]] = t._cast(k2[1], args[k2[0]]);
            }
            else {
                a[k2[0]] = args[k2[0]];
            }
        });
        return a;
    };
    someSQL_Instance.prototype._cast = function (type, val) {
        switch (['string', 'int', 'float', 'array', 'map', 'bool'].indexOf(type)) {
            case 0: return String(val);
            case 1: return parseInt(val);
            case 2: return parseFloat(val);
            case 3:
            case 4: return JSON.parse(JSON.stringify(val));
            case 5: return val == true;
            default: return "";
        }
    };
    someSQL_Instance.prototype.actions = function (actionArray) {
        this._actions.set(this._selectedTable, actionArray);
        return this;
    };
    someSQL_Instance.prototype.doAction = function (actionName, actionArgs) {
        var t = this;
        var l = t._selectedTable;
        var selAction = t._actions.get(l).reduce(function (prev, cur) {
            if (prev != undefined)
                return prev;
            return cur.name == actionName ? cur : undefined;
        });
        if (!selAction)
            throw Error('Action does not exist');
        t._activeActionOrView = actionName;
        return selAction.call.apply(t, [t._cleanArgs(selAction.args, actionArgs)]);
    };
    someSQL_Instance.prototype.addFilter = function (filterName, filterFunction) {
        this._filters.set(filterName, filterFunction);
        return this;
    };
    someSQL_Instance.prototype.query = function (action, args) {
        this._query = [];
        var a = action.toLowerCase();
        if (['select', 'upsert', 'delete', 'drop'].indexOf(a) != -1) {
            this._query.push(new typescript_map_1.tsMap([['type', a], ['args', args]]));
        }
        return this;
    };
    someSQL_Instance.prototype.where = function (args) {
        return this._addCmd('where', args);
    };
    someSQL_Instance.prototype.orderBy = function (args) {
        return this._addCmd('orderby', args);
    };
    someSQL_Instance.prototype.limit = function (args) {
        return this._addCmd('limit', args);
    };
    someSQL_Instance.prototype.offset = function (args) {
        return this._addCmd('offset', args);
    };
    someSQL_Instance.prototype.filter = function (name, args) {
        return this._addCmd('filter-' + name, args);
    };
    someSQL_Instance.prototype._addCmd = function (type, args) {
        this._query.push(new typescript_map_1.tsMap([['type', type], ['args', args]]));
        return this;
    };
    someSQL_Instance.prototype.exec = function () {
        var t = this;
        var _t = t._selectedTable;
        t._triggerEvents = t._query.map(function (q) {
            switch (q.get('type')) {
                case "select": return [q.get('type')];
                case "delete":
                case "upsert":
                case "drop": return [q.get('type'), 'change'];
                default: return [];
            }
        }).reduce(function (a, b) { return a.concat(b); });
        var triggerEvents = function (eventData) {
            t._triggerEvents.forEach(function (e) {
                t._callbacks.get(_t).get(e).concat(t._callbacks.get(_t).get("*")).forEach(function (cb) {
                    eventData['name'] = e;
                    eventData['actionOrView'] = t._activeActionOrView;
                    cb.apply(t, [eventData]);
                });
            });
            t._activeActionOrView = undefined;
        };
        return new someSQL_Promise(t, function (res, rej) {
            var _tEvent = function (data, callBack, isError) {
                if (t._permanentFilters.length && isError != true) {
                    data = t._permanentFilters.reduce(function (prev, cur, i) {
                        return t._filters.get(t._permanentFilters[i]).apply(t, [data]);
                    }, data);
                }
                triggerEvents({
                    table: _t,
                    query: t._query.map(function (q) { return q.toJSON(); }),
                    time: new Date().getTime(),
                    result: data
                });
                callBack(data);
            };
            t._backend.exec(_t, t._query, t._activeActionOrView, function (rows) {
                _tEvent(rows, res, false);
            }, function (err) {
                t._triggerEvents = ['error'];
                _tEvent(err, rej, true);
            });
        });
    };
    someSQL_Instance.prototype.custom = function (argType, args) {
        var t = this;
        return new someSQL_Promise(t, function (res, rej) {
            if (t._backend.custom) {
                t._backend.custom.apply(t, [argType, args, res, rej]);
            }
            else {
                res();
            }
        });
    };
    someSQL_Instance.prototype.loadJS = function (rows) {
        var t = this;
        return typescript_promise_1.tsPromise.all(rows.map(function (row) {
            return t.init(t._selectedTable).query('upsert', row).exec();
        }));
    };
    someSQL_Instance.prototype.loadCSV = function (csv) {
        var t = this;
        var fields = [];
        return new someSQL_Promise(t, function (res, rej) {
            typescript_promise_1.tsPromise.all(csv.split('\n').map(function (v, k) {
                return new someSQL_Promise(t, function (resolve, reject) {
                    if (k == 0) {
                        fields = v.split(',');
                        resolve();
                    }
                    else {
                        var record_1 = {};
                        var row_1 = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g).map(function (str) { return str.replace(/^"(.+(?="$))"$/, '$1'); });
                        fields.forEach(function (f, i) {
                            if (row_1[i].indexOf('{') == 0 || row_1[i].indexOf('[') == 0) {
                                row_1[i] = JSON.parse(row_1[i].replace(/'/g, '"'));
                            }
                            record_1[f] = row_1[i];
                        });
                        t.init(t._selectedTable).query('upsert', row_1).exec().then(function () {
                            resolve();
                        });
                    }
                });
            })).then(function () {
                res();
            });
        });
    };
    someSQL_Instance.prototype.toCSV = function (headers) {
        var t = this;
        return new someSQL_Promise(t, function (res, rej) {
            t.exec().then(function (json) {
                var header = t._query.filter(function (q) {
                    return q.get('type') == 'select';
                }).map(function (q) {
                    return q.get('args') ? q.get('args').map(function (m) {
                        return t._models.get(t._selectedTable).filter(function (f) { return f['key'] == m; })[0];
                    }) : t._models.get(t._selectedTable);
                })[0];
                if (headers) {
                    json.unshift(header.map(function (h) {
                        return h['key'];
                    }));
                }
                res(json.map(function (row, i) {
                    if (headers && i == 0)
                        return row;
                    return header.filter(function (column) {
                        return row[column['key']] ? true : false;
                    }).map(function (column) {
                        switch (column['type']) {
                            case "map": return '"' + JSON.stringify(row[column['key']]).replace(/"/g, "'") + '"';
                            case "array": return '"' + JSON.stringify(row[column['key']]).replace(/"/g, "'") + '"';
                            default: return JSON.stringify(row[column['key']]);
                        }
                    }).join(',');
                }).join('\n'));
            });
        });
    };
    someSQL_Instance.uuid = function (inputUUID) {
        return inputUUID ? inputUUID : (function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        })();
    };
    someSQL_Instance.hash = function (str) {
        var hash = 5381;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash << 5) + hash) + char;
        }
        return String(hash);
    };
    return someSQL_Instance;
}());
exports.someSQL_Instance = someSQL_Instance;
var someSQL_Promise = (function (_super) {
    __extends(someSQL_Promise, _super);
    function someSQL_Promise(scope, callBackFunc) {
        var _this = _super.call(this, callBackFunc) || this;
        _this.scope = scope;
        return _this;
    }
    someSQL_Promise.prototype.then = function (onSuccess, onFail) {
        var t = this;
        return new someSQL_Promise(t.scope, function (resolve, reject) {
            t.done(function (value) {
                if (typeof onSuccess === 'function') {
                    try {
                        value = onSuccess.apply(t.scope, [value]);
                    }
                    catch (e) {
                        reject(e);
                        return;
                    }
                }
                resolve(value);
            }, function (value) {
                if (typeof onFail === 'function') {
                    try {
                        value = onFail.apply(t.scope, [value]);
                    }
                    catch (e) {
                        reject(e);
                        return;
                    }
                    resolve(value);
                }
                else {
                    reject(value);
                }
            });
        });
    };
    return someSQL_Promise;
}(typescript_promise_1.tsPromise));
var staticSQL = new someSQL_Instance();
function someSQL(table) {
    return staticSQL.init(table);
}
exports.someSQL = someSQL;
