import { nSQL, NanoSQLInstance, DatabaseEvent } from "nano-sql";

export const nSQLVue = (props: {
    tables: string[], 
    callback:(event: DatabaseEvent, complete: (any) => void) => void, 
    store?: NanoSQLInstance
}) => {
    return {
        methods: {
            _nSQLDoRunUpdate: function(event) {
                if((props.store || nSQL()).isConnected && this.nSQLonChange) {
                    props.callback.apply(this, [event, this.nSQLonChange]);
                }
            }
        },
        created: function() {
            let k = props.tables.length;
            while (k--) {
                (props.store || nSQL()).table(props.tables[k]).on("change", this._nSQLDoRunUpdate);
                this._nSQLDoRunUpdate({
                    table: props.tables[k],
                    query: {
                        table: props.tables[k],
                        action: null,
                        actionArgs: null,
                        state: "complete",
                        result: [],
                        comments: []
                    },
                    time: Date.now(),
                    notes: ["mount"],
                    result: [],
                    types: ["change"],
                    actionOrView: "",
                    affectedRows: []
                });
            }
        },
        destroyed: function() {
            let k = props.tables.length;
            while (k--) {
                (props.store || nSQL()).table(props.tables[k]).on("change", this._nSQLDoRunUpdate);
            }
        }
    }
}