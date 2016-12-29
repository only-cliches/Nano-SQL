import { SomeSQLBackend, ActionOrView, QueryLine } from "./index";
import { TSMap } from "typescript-map";
export declare class SomeSQLMemDB implements SomeSQLBackend {
    constructor();
    connect(models: TSMap<string, Array<Object>>, actions: TSMap<string, Array<ActionOrView>>, views: TSMap<string, Array<ActionOrView>>, filters: TSMap<string, Function>, callback: Function): void;
    exec(table: string, query: Array<QueryLine>, viewOrAction: string, onSuccess: Function, onFail?: Function): void;
}
