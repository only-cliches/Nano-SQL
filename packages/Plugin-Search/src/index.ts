import { InanoSQLPlugin, InanoSQLInstance, deleteRowFilter, configTableFilter, adapterWriteFilter, willConnectFilter, InanoSQLIndex, InanoSQLQuery, IWhereCondition, addRowFilter, updateRowFilter, customQueryFilter, configTableSystemFilter, addRowEventFilter } from "@nano-sql/core/lib/interfaces";
import { allAsync, getFnValue, crowDistance, resolvePath, objectsEqual, deg2rad, adapterFilters, deepGet, buildQuery, noop, hash, _nanoSQLQueue, maybeAssign, chainAsync } from "@nano-sql/core/lib/utilities";

import * as metaphone from "metaphone";
import * as stemmer from "stemmer";

export interface FuzzySearchTokenizer {
    (tableName: string, tableId: string, path: string[], value: string): {
        w: string; // tokenized output
        i: number; // location of word in string
    }[]
}

export const stopWords = [
    "a", "about", "after", "all", "also", "am", "an", "and", "andor", "another", "any",
    "are", "as", "at", "be", "because", "been", "before", "being", "between",
    "both", "but", "by", "came", "can", "come", "could", "did", "do", "each",
    "for", "from", "get", "got", "had", "has", "have", "he", "her", "here",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "like",
    "make", "many", "me", "might", "more", "most", "much", "must", "my", "never",
    "now", "of", "on", "only", "or", "other", "our", "out", "over", "said", "same",
    "see", "should", "since", "some", "still", "such", "take", "than", "that", "the",
    "their", "them", "then", "there", "these", "they", "this", "those", "through",
    "to", "too", "under", "up", "very", "was", "way", "we", "well", "were", "what",
    "where", "which", "while", "who", "with", "would", "you", "your"
];


export const defaultTokenizer = (type: "english" | "english-meta" | "english-stem", stpWrds: string[], decimalPoints: number = 4): FuzzySearchTokenizer => {
    return (tableName, tableId, path, value) => {

        const isStopWord = (word: string): boolean => {
            return !word || word === null ? true : // is this word falsey? (ie no length, undefined, etc);
                String(word).length === 1 ? true : // is this word 1 length long?
                    stpWrds.indexOf(word) !== -1; // does word match something in the stop word list?
        };

        // Step 1, Clean up and normalize the text
        const words: string[] = String(value || "")
            // everything to lowercase
            .toLowerCase()
            // normalize fractions and numbers (1/4 => 0.2500, 1,000,235 => 100235.0000)
            .replace(/(\d+)\/(\d+)|(?:\d+(?:,\d+)*|\d+)(?:\.\d+)?/gmi, (all, top, bottom) => top || bottom ? (parseInt(top) / parseInt(bottom)).toFixed(decimalPoints) : (parseFloat(all.replace(/\,/gmi, ""))).toFixed(decimalPoints))
            // replace dashes, underscores, anything like parantheses, slashes, newlines and tabs with a single whitespace
            .replace(/\-|\_|\[|\]|\(|\)|\{|\}|\r?\n|\r|\t/gmi, " ")
            // remove anything but letters, numbers and decimals inside numbers with nothing.
            .replace(/[^\w\s]|(\d\.)/gmi, "$1")
            // remove white spaces larger than 1 with 1 white space.
            .replace(/\s+/g, " ")
            .split(" ");


        // Step 2, tokenize!
        switch (type) {
            case "english": return words.map((w, i) => ({ // 220 words/ms
                i: i,
                w: isNaN(w as any) ? (isStopWord(w) ? "" : metaphone(stemmer(w))) : w
            })).filter(f => f.w);
            case "english-stem": return words.map((w, i) => ({ // 560 words/ms
                i: i,
                w: isNaN(w as any) ? (isStopWord(w) ? "" : stemmer(w)) : w
            })).filter(f => f.w);
            case "english-meta": return words.map((w, i) => ({ // 270 words/ms
                i: i,
                w: isNaN(w as any) ? (isStopWord(w) ? "" : metaphone(w)) : w
            })).filter(f => f.w);
        }

        // no tokenization: 2,684 words/ms
        return words.map((w, i) => ({ w, i }));
    }
}

export interface IFuzzyIndex {
    indexId: string;
    tableName: string;
    tableId: string;
    path: string[];
    tokenizer: FuzzySearchTokenizer;
}

export interface IFuzzyTokenData {
    wrd: string,
    ids: { id: any, i: number[] }[]
}

let searchIndexes: {
    [tableId: string]: IFuzzyIndex[]
} = {};

let indexLocks: {
    [tableId: string]: {
        [token: string]: boolean;
    }
} = {};

