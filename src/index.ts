import { setFast } from "lie-ts";
import { _NanoSQLQuery, IdbQuery, IdbQueryExec } from "./query/std-query";
import { _NanoSQLTransactionQuery } from "./query/transaction";
import { ReallySmallEvents } from "really-small-events";
import { StdObject, _assign, fastALL, random16Bits, cast, cleanArgs, objQuery, Promise, fastCHAIN, intersect, crowDistance, removeDuplicates, uuid } from "./utilities";
import { NanoSQLDefaultBackend } from "./database/index";
import { _NanoSQLHistoryPlugin } from "./history-plugin";
import { NanoSQLStorageAdapter } from "./database/storage";
import * as levenshtein from "levenshtein-edit-distance";
import { Observer } from "./observable";

const VERSION = 1.70;

// uglifyJS fix
const str = ["_util"];

export interface NanoSQLBackupAdapter {
    adapter: NanoSQLStorageAdapter; // the adapter to use
    waitForWrites?: boolean; // should we wait until writes are succesful to return write promises?
}

export interface NanoSQLConfig {
    id?: string | number;
    peer?: boolean;
    cache?: boolean;
    mode?: string | NanoSQLStorageAdapter | boolean;
    history?: boolean;
    hostoryMode?: string | { [table: string]: string };
    secondaryAdapters?: NanoSQLBackupAdapter[];
    idbVersion?: number;
    dbPath?: string; // path (used by LevelDB)
    writeCache?: number; // writeCache (used by LevelDB)
    readCache?: number; // read cache (used by LevelDB)
    size?: number; // size of WebSQL database
    tokenizer?: (table: string, column: string, args: string[], value: string) => {
        o: string; // original string
        w: string; // tokenized output
        i: number; // location of string
    }[] | boolean;
    [key: string]: any;
}

/**
 * This is the format used for actions and views
 *
 * @export
 * @interface ActionOrView
 */
export interface ActionOrView {
    name: string;
    args?: string[];
    extend?: any;
    call: (args?: any, db?: NanoSQLInstance) => Promise<any>;
}


export interface NanoSQLFunction {
    type: "A" | "S"; // aggregate or simple function
    call: (rows: any[], complete: (result: any | any[]) => void, ...args: any[]) => void; // function call
}

/**
 * You need an array of these to declare a data model.
 *
 * @export
 * @interface DataModel
 */
export interface DataModel {
    key: string;
    type: "string" | "int" | "float" | "array" | "map" | "bool" | "uuid" | "blob" | "timeId" | "timeIdms" | "safestr" | "number" | "object" | "obj" | string;
    default?: any;
    props?: any[];
}

/**
 * Returned by the event listener when it's called.
 *
 * @export
 * @interface DatabaseEvent
 */
export interface DatabaseEvent {
    table: string;
    query: IdbQuery;
    time: number;
    notes: string[];
    result: any[];
    types: ("change" | "delete" | "upsert" | "drop" | "select" | "error" | "transaction" | "peer-change")[];
    actionOrView: string;
    transactionID?: string;
    affectedRowPKS?: any[];
    affectedRows: DBRow[];
}

/**
 * The arguments used for the join command.
 *
 * Type: join type to use
 * Query: A select query to use for the right side of the join
 * Where: Conditions to use to merge the data
 *
 * @export
 * @interface JoinArgs
 */
export interface JoinArgs {
    type: "left" | "inner" | "right" | "cross" | "outer";
    table: string;
    where?: Array<string>;
}

/**
 * ORM arguments to query ORM data.
 *
 * @export
 * @interface ORMArgs
 */
export interface ORMArgs {
    key: string;
    select?: string[];
    offset?: number;
    limit?: number;
    orderBy?: {
        [column: string]: "asc" | "desc";
    };
    groupBy?: {
        [column: string]: "asc" | "desc";
    };
    where?: (row: DBRow, idx: number) => boolean | any[];
}

/**
 *  A single database row.
 *
 * @export
 * @interface DBRow
 */
export interface DBRow {
    [key: string]: any;
}



export interface IActionViewMod {
    (
        tableName: string,
        actionOrView: "Action" | "View",
        name: string,
        args: any,
        complete: (args: any) => void, error?: (errorMessage: string) => void
    ): void;
}



/**
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class NanoSQLInstance
 */
export class NanoSQLInstance {


    /**
     * Holds the current selected table
     *
     * @public
     * @type {string}
     * @memberOf NanoSQLInstance
     */
    public sTable: string | any[];

    private _config: StdObject<any>;

    public plugins: NanoSQLPlugin[];

    public version: number = VERSION;

    public static earthRadius: number = 6371;

    /**
     * Holds the plugin / adapter used by instance queries.
     *
     * @type {NanoSQLPlugin}
     * @memberof NanoSQLInstance
     */
    public iB: NanoSQLPlugin;

    public isConnected: boolean;


    // Incase you don't need truly random numbers,
    // this will generate a cache of random numbers and loop between them.
    private _randoms: number[];
    private _randomPtr: number;

    public static functions: {
        [fnName: string]: NanoSQLFunction;
    };

