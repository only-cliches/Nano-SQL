import { fastID, mutateRowTypes, adapterFilters, hash, resolvePath, objectsEqual, assign, maybeDate, execFunction, deepGet, chainAsync, _nanoSQLQueue, allAsync, deepSet, maybeAssign, random16Bits } from "./utilities";
import { InanoSQLQuery, IWhereType, IWhereArgs, InanoSQLSortBy, ISelectArgs, InanoSQLInstance, IWhereCondition, InanoSQLIndex, InanoSQLTableColumn, InanoSQLDBConfig, _nanoSQLPreparedQuery, TableQueryResult, InanoSQLupdateIndex, updateIndexFilter, InanoSQLTable, deleteRowFilter, deleteRowEventFilter, addRowFilter, InanoSQLQueryExec, InanoSQLDatabaseEvent, addRowEventFilter, updateRowFilter, updateRowEventFilter } from "./interfaces";


const globalTableCache: {
    [cacheID: string]: {
        [table: string]: {
            loading: boolean;
            cache: boolean;
            rows: any[];
        }
    }
} = {};

export const prepareQuery = (nSQL: InanoSQLInstance, query: InanoSQLQuery): _nanoSQLPreparedQuery => {

    const orderBy = _parseSort(nSQL, query, query.orderBy || [], typeof query.table === "string");
    const groupBy = _parseSort(nSQL, query, query.groupBy || [], false);
    const whereArgs = query.where ? _parseWhere(nSQL, nSQL.getDB(query.databaseID), query, query.where, typeof query.table !== "string" || typeof query.union !== "undefined") : {args: { type: IWhereType.none }, indexes: []};
    const havingArgs = query.having ? _parseWhere(nSQL, nSQL.getDB(query.databaseID), query, query.having, true) : {args: { type: IWhereType.none }, indexes: []};

    let selectArgs: ISelectArgs[] = [];
    let hasFn = false;
    let hasAggrFn = false;
    let indexOrderBy: boolean = false;
    let stream = true;
    let pkOrderBy = false;
    let idxOrderBy = false;

    if (String(query.action).trim().toLowerCase() === "select" && query.actionArgs && query.actionArgs.length) {
        (query.actionArgs || []).forEach((val: string) => {
            const splitVal = val.split(/\s+as\s+/i).map(s => s.trim());
            if (splitVal[0].indexOf("(") !== -1) {
                const fnName = splitVal[0].split("(")[0].trim().toUpperCase();
                selectArgs.push({ isFn: true, value: splitVal[0], as: splitVal[1], args: undefined });
                if (!nSQL.functions[fnName]) {
                    query.state = "error";
                    query.error = `Function "${fnName}" not found!`;
                } else {
                    hasFn = true;
                    if (nSQL.functions[fnName].type === "A") {
                        hasAggrFn = true;
                    }
                }
            } else {
                selectArgs.push({ isFn: false, value: splitVal[0], as: splitVal[1] });
            }
        });
    }


    pkOrderBy = orderBy.sort.length > 0 ? orderBy.index === "_pk_" : true;
    indexOrderBy = !pkOrderBy && orderBy.sort.length === 1 && orderBy.index ? true : false;

    if ((!pkOrderBy && !indexOrderBy)) {
        stream = false;
    }

    const superFastQuery = stream && !query.join && !query.distinct && !query.graph && !query.actionArgs && !query.groupBy;

    let queryType: 1 | 2 | 3 = 3;
    if (stream) {
        queryType = 2;
    } else if (superFastQuery) {
        queryType = 1;
    }

    return {
        query: query,
        selectType: queryType,
        whereArgs: whereArgs.args,
        havingArgs: havingArgs.args,
        orderBy: orderBy,
        groupBy: groupBy,
        pkOrderBy: pkOrderBy,
        idxOrderBy: idxOrderBy,
        hasFn: hasFn,
        hasAggrFn: hasAggrFn,
        selectArgs: selectArgs,
        indexes: whereArgs.indexes
    }
}

export const _newRow = (nSQL: InanoSQLInstance, query: InanoSQLQuery, indexesUsed: string[], upsertPath: string[], newRow: any, complete: (row: any) => void, error: (err: any) => void) => {

    const filter = nSQL.getDB(query.databaseID)._tables[query.table as string].filter;

    if (filter) {
        newRow = filter(newRow);
    }

    nSQL.doFilter<addRowFilter>(query.databaseID, "addRow", { res: newRow, query: query }, (rowToAdd) => {
        const table = nSQL.getDB(query.databaseID)._tables[query.table as string];

        rowToAdd.res = nSQL.default(query.databaseID, maybeAssign(upsertPath && upsertPath.length ? deepSet(upsertPath, {}, rowToAdd.res) : rowToAdd.res), query.table as string);

        const rowPK = deepGet(table.pkCol, rowToAdd.res);

        const indexValues = _getIndexValues(nSQL, nSQL.getDB(query.databaseID)._tables[query.table as any].indexes, rowToAdd.res);

        _checkUniqueIndexes(nSQL, query, rowPK, rowToAdd.res, indexValues, () => {

            adapterFilters(query.databaseID, nSQL, query).write(query.table as string, rowPK, rowToAdd.res, (pk) => {
                deepSet(table.pkCol, rowToAdd.res, pk)

                allAsync(Object.keys(indexValues), (indexName: string, i, next, err) => {
                    if (table.indexes[indexName].isArray) {
                        const arrayOfValues = indexValues[indexName] || [];
                        allAsync(arrayOfValues, (value, i, nextArr) => {
                            _updateIndex(nSQL, query, query.table as string, indexName, value, rowPK, true, () => {
                                nextArr(null);
                            }, err);
                        }).then(() => {
                            next(null);
                        }).catch(err);
                    } else {
                        _updateIndex(nSQL, query, query.table as string, indexName, indexValues[indexName], rowPK, true, () => {
                            next(null);
                        }, err);
                    }
                }).then(() => {

                    const changeEvent: InanoSQLDatabaseEvent = {
                        target: query.table as string,
                        path: "*",
                        events: ["upsert", "change", "*"],
                        time: Date.now(),
                        // performance: Date.now() - _startTime,
                        result: rowToAdd.res,
                        oldRow: undefined,
                        query: query,
                        indexes: indexesUsed
                    };

                    nSQL.doFilter<addRowEventFilter>(query.databaseID, "addRowEvent", { res: changeEvent, query: query }, (event) => {
                        if (typeof query.table === "string") {
                            nSQL.triggerEvent(query.databaseID, event.res);
                        }
                        // _startTime = Date.now();
                        nSQL.getDB(query.databaseID)._tables[query.table as string].count++;
                        complete(query.returnEvent ? event.res : rowToAdd.res);
                    }, error);
                });
            }, error);
        }, error);
    }, error);
}

