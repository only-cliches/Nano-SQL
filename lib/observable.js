Object.defineProperty(exports, "__esModule", { value: true });
var utilities_1 = require("./utilities");
var lie_ts_1 = require("lie-ts");
var Observer = /** @class */ (function () {
    function Observer(_nSQL, _query, _tables) {
        this._nSQL = _nSQL;
        this._query = _query;
        this._tables = _tables;
        this._order = [];
        this._count = 0;
        this._config = [];
    }
    /**
     * Debounce responses
     *
     * @param {number} ms
     * @returns
     * @memberof Observer
     */
    Observer.prototype.debounce = function (ms) {
        this._config[this._order.length] = ms;
        this._order.push("dbnc");
        return this;
    };
    /**
     * Suppress identical results
     *
     * @returns
     * @memberof Observer
     */
    Observer.prototype.distinct = function (keyFunc, compareFunc) {
        this._config[this._order.length] = [
            keyFunc || (function (obj) { return obj; }),
            compareFunc || (function (k1, k2) { return k1 === k2; })
        ];
        this._order.push("dsct");
        return this;
    };
    /**
     * Filter results based on specific conditions
     *
     * @param {(obj: any) => boolean} fn
     * @returns
     * @memberof Observer
     */
    Observer.prototype.filter = function (fn) {
        this._config[this._order.length] = fn;
        this._order.push("fltr");
        return this;
    };
    /**
     * Mutate results from observable
     *
     * @param {(obj: any) => any} fn
     * @returns
     * @memberof Observer
     */
    Observer.prototype.map = function (fn) {
        this._config[this._order.length] = fn;
        this._order.push("mp");
        return this;
    };
    /**
     * Emit only the first result OR emit the first result that meets a condition passed into the fn.
     *
     * @param {((obj?: any) => boolean|void)} fn
     * @returns
     * @memberof Observer
     */
    Observer.prototype.first = function (fn) {
        this._config[this._order.length] = fn || (function (obj, idx) { return true; });
        this._order.push("fst");
        return this;
    };
    /**
     * Skip the first n events.
     *
     * @param {number} num
     * @returns
     * @memberof Observer
     */
    Observer.prototype.skip = function (num) {
        this._config[this._order.length] = num;
        this._order.push("skp");
        return this;
    };
    /**
     * Only get the first n events.
     *
     * @param {number} num
     * @memberof Observer
     */
    Observer.prototype.take = function (num) {
        this._config[this._order.length] = num;
        this._order.push("tk");
        return this;
    };
    /**
     * Subscribe to the observer
     *
     * @param {((value: T, event?: DatabaseEvent) => void | {
     *         next: (value: T, event?: DatabaseEvent) => void;
     *         error?: (error: any) => void;
     *         complete?: (value?: T, event?: DatabaseEvent) => void;
     *     })} callback
     * @returns
     * @memberof Observer
     */
    Observer.prototype.subscribe = function (callback) {
        var _this = this;
        var prevValue = {};
        var lastRan = {};
        var lastFunc = {};
        var complete;
        var lastCount = {};
        return new ObserverSubscriber(this._nSQL, this._query, {
            next: function (rows, event) {
                _this._count++;
                if (complete)
                    return;
                var step = 0;
                var loop = function () {
                    if (step === _this._order.length) {
                        if (typeof callback === "function") {
                            callback(rows, event);
                        }
                        else if (callback.next) {
                            callback.next(rows, event);
                        }
                        if (complete && callback.complete) {
                            callback.complete(rows, event);
                        }
                    }
                    else {
                        var getCount = function (step) {
                            if (_this._count === 0)
                                return 0;
                            var i = step;
                            var count = _this._count;
                            var found = false;
                            while (i-- && !found) {
                                if (lastCount[i] !== undefined) {
                                    found = true;
                                    count = lastCount[i];
                                }
                            }
                            return count;
                        };
                        switch (_this._order[step]) {
                            case "dbnc":
                                if (!lastRan[step]) {
                                    lastRan[step] = Date.now();
                                }
                                else {
                                    clearTimeout(lastFunc[step]);
                                    var debnc_1 = _this._config[step];
                                    lastFunc[step] = setTimeout(function () {
                                        if ((Date.now() - lastRan[step]) >= debnc_1) {
                                            lastRan[step] = Date.now();
                                            if (lastCount[step] === undefined) {
                                                lastCount[step] = 0;
                                            }
                                            lastCount[step]++;
                                            step++;
                                            loop();
                                        }
                                    }, debnc_1 - (Date.now() - lastRan[step]));
                                    return;
                                }
                                break;
                            case "dsct":
                                var key = _this._config[step][0](rows, event);
                                if (_this._config[step][1](prevValue[step], key) === false) {
                                    prevValue[step] = key;
                                    if (lastCount[step] === undefined) {
                                        lastCount[step] = 0;
                                    }
                                    lastCount[step]++;
                                }
                                else {
                                    return;
                                }
                                break;
                            case "fltr":
                                if (_this._config[step](rows, getCount(step), event) === false) {
                                    return;
                                }
                                else {
                                    if (lastCount[step] === undefined) {
                                        lastCount[step] = 0;
                                    }
                                    lastCount[step]++;
                                }
                                break;
                            case "fst":
                                if (_this._config[step](rows, getCount(step), event) === true) {
                                    if (lastCount[step] === undefined) {
                                        lastCount[step] = 0;
                                    }
                                    lastCount[step]++;
                                    complete = true;
                                }
                                else {
                                    return;
                                }
                                break;
                            case "mp":
                                rows = _this._config[step](rows, getCount(step), event);
                                break;
                            case "skp":
                                if (getCount(step) <= _this._config[step]) {
                                    return;
                                }
                                break;
                            case "tk":
                                if (getCount(step) >= _this._config[step]) {
                                    complete = true;
                                }
                                break;
                        }
                        step++;
                        loop();
                    }
                };
                loop();
            },
            error: function (err) {
                if (callback.error) {
                    callback.error(err);
                }
            }
        }, this._tables);
    };
    return Observer;
}());
exports.Observer = Observer;
var ObserverSubscriber = /** @class */ (function () {
    function ObserverSubscriber(_nSQL, _getQuery, _callback, _tables) {
        var _this = this;
        this._nSQL = _nSQL;
        this._getQuery = _getQuery;
        this._callback = _callback;
        this._tables = _tables;
        this._closed = false;
        this.exec = this.exec.bind(this);
        this.unsubscribe = this.unsubscribe.bind(this);
        var q = this._getQuery();
        if (q) {
            this._tables = utilities_1.removeDuplicates(this._tables.concat([q.table]));
            this.exec();
        }
        this._tables.forEach(function (table) {
            _this._nSQL.table(table).on("change", _this.exec);
        });
    }
    ObserverSubscriber.prototype.exec = function (event) {
        var _this = this;
        lie_ts_1.setFast(function () {
            var q = _this._getQuery(event);
            if (!q)
                return;
            _this._nSQL.query("select").manualExec(q).then(function (rows) {
                _this._callback.next(rows, event);
            }).catch(function (err) {
                _this._callback.error(err);
            });
        });
    };
    ObserverSubscriber.prototype.unsubscribe = function () {
        var _this = this;
        this._tables.forEach(function (table) {
            _this._nSQL.table(table).off("change", _this.exec);
        });
        this._closed = true;
    };
    ObserverSubscriber.prototype.closed = function () {
        return this._closed;
    };
    return ObserverSubscriber;
}());
exports.ObserverSubscriber = ObserverSubscriber;
//# sourceMappingURL=observable.js.map