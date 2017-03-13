const _INTERNAL = () => { }
const _isNode = typeof window === "undefined";
const _UNHANDLED = ['UNHANDLED'];
const _REJECTED = ['REJECTED'];
const _FULFILLED = ['FULFILLED'];
const _PENDING = ['PENDING'];

export class Promise<T> {

    public _state: string[];
    public _queue: _QueueItem[];
    public _outcome: any;
    public _handled: string[] | null;

    constructor(resolver: (onSuccess:(...T) => void, onFail:(...T) => void) => void) {
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

    public catch(onRejected) {
        return this.then(() => {}, onRejected);
    }

    public then(onFulfilled?:(...args) => void, onRejected?:(...args) => void) {
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
        } else {
            this._queue.push(new _QueueItem(promise, onFulfilled, onRejected));
        }

        return promise;
    }


    public static resolve(value) {
        if (value instanceof this) {
            return value;
        }
        return _handlers.resolve(new Promise(_INTERNAL), value);
    }

    public static reject(reason) {
        return _handlers.reject(new Promise(_INTERNAL), reason);
    }

    public static all(iterable): Promise<any> {
        let self = this;
        let len = iterable.length;
        let called = false;
        let values = new Array(len);
        let resolved = 0;
        let i = -1;
        let promise = new Promise(_INTERNAL);

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
    }

    public static race(iterable) {
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
    }
}

export class _QueueItem {

    private _promise: Promise<any>;
    public _onFulfilled: any;
    public _onRejected: any;

    constructor(promise: Promise<any>, onFulfilled, onRejected) {
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

    public _callFulfilled(value) {
        _handlers.resolve(this._promise, value);
    };

    public _otherCallFulfilled(value) {
        _unwrap(this._promise, this._onFulfilled, value);
    };
    public _callRejected(value) {
        _handlers.reject(this._promise, value);
    };
    public _otherCallRejected(value) {
        _unwrap(this._promise, this._onRejected, value);
    };
}

function _unwrap(promise, func, value) {
    setTimeout(function () {
        var returnValue;
        try {
            returnValue = func.apply(null, value);
        } catch (e) {
            return _handlers.reject(promise, e);
        }
        
        if (returnValue === promise) {
            _handlers.reject(promise, new TypeError());
        } else {
            _handlers.resolve(promise, returnValue);
        }
        return null;
    });
}

class _handlers {

    public static resolve(self:Promise<any>, value) {
        var result = _tryCatch(_getThen, value);
        var thenable = result._value;
        var i = -1;
        var len = self._queue.length;

        if (result._status === 'error') {
            return _handlers.reject(self, result._value);
        }
        
        if (thenable) {
            _safelyResolveThenable(self, thenable);
        } else {
            self._state = _FULFILLED;
            self._outcome = value;
            while (++i < len) {
                self._queue[i]._callFulfilled(value);
            }
        }
        return self;
    };


    public static reject(self:Promise<any>, error) {
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

}

function _getThen(obj) {
    // Make sure we only access the accessor once as required by the spec
    var then = obj && obj.then;
    if (obj && (typeof obj === 'object' || typeof obj === 'function') && typeof then === 'function') {
        return function appyThen() {
            then.apply(obj, arguments);
        };
    } else {
        return null;
    }
}

function _safelyResolveThenable(self: Promise<any>, thenable: (onSuccess:(...T) => void, onFail:(...T) => void) => void) {
    // Either fulfill, reject or reject with error
    var called = false;
    function onError(...value) {
        if (called) {
            return;
        }
        called = true;
        _handlers.reject(self, value);
    }

    function onSuccess(...value) {
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

function _tryCatch(func, values?: any) {
    var out: {
        _value: any;
        _status: any;
    } = { _status: null, _value: null };
    try {
        out._value = func(values);
        out._status = 'success';
    } catch (e) {
        out._status = 'error';
        out._value = e;
    }
    return out;
}