const addRowToFuzzy = (newRow: any, tableId: string, pkPath: string[], nSQL: InanoSQLInstance, query: InanoSQLQuery, complete: (err?: any) => void) => {
    const newRowData = newRow;
    const newRowPK = deepGet(pkPath, newRowData);
    const filters = adapterFilters(query.databaseID, nSQL, query);

    allAsync(searchIndexes[tableId], (item: IFuzzyIndex, i, next, err) => {
        const phrase = deepGet(item.path, newRowData);
        if (typeof phrase !== "string" || !phrase) { // nothing to index
            next();
            return;
        }

        const phraseHash = hash(phrase);
        const tokens = item.tokenizer(item.tableName, item.tableId, item.path, phrase);
        const mergedTokens: { [token: string]: number[] } = tokens.reduce((prev, cur) => {
            if (!prev[cur.w]) {
                prev[cur.w] = [];
            }
            prev[cur.w].push(cur.i);
            return prev;
        }, {});
        const tokenArray = tokens.map(s => s.i + ":" + s.w);


        const indexTableNameWords = "_" + tableId + "_fuzzy_words_" + item.path.join(".");
        const indexTableNameWordsId = nSQL.getDB(query.databaseID)._tableIds[indexTableNameWords];

        // write cache of row index data
        filters.write(indexTableNameWords, newRowPK, {
            id: newRowPK,
            hash: phraseHash,
            tokens: tokenArray
        }, () => {
            // write words to index
            const indexTable = "_" + tableId + "_fuzzy_" + item.path.join(".");
            const indexTableId = nSQL.getDB(query.databaseID)._tableIds[indexTable];
            allAsync(Object.keys(mergedTokens), (word: string, k, nextToken, errToken) => {

                const writeToken = () => {
                    filters.read(indexTable, word, (tokenRow?: { wrd: string, ids: any[] }) => {
                        const useRow = maybeAssign(tokenRow) || {
                            wrd: word,
                            ids: [] as any[]
                        }
                        useRow.ids.push({ id: newRowPK, i: mergedTokens[word] });
                        filters.write(indexTable, word, useRow, () => {
                            delete indexLocks[tableId][word];
                            nextToken();
                        }, (err) => {
                            delete indexLocks[tableId][word];
                            errToken(err);
                        })

                    }, (err) => {
                        delete indexLocks[tableId][word];
                        errToken(err);
                    });
                };

                const checkTokenLock = () => {
                    if (indexLocks[tableId][word]) {
                        setTimeout(() => {
                            checkTokenLock();
                        }, 2);
                    } else {
                        indexLocks[tableId][word] = true;
                        writeToken();
                    }
                }
                checkTokenLock();

            }).then(next).catch(err);
        }, err);

    }).then(() => {
        complete();
    }).catch(complete);
}

const rmRowFromFuzzy = (newRowData: any, pkPath: string[], databaseID: string, nSQL: InanoSQLInstance, query: InanoSQLQuery, tableId: string, complete: (err?: any) => void) => {

    const newRowPK = deepGet(pkPath, newRowData);
    const filters = adapterFilters(databaseID, nSQL, query);

    allAsync(searchIndexes[tableId], (item: IFuzzyIndex, i, next, err) => {
        const indexTableNameWords = "_" + tableId + "_fuzzy_words_" + item.path.join(".");
        const indexTableNameWordsId = nSQL.getDB(databaseID)._tableIds[indexTableNameWords];
        // remove row data cache
        filters.delete(indexTableNameWords, newRowPK, () => {

            const phrase = deepGet(item.path, newRowData);

            if (typeof phrase !== "string" || !phrase) { // nothing to delete
                next();
                return;
            }

            const indexTable = "_" + tableId + "_fuzzy_" + item.path.join(".");
            const indexTableId = nSQL.getDB(databaseID)._tableIds[indexTable];
            const tokens = item.tokenizer(item.tableName, item.tableId, item.path, phrase);
            const mergedTokens: { [token: string]: number[] } = tokens.reduce((prev, cur) => {
                if (!prev[cur.w]) {
                    prev[cur.w] = [];
                }
                prev[cur.w].push(cur.i);
                return prev;
            }, {});

            allAsync(Object.keys(mergedTokens), (word: string, k, nextToken, errToken) => {

                const writeToken = () => {
                    filters.read(indexTable, word, (tokenRow?: { wrd: string, ids: { id: any, i: number[] }[] }) => {
                        const useRow = maybeAssign(tokenRow) || {
                            wrd: word,
                            ids: [] as { id: any, i: number[] }[]
                        }
                        let idx = -1;
                        let i = useRow.ids.length;
                        while (i-- && idx === -1) {
                            if (useRow.ids[i].id === newRowPK) {
                                idx === i;
                            }
                        }
                        if (idx !== -1) {
                            useRow.ids.splice(idx, 1);

                            if (!useRow.ids.length) { // no rows left for this token
                                filters.delete(indexTable, word, () => {
                                    delete indexLocks[tableId][word];
                                    nextToken();
                                }, (err) => {
                                    delete indexLocks[tableId][word];
                                    errToken(err);
                                })
                            } else { // write other row data back
                                filters.write(indexTable, word, useRow, () => {
                                    delete indexLocks[tableId][word];
                                    nextToken();
                                }, (err) => {
                                    delete indexLocks[tableId][word];
                                    errToken(err);
                                })
                            }

                        } else {
                            delete indexLocks[tableId][word];
                            nextToken();
                        }
                    }, (err) => {
                        delete indexLocks[tableId][word];
                        errToken(err);
                    });
                };

                const checkTokenLock = () => {
                    if (indexLocks[tableId][word]) {
                        setTimeout(() => {
                            checkTokenLock();
                        }, 2);
                    } else {
                        indexLocks[tableId][word] = true;
                        writeToken();
                    }
                }
                checkTokenLock();

            }).then(next).catch(err);

        }, err);

    }).then(() => {
        complete();
    }).catch(complete);
}

