import { EventHandler, FormEvent, Component } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { DrawStore, Path } from "./store";
import { SomeSQL, DatabaseEvent, SomeSQLInstance } from "some-sql";
import { PrimaryButton } from "office-ui-fabric-react/lib/Button";
import { CommandBar } from "office-ui-fabric-react/lib/CommandBar";
import { IContextualMenuItem, ContextualMenuItemType } from "office-ui-fabric-react/lib/ContextualMenu";
import { GroupedList, IGroup } from 'office-ui-fabric-react/lib/components/GroupedList/index';
import { IColumn } from 'office-ui-fabric-react/lib/DetailsList';
import {
  Selection,
  SelectionMode,
  SelectionZone
} from 'office-ui-fabric-react/lib/utilities/selection/index';

const header:IContextualMenuItem = {
    key: "1",
    name: "SomeSQL Playground",
    itemType: ContextualMenuItemType.Header,
    className:"ms-fontColor-neutralLighter"
}

class PlayGround extends Component<any, {
    color: string,
    size: number,
    redos: number[],
    rendering: boolean;
    canErase: boolean;
}> {

    public currentPath: Path;
    public colors: string[];
    public ctx: CanvasRenderingContext2D;

    constructor() {
        super();
    }

    public render(): JSX.Element {
        return (<div>
            <CommandBar
                isSearchBoxVisible={ false }
                items={[header]}
                className="ms-bgColor-magentaDark ms-fontColor-neutralLighter site_header"
            />
            <div className="ms-Grid"> 
                <div className="ms-Grid-row">
                    <div className="ms-Grid-col ms-u-sm6 ms-u-md4 ms-u-lg2">
                        A
                    </div>
                    <div className="ms-Grid-col ms-u-sm6 ms-u-md8 ms-u-lg10">B</div>
                </div>
            </div>
        </div>);
    }
}

DrawStore().then(() => {
    ReactDOM.render(<PlayGround />, document.getElementById("app"));
});