export const _updateRow = (nSQL: InanoSQLInstance, query: InanoSQLQuery, indexesUsed: string[], upsertPath: string[], newData: any, oldRow: any, complete: (row: any) => void, error: (err: any) => void) => {
    nSQL.doFilter<updateRowFilter>(query.databaseID, "updateRow", { res: newData, row: oldRow, query: query }, (upsertData) => {

        let finalRow = nSQL.default(query.databaseID, upsertPath && upsertPath.length ? deepSet(upsertPath, maybeAssign(oldRow), upsertData.res) : {
            ...oldRow,
            ...upsertData.res
        }, query.table as string);

        const filter = nSQL.getDB(query.databaseID)._tables[query.table as string].filter;

        if (filter) {
            finalRow = filter(finalRow);
        }

        const cols = nSQL.getDB(query.databaseID)._tables[query.table as string].columns;
        let k = cols.length;
        while(k--) {
            if (cols[k].immutable) {
                delete finalRow[cols[k].key];
            }
        }

        if (query.updateImmutable) {
            finalRow = {
                ...finalRow,
                ...query.updateImmutable
            }
        }

        _diffUpdates(nSQL, query, oldRow, finalRow, () => {

            const changeEvent: InanoSQLDatabaseEvent = {
                target: query.table as string,
                path: "*",
                events: ["upsert", "change", "*"],
                time: Date.now(),
                // performance: Date.now() - _startTime,
                result: finalRow,
                oldRow: oldRow,
                query: query,
                indexes: indexesUsed
            };

            nSQL.doFilter<updateRowEventFilter>(query.databaseID, "updateRowEvent", { res: changeEvent, query: query }, (event) => {
                if (typeof query.table === "string") {
                    nSQL.triggerEvent(query.databaseID, event.res);

                    if (nSQL.events[query.databaseID || ""][query.table as string]) {
                        Object.keys(nSQL.events[query.databaseID || ""][query.table as string]).forEach((path) => {
                            if (path !== "*") {
                                if (!objectsEqual(deepGet(path, oldRow), deepGet(path, finalRow))) {
                                    nSQL.triggerEvent(query.databaseID, {
                                        target: query.table as string,
                                        path: path,
                                        events: ["upsert", "change", "*"],
                                        time: Date.now(),
                                        // performance: Date.now() - _startTime,
                                        result: finalRow,
                                        oldRow: oldRow,
                                        query: query,
                                        indexes: indexesUsed
                                    }, true);
                                }
                            }
                        });
                    }
                    // _startTime = Date.now();
                }
                complete(query.returnEvent ? event.res : finalRow);
            }, error);
        }, error);
    }, error);
}

export const _removeRowAndIndexes = (nSQL: InanoSQLInstance, query: InanoSQLQuery, indexesUsed: string[], table: InanoSQLTable, row: any, complete: (rowOrEv: any) => void, error: (err: any) => void) => {

    const indexValues = _getIndexValues(nSQL, table.indexes, row);

    nSQL.doFilter<deleteRowFilter>(query.databaseID, "deleteRow", { res: row, query: query }, (delRow) => {

        allAsync(Object.keys(indexValues).concat(["__del__"]), (indexName: string, i, next) => {
            if (indexName === "__del__") { // main row
                adapterFilters(query.databaseID, nSQL, query).delete(query.table as string, deepGet(table.pkCol, delRow.res), () => {
                    next(null);
                }, (err) => {
                    query.state = "error";
                    error(err);
                });
            } else { // secondary indexes
                if (table.indexes[indexName].isArray) {
                    const arrayOfValues = indexValues[indexName] || [];
                    allAsync(arrayOfValues, (value, i, nextArr) => {
                        _updateIndex(nSQL, query, query.table as string, indexName, value, deepGet(table.pkCol, delRow.res), false, () => {
                            nextArr(null);
                        }, error);
                    }).then(next);
                } else {
                    _updateIndex(nSQL, query, query.table as string, indexName, indexValues[indexName], deepGet(table.pkCol, delRow.res), false, () => {
                        next(null);
                    }, error);
                }
            }
        }).then(() => {
            const delEvent = {
                target: query.table as string,
                path: "_all_",
                events: ["change", "delete", "*"],
                time: Date.now(),
                // performance: Date.now() - _startTime,
                result: delRow.res,
                query: query,
                indexes: indexesUsed
            };
            nSQL.doFilter<deleteRowEventFilter>(query.databaseID, "deleteRowEvent", { res: delEvent, query: query }, (event) => {
                if (typeof query.table === "string") {
                    nSQL.triggerEvent(query.databaseID, event.res);
                }
                // _startTime = Date.now();
                complete(query.returnEvent ? event.res : delRow.res);
            }, error);

        }).catch(error);
    }, error);
};

