import { NanoSQLInstance, DatabaseEvent } from ".";
import { IdbQueryExec } from "./query/std-query";
export declare class Observer<T> {
    private _nSQL;
    private _query;
    private _tables;
    private _config;
    private _order;
    private _count;
    constructor(_nSQL: NanoSQLInstance, _query: (ev?: DatabaseEvent) => IdbQueryExec | undefined, _tables: string[]);
    /**
     * Debounce responses
     *
     * @param {number} ms
     * @returns
     * @memberof Observer
     */
    debounce(ms: number): this;
    /**
     * Suppress identical results
     *
     * @returns
     * @memberof Observer
     */
    distinct(keyFunc?: (obj: T, event?: DatabaseEvent) => any, compareFunc?: (key1: any, key2: any) => boolean): this;
    /**
     * Filter results based on specific conditions
     *
     * @param {(obj: any) => boolean} fn
     * @returns
     * @memberof Observer
     */
    filter(fn: (obj: T, idx?: number, event?: DatabaseEvent) => boolean): this;
    /**
     * Mutate results from observable
     *
     * @param {(obj: any) => any} fn
     * @returns
     * @memberof Observer
     */
    map(fn: (obj: T, idx?: number, event?: DatabaseEvent) => any): this;
    /**
     * Emit only the first result OR emit the first result that meets a condition passed into the fn.
     *
     * @param {((obj?: any) => boolean|void)} fn
     * @returns
     * @memberof Observer
     */
    first(fn?: (obj: T, idx?: number, event?: DatabaseEvent) => boolean): this;
    /**
     * Skip the first n events.
     *
     * @param {number} num
     * @returns
     * @memberof Observer
     */
    skip(num: number): this;
    /**
     * Only get the first n events.
     *
     * @param {number} num
     * @memberof Observer
     */
    take(num: number): this;
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
    subscribe(callback: (value: T, event?: DatabaseEvent) => void | {
        next: (value: T, event?: DatabaseEvent) => void;
        error?: (error: any) => void;
        complete?: (value?: T, event?: DatabaseEvent) => void;
    }): ObserverSubscriber;
}
export declare class ObserverSubscriber {
    private _nSQL;
    private _getQuery;
    private _callback;
    private _tables;
    _closed: boolean;
    constructor(_nSQL: NanoSQLInstance, _getQuery: (ev?: DatabaseEvent) => IdbQueryExec | undefined, _callback: {
        next: (value: any, event: any) => void;
        error: (error: any) => void;
    }, _tables: string[]);
    exec(event?: DatabaseEvent): void;
    unsubscribe(): void;
    closed(): boolean;
}
