import { ReallySmallEvents } from "really-small-events";
import { _assign, allAsync, cast, cleanArgs, chainAsync, uuid, hash, noop, throwErr, setFast, resolvePath, isSafari, objSort, deepGet, buildQuery, _NanoSQLQueue, _objectsEqual, titleCase, getWeekOfYear, throttle } from "./utilities";
import { INanoSQLConfig, INanoSQLFunction, INanoSQLActionOrView, INanoSQLDataModel, INanoSQLQuery, disconnectFilter, INanoSQLDatabaseEvent, extendFilter, abstractFilter, queryFilter, eventFilter, configFilter, IAVFilterResult, actionFilter, INanoSQLAdapter, willConnectFilter, INanoSQLJoinArgs, readyFilter, INanoSQLTableColumn, INanoSQLGraphArgs, IWhereCondition, INanoSQLIndex, INanoSQLTableConfig, configTableFilter, INanoSQLTable, INanoSQLInstance, INanoSQLQueryBuilder, INanoSQLQueryExec, customEventFilter, VERSION, TableQueryResult, mapReduceFilter } from "./interfaces";
import { attachDefaultFns } from "./functions";
import { _NanoSQLQuery } from "./query";
import { SyncStorage } from "./adapters/syncStorage";
import { WebSQL } from "./adapters/webSQL";
import { IndexedDB } from "./adapters/indexedDB";
import { _NanoSQLQueryBuilder } from "./query-builder";

let RocksDB: any;
if (typeof global !== "undefined") {
    RocksDB = (global as any)._rocksAdapter;
}

// tslint:disable-next-line
export class nanoSQL implements INanoSQLInstance {

    public config: INanoSQLConfig;

    public adapter: INanoSQLAdapter;

    public version: number = VERSION;

    public filters: {
        [filterName: string]: ((inputArgs: any, complete: (args: any) => void, cancel: (info: any) => void) => void)[];
    };

    public functions: {
        [fnName: string]: INanoSQLFunction;
    };

    public planetRadius: number = 6371;

    public tables: {
        [tableName: string]: INanoSQLTable;
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
        connected: boolean;
        ready: boolean;
        runMR: {[table: string]: {[mrName: string]: (...args: any[]) => void}};
        MRTimer: any;
        selectedTable: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>);
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

