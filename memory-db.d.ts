import { SomeSQLBackend, ActionOrView, QueryLine, DataModel, StdObject } from "./index";
/**
 * In memory storage implimentation.
 *
 * @export
 * @class SomeSQLMemDB
 * @implements {SomeSQLBackend}
 */
export declare class _SomeSQLMemDB implements SomeSQLBackend {
    constructor();
    /**
     * Creates all the tables and prepares the database for use.
     *
     * @param {StdObject<Array<DataModel>>} models
     * @param {StdObject<Array<ActionOrView>>} actions
     * @param {StdObject<Array<ActionOrView>>} views
     * @param {StdObject<Function>} filters
     * @param {Array<any>} preCustom
     * @param {Function} callback
     *
     * @memberOf SomeSQLMemDB
     */
    connect(models: StdObject<Array<DataModel>>, actions: StdObject<Array<ActionOrView>>, views: StdObject<Array<ActionOrView>>, filters: StdObject<Function>, preCustom: Array<any>, callback: Function): void;
    /**
     * Public exec option.  Organizes the query then sends it to the internal execution function.
     *
     * @param {string} table
     * @param {Array<QueryLine>} query
     * @param {string} viewOrAction
     * @param {(rows: Array<Object>) => void} onSuccess
     * @param {(rows: Array<Object>) => void} [onFail]
     * @returns {void}
     *
     * @memberOf SomeSQLMemDB
     */
    exec(table: string, query: Array<QueryLine>, viewOrAction: string, onSuccess: (rows: Array<Object>) => void, onFail?: (rows: Array<Object>) => void): void;
}
