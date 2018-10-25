import { INanoSQLDatabaseEvent, INanoSQLQuery, INanoSQLObserver, INanoSQLObserverSubscriber, INanoSQLInstance } from "./interfaces";
export declare class Observer<T> implements INanoSQLObserver<T> {
    _nSQL: INanoSQLInstance;
    _query: (ev?: INanoSQLDatabaseEvent) => INanoSQLQuery;
    _tables: string[];
    _config: any[];
    _order: string[];
    _count: number;
    constructor(_nSQL: INanoSQLInstance, _query: (ev?: INanoSQLDatabaseEvent) => INanoSQLQuery, _tables: string[]);
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
    distinct(keyFunc?: (obj: T, event?: INanoSQLDatabaseEvent) => any, compareFunc?: (key1: any, key2: any) => boolean): this;
    /**
     * Filter results based on specific conditions
     *
     * @param {(obj: any) => boolean} fn
     * @returns
     * @memberof Observer
     */
    filter(fn: (obj: T, idx?: number, event?: INanoSQLDatabaseEvent) => boolean): this;
    /**
     * Mutate results from observable
     *
     * @param {(obj: any) => any} fn
     * @returns
     * @memberof Observer
     */
    map(fn: (obj: T, idx?: number, event?: INanoSQLDatabaseEvent) => any): this;
    /**
     * Emit only the first result OR emit the first result that meets a condition passed into the fn.
     *
     * @param {((obj?: any) => boolean|void)} fn
     * @returns
     * @memberof Observer
     */
    first(fn?: (obj: T, idx?: number, event?: INanoSQLDatabaseEvent) => boolean): this;
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
     * @param {((value: T, event?: INanoSQLDatabaseEvent) => void | {
     *         next: (value: T, event?: DatabaseEvent) => void;
     *         error?: (error: any) => void;
     *         complete?: (value?: T, event?: DatabaseEvent) => void;
     *     })} callback
     * @returns
     * @memberof Observer
     */
    subscribe(callback: (value: T, event?: INanoSQLDatabaseEvent) => void | {
        next: (value: T, event?: INanoSQLDatabaseEvent) => void;
        error?: (error: any) => void;
        complete?: (value?: T, event?: INanoSQLDatabaseEvent) => void;
    }): INanoSQLObserverSubscriber;
}
export declare class ObserverSubscriber implements INanoSQLObserverSubscriber {
    _closed: boolean;
    _nSQL: INanoSQLInstance;
    _getQuery: (ev?: INanoSQLDatabaseEvent) => INanoSQLQuery;
    _callback: {
        next: (value: any, event: any) => void;
        error: (error: any) => void;
    };
    _tables: string[];
    constructor(_nSQL: INanoSQLInstance, _getQuery: (ev?: INanoSQLDatabaseEvent) => INanoSQLQuery, _callback: {
        next: (value: any, event: any) => void;
        error: (error: any) => void;
    }, _tables: string[]);
    exec(event?: INanoSQLDatabaseEvent): void;
    unsubscribe(): void;
    closed(): boolean;
}
