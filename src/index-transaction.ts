import { NanoSQLInstance, ORMArgs, JoinArgs } from "./index";

 // tslint:disable-next-line
export class _NanoSQLTransactionORMQuery {

    private _queries: {
        table: string;
        action: string,
        column?: string,
        relationIDs?: any[]
        where?: any[]
    }[];

    private _query: {
        type: string;
        table: string;
        action: string,
        column?: string,
        relationIDs?: any[]
        where?: any[]
    };

    constructor(queries: any[], table: string, action: "add"|"delete"|"drop"|"rebuild"|"set", column?: string, relationIDs?: any[]) {
        this._queries = queries;
        this._query = {
            type: "orm",
            table: table,
            action: action,
            column: column,
            relationIDs: relationIDs
        };
    }

    public where(args: Array<any|Array<any>>): this {
        this._query.where = args;
        return this;
    }

    public exec(): void {
        this._queries.push(this._query);
    }
}

 // tslint:disable-next-line
export class _NanoSQLTransactionQuery {

    private _db: NanoSQLInstance;

    public _modifiers: any[];

    public _table: string;

    public _queries: any[];

    public _action: string;

    public _actionArgs: any;

    constructor(action: string, args: any, table: string, queries: any[]) {
        this._action = action;
        this._actionArgs = args;
        this._modifiers = [];
        this._table = table;
        this._queries = queries;
    }
    public where(args: Array<any|Array<any>>): _NanoSQLTransactionQuery {
        return this._addCmd("where", args);
    }
    public orm(ormArgs?: (string|ORMArgs)[]): _NanoSQLTransactionQuery {
        return this._addCmd("orm", ormArgs);
    }
    private _addCmd(type: string, args: any): _NanoSQLTransactionQuery {
        return this._modifiers.push({type: type, args: args}), this;
    }
    public exec(): void {
        this._queries.push({
            type: "std",
            action: this._action,
            actionArgs: this._actionArgs,
            table: this._table,
            query: this._modifiers
        });
    }
}