import { ReallySmallEvents } from "really-small-events";
import { _assign, allAsync, random16Bits, cast, cleanArgs, objQuery, chainAsync, intersect, crowDistance, uuid, hash, defaultTypes, noop, throwErr, setFast, events } from "./utilities";
import { Observer } from "./observable";
import { NanoSQLConfig, NanoSQLPlugin, NanoSQLFunction, ActionOrView, DataModel, IdbQuery, disconnectFilter, DatabaseEvent, extendFilter, abstractFilter, queryFilter, eventFilter, configFilter, AVFilterResult, actionFilter, buildQuery, NanoSQLAdapter, connectFilter, JoinArgs } from "./interfaces";
import { attachDefaultFns } from "./functions";

const VERSION = 2.0;

/**
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class NanoSQLInstance
 */
export class NanoSQLInstance {

    public config: NanoSQLConfig;

    public plugins: NanoSQLPlugin[];

    public adapter: NanoSQLAdapter;

    public version: number = VERSION;

    public filters: { [filterName: string]: ((inputArgs: any) => Promise<any>)[] };

    public functions: {
        [fnName: string]: NanoSQLFunction;
    };

    public whereFunctions: {
        [fnName: string]: (row: any, isJoin: boolean, ...args: any[]) => any;
    };

    public earthRadius: number = 6371;

    public tables: {
        [tableName: string]: {
            model: DataModel[],
            filter?: (row: any) => any,
            actions: ActionOrView[],
            views: ActionOrView[],
            types: {[name: string]: {[key: string]: {type: string, default?: any}}};
            hasEvents: boolean;
            eventCBs: { [row: string]: ReallySmallEvents }
            pkType: string;
            pkCol: string;
            ai: boolean;
            secondaryIdxs: string[];
            wildCard: boolean;
            props?: any;
        }
    };

    public state: {
        activeAV: string;
        hasAnyEvents: boolean;
        id: string;
        pid: string;
        peers: string[];
        peerEvents: string[];
        focused: boolean;
        peerMode: boolean;
        isConnected: boolean;
        selectedTable: string | any[];
    };

    private _eventCBs: {
        core: ReallySmallEvents;
        [eventName: string]: ReallySmallEvents;
    };


    constructor() {

        this.state = {
            activeAV: "",
            hasAnyEvents: false,
            peers: [],
            pid: uuid(),
            id: uuid(),
            peerEvents: [],
            focused: true,
            peerMode: false,
            isConnected: false,
            selectedTable: ""
        };

        this.tables = {
            "*": {
                model: [],
                actions: [],
                views: [],
                hasEvents: false,
                eventCBs: {
                    "*": new ReallySmallEvents()
                },
                pkType: "",
                pkCol: "",
                types: defaultTypes,
                secondaryIdxs: [],
                ai: false,
                wildCard: false
            }
        };

        this.plugins = [];
        this._eventCBs = {
            core: new ReallySmallEvents()
        };
        this._checkTTL = this._checkTTL.bind(this);

        attachDefaultFns(this);
    }

    public doFilter<T, R>(filterName: string, args: T): Promise<R> {
        if (this.filters[filterName]) {
            return new Promise((res, rej) => {
                chainAsync(this.filters[filterName], (item, i, nextFilter) => {
                    this.filters[filterName][i](args).then((newArgs) => {
                        args = newArgs;
                        if (newArgs.abort) {
                            rej(newArgs.abort);
                        } else {
                            nextFilter();
                        }
                    });
                }).then(() => {
                    res((args as any).result);
                });
            });
        } else {
            return Promise.resolve((args as any).result);
        }
    }


    /**
     * Remove TTL from specific row
     *
     * @param {*} primaryKey
     * @returns {Promise<any>}
     * @memberof NanoSQLInstance
     */
    public clearTTL(primaryKey: any): Promise<any> {
        const k = this.state.selectedTable + "." + primaryKey;
        return new Promise((res, rej) => {
            this.triggerQuery({
                ...buildQuery("_ttl", "delete"),
                where: ["key", "=", k]
            }, noop, res, rej);
        });
    }

    /**
     * Check when a given row is going to expire.
     *
     * @param {*} primaryKey
     * @returns {Promise<any>}
     * @memberof NanoSQLInstance
     */
    public expires(primaryKey: any): Promise<any> {
        return new Promise((res, rej) => {
            const k = this.state.selectedTable + "." + primaryKey;
            let rows = [];
            this.triggerQuery({
                ...buildQuery("_ttl", "select"),
                where: ["key", "=", k]
            }, (row) => {
                rows.push(row);
            }, () => {
                if (!rows.length) {
                    res({ time: -1, cols: [] });
                } else {
                    res({ time: (rows[0].date - Date.now()) / 1000, cols: rows[0].cols });
                }
            }, rej);
        });
    }

    private _ttlTimer: any;

    public _checkTTL() {
        if (this.config.disableTTL) return;

        if (this._ttlTimer) {
            clearTimeout(this._ttlTimer);
        }
        let page = 0;
        let nextTTL = 0;
        const getPage = () => {
            let rows = [];
            this.triggerQuery({
                ...buildQuery("_ttl", "select"),
                limit: 20,
                offset: 20 * page
            }, (row) => {
                rows.push(row);
            }, () => {
                if (!rows.length) {
                    if (nextTTL) {
                        this._ttlTimer = setTimeout(this._checkTTL, nextTTL - Date.now());
                    }
                    return;
                }
                chainAsync(rows, (row, i, next) => {
                    if (row.date < Date.now()) {
                        const clearTTL = () => {
                            this.triggerQuery({
                                ...buildQuery("_ttl", "delete"),
                                where: ["key", "=", row.key]
                            }, noop, next, throwErr);
                        };
                        const rowData = row.key.split(".");
                        const table = rowData[0];
                        const key = ["float", "int", "number"].indexOf(this.tables[table].pkType) === -1 ? rowData[1] : parseFloat(rowData[1]);
                        if (row.cols.length) {
                            let upsertObj = {};
                            row.cols.forEach((col) => {
                                upsertObj[col] = null;
                            });
                            this.triggerQuery({
                                ...buildQuery(table, "upsert"),
                                actionArgs: upsertObj,
                                where: [this.tables[table].pkCol, "=", key]
                            }, noop, clearTTL, throwErr);
                        } else {
                            this.triggerQuery({
                                ...buildQuery(table, "delete"),
                                where: [this.tables[table].pkCol, "=", key]
                            }, noop, clearTTL, throwErr);
                        }
                    } else {
                        nextTTL = Math.max(nextTTL, row.date);
                        next();
                    }
                }).then(() => {
                    page++;
                    getPage();
                });
            }, throwErr);

        };
        getPage();
    }


