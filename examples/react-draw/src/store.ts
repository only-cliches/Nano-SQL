import { nSQL } from "nano-sql";

export interface Path {
    id: number;
    color: string;
    size: number;
    path: {
        x: number,
        y: number
    }[];
}


export const DrawStore = (): Promise<any> => {
    nSQL("paths")
    .model([
        {key: "id", type: "int", props: ["pk", "ai"]},
        {key: "color", type: "string"},
        {key: "size", type: "int"},
        {key: "path", type: "array"}
    ]);

    return nSQL().config({persistent: true, history: true, id: "Draw-App"}).connect();
};
