import { DBRow } from "./index";
export interface QueryCallBack {
    (result: Array<Object>, changeType: string, affectedRows: DBRow[], affectedPKs: any[]): void;
}
