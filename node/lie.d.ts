export declare class Promise<T> {
    _state: string[];
    _queue: _QueueItem[];
    _outcome: any;
    _handled: string[] | null;
    constructor(resolver: (onSuccess: (...T) => void, onFail: (...T) => void) => void);
    catch(onRejected: any): Promise<{}>;
    then(onFulfilled?: (...args) => void, onRejected?: (...args) => void): Promise<{}>;
    static resolve(value: any): Promise<any>;
    static reject(reason: any): Promise<any>;
    static all(iterable: any): Promise<any>;
    static race(iterable: any): Promise<any>;
}
export declare class _QueueItem {
    private _promise;
    _onFulfilled: any;
    _onRejected: any;
    constructor(promise: Promise<any>, onFulfilled: any, onRejected: any);
    _callFulfilled(value: any): void;
    _otherCallFulfilled(value: any): void;
    _callRejected(value: any): void;
    _otherCallRejected(value: any): void;
}