export const _parseWhere = (nSQL: InanoSQLInstance, database: InanoSQLDBConfig, query: InanoSQLQuery, qWhere: any[] | ((row: { [key: string]: any }) => boolean), ignoreIndexes?: boolean): {args: IWhereArgs, indexes: string[]} => {
    const where = qWhere || [];
    /*
    const key = (JSON.stringify(where, (key, value) => {
        return value && value.constructor && value.constructor.name === "RegExp" ? value.toString() : value;
    }) + (ignoreIndexes ? "0" : "1")) + (typeof query.table === "string" ? database.state.cacheId : "");

    if (_whereMemoized[key]) {
        return _whereMemoized[key];
    }

    if (typeof where === "function") {
        return {args: { type: IWhereType.fn, whereFn: where }, indexes: []};
    } else if (!where.length) {
        _whereMemoized[key] = {args: { type: IWhereType.none }, indexes: []};
        return _whereMemoized[key];
    }*/

    if (typeof where === "function") {
        return {args: { type: IWhereType.fn, whereFn: where }, indexes: []};
    } else if (!where.length) {
        return {args: { type: IWhereType.none }, indexes: []}
    }


    const indexes: InanoSQLIndex[] = typeof query.table === "string" ? Object.keys(database._tables[query.table].indexes).map(k => database._tables[query.table as string].indexes[k]) : [];
    const pkKey: string[] = typeof query.table === "string" ? database._tables[query.table].pkCol : [];
    const pkType: string = typeof query.table === "string" ? database._tables[query.table].pkType : "";
    let _indexesUsed: string[] = [];

    // find indexes and functions
    const recursiveParse = (ww: any[], level: number): IWhereCondition[] => {

        const doIndex = !ignoreIndexes && level === 0;

        return ww.reduce((p: IWhereCondition[], w, i) => {
            if (i % 2 === 1) { // AND or OR
                if (typeof w !== "string") {
                    throw new Error("Malformed WHERE statement!");
                }
                p.push({
                    ANDOR: w,
                    comp: "",
                    value: ""
                });
                return p;
            } else { // where conditions

                if (!Array.isArray(w)) {
                    throw new Error("Malformed WHERE statement!");
                }
                if (Array.isArray(w[0])) { // nested array
                    p.push(recursiveParse(w, level + 1) as any);
                } else if (w[0].indexOf("(") !== -1) { // function

                    const fnArgs: string[] = w[0].split("(")[1].replace(")", "").split(",").map(v => v.trim()).filter(a => a);
                    const fnName: string = w[0].split("(")[0].trim().toUpperCase();
                    let hasIndex = false;
                    if (!nSQL.functions[fnName]) {
                        throw new Error(`Function "${fnName}" not found!`);
                    }

                    if (doIndex && nSQL.functions[fnName] && nSQL.functions[fnName].checkIndex) {
                        const indexFn = (nSQL.functions[fnName].checkIndex as any)(query, fnArgs, w);

                        if (indexFn) {
                            _indexesUsed.push(assign(w));
                            hasIndex = true;
                            p.push(indexFn);
                        }
                    }

                    if (!hasIndex) {
                        p.push({
                            fnString: w[0],
                            parsedFn: { name: fnName, args: fnArgs },
                            comp: w[1],
                            value: w[2]
                        });
                    }

                } else { // column select

                    let isIndexCol = false;
                    const path = doIndex ? resolvePath(w[0]) : [];

                    // convert date strings to date numbers
                    // w[2] = Array.isArray(w[2]) ? w[2].map(w => maybeDate(w)) : maybeDate(w[2]);

                    if (["=", "BETWEEN", "IN", "LIKE"].indexOf(w[1]) !== -1 && doIndex) {

                        if (w[1] === "LIKE" && !w[2].match(/.*\%$/gmi)) {
                            // using LIKE but wrong format for fast query
                        } else {
                            // primary key select
                            if (objectsEqual(path, pkKey)) {
                                if (w[1] === "LIKE" && pkType !== "string") {

                                } else {
                                    // pk queries don't work with BETWEEN when using date type
                                    isIndexCol = true;
                                    _indexesUsed.push(assign(w));
                                    p.push({
                                        index: "_pk_",
                                        col: w[0],
                                        comp: w[1],
                                        value: w[2],
                                        type: pkType
                                    });
                                }
                            } else { // check if we can use any secondary index
                                indexes.forEach((index) => {
                                    if (w[1] === "LIKE" && index.type !== "string") {

                                    } else {
                                        if (isIndexCol === false && objectsEqual(index.path, path) && index.isArray === false && w[2] !== "NOT NULL") {
                                            isIndexCol = true;
                                            _indexesUsed.push(assign(w));
                                            p.push({
                                                index: index.id,
                                                col: w[0],
                                                comp: w[1],
                                                value: w[2],
                                                type: database._tables[query.table as string].indexes[index.id].type
                                            });
                                        }
                                    }
                                });
                            }
                        }
                    }

                    if (doIndex && !isIndexCol && ["INCLUDES", "INTERSECT", "INTERSECT ALL", "INCLUDES LIKE"].indexOf(w[1]) !== -1) {
                        indexes.forEach((index) => {
                            if (objectsEqual(index.path, path) && index.isArray === true) {
                                if (w[1] === "INCLUDES LIKE" && index.type !== "string") {

                                } else {
                                    isIndexCol = true;
                                    _indexesUsed.push(assign(w));
                                    p.push({
                                        index: index.id,
                                        indexArray: true,
                                        col: w[0],
                                        comp: w[1],
                                        value: w[2],
                                        type: database._tables[query.table as string].indexes[index.id].type
                                    });
                                }
                            }
                        });
                    }

                    const findColumnType = (columns: InanoSQLTableColumn[], path: string[]): string => {
                        const getType = (pathIdx: number, cols: InanoSQLTableColumn[]) => {
                            const colData = cols.filter(c => c.key === path[pathIdx])[0];

                            if (!colData) return "";

                            if (!path[pathIdx + 1]) return colData.type;

                            if (!colData.model) return "";

                            return getType(pathIdx + 1, colData.model);
                        };
                        return getType(0, columns);
                    }

                    const type = typeof query.table === "string" ? findColumnType(database._tables[query.table].columns, resolvePath(w[0])) : "";

                    if (!isIndexCol) {
                        p.push({
                            col: w[0],
                            comp: w[1],
                            value: type === "date" ? (Array.isArray(w[2]) ? w[2].map(s => maybeDate(s)) : maybeDate(w[2])) : w[2],
                            type: type
                        });
                    }
                }
                return p;
            }
        }, [] as any[]);
    };
    let parsedWhere = recursiveParse(typeof where[0] === "string" ? [where] : where, 0);
    // discover where we have indexes we can use
    // the rest is a full table scan OR a scan of the index results
    // fastWhere = index query, slowWhere = row by row/full table scan
    let isIndex = true;
    let count = 0;
    let lastFastIndx = -1;
    while (count < parsedWhere.length && isIndex) {
        if (count % 2 === 1) {
            if (parsedWhere[count].ANDOR !== "AND") {
                isIndex = false;
            } else {
                lastFastIndx = count;
            }
        } else {
            if (Array.isArray((parsedWhere[count] as any)) || !(parsedWhere[count] as any).index) {
                isIndex = false;
            } else {
                lastFastIndx = count;
            }
        }
        count++;
    }

    // make sure lastFastIndx lands on an AND, OR or gets pushed off the end.
    if (lastFastIndx % 2 === 0) {
        lastFastIndx++;
    }
    // has at least some index values
    // "AND" or the end of the WHERE should follow the last index to use the indexes
    if (lastFastIndx !== -1 && (parsedWhere[lastFastIndx].ANDOR === "AND" || !parsedWhere[lastFastIndx])) {
        const slowWhere = parsedWhere.slice(lastFastIndx + 1);
        return {
            args: {
                type: slowWhere.length ? IWhereType.medium : IWhereType.fast,
                slowWhere: slowWhere,
                fastWhere: parsedWhere.slice(0, lastFastIndx),
                indexesUsed: _indexesUsed
            },
            indexes: _indexesUsed
        };
    } else {
        return {
            args: {
                type: IWhereType.slow,
                slowWhere: parsedWhere,
                indexesUsed: _indexesUsed
            },
            indexes: _indexesUsed
        };
    }
}