    public static whereFunctions: {
        [fnName: string]: (row: any, isJoin: boolean, ...args: any[]) => any;
    };

    /**
     * Misc placeholder that can be used by the dev.
     *
     * @type {*}
     * @memberOf NanoSQLInstance
     */
    public data: any;

    public rowFilters: { [table: string]: (row: any) => any };


    /**
     * An array of possible events
     *
     * @internal
     * @type {Array<string>}
     * @memberOf NanoSQLInstance
     */
    private _events: string[];

    /**
     * Holds a map of the current views for this database.
     *
     * @internal
     * @type {StdObject<Array<ActionOrView>>}
     * @memberOf NanoSQLInstance
     */
    private _views: StdObject<ActionOrView[]>;

    /**
     * Holds a map of the current actions for this database.
     *
     * @internal
     * @type {StdObject<Array<ActionOrView>>}
     * @memberOf NanoSQLInstance
     */
    private _actions: StdObject<ActionOrView[]>;

    /**
     * Holds a reference to the optional action/view modifier
     *
     *
     * @memberOf NanoSQLInstance
     */
    private _AVMod: IActionViewMod;

    /**
     * Holds wether each table has a primary key or not
     *
     * @type {{[table: string]: boolean}}
     * @memberof NanoSQLInstance
     */
    public hasPK: { [table: string]: boolean };

    /**
     * Lets you modify queries before they run on the database
     *
     * @internal
     *
     * @memberOf NanoSQLInstance
     */
    public queryMod: (args: IdbQuery, complete: (args: IdbQuery) => void) => void;

    /**
     * A map containing the models
     *
     * @internal
     * @type {StdObject<Array<DataModel>>}
     * @memberOf NanoSQLInstance
     */
    public dataModels: { [table: string]: DataModel[] };

    /**
     * Stores wether each table has events attached to it or not.
     *
     * @public
     * @type {StdObject<boolean>}
     * @memberOf NanoSQLInstance
     */
    private _hasEvents: StdObject<boolean>;

    /**
     * Stores wether the event system needs to be active at all.
     *
     * @type {boolean}
     * @memberof NanoSQLInstance
     */
    public hasAnyEvents: boolean;

    /**
     * The current action or view being triggered.
     *
     * @internal
     * @type {string}
     * @memberOf NanoSQLInstance
     */
    private _activeAV: string | undefined;

    public pluginHasDidExec: boolean;


    /**
     * Store an array of table names for ORM type casting.
     *
     * @private
     * @type {string[]}
     * @memberof NanoSQLInstance
     */
    public tableNames: string[];


    /**
     * Stores wether {key: "*", type: "*"} is in the data model
     *
     * @type {{
     *         [tableName: string]: boolean;
     *     }}
     * @memberof NanoSQLInstance
     */
    public skipPurge: {
        [tableName: string]: boolean;
    };

    public tablePKs: { [table: string]: any };

    private _onConnectedCallBacks: any[] = [];

    private _callbacks: {
        [table: string]: ReallySmallEvents;
    };

    public toColRules: {
        [table: string]: {
            [column: string]: string[];
        }
    };

    public peers: string[];
    public pid: string;
    public id: string;
    public peerEvents: string[];
    public focused: boolean;
    public peerMode: boolean;

    public toRowFns: { [table: string]: { [fnName: string]: (primaryKey: any, existingRow: any, callback: (newRow: any) => void) => void } };
    public toColFns: { [table: string]: { [fnName: string]: (existingValue: any, callback: (newValue: any) => void, ...args: any[]) => void } };

    constructor() {

        let t = this;
        t.isConnected = false;
        t.focused = true;
        t._actions = {};
        t._views = {};
        t.dataModels = {};
        t._events = ["*", "change", "delete", "upsert", "drop", "select", "error", "peer-change"];

        t._hasEvents = {};
        t.tableNames = [];
        t.plugins = [];
        t.hasPK = {};
        t.skipPurge = {};
        t.toRowFns = {};
        t.tablePKs = {};
        t.toColFns = {};
        t.toColRules = {};
        t.rowFilters = {};
        t.peers = [];
        t.peerEvents = [];
        t.pid = uuid();

        t._randoms = [];
        // t._queryPool = [];
        // t._queryPtr = 0;
        t._randomPtr = 0;
        t.hasAnyEvents = false;
        for (let i = 0; i < 1000; i++) {
            t._randoms.push(random16Bits());
            // t._queryPool.push(new _NanoSQLQuery(t));
        }

        t._callbacks = {};
        t._callbacks["*"] = new ReallySmallEvents();
        t.iB = new NanoSQLDefaultBackend();
        const instanceConnectArgs: DBConnect = {
            models: {},
            actions: {},
            views: {},
            config: {},
            parent: this
        };
        if (t.iB.willConnect) {
            t.iB.willConnect(instanceConnectArgs, () => {
                if (t.iB.didConnect) {
                    t.iB.didConnect(instanceConnectArgs, () => {

                    });
                }
            });
        }
    }

    public rowFilter(callback: (row: any) => any): this {
        this.rowFilters[this.sTable as string] = callback;
        return this;
    }