    private _Q = new _NanoSQLQueue();

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
            connected: false,
            ready: false,
            MRTimer: undefined,
            runMR: {},
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
            string: (value: any) => {
                return typeof value === "object" ? JSON.stringify(value) : String(value);
            },
            geo: (value: any) => {
                return undefined;
            },
            float: (value: any) => {
                const float = parseFloat(value);
                return isNaN(float) ? 0 : float;
            },
            int: (value: any) => {
                const int = parseInt(value);
                return isNaN(int) ? 0 : int;
            },
            number: (value: any) => {
                const float = parseFloat(value);
                return isNaN(float) ? 0 : float;
            }
        };

        this.eventFNs = {
            Core: {
                "*": new ReallySmallEvents()
            },
            "*": { "*": new ReallySmallEvents()}
        };
        this._checkTTL = this._checkTTL.bind(this);
        attachDefaultFns(this);
    }

    public doFilter<T, R>(filterName: string, args: T, complete: (result: R) => void, cancelled: (abortInfo: any) => void): void {
        if (this.filters[filterName]) {
            chainAsync(this.filters[filterName], (item, i, nextFilter) => {
                this.filters[filterName][i](args, (newArgs) => {
                    args = newArgs;
                    nextFilter();
                }, (abortInfo) => {
                    cancelled(abortInfo);
                });
            }).then(() => {
                complete((args as any).result);
            });
        } else {
            complete((args as any).result);
        }
    }


    public getCache(id: string, args: { offset: number, limit: number }): any[] {
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
                        const key = ["float", "int", "number"].indexOf(this.tables[table].pkType) === -1 ? rowData[1] : parseFloat(rowData[1]);
                        if (row.cols.length) {
                            let upsertObj = {};
                            row.cols.forEach((col) => {
                                upsertObj[col] = null;
                            });
                            this.triggerQuery({
                                ...buildQuery(this, table, "upsert"),
                                actionArgs: upsertObj,
                                where: [this.tables[table].pkCol, "=", key]
                            }, noop, clearTTL, throwErr);
                        } else {
                            this.triggerQuery({
                                ...buildQuery(this, table, "delete"),
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

    public selectTable(table?: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>)): INanoSQLInstance {
        if (table) this.state.selectedTable = table;
        return this;
    }

    public getPeers() {
        return JSON.parse(localStorage.getItem("nsql-peers-" + this.state.id) || "[]");
    }

    public _detectStorageMethod(): string {

        // NodeJS
        if (typeof window === "undefined") {
            return "RKS";
        }

        // Browser

        // Safari / iOS always gets WebSQL (mobile and desktop)
        if (isSafari) {
            return "WSQL";
        }

        // everyone else (FF + Chrome + Edge + IE)
        // check for support for indexed db
        if (typeof indexedDB !== "undefined") { // fall back to indexed db if we can
            return "IDB";
        }

        // Use WebSQL if it's there.
        if (typeof window !== "undefined" && typeof window.openDatabase !== "undefined") {
            return "WSQL";
        }

        // nothing else works, we gotta do local storage. :(
        return "LS";

    }

    public _initPlugins(config: INanoSQLConfig): Promise<any> {
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

    public connect(config: INanoSQLConfig): Promise<any> {
        let t = this;

        return this._initPlugins(config).then(() => {
            return new Promise((res, rej) => {
                this.doFilter<configFilter, INanoSQLConfig>("config", { result: config }, res, rej);
            });
        }).then((conf: INanoSQLConfig) => {
            this.state.id = conf.id || "nSQL_DB";

            this.config = {
                plugins: [],
                ...conf
            };

            if (typeof window !== "undefined" && conf && conf.peer) {
                this.state.peerMode = true;
            }
            return new Promise((res, rej) => {
                this.doFilter<willConnectFilter, {}>("willConnect", { result: {} }, res, rej);
            });
        }).then(() => {
            // setup and connect adapter
            return new Promise((res, rej) => {

                let dbMode = typeof this.config.mode !== "undefined" ? this.config.mode : "TEMP";

                if (typeof dbMode === "string") {
                    if (dbMode === "PERM") {
                        dbMode = this._detectStorageMethod();
                    }
                    switch (dbMode) {
                        case "TEMP":
                            this.adapter = new SyncStorage(false);
                            break;
                        case "LS":
                            this.adapter = new SyncStorage(true);
                            break;
                        case "WSQL":
                            this.adapter = new WebSQL(this.config.size);
                            break;
                        case "IDB":
                            this.adapter = new IndexedDB(this.config.version);
                            break;
                        case "RKS":
                        case "LVL":
                            this.adapter = new RocksDB(this.config.path);
                            break;
                        default:
                            rej(`Cannot find mode ${dbMode}!`);
                    }
                } else {
                    this.adapter = dbMode;
                }

                if (this.adapter.plugin) {
                    (this.config.plugins || []).push(this.adapter.plugin);
                }

                this._initPlugins(this.config).then(() => {
                    this.adapter.nSQL = this;
                    this.adapter.connect(this.state.id, res, rej);
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

            this.triggerMapReduce = this.triggerMapReduce.bind(this);

            const tables = ["_util", "_ttl"].concat((this.config.tables || []).map(t => t.name));

            return allAsync(tables, (j, i, next, err) => {
                switch (j) {
                    case "_util":
                        this.triggerQuery({
                            ...buildQuery(this, "", "create table"),
                            actionArgs: {
                                name: "_util",
                                model: [
                                    { key: "key:string", props: ["pk()"] },
                                    { key: "value:any" }
                                ],
                                _internal: true
                            }
                        }, noop, next as any, err);
                        break;
                    case "_ttl":
                        this.triggerQuery({
                            ...buildQuery(this, "", "create table"),
                            actionArgs: {
                                name: "_ttl",
                                model: [
                                    { key: "key:string", props: ["pk()"] },
                                    { key: "table:string" },
                                    { key: "cols:string[]" },
                                    { key: "date:number" }
                                ],
                                _internal: true
                            }
                        }, noop, next as any, err);
                        break;
                    default:
                        const model = (this.config.tables || []).filter(t => t.name === j)[0];
                        if (!model) {
                            err("Table not found!");
                            return;
                        }
                        this.triggerQuery({
                            ...buildQuery(this, "", "create table"),
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
                this.triggerEvent({
                    target: "Core",
                    path: "*",
                    targetId: this.state.id,
                    events: ["ready"],
                    time: Date.now()
                });
                this.state.ready = true;
                if (!this.config.disableTTL) {
                    this._checkTTL();
                }
                if (this.config.peer) {
                    this._initPeers();
                }
                res();
            });
        });
    }

    public _initPeers() {
        let counter = 0;

        this.state.pid = uuid();

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
                const ev: INanoSQLDatabaseEvent = JSON.parse(e.newValue || "{}");
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

    public every(args: {length: number, every?: number, offset?: number}): number[] {
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

    public triggerMapReduce(cb?: (event: INanoSQLDatabaseEvent) => void, table?: string, name?: string) {

        if (table && name) {
            if (!this.tables[table]) return;
            if (!this.tables[table].mapReduce) return;
            if (!this.state.runMR[table]) return;
            if (!this.state.runMR[table][name]) return;
            const event = {
                target: "Core",
                path: table + "." + name,
                events: ["map reduce"],
                time: Date.now(),
            };
            if (cb) {
                cb(event);
            }
            this.state.runMR[table][name](event);
            return;
        }

        Object.keys(this.tables).forEach((table) => {
            if (this.tables[table].mapReduce) {
                if (!this.state.runMR[table]) return;
                (this.tables[table].mapReduce || []).forEach((mr) => {
                    if (!this.state.runMR[table][mr.name]) return;
                    if (mr.onTimes) {
                        let runMR = true;

                        // handle zeroing out timer options below the developer choice.
                        // example: developer sends in to trigger at midnight every day
                        // sets seconds and minutes to zero so it'll only trigger
                        // once that day instead of every second of midnight
                        let keyStart: number = -1;
                        let fillKeys: string[] = [];
                        let fillObj: any = {};
                        ["seconds", "minutes", "hours", "weekDay", "weekOfYear", "date", "month"].forEach((dateKey, i) => {
                            if (!(mr.onTimes as any)[dateKey]) {
                                fillKeys.push(dateKey);
                                return;
                            }
                            if (keyStart === -1) {
                                keyStart = 1;
                                fillKeys.forEach((key) => {
                                    switch (key) {
                                        case "seconds":
                                        case "minutes":
                                        case "hours":
                                            fillObj[key] = [0];
                                        break;
                                        case "weekDay":
                                            // only need to set to beginning of week
                                            // if a weekOfYear property is set
                                            if ((mr.onTimes as any).weekOfYear) {
                                                fillObj[key] = [0];
                                            }
                                        break;
                                        case "weekOfYear":

                                        break;
                                        case "date":
                                            fillObj[key] = [1];
                                        break;
                                        case "month":

                                        break;
                                    }
                                });
                            }
                        });

                        const date = new Date();
                        Object.keys({
                            ...mr.onTimes,
                            ...fillObj
                        }).forEach((time) => {
                            const checkTimes: number[] = Array.isArray((mr.onTimes as any)[time]) ? (mr.onTimes as any)[time] : [(mr.onTimes as any)[time]];
                            if (!checkTimes.length) return;
                            switch (time) {
                                case "weekDay":
                                    if (checkTimes.indexOf(date.getDay()) === -1) {
                                        runMR = false;
                                    }
                                break;
                                case "weekOfYear":
                                    if (checkTimes.indexOf(getWeekOfYear(date)) === -1) {
                                        runMR = false;
                                    }
                                break;
                                default:
                                    const q = "get" + titleCase(time);
                                    if (date[q] && checkTimes.indexOf(date[q]()) === -1) {
                                        runMR = false;
                                    }
                            }
                        });

                        if (runMR) {
                            const event = {
                                target: "Core",
                                path: table + "." + mr.name,
                                events: ["map reduce"],
                                time: Date.now(),
                            };
                            if (cb) {
                                cb(event);
                            }
                            this.state.runMR[table][mr.name](event);
                        }
                    }
                });
            }
        });
    }


    public on(action: string, callBack: (event: INanoSQLDatabaseEvent) => void): INanoSQLInstance {
        let t = this;
        let l: string = typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable;

        switch (action) {
            case "connect":
            case "ready":
            case "disconnect":
            case "peer change":
            case "slow query":
            case "map reduce":
                this.eventFNs.Core["*"].on(action, callBack);
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
                this.eventFNs[table[0]][nestedPath].on(action, callBack);
                break;
            default:
                new Promise((res, rej) => {
                    this.doFilter<customEventFilter, { nameSpace: string, path: string }>("customEvent", { result: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, res, rej);
                }).then((evData: { nameSpace: string, path: string }) => {
                    if (evData.nameSpace) {
                        if (!this.eventFNs[evData.nameSpace]) {
                            this.eventFNs[evData.nameSpace] = {
                                "*": new ReallySmallEvents()
                            };
                        }
                        if (!this.eventFNs[evData.nameSpace][evData.path]) {
                            this.eventFNs[evData.nameSpace][evData.path] = new ReallySmallEvents();
                        }
                        this.eventFNs[evData.nameSpace][evData.path].on(action, callBack);
                    } else {
                        throw new Error(`Invalid event "${action}"!`);
                    }
                    t._refreshEventChecker();
                });
        }

        return t._refreshEventChecker();
    }

    public off(action: string, callBack: (event: INanoSQLDatabaseEvent, database: INanoSQLInstance) => void): INanoSQLInstance {
        let t = this;
        let l: string = typeof t.state.selectedTable !== "string" ? "" : t.state.selectedTable;

        switch (action) {
            case "connect":
            case "ready":
            case "disconnect":
            case "peer change":
            case "slow query":
            case "map reduce":
                this.eventFNs.Core["*"].off(action, callBack);
                break;
            case "select":
            case "change":
            case "delete":
            case "upsert":
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
                this.eventFNs[table[0]][nestedPath].off(action, callBack);
                break;
            default:
                this.doFilter<customEventFilter, { nameSpace: string, path: string }>("customEvent", { result: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, (evData) => {
                    if (evData.nameSpace) {
                        if (!this.eventFNs[evData.nameSpace]) {
                            this.eventFNs[evData.nameSpace] = {
                                "*": new ReallySmallEvents()
                            };
                        }
                        if (!this.eventFNs[evData.nameSpace][evData.path]) {
                            this.eventFNs[evData.nameSpace][evData.path] = new ReallySmallEvents();
                        }
                        this.eventFNs[evData.nameSpace][evData.path].off(action, callBack);
                    } else {
                        throw new Error(`Invalid event "${action}"!`);
                    }
                    t._refreshEventChecker();
                }, () => {});
        }

        return t._refreshEventChecker();
    }

    public _refreshEventChecker(): INanoSQLInstance {

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
        return this._doAV("View", this.state.selectedTable as any, viewName, viewArgs);
    }


    public doAction(actionName: string, actionArgs: any): Promise<any> {
        return this._doAV("Action", this.state.selectedTable as any, actionName, actionArgs);
    }

    public _doAV(AVType: "Action" | "View", table: string, AVName: string, AVargs: any): Promise<any> {
        if (typeof this.state.selectedTable !== "string") return Promise.reject("Can't do Action/View with selected table!");
        return new Promise((res, rej) => {
            this.doFilter<actionFilter, IAVFilterResult>(AVType, {
                result: {
                    AVType,
                    table,
                    AVName,
                    AVargs
                }
            }, res, rej);
        }).then((result: IAVFilterResult) => {
            const key = result.AVType === "Action" ? "actions" : "views";

            const selAV: INanoSQLActionOrView | null = this.tables[result.table][key].reduce((prev, cur) => {
                if (cur.name === result.AVName) return cur;
                return prev;
            }, null as any);

            if (!selAV) {
                return new Promise((res, rej) => rej(`${result.AVType} "${result.AVName}" Not Found!`));
            }

            return selAV.call(selAV.args ? cleanArgs(selAV.args, result.AVargs) : {}, this);
        });
    }

    public query(action: string | ((nSQL: INanoSQLInstance) => INanoSQLQuery), args?: any): INanoSQLQueryBuilder {
        const av = this.state.activeAV;
        this.state.activeAV = "";
        return new _NanoSQLQueryBuilder(this, this.state.selectedTable, action, args, av);
    }

    public triggerQuery(query: INanoSQLQuery, onRow: (row: any) => void, complete: () => void, error: (err: string) => void): void {
        if (!this.state.connected && typeof query.table === "string") {
            error("nSQL: Can't do a query before the database is connected!");
            return;
        }

        this.doFilter<queryFilter, INanoSQLQuery>("query", { result: query }, (setQuery) => {

            if (this.config.queue && !setQuery.skipQueue) {
                this._Q.newItem({ query: setQuery, onRow: onRow, complete: complete, error: error }, (item: { query: INanoSQLQuery, onRow: any, complete: any, error: any }, done, err) => {
                    new _NanoSQLQuery(this, item.query, item.onRow, () => {
                        done();
                        item.complete();
                    }, (err) => {
                        done();
                        item.error(err);
                    });
                });
            } else {
                new _NanoSQLQuery(this, setQuery, (row) => {
                    onRow(row);
                }, complete, error);
            }
        }, error);
    }

    public triggerEvent(eventData: INanoSQLDatabaseEvent, ignoreStarTable?: boolean): INanoSQLInstance {

        this.doFilter<eventFilter, INanoSQLDatabaseEvent>("event", { result: eventData }, (event) => {
            if (this.state.hasAnyEvents) {
                setFast(() => {
                    event.events.forEach((evnt) => {
                        if (!ignoreStarTable) {
                            Object.keys(this.eventFNs["*"]).forEach((path) => {
                                this.eventFNs["*"][path].trigger(evnt, event);
                            });
                        }
                        if (!this.eventFNs[event.target]) return;
                        if (event.path === "_all_") {
                            Object.keys(this.eventFNs[event.target]).forEach((path) => {
                                this.eventFNs[event.target][path].trigger(evnt, event);
                            });
                        } else {
                            if (!this.eventFNs[event.target][event.path]) return;
                            this.eventFNs[event.target][event.path].trigger(evnt, event);
                        }
                    });
                });
            }
        }, (err) => {
            console.error("Event suppressed", err);
        });

        return this;
    }

    public default(replaceObj?: any, table?: string): { [key: string]: any } | Error {

        replaceObj = replaceObj || {};
        if (!table && typeof this.state.selectedTable !== "string") {
            throw new Error("Must select table to generate defualts!");
        }
        table = (table || this.state.selectedTable as any) as string;
        if (!this.tables[table]) {
            throw new Error(`nSQL: Table "${table}" not found for generating default object!`);
        }

        let error = "";
        const resolveModel = (cols: INanoSQLTableColumn[], useObj?: any, nestedModel?: string): any => {
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
                    newObj[m.key] = typeof useObj[m.key] !== "undefined" ? cast(m.type, useObj[m.key]) : m.default;
                }
                if (m.notNull && (newObj[m.key] === null || newObj[m.key] === undefined)) {
                    error = `Data error, ${m.key} cannot be null!`;
                }
            });

            if (error.length) return new Error(error);

            if (hasWildCard && useObj) {
                const keys = cols.map(c => c.key);
                Object.keys(useObj).filter(c => keys.indexOf(c) === -1).forEach((key) => {
                    newObj[key] = useObj[key];
                });
            }
            return newObj;
        };

        return resolveModel(this.tables[table].columns, replaceObj);
    }


    public rawDump(tables: string[], onRow: (table: string, row: { [key: string]: any }) => void): Promise<any> {
        const exportTables = Object.keys(this.tables).filter(t => tables.length ? tables.indexOf(t) !== -1 : true);

        return chainAsync(exportTables, (table: string, i, nextTable, err) => {
            this.adapter.readMulti(table, "all", undefined, undefined, false, (row) => {
                onRow(table, row);
            }, nextTable, err || noop);
        });
    }


    public rawImport(tables: { [table: string]: { [key: string]: any }[] }, onProgress?: (percent: number) => void): Promise<any> {

        let progress = 0;
        const totalLength = Object.keys(tables).reduce((p, c) => {
            return p += tables[c].length, p;
        }, 0);

        const usableTables = Object.keys(this.tables);
        const importTables: string[] = Object.keys(tables).filter(t => usableTables.indexOf(t) !== -1);

        return chainAsync(importTables, (table, i, next, err) => {
            const pk = this.tables[table].pkCol;
            chainAsync(tables[table], (row, ii, nextRow, rowErr) => {
                if (!row[pk] && rowErr) {
                    rowErr("No primary key found, can't import: " + JSON.stringify(row));
                    return;
                }
                this.adapter.write(table, row[pk], row, (newRow) => {
                    nextRow();
                    progress++;
                    if (onProgress) onProgress(Math.round((progress / totalLength) * 10000) / 100);
                }, rowErr || noop);
            }).then(next).catch(err);
        });
    }

    public disconnect() {
        return new Promise((res, rej) => {
            this.doFilter<disconnectFilter, undefined>("disconnect", {}, () => {
                this.adapter.disconnect(res, rej);
            }, rej);
        });
    }

    public extend(scope: string, ...args: any[]): any | nanoSQL {
        return new Promise((res, rej) => {
            this.doFilter<extendFilter, { result: any }>("extend", { scope: scope, args: args, result: null }, res, rej);
        });
    }

    public loadJS(rows: { [key: string]: any }[], onProgress?: (percent: number) => void): Promise<any[]> {

        const table = this.state.selectedTable;

        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load JS into temporary table!");
        }
        const total = rows.length;
        let count = 0;
        return chainAsync(rows, (row, i, next, err) => {
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

    public loadCSV(csv: string, rowMap?: (row: any) => any, onProgress?: (percent: number) => void): Promise<any[]> {

        const table = this.state.selectedTable;

        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load CSV into temporary table!");
        }

        let rowData = this.CSVtoJSON(csv, rowMap);

        return chainAsync(rowData, (row, i, nextRow, err) => {
            if (onProgress) onProgress(Math.round(((i + 1) / rowData.length) * 10000) / 100);
            this.triggerQuery({
                ...buildQuery(this, table, "upsert"),
                actionArgs: row
            }, noop, nextRow, err || noop);
        });
    }
}


/**
 * @internal
 */
let _NanoSQLStatic = new nanoSQL();

export const nSQL = (table?: string | any[] | ((where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>)) => {
    return _NanoSQLStatic.selectTable(table);
};

if (typeof window !== "undefined") {
    window["nano-sql"] = {
        nSQL: nSQL,
        NanoSQL: nanoSQL
    };
}