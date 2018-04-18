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
        this.doAI = false;
    }
    DatabaseIndex.prototype.set = function (index) {
        var _this = this;
        this._sorted = index || [];
        this._exists = {};
        this._sorted.forEach(function (s, i) {
            _this._exists[String(s)] = true;
        });
        if (this.doAI && this._sorted.length) {
            var l = this._sorted.length;
            this.ai = this._sorted[l - 1] + 1;
        }
    };
    DatabaseIndex.prototype.getLocation = function (key, startIdx) {
        var idx = this.indexOf(key);
        if (idx !== -1) {
            return idx;
        }
        return utilities_1.binarySearch(this._sorted, key, startIdx);
    };
    DatabaseIndex.prototype.add = function (key) {
        if (this._exists[key])
            return;
        this._exists[String(key)] = true;
        if (!this.doAI) {
            var idx = utilities_1.binarySearch(this._sorted, key);
            this._sorted.splice(idx, 0, key);
        }
        else {
            if (parseInt(key) >= this.ai) {
                this.ai++;
            }
            this._sorted.push(key);
        }
    };
    DatabaseIndex.prototype.keys = function () {
        return this._sorted;
    };
    DatabaseIndex.prototype.indexOf = function (key) {
        return this._exists[String(key)] ? utilities_1.binarySearch(this._sorted, key) : -1;
    };
    DatabaseIndex.prototype.remove = function (key) {
        if (this._exists[String(key)]) {
            this._exists[String(key)] = false;
            var idx = utilities_1.binarySearch(this._sorted, key);
            this._sorted.splice(idx, 1);
        }
    };
    return DatabaseIndex;
}());
exports.DatabaseIndex = DatabaseIndex;
