import { EventHandler, FormEvent, Component, PureComponent } from "react";
import * as React from "react";
import { nSQL, DatabaseEvent, NanoSQLInstance } from "nano-sql";

interface Nothing {}


interface TodoButtonState {
    nSQLdata: number[]; // history state
}

export class TodoButtons extends PureComponent<TodoButtonState, Nothing> {

    constructor(p) {
        super(p);
    }

    public undo(): void {
        nSQL().extend("hist", "<");
    }

    public redo(): void {
        nSQL().extend("hist", ">");
    }

    public static tables = ["todos"];

    public static onChange(event: DatabaseEvent, complete: (data: number[]) => void) {
        nSQL("todos").extend("hist", "?").then(complete);
    }

    public render(): JSX.Element {
        if (!this.props.nSQLdata) {
            return <div />;
        }
        return (
            <div style={{
                float: "right",
                position: "relative",
                top: "-59px",
                marginBottom: "-40px"
            }}>
                <button disabled={this.props.nSQLdata[1] === 0} onClick={this.undo}  className="uk-button uk-button-default uk-button-small" >Undo</button>
                <button disabled={this.props.nSQLdata[0] === 0 || this.props.nSQLdata[0] === this.props.nSQLdata[1]} onClick={this.redo}  className="uk-button uk-button-default uk-button-small">Redo</button>
            </div>
        );
    }
}