import { SomeSQLBackend, ActionOrView, QueryLine, DataModel } from "./index";
import { TSMap } from "typescript-map";
/**
 * In memory storage implimentation.
 *
 * @export
 * @class SomeSQLMemDB
 * @implements {SomeSQLBackend}
 */
export declare class SomeSQLMemDB implements SomeSQLBackend {
    constructor();
    /**
     * Creates all the tables and prepares the database for use.
     *
     * @param {TSMap<string, Array<DataModel>>} models
     * @param {TSMap<string, Array<ActionOrView>>} actions
     * @param {TSMap<string, Array<ActionOrView>>} views
     * @param {TSMap<string, Function>} filters
     * @param {Array<any>} preCustom
     * @param {Function} callback
     *
     * @memberOf SomeSQLMemDB
     */
    connect(models: TSMap<string, Array<DataModel>>, actions: TSMap<string, Array<ActionOrView>>, views: TSMap<string, Array<ActionOrView>>, filters: TSMap<string, Function>, preCustom: Array<any>, callback: Function): void;
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