    /**
     * Changes the table pointer to a new table.
     *
     * @param {string} [table]
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public table(table?: string | any[]): NanoSQLInstance {
        if (table) this.state.selectedTable = table;
        return this;
    }

    public getPeers() {
        return JSON.parse(localStorage.getItem("nsql-peers-" + this.state.id) || "[]");
    }



    public connect(config: NanoSQLConfig): Promise<any> {
        let t = this;

        if (this.adapter.plugin) {
            (config.plugins || []).push(this.adapter.plugin);
        }
        this.state.id = config.id || hash(JSON.stringify(config.tables || []));


        // Build plugin filters
        let filterObj: { [filterName: string]: any[] } = {};

        (config.plugins || []).forEach((plugin) => {
            plugin.filters.forEach((filter) => {
                if (!filterObj[filter.name]) {
                    filterObj[filter.name] = [];
                }
                let priority = filter.priority;
                while (filterObj[filter.name][priority]) {
                    priority++;
                }
                filterObj[filter.name][priority] = filter.callback;
            });
        });

        Object.keys(filterObj).forEach((filterName) => {
            this.filters[filterName] = [];
            filterObj[filterName].forEach((callback) => {
                if (callback) {
                    this.filters[filterName].unshift(callback);
                }
            });
        });

        const checkVersionRange = (version: number, range: number[]): boolean => {
            if (!range || !range.length) return true;
            if (range.length === 1) {
                return version >= range[0];
            } else {
                return version >= range[0] && version <= range[1];
            }
        };

        return new Promise((res, rej) => {
            let hasError = false;

            // check that dependencies are satisfied
            (config.plugins || []).forEach((plugin) => {
                if (plugin.dependencies) {
                    Object.keys(plugin.dependencies).forEach((pluginName: string, i, next) => {
                        if (pluginName === "core") {
                            if (!checkVersionRange(VERSION, plugin.dependencies[pluginName])) {
                                rej(`nSQL: Plugin "${plugin.name}" requires a different core version of nano-sql!`);
                                hasError = true;
                            }
                        } else {
                            const dependency = (config.plugins || []).reduce((p, c) => c.name === pluginName ? c : p);
                            if (!dependency) {
                                rej(`nSQL: Plugin "${plugin.name}" requires plugin "${pluginName}" but it isn't installed!`);
                                hasError = true;
                            }
                            if (!checkVersionRange(dependency.version, plugin.dependencies[pluginName])) {
                                rej(`nSQL: Plugin "${plugin.name}" requires a different version of "${pluginName}"!`);
                                hasError = true;
                            }
                        }
                    });
                }
            });


            // sanity checks on user placed tables and data models
            // plugins and internal tables do not get the sanity check
            config.tables.forEach((table, i) => {
                const l = table.name;
                if (l.indexOf("_") === 0 || l.match(/[\(\)\]\[\.]/g) !== null) {
                    hasError = true;
                    rej(`nSQL: Invalid Table Name ${table.name}! https://docs.nanosql.io/setup/data-models`);
                }
                const types = ["safestr","int","number","float","any","array","uuid","timeId","timeIdms","string","object","obj","map","boolean","bool", "blob", "*"].concat(Object.keys(table.types));
                table.model.forEach((model) => {
                    if (!model.key || !model.type || model.key.match(/[\(\)\]\[\.]/g) !== null || model.key.indexOf("_") === 0) {
                        hasError = true;
                        rej(`nSQL: Invalid Data Model at ${table.name}, ${JSON.stringify(model)}! https://docs.nanosql.io/setup/data-models`);
                        return;
                    }
                    const type = model.type.replace(/[\[\]]/gmi, "");
                    if (types.filter(t => t === type).length === 0) {
                        hasError = true;
                        rej(`nSQL: Uknown type "${model.type}" on column "${model.key}" of table "${table.name}"!`);
                    }
                });
                // replace white space in column names with dashes
                config.tables[i].model = config.tables[i].model.map(k => ({
                    ...k,
                    key: k.key.replace(/\s+/g, "-")
                }));
            });
            if (hasError) return;

            return this.doFilter<configFilter, NanoSQLConfig>("config", { result: config });
        }).then((conf: NanoSQLConfig) => {

            conf.tables.push({
                name: "_util",
                model: [
                    { key: "key", type: "string", props: ["pk()", "ai()"] },
                    { key: "value", type: "any" }
                ]
            });

            conf.tables.push({
                name: "_ttl",
                model: [
                    { key: "key", type: "string", props: ["pk()"] },
                    { key: "table", type: "string" },
                    { key: "cols", type: "string[]" },
                    { key: "date", type: "number" }
                ]
            });

            conf.tables.forEach((table) => {
                this.tables[table.name] = {
                    model: table.model,
                    actions: table.actions || [],
                    views: table.views || [],
                    hasEvents: false,
                    types: {
                        ...(table.types || {}),
                        ...defaultTypes
                    },
                    eventCBs: {
                        "*": new ReallySmallEvents()
                    },
                    pkType: table.model.reduce((p, c) => {
                        if (c.props && c.props.indexOf("pk()") !== -1) return c.type;
                        return p;
                    }, ""),
                    pkCol: table.model.reduce((p, c) => {
                        if (c.props && c.props.indexOf("pk()") !== -1) return c.key;
                        return p;
                    }, ""),
                    ai: table.model.reduce((p, c) => {
                        if (c.props && c.props.indexOf("pk()") !== -1 && c.props.indexOf("ai()") !== -1) return true;
                        return p;
                    }, false),
                    secondaryIdxs: table.model.reduce((p, c) => {
                        if (c.props && c.props.indexOf("idx()") !== -1) {
                            p.push(c.key);
                        }
                        return p;
                    }, []),
                    wildCard: table.model.reduce((p, c) => {
                        if (c.type === "*" && c.key === "*") {
                            return true;
                        }
                        return p;
                    }, false)
                };

                // no primary key found, set one
                if (this.tables[table.name].pkCol === "") {
                    this.tables[table.name].pkCol = "_id_";
                    this.tables[table.name].pkType = "uuid";
                    this.tables[table.name].model.unshift({ key: "_id_", type: "uuid", props: ["pk()"] })
                }
            });

            this.config = conf;

            if (typeof window !== "undefined" && conf && conf.peer) {
                this.state.peerMode = true;
            }

            return this.doFilter<connectFilter, NanoSQLConfig>("connect", {});
        }).then(() => {

            chainAsync(t.plugins, (p, i, nextP) => {
                if (p.willConnect) {
                    p.willConnect(connectArgs, (newArgs) => {
                        connectArgs = newArgs;
                        nextP();
                    });
                } else {
                    nextP();
                }
            }).then(() => {
                t.dataModels = connectArgs.models;
                t._actions = connectArgs.actions;
                t._views = connectArgs.views;
                t.config = connectArgs.config as any;

                Object.keys(t.dataModels).forEach((table) => {
                    let hasWild = false;
                    t.dataModels[table] = t.dataModels[table].filter((model) => {
                        if (model.key === "*" && model.type === "*") {
                            hasWild = true;
                            return false;
                        }
                        return true;
                    });
                    t.skipPurge[table] = hasWild;
                });

                t.plugins.forEach((plugin) => {
                    if (plugin.didExec) {
                        t.pluginHasDidExec = true;
                    }
                });

                t.tableNames = Object.keys(t.dataModels);



                const completeConnect = () => {

                    allAsync(t.plugins, (p, i, nextP) => {
                        if (p.getId && !this.id) {
                            this.id = p.getId();
                        }
                        if (p.didConnect) {
                            p.didConnect(connectArgs, () => {
                                nextP();
                            });
                        } else {
                            nextP();
                        }
                    }).then(() => {

                        // handle peer features with other browser windows/tabs
                        if (this.peerMode) {
                            let counter = 0;
                            if (!this.id) {
                                this.id = this.pid;
                            }
                            // Append this peer to the network
                            this.peers = this.getPeers();
                            this.peers.unshift(this.pid);
                            localStorage.setItem("nsql-peers-" + this.id, JSON.stringify(this.peers));
                            // When localstorage changes we may need to possibly update the peer list
                            // or possibly respond to an event from another peer
                            window.addEventListener("storage", (e) => {
                                // peer list updated
                                if (e.key === "nsql-peers-" + this.id) {
                                    this.peers = this.getPeers();
                                }
                                // recieved event from another peer
                                if (e.key && e.key.indexOf(this.pid + ".") === 0) {
                                    localStorage.removeItem(e.key);
                                    const ev: DatabaseEvent = JSON.parse(e.newValue || "{}");
                                    this.peerEvents.push(ev.query.queryID || "");
                                    this.triggerEvent({
                                        ...ev,
                                        types: ["peer-change"]
                                    });
                                    setFast(() => {
                                        this.triggerEvent(ev);
                                    });
                                }
                                // the "master" peer checks to make sure all peers have been
                                // cleaning up their mess every 50 requests, if they aren't they
                                // are removed. Keeps localStorage from filling up accidentally.
                                counter++;
                                if (counter > 50 && this.peers[0] === this.pid) {
                                    counter = 0;
                                    let len = localStorage.length;
                                    let peerKeys: { [id: string]: string[] } = {};
                                    while (len--) {
                                        const key = localStorage.key(len);
                                        // only grab events
                                        const keyMatch = key ? key.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{8}/gmi) : null;
                                        if (key && keyMatch) {
                                            const peerID = (keyMatch || [""])[0];
                                            if (!peerKeys[peerID]) {
                                                peerKeys[peerID] = [];
                                            }
                                            peerKeys[peerID].push(key);
                                        }
                                    }
                                    Object.keys(peerKeys).forEach((peerID) => {
                                        // purge peers that aren't cleaning up their mess (and thus probably gone)
                                        if (peerKeys[peerID].length > 10) {
                                            this.peers = this.peers.filter(p => p !== peerID);
                                            peerKeys[peerID].forEach((key) => {
                                                localStorage.removeItem(key);
                                            });
                                            localStorage.setItem("nsql-peers-" + this.id, JSON.stringify(this.peers));
                                        }
                                    });
                                }
                            });
                            window.onblur = () => {
                                this.focused = false;
                            };
                            // on focus we set this nsql to focused and move it's peer position
                            // to the front
                            window.onfocus = () => {
                                // set this peer to master on focus
                                this.peers = this.peers.filter((p) => p !== this.pid);
                                this.peers.unshift(this.pid);
                                localStorage.setItem("nsql-peers-" + this.id, JSON.stringify(this.peers));
                                this.focused = true;
                            };
                            // send events to the peer network
                            nSQL("*").on("change", (ev) => {
                                const idxOf = this.peerEvents.indexOf(ev.query.queryID || "");
                                if (idxOf !== -1) {
                                    this.peerEvents.splice(idxOf, 1);
                                    return;
                                }
                                this.peers.filter(p => p !== this.pid).forEach((p) => {
                                    localStorage.setItem(p + "." + ev.query.queryID, JSON.stringify(ev));
                                });
                            });
                            // Remove self from peer network
                            window.addEventListener("beforeunload", () => {
                                this.peers = this.peers.filter((p) => p !== this.pid);
                                localStorage.setItem("nsql-peers-" + this.id, JSON.stringify(this.peers));
                                return false;
                            });
                        }

                        t.isConnected = true;
                        if (t._onConnectedCallBacks.length) {
                            t._onConnectedCallBacks.forEach(cb => cb());
                            t._onConnectedCallBacks = [];
                        }
                        this._checkTTL();
                        res(t.tableNames);
                    });
                };


                const updateDBVersion = () => {
                    if (typeof this.getConfig().version !== "undefined") {
                        t.query("select").where(["key", "=", "db-version"]).manualExec({ table: "_util" }).then((rows) => {
                            if (!rows.length) {
                                t.query("upsert", { key: "db-version", value: this.getConfig().version }).manualExec({ table: "_util" }).then(() => {
                                    completeConnect();
                                });
                                return;
                            }
                            let version = rows.length ? rows[0].value : this.getConfig().version;
                            const upgrade = () => {
                                if (version === this.getConfig().version) {
                                    completeConnect();
                                } else {
                                    if (!this.getConfig().onVersionUpdate) {
                                        version = this.getConfig().version;
                                        upgrade();
                                        return;
                                    }
                                    (this.getConfig() as any).onVersionUpdate(version).then((newVersion) => {
                                        version = newVersion;
                                        setFast(upgrade);
                                    }).catch(rej);
                                }
                            };
                            upgrade();
                        });
                    } else {
                        completeConnect();
                    }
                };

                const updateNSQLVersion = (rebuildIDX: boolean) => {
                    t.query("upsert", { key: "version", value: t.version }).manualExec({ table: "_util" }).then(() => {
                        if (rebuildIDX) {
                            t.extend("beforeConn", "rebuild_idx").then(() => {
                                updateDBVersion();
                            });
                        } else {
                            updateDBVersion();
                        }
                    });
                };

                t.query("select").where(["key", "=", "version"]).manualExec({ table: "_util" }).then((rows) => {

                    if (!rows.length) {
                        // new database or an old one that needs indexes rebuilt
                        updateNSQLVersion(true);
                    } else {

                        if (rows[0].value <= 1.21) { // secondary indexes need to be rebuilt before 1.21
                            updateNSQLVersion(true);
                        } else if (rows[0].value < VERSION) {
                            updateNSQLVersion(false);
                        } else {
                            updateDBVersion();
                        }
                    }
                });

            });
        });
    }

    /**
     * Adds an event listener to the selected database table.
     *
     * @param {("change"|"delete"|"upsert"|"drop"|"select"|"error")} actions
     * @param {Function} callBack
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public on(action: string, callBack: (event: DatabaseEvent) => void): NanoSQLInstance {
        let t = this;
        let l = t.state.selectedTable;
        let i = events.length;

        if (action === "connect") {
            this._eventCBs.core.on("connect", callBack);
            if (this.state.isConnected) {
                callBack({
                    source: "core",
                    table: "*",
                    time: Date.now(),
                    events: ["connect"]
                });
            }
            return this;
        }

        if (action === "disconnect") {
            this._eventCBs.core.on("disconnect", callBack);
            if (!this.state.isConnected) {
                callBack({
                    source: "core",
                    table: "*",
                    time: Date.now(),
                    events: ["disconnect"]
                });
            }
            return this;
        }

        if (Array.isArray(l)) return this;

        if (!t._callbacks[l]) { // Handle the event handler being called before the database has connected
            t._callbacks[l] = new ReallySmallEvents();
        }

        i = a.length;
        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l].on(a[i], callBack);
            }
        }

        return t._refreshEventChecker();
    }

    /**
	 * Remove a specific event handler from being triggered anymore.
	 *
	 * @param {Function} callBack
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public off(action: string, callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance {
        let t = this;
        let a = action.split(" ");
        let i = a.length;
        let l = t.selectedTable;

        if (Array.isArray(l)) return this;

        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l].off(a[i], callBack);
            }
        }
        return t._refreshEventChecker();
    }

    private _refreshEventChecker() {
        this._hasEvents = {};
        Object.keys(this._callbacks).concat(["*"]).forEach((table) => {
            this._hasEvents[table] = this._events.reduce((prev, cur) => {
                return prev + (this._callbacks[table] && this._callbacks[table].eventListeners[cur] ? this._callbacks[table].eventListeners[cur].length : 0);
            }, 0) > 0;
        });

        this.hasAnyEvents = false;

        Object.keys(this._hasEvents).forEach((key) => {
            this.hasAnyEvents = this.hasAnyEvents || this._hasEvents[key];
        });

        return this;
    }


    /**
     * Execute a specific view.  Refernece the "views" function for more description.
     *
     * Example:
     * ```ts
     * NanoSQL("users").getView('view-name',{foo:"bar"}).then(function(result) {
     *  console.log(result) <== view result.
     * })
     * ```
     *
     * @param {string} viewName
     * @param {any} viewArgs
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public getView(viewName: string, viewArgs: any = {}): Promise<any> {
        if (Array.isArray(this.state.selectedTable)) return Promise.reject();
        return this._doAV("View", this.state.selectedTable, viewName, viewArgs);
    }

    /**
     * Init an action for the current selected table. Reference the "actions" method for more info.
     *
     * Example:
     * ```ts
     * NanoSQL("users").doAction('action-name',{foo:"bar"}).then(function(result) {
     *      console.log(result) <== result of your action
     * });
     * ```
     *
     * @param {string} actionName
     * @param {any} actionArgs
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public doAction(actionName: string, actionArgs: any): Promise<any> {
        if (Array.isArray(this.state.selectedTable)) return Promise.reject();
        return this._doAV("Action", this.state.selectedTable, actionName, actionArgs);
    }

    /**
     * Internal function to fire action/views.
     *
     * @private
     * @param {("Action"|"View")} AVType
     * @param {ActionOrView[]} AVList
     * @param {string} AVName
     * @param {*} AVargs
     * @returns {(Promise<Array<DBRow>|NanoSQLInstance>)}
     *
     * @memberOf NanoSQLInstance
     */
    private _doAV(AVType: "Action" | "View", table: string, AVName: string, AVargs: any): Promise<any> {
        return this.doFilter<actionFilter, AVFilterResult>(AVType, {
            result: {
                AVType,
                table,
                AVName,
                AVargs
            }
        }).then((result) => {
            const key = result.AVType === "Action" ? "actions" : "views";

            const selAV: ActionOrView | null = this.tables[result.table][key].reduce((prev, cur) => {
                if (cur.name === result.AVName) return cur;
                return prev;
            }, null as any);

            if (!selAV) {
                return new Promise((res, rej) => rej(`${result.AVType} "${result.AVName}" Not Found!`));
            }

            return selAV.call(selAV.args ? cleanArgs(selAV.args, result.AVargs) : {}, this);
        });
    }


