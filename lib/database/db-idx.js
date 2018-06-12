Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("../utilities");
/**
 * Optimized in memory index used for each table.
 * Even if you're not using auto incriment, the index will gaurantee to maintain a sorted order of keys.
 * Exchanges a reduced write performance for increased read performance.
 *
 * @export
 * @class DatabaseIndex
 */
var DatabaseIndex = /** @class */ (function () {
    function DatabaseIndex() {
        this._sorted = [];
        this._exists = {};
        this.ai = 1;
        this.sortIndex = true;
        this.doAI = false;
    }
    DatabaseIndex.prototype.clone = function (skipEvent) {
        if (this._changeCB && !skipEvent)
            this._changeCB(this._ta, "drop", null);
        var idx = new DatabaseIndex();
        idx.doAI = this.doAI;
        idx.ai = this.ai;
        idx.sortIndex = this.sortIndex;
        idx._changeCB = this._changeCB;
        idx._ta = this._ta;
        idx.pkType = this.pkType;
        if (skipEvent) {
            this.set([]);
        }
        return idx;
    };
    DatabaseIndex.prototype.onChange = function (table, cb) {
        this._ta = table;
        this._changeCB = cb;
    };
    DatabaseIndex.prototype.set = function (index) {
        var _this = this;
        this._sorted = index || [];
        this._exists = {};
        this._sorted.forEach(function (s, i) {
            _this._exists[String(s)] = true;
        });
        if (this.doAI && this._sorted.length) {
            this.ai = this._sorted[this._sorted.length - 1] + 1;
        }
    };
    DatabaseIndex.prototype.getLocation = function (key, startIdx) {
        var idx = this.indexOf(key);
        if (idx !== -1) {
            return idx;
        }
        if (this.sortIndex) {
            return utilities_1.binarySearch(this._sorted, key, startIdx);
        }
        else {
            return utilities_1.binarySearch(this._sorted.sort(function (a, b) { return a > b ? 1 : -1; }), key, startIdx);
        }
    };
    DatabaseIndex.prototype.add = function (key, skipEvent) {
        if (this._exists[String(key)])
            return;
        if (this._changeCB && !skipEvent)
            this._changeCB(this._ta, "add", key);
        this._exists[String(key)] = true;
        if (skipEvent && ["number", "int", "float"].indexOf(this.pkType) !== -1) {
            key = parseFloat(key);
        }
        if (!this.doAI) {
            if (this.sortIndex) {
                var idx = utilities_1.binarySearch(this._sorted, key);
                this._sorted.splice(idx, 0, key);
            }
            else {
                this._sorted.push(key);
            }
        }
        else {
            this.ai++;
            this._sorted.push(key);
        }
    };
    DatabaseIndex.prototype.keys = function () {
        return this._sorted;
    };
    DatabaseIndex.prototype.exists = function (key) {
        return this._exists[String(key)] ? true : false;
    };
    DatabaseIndex.prototype.indexOf = function (key) {
        if (!this._exists[String(key)])
            return -1;
        return this.sortIndex ? utilities_1.binarySearch(this._sorted, key) : this._sorted.indexOf(key);
    };
    DatabaseIndex.prototype.remove = function (key, skipEvent) {
        if (this._changeCB && !skipEvent)
            this._changeCB(this._ta, "rm", key);
        if (skipEvent && ["number", "int", "float"].indexOf(this.pkType) !== -1) {
            key = parseFloat(key);
        }
        if (this._exists[String(key)]) {
            var idx = this.indexOf(key);
            this._exists[String(key)] = false;
            this._sorted.splice(idx, 1);
        }
    };
    return DatabaseIndex;
}());
exports.DatabaseIndex = DatabaseIndex;
exports.syncPeerIndex = function (nSQL, idx) {
    if (nSQL.peerMode) {
        Object.keys(idx).forEach(function (table) {
            idx[table].onChange(table, function (table, type, data) {
                nSQL.peers.filter(function (p) { return p !== nSQL.pid; }).forEach(function (peer) {
                    localStorage.setItem(peer + "::" + utilities_1.random16Bits().toString(16), type + "," + table + "," + (data || ""));
                });
            });
        });
        window.addEventListener("storage", function (e) {
            if (e.key && e.key.indexOf(nSQL.pid + "::") !== -1) {
                var data = (e.newValue || "").split(",");
                localStorage.removeItem(e.key);
                switch (data[0]) {
                    case "rm":
                        idx[data[1]].remove(data[2], true);
                        break;
                    case "add":
                        idx[data[1]].add(data[2], true);
                        break;
                    case "drop":
                        idx[data[1]].clone(true);
                        break;
                }
            }
        });
    }
};
//# sourceMappingURL=db-idx.js.map