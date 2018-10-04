import { NanoSQLInstance } from ".";
import { NanoSQLQuery } from "./interfaces";

// tslint:disable-next-line
export class _NanoSQLQuery {

    private _buffer: any[] = [];
    private _stream: boolean = false;

    constructor(
        public nSQL: NanoSQLInstance,
        public query: NanoSQLQuery,
        public progress: (row: any) => void,
        public complete: () => void,
        public error: (err: any) => void
    ) {
        this.query.state = "processing";
        const action = query.action.toLowerCase().trim();
        if (action !== "select" && typeof query.table !== "string") {
            this.query.state = "error";
            this.error(`Only "select" queries are available for this resource!`);
            return;
        }
        switch (action) {
            case "select":
                this._select();
            break;
            case "upsert":
                this._upsert();
            break;
            case "delete":
                this._delete();
            break;
            case "drop":
                this._drop();
            break;
            case "show tables":
                this._showTables();
            break;
            case "describe":
                this._describe();
            break;
            default:
                this.query.state = "error";
                this.error(`Query type "${query.action}" not supported!`);
        }
    }

    private _select() {

    }

    private _upsert() {

    }

    private _delete() {

    }

    private _drop() {

    }

    private _showTables() {

    }

    private _describe() {

    }
}