    /**
     * Start a query into the current selected table.
     * Possibl querys are "select", "upsert", "delete", and "drop";
     *
     * ### Select
     *
     * Select is used to pull a set of rows or other data from the table.
     * When you use select the optional second argument of the query is an array of strings that allow you to show only specific columns.
     *
     * Examples:
     * ```ts
     * .query("select") // No arguments, select all columns
     * .query("select",['username']) // only get the username column
     * .query("select",["username","balance"]) //Get two columns, username and balance.
     * .query("select",["count(*)"]) //Get the length of records in the database
     * ```
     *
     * ### Upsert
     *
     * Upsert is used to add or modify data in the database.
     * If the primary key rows are null or undefined, the data will always be added in a new row. Otherwise, you might be updating existing rows.
     * The second argument of the query with upserts is always an Object of the data to upsert.
     *
     * Examples:
     * ```ts
     * .query("upsert",{id:1, username:"Scott"}) //If row ID 1 exists, set the username to scott, otherwise create a new row with this data.
     * .query("upsert",{username:"Scott"}) //Add a new row to the db with this username in the row.
     * .query("upsert",{balance:-35}).where(["balance","<",0]) // If you use a WHERE statement this data will be applied to the rows found with the where statement.
     * ```
     *
     * ### Delete
     *
     * Delete is used to remove data from the database.
     * It works exactly like select, except it removes data instead of selecting it.  The second argument is an array of columns to clear.  If no second argument is passed, the entire row is deleted.
     * If no where argument is passed, the entire table is dropped
     *
     * Examples:
     * ```ts
     * .query("delete",['balance']) //Clear the contents of the balance column on ALL rows.
     * .query("delete",['comments']).where(["accountType","=","spammer"]) // If a where statment is passed you'll only clear the columns of the rows selected by the where statement.
     * .query("delete").where(["balance","<",0]) // remove all rows with a balance less than zero
     * .query("delete") // Same as drop statement
     * ```
     *
     * ### Drop
     *
     * Drop is used to completely clear the contents of a database.  There are no arguments.
     *
     * Drop Examples:
     * ```ts
     * .query("drop")
     * ```
     *
     * @param {("select"|"upsert"|"delete"|"drop")} action
     * @param {any} [args]
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public query(action: string, args?: any): _NanoSQLQuery {
        const av = this.state.activeAV;
        this.state.activeAV = "";
        return new _NanoSQLQuery(this, this.state.selectedTable, action, args, av);
    }

    public triggerQuery(query: IdbQuery, onProgress: (row: any) => void, complete: () => void, error: (err: string) => void): void {
        if (this.state.isConnected === false && typeof query.table === "string") {
            error("nSQL: Can't do a query before the database is connected!");
            return;
        }

        this.doFilter<queryFilter, IdbQuery>("query", { result: query }).then((setQuery) => {

        }).catch(error);
    }

    /**
     * Trigger a database event
     *
     * @param {DatabaseEvent} eventData
     *
     * @memberOf NanoSQLInstance
     */
    public triggerEvent(eventData: DatabaseEvent): NanoSQLInstance {
        let t = this;

        this.doFilter<eventFilter, DatabaseEvent>("event", { result: eventData }).then((event) => {

        }).catch((err) => {
            console.error("Event suppressed", err);
        });

        if (t._hasEvents["*"] || t._hasEvents[eventData.table]) {
            if (eventData.table === "*") return this;
            setFast(() => {
                let c: Function[];

                eventData.types.forEach((type) => {
                    // trigger wildcard
                    t._callbacks["*"].trigger(type, eventData, t);
                    t._callbacks["*"].trigger("*", eventData, t);

                    // trigger specific table
                    if (eventData.table && t._callbacks[eventData.table]) {
                        t._callbacks[eventData.table].trigger(type, eventData, t);
                    }
                });
            });
        }

        return t;
    }

