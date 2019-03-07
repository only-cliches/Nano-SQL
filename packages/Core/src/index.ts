import { ReallySmallEvents } from "really-small-events";
import {
    assign,
    allAsync,
    cast,
    cleanArgs,
    chainAsync,
    uuid as uuidFN,
    noop,
    throwErr,
    setFast,
    resolvePath,
    isSafari,
    deepGet,
    buildQuery,
    _nanoSQLQueue,
    adapterFilters,
    cleanArgs2
} from "./utilities";
import {
    InanoSQLConfig,
    InanoSQLFunction,
    InanoSQLActionOrView,
    InanoSQLQuery,
    disconnectFilter,
    InanoSQLDatabaseEvent,
    extendFilter,
    queryFilter,
    eventFilter,
    configFilter,
    actionViewFilter,
    InanoSQLAdapter,
    willConnectFilter,
    readyFilter,
    InanoSQLTableColumn,
    InanoSQLTableConfig,
    InanoSQLTable,
    InanoSQLInstance,
    InanoSQLQueryBuilder,
    customEventFilter,
    VERSION,
    TableQueryResult,
    postConnectFilter,
    onEventFilter,
    offEventFilter,
    InanoSQLV1ConfigFn,
    InanoSQLFKActions,
    uuid
} from "./interfaces";
import { attachDefaultFns } from "./functions";
import { _nanoSQLQuery } from "./query";
import { _nanoSQLQueryBuilder } from "./query-builder";
import * as utils from "./utilities";
import { resolveMode } from "./adapter-detect";


export {
    InanoSQLInstance
}

// tslint:disable-next-line
export class nanoSQL implements InanoSQLInstance {

    public config: InanoSQLConfig;

    public adapter: InanoSQLAdapter;

    public version: number = VERSION;

    public filters: {
        [filterName: string]: ((inputArgs: any, complete: (args: any) => void, cancel: (info: any) => void) => void)[];
    };

    public functions: {
        [fnName: string]: InanoSQLFunction;
    };

    public planetRadius: number = 6371;

    public _tables: {
        [tableName: string]: InanoSQLTable;
    };

    public _tableIds: {
        [tableName: string]: string;
    }

    public _fkRels: {
        [tableName: string]: {
            selfPath: string[];
            selfIsArray: boolean;
            onDelete: InanoSQLFKActions;
            childTable: string;
            childPath: string[];
            childIsArray: boolean;
            childIndex: string;
        }[];
    }

    public state: {
        activeAV: string;
        hasAnyEvents: boolean;
        id: string;
        pid: string;
        peers: string[];
        peerEvents: string[];
        focused: boolean;
        peerMode: boolean;
        cacheId: uuid,
        connected: boolean;
        ready: boolean;
        exportQueryObj: boolean;
        selectedTable: string | any[] | ((where?: any[] | ((row: { [key: string]: any }, i?: number) => boolean)) => Promise<TableQueryResult>);
    };

    public _queryCache: {
        [id: string]: any[];
    };

    public indexTypes: {
        [type: string]: (value: any) => any;
    };

    public eventFNs: {
        Core: { [path: string]: ReallySmallEvents };
        [eventName: string]: { [path: string]: ReallySmallEvents };
    };

    private _Q = new _nanoSQLQueue();

