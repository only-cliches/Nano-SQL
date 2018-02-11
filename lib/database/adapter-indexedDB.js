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
var utilities_1 = require("../utilities");
var db_idx_1 = require("./db-idx");
var _evalContext = function (source, context) {
    var compiled = eval("(function(" + Object.keys(context).join(", ") + ") {" + source + "})");
    return compiled.apply(context, Object.keys(context).map(function (c) { return context[c]; }));
};
/**
 * Handles IndexedDB with and without web workers.
 * Uses blob worker OR eval()s the worker and uses it inline.
 *
 * @export
 * @class _IndexedDBStore
 * @implements {NanoSQLStorageAdapter}
 */
// tslint:disable-next-line
var _IndexedDBStore = /** @class */ (function () {
    function _IndexedDBStore(useWorker) {
        this._worker = 'function e(e){this.go=function(n){var t=0;e&&e.length||n([]),e.forEach(function(o,r){o(function(){++t===e.length&&n([])})})}}var n={db:null,store:function(e,t,o){var r=n.db.transaction(e,t);o(r,r.objectStore(e),function(e,n){return function(){postMessage({do:e,args:n})}})},init:function(){addEventListener("message",function(e){var t=e.data;n[t.do]&&n[t.do](t.args)},!1)},setup:function(t){var o=indexedDB.open(t.id,1),r=!1,a={};o.onupgradeneeded=function(e){r=!0,n.db=e.target.result,Object.keys(t.pkKeys).forEach(function(e){n.db.createObjectStore(e,{keyPath:t.pkKeys[e]}),a[e]=[]})},o.onsuccess=function(o){if(n.db=o.target.result,r)postMessage({do:"rdy",args:a});else{var s=function(e,t){var o=[];n.store(e,"readonly",function(e,n,r){n.openCursor().onsuccess=function(e){var n=e.target.result;n&&(o.push(n.key),n.continue())},e.oncomplete=function(){t(o)}})};new e(Object.keys(t.pkKeys).map(function(e){return function(n){s(e,function(t){a[e]=t,n()})}})).go(function(){postMessage({do:"rdy",args:a})})}}},write:function(e){n.store(e.table,"readwrite",function(n,t,o){t.put(e.row),n.oncomplete=o("write_"+e.id,null)})},read:function(e){n.store(e.table,"readonly",function(n,t,o){var r=t.get(e.pk);r.onsuccess=function(){postMessage({do:"read_"+e.id,args:r.result})}})},readRange:function(e){n.store(e.table,"readonly",function(n,t,o){var r=[],a=-1===e.range.indexOf(void 0)?t.openCursor(IDBKeyRange.bound(e.range[0],e.range[1])):t.openCursor();n.oncomplete=o("readRange_"+e.id+"_done",r),a.onsuccess=function(e){var n=e.target.result;n&&(r.push(n.value),n.continue())}})},delete:function(e){n.store(e.table,"readwrite",function(n,t,o){n.oncomplete=o("delete_"+e.id,!0),n.onerror=o("delete_"+e.id,!1),"_clear_"===e.pk?t.clear():t.delete(e.pk)})}};n.init();';
        this._pkKey = {};
        this._pkType = {};
        this._dbIndex = {};
        this._waitingCBs = {};
        this._useWorker = useWorker;
    }
    _IndexedDBStore.prototype.connect = function (complete) {
        var _this = this;
        if (this._useWorker) {
            // blob webworker, doesn't use an external file!
            // not supported by IE and Edge with IndexedDB, like at all.
            this._w = new Worker(window.URL.createObjectURL(new Blob([this._worker])));
            this._w.addEventListener("message", function (e) {
                _this._handleWWMessage(e.data.do, e.data.args);
            });
        }
        else {
            // eval the worker, the end result being a ui thread indexed db instance.
            // this is mostly to get IndexedDB support in IE and Edge without duplicating the indexed db code
            var listeners_1 = [];
            // emulate worker behavior
            _evalContext(this._worker, {
                postMessage: function (msg) {
                    _this._handleWWMessage(msg.do, msg.args);
                },
                addEventListener: function (type, listener) {
                    listeners_1.push(listener);
                }
            });
            // emulate worker object
            this._w = {
                addEventListener: null,
                postMessage: function (message, transfer) {
                    listeners_1.forEach(function (l) {
                        l({ data: message });
                    });
                }
            };
        }
        // returns indexes for each table
        this._waitingCBs["rdy"] = function (args) {
            Object.keys(args).forEach(function (table) {
                _this._dbIndex[table].set(args[table]);
            });
            complete();
        };
        this._w.postMessage({
            do: "setup", args: {
                pkKeys: this._pkKey,
                id: this._id
            }
        });
    };
    _IndexedDBStore.prototype.setID = function (id) {
        this._id = id;
    };
    _IndexedDBStore.prototype._handleWWMessage = function (action, args) {
        if (this._waitingCBs[action]) {
            this._waitingCBs[action](args);
            delete this._waitingCBs[action];
        }
    };
    _IndexedDBStore.prototype.makeTable = function (tableName, dataModels) {
        var _this = this;
        this._dbIndex[tableName] = new db_idx_1.DatabaseIndex();
        dataModels.forEach(function (d) {
            if (d.props && d.props.indexOf("pk") > -1) {
                _this._pkType[tableName] = d.type;
                _this._pkKey[tableName] = d.key;
                if (d.props && d.props.indexOf("ai") > -1 && (d.type === "int" || d.type === "number")) {
                    _this._dbIndex[tableName].doAI = true;
                }
            }
        });
    };
    _IndexedDBStore.prototype.write = function (table, pk, data, complete) {
        pk = pk || utilities_1.generateID(this._pkType[table], this._dbIndex[table].ai);
        if (!pk) {
            throw new Error("Can't add a row without a primary key!");
        }
        if (this._dbIndex[table].indexOf(pk) === -1) {
            this._dbIndex[table].add(pk);
        }
        var queryID = utilities_1.uuid();
        var r = __assign({}, data, (_a = {}, _a[this._pkKey[table]] = pk, _a));
        this._waitingCBs["write_" + queryID] = function (args) {
            complete(r);
        };
        this._w.postMessage({
            do: "write",
            args: {
                table: table,
                id: queryID,
                row: r
            }
        });
        var _a;
    };
    _IndexedDBStore.prototype.delete = function (table, pk, complete) {
        var idx = this._dbIndex[table].indexOf(pk);
        if (idx !== -1) {
            this._dbIndex[table].remove(pk);
        }
        var queryID = utilities_1.uuid();
        this._waitingCBs["delete_" + queryID] = function (args) {
            complete();
        };
        this._w.postMessage({
            do: "delete", args: {
                table: table,
                id: queryID,
                pk: pk
            }
        });
    };
    _IndexedDBStore.prototype.read = function (table, pk, callback) {
        var queryID = utilities_1.uuid();
        if (this._dbIndex[table].indexOf(pk) === -1) {
            callback(null);
            return;
        }
        this._waitingCBs["read_" + queryID] = function (args) {
            callback(args);
        };
        this._w.postMessage({
            do: "read", args: {
                table: table,
                id: queryID,
                pk: pk
            }
        });
    };
    _IndexedDBStore.prototype.rangeRead = function (table, rowCallback, complete, from, to, usePK) {
        var _this = this;
        var keys = this._dbIndex[table].keys();
        var usefulValues = [typeof from, typeof to].indexOf("undefined") === -1;
        var ranges = usefulValues ? [from, to] : [0, keys.length - 1];
        if (!keys.length) {
            complete();
            return;
        }
        var queryID = utilities_1.uuid();
        var rows = [];
        var idx = ranges[0];
        var i = 0;
        this._waitingCBs["readRange_" + queryID + "_done"] = function (args) {
            delete _this._waitingCBs["readRange_" + queryID];
            rows = args;
            var getRow = function () {
                if (idx <= ranges[1]) {
                    rowCallback(rows[i], idx, function () {
                        idx++;
                        i++;
                        i > 1000 ? lie_ts_1.setFast(getRow) : getRow(); // handle maximum call stack error
                    });
                }
                else {
                    complete();
                }
            };
            getRow();
        };
        /*const getNextRows = () => {
            this._waitingCBs["readRange_" + queryID] = (args: DBRow[]) => {
                rows = rows.concat(args);
                getNextRows();
            };
        };
        getNextRows();*/
        this._w.postMessage({
            do: "readRange",
            args: {
                table: table,
                id: queryID,
                range: usePK && usefulValues ? ranges : ranges.map(function (r) { return keys[r]; })
            }
        });
    };
    _IndexedDBStore.prototype.drop = function (table, callback) {
        var idx = new db_idx_1.DatabaseIndex();
        idx.doAI = this._dbIndex[table].doAI;
        this._dbIndex[table] = idx;
        var queryID = utilities_1.uuid();
        this._waitingCBs["delete_" + queryID] = function (args) {
            callback();
        };
        this._w.postMessage({
            do: "delete", args: {
                table: table,
                id: queryID,
                pk: "_clear_"
            }
        });
    };
    _IndexedDBStore.prototype.getIndex = function (table, getLength, complete) {
        complete(getLength ? this._dbIndex[table].keys().length : this._dbIndex[table].keys());
    };
    _IndexedDBStore.prototype.destroy = function (complete) {
        var _this = this;
        utilities_1.fastALL(Object.keys(this._dbIndex), function (table, i, done) {
            _this.drop(table, done);
        }).then(complete);
    };
    return _IndexedDBStore;
}());
exports._IndexedDBStore = _IndexedDBStore;
