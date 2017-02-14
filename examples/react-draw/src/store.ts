import { SomeSQL } from "some-sql";
import { TSPromise } from "typescript-promise";

export interface ImageRow {
    id: number;
    color: string;
}

export interface ImageSizeRow {
    id: number;
    width: number;
    height: number;
}

export class DrawStore {

    public static init(): TSPromise<any> {
        SomeSQL("image")
        .model([
            {key: "id", type: "int", props: ["pk"]},
            {key: "color", type: "string"}
        ])

        SomeSQL("ImageSize")
        .model([
            {key: "id",type: "int", props:["pk"]},
            {key: "width", type: "int"},
            {key: "height", type: "int"}
        ])

        return SomeSQL().connect();
    }
}