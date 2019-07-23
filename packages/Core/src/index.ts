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
    uuid,
    InanoSQLDBConfig
} from "./interfaces";
import { attachDefaultFns } from "./functions";
import { _nanoSQLQuery } from "./query";
import { _nanoSQLQueryBuilder } from "./query-builder";
import * as utils from "./utilities";
import { resolveMode } from "./adapter-detect";
import { SyncStorage } from "./adapters/syncStorage";

export {
    InanoSQLInstance
}

// tslint:disable-next-line
export class nanoSQL implements InanoSQLInstance {

    public dbs: {
        [id: string]: InanoSQLDBConfig;
    } = {};

    public selectedDB: string = "nSQL_DB";

    public indexTypes: {
        [type: string]: (value: any) => any;
    };

    public version: number = VERSION;

    public functions: {
        [fnName: string]: InanoSQLFunction;
    };

    public events: {
        [id: string]: {
            Core: { [path: string]: ReallySmallEvents };
            [eventName: string]: { [path: string]: ReallySmallEvents };
        };
    } = {};

    public planetRadius: number = 6371;

    public selectedTable: any;

    public txs: {
        [id: string]: {
            table: string,
            type: "put"|"del"|"idx-put"|"idx-del";
            data: any;
        }[]
    } = {};

    constructor() {

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
        this._checkTTL = this._checkTTL.bind(this);
        attachDefaultFns(this);
    }

    public getDB(id?: string): InanoSQLDBConfig {
        const useID = id || this.selectedDB;
        if (!this.dbs[useID]) {
            throw new Error(`Database ${useID} doesn't exist!`);
        }
        return this.dbs[useID];
    }

