import { NanoSQLInstance, DatabaseEvent } from ".";
import { IdbQueryExec } from "./query/std-query";
import { removeDuplicates } from "./utilities";
import { setFast } from "lie-ts";

export class Observer<T> {

    private _config: any[];

    private _order: string[] = [];

    private _count: number = 0;

    constructor(
        private _nSQL: NanoSQLInstance,
        private _query: (ev?: DatabaseEvent) => IdbQueryExec|undefined,
        private _tables: string[]
    ) {
        this._config = [];
    }

    /**
     * Debounce responses
     *
     * @param {number} ms
     * @returns
     * @memberof Observer
     */
    public debounce(ms: number) {
        this._config[this._order.length] = ms;
        this._order.push("dbnc");
        return this;
    }

    /**
     * Suppress identical results
     *
     * @returns
     * @memberof Observer
     */
    public distinct(keyFunc?: (obj: T, event?: DatabaseEvent) => any, compareFunc?: (key1: any, key2: any) => boolean) {
        this._config[this._order.length] = [
            keyFunc || ((obj) => obj),
            compareFunc || ((k1, k2) => k1 === k2)
        ];
        this._order.push("dsct");
        return this;
    }

    /**
     * Filter results based on specific conditions
     *
     * @param {(obj: any) => boolean} fn
     * @returns
     * @memberof Observer
     */
    public filter(fn: (obj: T, idx?: number, event?: DatabaseEvent) => boolean) {
        this._config[this._order.length] = fn;
        this._order.push("fltr");
        return this;
    }

    /**
     * Mutate results from observable
     *
     * @param {(obj: any) => any} fn
     * @returns
     * @memberof Observer
     */
    public map(fn: (obj: T, idx?: number, event?: DatabaseEvent) => any) {
        this._config[this._order.length] = fn;
        this._order.push("mp");
        return this;
    }

    /**
     * Emit only the first result OR emit the first result that meets a condition passed into the fn.
     *
     * @param {((obj?: any) => boolean|void)} fn
     * @returns
     * @memberof Observer
     */
    public first(fn?: (obj: T, idx?: number, event?: DatabaseEvent) => boolean) {
        this._config[this._order.length] = fn || ((obj, idx) => true);
        this._order.push("fst");
        return this;
    }

    /**
     * Skip the first n events.
     *
     * @param {number} num
     * @returns
     * @memberof Observer
     */
    public skip(num: number) {
        this._config[this._order.length] = num;
        this._order.push("skp");
        return this;
    }

    /**
     * Only get the first n events.
     *
     * @param {number} num
     * @memberof Observer
     */
    public take(num: number) {
        this._config[this._order.length] = num;
        this._order.push("tk");
        return this;
    }

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
    public subscribe(callback: (value: T, event?: DatabaseEvent) => void | {
        next: (value: T, event?: DatabaseEvent) => void;
        error?: (error: any) => void;
        complete?: (value?: T, event?: DatabaseEvent) => void;
    }) {
        let prevValue: {
            [idx: number]: any;
        } = {};
        let lastRan: {
            [idx: number]: number;
        } = {};
        let lastFunc: {
            [idx: number]: any;
        } = {};
        let complete: boolean;

        let lastCount: {
            [step: number]: number;
        } = {};

        return new ObserverSubscriber(this._nSQL, this._query, {
            next: (rows, event) => {
                this._count++;

                if (complete) return;

                let step = 0;
                const loop = () => {

                    if (step === this._order.length) {

                        if (typeof callback === "function") {
                            callback(rows, event);
                        } else if ((callback as any).next) {
                            (callback as any).next(rows, event);
                        }
                        if (complete && (callback as any).complete) {
                            (callback as any).complete(rows, event);
                        }
                    } else {

                        const getCount = (step: number): number => {
                            if (this._count === 0) return 0;
                            let i = step;
                            let count = this._count;
                            let found = false;
                            while (i-- && !found) {
                                if (lastCount[i] !== undefined) {
                                    found = true;
                                    count = lastCount[i];
                                }
                            }
                            return count;
                        };

                        switch (this._order[step]) {
                            case "dbnc":
                                if (!lastRan[step]) {
                                    lastRan[step] = Date.now();
                                } else {
                                    clearTimeout(lastFunc[step]);
                                    const debnc = this._config[step];
                                    lastFunc[step] = setTimeout(() => {
                                        if ((Date.now() - lastRan[step]) >= debnc) {
                                            lastRan[step] = Date.now();
                                            if (lastCount[step] === undefined) {
                                                lastCount[step] = 0;
                                            }
                                            lastCount[step]++;
                                            step++;
                                            loop();
                                        }
                                    }, debnc - (Date.now() - lastRan[step]));
                                    return;
                                }
                                break;
                            case "dsct":
                                const key = this._config[step][0](rows, event);
                                if (this._config[step][1](prevValue[step], key) === false) {
                                    prevValue[step] = key;
                                    if (lastCount[step] === undefined) {
                                        lastCount[step] = 0;
                                    }
                                    lastCount[step]++;
                                } else {
                                    return;
                                }
                                break;
                            case "fltr":
                                if (this._config[step](rows, getCount(step), event) === false) {
                                    return;
                                } else {
                                    if (lastCount[step] === undefined) {
                                        lastCount[step] = 0;
                                    }
                                    lastCount[step]++;
                                }
                                break;
                            case "fst":
                                if (this._config[step](rows, getCount(step), event) === true) {
                                    if (lastCount[step] === undefined) {
                                        lastCount[step] = 0;
                                    }
                                    lastCount[step]++;
                                    complete = true;
                                } else {
                                    return;
                                }
                                break;
                            case "mp":
                                rows = this._config[step](rows, getCount(step), event);
                                break;
                            case "skp":
                                if (getCount(step) <= this._config[step]) {
                                    return;
                                }
                                break;
                            case "tk":
                                if (getCount(step) >= this._config[step]) {
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
            error: (err) => {
                if ((callback as any).error) {
                    (callback as any).error(err);
                }
            }
        }, this._tables);
    }
}

export class ObserverSubscriber {

    public _closed: boolean;

    constructor(
        private _nSQL: NanoSQLInstance,
        private _getQuery: (ev?: DatabaseEvent) => IdbQueryExec|undefined,
        private _callback: {
            next: (value: any, event: any) => void;
            error: (error: any) => void;
        },
        private _tables: string[]
    ) {
        this._closed = false;
        this.exec = this.exec.bind(this);
        this.unsubscribe = this.unsubscribe.bind(this);

        const q = this._getQuery();

        if (q) {
            this._tables = removeDuplicates(this._tables.concat([q.table as string]));
            this.exec();
        }

        this._tables.forEach((table) => {
            this._nSQL.table(table).on("change", this.exec);
        });
    }

    public exec(event?: DatabaseEvent) {

        setFast(() => {
            const q = this._getQuery(event);
            if (!q) return;

            this._nSQL.query("select").manualExec(q).then((rows) => {
                this._callback.next(rows, event);
            }).catch((err) => {
                this._callback.error(err);
            });
        });

    }

    public unsubscribe() {
        this._tables.forEach((table) => {
            this._nSQL.table(table).off("change", this.exec);
        });
        this._closed = true;
    }

    public closed() {
        return this._closed;
    }
}
