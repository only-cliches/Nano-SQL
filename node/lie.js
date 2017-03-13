"use strict";
var _INTERNAL = function () { };
var _isNode = typeof window === "undefined";
var _UNHANDLED = ['UNHANDLED'];
var _REJECTED = ['REJECTED'];
var _FULFILLED = ['FULFILLED'];
var _PENDING = ['PENDING'];
var Promise = (function () {
    function Promise(resolver) {
        this._state = _PENDING;
        this._queue = [];
        this._outcome = void 0;
        if (_isNode) {
            this._handled = _UNHANDLED;
        }
        if (resolver !== _INTERNAL) {
            _safelyResolveThenable(this, resolver);
        }
    }
    Promise.prototype.catch = function (onRejected) {
        return this.then(function () { }, onRejected);
    };
    Promise.prototype.then = function (onFulfilled, onRejected) {
        if (typeof onFulfilled !== 'function' && this._state === _FULFILLED ||
            typeof onRejected !== 'function' && this._state === _REJECTED) {
            return this;
        }
        var promise = new Promise(_INTERNAL);
        if (_isNode) {
            if (this._handled === _UNHANDLED) {
                this._handled = null;
            }
        }
        if (this._state !== _PENDING) {
            var resolver = this._state === _FULFILLED ? onFulfilled : onRejected;
            _unwrap(promise, resolver, this._outcome);
        }
        else {
            this._queue.push(new _QueueItem(promise, onFulfilled, onRejected));
        }
        return promise;
    };
    Promise.resolve = function (value) {
        if (value instanceof this) {
            return value;
        }
        return _handlers.resolve(new Promise(_INTERNAL), value);
    };
    Promise.reject = function (reason) {
        return _handlers.reject(new Promise(_INTERNAL), reason);
    };
    Promise.all = function (iterable) {
        var self = this;
        var len = iterable.length;
        var called = false;
        var values = new Array(len);
        var resolved = 0;
        var i = -1;
        var promise = new Promise(_INTERNAL);
        if (!len) {
            return this.resolve([]);
        }
        while (++i < len) {
            allResolver(iterable[i], i);
        }
        return promise;
        function allResolver(value, i) {
            self.resolve(value).then(resolveFromAll, function (error) {
                if (!called) {
                    called = true;
                    _handlers.reject(promise, error);
                }
            });
            function resolveFromAll(outValue) {
                values[i] = outValue;
                if (++resolved === len && !called) {
                    called = true;
                    _handlers.resolve(promise, values);
                }
            }
        }
    };
    Promise.race = function (iterable) {
        var self = this;
        var len = iterable.length;
        var called = false;
        var i = -1;
        var promise = new Promise(_INTERNAL);
        if (Array.isArray(iterable) !== false) {
            return this.reject(new TypeError());
        }
        function resolver(value) {
            self.resolve(value).then(function (response) {
                if (!called) {
                    called = true;
                    _handlers.resolve(promise, response);
                }
            }, function (error) {
                if (!called) {
                    called = true;
                    _handlers.reject(promise, error);
                }
            });
        }
        if (!len) {
            return this.resolve([]);
        }
        while (++i < len) {
            resolver(iterable[i]);
        }
        return promise;
    };
    return Promise;
}());
exports.Promise = Promise;
var _QueueItem = (function () {
    function _QueueItem(promise, onFulfilled, onRejected) {
        this._promise = promise;
        if (typeof onFulfilled === 'function') {
            this._onFulfilled = onFulfilled;
            this._callFulfilled = this._otherCallFulfilled;
        }
        if (typeof onRejected === 'function') {
            this._onRejected = onRejected;
            this._callRejected = this._otherCallRejected;
        }
    }
    _QueueItem.prototype._callFulfilled = function (value) {
        _handlers.resolve(this._promise, value);
    };
    ;
    _QueueItem.prototype._otherCallFulfilled = function (value) {
        _unwrap(this._promise, this._onFulfilled, value);
    };
    ;
    _QueueItem.prototype._callRejected = function (value) {
        _handlers.reject(this._promise, value);
    };
    ;
    _QueueItem.prototype._otherCallRejected = function (value) {
        _unwrap(this._promise, this._onRejected, value);
    };
    ;
    return _QueueItem;
}());
exports._QueueItem = _QueueItem;
function _unwrap(promise, func, value) {
    setTimeout(function () {
        var returnValue;
        try {
            returnValue = func.apply(null, value);
        }
        catch (e) {
            return _handlers.reject(promise, e);
        }
        if (returnValue === promise) {
            _handlers.reject(promise, new TypeError());
        }
        else {
            _handlers.resolve(promise, returnValue);
        }
        return null;
    });
}
var _handlers = (function () {
    function _handlers() {
    }
    _handlers.resolve = function (self, value) {
        var result = _tryCatch(_getThen, value);
        var thenable = result._value;
        var i = -1;
        var len = self._queue.length;
        if (result._status === 'error') {
            return _handlers.reject(self, result._value);
        }
        if (thenable) {
            _safelyResolveThenable(self, thenable);
        }
        else {
            self._state = _FULFILLED;
            self._outcome = value;
            while (++i < len) {
                self._queue[i]._callFulfilled(value);
            }
        }
        return self;
    };
    ;
    _handlers.reject = function (self, error) {
        self._state = _REJECTED;
        self._outcome = error;
        if (_isNode && self._handled === _UNHANDLED) {
            setTimeout(function () {
                if (self._handled === _UNHANDLED) {
                    process.emit('unhandledRejection', error, self);
                }
            }, 0);
        }
        var i = -1;
        var len = self._queue.length;
        while (++i < len) {
            self._queue[i]._callRejected(error);
        }
        return self;
    };
    ;
    return _handlers;
}());
function _getThen(obj) {
    // Make sure we only access the accessor once as required by the spec
    var then = obj && obj.then;
    if (obj && (typeof obj === 'object' || typeof obj === 'function') && typeof then === 'function') {
        return function appyThen() {
            then.apply(obj, arguments);
        };
    }
    else {
        return null;
    }
}
function _safelyResolveThenable(self, thenable) {
    // Either fulfill, reject or reject with error
    var called = false;
    function onError() {
        var value = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            value[_i] = arguments[_i];
        }
        if (called) {
            return;
        }
        called = true;
        _handlers.reject(self, value);
    }
    function onSuccess() {
        var value = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            value[_i] = arguments[_i];
        }
        if (called) {
            return;
        }
        called = true;
        _handlers.resolve(self, value);
    }
    function tryToUnwrap() {
        thenable(onSuccess, onError);
    }
    var result = _tryCatch(tryToUnwrap);
    if (result._status === 'error') {
        onError(result._value);
    }
}
function _tryCatch(func, values) {
    var out = { _status: null, _value: null };
    try {
        out._value = func(values);
        out._status = 'success';
    }
    catch (e) {
        out._status = 'error';
        out._value = e;
    }
    return out;
}