export const _getIndexValues = (nSQL: InanoSQLInstance, indexes: { [id: string]: InanoSQLIndex }, row: any): { [indexName: string]: any } => {

    return Object.keys(indexes).reduce((prev, cur) => {
        const value = deepGet(indexes[cur].path, row);
        const type = indexes[cur].isDate ? "string" : indexes[cur].type;
        prev[cur] = indexes[cur].isArray ? (Array.isArray(value) ? value : []).map(v => nSQL.indexTypes[type](v)) : nSQL.indexTypes[type](value);
        return prev;
    }, {});
}

export const _checkUniqueIndexes = (nSQL: InanoSQLInstance,  query: InanoSQLQuery, pk: any, oldRow: any, newIndexValues: { [index: string]: any }, done: () => void, error: (err: any) => void) => {
    allAsync(Object.keys(newIndexValues), (index, i, next, err) => {
        const indexProps = nSQL.getDB(query.databaseID)._tables[query.table as any].indexes[index].props || {};
        if (indexProps && indexProps.unique) { // check for unique
            let indexPKs: any[] = [];
            adapterFilters(query.databaseID, nSQL, query).readIndexKey(query.table as string, index, newIndexValues[index], (rowPK) => {
                if (rowPK !== pk) indexPKs.push(rowPK);
            }, () => {
                if (indexPKs.length > 0) {
                    err({ error: "Unique Index Collision!", row: oldRow, query: query });
                } else {
                    next(null);
                }
            }, err);
        } else { // no need to check for unique
            next(null);
        }
    }).then(done).catch(error);
}

export const _diffUpdates = (nSQL: InanoSQLInstance,  query: InanoSQLQuery, oldRow: any, finalRow: any, done: () => void, error: (err: any) => void) => {
    const newIndexValues = _getIndexValues(nSQL, nSQL.getDB(query.databaseID)._tables[query.table as any].indexes, finalRow);
    const oldIndexValues = _getIndexValues(nSQL, nSQL.getDB(query.databaseID)._tables[query.table as any].indexes, oldRow);
    const table = nSQL.getDB(query.databaseID)._tables[query.table as string];

    _checkUniqueIndexes(nSQL, query, deepGet(table.pkCol, oldRow), oldRow, newIndexValues, () => {

        allAsync(Object.keys(oldIndexValues).concat(["__pk__"]), (indexName: string, i, next, err) => {
            if (indexName === "__pk__") { // main row
                adapterFilters(query.databaseID, nSQL, query).write(query.table as string, deepGet(table.pkCol, finalRow), finalRow, (pk) => {
                    deepSet(table.pkCol, finalRow, pk);
                    next(null);
                }, err);
            } else { // indexes
                const tableName = query.table as string;
                if (objectsEqual(newIndexValues[indexName], oldIndexValues[indexName]) === false) { // only update changed index values

                    if (table.indexes[indexName].isArray) {
                        let addValues: any[] = newIndexValues[indexName].filter((v, i, s) => oldIndexValues[indexName].indexOf(v) === -1);
                        let removeValues: any[] = oldIndexValues[indexName].filter((v, i, s) => newIndexValues[indexName].indexOf(v) === -1);
                        allAsync([addValues, removeValues], (arrayOfValues, j, nextValues) => {
                            if (!arrayOfValues.length) {
                                nextValues(null);
                                return;
                            }
                            allAsync(arrayOfValues, (value, i, nextArr) => {
                                _updateIndex(nSQL, query, tableName, indexName, value, deepGet(table.pkCol, finalRow), j === 0, () => {
                                    nextArr(null);
                                }, err);
                            }).then(nextValues);
                        }).then(next);
                    } else {
                        chainAsync(["rm", "add"], (job, i, nextJob) => {
                            switch (job) {
                                case "add": // add new index value
                                    _updateIndex(nSQL, query, tableName, indexName, newIndexValues[indexName], deepGet(table.pkCol, finalRow), true, () => {
                                        nextJob(null);
                                    }, err);
                                    break;
                                case "rm": // remove old index value
                                    _updateIndex(nSQL, query, tableName, indexName, oldIndexValues[indexName], deepGet(table.pkCol, finalRow), false, () => {
                                        nextJob(null);
                                    }, err);
                                    break;
                            }
                        }).then(next);
                    }
                } else {
                    next(null);
                }
            }
        }).then(done).catch(error);
    }, error);
}

