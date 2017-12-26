import { EventHandler, FormEvent, Component, PureComponent } from "react";
import * as React from "react";
import { nSQL, DatabaseEvent, NanoSQLInstance } from "nano-sql";

interface FormState {
    value: string;
}

interface Nothing {}

export class TodoForm extends PureComponent<Nothing, FormState> {

    constructor() {
        super();
        this.state = {value: ""};
        this.onSubmit = this.onSubmit.bind(this);
        this.updateTitle = this.updateTitle.bind(this);
    }

    public onSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (!this.state.value.length) return;
        nSQL("todos").doAction("add_todo", {title: this.state.value}).then(() => {
            this.setState({
                value: ""
            });
        });

    }

    public updateTitle(event: FormEvent<HTMLInputElement>): void {
        this.setState({
            value: event.currentTarget.value
        });
    }

    public shouldComponentUpdate(nextProps, nextState): boolean {
        return this.state.value !== nextState.value;
    }

    public render(): JSX.Element {
        return (
            <form onSubmit={this.onSubmit}>
                <input placeholder="New Todo Title" className="uk-input" type="text" value={this.state.value} onChange={this.updateTitle} />
            </form>
        );
    }
}