    /**
     * Returns a default object for the current table's data model, useful for forms.
     *
     * The optional argument lets you pass in an object to over write the data model's defaults as desired.
     *
     * Examples:
     *
     * ```ts
     * console.log(nSQL("users").default()) <= {username:"none", id:undefined, age: 0}
     * console.log(nSQL("users").default({username:"defalt"})) <= {username:"default", id:undefined, age: 0}
     * ```
     *
     * DO NOT use this inside upsert commands like `.query("upsert",NanoSQL("users").defalt({userObj}))..`.
     * The database defaults are already applied through the upsert path, you'll be doing double work.
     *
     * Only use this to pull default values into a form in your UI or similar situation.
     *
     * @param {*} [replaceObj]
     * @returns {{[key: string]: any}}
     *
     * @memberOf NanoSQLInstance
     */
    public default(replaceObj?: any, table?: string): { [key: string]: any } {
        let newObj = {};
        replaceObj = replaceObj || {};
        if (!table && Array.isArray(this.state.selectedTable)) {
            throw new Error("Can't use array to generate row defaults!");
        }
        table = table || this.state.selectedTable as any;
        if (!this.tables[table]) {
            throw new Error(`nSQL: Table "${table}" not found for generating default object!`);
        }

        this.tables[table].model.forEach((m) => {
            const type = m.type.replace(/[\[\]]/gmi, "");
                // set key to object argument or the default value in the data model
                newObj[m.key] = typeof replaceObj[m.key] !== "undefined" ? replaceObj[m.key] : m.default;
                newObj[m.key] = cast(m.type, this.tables[table].types, newObj[m.key]);
        });

        return newObj;
    }