const _indexLocks: {
    [lockID: string]: {
        [indexValue: string]: boolean;
    }
} = {};

export const _updateIndex = (nSQL: InanoSQLInstance, query: InanoSQLQuery, table: string, indexName: string, value: any, pk: any, addToIndex: boolean, done: () => void, err: (error) => void) => {
    const lockID = query.databaseID + table + indexName;
    if (!_indexLocks[lockID]) {
        _indexLocks[lockID] = {};
    }

    // the number zero is the only falsey value you can index
    if (!value && value !== 0) {
        done();
        return;
    }

    // 0 length strings cannot be indexed
    if (String(value).length === 0) {
        done();
        return;
    }

    const newItem: InanoSQLupdateIndex = { table, indexName, value, pk, addToIndex, done, err, query: query, nSQL: nSQL };

    nSQL.doFilter<updateIndexFilter>(query.databaseID, "updateIndex", { res: newItem, query: query }, (update) => {
        
        const item = update.res;
            
        const doUpdate = () => {
            if (_indexLocks[lockID][String(item.value)]) {
                setTimeout(doUpdate, 10);
            } else {
                _indexLocks[lockID][String(item.value)] = true;
                const fn = item.addToIndex ? adapterFilters(query.databaseID, item.nSQL, item.query).addIndexValue : adapterFilters(query.databaseID, item.nSQL, item.query).deleteIndexValue;
                fn(item.table, item.indexName, item.pk, item.value, () => {
                    delete _indexLocks[lockID][String(item.value)];
                    item.done();
                    done();
                }, (err) => {
                    delete _indexLocks[lockID][String(item.value)];
                    item.err(err);
                    done();
                });
            }
        }
        doUpdate();

    }, err);
}

export const _where = (query: InanoSQLQuery, singleRow: any, where: (IWhereCondition | string | (IWhereCondition | string)[])[]): boolean => {

    if (where.length > 1) { // compound where statements

        let prevCondition: string = "AND";
        let matches = true;
        let idx = 0;
        while (idx < where.length) {
            const wArg = where[idx];
            if (idx % 2 === 1) {
                prevCondition = wArg as string;
            } else {

                let compareResult = false;

                if (Array.isArray(wArg)) { // nested where
                    compareResult = _where(query, singleRow, wArg as any);
                } else {
                    compareResult = _compare(query, wArg as IWhereCondition, singleRow);
                }

                if (idx === 0) {
                    matches = compareResult;
                } else {
                    if (prevCondition === "AND") {
                        matches = matches && compareResult;
                    } else {
                        matches = matches || compareResult;
                    }
                }
            }
            idx++;
        }
        return matches;

    } else { // single where statement
        return _compare(query, where[0] as IWhereCondition, singleRow);
    }
}

const likeCache: { [likeQuery: string]: RegExp } = {};

export const _processLIKE = (columnValue: string, givenValue: string): boolean => {
    if (!likeCache[givenValue]) {
        let prevChar = "";
        const len = givenValue.split("").length - 1;
        likeCache[givenValue] = new RegExp(givenValue.split("").map((s, i) => {
            if (prevChar === "\\") {
                prevChar = s;
                return s;
            }
            prevChar = s;
            if (s === "%") return ".*";
            if (s === "_") return ".";
            return (i === 0 ? "^" + s : i === len ? s + "$" : s);
        }).join(""), "gmi");
    }
    if (typeof columnValue !== "string") {
        if (typeof columnValue === "number") {
            return String(columnValue).match(likeCache[givenValue]) !== null;
        } else {
            return JSON.stringify(columnValue).match(likeCache[givenValue]) !== null;
        }
    }
    return columnValue.match(likeCache[givenValue]) !== null;
}

export const _getColValue = (query: InanoSQLQuery, where: IWhereCondition, wholeRow: any): any => {
    const value = where.fnString ? execFunction(query, where.fnString, wholeRow, { result: undefined }).result : deepGet(where.col as string, wholeRow);
    return where.type === "date" ? (Array.isArray(value) ? value.map(s => maybeDate(s)) : maybeDate(value)) : value;
}

export const _compare = (query: InanoSQLQuery, where: IWhereCondition, wholeRow: any): boolean => {

    const columnValue = _getColValue(query, where, wholeRow);
    const givenValue = where.value as any;
    const compare = where.comp;

    if (givenValue === "NULL" || givenValue === "NOT NULL") {
        const isNull = [undefined, null, ""].indexOf(columnValue) !== -1;
        const isEqual = compare === "=" || compare === "LIKE";
        switch (givenValue) {
            case "NULL": return isEqual ? isNull : !isNull;
            case "NOT NULL": return isEqual ? !isNull : isNull;
        }
    }

    if (["IN", "NOT IN", "BETWEEN", "INTERSECT", "INTERSECT ALL", "NOT INTERSECT"].indexOf(compare) !== -1) {
        if (!Array.isArray(givenValue)) {
            throw new Error(`WHERE type "${compare}" requires an array value!`);
        }
    }

    switch (compare) {
        // if column equal to given value. Supports arrays, objects and primitives
        case "=": return objectsEqual(givenValue, columnValue);
        // if column not equal to given value. Supports arrays, objects and primitives
        case "!=": return !objectsEqual(givenValue, columnValue);
        // if column greather than given value
        case ">": return columnValue > givenValue;
        // if column less than given value
        case "<": return columnValue < givenValue;
        // if column less than or equal to given value
        case "<=": return columnValue <= givenValue;
        // if column greater than or equal to given value
        case ">=": return columnValue >= givenValue;
        // if column value exists in given array
        case "IN": return givenValue.indexOf(columnValue) !== -1;
        // if column does not exist in given array
        case "NOT IN": return givenValue.indexOf(columnValue) === -1;
        // regexp search the column
        case "REGEXP":
        case "REGEX": return (columnValue || "").match(givenValue) !== null;
        // if given value exists in column value
        case "LIKE": return _processLIKE((columnValue || ""), givenValue);
        // if given value does not exist in column value
        case "NOT LIKE": return !_processLIKE((columnValue || ""), givenValue);
        // if the column value is between two given numbers
        case "BETWEEN": return givenValue[0] <= columnValue && givenValue[1] >= columnValue;
        // if the column value is not between two given numbers
        case "NOT BETWEEN": return givenValue[0] >= columnValue || givenValue[1] <= columnValue;
        // if single value exists in array column
        case "INCLUDES": return (columnValue || []).indexOf(givenValue) !== -1;
        // if LIKE value exists in array column
        case "INCLUDES LIKE": return (columnValue || []).filter(v => _processLIKE(v, givenValue)).length > 0;
        // if single value does not exist in array column
        case "NOT INCLUDES": return (columnValue || []).indexOf(givenValue) === -1;
        // if array of values intersects with array column
        case "INTERSECT": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length > 0;
        // if every value in the provided array exists in the array column
        case "INTERSECT ALL": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length === givenValue.length;
        // if array of values does not intersect with array column
        case "NOT INTERSECT": return (columnValue || []).filter(l => givenValue.indexOf(l) > -1).length === 0;
        default: return false;
    }
}

