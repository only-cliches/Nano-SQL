export declare class DatabaseIndex {
    private _sorted;
    private _indexOf;
    ai: number;
    doAI: boolean;
    constructor();
    set(index?: any[]): void;
    getLocation(key: any): number;
    add(key: any): void;
    keys(): any[];
    indexOf(key: any): number;
    remove(key: any): void;
}
