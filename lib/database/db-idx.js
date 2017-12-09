Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("../utilities");
var DatabaseIndex = (function () {
    function DatabaseIndex() {
        this._sorted = [];
        this._indexOf = {};
        this.ai = 1;
        this.doAI = false;
    }
    DatabaseIndex.prototype.set = function (index) {
        var _this = this;
        this._sorted = index || [];
        this._indexOf = {};
        this._sorted.forEach(function (s, i) {
            _this._indexOf[String(s)] = i;
        });
        if (this.doAI && this._sorted.length) {
            var l = this._sorted.length;
            this.ai = this._sorted[l - 1] + 1;
        }
    };
    DatabaseIndex.prototype.getLocation = function (key) {
        var idx = this.indexOf(key);
        if (idx !== -1) {
            return idx;
        }
        return utilities_1.binarySearch(this._sorted, key);
    };
    DatabaseIndex.prototype.add = function (key) {
        if (!this.doAI) {
            var idx = utilities_1.binarySearch(this._sorted, key);
            this._sorted.splice(idx, 0, key);
            this._indexOf[String(key)] = idx;
            for (var i = idx + 1; i < this._sorted.length; i++) {
                this._indexOf[String(this._sorted[i])]++;
            }
        }
        else {
            if (parseInt(key) >= this.ai) {
                this.ai++;
            }
            this._indexOf[String(key)] = this._sorted.length;
            this._sorted.push(key);
        }
    };
    DatabaseIndex.prototype.keys = function () {
        return this._sorted;
    };
    DatabaseIndex.prototype.indexOf = function (key) {
        return this._indexOf[String(key)] !== undefined ? this._indexOf[String(key)] : -1;
    };
    DatabaseIndex.prototype.remove = function (key) {
        var idx = this._indexOf[String(key)];
        if (idx !== undefined) {
            delete this._indexOf[String(key)];
            this._sorted.splice(idx, 1);
            for (var i = idx; i < this._sorted.length; i++) {
                this._indexOf[String(this._sorted[i])]--;
            }
        }
    };
    return DatabaseIndex;
}());
exports.DatabaseIndex = DatabaseIndex;
