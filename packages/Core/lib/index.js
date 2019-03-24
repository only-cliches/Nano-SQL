var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var really_small_events_1 = require("really-small-events");
var utilities_1 = require("./utilities");
var interfaces_1 = require("./interfaces");
exports.InanoSQLInstance = interfaces_1.InanoSQLInstance;
var functions_1 = require("./functions");
var query_1 = require("./query");
var query_builder_1 = require("./query-builder");
var utils = require("./utilities");
var adapter_detect_1 = require("./adapter-detect");
// tslint:disable-next-line
var nanoSQL = /** @class */ (function () {
    function nanoSQL() {
        this.version = interfaces_1.VERSION;
        this.planetRadius = 6371;
        this._Q = new utilities_1._nanoSQLQueue();
        this.state = {
            activeAV: "",
            hasAnyEvents: false,
            peers: [],
            pid: utilities_1.uuid(),
            id: utilities_1.uuid(),
            cacheId: utilities_1.uuid(),
            peerEvents: [],
            focused: true,
            peerMode: false,
            connected: false,
            ready: false,
            // MRTimer: undefined,
            // runMR: {},
            selectedTable: "",
            exportQueryObj: false
        };
        this.config = {
            id: "temp",
            queue: false
        };
        this._tables = {};
        this._fkRels = {};
        this._tableIds = { "_util": "_util", "_ttl": "_ttl" };
        this._queryCache = {};
        this.filters = {};
        var str = function (value) {
            return typeof value === "object" ? JSON.stringify(value) : String(value);
        };
        var num = function (parseFn) {
            return function (value) {
                return isNaN(value) || value === null ? 0 : parseFn(value);
            };
        };
        this.indexTypes = {
            string: str,
            geo: function (value) {
                return undefined;
            },
            float: num(parseFloat),
            int: num(parseInt),
            number: num(parseFloat),
            date: num(parseInt),
            uuid: str,
            timeId: str,
            timeIdms: str
        };
        this.eventFNs = {
            Core: {
                "*": new really_small_events_1.ReallySmallEvents()
            },
            "*": { "*": new really_small_events_1.ReallySmallEvents() }
        };
        this._checkTTL = this._checkTTL.bind(this);
        functions_1.attachDefaultFns(this);
    }
    nanoSQL.prototype._rebuildFKs = function () {
        var _this = this;
        // bust memoized caches
        this.state.cacheId = utilities_1.uuid();
        this._fkRels = {};
        Object.keys(this._tables).forEach(function (tableName) {
            var table = _this._tables[tableName];
            Object.keys(table.indexes).forEach(function (indexName) {
                var index = table.indexes[indexName];
                if (index.props && index.props.foreignKey) {
                    var path = utilities_1.resolvePath(index.props.foreignKey.target);
                    var remoteTable = path.shift();
                    if (!_this._fkRels[remoteTable]) {
                        _this._fkRels[remoteTable] = [];
                    }
                    _this._fkRels[remoteTable].push({
                        selfPath: path.map(function (s) { return s.replace(/\[\]/gmi, ""); }),
                        selfIsArray: index.props.foreignKey.target.indexOf("[]") !== -1,
                        childTable: tableName,
                        childPath: index.path,
                        childIsArray: index.isArray,
                        childIndex: indexName,
                        onDelete: index.props.foreignKey.onDelete || interfaces_1.InanoSQLFKActions.NONE
                    });
                }
            });
        });
    };
    nanoSQL.prototype.doFilter = function (filterName, args, complete, cancelled) {
        var _this = this;
        if (this.filters[filterName]) {
            utilities_1.chainAsync(this.filters[filterName], function (item, i, nextFilter) {
                _this.filters[filterName][i](args, function (newArgs) {
                    args = newArgs;
                    nextFilter();
                }, cancelled);
            }).then(function () {
                complete(args);
            });
        }
        else {
            complete(args);
        }
    };
    nanoSQL.prototype.getCache = function (id, args) {
        if (!this._queryCache[id]) {
            throw new Error("Cache \"" + id + "\" not found!");
        }
        if (args) {
            return this._queryCache[id].slice(args.offset, args.offset + args.limit);
        }
        else {
            return this._queryCache[id].slice();
        }
    };
    nanoSQL.prototype.clearCache = function (id) {
        var exists = this._queryCache[id] !== undefined;
        delete this._queryCache[id];
        return exists;
    };
    nanoSQL.prototype.clearTTL = function (primaryKey) {
        var _this = this;
        var k = this.state.selectedTable + "." + primaryKey;
        return new Promise(function (res, rej) {
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "delete"), { where: ["key", "=", k] }), utilities_1.noop, res, rej);
        });
    };
    nanoSQL.prototype.expires = function (primaryKey) {
        var _this = this;
        return new Promise(function (res, rej) {
            var k = _this.state.selectedTable + "." + primaryKey;
            var rows = [];
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "select"), { where: ["key", "=", k] }), function (row) {
                rows.push(row);
            }, function () {
                if (!rows.length) {
                    res({ time: -1, cols: [] });
                }
                else {
                    res({ time: (rows[0].date - Date.now()) / 1000, cols: rows[0].cols });
                }
            }, rej);
        });
    };
    nanoSQL.prototype._checkTTL = function () {
        var _this = this;
        if (this.config.disableTTL)
            return;
        if (this._ttlTimer) {
            clearTimeout(this._ttlTimer);
        }
        var page = 0;
        var nextTTL = 0;
        var getPage = function () {
            var rows = [];
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "select"), { limit: 20, offset: 20 * page }), function (row) {
                rows.push(row);
            }, function () {
                if (!rows.length) {
                    if (nextTTL) {
                        _this._ttlTimer = setTimeout(_this._checkTTL, nextTTL - Date.now());
                    }
                    return;
                }
                utilities_1.chainAsync(rows, function (row, i, next) {
                    if (row.date < Date.now()) {
                        var clearTTL = function () {
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "delete"), { where: ["key", "=", row.key] }), utilities_1.noop, next, utilities_1.throwErr);
                        };
                        var rowData = row.key.split(".");
                        var table = rowData[0];
                        var key = ["float", "int", "number"].indexOf(_this._tables[table].pkType) === -1 ? rowData[1] : parseFloat(rowData[1]);
                        if (row.cols.length) {
                            var upsertObj_1 = {};
                            row.cols.forEach(function (col) {
                                upsertObj_1[col] = null;
                            });
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, table, "upsert"), { actionArgs: upsertObj_1, where: [_this._tables[table].pkCol, "=", key] }), utilities_1.noop, clearTTL, utilities_1.throwErr);
                        }
                        else {
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, table, "delete"), { where: [_this._tables[table].pkCol, "=", key] }), utilities_1.noop, clearTTL, utilities_1.throwErr);
                        }
                    }
                    else {
                        nextTTL = Math.max(nextTTL, row.date);
                        next();
                    }
                }).then(function () {
                    page++;
                    getPage();
                });
            }, utilities_1.throwErr);
        };
        getPage();
    };
    nanoSQL.prototype.selectTable = function (table) {
        if (table)
            this.state.selectedTable = table;
        return this;
    };
    nanoSQL.prototype.getPeers = function () {
        return JSON.parse(localStorage.getItem("nsql-peers-" + this.state.id) || "[]");
    };
    nanoSQL.prototype._initPlugins = function (config) {
        var _this = this;
        return new Promise(function (res, rej) {
            // Build plugin filters
            var filterObj = {};
            (config.plugins || []).forEach(function (plugin) {
                (plugin.filters || []).forEach(function (filter) {
                    if (!filterObj[filter.name]) {
                        filterObj[filter.name] = [];
                    }
                    // prevent priority conflicts
                    var priority = filter.priority;
                    while (filterObj[filter.name][priority]) {
                        priority++;
                    }
                    // set callback
                    filterObj[filter.name][priority] = filter.call;
                });
            });
            Object.keys(filterObj).forEach(function (filterName) {
                _this.filters[filterName] = [];
                filterObj[filterName].forEach(function (callback) {
                    if (callback) {
                        _this.filters[filterName].unshift(callback);
                    }
                });
            });
            var checkVersionRange = function (version, range) {
                if (!range || !range.length)
                    return true;
                if (range.length === 1) {
                    return version >= range[0];
                }
                else {
                    return version >= range[0] && version < range[1];
                }
            };
            var hasError = false;
            // check that dependencies are satisfied
            (config.plugins || []).forEach(function (plugin) {
                if (plugin.dependencies) {
                    var dependencies_1 = plugin.dependencies || {};
                    Object.keys(plugin.dependencies).forEach(function (pluginName, i, next) {
                        if (pluginName === "core") {
                            if (!checkVersionRange(interfaces_1.VERSION, dependencies_1[pluginName])) {
                                hasError = true;
                                rej("Plugin \"" + plugin.name + "\" requires a different core version of nano-sql!");
                            }
                        }
                        else {
                            var dependency = (config.plugins || []).reduce(function (p, c) { return c.name === pluginName ? c : p; });
                            if (!dependency) {
                                hasError = true;
                                rej("Plugin \"" + plugin.name + "\" requires plugin \"" + pluginName + "\" but it isn't installed!");
                            }
                            if (!checkVersionRange(dependency.version, dependencies_1[pluginName])) {
                                hasError = true;
                                rej("Plugin \"" + plugin.name + "\" requires a different version of \"" + pluginName + "\"!");
                            }
                        }
                    });
                }
            });
            if (!hasError) {
                res();
            }
        });
    };
    nanoSQL.prototype._saveTableIds = function () {
        var _this = this;
        return new Promise(function (res, rej) {
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "upsert"), { actionArgs: utilities_1.assign({
                    key: "tableIds",
                    value: _this._tableIds
                }) }), utilities_1.noop, res, rej);
        });
    };
    nanoSQL.prototype.presetQuery = function (fn) {
        var _this = this;
        if (typeof this.state.selectedTable !== "string") {
            throw new Error("Can't get table queries without selecting a table!");
        }
        var found = Object.keys(this._tables[this.state.selectedTable].queries).indexOf(fn) !== -1;
        if (!found) {
            throw new Error("Can't find preset query " + fn + "!");
        }
        var queryRunning = false;
        return {
            promise: function (args) {
                return new Promise(function (res, rej) {
                    if (queryRunning) {
                        rej("Query already streaming!");
                        return;
                    }
                    queryRunning = true;
                    var fnArgs = _this._tables[_this.state.selectedTable].queries[fn].args;
                    var filteredArgs = {};
                    if (fnArgs) {
                        filteredArgs = utilities_1.cleanArgs2(args, fnArgs, _this);
                    }
                    var buffer = [];
                    _this._tables[_this.state.selectedTable].queries[fn].call(_this, filteredArgs, function (row) {
                        buffer.push(row);
                    }, function () {
                        res(buffer);
                    }, rej);
                });
            },
            stream: function (args, onRow, complete, error) {
                if (queryRunning) {
                    error("Query already using promise!");
                    return;
                }
                queryRunning = true;
                var fnArgs = _this._tables[_this.state.selectedTable].queries[fn].args;
                var filteredArgs = {};
                if (fnArgs) {
                    filteredArgs = utilities_1.cleanArgs2(args, fnArgs, _this);
                }
                _this._tables[_this.state.selectedTable].queries[fn].call(_this, filteredArgs, onRow, complete, error);
            }
        };
    };
    nanoSQL.prototype.connect = function (config) {
        var _this = this;
        var t = this;
        return this._initPlugins(config).then(function () {
            return new Promise(function (res, rej) {
                _this.doFilter("config", { res: config }, function (r) {
                    res(r.res);
                }, rej);
            });
        }).then(function (conf) {
            _this.state.id = conf.id || "nSQL_DB";
            _this.config = __assign({ plugins: [] }, conf);
            if (typeof window !== "undefined" && conf && conf.peer) {
                _this.state.peerMode = true;
            }
            return new Promise(function (res, rej) {
                _this.doFilter("willConnect", { res: _this }, function () { res(); }, rej);
            });
        }).then(function () {
            // setup and connect adapter
            return new Promise(function (res, rej) {
                _this.adapter = adapter_detect_1.resolveMode(_this.config.mode || "TEMP", _this.config);
                if (_this.adapter.plugin) {
                    (_this.config.plugins || []).push(_this.adapter.plugin);
                }
                _this._initPlugins(_this.config).then(function () {
                    _this.adapter.nSQL = _this;
                    utilities_1.adapterFilters(_this).connect(_this.state.id, function () {
                        _this.doFilter("postConnect", { res: _this.config }, function (config) {
                            _this.config = config.res;
                            res();
                        }, rej);
                    }, rej);
                }).catch(rej);
                if (_this.config.planetRadius) {
                    _this.planetRadius = _this.config.planetRadius;
                }
            });
        }).then(function () {
            _this.triggerEvent({
                target: "Core",
                targetId: _this.state.id,
                path: "*",
                events: ["connect"],
                time: Date.now()
            });
            _this.state.connected = true;
            var tables = ["_util", "_ttl"].concat((_this.config.tables || []).map(function (t) { return t.name; }));
            return utilities_1.chainAsync(tables, function (j, i, next, err) {
                switch (j) {
                    case "_util":
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "create table"), { actionArgs: {
                                name: "_util",
                                model: {
                                    "key:string": { pk: true },
                                    "value:any": {}
                                },
                                _internal: true
                            } }), utilities_1.noop, function () {
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "select"), { where: ["key", "=", "tableIds"] }), function (row) {
                                _this._tableIds = __assign({}, _this._tableIds, row.value);
                            }, function () {
                                next();
                            }, err);
                        }, err);
                        break;
                    case "_ttl":
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_ttl", "create table"), { actionArgs: {
                                name: "_ttl",
                                model: {
                                    "key:string": { pk: true },
                                    "table:string": {},
                                    "cols:string[]": {},
                                    "date:number": {}
                                },
                                _internal: true
                            } }), utilities_1.noop, next, err);
                        break;
                    default:
                        var model = (_this.config.tables || []).filter(function (t) { return t.name === j; })[0];
                        if (!model) {
                            err("Table not found!");
                            return;
                        }
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, j, "create table"), { actionArgs: model }), utilities_1.noop, next, err);
                }
            });
        }).then(function () {
            // migrate nanosql version as needed
            return new Promise(function (res, rej) {
                var currentVersion;
                _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "select"), { where: ["key", "=", "version"] }), function (row) {
                    if (row)
                        currentVersion = row.value;
                }, function () {
                    if (!currentVersion || currentVersion < 2.0) {
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "upsert"), { actionArgs: { key: "version", value: interfaces_1.VERSION } }), utilities_1.noop, res, rej);
                    }
                    else {
                        // no migration code right now
                        res();
                    }
                }, rej);
            });
        }).then(function () {
            // migrate user database version as needed
            return new Promise(function (res, rej) {
                if (!_this.config.version) {
                    res();
                    return;
                }
                var currentVersion;
                _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "select"), { where: ["key", "=", "db-version"] }), function (row) {
                    if (row)
                        currentVersion = row.value;
                }, function () {
                    var saveVersion = function (version, complete, err) {
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, "_util", "upsert"), { actionArgs: { key: "db-version", value: version } }), utilities_1.noop, complete, err);
                    };
                    // nothing to migrate, just set version
                    if (!currentVersion) {
                        saveVersion(_this.config.version || 0, res, rej);
                    }
                    else {
                        var upgrade_1 = function () {
                            if (currentVersion === _this.config.version) {
                                saveVersion(_this.config.version || 0, res, rej);
                            }
                            else {
                                if (!_this.config.onVersionUpdate) {
                                    saveVersion(_this.config.version || 0, res, rej);
                                    return;
                                }
                                _this.config.onVersionUpdate(currentVersion).then(function (newVersion) {
                                    currentVersion = newVersion;
                                    saveVersion(currentVersion, function () {
                                        utilities_1.setFast(upgrade_1);
                                    }, rej);
                                }).catch(rej);
                            }
                        };
                        upgrade_1();
                    }
                }, rej);
            });
        }).then(function () {
            return new Promise(function (res, rej) {
                var event = {
                    target: "Core",
                    path: "*",
                    targetId: _this.state.id,
                    events: ["ready"],
                    time: Date.now()
                };
                _this.doFilter("ready", { res: event }, function (evnt) {
                    _this.triggerEvent(evnt.res);
                    _this.state.ready = true;
                    if (!_this.config.disableTTL) {
                        _this._checkTTL();
                    }
                    if (_this.config.peer) {
                        _this._initPeers();
                    }
                    res();
                }, rej);
            });
        });
    };
    nanoSQL.prototype._initPeers = function () {
        var _this = this;
        var counter = 0;
        this.state.pid = utilities_1.uuid();
        // Append this peer to the network
        this.state.peers = this.getPeers();
        this.state.peers.unshift(this.state.pid);
        localStorage.setItem("nsql-peers-" + this.state.id, JSON.stringify(this.state.peers));
        // When localstorage changes we may need to possibly update the peer list
        // or possibly respond to an event from another peer
        window.addEventListener("storage", function (e) {
            // peer list updated
            if (e.key === "nsql-peers-" + _this.state.id) {
                _this.state.peers = _this.getPeers();
            }
            // recieved event from another peer
            if (e.key && e.key.indexOf(_this.state.pid + ".") === 0) {
                localStorage.removeItem(e.key);
                var ev_1 = JSON.parse(e.newValue || "{}");
                _this.state.peerEvents.push(ev_1.query.queryID || "");
                _this.triggerEvent(__assign({}, ev_1, { types: ["peer change"] }));
                utilities_1.setFast(function () {
                    _this.triggerEvent(ev_1);
                });
            }
            // the "master" peer checks to make sure all peers have been
            // cleaning up their mess every 50 requests, if they aren't they
            // are removed. Keeps localStorage from filling up accidentally.
            counter++;
            if (counter > 50 && _this.state.peers[0] === _this.state.pid) {
                counter = 0;
                var len = localStorage.length;
                var peerKeys_1 = {};
                while (len--) {
                    var key = localStorage.key(len);
                    // only grab events
                    var keyMatch = key ? key.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{8}/gmi) : null;
                    if (key && keyMatch) {
                        var peerID = (keyMatch || [""])[0];
                        if (!peerKeys_1[peerID]) {
                            peerKeys_1[peerID] = [];
                        }
                        peerKeys_1[peerID].push(key);
                    }
                }
                Object.keys(peerKeys_1).forEach(function (peerID) {
                    // purge peers that aren't cleaning up their mess (and thus probably gone)
                    if (peerKeys_1[peerID].length > 10) {
                        _this.state.peers = _this.state.peers.filter(function (p) { return p !== peerID; });
                        peerKeys_1[peerID].forEach(function (key) {
                            localStorage.removeItem(key);
                        });
                        localStorage.setItem("nsql-peers-" + _this.state.id, JSON.stringify(_this.state.peers));
                    }
                });
            }
        });
        window.onblur = function () {
            _this.state.focused = false;
        };
        // on focus we set this nsql to focused and move it's peer position
        // to the front
        window.onfocus = function () {
            // set this peer to master on focus
            _this.state.peers = _this.state.peers.filter(function (p) { return p !== _this.state.pid; });
            _this.state.peers.unshift(_this.state.pid);
            localStorage.setItem("nsql-peers-" + _this.state.id, JSON.stringify(_this.state.peers));
            _this.state.focused = true;
        };
        // send events to the peer network
        exports.nSQL("*").on("change", function (ev) {
            var idxOf = _this.state.peerEvents.indexOf(ev.query.queryID || "");
            if (idxOf !== -1) {
                _this.state.peerEvents.splice(idxOf, 1);
                return;
            }
            _this.state.peers.filter(function (p) { return p !== _this.state.pid; }).forEach(function (p) {
                localStorage.setItem(p + "." + ev.query.queryID, JSON.stringify(ev));
            });
        });
        // Remove self from peer network
        window.addEventListener("beforeunload", function () {
            _this.state.peers = _this.state.peers.filter(function (p) { return p !== _this.state.pid; });
            localStorage.setItem("nsql-peers-" + _this.state.id, JSON.stringify(_this.state.peers));
            return false;
        });
    };
    nanoSQL.prototype.every = function (args) {
        var i = 0;
        var arr = [];
        while (i <= args.length) {
            if (args.every) {
                if (i % args.every === 0) {
                    arr.push(i + (args.offset || 0));
                }
            }
            else {
                arr.push(i + (args.offset || 0));
            }
            i++;
        }
        return arr;
    };
    nanoSQL.prototype.on = function (action, callBack, selectTable) {
        var _this = this;
        var t = this;
        var l = selectTable || (typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable);
        this.doFilter("onEvent", { res: { action: action, callback: callBack } }, function (newEvent) {
            switch (newEvent.res.action) {
                case "connect":
                case "ready":
                case "disconnect":
                case "peer change":
                case "slow query":
                    _this.eventFNs.Core["*"].on(newEvent.res.action, newEvent.res.callback);
                    break;
                case "select":
                case "change":
                case "delete":
                case "upsert":
                case "*":
                    var table = utilities_1.resolvePath(l);
                    if (!_this.eventFNs[table[0]]) {
                        _this.eventFNs[table[0]] = {
                            "*": new really_small_events_1.ReallySmallEvents()
                        };
                    }
                    var nestedPath = table.filter(function (v, i) { return i > 0; }).join(".") || "*";
                    if (!_this.eventFNs[table[0]][nestedPath]) {
                        _this.eventFNs[table[0]][nestedPath] = new really_small_events_1.ReallySmallEvents();
                    }
                    _this.eventFNs[table[0]][nestedPath].on(newEvent.res.action, newEvent.res.callback);
                    break;
                default:
                    new Promise(function (res, rej) {
                        _this.doFilter("customEvent", { res: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, res, rej);
                    }).then(function (evData) {
                        if (evData.res.nameSpace) {
                            if (!_this.eventFNs[evData.res.nameSpace]) {
                                _this.eventFNs[evData.res.nameSpace] = {
                                    "*": new really_small_events_1.ReallySmallEvents()
                                };
                            }
                            if (!_this.eventFNs[evData.res.nameSpace][evData.res.path]) {
                                _this.eventFNs[evData.res.nameSpace][evData.res.path] = new really_small_events_1.ReallySmallEvents();
                            }
                            _this.eventFNs[evData.res.nameSpace][evData.res.path].on(newEvent.res.action, newEvent.res.callback);
                        }
                        else {
                            throw new Error("Invalid event \"" + action + "\"!");
                        }
                        t._refreshEventChecker();
                    });
            }
            t._refreshEventChecker();
        }, utilities_1.noop);
    };
    nanoSQL.prototype.off = function (action, callBack, selectTable) {
        var _this = this;
        var t = this;
        var l = selectTable || typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable;
        this.doFilter("onEvent", { res: { action: action, callback: callBack } }, function (newEvent) {
            switch (newEvent.res.action) {
                case "connect":
                case "ready":
                case "disconnect":
                case "peer change":
                case "slow query":
                    _this.eventFNs.Core["*"].off(newEvent.res.action, newEvent.res.callback);
                    break;
                case "select":
                case "change":
                case "delete":
                case "upsert":
                case "*":
                    var table = utilities_1.resolvePath(l);
                    if (!_this.eventFNs[table[0]]) {
                        _this.eventFNs[table[0]] = {
                            "*": new really_small_events_1.ReallySmallEvents()
                        };
                    }
                    var nestedPath = table.filter(function (v, i) { return i > 0; }).join(".") || "*";
                    if (!_this.eventFNs[table[0]][nestedPath]) {
                        _this.eventFNs[table[0]][nestedPath] = new really_small_events_1.ReallySmallEvents();
                    }
                    _this.eventFNs[table[0]][nestedPath].off(newEvent.res.action, newEvent.res.callback);
                    break;
                default:
                    new Promise(function (res, rej) {
                        _this.doFilter("customEvent", { res: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, res, rej);
                    }).then(function (evData) {
                        if (evData.res.nameSpace) {
                            if (!_this.eventFNs[evData.res.nameSpace]) {
                                _this.eventFNs[evData.res.nameSpace] = {
                                    "*": new really_small_events_1.ReallySmallEvents()
                                };
                            }
                            if (!_this.eventFNs[evData.res.nameSpace][evData.res.path]) {
                                _this.eventFNs[evData.res.nameSpace][evData.res.path] = new really_small_events_1.ReallySmallEvents();
                            }
                            _this.eventFNs[evData.res.nameSpace][evData.res.path].off(newEvent.res.action, newEvent.res.callback);
                        }
                        else {
                            throw new Error("Invalid event \"" + action + "\"!");
                        }
                        t._refreshEventChecker();
                    });
            }
            t._refreshEventChecker();
        }, utilities_1.noop);
    };
    nanoSQL.prototype._refreshEventChecker = function () {
        var _this = this;
        this.state.hasAnyEvents = Object.keys(this.eventFNs).reduce(function (prev, cur) {
            if (prev === true)
                return true;
            var length = Object.keys(_this.eventFNs[cur]).reduce(function (p, key) {
                return Object.keys(_this.eventFNs[cur][key].eventListeners).length + p;
            }, 0);
            return length > 0 ? true : prev;
        }, false);
        return this;
    };
    nanoSQL.prototype.getView = function (viewName, viewArgs) {
        return this._doAV("v", this.state.selectedTable, viewName, viewArgs);
    };
    nanoSQL.prototype.doAction = function (actionName, actionArgs) {
        return this._doAV("a", this.state.selectedTable, actionName, actionArgs);
    };
    nanoSQL.prototype._doAV = function (AVType, table, AVName, AVArgs) {
        var _this = this;
        if (typeof this.state.selectedTable !== "string")
            return Promise.reject("Can't do Action/View with selected table!");
        return new Promise(function (res, rej) {
            _this.doFilter("actionView", {
                res: {
                    AVType: AVType,
                    table: table,
                    AVName: AVName,
                    AVArgs: AVArgs
                }
            }, res, rej);
        }).then(function (actionOrView) {
            var key = actionOrView.res.AVType === "a" ? "actions" : "views";
            var selAV = _this._tables[actionOrView.res.table][key].reduce(function (prev, cur) {
                if (cur.name === actionOrView.res.AVName)
                    return cur;
                return prev;
            }, null);
            if (!selAV) {
                return new Promise(function (res, rej) { return rej(actionOrView.res.AVType + " \"" + actionOrView.res.AVName + "\" Not Found!"); });
            }
            return selAV.call(selAV.args ? utilities_1.cleanArgs(selAV.args, actionOrView.res.AVArgs, _this) : {}, _this);
        });
    };
    nanoSQL.prototype.query = function (action, args) {
        var av = this.state.activeAV;
        this.state.activeAV = "";
        return new query_builder_1._nanoSQLQueryBuilder(this, this.state.selectedTable, action, args, av);
    };
    nanoSQL.prototype.triggerQuery = function (query, onRow, complete, error) {
        var _this = this;
        if (!this.state.connected && typeof query.table === "string") {
            error("nSQL: Can't do a query before the database is connected!");
            return;
        }
        this.doFilter("query", { res: query }, function (setQuery) {
            if (_this.config.queue && !setQuery.res.skipQueue) {
                _this._Q.newItem({
                    query: setQuery.res,
                    onRow: onRow,
                    complete: complete,
                    error: error
                }, function (item, done, err) {
                    new query_1._nanoSQLQuery(_this, item.query, item.onRow, function () {
                        done();
                        item.complete();
                    }, function (err) {
                        done();
                        item.error(err);
                    });
                });
            }
            else {
                new query_1._nanoSQLQuery(_this, setQuery.res, function (row) {
                    onRow(row);
                }, complete, error);
            }
        }, error);
    };
    nanoSQL.prototype.triggerEvent = function (eventData, ignoreStarTable) {
        var _this = this;
        this.doFilter("event", { res: eventData }, function (event) {
            if (_this.state.hasAnyEvents) {
                utilities_1.setFast(function () {
                    event.res.events.forEach(function (evnt) {
                        if (!ignoreStarTable) {
                            Object.keys(_this.eventFNs["*"]).forEach(function (path) {
                                _this.eventFNs["*"][path].trigger(evnt, event.res);
                            });
                        }
                        if (!_this.eventFNs[event.res.target])
                            return;
                        if (event.res.path === "_all_") {
                            Object.keys(_this.eventFNs[event.res.target]).forEach(function (path) {
                                _this.eventFNs[event.res.target][path].trigger(evnt, event.res);
                            });
                        }
                        else {
                            if (!_this.eventFNs[event.res.target][event.res.path])
                                return;
                            _this.eventFNs[event.res.target][event.res.path].trigger(evnt, event.res);
                        }
                    });
                });
            }
        }, function (err) {
            console.log("Event suppressed", err);
        });
        return this;
    };
    nanoSQL.prototype.default = function (replaceObj, table) {
        var _this = this;
        replaceObj = replaceObj || {};
        if (!table && typeof this.state.selectedTable !== "string") {
            throw new Error("Must select table to generate defualts!");
        }
        table = (table || this.state.selectedTable);
        if (!this._tables[table]) {
            throw new Error("nSQL: Table \"" + table + "\" not found for generating default object!");
        }
        var error = "";
        var resolveModel = function (cols, useObj, nestedModel) {
            var newObj = {};
            useObj = useObj || {};
            if (nestedModel && nestedModel.length) {
                if (nestedModel.indexOf("[]") !== -1) {
                    if (Array.isArray(useObj)) {
                        return useObj.map(function (a) { return resolveModel(cols, a, nestedModel.slice(0, nestedModel.lastIndexOf("[]"))); });
                    }
                    else {
                        return [];
                    }
                }
            }
            var hasWildCard = false;
            cols.forEach(function (m) {
                if (m.key === "*") {
                    hasWildCard = true;
                    return;
                }
                if (m.model) {
                    if (m.type.indexOf("[]") !== -1) {
                        var arr = typeof useObj !== "undefined" ? useObj[m.key] : [];
                        if (!Array.isArray(arr)) {
                            newObj[m.key] = [];
                        }
                        else {
                            newObj[m.key] = arr.map(function (a) { return resolveModel(m.model, a, m.type.slice(0, m.type.lastIndexOf("[]"))); });
                        }
                    }
                    else {
                        newObj[m.key] = resolveModel(m.model, typeof useObj !== "undefined" ? useObj[m.key] : undefined);
                    }
                }
                else {
                    var value = typeof useObj[m.key] !== "undefined" ? utilities_1.cast(m.type, useObj[m.key], false, _this) : (typeof m.default === "function" ? m.default(replaceObj) : m.default);
                    if (typeof m.max !== "undefined" && value > m.max) {
                        error = "Data error, column " + m.key + " can't be greater than " + m.max + "!";
                    }
                    if (typeof m.min !== "undefined" && value < m.min) {
                        error = "Data error, column " + m.key + " can't be less than " + m.min + "!";
                    }
                    newObj[m.key] = value;
                }
                if (m.notNull && (newObj[m.key] === null || newObj[m.key] === undefined)) {
                    error = "Data error, " + m.key + " cannot be null!";
                }
            });
            if (error.length) {
                throw new Error(error);
            }
            if (hasWildCard && useObj) {
                var keys_1 = cols.map(function (c) { return c.key; });
                Object.keys(useObj).filter(function (c) { return keys_1.indexOf(c) === -1; }).forEach(function (key) {
                    newObj[key] = useObj[key];
                });
            }
            return newObj;
        };
        return resolveModel(this._tables[table].columns, replaceObj);
    };
    nanoSQL.prototype.rawDump = function (tables, indexes, onRow) {
        var _this = this;
        var exportTables = indexes ? tables : Object.keys(this._tables).filter(function (t) { return tables.length ? tables.indexOf(t) !== -1 : true; });
        return utilities_1.chainAsync(exportTables, function (table, i, nextTable, err) {
            if (indexes) {
                var tableName_1 = table.indexOf(":") !== -1 ? table.split(":")[0] : table;
                var tableIndexes = table.indexOf(":") !== -1 ? [table.split(":")[1]] : Object.keys(_this._tables[table].indexes);
                utilities_1.chainAsync(tableIndexes, function (index, i, nextIdx, errIdx) {
                    utilities_1.adapterFilters(_this).readIndexKeys(tableName_1, index, "all", undefined, undefined, false, function (key, id) {
                        onRow(tableName_1 + "." + index, { indexId: id, rowId: key });
                    }, nextIdx, errIdx);
                }).then(nextTable).catch(err);
            }
            else {
                utilities_1.adapterFilters(_this).readMulti(table, "all", undefined, undefined, false, function (row) {
                    onRow(table, row);
                }, nextTable, err || utilities_1.noop);
            }
        });
    };
    nanoSQL.prototype.rawImport = function (tables, indexes, onProgress) {
        var _this = this;
        var progress = 0;
        var totalLength = Object.keys(tables).reduce(function (p, c) {
            return p += tables[c].length, p;
        }, 0);
        var usableTables = Object.keys(this._tables);
        var importTables = indexes ? Object.keys(tables) : Object.keys(tables).filter(function (t) { return usableTables.indexOf(t) !== -1; });
        return utilities_1.chainAsync(importTables, function (table, i, next, err) {
            if (indexes) {
                // tableName:IndexName
                var tableName_2 = table.split(".")[0];
                var indexName_1 = table.split(".")[1];
                utilities_1.chainAsync(tables[table], function (indexRow, ii, nextIdx, errIdx) {
                    utilities_1.adapterFilters(_this).addIndexValue(tableName_2, indexName_1, indexRow.rowId, indexRow.indexId, nextIdx, errIdx);
                }).then(next).catch(err);
            }
            else {
                var pk_1 = _this._tables[table].pkCol;
                utilities_1.chainAsync(tables[table], function (row, ii, nextRow, rowErr) {
                    if (!utilities_1.deepGet(pk_1, row) && rowErr) {
                        rowErr("No primary key found, can't import: " + JSON.stringify(row));
                        return;
                    }
                    utilities_1.adapterFilters(_this).write(table, utilities_1.deepGet(pk_1, row), row, function (newRow) {
                        nextRow();
                        progress++;
                        if (onProgress)
                            onProgress(Math.round((progress / totalLength) * 10000) / 100);
                    }, rowErr || utilities_1.noop);
                }).then(next).catch(err);
            }
        });
    };
    nanoSQL.prototype.disconnect = function () {
        var _this = this;
        return new Promise(function (res, rej) {
            _this.doFilter("disconnect", {}, function () {
                utilities_1.adapterFilters(_this).disconnect(res, rej);
            }, rej);
        });
    };
    nanoSQL.prototype.extend = function (scope) {
        var _this = this;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return new Promise(function (res, rej) {
            _this.doFilter("extend", { scope: scope, args: args, res: null }, res, rej);
        });
    };
    nanoSQL.prototype.loadJS = function (rows, onProgress, parallel) {
        var _this = this;
        var table = this.state.selectedTable;
        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load JS into temporary table!");
        }
        var total = rows.length;
        var count = 0;
        var async = parallel ? utilities_1.allAsync : utilities_1.chainAsync;
        return async(rows, function (row, i, next, err) {
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, table, "upsert"), { actionArgs: row }), function (r) {
            }, function () {
                count++;
                if (onProgress)
                    onProgress(((count / total) * 10000) / 100);
                next();
            }, err);
        });
    };
    nanoSQL.prototype.JSONtoCSV = function (json, printHeaders, useHeaders) {
        var csv = [];
        if (!json.length) {
            return "";
        }
        var columnHeaders = [];
        if (useHeaders) {
            // use provided headers (much faster)
            columnHeaders = useHeaders;
        }
        else {
            // auto detect headers
            json.forEach(function (json) {
                columnHeaders = Object.keys(json).concat(columnHeaders);
            });
            columnHeaders = columnHeaders.filter(function (v, i, s) { return s.indexOf(v) === i; });
        }
        if (printHeaders) {
            csv.push(columnHeaders.map(function (c) { return "\"" + c + "\""; }).join(","));
        }
        json.forEach(function (row) {
            csv.push(columnHeaders.map(function (k) {
                if (row[k] === null || row[k] === undefined) {
                    return "";
                }
                if (typeof row[k] === "string") {
                    // tslint:disable-next-line
                    return "\"" + (row[k]).replace(/\"/g, '\"\"') + "\"";
                }
                if (typeof row[k] === "boolean") {
                    return row[k] === true ? "true" : "false";
                }
                // tslint:disable-next-line
                return typeof row[k] === "object" ? "\"" + JSON.stringify(row[k]).replace(/\"/g, '\"\"') + "\"" : row[k];
            }).join(","));
        });
        return csv.join("\n");
    };
    nanoSQL.prototype.csvToArray = function (text) {
        // tslint:disable-next-line
        var p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
        for (var _i = 0, text_1 = text; _i < text_1.length; _i++) {
            l = text_1[_i];
            // tslint:disable-next-line
            if ('"' === l) {
                if (s && l === p)
                    row[i] += l;
                s = !s;
                // tslint:disable-next-line
            }
            else if (',' === l && s)
                l = row[++i] = '';
            // tslint:disable-next-line
            else if ('\n' === l && s) {
                // tslint:disable-next-line
                if ('\r' === p)
                    row[i] = row[i].slice(0, -1);
                // tslint:disable-next-line
                row = ret[++r] = [l = ''];
                i = 0;
            }
            else
                row[i] += l;
            p = l;
        }
        return ret[0];
    };
    nanoSQL.prototype.CSVtoJSON = function (csv, rowMap) {
        var _this = this;
        var t = this;
        var fields = [];
        return csv.split(/\r?\n|\r|\t/gm).map(function (v, k) {
            if (k === 0) {
                fields = v.split(",").map(function (s) { return s.substring(1, s.length - 1); });
                return undefined;
            }
            else {
                var row = _this.csvToArray(v);
                if (!row)
                    return undefined;
                row = row.map(function (r) { return r.trim(); });
                var i = fields.length;
                var record = {};
                while (i--) {
                    if (row[i]) {
                        if (row[i] === "true" || row[i] === "false") {
                            record[fields[i]] = row[i] === "true";
                        }
                        else if (row[i].indexOf("{") === 0 || row[i].indexOf("[") === 0) {
                            // tslint:disable-next-line
                            try {
                                record[fields[i]] = JSON.parse(row[i]);
                            }
                            catch (e) {
                                record[fields[i]] = row[i];
                            }
                            // tslint:disable-next-line
                        }
                        else if (row[i].indexOf('"') === 0) {
                            record[fields[i]] = row[i].slice(1, row[i].length - 1).replace(/\"\"/gmi, "\"");
                        }
                        else {
                            record[fields[i]] = row[i];
                        }
                    }
                }
                if (rowMap) {
                    return rowMap(record);
                }
                return record;
            }
        }).filter(function (r) { return r; });
    };
    nanoSQL.prototype.loadCSV = function (csvString, rowMap, onProgress, parallel) {
        var _this = this;
        var table = this.state.selectedTable;
        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load CSV into temporary table!");
        }
        var rowData = this.CSVtoJSON(csvString, rowMap);
        var async = parallel ? utilities_1.allAsync : utilities_1.chainAsync;
        var count = 0;
        return async(rowData, function (row, i, nextRow, err) {
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(_this, table, "upsert"), { actionArgs: row }), utilities_1.noop, function () {
                count++;
                if (onProgress)
                    onProgress(Math.round((count / rowData.length) * 10000) / 100);
                nextRow();
            }, err || utilities_1.noop);
        });
    };
    return nanoSQL;
}());
exports.nanoSQL = nanoSQL;
exports.nSQLv1Config = function (doConfig) {
    var tables = {};
    var conf = {};
    var selTable = "";
    var nSQLv1 = function (table) {
        selTable = table || selTable;
        if (selTable && !tables[selTable]) {
            tables[selTable] = {
                name: selTable,
                model: {},
                indexes: {},
                actions: [],
                views: []
            };
        }
        return {
            model: function (dataModels) {
                var indexes = {};
                tables[selTable].model = dataModels.reduce(function (prev, cur) {
                    var key = cur.key + ":" + cur.type;
                    prev[key] = {};
                    if (cur.props) {
                        if (cur.props.indexOf("pk") !== -1) {
                            prev[key].pk = true;
                        }
                        if (cur.props.indexOf("ai") !== -1) {
                            prev[key].ai = true;
                        }
                        if (indexes && cur.props.indexOf("idx") !== -1) {
                            indexes[key] = {};
                        }
                    }
                    return prev;
                }, {});
                tables[selTable].indexes = indexes;
                return nSQLv1(table);
            },
            actions: function (actions) {
                tables[selTable].actions = actions;
                return nSQLv1(table);
            },
            views: function (views) {
                tables[selTable].views = views;
                return nSQLv1(table);
            },
            config: function (obj) {
                conf = obj;
                return nSQLv1(table);
            },
            table: function (ta) {
                return nSQLv1(ta);
            },
            rowFilter: function (callback) {
                tables[selTable].filter = callback;
                return nSQLv1(table);
            }
        };
    };
    doConfig(nSQLv1);
    return __assign({}, conf, { tables: Object.keys(tables).map(function (t) { return tables[t]; }) });
};
/**
 * @internal
 */
var _nanoSQLStatic = new nanoSQL();
exports.nSQL = function (table) {
    return _nanoSQLStatic.selectTable(table);
};
if (typeof window !== "undefined") {
    if (!window["@nano-sql"]) {
        window["@nano-sql"] = {};
    }
    window["@nano-sql"].core = {
        nSQL: exports.nSQL,
        nanoSQL: nanoSQL,
        utilities: utils,
        nSQLv1Config: exports.nSQLv1Config
    };
}
/*
// used to test browser adapters with live reload
let errors = 0;
console.log("Testing IndexedDB");
new nanoSQLAdapterTest(IndexedDB, []).test().then(() => {
    console.log("Testing WebSQL");
    new nanoSQLAdapterTest(WebSQL, []).test().then(() => {
        console.log("Tests Complete");
    }).catch((err) => {
        console.error(err);
        errors++;
    });
}).catch((err) => {
    console.error(err);
    errors++;
});*/ 
//# sourceMappingURL=index.js.map