    constructor() {

        this.state = {
            activeAV: "",
            hasAnyEvents: false,
            peers: [],
            pid: uuidFN(),
            id: uuidFN(),
            cacheId: uuidFN(),
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

        const str = (value: any) => {
            return typeof value === "object" ? JSON.stringify(value) : String(value);
        };
        const num = (parseFn: (string: any) => number) => {
            return (value: any) => {
                return isNaN(value) || value === null ? 0 : parseFn(value);
            }
        }
        this.indexTypes = {
            string: str,
            geo: (value: any) => {
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
                "*": new ReallySmallEvents()
            },
            "*": { "*": new ReallySmallEvents() }
        };
        this._checkTTL = this._checkTTL.bind(this);
        attachDefaultFns(this);
    }

    public _rebuildFKs() {
        // bust memoized caches
        this.state.cacheId = uuidFN();

        this._fkRels = {};
        Object.keys(this._tables).forEach((tableName) => {
            const table = this._tables[tableName];
            Object.keys(table.indexes).forEach((indexName) => {
                const index = table.indexes[indexName];
                if (index.props && index.props.foreignKey) {
                    const path = resolvePath(index.props.foreignKey.target);
                    const remoteTable = path.shift() as string;
                    if (!this._fkRels[remoteTable]) {
                        this._fkRels[remoteTable] = [];
                    }

                    this._fkRels[remoteTable].push({
                        selfPath: path.map(s => s.replace(/\[\]/gmi, "")),
                        selfIsArray: index.props.foreignKey.target.indexOf("[]") !== -1,
                        childTable: tableName,
                        childPath: index.path,
                        childIsArray: index.isArray,
                        childIndex: indexName,
                        onDelete: index.props.foreignKey.onDelete || InanoSQLFKActions.NONE
                    });
                }
            })
        });
    }

    public doFilter<T>(filterName: string, args: T, complete: (result: T) => void, cancelled: (abortInfo: any) => void): void {
        if (this.filters[filterName]) {
            chainAsync(this.filters[filterName], (item, i, nextFilter) => {
                this.filters[filterName][i](args, (newArgs) => {
                    args = newArgs;
                    nextFilter();
                }, cancelled);
            }).then(() => {
                complete(args);
            });
        } else {
            complete(args);
        }
    }

    public getCache(id: string, args?: { offset: number, limit: number }): any[] {
        if (!this._queryCache[id]) {
            throw new Error(`Cache "${id}" not found!`);
        }
        if (args) {
            return this._queryCache[id].slice(args.offset, args.offset + args.limit);
        } else {
            return this._queryCache[id].slice();
        }
    }

    public clearCache(id: string): boolean {
        const exists = this._queryCache[id] !== undefined;
        delete this._queryCache[id];
        return exists;
    }

    public clearTTL(primaryKey: any): Promise<any> {
        const k = this.state.selectedTable + "." + primaryKey;
        return new Promise((res, rej) => {
            this.triggerQuery({
                ...buildQuery(this, "_ttl", "delete"),
                where: ["key", "=", k]
            }, noop, res, rej);
        });
    }

    public expires(primaryKey: any): Promise<any> {
        return new Promise((res, rej) => {
            const k = this.state.selectedTable + "." + primaryKey;
            let rows: any[] = [];
            this.triggerQuery({
                ...buildQuery(this, "_ttl", "select"),
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

    public _ttlTimer: any;

    public _checkTTL() {
        if (this.config.disableTTL) return;

        if (this._ttlTimer) {
            clearTimeout(this._ttlTimer);
        }
        let page = 0;
        let nextTTL = 0;
        const getPage = () => {
            let rows: any[] = [];
            this.triggerQuery({
                ...buildQuery(this, "_ttl", "select"),
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
                                ...buildQuery(this, "_ttl", "delete"),
                                where: ["key", "=", row.key]
                            }, noop, next, throwErr);
                        };
                        const rowData = row.key.split(".");
                        const table = rowData[0];
                        const key = ["float", "int", "number"].indexOf(this._tables[table].pkType) === -1 ? rowData[1] : parseFloat(rowData[1]);
                        if (row.cols.length) {
                            let upsertObj = {};
                            row.cols.forEach((col) => {
                                upsertObj[col] = null;
                            });
                            this.triggerQuery({
                                ...buildQuery(this, table, "upsert"),
                                actionArgs: upsertObj,
                                where: [this._tables[table].pkCol, "=", key]
                            }, noop, clearTTL, throwErr);
                        } else {
                            this.triggerQuery({
                                ...buildQuery(this, table, "delete"),
                                where: [this._tables[table].pkCol, "=", key]
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

    public selectTable(table?: string | any[] | ((where?: any[] | ((row: { [key: string]: any }, i?: number) => boolean)) => Promise<TableQueryResult>)): InanoSQLInstance {
        if (table) this.state.selectedTable = table;
        return this;
    }

    public getPeers() {
        return JSON.parse(localStorage.getItem("nsql-peers-" + this.state.id) || "[]");
    }

    public _initPlugins(config: InanoSQLConfig): Promise<any> {
        return new Promise((res, rej) => {


            // Build plugin filters
            let filterObj: { [filterName: string]: any[] } = {};

            (config.plugins || []).forEach((plugin) => {
                (plugin.filters || []).forEach((filter) => {
                    if (!filterObj[filter.name]) {
                        filterObj[filter.name] = [];
                    }
                    // prevent priority conflicts
                    let priority = filter.priority;
                    while (filterObj[filter.name][priority]) {
                        priority++;
                    }
                    // set callback
                    filterObj[filter.name][priority] = filter.call;
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
                    return version >= range[0] && version < range[1];
                }
            };

            let hasError = false;

            // check that dependencies are satisfied
            (config.plugins || []).forEach((plugin) => {
                if (plugin.dependencies) {
                    const dependencies = plugin.dependencies || {};
                    Object.keys(plugin.dependencies).forEach((pluginName: string, i, next) => {
                        if (pluginName === "core") {
                            if (!checkVersionRange(VERSION, dependencies[pluginName])) {
                                hasError = true;
                                rej(`Plugin "${plugin.name}" requires a different core version of nano-sql!`);
                            }
                        } else {
                            const dependency = (config.plugins || []).reduce((p, c) => c.name === pluginName ? c : p);
                            if (!dependency) {
                                hasError = true;
                                rej(`Plugin "${plugin.name}" requires plugin "${pluginName}" but it isn't installed!`);
                            }
                            if (!checkVersionRange(dependency.version, dependencies[pluginName])) {
                                hasError = true;
                                rej(`Plugin "${plugin.name}" requires a different version of "${pluginName}"!`);
                            }
                        }
                    });
                }
            });
            if (!hasError) {
                res();
            }
        });
    }

    public _saveTableIds(): Promise<any> {
        return new Promise((res, rej) => {
            this.triggerQuery({
                ...buildQuery(this, "_util", "upsert"),
                actionArgs: assign({
                    key: "tableIds",
                    value: this._tableIds
                })
            }, noop, res, rej);
        })
    }

    public presetQuery(fn: string): {
        promise: (args: any) => Promise<any[]>;
        stream: (args: any, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => void
    } {
        if (typeof this.state.selectedTable !== "string") {
            throw new Error(`Can't get table queries without selecting a table!`);
        }
        let found = Object.keys(this._tables[this.state.selectedTable].queries).indexOf(fn) !== -1;
        if (!found) {
            throw new Error(`Can't find preset query ${fn}!`);
        }

        let queryRunning = false;

        return {
            promise: (args: any) => {
                return new Promise((res, rej) => {
                    if (queryRunning) {
                        rej(`Query already streaming!`);
                        return;
                    }
                    queryRunning = true;
                    const fnArgs = this._tables[this.state.selectedTable as string].queries[fn].args;
                    let filteredArgs: any = {};
                    if (fnArgs) {
                        filteredArgs = cleanArgs2(args, fnArgs, this);
                    }

                    let buffer: any[] = [];
                    this._tables[this.state.selectedTable as string].queries[fn].call(this, filteredArgs, (row) => {
                        buffer.push(row);
                    }, () => {
                        res(buffer);
                    }, rej);
                })
            },
            stream: (args: any, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void) => {
                if (queryRunning) {
                    error("Query already using promise!");
                    return;
                }
                queryRunning = true;
                const fnArgs = this._tables[this.state.selectedTable as string].queries[fn].args;
                let filteredArgs: any = {};
                if (fnArgs) {
                    filteredArgs = cleanArgs2(args, fnArgs, this);
                }
                this._tables[this.state.selectedTable as string].queries[fn].call(this, filteredArgs, onRow, complete, error);
            }
        }
    }

    public connect(config: InanoSQLConfig): Promise<any> {
        let t = this;

        return this._initPlugins(config).then(() => {
            return new Promise((res, rej) => {
                this.doFilter<configFilter>("config", { res: config }, (r) => {
                    res(r.res);
                }, rej);
            });
        }).then((conf: InanoSQLConfig) => {
            this.state.id = conf.id || "nSQL_DB";

            this.config = {
                plugins: [],
                ...conf
            };

            if (typeof window !== "undefined" && conf && conf.peer) {
                this.state.peerMode = true;
            }
            return new Promise((res, rej) => {
                this.doFilter<willConnectFilter>("willConnect", { res: this }, () => { res() }, rej);
            });
        }).then(() => {
            // setup and connect adapter
            return new Promise((res, rej) => {


                this.adapter = resolveMode(this.config.mode || "TEMP", this.config);


                if (this.adapter.plugin) {
                    (this.config.plugins || []).push(this.adapter.plugin);
                }

                this._initPlugins(this.config).then(() => {
                    this.adapter.nSQL = this;
                    adapterFilters(this).connect(this.state.id, () => {
                        this.doFilter<postConnectFilter>("postConnect", { res: this.config }, (config) => {
                            this.config = config.res;
                            res();
                        }, rej)
                    }, rej);
                }).catch(rej);

                if (this.config.planetRadius) {
                    this.planetRadius = this.config.planetRadius;
                }

            });
        }).then(() => {

            this.triggerEvent({
                target: "Core",
                targetId: this.state.id,
                path: "*",
                events: ["connect"],
                time: Date.now()
            });
            this.state.connected = true;

            const tables = ["_util", "_ttl"].concat((this.config.tables || []).map(t => t.name));

            return chainAsync(tables, (j, i, next, err) => {
                switch (j) {
                    case "_util":
                        this.triggerQuery({
                            ...buildQuery(this, "_util", "create table"),
                            actionArgs: {
                                name: "_util",
                                model: {
                                    "key:string": { pk: true },
                                    "value:any": {}
                                },
                                _internal: true
                            }
                        }, noop, () => {
                            this.triggerQuery({
                                ...buildQuery(this, "_util", "select"),
                                where: ["key", "=", "tableIds"]
                            }, (row) => {
                                this._tableIds = {
                                    ...this._tableIds,
                                    ...row.value
                                }
                            }, () => {
                                next();
                            }, err);
                        }, err);
                        break;
                    case "_ttl":
                        this.triggerQuery({
                            ...buildQuery(this, "_ttl", "create table"),
                            actionArgs: {
                                name: "_ttl",
                                model: {
                                    "key:string": { pk: true },
                                    "table:string": {},
                                    "cols:string[]": {},
                                    "date:number": {}
                                },
                                _internal: true
                            }
                        }, noop, next, err);
                        break;
                    default:
                        const model = (this.config.tables || []).filter(t => t.name === j)[0];
                        if (!model) {
                            err("Table not found!");
                            return;
                        }
                        this.triggerQuery({
                            ...buildQuery(this, j, "create table"),
                            actionArgs: model
                        }, noop, next as any, err);
                }
            });
        }).then(() => {

            // migrate nanosql version as needed
            return new Promise((res, rej) => {
                let currentVersion: number;
                this.triggerQuery({
                    ...buildQuery(this, "_util", "select"),
                    where: ["key", "=", "version"]
                }, (row) => {
                    if (row) currentVersion = row.value;
                }, () => {
                    if (!currentVersion || currentVersion < 2.0) {
                        this.triggerQuery({
                            ...buildQuery(this, "_util", "upsert"),
                            actionArgs: { key: "version", value: VERSION }
                        }, noop, res, rej);
                    } else {
                        // no migration code right now
                        res();
                    }
                }, rej);
            });
        }).then(() => {

            // migrate user database version as needed
            return new Promise((res, rej) => {
                if (!this.config.version) {
                    res();
                    return;
                }
                let currentVersion: number;
                this.triggerQuery({
                    ...buildQuery(this, "_util", "select"),
                    where: ["key", "=", "db-version"]
                }, (row) => {
                    if (row) currentVersion = row.value;
                }, () => {
                    const saveVersion = (version: number, complete, err) => {
                        this.triggerQuery({
                            ...buildQuery(this, "_util", "upsert"),
                            actionArgs: { key: "db-version", value: version }
                        }, noop, complete, err);
                    };
                    // nothing to migrate, just set version
                    if (!currentVersion) {
                        saveVersion(this.config.version || 0, res, rej);
                    } else {
                        const upgrade = () => {
                            if (currentVersion === this.config.version) {
                                saveVersion(this.config.version || 0, res, rej);
                            } else {
                                if (!this.config.onVersionUpdate) {
                                    saveVersion(this.config.version || 0, res, rej);
                                    return;
                                }
                                this.config.onVersionUpdate(currentVersion).then((newVersion) => {
                                    currentVersion = newVersion;
                                    saveVersion(currentVersion, () => {
                                        setFast(upgrade);
                                    }, rej);
                                }).catch(rej);
                            }
                        };
                        upgrade();
                    }
                }, rej);
            });
        }).then(() => {
            return new Promise((res, rej) => {
                const event: InanoSQLDatabaseEvent = {
                    target: "Core",
                    path: "*",
                    targetId: this.state.id,
                    events: ["ready"],
                    time: Date.now()
                };

                this.doFilter<readyFilter>("ready", { res: event }, (evnt) => {
                    this.triggerEvent(evnt.res);
                    this.state.ready = true;
                    if (!this.config.disableTTL) {
                        this._checkTTL();
                    }
                    if (this.config.peer) {
                        this._initPeers();
                    }
                    res();
                }, rej);

            });
        });
    }

    public _initPeers() {
        let counter = 0;

        this.state.pid = uuidFN();

        // Append this peer to the network
        this.state.peers = this.getPeers();
        this.state.peers.unshift(this.state.pid);
        localStorage.setItem("nsql-peers-" + this.state.id, JSON.stringify(this.state.peers));
        // When localstorage changes we may need to possibly update the peer list
        // or possibly respond to an event from another peer
        window.addEventListener("storage", (e) => {
            // peer list updated
            if (e.key === "nsql-peers-" + this.state.id) {
                this.state.peers = this.getPeers();
            }
            // recieved event from another peer
            if (e.key && e.key.indexOf(this.state.pid + ".") === 0) {
                localStorage.removeItem(e.key);
                const ev: InanoSQLDatabaseEvent = JSON.parse(e.newValue || "{}");
                this.state.peerEvents.push(ev.query.queryID || "");
                this.triggerEvent({
                    ...ev,
                    types: ["peer change"]
                });
                setFast(() => {
                    this.triggerEvent(ev);
                });
            }
            // the "master" peer checks to make sure all peers have been
            // cleaning up their mess every 50 requests, if they aren't they
            // are removed. Keeps localStorage from filling up accidentally.
            counter++;
            if (counter > 50 && this.state.peers[0] === this.state.pid) {
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
                        this.state.peers = this.state.peers.filter(p => p !== peerID);
                        peerKeys[peerID].forEach((key) => {
                            localStorage.removeItem(key);
                        });
                        localStorage.setItem("nsql-peers-" + this.state.id, JSON.stringify(this.state.peers));
                    }
                });
            }
        });
        window.onblur = () => {
            this.state.focused = false;
        };
        // on focus we set this nsql to focused and move it's peer position
        // to the front
        window.onfocus = () => {
            // set this peer to master on focus
            this.state.peers = this.state.peers.filter((p) => p !== this.state.pid);
            this.state.peers.unshift(this.state.pid);
            localStorage.setItem("nsql-peers-" + this.state.id, JSON.stringify(this.state.peers));
            this.state.focused = true;
        };
        // send events to the peer network
        nSQL("*").on("change", (ev) => {
            const idxOf = this.state.peerEvents.indexOf(ev.query.queryID || "");
            if (idxOf !== -1) {
                this.state.peerEvents.splice(idxOf, 1);
                return;
            }
            this.state.peers.filter(p => p !== this.state.pid).forEach((p) => {
                localStorage.setItem(p + "." + ev.query.queryID, JSON.stringify(ev));
            });
        });
        // Remove self from peer network
        window.addEventListener("beforeunload", () => {
            this.state.peers = this.state.peers.filter((p) => p !== this.state.pid);
            localStorage.setItem("nsql-peers-" + this.state.id, JSON.stringify(this.state.peers));
            return false;
        });
    }

    public every(args: { length: number, every?: number, offset?: number }): number[] {
        let i = 0;
        let arr: number[] = [];
        while (i <= args.length) {
            if (args.every) {
                if (i % args.every === 0) {
                    arr.push(i + (args.offset || 0));
                }
            } else {
                arr.push(i + (args.offset || 0));
            }
            i++;
        }
        return arr;
    }

    public on(action: string, callBack: (event: InanoSQLDatabaseEvent) => void, selectTable?: string): void {
        let t = this;
        let l: string = selectTable || (typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable);

        this.doFilter<onEventFilter>("onEvent", { res: { action, callback: callBack } }, (newEvent) => {

            switch (newEvent.res.action) {
                case "connect":
                case "ready":
                case "disconnect":
                case "peer change":
                case "slow query":
                    this.eventFNs.Core["*"].on(newEvent.res.action, newEvent.res.callback);
                    break;
                case "select":
                case "change":
                case "delete":
                case "upsert":
                case "*":
                    const table = resolvePath(l);
                    if (!this.eventFNs[table[0]]) {
                        this.eventFNs[table[0]] = {
                            "*": new ReallySmallEvents()
                        };
                    }
                    const nestedPath = table.filter((v, i) => i > 0).join(".") || "*";
                    if (!this.eventFNs[table[0]][nestedPath]) {
                        this.eventFNs[table[0]][nestedPath] = new ReallySmallEvents();
                    }
                    this.eventFNs[table[0]][nestedPath].on(newEvent.res.action, newEvent.res.callback);
                    break;
                default:
                    new Promise((res, rej) => {
                        this.doFilter<customEventFilter>("customEvent", { res: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, res, rej);
                    }).then((evData: customEventFilter) => {
                        if (evData.res.nameSpace) {
                            if (!this.eventFNs[evData.res.nameSpace]) {
                                this.eventFNs[evData.res.nameSpace] = {
                                    "*": new ReallySmallEvents()
                                };
                            }
                            if (!this.eventFNs[evData.res.nameSpace][evData.res.path]) {
                                this.eventFNs[evData.res.nameSpace][evData.res.path] = new ReallySmallEvents();
                            }
                            this.eventFNs[evData.res.nameSpace][evData.res.path].on(newEvent.res.action, newEvent.res.callback);
                        } else {
                            throw new Error(`Invalid event "${action}"!`);
                        }
                        t._refreshEventChecker();
                    });
            }

            t._refreshEventChecker();

        }, noop);
    }

    public off(action: string, callBack: (event: InanoSQLDatabaseEvent) => void, selectTable?: string): void {
        let t = this;
        let l: string = selectTable || typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable;

        this.doFilter<offEventFilter>("onEvent", { res: { action, callback: callBack } }, (newEvent) => {

            switch (newEvent.res.action) {
                case "connect":
                case "ready":
                case "disconnect":
                case "peer change":
                case "slow query":
                    this.eventFNs.Core["*"].off(newEvent.res.action, newEvent.res.callback);
                    break;
                case "select":
                case "change":
                case "delete":
                case "upsert":
                case "*":
                    const table = resolvePath(l);
                    if (!this.eventFNs[table[0]]) {
                        this.eventFNs[table[0]] = {
                            "*": new ReallySmallEvents()
                        };
                    }
                    const nestedPath = table.filter((v, i) => i > 0).join(".") || "*";
                    if (!this.eventFNs[table[0]][nestedPath]) {
                        this.eventFNs[table[0]][nestedPath] = new ReallySmallEvents();
                    }
                    this.eventFNs[table[0]][nestedPath].off(newEvent.res.action, newEvent.res.callback);
                    break;
                default:
                    new Promise((res, rej) => {
                        this.doFilter<customEventFilter>("customEvent", { res: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, res, rej);
                    }).then((evData: customEventFilter) => {
                        if (evData.res.nameSpace) {
                            if (!this.eventFNs[evData.res.nameSpace]) {
                                this.eventFNs[evData.res.nameSpace] = {
                                    "*": new ReallySmallEvents()
                                };
                            }
                            if (!this.eventFNs[evData.res.nameSpace][evData.res.path]) {
                                this.eventFNs[evData.res.nameSpace][evData.res.path] = new ReallySmallEvents();
                            }
                            this.eventFNs[evData.res.nameSpace][evData.res.path].off(newEvent.res.action, newEvent.res.callback);
                        } else {
                            throw new Error(`Invalid event "${action}"!`);
                        }
                        t._refreshEventChecker();
                    });
            }

            t._refreshEventChecker();

        }, noop);
    }

    public _refreshEventChecker(): InanoSQLInstance {

        this.state.hasAnyEvents = Object.keys(this.eventFNs).reduce((prev, cur) => {
            if (prev === true) return true;
            const length = Object.keys(this.eventFNs[cur]).reduce((p, key) => {
                return Object.keys(this.eventFNs[cur][key].eventListeners).length + p;
            }, 0);
            return length > 0 ? true : prev;
        }, false);

        return this;
    }

    public getView(viewName: string, viewArgs: any): Promise<any> {
        return this._doAV("v", this.state.selectedTable as any, viewName, viewArgs);
    }


    public doAction(actionName: string, actionArgs: any): Promise<any> {
        return this._doAV("a", this.state.selectedTable as any, actionName, actionArgs);
    }

    public _doAV(AVType: "a" | "v", table: string, AVName: string, AVArgs: any): Promise<any> {
        if (typeof this.state.selectedTable !== "string") return Promise.reject("Can't do Action/View with selected table!");
        return new Promise((res, rej) => {
            this.doFilter<actionViewFilter>("actionView", {
                res: {
                    AVType,
                    table,
                    AVName,
                    AVArgs
                }
            }, res, rej);
        }).then((actionOrView: actionViewFilter) => {
            const key = actionOrView.res.AVType === "a" ? "actions" : "views";

            const selAV: InanoSQLActionOrView | null = this._tables[actionOrView.res.table][key].reduce((prev, cur) => {
                if (cur.name === actionOrView.res.AVName) return cur;
                return prev;
            }, null as any);

            if (!selAV) {
                return new Promise((res, rej) => rej(`${actionOrView.res.AVType} "${actionOrView.res.AVName}" Not Found!`));
            }

            return selAV.call(selAV.args ? cleanArgs(selAV.args, actionOrView.res.AVArgs, this) : {}, this);
        });
    }

    public query(action: string | ((nSQL: InanoSQLInstance) => InanoSQLQuery), args?: any): InanoSQLQueryBuilder {
        const av = this.state.activeAV;
        this.state.activeAV = "";
        return new _nanoSQLQueryBuilder(this, this.state.selectedTable, action, args, av);
    }

    public triggerQuery(query: InanoSQLQuery, onRow: (row: any) => void, complete: () => void, error: (err: string) => void): void {
        if (!this.state.connected && typeof query.table === "string") {
            error("nSQL: Can't do a query before the database is connected!");
            return;
        }

        this.doFilter<queryFilter>("query", { res: query }, (setQuery) => {

            if (this.config.queue && !setQuery.res.skipQueue) {
                this._Q.newItem({
                    query: setQuery.res,
                    onRow: onRow,
                    complete: complete,
                    error: error
                }, (item: { query: InanoSQLQuery, onRow: any, complete: any, error: any }, done, err) => {
                    new _nanoSQLQuery(this, item.query, item.onRow, () => {
                        done();
                        item.complete();
                    }, (err) => {
                        done();
                        item.error(err);
                    });
                });
            } else {
                new _nanoSQLQuery(this, setQuery.res, (row) => {
                    onRow(row);
                }, complete, error);
            }
        }, error);
    }

    public triggerEvent(eventData: InanoSQLDatabaseEvent, ignoreStarTable?: boolean): InanoSQLInstance {

        this.doFilter<eventFilter>("event", { res: eventData }, (event) => {
            if (this.state.hasAnyEvents) {
                setFast(() => {
                    event.res.events.forEach((evnt) => {
                        if (!ignoreStarTable) {
                            Object.keys(this.eventFNs["*"]).forEach((path) => {
                                this.eventFNs["*"][path].trigger(evnt, event.res);
                            });
                        }
                        if (!this.eventFNs[event.res.target]) return;
                        if (event.res.path === "_all_") {
                            Object.keys(this.eventFNs[event.res.target]).forEach((path) => {
                                this.eventFNs[event.res.target][path].trigger(evnt, event.res);
                            });
                        } else {
                            if (!this.eventFNs[event.res.target][event.res.path]) return;
                            this.eventFNs[event.res.target][event.res.path].trigger(evnt, event.res);
                        }
                    });
                });
            }
        }, (err) => {
            console.log("Event suppressed", err);
        });

        return this;
    }

    public default(replaceObj?: any, table?: string): { [key: string]: any } | Error {

        replaceObj = replaceObj || {};
        if (!table && typeof this.state.selectedTable !== "string") {
            throw new Error("Must select table to generate defualts!");
        }
        table = (table || this.state.selectedTable as any) as string;
        if (!this._tables[table]) {
            throw new Error(`nSQL: Table "${table}" not found for generating default object!`);
        }

        let error = "";
        const resolveModel = (cols: InanoSQLTableColumn[], useObj?: any, nestedModel?: string): any => {
            let newObj = {};
            useObj = useObj || {};
            if (nestedModel && nestedModel.length) {
                if (nestedModel.indexOf("[]") !== -1) {
                    if (Array.isArray(useObj)) {
                        return useObj.map(a => resolveModel(cols, a, nestedModel.slice(0, nestedModel.lastIndexOf("[]"))));
                    } else {
                        return [];
                    }
                }
            }
            let hasWildCard: boolean = false;
            cols.forEach((m) => {
                if (m.key === "*") {
                    hasWildCard = true;
                    return;
                }
                if (m.model) {
                    if (m.type.indexOf("[]") !== -1) {
                        const arr = typeof useObj !== "undefined" ? useObj[m.key] : [];
                        if (!Array.isArray(arr)) {
                            newObj[m.key] = [];
                        } else {
                            newObj[m.key] = arr.map(a => resolveModel(m.model as any[], a, m.type.slice(0, m.type.lastIndexOf("[]"))));
                        }
                    } else {
                        newObj[m.key] = resolveModel(m.model, typeof useObj !== "undefined" ? useObj[m.key] : undefined);
                    }
                } else {
                    let value = typeof useObj[m.key] !== "undefined" ? cast(m.type, useObj[m.key], false, this) : (typeof m.default === "function" ? m.default(replaceObj) : m.default);
                    if (typeof m.max !== "undefined" && value > m.max) {
                        error = `Data error, column ${m.key} can't be greater than ${m.max}!`
                    }
                    if (typeof m.min !== "undefined" && value < m.min) {
                        error = `Data error, column ${m.key} can't be less than ${m.min}!`
                    }
                    newObj[m.key] = value;
                }
                if (m.notNull && (newObj[m.key] === null || newObj[m.key] === undefined)) {
                    error = `Data error, ${m.key} cannot be null!`;
                }
            });

            if (error.length) {
                throw new Error(error);
            }

            if (hasWildCard && useObj) {
                const keys = cols.map(c => c.key);
                Object.keys(useObj).filter(c => keys.indexOf(c) === -1).forEach((key) => {
                    newObj[key] = useObj[key];
                });
            }
            return newObj;
        };

        return resolveModel(this._tables[table].columns, replaceObj);
    }


    public rawDump(tables: string[], indexes: boolean, onRow: (table: string, row: { [key: string]: any }) => void): Promise<any> {

        const exportTables = indexes ? tables : Object.keys(this._tables).filter(t => tables.length ? tables.indexOf(t) !== -1 : true);

        return chainAsync(exportTables, (table: string, i, nextTable, err) => {
            if (indexes) {
                const tableName = table.indexOf(":") !== -1 ? table.split(":")[0] : table;
                const tableIndexes = table.indexOf(":") !== -1 ? [table.split(":")[1]] : Object.keys(this._tables[table].indexes);
                chainAsync(tableIndexes, (index, i, nextIdx, errIdx) => {
                    adapterFilters(this).readIndexKeys(tableName, index, "all", undefined, undefined, false, (key, id) => {
                        onRow(tableName + "." + index, { indexId: id, rowId: key });
                    }, nextIdx, errIdx);
                }).then(nextTable).catch(err);
            } else {
                adapterFilters(this).readMulti(table, "all", undefined, undefined, false, (row) => {
                    onRow(table, row);
                }, nextTable, err || noop);
            }
        });
    }


    public rawImport(tables: { [table: string]: { [key: string]: any }[] }, indexes: boolean, onProgress?: (percent: number) => void): Promise<any> {

        let progress = 0;
        const totalLength = Object.keys(tables).reduce((p, c) => {
            return p += tables[c].length, p;
        }, 0);

        const usableTables = Object.keys(this._tables);
        const importTables: string[] = indexes ? Object.keys(tables) : Object.keys(tables).filter(t => usableTables.indexOf(t) !== -1);

        return chainAsync(importTables, (table, i, next, err) => {
            if (indexes) {
                // tableName:IndexName
                const tableName = table.split(".")[0];
                const indexName = table.split(".")[1];
                chainAsync(tables[table], (indexRow, ii, nextIdx, errIdx) => {
                    adapterFilters(this).addIndexValue(tableName, indexName, indexRow.rowId, indexRow.indexId, nextIdx, errIdx);
                }).then(next).catch(err);
            } else {
                const pk = this._tables[table].pkCol;
                chainAsync(tables[table], (row, ii, nextRow, rowErr) => {
                    if (!deepGet(pk, row) && rowErr) {
                        rowErr("No primary key found, can't import: " + JSON.stringify(row));
                        return;
                    }
                    adapterFilters(this).write(table, deepGet(pk, row), row, (newRow) => {
                        nextRow();
                        progress++;
                        if (onProgress) onProgress(Math.round((progress / totalLength) * 10000) / 100);
                    }, rowErr || noop);
                }).then(next).catch(err);
            }
        });
    }

    public disconnect() {
        return new Promise((res, rej) => {
            this.doFilter<disconnectFilter>("disconnect", {}, () => {
                adapterFilters(this).disconnect(res, rej);
            }, rej);
        });
    }

    public extend(scope: string, ...args: any[]): any | nanoSQL {
        return new Promise((res, rej) => {
            this.doFilter<extendFilter>("extend", { scope: scope, args: args, res: null }, res, rej);
        });
    }

    public loadJS(rows: { [key: string]: any }[], onProgress?: (percent: number) => void, parallel?: boolean): Promise<any[]> {

        const table = this.state.selectedTable;

        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load JS into temporary table!");
        }
        const total = rows.length;
        let count = 0;
        const async = parallel ? allAsync : chainAsync;
        return async(rows, (row, i, next, err) => {
            this.triggerQuery({
                ...buildQuery(this, table, "upsert"),
                actionArgs: row
            }, (r) => {

            }, () => {
                count++;
                if (onProgress) onProgress(((count / total) * 10000) / 100);
                next();
            }, err as any);
        });
    }

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
            csv.push(columnHeaders.map(c => `"${c}"`).join(","));
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
        return csv.join("\n");
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


    public CSVtoJSON(csv: string, rowMap?: (row: any) => any): any {
        let t = this;
        let fields: Array<string> = [];
        return csv.split(/\r?\n|\r|\t/gm).map((v, k) => {
            if (k === 0) {
                fields = v.split(",").map(s => s.substring(1, s.length - 1));
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

    public loadCSV(csv: string, rowMap?: (row: any) => any, onProgress?: (percent: number) => void, parallel?: boolean): Promise<any[]> {

        const table = this.state.selectedTable;

        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load CSV into temporary table!");
        }

        let rowData = this.CSVtoJSON(csv, rowMap);
        const async = parallel ? allAsync : chainAsync;
        let count = 0;
        return async(rowData, (row, i, nextRow, err) => {
            this.triggerQuery({
                ...buildQuery(this, table, "upsert"),
                actionArgs: row
            }, noop, () => {
                count++;
                if (onProgress) onProgress(Math.round((count / rowData.length) * 10000) / 100);
                nextRow();
            }, err || noop);
        });
    }
}

export const nSQLv1Config = (doConfig: (nSQLv1: (table?: string) => InanoSQLV1ConfigFn) => void): InanoSQLConfig => {

    let tables: { [tableName: string]: InanoSQLTableConfig } = {};
    let conf = {};
    let selTable: string = "";

    const nSQLv1 = (table?: string) => {
        selTable = table || selTable;
        if (selTable && !tables[selTable]) {
            tables[selTable] = {
                name: selTable,
                model: {},
                indexes: {},
                actions: [],
                views: []
            }
        }

        return {
            model: (dataModels: { key: string, type: string, props?: any[], default?: any }[]) => {
                let indexes: InanoSQLTableConfig["indexes"] = {};
                tables[selTable].model = dataModels.reduce((prev, cur) => {
                    const key = cur.key + ":" + cur.type;
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
            actions: (actions: InanoSQLActionOrView[]) => {
                tables[selTable].actions = actions;
                return nSQLv1(table);
            },
            views: (views: InanoSQLActionOrView[]) => {
                tables[selTable].views = views;
                return nSQLv1(table);
            },
            config: (obj: { [key: string]: any }) => {
                conf = obj;
                return nSQLv1(table);
            },
            table: (ta?: string) => {
                return nSQLv1(ta);
            },
            rowFilter: (callback: (row: any) => any) => {
                tables[selTable].filter = callback;
                return nSQLv1(table);
            }
        }
    };
    doConfig(nSQLv1);

    return {
        ...conf,
        tables: Object.keys(tables).map(t => tables[t]),
    };
}

/**
 * @internal
 */
let _nanoSQLStatic = new nanoSQL();

export const nSQL = (table?: string | any[] | ((where?: any[] | ((row: { [key: string]: any }, i?: number) => boolean)) => Promise<TableQueryResult>)) => {
    return _nanoSQLStatic.selectTable(table);
};

if (typeof window !== "undefined") {
    if (!window["@nano-sql"]) {
        window["@nano-sql"] = {};
    }
    window["@nano-sql"].core = {
        nSQL: nSQL,
        nanoSQL: nanoSQL,
        utilities: utils,
        nSQLv1Config
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