/// Stolen from https://github.com/lyndseybrowning/trie-prefix-tree

const config = {
    END_WORD: "$",
    PERMS_MIN_LEN: 2,
};

export class Trie {

    private _trie: any;

    constructor(input: string[]) {
        this._trie = Trie._create(input);
    }

    public _addWord(word: string) {

        const reducer = (previousValue: any, currentValue: string, currentIndex: number, array: string[]) => {
            return Trie._append(previousValue, currentValue, currentIndex, array);
        };

        const input: string[] = word.toLowerCase().split("");
        input.reduce(reducer, this._trie);
        return this;
    }

    public _removeWord(word: string) {

        const { prefixFound, prefixNode } = Trie._checkPrefix(this._trie, word);

        if (prefixFound) {
            delete prefixNode[config.END_WORD];
        }

        return this;
    }

    public _isPrefix(prefix) {

        const { prefixFound } = Trie._checkPrefix(this._trie, prefix);

        return prefixFound;
    }

    public _getPrefix(strPrefix: string) {
        strPrefix = strPrefix.toLowerCase();
        if (!this._isPrefix(strPrefix)) {
            return [];
        }

        const { prefixNode } = Trie._checkPrefix(this._trie, strPrefix);

        return Trie._recursePrefix(prefixNode, strPrefix);
    }

    public static _append(trie, letter, index, array) {
        trie[letter] = trie[letter] || {};
        trie = trie[letter];

        if (index === array.length - 1) {
            trie[config.END_WORD] = 1;
        }

        return trie;
    }

    public static _checkPrefix(prefixNode, prefix: string) {
        const input: string[] = prefix.toLowerCase().split("");
        const prefixFound = input.every((letter, index) => {
            if (!prefixNode[letter]) {
                return false;
            }
            return prefixNode = prefixNode[letter];
        });

        return {
            prefixFound,
            prefixNode,
        };
    }

    public static _create(input) {

        const trie = input.reduce((accumulator, item) => {
            item
                .toLowerCase()
                .split("")
                .reduce(Trie._append, accumulator);

            return accumulator;
        }, {});

        return trie;
    }

    public static _recursePrefix(node, prefix, prefixes: string[] = []) {
        let word = prefix;

        for (const branch in node) {
            if (branch === config.END_WORD) {
                prefixes.push(word);
                word = "";
            }
            Trie._recursePrefix(node[branch], prefix + branch, prefixes);
        }

        return prefixes.sort();
    }
}