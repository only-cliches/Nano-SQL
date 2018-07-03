import * as React from "react";
import { NanoSQLInstance, nSQL, DatabaseEvent } from "nano-sql";

export interface WithNSQLData {
    nSQLdata?: any;
    nSQLloading?: boolean;
}

export interface NSQLComponent<T> extends React.ComponentClass<T> {
    onChange?:(e: DatabaseEvent, complete: (any) => void) => void;
    tables?:() => string[];
}

export function bindNSQL<P extends WithNSQLData>(Comp: NSQLComponent<P>, props: {
    tables?: string[], 
    onChange?: (e: DatabaseEvent, complete: (any) => void) => void, 
    store?: NanoSQLInstance
}): React.ComponentClass<P> {
    return class extends React.Component<P, {
        data: any;
        isLoading: boolean;
    }> {

        public tables: string[];
        public onChange: (e: DatabaseEvent, complete: (any) => void) => void;
        public store: NanoSQLInstance;

        constructor(p) {
            super(p);
            this.state = {data: undefined, isLoading: true};
            this.updateState = this.updateState.bind(this);
        }

        public componentWillMount() {
            if (props && props.tables && props.tables.length) {
                this.tables = props.tables;
            } else if (Comp.tables) {
                this.tables = Comp.tables();
            } else {
                throw Error("nSQL React: Need tables for nanoSQL HOC!");
            }
            
            if (props && props.onChange) {
                this.onChange = props.onChange;
            } else if (Comp.onChange) {
                this.onChange = Comp.onChange;
            } else {
                throw Error("nSQL React: Need tables for nanoSQL HOC!");
            }

            if (props && props.store) {
                this.store = props.store;
            } else {
                this.store = nSQL();
            }

            this.store.onConnected(() => {
                const prevTable: any = this.store.sTable;
                let k = this.tables.length;
                while(k--) {
                    this.store.table(this.tables[k]).on("change", this.updateState);
                    this.updateState({
                        table: this.tables[k],
                        query: {
                            table: this.tables[k],
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
                this.store.table(prevTable);
            });
        }

        public componentWillUnmount() {
            const prevTable: any = this.store.sTable;
            let k = this.tables.length;
            while(k--) {
                this.store.table(this.tables[k]).off("change", this.updateState);
            }
            this.store.table(prevTable);
        }

        public updateState(e: DatabaseEvent) {
            this.setState({isLoading: true}, () => {
                this.onChange(e, (data) => {
                    this.setState({isLoading: false, data: data});
                });
            })
        }

        public render() {
            return <Comp nSQLloading={this.state.isLoading} nSQLdata={this.state.data} {...this.props} />
        }
    }
}