    /**
     * Get the raw contents of the database, provides all tables.
     *
     * Optionally pass in the tables to export.  If no tables are provided then all tables will be dumped.
     *
     * @returns
     * @memberof NanoSQLInstance
     */
    public rawDump(tables: string[], onRow: (table: string, row: { [key: string]: any }) => void): Promise<any> {
        const exportTables = Object.keys(this.tables).filter(t => tables.length ? tables.indexOf(t) !== -1 : true);

        return chainAsync(exportTables, (table: string, i, nextTable, err) => {
            this.adapter.readAll(table, (row, nextRow) => {
                onRow(table, row);
                nextRow();
            }, nextTable, err);
        });
    }

    /**
     * Import table data directly into the datatabase.
     * Signifincatly faster than .loadJS but doesn't do type checking, indexing or anything else fancy.
     *
     * @param {{[table: string]: DBRow[]}} tables
     * @returns
     * @memberof NanoSQLInstance
     */
    public rawImport(tables: { [table: string]: { [key: string]: any }[] }, onProgress?: (percent: number) => void): Promise<any> {

        let progress = 0;
        const totalLength = Object.keys(tables).reduce((p, c) => {
            return p += tables[c].length, p;
        }, 0);

        return chainAsync(Object.keys(tables), (table, i, next, err) => {
            const pk = this.tables[table].pkCol;
            chainAsync(tables[table], (row, ii, nextRow, rowErr) => {
                if (!row[pk]) {
                    rowErr("No primary key found, can't import: " + JSON.stringify(row));
                    return;
                }
                this.adapter.write(table, row[pk], row, (newRow) => {
                    nextRow();
                    progress++;
                    if (onProgress) onProgress(Math.round((progress / totalLength) * 10000) / 100);
                }, rowErr);
            }).then(next).catch(err);
        });
    }


