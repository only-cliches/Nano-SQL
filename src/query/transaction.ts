import { NanoSQLInstance, ORMArgs, JoinArgs } from "../index";
import { IdbQuery } from "./std-query";

 // tslint:disable-next-line
export class _NanoSQLTransactionQuery {

    private _db: NanoSQLInstance;

    public _queries: IdbQuery[];

    public thisQ: IdbQuery;

    constructor(action: string, args: any, table: string, queries: IdbQuery[], transactionID: string) {
        this.thisQ = {
            state: "pending",
            table: table,
            action: action,
            actionArgs: args,
            queryID: transactionID,
            transaction: true,
            result: [],
            comments: []
        };
        this._queries = queries;
    }
    public where(args: any[]|any): _NanoSQLTransactionQuery {
        this.thisQ.where = args;
        return this;
    }
    public exec(): void {
        this._queries.push(this.thisQ);
    }
}