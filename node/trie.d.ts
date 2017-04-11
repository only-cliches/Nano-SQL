export declare class Trie {
    private _trie;
    constructor(input: string[]);
    _addWord(word: string): this;
    _removeWord(word: string): this;
    _isPrefix(prefix: any): boolean;
    _getPrefix(strPrefix: string): string[];
    static _append(trie: any, letter: any, index: any, array: any): any;
    static _checkPrefix(prefixNode: any, prefix: string): {
        prefixFound: boolean;
        prefixNode: any;
    };
    static _create(input: any): any;
    static _recursePrefix(node: any, prefix: any, prefixes?: string[]): string[];
}