    /**
     * Request disconnect from all databases.
     *
     * @returns
     * @memberof NanoSQLInstance
     */
    public disconnect() {
        return this.doFilter<disconnectFilter, boolean>("disconnect", { result: true }).then((doDisconnect) => {
            return new Promise((res, rej) => {
                if (doDisconnect) {
                    this.adapter.disconnect(res, rej);
                } else {
                    rej("Disconnect aborted by a plugin!");
                }
            });
        });
    }


    /**
     * Init obvserable query.
     *
     * Usage:
     * ```ts
     * nSQL()
     * .observable(() => nSQL("message").query("select").emit())
     * .filter((rows, idx) => rows.length > 0)
     * .subscribe((rows, event) => {
     *
     * });
     *
     * ```
     *
     * @template T
     * @param {((ev?: DatabaseEvent) => IdbQueryExec|undefined)} getQuery
     * @param {string[]} [tablesToListen]
     * @returns {Observer<T>}
     * @memberof NanoSQLInstance
     */
    public observable<T>(getQuery: (ev?: DatabaseEvent) => IdbQuery | undefined, tablesToListen?: string[]): Observer<T> {
        return new Observer<T>(this, getQuery, tablesToListen || []);
    }

    /**
     * Perform a custom action supported by the database driver.
     *
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf NanoSQLInstance
     */
    public extend(scope: string, ...args: any[]): any | NanoSQLInstance {
        return this.doFilter<extendFilter, { result: any }>("extend", { scope: scope, args: args, result: null });
    }

    /**
     * Load JSON directly into the DB.
     * JSON must be an array of maps, like this:
     * ```ts
     * [
     *  {"name":"billy","age":20},
     *  {"name":"johnny":"age":30}
     * ]
     * ```
     *
     * Rows must align with the data model.  Row data that isn't in the data model will be ignored.
     *
     * @param {string} table
     * @param {Array<Object>} rows
     * @returns {Promise<Array<Object>>}
     *
     * @memberOf NanoSQLInstance
     */
    public loadJS(rows: { [key: string]: any }[], onProgress?: (percent: number) => void): Promise<any[]> {
        let t = this;

        const table = this.state.selectedTable;

        if (Array.isArray(table)) {
            return Promise.reject("nSQL: Can't load JS into temporary table!");
        }

        return chainAsync(rows, (row, i, nextRow, err) => {
            if (onProgress) onProgress(Math.round(((i + 1) / rows.length) * 10000) / 100);
            this.triggerQuery({
                ...buildQuery(table, "upsert"),
                actionArgs: row
            }, noop, nextRow, err);
        });
    }