export const _parseSort = (nSQL: InanoSQLInstance, query: InanoSQLQuery, sort: string[], checkforIndexes: boolean): InanoSQLSortBy => {

    let isThereFn = false;
    const result: { path: string[], dir: string }[] = sort.map(o => o.split(" ").map(s => s.trim())).reduce((p, c) => {
        const hasFn = c[0].indexOf("(") !== -1;
        if (hasFn) {
            isThereFn = true;
        }
        p.push({
            path: hasFn ? [] : resolvePath(c[0]),
            fn: hasFn ? c[0] : undefined,
            dir: (c[1] || "asc").toUpperCase()
        });
        return p;
    }, [] as any[]);

    let index = "";
    if (checkforIndexes && isThereFn === false && result.length === 1) {
        const pkKey: string[] = typeof query.table === "string" ? nSQL.getDB(query.databaseID)._tables[query.table].pkCol : [];
        if (result[0].path[0].length && objectsEqual(result[0].path, pkKey)) {
            index = "_pk_";
        } else {
            const indexKeys = Object.keys(nSQL.getDB(query.databaseID)._tables[query.table as string].indexes);
            let i = indexKeys.length;
            while (i-- && !index) {
                if (objectsEqual(nSQL.getDB(query.databaseID)._tables[query.table as string].indexes[indexKeys[i]], result[0].path)) {
                    index = nSQL.getDB(query.databaseID)._tables[query.table as string].indexes[indexKeys[i]].id;
                }
            }
        }
    }
    return {
        sort: result,
        index: index
    }
}

export const _getTable = (query: InanoSQLQuery, tableName: string, whereCond: any[] | ((row: { [key: string]: any; }, i?: number) => boolean) | undefined, table: any, callback: (result: TableQueryResult) => void, error: (err: any) => void) => {
    const cacheID = query.cacheID as string;

    if (typeof table === "function") {
        if (!globalTableCache[cacheID]) {
            globalTableCache[cacheID] = {};
        }

        if (!globalTableCache[cacheID][tableName]) { // first load
            globalTableCache[cacheID][tableName] = { loading: true, rows: [], cache: true };
            table(whereCond).then((result: TableQueryResult) => {
                const doCache = (result.cache && !result.filtered) || false;
                globalTableCache[cacheID][tableName] = { loading: false, rows: doCache ? result.rows : [] as any, cache: doCache };
                callback(result);
            }).catch(error);
            return;
        }
        if (globalTableCache[cacheID][tableName].loading) {
            setTimeout(() => {
                _getTable(query, tableName, whereCond, table, callback, error);
            }, 10);
            return;
        }
        if (globalTableCache[cacheID][tableName].cache) {
            callback({ filtered: false, rows: globalTableCache[cacheID][tableName].rows, cache: true });
            return;
        }
        table(whereCond).then((result: TableQueryResult) => {
            callback(result);
        }).catch(error);
    } else {
        callback({ rows: table, filtered: false, cache: false });
    }
}

