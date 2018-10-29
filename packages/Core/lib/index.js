var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var really_small_events_1 = require("really-small-events");
var utilities_1 = require("./utilities");
var observable_1 = require("./observable");
var functions_1 = require("./functions");
var query_1 = require("./query");
var syncStorage_1 = require("./adapters/syncStorage");
var webSQL_1 = require("./adapters/webSQL");
var indexedDB_1 = require("./adapters/indexedDB");
var query_builder_1 = require("./query-builder");
var RocksDB;
if (typeof global !== "undefined") {
    RocksDB = global._rocksDB;
}
var VERSION = 2.0;
var NanoSQL = /** @class */ (function () {
    function NanoSQL() {
        this.version = VERSION;
        this.earthRadius = 6371;
        this._Q = new utilities_1.NanoSQLBuffer();
        this.state = {
            activeAV: "",
            hasAnyEvents: false,
            peers: [],
            pid: utilities_1.uuid(),
            id: utilities_1.uuid(),
            peerEvents: [],
            focused: true,
            peerMode: false,
            connected: false,
            ready: false,
            selectedTable: ""
        };
        this.config = {
            id: "temp",
            queue: false
        };
        this.tables = {};
        this._queryCache = {};
        this.filters = {};
        this.indexTypes = {
            string: function (value) {
                return typeof value === "object" ? JSON.stringify(value) : String(value);
            },
            geo: function (value) {
                return undefined;
            },
            float: function (value) {
                var float = parseFloat(value);
                return isNaN(float) ? 0 : float;
            },
            int: function (value) {
                var int = parseInt(value);
                return isNaN(int) ? 0 : int;
            },
            number: function (value) {
                var float = parseFloat(value);
                return isNaN(float) ? 0 : float;
            }
        };
        this._eventCBs = {
            Core: new really_small_events_1.ReallySmallEvents()
        };
        this._checkTTL = this._checkTTL.bind(this);
        functions_1.attachDefaultFns(this);
    }
    NanoSQL.prototype.doFilter = function (filterName, args) {
        var _this = this;
        if (this.filters[filterName]) {
            return new Promise(function (res, rej) {
                utilities_1.chainAsync(_this.filters[filterName], function (item, i, nextFilter) {
                    _this.filters[filterName][i](args).then(function (newArgs) {
                        args = newArgs;
                        if (newArgs.abort) {
                            rej(newArgs.abort);
                        }
                        else {
                            nextFilter();
                        }
                    });
                }).then(function () {
                    res(args.result);
                });
            });
        }
        else {
            return Promise.resolve(args.result);
        }
    };
    NanoSQL.prototype.getCache = function (id, args) {
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
    NanoSQL.prototype.clearCache = function (id) {
        var exists = this._queryCache[id] !== undefined;
        delete this._queryCache[id];
        return exists;
    };
    NanoSQL.prototype.clearTTL = function (primaryKey) {
        var _this = this;
        var k = this.state.selectedTable + "." + primaryKey;
        return new Promise(function (res, rej) {
            _this.triggerQuery(__assign({}, utilities_1.buildQuery("_ttl", "delete"), { where: ["key", "=", k] }), utilities_1.noop, res, rej);
        });
    };
    NanoSQL.prototype.expires = function (primaryKey) {
        var _this = this;
        return new Promise(function (res, rej) {
            var k = _this.state.selectedTable + "." + primaryKey;
            var rows = [];
            _this.triggerQuery(__assign({}, utilities_1.buildQuery("_ttl", "select"), { where: ["key", "=", k] }), function (row) {
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
    NanoSQL.prototype._checkTTL = function () {
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
            _this.triggerQuery(__assign({}, utilities_1.buildQuery("_ttl", "select"), { limit: 20, offset: 20 * page }), function (row) {
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
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery("_ttl", "delete"), { where: ["key", "=", row.key] }), utilities_1.noop, next, utilities_1.throwErr);
                        };
                        var rowData = row.key.split(".");
                        var table = rowData[0];
                        var key = ["float", "int", "number"].indexOf(_this.tables[table].pkType) === -1 ? rowData[1] : parseFloat(rowData[1]);
                        if (row.cols.length) {
                            var upsertObj_1 = {};
                            row.cols.forEach(function (col) {
                                upsertObj_1[col] = null;
                            });
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(table, "upsert"), { actionArgs: upsertObj_1, where: [_this.tables[table].pkCol, "=", key] }), utilities_1.noop, clearTTL, utilities_1.throwErr);
                        }
                        else {
                            _this.triggerQuery(__assign({}, utilities_1.buildQuery(table, "delete"), { where: [_this.tables[table].pkCol, "=", key] }), utilities_1.noop, clearTTL, utilities_1.throwErr);
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
    NanoSQL.prototype.selectTable = function (table) {
        if (table)
            this.state.selectedTable = table;
        return this;
    };
    NanoSQL.prototype.getPeers = function () {
        return JSON.parse(localStorage.getItem("nsql-peers-" + this.state.id) || "[]");
    };
    NanoSQL.prototype._detectStorageMethod = function () {
        // NodeJS
        if (typeof window === "undefined") {
            return "ROCKS";
        }
        // Browser
        // Safari / iOS always gets WebSQL (mobile and desktop)
        if (utilities_1.isSafari) {
            return "WSQL";
        }
        // everyone else (FF + Chrome + Edge + IE)
        // check for support for indexed db, web workers and blob
        if (typeof indexedDB !== "undefined") { // fall back to indexed db if we can
            return "IDB";
        }
        // Use WebSQL if it's there.
        if (typeof window !== "undefined" && typeof window.openDatabase !== "undefined") {
            return "WSQL";
        }
        // nothing else works, we gotta do local storage. :(
        return "LS";
    };
    NanoSQL.prototype._initPlugins = function (config) {
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
                    filterObj[filter.name][priority] = filter.callback;
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
                            if (!checkVersionRange(VERSION, dependencies_1[pluginName])) {
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
    NanoSQL.prototype.connect = function (config) {
        var _this = this;
        var t = this;
        return this._initPlugins(config).then(function () {
            return _this.doFilter("config", { result: config });
        }).then(function (conf) {
            _this.state.id = conf.id || "nSQL_DB";
            _this.config = __assign({ plugins: [] }, conf);
            if (typeof window !== "undefined" && conf && conf.peer) {
                _this.state.peerMode = true;
            }
            return _this.doFilter("willConnect", { result: {} });
        }).then(function () {
            // setup and connect adapter
            return new Promise(function (res, rej) {
                var dbMode = typeof _this.config.mode !== "undefined" ? _this.config.mode : "TEMP";
                if (typeof dbMode === "string") {
                    if (dbMode === "PERM") {
                        dbMode = _this._detectStorageMethod();
                    }
                    switch (dbMode) {
                        case "TEMP":
                            _this.adapter = new syncStorage_1.SyncStorage(false);
                            break;
                        case "LS":
                            _this.adapter = new syncStorage_1.SyncStorage(true);
                            break;
                        case "WSQL":
                            _this.adapter = new webSQL_1.WebSQL();
                            break;
                        case "IDB":
                            _this.adapter = new indexedDB_1.IndexedDB();
                            break;
                        case "ROCKS":
                        case "LVL":
                            _this.adapter = new RocksDB();
                            break;
                        default:
                            rej("Cannot find mode " + dbMode + "!");
                    }
                }
                else {
                    _this.adapter = dbMode;
                }
                if (_this.adapter.plugin) {
                    (_this.config.plugins || []).push(_this.adapter.plugin);
                }
                _this._initPlugins(_this.config).then(function () {
                    _this.adapter.nSQL = _this;
                    _this.adapter.connect(_this.state.id, res, rej);
                }).catch(rej);
            });
        }).then(function () {
            _this.triggerEvent({
                target: "Core",
                targetId: _this.state.id,
                events: ["connect"],
                time: Date.now()
            });
            _this.state.connected = true;
            var tables = ["_util", "_ttl"].concat((_this.config.tables || []).map(function (t) { return t.name; }));
            return utilities_1.allAsync(tables, function (j, i, next, err) {
                switch (j) {
                    case "_util":
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery("", "create table"), { actionArgs: {
                                name: "_util",
                                model: [
                                    { key: "key:string", props: ["pk()"] },
                                    { key: "value:any" }
                                ],
                                _internal: true
                            } }), utilities_1.noop, next, err);
                        break;
                    case "_ttl":
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery("", "create table"), { actionArgs: {
                                name: "_ttl",
                                model: [
                                    { key: "key:string", props: ["pk()"] },
                                    { key: "table:string" },
                                    { key: "cols:string[]" },
                                    { key: "date:number" }
                                ],
                                _internal: true
                            } }), utilities_1.noop, next, err);
                        break;
                    default:
                        var model = (_this.config.tables || []).filter(function (t) { return t.name === j; })[0];
                        if (!model) {
                            err("Table not found!");
                            return;
                        }
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery("", "create table"), { actionArgs: model }), utilities_1.noop, next, err);
                }
            });
        }).then(function () {
            // migrate nanosql version as needed
            return new Promise(function (res, rej) {
                var currentVersion;
                _this.triggerQuery(__assign({}, utilities_1.buildQuery("_util", "select"), { where: ["key", "=", "version"] }), function (row) {
                    if (row)
                        currentVersion = row.value;
                }, function () {
                    if (!currentVersion || currentVersion < 2.0) {
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery("_util", "upsert"), { actionArgs: { key: "version", value: VERSION } }), utilities_1.noop, res, rej);
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
                _this.triggerQuery(__assign({}, utilities_1.buildQuery("_util", "select"), { where: ["key", "=", "db-version"] }), function (row) {
                    if (row)
                        currentVersion = row.value;
                }, function () {
                    var saveVersion = function (version, complete, err) {
                        _this.triggerQuery(__assign({}, utilities_1.buildQuery("_util", "upsert"), { actionArgs: { key: "db-version", value: version } }), utilities_1.noop, complete, err);
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
                _this.triggerEvent({
                    target: "Core",
                    targetId: _this.state.id,
                    events: ["ready"],
                    time: Date.now()
                });
                _this.state.ready = true;
                if (!_this.config.disableTTL) {
                    _this._checkTTL();
                }
                if (_this.config.peer) {
                    _this._initPeers();
                }
                res();
            });
        });
    };
    NanoSQL.prototype._initPeers = function () {
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
                _this.triggerEvent(__assign({}, ev_1, { types: ["peer-change"] }));
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
    NanoSQL.prototype.on = function (action, callBack) {
        var t = this;
        var l = typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable;
        if (l.indexOf("Plugin:") !== -1) {
            if (!this._eventCBs[l]) {
                this._eventCBs[l] = new really_small_events_1.ReallySmallEvents();
            }
            this._eventCBs[l].on(action, callBack);
            return t._refreshEventChecker();
        }
        switch (action) {
            case "connect":
            case "ready":
            case "disconnect":
            case "peer-change":
            case "slow-query":
                this._eventCBs.Core.on(action, callBack);
                break;
            default:
                var table = "Table:" + utilities_1.resolveObjPath(l).join(".");
                if (!this._eventCBs[table]) {
                    this._eventCBs[table] = new really_small_events_1.ReallySmallEvents();
                }
                this._eventCBs[table].on(action, callBack);
        }
        return t._refreshEventChecker();
    };
    NanoSQL.prototype.off = function (action, callBack) {
        var t = this;
        var l = typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable;
        if (l.indexOf("Plugin:") !== -1) {
            this._eventCBs[l].off(action, callBack);
            return t._refreshEventChecker();
        }
        switch (action) {
            case "connect":
            case "ready":
            case "disconnect":
            case "peer-change":
            case "slow-query":
                this._eventCBs.Core.off(action, callBack);
                break;
            default:
                var table = "Table:" + utilities_1.resolveObjPath(l).join(".");
                this._eventCBs[table].off(action, callBack);
        }
        return t._refreshEventChecker();
    };
    NanoSQL.prototype._refreshEventChecker = function () {
        var _this = this;
        this.state.hasAnyEvents = Object.keys(this._eventCBs).reduce(function (prev, cur) {
            if (prev === true)
                return true;
            var length = Object.keys(_this._eventCBs[cur].eventListeners).reduce(function (p, c) {
                return _this._eventCBs[cur].eventListeners[c].length + p;
            }, 0);
            return length > 0 ? true : prev;
        }, false);
        return this;
    };
    NanoSQL.prototype.getView = function (viewName, viewArgs) {
        return this._doAV("View", this.state.selectedTable, viewName, viewArgs);
    };
    NanoSQL.prototype.doAction = function (actionName, actionArgs) {
        return this._doAV("Action", this.state.selectedTable, actionName, actionArgs);
    };
    NanoSQL.prototype._doAV = function (AVType, table, AVName, AVargs) {
        var _this = this;
        if (typeof this.state.selectedTable !== "string")
            return Promise.reject();
        return this.doFilter(AVType, {
            result: {
                AVType: AVType,
                table: table,
                AVName: AVName,
                AVargs: AVargs
            }
        }).then(function (result) {
            var key = result.AVType === "Action" ? "actions" : "views";
            var selAV = _this.tables[result.table][key].reduce(function (prev, cur) {
                if (cur.name === result.AVName)
                    return cur;
                return prev;
            }, null);
            if (!selAV) {
                return new Promise(function (res, rej) { return rej(result.AVType + " \"" + result.AVName + "\" Not Found!"); });
            }
            return selAV.call(selAV.args ? utilities_1.cleanArgs(selAV.args, result.AVargs) : {}, _this);
        });
    };
    NanoSQL.prototype.query = function (action, args) {
        var av = this.state.activeAV;
        this.state.activeAV = "";
        return new query_builder_1._NanoSQLQueryBuilder(this, this.state.selectedTable, action, args, av);
    };
    NanoSQL.prototype.triggerQuery = function (query, onRow, complete, error) {
        var _this = this;
        if (!this.state.connected && typeof query.table === "string") {
            error("nSQL: Can't do a query before the database is connected!");
            return;
        }
        if (!this._Q.processItem) {
            this._Q.processItem = function (item, i, done, err) {
                new query_1._NanoSQLQuery(_this, item.query, item.onRow, function () {
                    done();
                    item.complete();
                }, function (err) {
                    done();
                    item.error(err);
                });
            };
        }
        this.doFilter("query", { result: query }).then(function (setQuery) {
            if (_this.config.queue && !setQuery.skipQueue) {
                _this._Q.newItem({ query: setQuery, onRow: onRow, complete: complete, error: error });
            }
            else {
                new query_1._NanoSQLQuery(_this, setQuery, onRow, complete, error);
            }
        }).catch(error);
    };
    NanoSQL.prototype.triggerEvent = function (eventData) {
        var _this = this;
        this.doFilter("event", { result: eventData }).then(function (event) {
            if (_this.state.hasAnyEvents && _this._eventCBs[eventData.target]) {
                utilities_1.setFast(function () {
                    eventData.events.forEach(function (event) {
                        _this._eventCBs[eventData.target].trigger(event, eventData);
                    });
                });
            }
        }).catch(function (err) {
            console.error("Event suppressed", err);
        });
        return this;
    };
    NanoSQL.prototype.default = function (replaceObj, table) {
        replaceObj = replaceObj || {};
        if (!table && typeof this.state.selectedTable !== "string") {
            throw new Error("Must select table to generate defualts!");
        }
        table = (table || this.state.selectedTable);
        if (!this.tables[table]) {
            throw new Error("nSQL: Table \"" + table + "\" not found for generating default object!");
        }
        var error = "";
        var resolveModel = function (cols, useObj, nestedModel) {
            var newObj = {};
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
                    newObj[m.key] = typeof useObj[m.key] !== "undefined" ? utilities_1.cast(m.type, useObj[m.key]) : m.default;
                }
                if (m.notNull && newObj[m.key] === null) {
                    error = "Data error, " + m.key + " cannot be null!";
                }
            });
            if (error.length)
                return new Error(error);
            if (hasWildCard && useObj) {
                var keys_1 = cols.map(function (c) { return c.key; });
                Object.keys(useObj).filter(function (c) { return keys_1.indexOf(c) === -1; }).forEach(function (key) {
                    newObj[key] = useObj[key];
                });
            }
            return newObj;
        };
        return resolveModel(this.tables[table].columns, replaceObj);
    };
    NanoSQL.prototype.rawDump = function (tables, onRow) {
        var _this = this;
        var exportTables = Object.keys(this.tables).filter(function (t) { return tables.length ? tables.indexOf(t) !== -1 : true; });
        return utilities_1.chainAsync(exportTables, function (table, i, nextTable, err) {
            _this.adapter.readMulti(table, "all", undefined, undefined, false, function (row) {
                onRow(table, row);
            }, nextTable, err || utilities_1.noop);
        });
    };
    NanoSQL.prototype.rawImport = function (tables, onProgress) {
        var _this = this;
        var progress = 0;
        var totalLength = Object.keys(tables).reduce(function (p, c) {
            return p += tables[c].length, p;
        }, 0);
        var usableTables = Object.keys(this.tables);
        var importTables = Object.keys(tables).filter(function (t) { return usableTables.indexOf(t) !== -1; });
        return utilities_1.chainAsync(importTables, function (table, i, next, err) {
            var pk = _this.tables[table].pkCol;
            utilities_1.chainAsync(tables[table], function (row, ii, nextRow, rowErr) {
                if (!row[pk] && rowErr) {
                    rowErr("No primary key found, can't import: " + JSON.stringify(row));
                    return;
                }
                _this.adapter.write(table, row[pk], row, function (newRow) {
                    nextRow();
                    progress++;
                    if (onProgress)
                        onProgress(Math.round((progress / totalLength) * 10000) / 100);
                }, rowErr || utilities_1.noop);
            }).then(next).catch(err);
        });
    };
    NanoSQL.prototype.disconnect = function () {
        var _this = this;
        return this.doFilter("disconnect", {}).then(function () {
            return new Promise(function (res, rej) { return _this.adapter.disconnect(res, rej); });
        });
    };
    NanoSQL.prototype.observable = function (getQuery, tablesToListen) {
        return new observable_1.Observer(this, getQuery, tablesToListen || []);
    };
    NanoSQL.prototype.extend = function (scope) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return this.doFilter("extend", { scope: scope, args: args, result: null });
    };
    NanoSQL.prototype.loadJS = function (rows, onProgress) {
        var table = this.state.selectedTable;
        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load JS into temporary table!");
        }
        return Promise.resolve([]);
    };
    NanoSQL.prototype.JSONtoCSV = function (json, printHeaders, useHeaders) {
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
            csv.push(columnHeaders.join(","));
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
        return csv.join("\r\n");
    };
    NanoSQL.prototype.csvToArray = function (text) {
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
    NanoSQL.prototype.CSVtoJSON = function (csv, rowMap) {
        var _this = this;
        var t = this;
        var fields = [];
        return csv.split(/\r?\n|\r|\t/gm).map(function (v, k) {
            if (k === 0) {
                fields = v.split(",");
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
    NanoSQL.prototype.loadCSV = function (csv, rowMap, onProgress) {
        var _this = this;
        var table = this.state.selectedTable;
        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load CSV into temporary table!");
        }
        var rowData = this.CSVtoJSON(csv, rowMap);
        return utilities_1.chainAsync(rowData, function (row, i, nextRow, err) {
            if (onProgress)
                onProgress(Math.round(((i + 1) / rowData.length) * 10000) / 100);
            _this.triggerQuery(__assign({}, utilities_1.buildQuery(table, "upsert"), { actionArgs: row }), utilities_1.noop, nextRow, err || utilities_1.noop);
        });
    };
    return NanoSQL;
}());
exports.NanoSQL = NanoSQL;
/**
 * @internal
 */
var _NanoSQLStatic = new NanoSQL();
exports.nSQL = function (setTablePointer) {
    return _NanoSQLStatic.selectTable(setTablePointer);
};
if (typeof window !== "undefined") {
    window["nano-sql"] = {
        nSQL: exports.nSQL,
        NanoSQLInstance: NanoSQL
    };
}
//# sourceMappingURL=index.js.map