    /**
     * Convert a JSON array of objects to a CSV.
     *
     * @param {any[]} json
     * @param {boolean} [printHeaders]
     * @param {string[]} [useHeaders]
     * @returns {string}
     * @memberof NanoSQLInstance
     */
    public JSONtoCSV(json: any[], printHeaders?: boolean, useHeaders?: string[]): string {
        let csv: string[] = [];
        if (!json.length) {
            return "";
        }
        let columnHeaders: string[] = [];
        if (useHeaders) {
            // use provided headers (much faster)
            columnHeaders = useHeaders;
        } else {
            // auto detect headers
            json.forEach((json) => {
                columnHeaders = Object.keys(json).concat(columnHeaders);
            });
            columnHeaders = columnHeaders.filter((v, i, s) => s.indexOf(v) === i);
        }

        if (printHeaders) {
            csv.push(columnHeaders.join(","));
        }

        json.forEach((row) => {
            csv.push(columnHeaders.map((k) => {
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
    }

    public csvToArray(text: string): any[] {
        // tslint:disable-next-line
        let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
        for (l of text) {
            // tslint:disable-next-line
            if ('"' === l) {
                if (s && l === p) row[i] += l;
                s = !s;
                // tslint:disable-next-line
            } else if (',' === l && s) l = row[++i] = '';
            // tslint:disable-next-line
            else if ('\n' === l && s) {
                // tslint:disable-next-line
                if ('\r' === p) row[i] = row[i].slice(0, -1);
                // tslint:disable-next-line
                row = ret[++r] = [l = '']; i = 0;
            } else row[i] += l;
            p = l;
        }
        return ret[0];
    }

    /**
     * Convert a CSV to array of JSON objects
     *
     * @param {string} csv
     * @param {(row: any) => any} [rowMap]
     * @returns {*}
     * @memberof NanoSQLInstance
     */
    public CSVtoJSON(csv: string, rowMap?: (row: any) => any): any {
        let t = this;
        let fields: Array<string> = [];
        return csv.split(/\r?\n|\r|\t/gm).map((v, k) => {
            if (k === 0) {
                fields = v.split(",");
                return undefined;
            } else {

                let row = this.csvToArray(v);
                if (!row) return undefined;
                row = row.map(r => r.trim());

                let i = fields.length;
                let record: { [key: string]: any } = {};
                while (i--) {
                    if (row[i]) {
                        if (row[i] === "true" || row[i] === "false") {
                            record[fields[i]] = row[i] === "true";
                        } else if (row[i].indexOf("{") === 0 || row[i].indexOf("[") === 0) {
                            // tslint:disable-next-line
                            try {
                                record[fields[i]] = JSON.parse(row[i]);
                            } catch (e) {
                                record[fields[i]] = row[i];
                            }
                            // tslint:disable-next-line
                        } else if (row[i].indexOf('"') === 0) {
                            record[fields[i]] = row[i].slice(1, row[i].length - 1).replace(/\"\"/gmi, "\"");
                        } else {
                            record[fields[i]] = row[i];
                        }
                    }
                }

                if (rowMap) {
                    return rowMap(record);
                }
                return record;
            }
        }).filter(r => r);
    }

    /**
     * Load a CSV file into the DB.  Headers must exist and will be used to identify what columns to attach the data to.
     *
     * This function performs a bunch of upserts, so expect appropriate behavior based on the primary key.
     *
     * Rows must align with the data model.  Row data that isn't in the data model will be ignored.
     *
     * @param {string} csv
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public loadCSV(csv: string, rowMap?: (row: any) => any, onProgress?: (percent: number) => void): Promise<any[]> {

        const table = this.state.selectedTable;

        if (Array.isArray(table)) {
            return Promise.reject("nSQL: Can't load CSV into temporary table!");
        }

        let rowData = this.CSVtoJSON(csv, rowMap);

        return chainAsync(rowData, (row, i, nextRow, err) => {
            if (onProgress) onProgress(Math.round(((i + 1) / rowData.length) * 10000) / 100);
            this.triggerQuery({
                ...buildQuery(table, "upsert"),
                actionArgs: row
            }, noop, nextRow, err);
        });
    }
}


/**
 * @internal
 */
let _NanoSQLStatic = new NanoSQLInstance();

export const nSQL = (setTablePointer?: string | any[]) => {
    return _NanoSQLStatic.table(setTablePointer);
};

if (typeof window !== "undefined") {
    window["nano-sql"] = {
        nSQL: nSQL,
        NanoSQLInstance: NanoSQLInstance
    };
}

/*
const blankRow = { affectedRowPKS: [], affectedRows: [] };


const runQuery = (self: _NanoSQLQuery, complete: (result: DBRow[]) => void, error: (err: Error) => void) => {

    if (self._query.state === "pending") {
        self._query.state = "executing";
    } else {
        error(new Error("nSQL: Can't call query twice!"));
        return;
    }

    if (self._db.plugins.length === 1 && !self._db.hasAnyEvents && !self._query.ttl) {

        // fast query path, only used if there's a single plugin, no event listeners and no ttl
        (self._db.plugins[0] as any).doExec(self._query, (newQ) => {
            self._query = newQ;
            if (self._db.hasPK[self._query.table as string]) {
                complete(self._query.result);
            } else {
                complete(self._query.result.map(r => ({ ...r, _id_: undefined })));
            }

        }, error);
    } else {

        chainAsync(self._db.plugins, (p: NanoSQLPlugin, i, nextP, pluginErr) => {
            if (p.doExec) {
                p.doExec(self._query as any, (newQ) => {
                    self._query = newQ || self._query;
                    nextP();
                }, pluginErr);
            } else {
                nextP();
            }
        }).then(() => {

            if (self._db.hasPK[self._query.table as string]) {
                complete(self._query.result);
            } else {
                complete(self._query.result.map(r => ({ ...r, _id_: undefined })));
            }

            if (self._db.hasAnyEvents || self._db.pluginHasDidExec || self._query.ttl) {

                const eventTypes: ("change" | "delete" | "upsert" | "drop" | "select" | "error" | "transaction")[] = (() => {
                    switch (self._query.action) {
                        case "select": return [self._query.action];
                        case "delete":
                        case "upsert":
                        case "drop": return [self._query.action, "change"];
                        default: return [] as any[];
                    }
                })();

                const hasLength = self._query.result && self._query.result.length;


                let event: DatabaseEvent = {
                    table: self._query.table as string,
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

                if ((event.affectedRowPKS || []).length && self._query.ttl) {
                    const TTL = Date.now() + ((self._query.ttl || 0) * 1000);
                    chainAsync(event.affectedRowPKS || [], (pk, i, next) => {
                        self._db.query("upsert", {
                            key: self._query.table + "." + pk,
                            table: self._query.table,
                            cols: self._query.ttlCols,
                            date: TTL
                        }).manualExec({ table: "_ttl" }).then(next);
                    }).then(() => {
                        self._db._checkTTL();
                    });

                }

                chainAsync(self._db.plugins, (p, i, nextP) => {
                    if (p.didExec) {
                        p.didExec(event, (newE) => {
                            event = newE;
                            nextP();
                        });
                    } else {
                        nextP();
                    }
                }).then(() => {
                    if (!self._query.transaction) {
                        self._db.triggerEvent(event);
                    }
                });
            }
        }).catch(error);
    }
};

let debounceTimers: {
    [key: string]: any;
} = {};
*/

// tslint:disable-next-line
export class _NanoSQLQuery {

    public _db: NanoSQLInstance;

    public _error: string;

    public _AV: string;

    public _query: IdbQuery;

    public static execMap: any;

    constructor(db: NanoSQLInstance, table: string | any[], queryAction: string, queryArgs?: any, actionOrView?: string) {
        this._db = db;

        this._AV = actionOrView || "";
        this._query = {
            ...buildQuery(table as string, queryAction),
            comments: [],
            state: "pending",
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
    public where(args: any[] | ((row: {[key: string]: any}) => boolean)): _NanoSQLQuery {
        this._query.where = args;
        return this;
    }

    public from(tableOrQuery: () => Promise<any[]> | string | any[]): _NanoSQLQuery {
        if (typeof tableOrQuery === "string" || Array.isArray(tableOrQuery)) {
            this._query.table = tableOrQuery;
        } else {
            this._query.from = tableOrQuery as any;
        }
        return this;
    }

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
    public orderBy(args: { [key: string]: "asc" | "desc" }): _NanoSQLQuery {
        this._query.orderBy = args;
        return this;
    }

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
    public groupBy(columns: { [key: string]: "asc" | "desc" }): _NanoSQLQuery {
        this._query.groupBy = columns;
        return this;
    }

    /**
     * Having statement, used to filter Group BY statements. Syntax is identical to where statements.
     *
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public having(args: any[] | ((row: {[key: string]: any}) => boolean)): _NanoSQLQuery {
        this._query.having = args;
        return this;
    }

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
    public join(args: JoinArgs | JoinArgs[]): _NanoSQLQuery {
        const err = "Join commands requires table and type arguments!";
        if (Array.isArray(args)) {
            args.forEach((arg) => {
                if (!arg.table || !arg.type) {
                    this._error = err;
                }
            });
        } else {
            if (!args.table || !args.type) {
                this._error = err;
            }
        }

        this._query.join = args;
        return this;
    }

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
    public limit(args: number): _NanoSQLQuery {
        this._query.limit = args;
        return this;
    }

    /**
     * Pass comments along with the query.
     * These comments will be emitted along with the other query datay by the event system, useful for tracking queries.
     *
     * @param {string} comment
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    public comment(comment: string): _NanoSQLQuery {
        this._query.comments.push(comment);
        return this;
    }

    /**
     * Perform custom actions supported by plugins.
     *
     * @param {...any[]} args
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    public extend(scope: string, ...args: any[]): _NanoSQLQuery {
        this._query.extend.push({ scope: scope, args: args });
        return this;
    }

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
    public offset(args: number): _NanoSQLQuery {
        this._query.offset = args;
        return this;
    }

    /**
     * Export the built query object.
     *
     * @returns {IdbQueryExec}
     * @memberof _NanoSQLQuery
     */
    public emit(): IdbQuery {
        return this._query;
    }

    /**
     * Delete inserted/updated row after a given time.
     *
     * Provide array of column names to just clear specific columns.
     * Leave array empty to delete entire row
     *
     * @param {number} [seconds=60]
     * @returns {_NanoSQLQuery}
     * @memberof _NanoSQLQuery
     */
    public ttl(seconds: number = 60, cols?: string[]): _NanoSQLQuery {
        if (this._query.action !== "upsert") {
            throw new Error("nSQL: Can only do ttl on upsert queries!");
        }
        this._query.ttl = seconds;
        this._query.ttlCols = cols || [];
        return this;
    }


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
    public toCSV(headers?: boolean): any {
        let t = this;
        return t.exec().then((json: any[]) => Promise.resolve(t._db.JSONtoCSV(json, headers)));
    }

    public stream(onRow: (row: any) => void, complete: () => void, err: (error: any) => void): void {
        this._db.triggerQuery(this._query, onRow, complete, err);
    }

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
    public exec(): Promise<{ [key: string]: any }[]> {

        return new Promise((res, rej) => {
            let rows: any[] = [];
            this.stream((row) => {
                rows.push(row);
            }, () => {
                res(rows);
            }, rej);
        });

        /*
        // handle instance queries
        if (Array.isArray(this._query.table)) {
            return new Promise((res, rej) => {
                if (this._db.iB.doExec) {
                    this._db.iB.doExec(this._query, (q) => {
                        res(q.result);
                    }, rej);
                }
            });
        }



        if (this._query.table === "*") return Promise.resolve([]);

        let t = this;

        const a = (this._query.action || "").toLowerCase().trim();

        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) > -1) {

            let newArgs = this._query.actionArgs || (a === "select" ? [] : {});
            let setArgs: any = [];
            if (a === "upsert") {

                if (Array.isArray(newArgs)) {
                    setArgs = newArgs;
                } else {
                    setArgs = [newArgs];
                }

                setArgs.forEach((nArgs, i) => {
                    // Do Row Filter
                    if (this._db.rowFilters[this._query.table as string]) {
                        setArgs[i] = this._db.rowFilters[this._query.table as string](setArgs[i]);
                    }

                    // Cast row types and remove columns that don't exist in the data model
                    let inputArgs = {};
                    const models = this._db.dataModels[this._query.table as string];

                    let k = 0;
                    while (k < models.length) {
                        if (setArgs[i][models[k].key] !== undefined) {
                            inputArgs[models[k].key] = cast(models[k].type, setArgs[i][models[k].key]);
                        }
                        k++;
                    }

                    // insert wildcard columns
                    if (this._db.skipPurge[this._query.table as string]) {
                        const modelColumns = models.map(m => m.key);
                        const columns = Object.keys(setArgs[i]).filter(c => modelColumns.indexOf(c) === -1); // wildcard columns
                        columns.forEach((col) => {
                            inputArgs[col] = setArgs[i][col];
                        });
                    }

                    setArgs[i] = inputArgs;
                });


            } else {
                setArgs = this._query.actionArgs;
            }

            this._query.action = a;
            this._query.actionArgs = this._query.actionArgs ? setArgs : undefined;
        } else {
            return Promise.reject(new Error("nSQL: No valid database action!"));
        }

        return new Promise((res, rej) => {

            const runExec = () => {
                if (!t._db.plugins.length) {
                    t._error = "nSQL: No plugins, nothing to do!";
                }

                if (t._error) {
                    rej(t._error);
                    return;
                }

                if (this._db.queryMod) {

                    const pr = this._db.queryMod(this._query, (newQ) => {
                        this._query = newQ;
                        runQuery(this, res, rej);
                    });

                    if (typeof pr !== "undefined") {
                        pr.then((_query) => {
                            this._query = _query;
                            runQuery(this, res, rej);
                        })
                            .catch(rej);
                    }

                } else {
                    runQuery(this, res, rej);
                }
            };

            if (this._db.isConnected || (this._query.table as string).indexOf("_") === 0) {
                runExec();
            } else {
                this._db.onConnected(runExec);
            }
            
        });
        */
    }
}