export const _resolveFastWhere = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, onlyGetPKs: boolean, fastWhere: IWhereCondition, isReversed: boolean, onRow: (row: any, i: number) => void, complete: () => void, error: (err: any) => void): void => {

    // function
    if (fastWhere.index && fastWhere.parsedFn) {
        (nSQL.functions[fastWhere.parsedFn.name].queryIndex as any)(pQuery.query, fastWhere, onlyGetPKs, onRow, complete, error);
        return;
    }

    // primary key or secondary index
    const isPKquery = fastWhere.index === "_pk_";
    const pkCol = nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].pkCol;
    // const indexTable = `_idx_${nSQL.tableIds[query.table as string]}_${fastWhere.index}`;

    let count = 0;

    const indexBuffer = new _nanoSQLQueue((pkOrRow, i, finished, err) => {
        if (!pkOrRow) {
            finished();
            return;
        }
        if (isPKquery) { // primary key select
            onRow(onlyGetPKs ? deepGet(pkCol, pkOrRow) : pkOrRow, 0);
            finished();
        } else { // secondary index
            if (onlyGetPKs) {
                onRow(pkOrRow, count);
                count++;
                finished();
            } else {
                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).read(pQuery.query.table as string, pkOrRow, (row) => {
                    if (row) {
                        onRow(row, count);
                    }
                    count++;
                    finished();
                }, error);
            }
        }
    }, error, complete);

    if (fastWhere.indexArray) {
        // Primary keys cannot be array indexes

        switch (fastWhere.comp) {
            case "INCLUDES LIKE":
                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKeys(pQuery.query.table as string, fastWhere.index as string, "range", fastWhere.value.replace(/\%/gmi, "") + " ", fastWhere.value.replace(/\%/gmi, "") + "~", isReversed, (pk) => {
                    indexBuffer.newItem(pk);
                }, () => {
                    indexBuffer.finished();
                }, error);
                break;
            case "INCLUDES":
                let pks: any[] = [];
                adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKey(pQuery.query.table as string, fastWhere.index as string, fastWhere.value, (pk) => {
                    indexBuffer.newItem(pk);
                }, () => {
                    indexBuffer.finished();
                }, error);
                break;
            case "INTERSECT ALL":
            case "INTERSECT":
                let PKS: { [key: string]: number } = {};
                let maxI = 0;
                allAsync((fastWhere.value as any || []), (pk, j, next) => {
                    adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKey(pQuery.query.table as string, fastWhere.index as string, pk, (rowPK) => {
                        maxI = j + 1;
                        if (rowPK) {
                            PKS[rowPK] = (PKS[rowPK] || 0) + 1;
                        }
                    }, () => {
                        next(null);
                    }, error);
                }).then(() => {
                    const getPKS = fastWhere.comp === "INTERSECT" ? Object.keys(PKS) : Object.keys(PKS).filter(k => PKS[k] === maxI);
                    getPKS.forEach((pk) => {
                        indexBuffer.newItem(pk);
                    });
                    indexBuffer.finished();
                });
                break;
        }

    } else {

        switch (fastWhere.comp) {
            case "=":
                if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                    onRow(fastWhere.value as any, 0);
                    complete();
                } else {
                    if (isPKquery) {
                        adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).read(pQuery.query.table as string, fastWhere.value, (row) => {
                            indexBuffer.newItem(row);
                            indexBuffer.finished();
                        }, error);
                    } else {
                        adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKey(pQuery.query.table as string, fastWhere.index as string, fastWhere.value, (readPK) => {
                            indexBuffer.newItem(readPK);
                        }, () => {
                            indexBuffer.finished();
                        }, error);
                    }
                }
                break;
            case "LIKE":
                if (isPKquery) {
                    adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readMulti(pQuery.query.table as string, "range", fastWhere.value.replace(/\%/gmi, "") + "0", fastWhere.value.replace(/\%/gmi, "") + "Z", isReversed, (row, i) => {
                        indexBuffer.newItem(row);
                    }, () => {
                        indexBuffer.finished();
                    }, error);
                } else {
                    adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKeys(pQuery.query.table as string, fastWhere.index as string, "range", fastWhere.value.replace(/\%/gmi, "") + " ", fastWhere.value.replace(/\%/gmi, "") + "~", isReversed, (row) => {
                        indexBuffer.newItem(row);
                    }, () => {
                        indexBuffer.finished();
                    }, error);
                }
                break;
            case "BETWEEN":
                if (isPKquery) {
                    adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readMulti(pQuery.query.table as string, "range", fastWhere.value[0], fastWhere.value[1], isReversed, (row, i) => {
                        indexBuffer.newItem(row);
                    }, () => {
                        indexBuffer.finished();
                    }, error);
                } else {
                    adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKeys(pQuery.query.table as string, fastWhere.index as string, "range", fastWhere.value[0], fastWhere.value[1], isReversed, (row) => {
                        indexBuffer.newItem(row);
                    }, () => {
                        indexBuffer.finished();
                    }, error);
                }
                break;
            case "IN":
                const PKS = (isReversed ? (fastWhere.value as any[]).sort((a, b) => a < b ? 1 : -1) : (fastWhere.value as any[]).sort((a, b) => a > b ? 1 : -1));
                if (onlyGetPKs && isPKquery) { // Get only pk of result rows AND it's a primary key query
                    PKS.forEach((pk, i) => onRow(pk, i));
                    complete();
                } else {
                    allAsync(PKS, (pkRead, ii, nextPK) => {
                        if (isPKquery) {
                            adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).read(pQuery.query.table as string, pkRead, (row) => {
                                indexBuffer.newItem(row);
                                nextPK();
                            }, error);
                        } else {
                            adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readIndexKey(pQuery.query.table as string, fastWhere.index as string, pkRead, (readPK) => {
                                indexBuffer.newItem(readPK);
                            }, () => {
                                nextPK();
                            }, error);
                        }
                    }).then(() => {
                        indexBuffer.finished();
                    });
                }

        }
    }
}

/**
 * TODO: handle queries that order by an index
 *
 * @param {InanoSQLInstance} nSQL
 * @param {_nanoSQLPreparedQuery} pQuery
 * @param {(row: { [name: string]: any }, i: number) => void} onRow
 * @param {() => void} complete
 * @param {(err: any) => void} error
 * @returns {boolean}
 */
export const _fastIndexQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void): boolean => {
    return false;
}

export const _fastPKQuery = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void): boolean => {

    if (pQuery.whereArgs.fastWhere) {

        const isReversed = pQuery.pkOrderBy && pQuery.orderBy.sort[0].dir === "DESC";

        if (pQuery.whereArgs.fastWhere.length === 1) { // single where

            const fastWhere = pQuery.whereArgs.fastWhere[0] as IWhereCondition;
            
            _resolveFastWhere(nSQL, pQuery, false, fastWhere, isReversed, (row, i) => {
                onRow(row, i);
            }, complete, error);

            
        } else {  // multiple conditions
            let indexBuffer: { [pk: string]: number } = {};
            let maxI = 0;
            chainAsync(pQuery.whereArgs.fastWhere, (fastWhere, i, next) => {

                if (i % 2 === 1) { // should be AND
                    next();
                    return;
                }

                maxI = i;
                // get just primary keys
                _resolveFastWhere(nSQL, pQuery, true, fastWhere as IWhereCondition, false, (pk) => {
                    indexBuffer[pk] = (indexBuffer[pk] || 0) + 1;
                }, next, error);
            }).then(() => {

                // get keys with number of intersections equal to number of AND where statements
                let getPKs: any[] = [];
                const keys = Object.keys(indexBuffer);
                let k = keys.length;
                while(k--) {
                    const PK = keys[k];
                    if (indexBuffer[PK] === maxI) {
                        getPKs.push(PK);
                    }
                }

                if (pQuery.pkOrderBy) {
                    getPKs = getPKs.sort((a, b) => {
                        if (isReversed) {
                            return a < b ? 1 : -1;
                        } else {
                            return a > b ? 1 : -1;
                        }
                    });
                }

                _resolveFastWhere(nSQL, pQuery, false, {
                    index: "_pk_",
                    col: nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].pkCol.join("."),
                    comp: "IN",
                    value: getPKs,
                    type: nSQL.getDB(pQuery.query.databaseID)._tables[pQuery.query.table as string].pkType
                }, false, onRow, complete, error);
            });
        }
        return pQuery.pkOrderBy;
    } else {
        error("Attempted to call fastquery on query that isn't fast!");
        return false;
    }
}