    public _rebuildFKs() {
        // bust memoized caches
        this.getDB().state.cacheId = uuidFN();

        this.getDB()._fkRels = {};
        Object.keys(this.getDB()._tables).forEach((tableName) => {
            const table = this.getDB()._tables[tableName];
            Object.keys(table.indexes).forEach((indexName) => {
                const index = table.indexes[indexName];
                if (index.props && index.props.foreignKey) {
                    const path = resolvePath(index.props.foreignKey.target);
                    const remoteTable = path.shift() as string;
                    if (!this.getDB()._fkRels[remoteTable]) {
                        this.getDB()._fkRels[remoteTable] = [];
                    }

                    this.getDB()._fkRels[remoteTable].push({
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

    public doFilter<T>(databaseID: string|undefined, filterName: string, args: T, complete: (result: T) => void, cancelled: (abortInfo: any) => void): void {
        if (!databaseID) {
            complete(args);
            return;
        }
        
        if (this.dbs[databaseID] && this.getDB(databaseID).filters[filterName]) {
            chainAsync(this.getDB(databaseID).filters[filterName], (item, i, nextFilter) => {
                this.getDB(databaseID).filters[filterName][i](args, (newArgs) => {
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
        if (!this.getDB()._queryCache[id]) {
            throw new Error(`Cache "${id}" not found!`);
        }
        if (args) {
            return this.getDB()._queryCache[id].slice(args.offset, args.offset + args.limit);
        } else {
            return this.getDB()._queryCache[id].slice();
        }
    }

    public clearCache(id: string): boolean {
        const exists = this.getDB()._queryCache[id] !== undefined;
        delete this.getDB()._queryCache[id];
        return exists;
    }

    public clearTTL(primaryKey: any): Promise<any> {
        const k = this.selectedTable + "." + primaryKey;
        return new Promise((res, rej) => {
            this.triggerQuery(this.selectedDB, {
                ...buildQuery(this.selectedDB, this, "_ttl", "delete"),
                where: ["key", "=", k]
            }, noop, res, rej);
        });
    }

    public expires(primaryKey: any): Promise<any> {
        return new Promise((res, rej) => {
            const k = this.selectedTable + "." + primaryKey;
            let rows: any[] = [];
            this.triggerQuery(this.selectedDB, {
                ...buildQuery(this.selectedDB, this, "_ttl", "select"),
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

    public _checkTTL() {
        if (this.getDB().config.disableTTL) return;

        if (this.getDB()._ttlTimer) {
            clearTimeout(this.getDB()._ttlTimer);
        }
        let page = 0;
        let nextTTL = 0;
        const getPage = () => {
            let rows: any[] = [];
            this.triggerQuery(this.selectedDB, {
                ...buildQuery(this.selectedDB, this, "_ttl", "select"),
                limit: 20,
                offset: 20 * page
            }, (row) => {
                rows.push(row);
            }, () => {
                if (!rows.length) {
                    if (nextTTL) {
                        this.getDB()._ttlTimer = setTimeout(this._checkTTL, nextTTL - Date.now());
                    }
                    return;
                }
                chainAsync(rows, (row, i, next) => {
                    if (row.date < Date.now()) {
                        const clearTTL = () => {
                            this.triggerQuery(this.selectedDB, {
                                ...buildQuery(this.selectedDB, this, "_ttl", "delete"),
                                where: ["key", "=", row.key]
                            }, noop, next, throwErr);
                        };
                        const rowData = row.key.split(".");
                        const table = rowData[0];
                        const key = ["float", "int", "number"].indexOf(this.getDB()._tables[table].pkType) === -1 ? rowData[1] : parseFloat(rowData[1]);
                        if (row.cols.length) {
                            let upsertObj = {};
                            row.cols.forEach((col) => {
                                upsertObj[col] = null;
                            });
                            this.triggerQuery(this.selectedDB, {
                                ...buildQuery(this.selectedDB, this, table, "upsert"),
                                actionArgs: upsertObj,
                                where: [this.getDB()._tables[table].pkCol, "=", key]
                            }, noop, clearTTL, throwErr);
                        } else {
                            this.triggerQuery(this.selectedDB, {
                                ...buildQuery(this.selectedDB, this, table, "delete"),
                                where: [this.getDB()._tables[table].pkCol, "=", key]
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
        if (table) {
            this.selectedTable = table;
        }
        return this;
    }

    public getPeers() {
        return JSON.parse(localStorage.getItem("nsql-peers-" + this.getDB().state.id) || "[]");
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
                this.getDB().filters[filterName] = [];
                filterObj[filterName].forEach((callback) => {
                    if (callback) {
                        this.getDB().filters[filterName].unshift(callback);
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

    public _saveTableIds(databaseID: string): Promise<any> {
        return new Promise((res, rej) => {
            this.triggerQuery(databaseID, {
                ...buildQuery(databaseID, this, "_util", "upsert"),
                actionArgs: assign({
                    key: "tableIds",
                    value: this.getDB(databaseID)._tableIds
                })
            }, noop, res, rej);
        })
    }

    public presetQuery(fn: string, args?: any): InanoSQLQueryBuilder {
        if (typeof this.selectedTable !== "string") {
            throw new Error(`Can't get table queries without selecting a table!`);
        }
        let found = Object.keys(this.getDB()._tables[this.selectedTable as string].queries).indexOf(fn) !== -1;
        if (!found) {
            throw new Error(`Can't find preset query ${fn}!`);
        }

        const fnArgs = this.getDB()._tables[this.selectedTable as string].queries[fn].args;
        let filteredArgs: any = {};
        if (fnArgs) {
            filteredArgs = cleanArgs2(this.selectedDB, args, fnArgs, this);
        }

        const q = this.getDB()._tables[this.selectedTable as string].queries[fn].call(this, filteredArgs);

        const queryBuilder = this.query("");
        queryBuilder._query = q;

        return queryBuilder;
    }

    public useDatabase(id: string): InanoSQLInstance {
        this.selectedDB = id;
        return this;
    }

    public createDatabase(config?: InanoSQLConfig): Promise<any> {
        return this.connect(config);
    }

    public listDatabases(): string[] {
        return Object.keys(this.dbs);
    }

    public dropDatabase(id: string): Promise<any> {
        return new Promise((res, rej) => {
            // drop all tables
            const tables = Object.keys(this.getDB(id)._tables);
            chainAsync(tables, (tableName, i, next, err) => {
                const table = this.getDB(id)._tables[tableName];
                this.triggerQuery(id, {
                    ...buildQuery(id, this, table.name, "drop")
                }, noop, () => {
                    next();
                }, err);
            }).then(() => {
                // delete config data
                delete this.dbs[id];
                // done
                res();
            }).catch(rej);
        });
    }

    public maybeCreateEventObject(id: string) {
        if (!this.events[id]) {
            this.events[id] = {
                Core: {
                    "*": new ReallySmallEvents()
                },
                "*": { "*": new ReallySmallEvents() }
            }
        }
    }

    public connect(config: InanoSQLConfig = {}): Promise<any> {
        let t = this;

        const newDatabaseID = config.id ? String(config.id) : "nSQL_DB";

        if (this.dbs[newDatabaseID]) {
            throw new Error(`nSQL: ${newDatabaseID} database has already been created!`);
        }

        this.maybeCreateEventObject(newDatabaseID);

        this.dbs[newDatabaseID] = {
            adapter: new SyncStorage(),
            _ttlTimer: 0,
            _Q: new _nanoSQLQueue(),
            state: {
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
                exportQueryObj: false
            },
            config: {
                id: newDatabaseID,
            },
            _tables: {},
            _fkRels: {},
            _tableIds: { "_util": "_util", "_ttl": "_ttl" },
            _queryCache: {},
            filters: {}
        }

        this.selectedDB = newDatabaseID;

        this._refreshEventChecker();

        return this._initPlugins(config).then(() => {
            return new Promise((res, rej) => {
                this.doFilter<configFilter>(newDatabaseID, "config", { res: config }, (r) => {
                    res(r.res);
                }, rej);
            });
        }).then((conf: InanoSQLConfig) => {
            this.getDB(newDatabaseID).state.id = newDatabaseID;

            this.getDB(newDatabaseID).config = {
                plugins: [],
                ...conf
            };

            if (typeof window !== "undefined" && conf && conf.peer) {
                this.getDB(newDatabaseID).state.peerMode = true;
            }
            return new Promise((res, rej) => {
                this.doFilter<willConnectFilter>(newDatabaseID, "willConnect", { res: this }, () => { res() }, rej);
            });
        }).then(() => {
            // setup and connect adapter
            return new Promise((res, rej) => {

                this.getDB(newDatabaseID).adapter = resolveMode(this.getDB(newDatabaseID).config.mode || "TEMP", this.getDB(newDatabaseID).config);

                if (this.getDB(newDatabaseID).adapter.plugin) {
                    (this.getDB(newDatabaseID).config.plugins || []).push(this.getDB(newDatabaseID).adapter.plugin);
                }

                this._initPlugins(this.getDB(newDatabaseID).config).then(() => {
                    this.getDB(newDatabaseID).adapter.nSQL = this;
                    adapterFilters(newDatabaseID, this).connect(this.getDB(newDatabaseID).state.id, () => {
                        this.doFilter<postConnectFilter>(newDatabaseID, "postConnect", { res: this.getDB(newDatabaseID).config }, (config) => {
                            this.getDB(newDatabaseID).config = config.res;
                            res();
                        }, rej)
                    }, rej);
                }).catch(rej);

                if (this.getDB(newDatabaseID).config.planetRadius) {
                    this.planetRadius = this.getDB(newDatabaseID).config.planetRadius as number;
                }

            });
        }).then(() => {

            this.triggerEvent(newDatabaseID, {
                target: "Core",
                targetId: this.getDB(newDatabaseID).state.id,
                path: "*",
                events: ["connect"],
                time: Date.now()
            });
            this.getDB(newDatabaseID).state.connected = true;

            const tables = ["_util", "_ttl"].concat((this.getDB(newDatabaseID).config.tables || []).map(t => t.name));

            return chainAsync(tables, (j, i, next, err) => {
                switch (j) {
                    case "_util":
                        this.triggerQuery(newDatabaseID, {
                            ...buildQuery(newDatabaseID, this, "_util", "create table"),
                            actionArgs: {
                                name: "_util",
                                model: {
                                    "key:string": { pk: true },
                                    "value:any": {}
                                },
                                _internal: true
                            }
                        }, noop, () => {
                            this.triggerQuery(newDatabaseID, {
                                ...buildQuery(newDatabaseID, this, "_util", "select"),
                                where: ["key", "=", "tableIds"]
                            }, (row) => {
                                this.getDB(newDatabaseID)._tableIds = {
                                    ...this.getDB(newDatabaseID)._tableIds,
                                    ...row.value
                                }
                            }, () => {
                                next();
                            }, err);
                        }, err);
                        break;
                    case "_ttl":
                        this.triggerQuery(newDatabaseID, {
                            ...buildQuery(newDatabaseID, this, "_ttl", "create table"),
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
                        const model = (this.getDB(newDatabaseID).config.tables || []).filter(t => t.name === j)[0];
                        if (!model) {
                            err("Table not found!");
                            return;
                        }
                        this.triggerQuery(newDatabaseID, {
                            ...buildQuery(newDatabaseID, this, j, "create table"),
                            actionArgs: model
                        }, noop, next as any, err);
                }
            });
        }).then(() => {

            // migrate nanosql version as needed
            return new Promise((res, rej) => {
                let currentVersion: number;
                this.triggerQuery(newDatabaseID, {
                    ...buildQuery(newDatabaseID, this, "_util", "select"),
                    where: ["key", "=", "version"]
                }, (row) => {
                    if (row) currentVersion = row.value;
                }, () => {
                    if (!currentVersion || currentVersion < 2.0) {
                        this.triggerQuery(newDatabaseID, {
                            ...buildQuery(newDatabaseID, this, "_util", "upsert"),
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
                if (!this.getDB(newDatabaseID).config.version) {
                    res();
                    return;
                }
                let currentVersion: number;
                this.triggerQuery(newDatabaseID,{
                    ...buildQuery(newDatabaseID, this, "_util", "select"),
                    where: ["key", "=", "db-version"]
                }, (row) => {
                    if (row) currentVersion = row.value;
                }, () => {
                    const saveVersion = (version: number, complete, err) => {
                        this.triggerQuery(newDatabaseID, {
                            ...buildQuery(newDatabaseID, this, "_util", "upsert"),
                            actionArgs: { key: "db-version", value: version }
                        }, noop, complete, err);
                    };
                    // nothing to migrate, just set version
                    if (!currentVersion) {
                        saveVersion(this.getDB(newDatabaseID).config.version || 0, res, rej);
                    } else {
                        const upgrade = () => {
                            if (currentVersion === this.getDB(newDatabaseID).config.version) {
                                saveVersion(this.getDB(newDatabaseID).config.version || 0, res, rej);
                            } else {
                                const updateVersion = this.getDB(newDatabaseID).config.onVersionUpdate;
                                if (!updateVersion) {
                                    saveVersion(this.getDB(newDatabaseID).config.version || 0, res, rej);
                                    return;
                                }
                                updateVersion(currentVersion).then((newVersion) => {
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
                    targetId: this.getDB(newDatabaseID).state.id,
                    events: ["ready"],
                    time: Date.now()
                };

                this.doFilter<readyFilter>(newDatabaseID, "ready", { res: event }, (evnt) => {
                    this.triggerEvent(newDatabaseID, evnt.res);
                    this.getDB(newDatabaseID).state.ready = true;
                    if (!this.getDB(newDatabaseID).config.disableTTL) {
                        this._checkTTL();
                    }
                    if (this.getDB(newDatabaseID).config.peer) {
                        this._initPeers();
                    }
                    res();
                }, rej);

            });
        });
    }

    public _initPeers() {
        let counter = 0;

        this.getDB().state.pid = uuidFN();

        // Append this peer to the network
        this.getDB().state.peers = this.getPeers();
        this.getDB().state.peers.unshift(this.getDB().state.pid);
        localStorage.setItem("nsql-peers-" + this.getDB().state.id, JSON.stringify(this.getDB().state.peers));
        // When localstorage changes we may need to possibly update the peer list
        // or possibly respond to an event from another peer
        window.addEventListener("storage", (e) => {
            // peer list updated
            if (e.key === "nsql-peers-" + this.getDB().state.id) {
                this.getDB().state.peers = this.getPeers();
            }
            // recieved event from another peer
            if (e.key && e.key.indexOf(this.getDB().state.pid + ".") === 0) {
                localStorage.removeItem(e.key);
                const ev: InanoSQLDatabaseEvent = JSON.parse(e.newValue || "{}");
                this.getDB().state.peerEvents.push(ev.query.queryID || "");
                this.triggerEvent(this.selectedDB, {
                    ...ev,
                    types: ["peer change"]
                });
                setFast(() => {
                    this.triggerEvent(this.selectedDB, ev);
                });
            }
            // the "master" peer checks to make sure all peers have been
            // cleaning up their mess every 50 requests, if they aren't they
            // are removed. Keeps localStorage from filling up accidentally.
            counter++;
            if (counter > 50 && this.getDB().state.peers[0] === this.getDB().state.pid) {
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
                        this.getDB().state.peers = this.getDB().state.peers.filter(p => p !== peerID);
                        peerKeys[peerID].forEach((key) => {
                            localStorage.removeItem(key);
                        });
                        localStorage.setItem("nsql-peers-" + this.getDB().state.id, JSON.stringify(this.getDB().state.peers));
                    }
                });
            }
        });
        window.onblur = () => {
            this.getDB().state.focused = false;
        };
        // on focus we set this nsql to focused and move it's peer position
        // to the front
        window.onfocus = () => {
            // set this peer to master on focus
            this.getDB().state.peers = this.getDB().state.peers.filter((p) => p !== this.getDB().state.pid);
            this.getDB().state.peers.unshift(this.getDB().state.pid);
            localStorage.setItem("nsql-peers-" + this.getDB().state.id, JSON.stringify(this.getDB().state.peers));
            this.getDB().state.focused = true;
        };
        // send events to the peer network
        nSQL("*").on("change", (ev) => {
            const idxOf = this.getDB().state.peerEvents.indexOf(ev.query.queryID || "");
            if (idxOf !== -1) {
                this.getDB().state.peerEvents.splice(idxOf, 1);
                return;
            }
            this.getDB().state.peers.filter(p => p !== this.getDB().state.pid).forEach((p) => {
                localStorage.setItem(p + "." + ev.query.queryID, JSON.stringify(ev));
            });
        });
        // Remove self from peer network
        window.addEventListener("beforeunload", () => {
            this.getDB().state.peers = this.getDB().state.peers.filter((p) => p !== this.getDB().state.pid);
            localStorage.setItem("nsql-peers-" + this.getDB().state.id, JSON.stringify(this.getDB().state.peers));
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
 
        let l: string = selectTable || (typeof this.selectedTable !== "string" ? "" : this.selectedTable) as string;

        const selDB = this.selectedDB;

        this.maybeCreateEventObject(selDB);

        this.doFilter<onEventFilter>(selDB, "onEvent", { res: { action, callback: callBack } }, (newEvent) => {

            switch (newEvent.res.action) {
                case "connect":
                case "ready":
                case "disconnect":
                case "peer change":
                case "slow query":
                    this.events[selDB].Core["*"].on(newEvent.res.action, newEvent.res.callback);
                    break;
                case "select":
                case "change":
                case "delete":
                case "upsert":
                case "*":
                    const table = resolvePath(l);
                    if (!this.events[selDB][table[0]]) {
                        this.events[selDB][table[0]] = {
                            "*": new ReallySmallEvents()
                        };
                    }
                    const nestedPath = table.filter((v, i) => i > 0).join(".") || "*";
                    if (!this.events[selDB][table[0]][nestedPath]) {
                        this.events[selDB][table[0]][nestedPath] = new ReallySmallEvents();
                    }
                    this.events[selDB][table[0]][nestedPath].on(newEvent.res.action, newEvent.res.callback);
                    break;
                default:
                    new Promise((res, rej) => {
                        this.doFilter<customEventFilter>(selDB, "customEvent", { res: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, res, rej);
                    }).then((evData: customEventFilter) => {
                        if (evData.res.nameSpace) {
                            if (!this.events[selDB][evData.res.nameSpace]) {
                                this.events[selDB][evData.res.nameSpace] = {
                                    "*": new ReallySmallEvents()
                                };
                            }
                            if (!this.events[selDB][evData.res.nameSpace][evData.res.path]) {
                                this.events[selDB][evData.res.nameSpace][evData.res.path] = new ReallySmallEvents();
                            }
                            this.events[selDB][evData.res.nameSpace][evData.res.path].on(newEvent.res.action, newEvent.res.callback);
                        } else {
                            throw new Error(`Invalid event "${action}"!`);
                        }
                        this._refreshEventChecker();
                    });
            }

            this._refreshEventChecker();

        }, noop);
    }

    public off(action: string, callBack: (event: InanoSQLDatabaseEvent) => void, selectTable?: string): void {

        let l: string = selectTable || (typeof this.selectedTable !== "string" ? "" : this.selectedTable) as string;

        const selDB = this.selectedDB;

        this.maybeCreateEventObject(selDB);

        this.doFilter<offEventFilter>(selDB, "offEvent", { res: { action, callback: callBack } }, (newEvent) => {

            switch (newEvent.res.action) {
                case "connect":
                case "ready":
                case "disconnect":
                case "peer change":
                case "slow query":
                    this.events[selDB].Core["*"].off(newEvent.res.action, newEvent.res.callback);
                    break;
                case "select":
                case "change":
                case "delete":
                case "upsert":
                case "*":
                    const table = resolvePath(l);
                    if (!this.events[selDB][table[0]]) {
                        this.events[selDB][table[0]] = {
                            "*": new ReallySmallEvents()
                        };
                    }
                    const nestedPath = table.filter((v, i) => i > 0).join(".") || "*";
                    if (!this.events[selDB][table[0]][nestedPath]) {
                        this.events[selDB][table[0]][nestedPath] = new ReallySmallEvents();
                    }
                    this.events[selDB][table[0]][nestedPath].off(newEvent.res.action, newEvent.res.callback);
                    break;
                default:
                    new Promise((res, rej) => {
                        this.doFilter<customEventFilter>(selDB, "customEvent", { res: { nameSpace: "", path: "*" }, selectedTable: l, action: action, on: true }, res, rej);
                    }).then((evData: customEventFilter) => {
                        if (evData.res.nameSpace) {
                            if (!this.events[selDB][evData.res.nameSpace]) {
                                this.events[selDB][evData.res.nameSpace] = {
                                    "*": new ReallySmallEvents()
                                };
                            }
                            if (!this.events[selDB][evData.res.nameSpace][evData.res.path]) {
                                this.events[selDB][evData.res.nameSpace][evData.res.path] = new ReallySmallEvents();
                            }
                            this.events[selDB][evData.res.nameSpace][evData.res.path].off(newEvent.res.action, newEvent.res.callback);
                        } else {
                            throw new Error(`Invalid event "${action}"!`);
                        }
                        this._refreshEventChecker();
                    });
            }

            this._refreshEventChecker();

        }, noop);
    }

    public _refreshEventChecker(): InanoSQLInstance {

        if (!this.dbs[this.selectedDB]) return this;

        this.getDB().state.hasAnyEvents = Object.keys(this.events[this.selectedDB]).reduce((prev, cur) => {
            if (prev === true) return true;
            const length = Object.keys(this.events[this.selectedDB][cur]).reduce((p, key) => {
                return Object.keys(this.events[this.selectedDB][cur][key].eventListeners).length + p;
            }, 0);
            return length > 0 ? true : prev;
        }, false as boolean);

        return this;
    }

    public getView(viewName: string, viewArgs: any): Promise<any> {
        return this._doAV("v", this.selectedTable as any, viewName, viewArgs);
    }


    public doAction(actionName: string, actionArgs: any): Promise<any> {
        return this._doAV("a", this.selectedTable as any, actionName, actionArgs);
    }

    public _doAV(AVType: "a" | "v", table: string, AVName: string, AVArgs: any): Promise<any> {
        if (typeof this.selectedTable !== "string") return Promise.reject("Can't do Action/View with selected table!");
        return new Promise((res, rej) => {
            this.doFilter<actionViewFilter>(this.selectedDB, "actionView", {
                res: {
                    AVType,
                    table,
                    AVName,
                    AVArgs
                }
            }, res, rej);
        }).then((actionOrView: actionViewFilter) => {
            const key = actionOrView.res.AVType === "a" ? "actions" : "views";

            const selAV: InanoSQLActionOrView | null = this.getDB()._tables[actionOrView.res.table][key].reduce((prev, cur) => {
                if (cur.name === actionOrView.res.AVName) return cur;
                return prev;
            }, null as any);

            if (!selAV) {
                return new Promise((res, rej) => rej(`${actionOrView.res.AVType} "${actionOrView.res.AVName}" Not Found!`));
            }

            return selAV.call(selAV.args ? cleanArgs(this.selectedDB, selAV.args, actionOrView.res.AVArgs, this) : {}, this);
        });
    }

    public query(action: string | ((nSQL: InanoSQLInstance) => InanoSQLQuery), args?: any): InanoSQLQueryBuilder {
        if (this.selectedDB && typeof this.selectTable === "string") {
            const av = this.getDB().state.activeAV;
            this.getDB().state.activeAV = "";
            return new _nanoSQLQueryBuilder(this.selectedDB, this, this.selectedTable, action, args, av);
        } else {
            return new _nanoSQLQueryBuilder(this.selectedDB, this, this.selectedTable, action, args, "");
        }
    }

    public triggerQuery(databaseID: string|undefined, query: InanoSQLQuery, onRow: (row: any) => void, complete: () => void, error: (err: string) => void): void {


        const execQuery = (setQuery) => {
            new _nanoSQLQuery(databaseID, this, setQuery.res, (row) => {
                onRow(row);
            }, complete, error);
        };

        if (typeof query.table === "string") {
            if (!this.getDB(databaseID).state.connected) {
                error("nSQL: Can't do a query before the database is connected!");
                return;
            } 
            this.doFilter<queryFilter>(databaseID, "query", { res: query }, execQuery, error);
        } else {
            execQuery({ res: query });
        }

        
    }

    public triggerEvent(databaseID: string|undefined, eventData: InanoSQLDatabaseEvent, ignoreStarTable?: boolean): InanoSQLInstance {

        if (!databaseID) return this;

        if (!this.events[databaseID]) return this;

        this.doFilter<eventFilter>(databaseID, "event", { res: eventData }, (event) => {
            if (this.getDB(databaseID).state.hasAnyEvents) {
                setFast(() => {
                    event.res.events.forEach((evnt) => {
                        if (!ignoreStarTable) {
                            Object.keys(this.events[databaseID]["*"]).forEach((path) => {
                                this.events[databaseID]["*"][path].trigger(evnt, event.res);
                            });
                        }
                        if (!this.events[databaseID][event.res.target]) return;
                        if (event.res.path === "_all_") {
                            Object.keys(this.events[databaseID][event.res.target]).forEach((path) => {
                                this.events[databaseID][event.res.target][path].trigger(evnt, event.res);
                            });
                        } else {
                            if (!this.events[databaseID][event.res.target][event.res.path]) return;
                            this.events[databaseID][event.res.target][event.res.path].trigger(evnt, event.res);
                        }
                    });
                });
            }
        }, (err) => {
            console.log("Event suppressed", err);
        });

        return this;
    }

    private _countTimers: {
        [key: string]: (nSQL: InanoSQLInstance ,dbId: string, tableName: string) => void;
    } = {};

    public saveCount(databaseID: string, tableName: string, complete?: (err?: any) => void) {
        if (tableName.indexOf("_") === 0) {
            if (complete) complete();
            return;
        }

        const doUpdate = (parent: InanoSQLInstance, dbID: string, table: string, done?: (err?: any) => void) => {
            const total = parent.getDB(dbID)._tables[table].count;
            const id = parent.getDB(dbID)._tables[table].id;
            parent.triggerQuery(dbID, {
                ...buildQuery(dbID, parent, "_util", "upsert"),
                actionArgs: {key: "total_" + id, value: total},
            }, noop, () => {
                if (done) done();
            }, (err) => {
                if (done) done(err);
                console.error("nSQL: Error updating table total.", err);
            });
        }

        // do now
        if (complete) {
            doUpdate(this, databaseID, tableName, complete);
            return;
        }

        // do later
        if (!this._countTimers[databaseID + tableName]) {
            this._countTimers[databaseID + tableName] = utils.throttle(undefined, doUpdate, 1000);
        }
        this._countTimers[databaseID + tableName](this, databaseID, tableName);
    }

    public default(databaseID: string|undefined, replaceObj?: any, table?: string): { [key: string]: any } | Error {

        if (!databaseID) return replaceObj;

        replaceObj = replaceObj || {};
        if (!table && typeof this.selectedTable !== "string") {
            throw new Error("Must select table to generate defualts!");
        }
        table = (table || this.selectedTable as any) as string;
        if (!this.getDB(databaseID)._tables[table]) {
            throw new Error(`nSQL: Table "${table}" not found in database ${databaseID} for generating default object!`);
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
                    let value = typeof useObj[m.key] !== "undefined" ? cast(databaseID, m.type, useObj[m.key], false, this) : (typeof m.default === "function" ? m.default(replaceObj) : m.default);
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

                if (newObj[m.key] === null) {
                    newObj[m.key] = undefined;
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

        return resolveModel(this.getDB(databaseID)._tables[table].columns, replaceObj);
    }
/*
    public batch(tables: {[table: string]: {[place: string]: {type: "put"|"del", data: any}}}, complete: () => void, error: (message) => void) {

    }

*/
    public rawDump(tables: string[], indexes: boolean, onRow: (table: string, row: { [key: string]: any }) => void): Promise<any> {

        const exportTables = indexes ? tables : Object.keys(this.getDB()._tables).filter(t => tables.length ? tables.indexOf(t) !== -1 : true);

        return chainAsync(exportTables, (table: string, i, nextTable, err) => {
            if (indexes) {
                const tableName = table.indexOf(":") !== -1 ? table.split(":")[0] : table;
                const tableIndexes = table.indexOf(":") !== -1 ? [table.split(":")[1]] : Object.keys(this.getDB()._tables[table].indexes);
                chainAsync(tableIndexes, (index, i, nextIdx, errIdx) => {
                    adapterFilters(this.selectedDB, this).readIndexKeys(tableName, index, "all", undefined, undefined, false, (key, id) => {
                        onRow(tableName + "." + index, { indexId: id, rowId: key });
                    }, nextIdx, errIdx);
                }).then(nextTable).catch(err);
            } else {
                adapterFilters(this.selectedDB, this).readMulti(table, "all", undefined, undefined, false, (row) => {
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

        const selectedDB = this.selectedDB;

        const usableTables = Object.keys(this.getDB()._tables);
        const importTables: string[] = indexes ? Object.keys(tables) : Object.keys(tables).filter(t => usableTables.indexOf(t) !== -1);

        return chainAsync(importTables, (table, i, next, err) => {
            if (indexes) {
                // tableName:IndexName
                const tableName = table.split(".")[0];
                const indexName = table.split(".")[1];

                chainAsync(tables[table], (indexRow, ii, nextIdx, errIdx) => {
                    adapterFilters(selectedDB, this).addIndexValue(tableName, indexName, indexRow.rowId, indexRow.indexId, nextIdx, errIdx);
                }).then(next).catch(err);

            } else {
                const pk = this.getDB()._tables[table].pkCol;
                // this.getDB()._tables[table].count = tables[table].length;
                const batchFN = this.getDB().adapter.batch;
                if (batchFN) { // batch writes supported
                    const tableId = this.getDB()._tableIds[table];
                    batchFN.apply(this.getDB().adapter, [tableId, tables[table].map((r) => {
                        progress++;
                        if (onProgress) onProgress(Math.round((progress / totalLength) * 10000) / 100);
                        return {type: "put", data: r}
                    }), () => {
                        next();
                    }, err]);
                } else { // not supported

                    console.warn("Batch import not using transaction, transactions not supported by adapter!");

                    chainAsync(tables[table], (row, ii, nextRow, rowErr) => {
                        if (!deepGet(pk, row) && rowErr) {
                            rowErr("No primary key found, can't import: " + JSON.stringify(row));
                            return;
                        }
                        adapterFilters(selectedDB, this).write(table, deepGet(pk, row), row, (newRow) => {
                            nextRow();
                            progress++;
                            if (onProgress) onProgress(Math.round((progress / totalLength) * 10000) / 100);
                        }, rowErr || noop);
                    }).then(() => {
                        this.saveCount(selectedDB, table);
                        next();
                    }).catch(err);
                }

            }
        });
    }

    public disconnect(dbID?: string) {
        return new Promise((res, rej) => {
            const Databases = dbID ? [dbID] : Object.keys(this.dbs);
            chainAsync(Databases, (dbID, i, next, err) => {
                this.doFilter<disconnectFilter>(dbID, "disconnect", {}, () => {
                    adapterFilters(dbID, this).disconnect(() => {
                        delete this.dbs[dbID];
                        next();
                    }, err);
                }, err);
            }).then(() => {
                res();
            }).catch(rej);
        });
    }

    public extend(scope: string, ...args: any[]): any | nanoSQL {
        return new Promise((res, rej) => {
            this.doFilter<extendFilter>(this.selectedDB, "extend", { scope: scope, args: args, res: null }, res, rej);
        });
    }

    public loadJS(rows: { [key: string]: any }[], onProgress?: (percent: number) => void, parallel?: boolean): Promise<any[]> {

        const table = this.selectedTable;

        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load JS into temporary table!");
        }

        const total = rows.length;
        let count = 0;
        const async = parallel ? allAsync : chainAsync;
        return async(rows, (row, i, next, err) => {
            this.triggerQuery(this.selectedDB, {
                ...buildQuery(this.selectedDB, this, table, "upsert"),
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
        return csv.split(/\r?\n|\r|\t/gmi).map((v, k) => {
            if (k === 0) {
                fields = v.split(",").map(s => s.substring(1, s.length - 1));
                return undefined;
            } else {
                if (String(v).trim().length < 1) return undefined;

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

    public loadCSV(csvString: string, rowMap?: (row: any) => any, onProgress?: (percent: number) => void, parallel?: boolean): Promise<any[]> {

        const table = this.selectedTable;

        if (typeof table !== "string") {
            return Promise.reject("nSQL: Can't load CSV into temporary table!");
        }

        const rowData = this.CSVtoJSON(csvString, rowMap);
        
        const async = parallel ? allAsync : chainAsync;
        let count = 0;
        return async(rowData, (row, i, nextRow, err) => {
            this.triggerQuery(this.selectedDB, {
                ...buildQuery(this.selectedDB, this, table, "upsert"),
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
    let conf: any = {};
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
        id: conf.id || "nanoSQL_DB",
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
    window["@nano-sql/core"] = window["@nano-sql"].core;
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