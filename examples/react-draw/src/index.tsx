import { EventHandler, FormEvent, Component } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { DrawStore, Path } from "./store";
import { nSQL, DatabaseEvent, NanoSQLInstance } from "nano-sql";
import * as $ from "jquery";

class DrawingApp extends Component<any, {
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
        this.state = {
            color: "#555555",
            size: 5,
            redos: [0, 0],
            rendering: false,
            canErase: false
        };
        this.colors = [
            "#d9e3f0",
            "#f47373",
            "#697689",
            "#37d67a",
            "#2ccce4",
            "#555555",
            "#dce775",
            "#ba68c8"
        ];
        this.updateComponent = this.updateComponent.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.setColor = this.setColor.bind(this);
        this.canDo = this.canDo.bind(this);
        this.erase = this.erase.bind(this);
    }

    public erase(): void {
        let t = this;
        if (!this.state.canErase) return;
        t.ctx.clearRect(0, 0, t.ctx.canvas.width, t.ctx.canvas.height);
        nSQL("paths").query("upsert", {
            color: "",
            size: -1,
            path: []
        }).exec();
        this.setState({
            ...this.state,
            canErase: false
        });
    }

    public undo(): void {
        nSQL().extend("hist", "<").then((result) => {
            if (result) this.drawFromStore();
        });
    }

    public redo(): void {
        nSQL().extend("hist", ">").then((result) => {
            if (result) this.drawFromStore();
        });
    }

    public setSize(size: number): void {
        this.setState({
            ...this.state,
            size: size
        });
    }

    public setColor(color: string): void {
        this.setState({
            ...this.state,
            color: color
        });
    }

    // Event handler for the db
    public updateComponent(e?: DatabaseEvent, db?: NanoSQLInstance): void {
        let t = this;
        nSQL().extend("hist", "?").then((historyArray) => {
            t.setState({
                ...t.state,
                redos: historyArray
            });
        });
    }

    public drawFromStore(): void {
        let t = this;
        this.setState({
            ...this.state,
            rendering: true
        });

        console.time("Redraw");

        t.ctx.clearRect(0, 0, t.ctx.canvas.width, t.ctx.canvas.height);

        let lastAction = "draw";

        nSQL("paths").query("select").exec().then((rows: Path[]) => {

            let prevPath = {x: 0, y: 0};

            rows.forEach((row, i) => {
                if (row.size !== -1) {
                    lastAction = "draw";
                    row.path.forEach((p, k) => {
                        if (k > 0) prevPath = row.path[k - 1];
                        if (k > 0) t.draw(row.color, row.size, prevPath.y, prevPath.x, p.y, p.x);
                    });
                } else {
                    lastAction = "erase";
                    t.ctx.clearRect(0, 0, t.ctx.canvas.width, t.ctx.canvas.height);
                }
            });

            console.timeEnd("Redraw");

            this.setState({
                ...this.state,
                rendering: false,
                canErase: rows.length > 0 && lastAction !== "erase"
            });
        });
    }

    public draw(color: string, size: number, prevY: number, prevX: number, currY: number, currX: number): void {
        let t = this;
        if (t.currentPath) t.currentPath.path.push({x: currX, y: currY});
        t.ctx.beginPath();
        t.ctx.moveTo(prevX, prevY);
        t.ctx.lineTo(currX, currY);
        t.ctx.strokeStyle = color;
        t.ctx.lineWidth = size;
        t.ctx.lineJoin = "round";
        t.ctx.closePath();
        t.ctx.stroke();
    }

    public componentDidMount(): void {

        let canvas = document.getElementById("DrawingContainer") as HTMLCanvasElement;
        this.ctx = canvas.getContext("2d");
        this.drawFromStore();
        this.activateDrawingSurface(canvas);
    }

    public activateDrawingSurface(cnvs: HTMLCanvasElement): void {
        let t = this;
        let w = cnvs.width;
        let h = cnvs.height;
        let flag = false,
        prevX = 0,
        currX = 0,
        prevY = 0,
        currY = 0,
        dot_flag = false;

        let offset = $("#DrawingContainer").offset();
        $(window).on("resize", () => {
            offset = $("#DrawingContainer").offset();
        });

        const findxy = (res, e) => {
            if (res === "down") {
                prevX = currX;
                prevY = currY;
                currX = e.clientX - offset.left;
                currY = e.clientY - offset.top;
                flag = true;
                t.currentPath = {
                    id: null,
                    color: t.state.color,
                    size: t.state.size,
                    path: [{x: currX, y: currY}]
                };
            }
            if (res === "up" || res === "out") {
                if (flag === true && t.currentPath.path.length) {
                    nSQL("paths").query("upsert", t.currentPath).exec();
                    if (t.state.canErase === false) {
                        t.setState({
                            ...t.state,
                            canErase: true
                        });
                    }
                }
                flag = false;
            }
            if (res === "move") {
                if (flag) {
                    prevX = currX;
                    prevY = currY;
                    currX = e.clientX - offset.left;
                    currY = e.clientY - offset.top;
                    t.draw(t.state.color, t.state.size, prevY, prevX, currY, currX);
                }
            }
        };

        const renderCursor = (type: string, e: MouseEvent) => {
            if (type === "out") {
                $(".cursor").css("opacity", 0);
            } else {
                $(".cursor").css("left", e.screenX - offset.left).css("top", e.screenY - offset.top - 52).css("opacity", 1);
            }
        };

        cnvs.addEventListener("mousemove", function (e) {
            findxy("move", e);
            renderCursor("move", e);
        }, false);
        cnvs.addEventListener("mousedown", function (e) {
            findxy("down", e);
        }, false);
        cnvs.addEventListener("mouseup", function (e) {
            findxy("up", e);
        }, false);
        cnvs.addEventListener("mouseout", function (e) {
            findxy("out", e);
            renderCursor("out", e);
        }, false);
    }

    // Update this component when the table gets updated.
    public componentWillMount(): void {
        nSQL("paths").on("change", this.updateComponent);
        nSQL("paths").on("select", this.updateComponent);
    }

    // Clear the event handler, otherwise it's a memory leak!
    public componentWillUnmount(): void {
        nSQL("paths").off(this.updateComponent);
    }

    public canDo(type: string ): string {
        if (this.state.redos[0] === 0) {
            return "is-disabled";
        } else {
            switch (type) {
                case ">": return this.state.redos[1] < this.state.redos[0] ? "" : "is-disabled";
                case "<": return this.state.redos[1] > 0 ? "" : "is-disabled";
            }
        }
    }

    public render(): JSX.Element {
        return (
            <div className="container">
                <nav className="level" style={{padding: "1.25rem 0", marginBottom: "0px"}}>
                    <div className="level-left">
                        <div className="level-item">
                            Color
                        </div>
                        <div className="level-item">
                            <div className="colorPicker">
                                {this.colors.map((c) => {
                                    return <span onClick={() => {
                                        this.setColor(c);
                                    }} style={{background: c}} className={this.state.color === c ? "picked" : ""}></span>;
                                })}
                            </div>
                        </div>
                        <div className="level-item">
                            Size
                        </div>
                        <div className="level-item">
                            <input value={this.state.size} onChange={(e) => {
                                this.setSize(parseInt((e.target as HTMLInputElement).value));
                            }} style={{width: "60px"}} className="input" type="number" min="2" />
                        </div>
                        <div className="level-item">
                            <a title="Clear" onClick={this.erase} className={"button is-danger " + (this.state.canErase ? "" : "is-disabled")}>
                                <span className="typcn typcn-times"></span>
                            </a>
                        </div>
                    </div>
                    <div className="level-right undo-redo">
                        <a title="Undo" onClick={this.undo} className={"button is-primary " + this.canDo("<")}>
                            <span className="typcn typcn-arrow-back"></span>
                        </a>
                        <a title="Redo" onClick={this.redo} className={"button is-primary " + this.canDo(">")}>
                            <span className="typcn typcn-arrow-forward"></span>
                        </a>
                    </div>
                </nav>
                <div>
                    <canvas className={this.state.rendering ? "loading" : ""} id="DrawingContainer" width="838" height="600"></canvas>
                </div>
                <div className="cursor"><span className="typcn typcn-pen"></span></div>
                <a href="https://github.com/ClickSimply/Some-SQL/tree/master/examples/react-draw" target="_blank">View Source</a>
            </div>
                );
    }
}

DrawStore().then(() => {
    ReactDOM.render(<DrawingApp />, document.body);
});