    public toColumn(columnFns: { [fnName: string]: (existingValue: any, callback: (newValue: any) => void, ...args: any[]) => void }): this {
        if (!this.toColFns[this.sTable as string]) {
            this.toColFns[this.sTable as string] = {};
        }
        this.toColFns[this.sTable as string] = columnFns;
        return this;
    }

    public toRow(columnFns: { [fnName: string]: (primaryKey: any, existingRow: any, callback: (newRow: any) => void) => void }): this {
        if (!this.toRowFns[this.sTable as string]) {
            this.toRowFns[this.sTable as string] = {};
        }
        this.toRowFns[this.sTable as string] = columnFns;
        return this;
    }

    /**
     * nanoSQL generates 50 random 16 bit strings on every launch.
     * If you don't need true randomness you can use this function to get a psudorandom 16 bit string.
     * Performance is orders of a magnitude faster since no random number generator is needed.
     *
     * @returns {string}
     * @memberof NanoSQLInstance
     */
    public fastRand(): number {
        this._randomPtr++;
        if (this._randomPtr >= this._randoms.length) {
            this._randomPtr = 0;
        }
        return this._randoms[this._randomPtr];
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
        if (table) this.sTable = table;
        return this;
    }

    public getPeers() {
        return JSON.parse(localStorage.getItem("nsql-peers-" + this.id) || "[]");
    }