export const _getQueryRecords = (nSQL: InanoSQLInstance, pQuery: _nanoSQLPreparedQuery, onRow: (row: { [name: string]: any }, i: number) => void, complete: () => void, error: (err: any) => void): {didOrderBy: boolean, didRange: boolean} => {

    let isSorted: boolean = false;
    let didRange: boolean = false;

    const doingFastWhere = pQuery.whereArgs.type === IWhereType.none ? true : pQuery.whereArgs.type === IWhereType.fast;
    // const whereMatches = doingFastWhere ? (pQuery.whereArgs.fastWhere && typeof pQuery.whereArgs.fastWhere !== "string" ? pQuery.whereArgs.fastWhere.index === )
/*
    index?: string;
    indexArray?: boolean;
    fnString?: string;
    parsedFn?: {name: string, args: string[]};
    col?: string;
    comp: string;
    value: any;
    type?: string;
*/
    if (typeof pQuery.query.table === "string") { // pull from local table, possibly use indexes
        
        switch (pQuery.whereArgs.type) {
            // primary key or secondary index select
            case IWhereType.fast:
                isSorted = _fastPKQuery(nSQL, pQuery, (row, i) => {
                    onRow(mutateRowTypes(pQuery.query.databaseID, row, pQuery.query.table as string, nSQL), i);
                }, complete, error);
                break;
            // primary key or secondary index query followed by slow query
            case IWhereType.medium:
                isSorted = _fastPKQuery(nSQL, pQuery, (row, i) => {
                    let ct = 0;
                    if (_where(pQuery.query, row, pQuery.whereArgs.slowWhere as any)) {
                        onRow(mutateRowTypes(pQuery.query.databaseID, row, pQuery.query.table as string, nSQL), ct);
                        ct++;
                    }
                }, complete, error);
                break;
            // full table scan
            case IWhereType.slow:
            case IWhereType.none:
            case IWhereType.fn:
                if (pQuery.query.action === "select" && pQuery.query.databaseID && nSQL.getDB(pQuery.query.databaseID) && nSQL.getDB(pQuery.query.databaseID).config.warnOnSlowQuery) {
                    console.warn("Slow Query: Use secondary indexes or primary keys to perform SELECT.  Avoid full table scans!", pQuery);
                }
                const isReversed = pQuery.pkOrderBy && pQuery.orderBy.sort[0].dir === "DESC";

                const canDoOrderBy = pQuery.query.orderBy ? pQuery.pkOrderBy === true : true;

                // see if we can do fast offset/limit query
                if (canDoOrderBy && pQuery.whereArgs.type === IWhereType.none && pQuery.query.having === undefined && pQuery.query.groupBy === undefined && pQuery.query.limit !== undefined && pQuery.query.offset !== undefined) {
                    adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readMulti(pQuery.query.table, "offset", pQuery.query.offset, pQuery.query.limit, isReversed, (row, i) => {
                        onRow(mutateRowTypes(pQuery.query.databaseID, row, pQuery.query.table as string, nSQL), i);
                    }, () => {
                        complete();
                    }, error);
                    return {didOrderBy: true, didRange: true};
                } else {
                    // full table scan
                    adapterFilters(pQuery.query.databaseID, nSQL, pQuery.query).readMulti(pQuery.query.table, "all", undefined, undefined, isReversed, (row, i) => {

                        if (pQuery.whereArgs.type === IWhereType.slow) {
                            if (_where(pQuery.query, row, pQuery.whereArgs.slowWhere as any)) {
                                onRow(mutateRowTypes(pQuery.query.databaseID, row, pQuery.query.table as string, nSQL), i);
                            }
                        } else if (pQuery.whereArgs.type === IWhereType.fn && pQuery.whereArgs.whereFn) {
                            if (pQuery.whereArgs.whereFn(row, i)) {
                                onRow(mutateRowTypes(pQuery.query.databaseID, row, pQuery.query.table as string, nSQL), i);
                            }
                        } else {
                            onRow(mutateRowTypes(pQuery.query.databaseID, row, pQuery.query.table as string, nSQL), i);
                        }
                    }, () => {
                        complete();
                    }, error);

                    return {didOrderBy: canDoOrderBy, didRange: false};
                }
        }

    } else if (typeof pQuery.query.table === "function") { // promise that returns array
        _getTable(pQuery.query, pQuery.query.tableAS || fastID(), pQuery.query.where, pQuery.query.table, (result) => {
            scanRecords(pQuery, result.rows as any, onRow, complete);
        }, error);
    } else if (Array.isArray(pQuery.query.table)) { // array
        scanRecords(pQuery, pQuery.query.table, onRow, complete);
    } else if (pQuery.query.table) {
        error(`Can't get selected table!`);
    }

    return {didOrderBy: isSorted, didRange: didRange};
}

export const _tableID = () => {
    return [0, 1].map(() => {
        let id = random16Bits().toString(16);
        while (id.length < 4) {
            id = "0" + id
        }
        return id;
    }).join("-");
}

export const scanRecords = (pQuery: _nanoSQLPreparedQuery, rows: any[], onRow: (row: any, i: number) => void, complete: () => void) => {
    let i = 0;

    let k = 0;
    while (i < rows.length) {
        if (pQuery.whereArgs.type !== IWhereType.none) {
            if (pQuery.whereArgs.whereFn) {
                if (pQuery.whereArgs.whereFn(rows[i], i)) {
                    onRow(rows[i], k);
                    k++;
                }
            } else {
                if (_where(pQuery.query, rows[i], pQuery.whereArgs.slowWhere as any)) {
                    onRow(rows[i], k);
                    k++;
                }
            }
        } else {
            onRow(rows[i], k);
            k++;
        }
        i++;
    }

    complete();
};