export const FuzzyUserSanitize = (str: string) => {
    return String(str).replace(/\'|\,/gmi, "");
}

export const FuzzySearch = (): InanoSQLPlugin => {

    let nSQL: InanoSQLInstance;

    return {
        name: "Fuzzy Search",
        version: 2.01,
        filters: [
            {
                name: "willConnect",
                priority: 1000,
                call: (inputArgs: willConnectFilter, complete: (args: willConnectFilter) => void, cancel: (info: any) => void) => {
                    nSQL = inputArgs.res;
                    complete(inputArgs);

                    nSQL.functions["SEARCH"] = {
                        type: "S",
                        call: (query, row, prev, gpsCol: string, lat: string, lon: string) => {
                            // no standard usage
                            return {
                                result: 0
                            };
                        },
                        checkIndex: (query, fnArgs, where) => {
                            const tableId = nSQL.getDB(query.databaseID)._tableIds[query.table as string];
                            // no indexes on this table
                            if (!searchIndexes[tableId] || !searchIndexes[tableId].length) {
                                return false;
                            }

                            // search all fuzzy indexes
                            if (fnArgs[0] === "*") {
                                return {
                                    index: "*",
                                    parsedFn: { name: "SEARCH", args: fnArgs },
                                    comp: where[1],
                                    value: where[2],
                                    col: String(-1)
                                };
                            }

                            const indexPath = resolvePath(fnArgs[0]);
                            const indexJoined = indexPath.join(".");
                            let idx = -1;
                            let i = searchIndexes[tableId].length;
                            while (i-- && idx === -1) {
                                if (searchIndexes[tableId][i].path.join(".") == indexJoined) {
                                    idx = i;
                                }
                            }

                            // no matching index found
                            if (idx === -1) {
                                return false;
                            }

                            return {
                                index: searchIndexes[tableId][idx].indexId,
                                parsedFn: { name: "SEARCH", args: fnArgs },
                                comp: where[1],
                                value: where[2],
                                col: String(idx)
                            };

                        },
                        queryIndex: (query: InanoSQLQuery, where: IWhereCondition, onlyPKs: boolean, onRow: (row, i) => void, complete: () => void, error: (err) => void) => {

                            const filters = adapterFilters(query.databaseID, nSQL, query);

                            const getRows = (PKs: any[]) => {
                                PKs = PKs.filter((v, i, s) => s.indexOf(v) === i);
                                if (!PKs.length) {
                                    complete();
                                    return;
                                }

                                if (onlyPKs) {
                                    let kk = 0;
                                    while (kk < PKs.length) {
                                        onRow(PKs[kk], kk);
                                        kk++;
                                    }
                                    complete();
                                }

                                chainAsync(PKs, (rowKey: any, i, next, err) => {
                                    let counter = 0;
                                    filters.read(query.table as string, rowKey, (row) => {
                                        if (!row) {
                                            next();
                                            return;
                                        }

                                        onRow(row, counter);
                                        counter++;
                                        next();
                                    }, err);
                                }).then(() => {
                                    complete();
                                }).catch(error);
                            }

                            const tableId = nSQL.getDB(query.databaseID)._tableIds[query.table as string];

                            let searchTheseIndexes = (parseInt(where.col as any) !== -1 ? [where.index] : searchIndexes[tableId].map(s => s.indexId)) as string[];

                            let secondaryIndexPKS: any[] = [];

                            const getNextSearchTerm = (searchIdx: number, indexNum: number) => {

                                // search done
                                if (!searchTheseIndexes[indexNum]) {
                                    getRows(secondaryIndexPKS);
                                    return;
                                }

                                // out of search terms for this index
                                // move to next index
                                if (!(where.parsedFn as any).args[searchIdx]) { 
                                    getNextSearchTerm(1, indexNum + 1);
                                    return;
                                }

                                // strip trailing and leading quotes from search term
                                const searchValue = (where.parsedFn as any).args[searchIdx];
                                const quoteRegex = /^[\"|\'](.*)[\"|\']$/gmi;
                                const hasQuotes = quoteRegex.exec(searchValue);
                                const useSeachValue = hasQuotes ? hasQuotes[1] : searchValue;

                                const useIndex = searchIndexes[tableId][indexNum];

                                if (!useIndex) {
                                    error("Erro getting fuzzy index!");
                                    return;
                                }

                                const phraseTokens = useIndex.tokenizer(useIndex.tableName, useIndex.tableId, useIndex.path, useSeachValue);

                                // blank search term, cya!
                                if (!phraseTokens.length) {
                                    complete();
                                    return;
                                }

                                const mergedTokens: { [token: string]: number[] } = phraseTokens.reduce((prev, cur) => {
                                    if (!prev[cur.w]) {
                                        prev[cur.w] = [];
                                    }
                                    prev[cur.w].push(cur.i);
                                    return prev;
                                }, {});



                                const tokenLocs: {
                                    [token: string]: IFuzzyTokenData;
                                } = {};

                                const wordLocs: {
                                    [rowID: string]: {
                                        rowKey: any;
                                        words: { [word: string]: number[]; }
                                    }
                                } = {};


                                // get exact matches from secondary index
                                filters.readIndexKey(query.table as string, searchTheseIndexes[indexNum], useSeachValue, (pk) => {
                                    secondaryIndexPKS.push(pk);
                                }, () => {

                                    // now do tokenization and search
                                    allAsync(Object.keys(mergedTokens), (word: string, i, nextWord, errWord) => {
                                        const indexTable = "_" + tableId + "_fuzzy_" + useIndex.path.join(".");
                                        const indexTableId = nSQL.getDB(query.databaseID)._tableIds[indexTable];

                                        filters.read(indexTable, word, (tokenRow?: IFuzzyTokenData) => {
                                            const useRow = tokenRow || {
                                                wrd: word,
                                                ids: []
                                            };

                                            useRow.ids.forEach((rowData) => {
                                                if (!wordLocs[String(rowData.id)]) {
                                                    wordLocs[String(rowData.id)] = {
                                                        rowKey: rowData.id,
                                                        words: {}
                                                    };
                                                }
                                                wordLocs[String(rowData.id)].words[useRow.wrd] = rowData.i;
                                            });
                                            tokenLocs[word] = useRow;
                                            nextWord();
                                        }, errWord);
                                    }).then(() => {

                                        if (phraseTokens.length <= 1) { // single word search (easy and quick)
                                            if ((where.comp === "=" || where.comp.indexOf("=") !== -1) && where.comp !== "!=" && where.value === 0) {
                                                // doing exact match
                                                Object.keys(tokenLocs).forEach((word) => {
                                                    secondaryIndexPKS = secondaryIndexPKS.concat(tokenLocs[word].ids.map(r => r.id));
                                                });
                                                getNextSearchTerm(searchIdx + 1, indexNum);
                                            } else {
                                                if (secondaryIndexPKS.length) {
                                                    getNextSearchTerm(searchIdx + 1, indexNum);
                                                } else {
                                                    // no matches
                                                    getNextSearchTerm(searchIdx + 1, indexNum);
                                                }

                                            }
                                        } else { // phrase search (oh boy)
                                            const phraseWords = phraseTokens.map(s => s.w);
                                            const phraseLocs = phraseTokens.map(s => s.i);

                                            let rowSlots: {
                                                rowKey: any,
                                                wordSlots: number[][];
                                            }[] = [];

                                            Object.keys(wordLocs).forEach((rowID) => {
                                                const rowData = wordLocs[rowID];
                                                const newSlot: {
                                                    rowKey: any,
                                                    wordSlots: number[][];
                                                } = {
                                                    rowKey: rowData.rowKey,
                                                    wordSlots: []
                                                };
                                                phraseWords.forEach((phraseWord, jj) => {
                                                    newSlot.wordSlots[jj] = rowData.words[phraseWord] || [];
                                                });
                                                rowSlots.push(newSlot);
                                            });

                                            rowSlots.forEach((slot) => {
                                                // best score === 0;
                                                let score = 100000;
                                                /*
                                                    slot.wordSlots contains an array of phrase matches, in order of the search phrase, found in this row.
                                                    each wordSlot contains all the locations for the word match in the target row
                                                    we're going to scroll through every possible combination of matched phrases to find the best matches
                                                */
                                                const recursiveMatch = (...positions: number[]) => {

                                                    let baseScore = 0;

                                                    // checkLocs contains the phrase locations we are testing
                                                    const checkLocs = slot.wordSlots.map((s, i) => {
                                                        if (!slot.wordSlots[i].length) {
                                                            baseScore += 1;
                                                        }
                                                        return slot.wordSlots[i][positions[i]];
                                                    });

                                                    let firstPoint;
                                                    let phrasePoint;
                                                    for (let i = 0; i < checkLocs.length; i++) {
                                                        if (checkLocs[i] === undefined) {
                                                            baseScore++;
                                                        } else {
                                                            if (firstPoint === undefined) {
                                                                firstPoint = checkLocs[i];
                                                                phrasePoint = phraseLocs[i];
                                                            } else {
                                                                const diff = Math.abs((checkLocs[i] - firstPoint) - 1);
                                                                const phraseDiff = Math.abs((phraseLocs[i] - phrasePoint) - 1);
                                                                baseScore += Math.abs(diff - phraseDiff);
                                                                firstPoint = checkLocs[i];
                                                                phrasePoint = phraseLocs[i];
                                                            }
                                                        }
                                                    }

                                                    // set up score
                                                    score = Math.min(score, baseScore);

                                                    // setup next loop
                                                    // start jumping to the next item on the last phrase, then the next phrase...
                                                    let nextAdjustPos = slot.wordSlots.length - 1;
                                                    let nextIndex = positions[nextAdjustPos] + 1;
                                                    while (nextAdjustPos >= 0 && !slot.wordSlots[nextAdjustPos][nextIndex]) {
                                                        nextAdjustPos--;
                                                        nextIndex = positions[nextAdjustPos] + 1;
                                                    }

                                                    const newPos = positions.slice();
                                                    newPos[nextAdjustPos] = nextIndex;
                                                    // if this is undefined we've ran out of comparisons
                                                    if (newPos[nextAdjustPos]) {
                                                        recursiveMatch(...newPos);
                                                    }
                                                }
                                                // start at position 0, 0, 0, 0, 0...
                                                recursiveMatch(...slot.wordSlots.map(s => 0));

                                                switch (where.comp) {
                                                    case "=":
                                                        if (score === where.value) {
                                                            secondaryIndexPKS.push(slot.rowKey);
                                                        }
                                                        break;
                                                    case ">=":
                                                        if (score >= where.value) {
                                                            secondaryIndexPKS.push(slot.rowKey);
                                                        }
                                                        break;
                                                    case "<=":
                                                        if (score <= where.value) {
                                                            secondaryIndexPKS.push(slot.rowKey);
                                                        }
                                                        break;
                                                    case "<":
                                                        if (score < where.value) {
                                                            secondaryIndexPKS.push(slot.rowKey);
                                                        }
                                                        break;
                                                    case ">":
                                                        if (score > where.value) {
                                                            secondaryIndexPKS.push(slot.rowKey);
                                                        }
                                                        break;
                                                    case "!=":
                                                        if (score !== where.value) {
                                                            secondaryIndexPKS.push(slot.rowKey);
                                                        }
                                                        break;
                                                }
                                            });

                                            getNextSearchTerm(searchIdx + 1, indexNum);

                                        }
                                    });

                                }, error);

                            }

                            getNextSearchTerm(1, 0);
                        }
                    }
                }
            },
            {   // grab the search index values from the existing index definitions
                name: "configTableSystem",
                priority: 1000,
                call: (inputArgs: configTableSystemFilter, complete: (args: configTableSystemFilter) => void, cancel: (info: any) => void) => {
                    const tableId = inputArgs.res.id;
                    const tableName = inputArgs.res.name;
                    const pkKey = "id:" + inputArgs.res.pkType;


                    if (inputArgs.res.name.indexOf("_") === 0) {
                        complete(inputArgs);
                        return;
                    }

                    const indexes = inputArgs.res.indexes || {};

                    searchIndexes[tableId] = [];
                    indexLocks[tableId] = {};

                    Object.keys(indexes).forEach((indexId) => {
                        if (indexes[indexId].props.search) {
                            if (typeof indexes[indexId].props.search === "boolean") {
                                searchIndexes[tableId].push({
                                    indexId: indexId,
                                    tableName: tableName,
                                    tableId: tableId,
                                    path: indexes[indexId].path,
                                    tokenizer: defaultTokenizer("english", stopWords)
                                })
                            } else {
                                searchIndexes[tableId].push({
                                    indexId: indexId,
                                    tableName: tableName,
                                    tableId: tableId,
                                    path: indexes[indexId].path,
                                    tokenizer: indexes[indexId].props.search.tokenizer || defaultTokenizer("english", stopWords)
                                })
                            }
                        }
                    });

                    allAsync(searchIndexes[tableId], (item: IFuzzyIndex, i, next, err) => {
                        const indexTableName = "_" + tableId + "_fuzzy_" + item.path.join(".");
                        // store the data for each token
                        nSQL.triggerQuery(inputArgs.query.databaseID, {
                            ...buildQuery(inputArgs.query.databaseID, nSQL, "", "create table"),
                            actionArgs: {
                                name: indexTableName,
                                _internal: true,
                                model: {
                                    "wrd:string": { pk: true },
                                    "ids:any[]": {
                                        notNull: true,
                                        model: {
                                            [pkKey]: {},
                                            "i:int[]": {}
                                        }
                                    }
                                }
                            }
                        }, noop, () => {


                            // store the locations of each token for every row
                            // allows us to diff updates
                            const indexTableNameWords = "_" + tableId + "_fuzzy_words_" + item.path.join(".");

                            nSQL.triggerQuery(inputArgs.query.databaseID, {
                                ...buildQuery(inputArgs.query.databaseID, nSQL, "", "create table"),
                                actionArgs: {
                                    name: indexTableNameWords,
                                    _internal: true,
                                    model: {
                                        [pkKey]: { pk: true },
                                        "hash:string": {},
                                        "tokens:any": {},
                                    }
                                }
                            }, noop, next, err);
                        }, err);
                    }).then(() => {
                        complete(inputArgs);
                    }).catch((err) => {
                        cancel(err);
                    })
                }
            },
            {
                name: "addRowEvent",
                priority: 1000,
                call: (inputArgs: addRowEventFilter, complete: (args: addRowEventFilter) => void, cancel: (info: any) => void) => {

                    const tableId = nSQL.getDB(inputArgs.query.databaseID)._tableIds[inputArgs.query.table as string];
                    const pkPath = nSQL.getDB(inputArgs.query.databaseID)._tables[inputArgs.query.table as string].pkCol;

                    if (!searchIndexes[tableId] || !searchIndexes[tableId].length) {  // no indexes for this table
                        complete(inputArgs);
                    } else {  // add new row
                        addRowToFuzzy(inputArgs.res.result, tableId, pkPath, nSQL, inputArgs.query, (err) => {
                            if (err) {
                                cancel(err);
                            } else {
                                complete(inputArgs);
                            }
                        });
                    }
                }
            },
            {
                name: "updateRow",
                priority: 1000,
                call: (inputArgs: updateRowFilter, complete: (args: updateRowFilter) => void, cancel: (info: any) => void) => {
                    const tableId = nSQL.getDB(inputArgs.query.databaseID)._tableIds[inputArgs.query.table as string];
                    const pkPath = nSQL.getDB(inputArgs.query.databaseID)._tables[inputArgs.query.table as string].pkCol;

                    if (!searchIndexes[tableId] || !searchIndexes[tableId].length) { // no indexes for this table
                        complete(inputArgs);
                    } else { // update row data
                        const newRowData = inputArgs.res as any;
                        const newRowPK = deepGet(pkPath, newRowData);
                        const filters = adapterFilters(inputArgs.query.databaseID, nSQL, inputArgs.query);

                        allAsync(searchIndexes[tableId], (item: IFuzzyIndex, i, next, err) => {
                            const indexTableNameWords = "_" + tableId + "_fuzzy_words_" + item.path.join(".");
                            const indexTableNameWordsId = nSQL.getDB(inputArgs.query.databaseID)._tableIds[indexTableNameWords];
                            // read row cache
                            filters.read(indexTableNameWords, newRowPK, (row: { id: any, hash: string, tokens: string[] }) => {

                                const useRow = maybeAssign(row) || { id: newRowPK, hash: "", tokens: [] as string[] };
                                const phrase = deepGet(item.path, newRowData);

                                // new and old are both empty
                                if (!useRow.hash && (!phrase || typeof phrase !== "string")) {
                                    next();
                                    return;
                                }

                                const phraseHash = hash(String(phrase));
                                if (phraseHash === useRow.hash) { // no changes in index data
                                    next();
                                    return;
                                }

                                const indexTable = "_" + tableId + "_fuzzy_" + item.path.join(".");
                                const indexTableId = nSQL.getDB(inputArgs.query.databaseID)._tableIds[indexTable];

                                const tokens = item.tokenizer(item.tableName, item.tableId, item.path, phrase);
                                const tokenArray = tokens.map(s => s.i + ":" + s.w);

                                const deleteTokens = useRow.tokens.filter(t => tokenArray.indexOf(t) === -1);
                                const addTokens = tokenArray.filter(t => useRow.tokens.indexOf(t) === -1);

                                // adjust tokens
                                allAsync([deleteTokens, addTokens], (arr: string[], kk, nextArr, errArr) => {

                                    const cleanedTokens = arr.map(s => {
                                        const sp = s.split(":");
                                        const thisPos: string = sp.shift() as any; // shift off index
                                        return { w: sp.join(":"), i: parseInt(thisPos) };
                                    });

                                    const mergedTokens: { [token: string]: number[] } = cleanedTokens.reduce((prev, cur) => {
                                        if (!prev[cur.w]) {
                                            prev[cur.w] = [];
                                        }
                                        prev[cur.w].push(cur.i);
                                        return prev;
                                    }, {});

                                    allAsync(Object.keys(mergedTokens), (word: string, k, nextToken, errToken) => {

                                        const writeToken = () => {
                                            filters.read(indexTable, word, (tokenRow?: IFuzzyTokenData) => {

                                                const useRow: IFuzzyTokenData = maybeAssign(tokenRow) || {
                                                    wrd: word,
                                                    ids: []
                                                }
                                                let idx = -1;
                                                let i = 0;
                                                while (i < useRow.ids.length && idx === -1) {
                                                    if (useRow.ids[i].id === newRowPK) {
                                                        idx = i;
                                                    }
                                                    i++;
                                                }



                                                if (idx !== -1) {

                                                    if (kk === 0) { // deleting
                                                        useRow.ids[idx].i = useRow.ids[idx].i.filter((pos) => {
                                                            return mergedTokens[word].indexOf(pos) === -1;
                                                        });
                                                    } else { // adding
                                                        useRow.ids[idx].i = useRow.ids[idx].i.concat(mergedTokens[word]);
                                                    }

                                                    // remove row from index data if it has no index values left
                                                    if (!useRow.ids[idx].i.length) {
                                                        useRow.ids.splice(idx, 1);
                                                    }

                                                    // no row values left for this token
                                                    if (!useRow.ids.length) {
                                                        filters.delete(indexTable, word, () => {
                                                            delete indexLocks[tableId][word];
                                                            nextToken();
                                                        }, (err) => {
                                                            delete indexLocks[tableId][word];
                                                            errToken(err);
                                                        })
                                                    } else {
                                                        filters.write(indexTable, word, useRow, () => {
                                                            delete indexLocks[tableId][word];
                                                            nextToken();
                                                        }, (err) => {
                                                            delete indexLocks[tableId][word];
                                                            errToken(err);
                                                        })
                                                    }


                                                } else {

                                                    if (kk === 1) { // adding
                                                        useRow.ids.push({
                                                            id: newRowPK,
                                                            i: mergedTokens[word]
                                                        });
                                                        filters.write(indexTable, word, useRow, () => {
                                                            delete indexLocks[tableId][word];
                                                            nextToken();
                                                        }, (err) => {
                                                            delete indexLocks[tableId][word];
                                                            errToken(err);
                                                        });
                                                    } else { // deleting
                                                        delete indexLocks[tableId][word];
                                                        nextToken();
                                                    }
                                                }
                                            }, (err) => {
                                                delete indexLocks[tableId][word];
                                                errToken(err);
                                            });
                                        };

                                        const checkTokenLock = () => {
                                            if (indexLocks[tableId][word]) {
                                                setTimeout(() => {
                                                    checkTokenLock();
                                                }, 2);
                                            } else {
                                                indexLocks[tableId][word] = true;
                                                writeToken();
                                            }
                                        }
                                        checkTokenLock();

                                    }).then(next).catch(err);

                                }).then(() => {
                                    // write new cache data
                                    filters.write(indexTableNameWords, newRowPK, {
                                        id: newRowPK,
                                        hash: phraseHash,
                                        tokens: tokenArray
                                    }, next, err);
                                })

                            }, err);

                        }).then(() => {
                            complete(inputArgs);
                        }).catch(cancel);
                    }
                }
            },
            {
                name: "deleteRow",
                priority: 1000,
                call: (inputArgs: deleteRowFilter, complete: (args: deleteRowFilter) => void, cancel: (info: any) => void) => {

                    const tableId = nSQL.getDB(inputArgs.query.databaseID)._tableIds[inputArgs.query.table as string];
                    const pkPath = nSQL.getDB(inputArgs.query.databaseID)._tables[inputArgs.query.table as string].pkCol;

                    if (!searchIndexes[tableId] || !searchIndexes[tableId].length) { // no indexes for this table
                        complete(inputArgs);
                    } else { // delete row data
                        rmRowFromFuzzy(inputArgs.res, pkPath, inputArgs.query.databaseID as string, nSQL, inputArgs.query, tableId, (err) => {
                            if (err) {
                                cancel(err);
                            } else {
                                complete(inputArgs);
                            }
                        })
                    }
                }
            },
            {
                name: "customQuery",
                priority: 1000,
                call: (inputArgs: customQueryFilter, complete: (args: customQueryFilter) => void, cancel: (info: any) => void) => {
                    if (String(inputArgs.query.action).trim().toLowerCase() === "rebuild search") { // capture rebuild search

                        const table = inputArgs.query.table;
                        if (typeof table !== "string") {
                            inputArgs.error("Can't rebuild search on this table type!");
                        } else {
                            const tableId = nSQL.getDB(inputArgs.query.databaseID)._tableIds[inputArgs.query.table as string];
                            const pkPath = nSQL.getDB(inputArgs.query.databaseID)._tables[inputArgs.query.table as string].pkCol;
                            if (!searchIndexes[tableId] || !searchIndexes[tableId].length) { // no indexes for this table
                                inputArgs.complete();
                            } else { // rebuild indexes

                                if (inputArgs.query.where) { // rebuild specific indexes
                                    const rebuildQ = new _nanoSQLQueue((item, i, done, error) => {
                                        rmRowFromFuzzy(item, pkPath, inputArgs.query.databaseID as string, nSQL, inputArgs.query, tableId, (err) => {
                                            if (err) {
                                                error(err);
                                            } else {
                                                addRowToFuzzy(item, tableId, pkPath, nSQL, inputArgs.query, (err2) => {
                                                    if (err2) {
                                                        error(err2);
                                                    } else {
                                                        done();
                                                    }
                                                });
                                            }
                                        })
                                    }, inputArgs.error, () => {
                                        inputArgs.complete();
                                    })
                                    nSQL.triggerQuery(inputArgs.query.databaseID, {
                                        ...buildQuery(inputArgs.query.databaseID, nSQL, inputArgs.query.table, "select"),
                                        where: inputArgs.query.where
                                    }, (row) => {
                                        if (row) {
                                            rebuildQ.newItem(row);
                                        }
                                    }, () => {
                                        rebuildQ.finished();
                                    }, inputArgs.error);


                                } else { // rebuild all indexes

                                    // do rebuild
                                    allAsync(searchIndexes[tableId], (item: IFuzzyIndex, i, next, err) => {
                                        // remove all existing index data
                                        const indexTableName = "_" + tableId + "_fuzzy_" + item.path.join(".");
                                        const indexTableNameWords = "_" + tableId + "_fuzzy_words_" + item.path.join(".");
                                        nSQL.triggerQuery(inputArgs.query.databaseID, {
                                            ...buildQuery(inputArgs.query.databaseID, nSQL, indexTableName, "delete")
                                        }, noop, () => {
                                            nSQL.triggerQuery(inputArgs.query.databaseID, {
                                                ...buildQuery(inputArgs.query.databaseID, nSQL, indexTableNameWords, "delete")
                                            }, noop, () => {
                                                // index data removed
                                                next();
                                            }, err);
                                        }, err);
                                    }).then(() => {
                                        // build new index data for every row
                                        return new Promise((res, rej) => {
                                            // add to index
                                            const queue = new _nanoSQLQueue((newRow, i, done, err) => {
                                                addRowToFuzzy(newRow, tableId, pkPath, nSQL, inputArgs.query, (error) => {
                                                    if (error) {
                                                        err(error);
                                                    } else {
                                                        inputArgs.onRow(newRow, i);
                                                    }
                                                    done();
                                                });
                                            }, rej, res);

                                            // select all rows
                                            nSQL.triggerQuery(inputArgs.query.databaseID, {
                                                ...buildQuery(inputArgs.query.databaseID, nSQL, inputArgs.query.table, "select")
                                            }, (row) => {
                                                queue.newItem(row);
                                            }, () => {
                                                queue.finished();
                                            }, rej);
                                        })
                                    }).then(() => {
                                        inputArgs.complete();
                                    }).catch(inputArgs.error);
                                }



                            }
                        }
                    } else { // pass through everything else
                        complete(inputArgs);
                    }
                }
            }
        ]
    }
}

/*
import { nSQL as nanoSQL } from "@nano-sql/core";

nanoSQL().connect({
    plugins: [
        FuzzySearch()
    ]
}).then(() => {
    return nanoSQL().query("create table", {
        name: "testing",
        model: {
            "id:int": { pk: true, ai: true },
            "name:string": {},
            "phrase:string": {}
        },
        indexes: {
            "name": {search: true},
            "phrase": { search: true }
        }
    }).exec();
}).then(() => {
    console.log("CONNECTED");
    return nanoSQL("testing").query("upsert", { name: "bill", phrase: "hello there billy" }).exec();
}).then(() => {
    return nanoSQL("testing").query("upsert", { name: "ted", phrase: "hello there" }).exec();
}).then(() => {
    return nanoSQL("testing").query("upsert", { name: "rufus", phrase: "I am running" }).exec();
}).then((result) => {
    return nanoSQL("testing").query("select").where(["SEARCH(*, 'hello there billy')", ">=", 0]).exec();
}).then((result) => {
    console.log(result);
}).catch((err) => {
    console.error(err);
})*/