    /**
     * Inits the backend database for use.
     *
     * Optionally include a custom database driver, otherwise the built in memory driver will be used.
     *
     * @param {NanoSQLBackend} [backend]
     * @returns {(Promise<Object | string>)}
     *
     * @memberOf NanoSQLInstance
     */
    public connect(): Promise<Object | string> {
        let t = this;

        return new Promise((res, rej) => {

            let connectArgs: DBConnect = {
                models: t.dataModels,
                actions: t._actions,
                views: t._views,
                config: t._config,
                parent: this,
            };

            connectArgs.models[str[0]] = [
                { key: "key", type: "string", props: ["pk()", "ai()"] },
                { key: "value", type: "any" }
            ];

            // if history is enabled, turn on the built in history plugin
            if (t._config && t._config.history) {
                this.use(new _NanoSQLHistoryPlugin(t._config.historyMode));
            }

            // If the db mode is not set to disable, add default store to the end of the plugin chain
            if (!t._config || t._config.mode !== false) {
                this.use(new NanoSQLDefaultBackend());
            }

            if (typeof window !== "undefined" && this._config && this._config.peer) {
                this.peerMode = true;
            }

            fastCHAIN(t.plugins, (p, i, nextP) => {
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
                t._config = connectArgs.config;

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

                    fastALL(t.plugins, (p, i, nextP) => {
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
                        res(t.tableNames);
                    });
                };

                const updateVersion = (rebuildIDX: boolean) => {
                    t.query("upsert", { key: "version", value: t.version }).manualExec({ table: "_util" }).then(() => {
                        if (rebuildIDX) {
                            t.extend("beforeConn", "rebuild_idx").then(() => {
                                completeConnect();
                            });
                        } else {
                            completeConnect();
                        }
                    });
                };

                t.query("select").where(["key", "=", "version"]).manualExec({ table: "_util" }).then((rows) => {

                    if (!rows.length) {
                        // new database or an old one that needs indexes rebuilt
                        updateVersion(true);
                    } else {

                        if (rows[0].value <= 1.21) { // secondary indexes need to be rebuilt before 1.21
                            updateVersion(true);
                        } else if (rows[0].value < VERSION) {
                            updateVersion(false);
                        } else {
                            completeConnect();
                        }
                    }
                });

            });
        });
    }

    /**
     * Get all actions for a given table
     * =
     * @param {string} table
     * @returns
     * @memberof NanoSQLInstance
     */
    public getActions(table: string) {
        return this._actions[table].map((a) => {
            return {
                name: a.name,
                args: a.args
            };
        });
    }

    /**
     * Get all views for a given table
     *
     * @param {string} table
     * @returns
     * @memberof NanoSQLInstance
     */
    public getViews(table: string) {
        return this._views[table].map((a) => {
            return {
                name: a.name,
                args: a.args
            };
        });
    }

    /**
     * Grab a copy of the database config object.
     *
     * @returns
     * @memberof NanoSQLInstance
     */
    public getConfig(): NanoSQLConfig {
        return this._config || {};
    }

    /**
     * Set the action/view filter function.  Called *before* the action/view is sent to the datastore
     *
     * @param {IActionViewMod} filterFunc
     * @returns
     *
     * @memberOf NanoSQLInstance
     */
    public avFilter(filterFunc: IActionViewMod) {
        this._AVMod = filterFunc;
        return this;
    }

    public use(plugin: NanoSQLPlugin): this {
        return this.plugins.push(plugin), this;
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
    public on(actions: string, callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance {
        let t = this;
        let l = t.sTable;
        let i = t._events.length;
        let a = actions.split(" ");

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
    public off(actions: string, callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance {
        let t = this;
        let a = actions.split(" ");
        let i = a.length;
        let l = t.sTable;

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
	 * Declare the data model for the current selected table.
     *
     * Please reference the DataModel interface for how to impliment this, a quick example:
     *
     * ```ts
     * .model([
     *  {key:"id",type:"int",props:["ai","pk"]} //auto incriment and primary key
     *  {key:"name",type:"string"}
     * ])
     * ```
	 *
	 * @param {Array<DataModel>} dataModel
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public model(dataModel: DataModel[], props?: any[], ignoreSanityCheck?: boolean): NanoSQLInstance {
        let t = this;
        let l: string = t.sTable as string;

        if (Array.isArray(l)) return this;

        if (!t._callbacks[l]) {
            t._callbacks[l] = new ReallySmallEvents();
        }

        let hasPK = false;

        if (!ignoreSanityCheck) {
            // validate table name and data model
            const types = ["string", "safestr", "timeId", "timeIdms", "uuid", "int", "float", "number", "array", "map", "bool", "blob", "any"];
            if (types.indexOf(l.replace(/\W/gmi, "")) !== -1 || l.indexOf("_") === 0 || l.match(/[\(\)\]\[\.]/g) !== null) {
                throw Error("Invalid Table Name! https://docs.nanosql.io/setup/data-models");
            }
            (dataModel || []).forEach((model) => {
                if (model.key.match(/[\(\)\]\[\.]/g) !== null || model.key.indexOf("_") === 0) {
                    throw Error("Invalid Data Model! https://docs.nanosql.io/setup/data-models");
                }
            });
        }

        t.toColRules[l] = {};

        (dataModel || []).forEach((model) => {

            if (model.props) {
                model.props.forEach((prop) => {
                    // old format: from=>fn(arg1, arg2);
                    if (prop.indexOf("from=>") !== -1 && prop.indexOf("(") !== -1) {
                        const fnName = prop.replace("from=>", "").split("(").shift();
                        const fnArgs = prop.replace("from=>", "").split("(").pop().replace(")", "").split(",").map(c => c.trim());
                        t.toColRules[l][model.key] = [fnName].concat(fnArgs);
                    }
                    // new format: toColumn.fn(arg1, arg2);
                    if (prop.indexOf("toColumn.") === 0) {
                        const fnName = prop.replace(/toColumn\.(.*)\(.*\)/gmi, "$1");
                        const fnArgs = prop.replace(/toColumn\..*\((.*)\)/gmi, "$1").split(",").map(c => c.trim());
                        t.toColRules[l][model.key] = [fnName].concat(fnArgs);
                    }
                });
            }

            if (model.props && intersect(["pk", "pk()"], model.props)) {
                this.tablePKs[l] = model.key;
                hasPK = true;
            }
        });

        this.hasPK[l] = hasPK;

        if (!hasPK) {
            this.tablePKs[l] = "_id_";
            dataModel.unshift({ key: "_id_", type: "uuid", props: ["pk()"] });
        }

        t.dataModels[l] = dataModel;
        t._views[l] = [];
        t._actions[l] = [];
        return t;
    }

    /**
	 * Declare the views for the current selected table.  Must be called before connect()
     *
     * Views are created like this:
     *
     * ```ts
     * .views([
     *  {
     *      name:"view-name",
     *      args: ["array","of","arguments"],
     *      call: function(args) {
     *          // Because of our "args" array the args input of this function will look like this:
     *          // NanoSQL will not let any other arguments into this function.
     *          args:{
     *              array:'',
     *              of:'',
     *              arguments:''
     *          }
     *          //We can use them in our query
     *          return this.query('select').where(['name','IN',args.array]).exec();
     *      }
     *  }
     * ])
     * ```
     *
     * Then later in your app..
     *
     * ```ts
     * NanoSQL("users").getView("view-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     *
     * ```ts
     * .views[{
     *      name:...
     *      args:["name:string","balance:float","active:bool"]
     *      call:...
     * }]
     * ```
     *
     * NanoSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
	 *
	 * @param {Array<ActionOrView>} viewArray
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public views(viewArray: ActionOrView[]): NanoSQLInstance {
        if (Array.isArray(this.sTable)) return this;
        return this._views[this.sTable] = viewArray, this;
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
    public getView(viewName: string, viewArgs: any = {}): Promise<Array<any> | NanoSQLInstance> {
        if (Array.isArray(this.sTable)) return new Promise((res, rej) => rej());
        return this._doAV("View", this._views[this.sTable], viewName, viewArgs);
    }

    /**
	 * Declare the actions for the current selected table.  Must be called before connect()
     *
     * Actions are created like this:
     * ```ts
     * .actions([
     *  {
     *      name:"action-name",
     *      args: ["array","of","arguments"],
     *      call: function(args) {
     *          // Because of our "args" array the args input of this function will look like this:
     *          // NanoSQL will not let any other arguments into this function.
     *          args:{
     *              array:'',
     *              of:'',
     *              arguments:''
     *          }
     *          //We can use them in our query
     *          return this.query("upsert",{balance:0}).where(['name','IN',args.array]).exec();
     *      }
     *  }
     * ])
     * ```
     *
     * Then later in your app..
     *
     * ```ts
     * NanoSQL("users").doAction("action-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     * ```ts
     * .actions[{
     *      name:...
     *      args:["name:string","balance:float","active:bool"]
     *      call:...
     * }]
     * ```
     *
     * NanoSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
	 *
	 * @param {Array<ActionOrView>} actionArray
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public actions(actionArray: Array<ActionOrView>): NanoSQLInstance {
        if (Array.isArray(this.sTable)) return this;
        return this._actions[this.sTable] = actionArray, this;
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
    public doAction(actionName: string, actionArgs: any): Promise<Array<DBRow> | NanoSQLInstance> {
        if (Array.isArray(this.sTable)) return new Promise((res, rej) => rej());
        return this._doAV("Action", this._actions[this.sTable], actionName, actionArgs);
    }

    /**
     * Adds a query filter to every request.
     *
     * @param {(args: DBExec, complete:(args: DBExec) => void) => void} callBack
     *
     * @memberOf NanoSQLInstance
     */
    public queryFilter(callBack: (args: IdbQuery, complete: (args: IdbQuery) => void) => void): NanoSQLInstance {
        this.queryMod = callBack;
        return this;
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
    private _doAV(AVType: "Action" | "View", AVList: ActionOrView[], AVName: string, AVargs: any): Promise<Array<DBRow> | NanoSQLInstance> {
        let t = this;

        const selAV: ActionOrView | null = AVList.reduce((prev, cur) => {
            if (cur.name === AVName) return cur;
            return prev;
        }, null as any);

        if (!selAV) {
            return new Promise((res, rej) => rej("Action/View Not Found!"));
        }
        t._activeAV = AVName;

        if (t._AVMod) {
            return new Promise((res, rej) => {
                t._AVMod(this.sTable as any, AVType, t._activeAV || "", AVargs, (args) => {
                    selAV.call(selAV.args ? cleanArgs(selAV.args, args) : {}, t).then(res).catch(rej);
                }, (err) => {
                    rej(err);
                });
            });
        } else {
            return selAV.call(selAV.args ? cleanArgs(selAV.args, AVargs) : {}, t);
        }
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
    public query(action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe" | "toColumn" | "toRow", args?: any): _NanoSQLQuery {

        /*let t = this;
        t._queryPtr++;
        if (t._queryPtr > t._queryPool.length - 1) {
            t._queryPtr = 0;
        }
        const av = t._activeAV;
        t._activeAV = undefined;
        return t._queryPool[t._queryPtr].set(t.sTable, action.toLowerCase(), args, av);*/
        let t = this;
        const av = t._activeAV;
        t._activeAV = undefined;
        return new _NanoSQLQuery(this, this.sTable, action, args, av);
    }

    public onConnected(callback: () => void) {
        if (this.isConnected) {
            callback();
        } else {
            this._onConnectedCallBacks.push(callback);
        }
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
     * console.log(NanoSQL("users").default()) <= {username:"none", id:undefined, age: 0}
     * console.log(NanoSQL("users").default({username:"defalt"})) <= {username:"default", id:undefined, age: 0}
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
    public default(replaceObj?: any): { [key: string]: any } {
        let newObj = {};
        let t = this;
        if (Array.isArray(t.sTable)) return {};
        t.dataModels[t.sTable].forEach((m) => {
            // set key to object argument or the default value in the data model
            newObj[m.key] = (replaceObj && replaceObj[m.key]) ? replaceObj[m.key] : m.default;

            // Generate default value from type, eg int = 0, string = ""
            if (newObj[m.key] === undefined) {
                newObj[m.key] = cast(m.type, null);
            }
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
    public rawDump(tables?: string[]) {
        return new Promise((res, rej) => {
            let result = {};
            fastCHAIN(this.plugins, (plugin: NanoSQLPlugin, i, next) => {
                if (plugin.dumpTables) {
                    plugin.dumpTables(tables).then((tables) => {
                        result = {
                            ...result,
                            ...tables
                        };
                        next(result);
                    });
                } else {
                    next();
                }
            }).then(() => {
                res(result);
            });
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
    public rawImport(tables: { [table: string]: DBRow[] }, onProgress?: (percent: number) => void): Promise<any> {
        return new Promise((res, rej) => {
            fastCHAIN(this.plugins, (plugin: NanoSQLPlugin, i, next) => {
                if (plugin.importTables) {
                    plugin.importTables(tables, onProgress || ((c) => { })).then(next);
                } else {
                    next();
                }
            }).then(() => {
                res();
            });
        });
    }

    /**
     * Request disconnect from all databases.
     *
     * @returns
     * @memberof NanoSQLInstance
     */
    public disconnect() {
        return fastCHAIN(this.plugins, (plugin: NanoSQLPlugin, i, next) => {
            if (plugin.willDisconnect) {
                plugin.willDisconnect(next);
            } else {
                next();
            }
        });
    }

    /**
     * Executes a transaction against the database, batching all the queries together.
     *
     * @param {((
     *         db: (table?: string) => {
     *             query: (action: "select"|"upsert"|"delete"|"drop"|"show tables"|"describe", args?: any) => _NanoSQLTransactionQuery;
     *             updateORM: (action: "add"|"delete"|"drop"|"set", column?: string, relationIDs?: any[]) => _NanoSQLTransactionORMQuery|undefined;
     *         }, complete: () => void) => void)} initTransaction
     * @returns {Promise<any>}
     *
     * @memberof NanoSQLInstance
     */
    public doTransaction(initTransaction: (
        db: (table?: string) => {
            query: (action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe", args?: any) => _NanoSQLTransactionQuery;
        }, complete: () => void) => void
    ): Promise<any> {
        let t = this;

        let queries: IdbQuery[] = [];
        let transactionID = random16Bits().toString(16);

        return new Promise((resolve, reject) => {
            if (!t.plugins.length) {
                reject("nSQL: Nothing to do, no plugins!");
                return;
            }

            const run = () => {
                fastCHAIN(t.plugins, (p, i, nextP) => {
                    if (p.transactionBegin) {
                        p.transactionBegin(transactionID, nextP);
                    } else {
                        nextP();
                    }
                }).then(() => {

                    if (Array.isArray(t.sTable)) return;

                    initTransaction(
                        (table?: string) => {
                            let ta: string = table || t.sTable as any;
                            return {
                                query: (action: "select" | "upsert" | "delete" | "drop" | "show tables" | "describe", args?: any) => {
                                    return new _NanoSQLTransactionQuery(action, args, ta, queries, transactionID);
                                }
                            };
                        },
                        () => {

                            let tables: string[] = [];

                            fastCHAIN(queries, (quer, i, nextQuery) => {
                                tables.push(quer.table as any);
                                t.query(quer.action as any, quer.actionArgs).manualExec({
                                    ...quer,
                                    table: quer.table,
                                    transaction: true,
                                    queryID: transactionID,
                                }).then(nextQuery);
                            }).then((results) => {

                                fastCHAIN(this.plugins, (p, i, nextP) => {
                                    if (p.transactionEnd) {
                                        p.transactionEnd(transactionID, nextP);
                                    } else {
                                        nextP();
                                    }
                                }).then(() => {
                                    tables.filter((val, idx, self) => {
                                        return self.indexOf(val) === idx;
                                    }).forEach((table) => {
                                        if (table.indexOf("_") !== 0) {
                                            t.triggerEvent({
                                                query: queries[0],
                                                table: table,
                                                time: new Date().getTime(),
                                                result: results,
                                                types: ["transaction"],
                                                actionOrView: "",
                                                notes: [],
                                                transactionID: transactionID,
                                                affectedRowPKS: [],
                                                affectedRows: []
                                            });
                                        }
                                    });
                                    resolve(results);
                                });
                            });
                        }
                    );
                });
            };

            if (this.isConnected) {
                run();
            } else {
                this.onConnected(run);
            }
        });
    }


    /**
     * Configure the database driver, must be called before the connect() method.
     *
     * @param {any} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public config(args: NanoSQLConfig): NanoSQLInstance {
        this._config = args;
        return this;
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
    public observable<T>(getQuery: (ev?: DatabaseEvent) => IdbQueryExec | undefined, tablesToListen?: string[]): Observer<T> {
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
    public extend(...args: any[]): any | NanoSQLInstance {
        let t = this;

        return new Promise((res, rej) => {

            const run = () => {
                if (t.plugins.length) { // Query Mode
                    let newArgs = args;
                    let result: any[] = [];
                    fastCHAIN(t.plugins, (p, i, nextP) => {
                        if (p.extend) {
                            p.extend((nArgs, newResult) => {
                                newArgs = nArgs;
                                result = newResult;
                                nextP();
                            }, newArgs, result);
                        } else {
                            nextP();
                        }
                    }).then(() => {
                        res(result);
                    });
                } else {
                    rej("No plugins!");
                }
            };

            if (args[0] === "beforeConn") {
                args.shift();
                run();
                return;
            }

            if (this.isConnected) {
                run();
            } else {
                this.onConnected(run);
            }
        });

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
    public loadJS(table: string, rows: Array<any>, useTransaction?: boolean, onProgress?: (percent: number) => void): Promise<Array<any>> {
        let t = this;

        if (useTransaction) {
            return t.doTransaction((db, complete) => {
                rows.forEach((row) => {
                    db(table).query("upsert", row).exec();
                });
                complete();
            });
        } else {
            return new Promise((res, rej) => {
                fastCHAIN(rows, (row, i, nextRow) => {
                    if (onProgress) onProgress(Math.round(((i + 1) / rows.length) * 10000) / 100);
                    this.query("upsert", row).manualExec({ table: table }).then(nextRow);
                }).then((rows) => {
                    res(rows.map(r => r.shift()));
                });
            });
        }
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
                columnHeaders = removeDuplicates(Object.keys(json).concat(columnHeaders));
            });
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
                return typeof row[k] === "object" ? "\"" + JSON.stringify(row[k]).replace(/\"/g, '\'') + "\"" : row[k];
            }).join(","));
        });
        return csv.join("\r\n");
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
                let record: StdObject<any> = {};
                let row = v.match(/(,)|(["|\[|\{].*?["|\]|\}]|[^",\s]+)(?=\s*,|\s*$)/g) || [];

                let fits = false;
                if (row[0] === ",") {
                    row.unshift("");
                }

                while (!fits) {
                    let doBreak = false;
                    row.forEach((val, i) => {
                        if (doBreak) return;
                        if (val === ",") {
                            if (typeof row[i + 1] === "undefined" || row[i + 1] === ",") {
                                doBreak = true;
                                row.splice(i + 1, 0, "");
                            }
                        }
                    });
                    if (!doBreak) {
                        fits = true;
                    } else {
                        break;
                    }
                }

                row = row.filter((v, i) => i % 2 === 0);

                let i = fields.length;
                while (i--) {
                    if (row[i]) {
                        if (row[i] === "true" || row[i] === "false") {
                            record[fields[i]] = row[i] === "true";
                        } else if (row[i].indexOf("{") === 1 || row[i].indexOf("[") === 1) {
                            // tslint:disable-next-line
                            record[fields[i]] = JSON.parse(row[i].slice(1, row[i].length - 1).replace(/'/gm, '\"'));
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
    public loadCSV(table: string, csv: string, useTransaction?: boolean, rowMap?: (row: any) => any, onProgress?: (percent: number) => void): Promise<Array<Object>> {
        let t = this;

        let rowData = this.CSVtoJSON(csv, rowMap);

        if (useTransaction) {
            return t.doTransaction((db, complete) => {
                rowData.forEach((row) => {
                    db(table).query("upsert", row).exec();
                });
                complete();
            });
        } else {
            return new Promise((res, rej) => {
                fastCHAIN(rowData, (row, i, nextRow) => {
                    if (onProgress) onProgress(Math.round(((i + 1) / rowData.length) * 10000) / 100);
                    this.query("upsert", row).manualExec({ table: table }).then(nextRow);
                }).then((rows) => {
                    res(rows.map(r => r.shift()));
                });
            });
        }
    }
}


export interface DBConnect {
    models: StdObject<DataModel[]>;
    actions: StdObject<ActionOrView[]>;
    views: StdObject<ActionOrView[]>;
    config: StdObject<string>;
    parent: NanoSQLInstance;
}
/**
 * The interface for plugins used by NanoSQL
 * Current plugins include History and the default storage system.
 *
 * @export
 * @interface NanoSQLPlugin
 */
export interface NanoSQLPlugin {

    getId?: () => string;

    /**
     * Called before database connection with all the connection arguments, including data models and what not.
     * Lets you adjust the connect arguments, add tables, remove tables, adjust data models, etc.
     *
     * @memberof NanoSQLPlugin
     */
    willConnect?: (connectArgs: DBConnect, next: (connectArgs: DBConnect) => void) => void;

    /**
     * Called after connection, changes to the connectArgs won't have any affect on the database but can still be read.
     *
     * @memberof NanoSQLPlugin
     */
    didConnect?: (connectArgs: DBConnect, next: () => void) => void;

    /**
     *  Called when the user requests the database perform a disconnect action.
     *
     * @memberof NanoSQLPlugin
     */
    willDisconnect?: (next: () => void) => void;

    /**
     * Called when a query is sent through the system, once all plugins are called the query resullt is sent to the user.
     *
     * @memberof NanoSQLPlugin
     */
    doExec?: (execArgs: IdbQuery, next: (execArgs: IdbQuery) => void, error: (err: Error) => void) => void;

    /**
     * Called after the query is done, allows you to modify the event data before the event is emmited
     *
     * @memberof NanoSQLPlugin
     */
    didExec?: (event: DatabaseEvent, next: (event: DatabaseEvent) => void) => void;

    /**
     * Called before a transaction takes place.
     *
     * @memberof NanoSQLPlugin
     */
    transactionBegin?: (id: string, next: () => void) => void;

    /**
     * Called after a transaction completes.
     *
     * @memberof NanoSQLPlugin
     */
    transactionEnd?: (id: string, next: () => void) => void;

    /**
     * Dump the raw contents of all database tables.
     * Optionally provide a list of tables to export, if nothing is provided then all tables should be dumped.
     *
     * @memberof NanoSQLPlugin
     */
    dumpTables?: (tables?: string[]) => Promise<{ [tableName: string]: DBRow[] }>;

    /**
     * Import tables directly into the database without any type checking, indexing or anything else fancy.
     *
     * @memberof NanoSQLPlugin
     */
    importTables?: (tables: { [tableName: string]: DBRow[] }, onProgress: (percent: number) => void) => Promise<any>;

    /**
     * Generic for other misc functions, called when ".extend()" is used.
     *
     * @memberof NanoSQLPlugin
     */
    extend?: (next: (args: any[], result: any[]) => void, args: any[], result: any[]) => void;

}

const wordLevenshtienCache: { [words: string]: number } = {};

NanoSQLInstance.whereFunctions = {
    levenshtein: (row: any, isJoin: boolean, word: string, column: string) => {
        const val = objQuery(column, row, isJoin) || "";
        const key = val + "::" + word;
        if (!wordLevenshtienCache[key]) {
            wordLevenshtienCache[key] = levenshtein(val, word);
        }
        return wordLevenshtienCache[key];
    },
    arrayObjSrch: (row: any, isJoin: boolean, arrayKey: string, objCompare: string, compareKey: string) => {
        const arr: any[] = objQuery(arrayKey, row, isJoin);
        if (!Array.isArray(arr)) return undefined;
        if (!arr.length) return undefined;
        let matchingObj: any;
        let objData: any[] = objCompare.split("=");
        arr.forEach((obj) => {
            let key = objQuery(objData[0], obj);
            key = isNaN(key) ? key : parseFloat(key);
            objData[1] = isNaN(objData[1]) ? objData[1] : parseFloat(objData[1]);
            if (key === objData[1]) {
                matchingObj = obj;
            }
        });
        if (matchingObj === undefined) return undefined;
        return objQuery(compareKey, matchingObj);

    },
    crow: (row: any, isJoin: boolean, lat: number, lon: number, latColumn?: string, lonColumn?: string) => {
        const latCol = latColumn || "lat";
        const lonCol = lonColumn || "lon";
        const latVal = objQuery(latCol, row, isJoin);
        const lonVal = objQuery(lonCol, row, isJoin);
        return crowDistance(latVal, lonVal, lat, lon, NanoSQLInstance.earthRadius);
    },
    sum: (row: any, isJoin: boolean, ...columns: string[]) => {
        return columns.reduce((prev, cur) => {
            const val = objQuery(cur, row, isJoin) || 0;
            if (Array.isArray(val)) {
                return prev + val.reduce((p, c) => p + parseFloat(c || 0), 0);
            }
            return prev + parseFloat(val);
        }, 0);
    },
    avg: (row: any, isJoin: boolean, ...columns: string[]) => {
        let numRecords = 0;
        const total = columns.reduce((prev, cur) => {
            const val = objQuery(cur, row, isJoin) || 0;
            if (Array.isArray(val)) {
                numRecords += val.length;
                return prev + val.reduce((p, c) => p + parseFloat(c || 0), 0);
            }
            numRecords++;
            return prev + parseFloat(val);
        }, 0);
        return total / numRecords;
    }
};

NanoSQLInstance.functions = {
    COUNT: {
        type: "A",
        call: (rows, complete, isJoin, column) => {
            if (column && column !== "*") {
                complete(rows.filter(r => objQuery(column, r, isJoin)).length);
            } else {
                complete(rows.length);
            }
        }
    },
    MAX: {
        type: "A",
        call: (rows, complete, isJoin, column) => {
            if (rows.length) {
                let max = objQuery(column, rows[0]) || 0;
                rows.forEach(r => {
                    const v = objQuery(column, r, isJoin);
                    if (objQuery(column, r) > max) {
                        max = objQuery(column, r, isJoin);
                    }
                });
                complete(max);
            } else {
                complete(0);
            }
        }
    },
    MIN: {
        type: "A",
        call: (rows, complete, isJoin, column) => {
            if (rows.length) {
                let min = objQuery(column, rows[0], isJoin) || 0;
                rows.forEach(r => {
                    const v = objQuery(column, r, isJoin);
                    if (v < min) {
                        min = v;
                    }
                });
                complete(min);
            } else {
                complete(0);
            }
        }
    },
    AVG: {
        type: "A",
        call: (rows, complete, isJoin, column) => {
            complete(rows.reduce((prev, cur) => prev + (objQuery(column, cur, isJoin) || 0), 0) / rows.length);
        }
    },
    SUM: {
        type: "A",
        call: (rows, complete, isJoin, column) => {
            complete(rows.reduce((prev, cur) => prev + (objQuery(column, cur, isJoin) || 0), 0));
        }
    },
    LOWER: {
        type: "S",
        call: (rows, complete, isJoin, column) => {
            complete(rows.map((r) => {
                return String(objQuery(column, r, isJoin)).toLowerCase();
            }));
        }
    },
    UPPER: {
        type: "S",
        call: (rows, complete, isJoin, column) => {
            complete(rows.map((r) => {
                return String(objQuery(column, r, isJoin)).toUpperCase();
            }));
        }
    },
    CAST: {
        type: "S",
        call: (rows, complete, isJoin, column, type) => {
            complete(rows.map((r) => {
                return cast(type, objQuery(column, r, isJoin));
            }));
        }
    },
    ABS: {
        type: "S",
        call: (rows, complete, isJoin, column) => {
            complete(rows.map((r) => {
                return Math.abs(objQuery(column, r, isJoin));
            }));
        }
    },
    CEIL: {
        type: "S",
        call: (rows, complete, isJoin, column) => {
            complete(rows.map((r) => {
                return Math.ceil(objQuery(column, r, isJoin));
            }));
        }
    },
    POW: {
        type: "S",
        call: (rows, complete, isJoin, column, power) => {
            complete(rows.map((r) => {
                return Math.pow(objQuery(column, r, isJoin), parseInt(power));
            }));
        }
    },
    ROUND: {
        type: "S",
        call: (rows, complete, isJoin, column) => {
            complete(rows.map((r) => {
                return Math.round(objQuery(column, r, isJoin));
            }));
        }
    },
    SQRT: {
        type: "S",
        call: (rows, complete, isJoin, column) => {
            complete(rows.map((r) => {
                return Math.sqrt(objQuery(column, r, isJoin));
            }));
        }
    }
};

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