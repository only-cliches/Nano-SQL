import { NanoSQLInstance, ORMArgs, JoinArgs, _assign, StdObject, DBRow, DBExec } from "./index";
import { Promise, setFast } from "lie-ts";

// tslint:disable-next-line
export class _NanoSQLQuery {

    private _db: NanoSQLInstance;

    public _action: {
        type: string;
        args: any;
    };

    public _modifiers: any[];

    public _table: string;

    public _error: string;

    public _AV: string;

    public _transactionID: number;

    constructor(table: string, db: NanoSQLInstance, actionOrView?: string) {
        this._db = db;
        this._modifiers = [];
        this._table = table;
        this._AV = actionOrView || "";
    }

    public tID(transactionID?: number): _NanoSQLQuery {
        return this._transactionID = transactionID || 0, this;
    }

    /**
     * Used to select specific rows based on a set of conditions.
     * You can pass in a single array with a conditional statement or an array of arrays seperated by "and", "or" for compound selects.
     * A single where statement has the column name on the left, an operator in the middle, then a comparison on the right.
     *
     * Where Examples:
     *
     * ```ts
     * .where(['username','=','billy'])
     * .where(['balance','>',20])
     * .where(['catgory','IN',['jeans','shirts']])
     * .where([['name','=','scott'],'and',['balance','>',200]])
     * .where([['id','>',50],'or',['postIDs','IN',[12,20,30]],'and',['name','LIKE','Billy']])
     * ```
     *
     * @param {(Array<any|Array<any>>)} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public where(args: Array<any | Array<any>>): _NanoSQLQuery {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Where condition requires an array!";
        }
        return this._addCmd("where", args);
    }

    /**
     * Query to get a specific range of rows very efficiently.
     *
     * @param {number} limit
     * @param {number} offset
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    public range(limit: number, offset: number): _NanoSQLQuery {
        return this._addCmd("range", [limit, offset]);
    }

    /**
     * Trigge ORM queries for all result rows.
     *
     * @param {((string|ORMArgs)[])} [ormArgs]
     * @returns {_NanoSQLQuery}
     *
     * @memberof _NanoSQLQuery
     */
    public orm(ormArgs?: (string | ORMArgs)[]): _NanoSQLQuery {
        return this._addCmd("orm", ormArgs);
    }

    /**
     * Order the results by a given column or columns.
     *
     * Examples:
     *
     * ```ts
     * .orderBy({username:"asc"}) // order by username column, ascending
     * .orderBy({balance:"desc",lastName:"asc"}) // order by balance descending, then lastName ascending.
     * ```
     *
     * @param {Object} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public orderBy(args: { [key: string]: "asc" | "desc" }): _NanoSQLQuery {
        return this._addCmd("orderby", args);
    }

    /**
     * Group By command, typically used with an aggregate function.
     *
     * Example:
     *
     * ```ts
     * NanoSQL("users").query("select",["favoriteColor","count(*)"]).groupBy({"favoriteColor":"asc"}).exec();
     * ```
     *
     * This will provide a list of all favorite colors and how many each of them are in the db.
     *
     * @param {({[key: string]:"asc"|"desc"})} columns
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public groupBy(columns: { [key: string]: "asc" | "desc" }): _NanoSQLQuery {
        return this._addCmd("groupby", columns);
    }

    /**
     * Having statement, used to filter Group BY statements. Syntax is identical to where statements.
     *
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public having(args: Array<any | Array<any>>): _NanoSQLQuery {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Having condition requires an array!";
        }
        return this._addCmd("having", args);
    }

    /**
     * Join command.
     *
     * Example:
     *
     * ```ts
     *  NanoSQL("orders")
     *  .query("select", ["orders.id","orders.title","users.name"])
     *  .where(["orders.status","=","complete"])
     *  .orderBy({"orders.date":"asc"})
     *  .join({
     *      type:"inner",
     *      table:"users",
     *      where:["orders.customerID","=","user.id"]
     *  }).exec();
     *```
     * A few notes on the join command:
     * 1. You muse use dot notation with the table names in all "where", "select", "orderby", and "groupby" arguments.
     * 2. Possible join types are `inner`, `left`, `right`, and `outer`.
     * 3. The "table" argument lets you determine the data on the right side of the join.
     * 4. The "where" argument lets you set what conditions the tables are joined on.
     *
     *
     *
     * @param {JoinArgs} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public join(args: JoinArgs): _NanoSQLQuery {
        if (!args.table || !args.type) {
            this._error = "Join command requires table and type arguments!";
        }
        return this._addCmd("join", args);
    }

    /**
     * Limits the result to a specific amount.  Example:
     *
     * ```ts
     * .limit(20) // Limit to the first 20 results
     * ```
     *
     * @param {number} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public limit(args: number): _NanoSQLQuery {
        return this._addCmd("limit", args);
    }

    /**
     * Perform a trie search on a trie column.
     *
     * @param {string} stringToSearch
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public trieSearch(column: string, stringToSearch: string): _NanoSQLQuery {
        return this._addCmd("trie", [column, stringToSearch]);
    }

    /**
     * If this query results in revision(s) being generated, this will add a comment to those revisions.
     *
     * @param {object} comment
     * @returns {_NanoSQLQuery}
     *
     * @memberof _NanoSQLQuery
     */
    /*public revisionComment(comment: {[key: string]: any}): _NanoSQLQuery {
        return this._addCmd("comment", comment);
    }*/

    /**
     * Offsets the results by a specific amount from the beginning.  Example:
     *
     * ```ts
     * .offset(10) // Skip the first 10 results.
     * ```
     *
     * @param {number} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public offset(args: number): _NanoSQLQuery {
        return this._addCmd("offset", args);
    }

    /**
     * Used to add a command to the query
     *
     * @internal
     * @param {string} type
     * @param {(any)} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    private _addCmd(type: string, args: any): _NanoSQLQuery {
        return this._modifiers.push({ type: type, args: args }), this;
    }


    /**
     * Export the current query to a CSV file, use in place of "exec()";
     *
     * Example:
     * NanoSQL("users").query("select").toCSV(true).then(function(csv, db) {
     *   console.log(csv);
     *   // Returns something like:
     *   id,name,pass,postIDs
     *   1,"scott","1234","[1,2,3,4]"
     *   2,"jeb","5678","[5,6,7,8]"
     * });
     *
     * @param {boolean} [headers]
     * @returns {Promise<string>}
     *
     * @memberOf NanoSQLInstance
     */
    public toCSV(headers?: boolean): Promise<string> {
        let t = this;
        return new Promise((res, rej) => {

            t.exec().then((json: Array<Object>) => {
                json = _assign(json);
                let header = t._action.args.length ? (<Array<any>>t._action.args).map((m) => {
                    return t._db._models[t._table].filter((f) => f["key"] === m)[0];
                }) : t._db._models[t._table];

                if (headers) {
                    json.unshift(header.map((h) => {
                        return h["key"];
                    }));
                }

                res(json.map((row: StdObject<any>, i) => {
                    if (headers && i === 0) return row;
                    return header.map((column) => {
                        if (row[column["key"]] === undefined) {
                            return "";
                        } else {
                            let columnType = column["type"];
                            if (columnType.indexOf("[]") !== -1) columnType = "any[]";
                            switch (columnType) {
                                case "map":
                                case "any[]":
                                // tslint:disable-next-line
                                case "array": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
                                case "string":
                                // tslint:disable-next-line
                                case "safestr": return '"' + row[column["key"]].replace(/"/g, '\"') + '"';
                                default: return row[column["key"]];
                            }
                        }
                    }).join(",");
                }).join("\n"), t);
            });
        });
    }

    public _manualExec(table: string, modifiers: any[]): Promise<Array<Object | NanoSQLInstance>> {
        let t = this;
        t._modifiers = modifiers;
        t._table = table;
        return t.exec();
    }

    /**
     * Executes the current pending query to the db engine, returns a promise with the rows as objects in an array.
     * The second argument of the promise is always the NanoSQL variable, allowing you to chain commands.
     *
     * Example:
     * NanoSQL("users").query("select").exec().then(function(rows, db) {
     *     console.log(rows) // <= [{id:1,username:"Scott",password:"1234"},{id:2,username:"Jeb",password:"1234"}]
     *     return db.query("upsert",{password:"something more secure"}).where(["id","=",1]).exec();
     * }).then(function(rows, db) {
     *  ...
     * })...
     *
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public exec(): Promise<Array<Object | NanoSQLInstance>> {

        let t = this;

        let _t = t._table;
        if (t._db._hasEvents[_t]) {  // Only calcluate events if there are listeners
            t._db._triggerEvents = (() => {
                switch (t._action.type) {
                    case "select": return [t._action.type];
                    case "delete":
                    case "upsert":
                    case "drop": return [t._action.type, "change"];
                    default: return [];
                }
            })();
        }


        return new Promise((res, rej) => {

            if (t._error) {
                rej(t._error);
                throw Error;
            }

            if (!t._db.backend) {
                rej();
                throw Error;
            }

            const _tEvent = (data: Array<Object>, callBack: Function, type: string, changedRows: DBRow[], changedRowPKS: any[], isError: Boolean) => {

                if (t._db._hasEvents[_t]) { // Only trigger events if there are listeners
                    t._db.triggerEvent({
                        name: "error",
                        actionOrView: t._AV,
                        table: _t,
                        query: [t._action].concat(t._modifiers),
                        time: new Date().getTime(),
                        result: data,
                        changeType: type,
                        changedRows: changedRows,
                        changedRowPKS: changedRowPKS
                    }, t._db._triggerEvents);
                }

                callBack(data, t._db);
            };

            let execArgs: DBExec = {
                table: _t,
                transactionID: t._transactionID,
                query: [t._action].concat(t._modifiers),
                viewOrAction: t._AV,
                onSuccess: (rows, type, affectedRows, affectedPKS) => {
                    if (t._transactionID) {
                        res(rows, t._db);
                    } else {
                        _tEvent(rows, res, type, affectedRows, affectedPKS, false);
                    }
                },
                onFail: (err: any) => {
                    if (t._transactionID) {
                        res(err, t._db);
                    } else {
                        t._db._triggerEvents = ["error"];
                        if (rej) _tEvent(err, rej, "error", [], [], true);
                    }
                }
            };

            if (t._db._queryMod) {
                t._db._queryMod(execArgs, (newArgs) => {
                    t._db.backend._exec(newArgs);
                });
            } else {
                t._db.backend._exec(execArgs);
            }
        });
    }
}


// tslint:disable-next-line
export class _NanoSQLORMQuery {

    private _db: NanoSQLInstance;
    private _tableName: string;
    private _action: "add" | "delete" | "drop" | "rebuild" | "set";
    private _column: string;
    private _relationIDs: any[];
    private _whereArgs: any[];
    public _transactionID: number;

    constructor(db: NanoSQLInstance, table: string, action: "add" | "delete" | "drop" | "rebuild" | "set", column?: string, relationIDs?: any[]) {
        this._db = db;
        this._tableName = table;
        this._action = action;
        this._column = column || "";
        this._relationIDs = relationIDs || [];
    }

    public where(args: Array<any | Array<any>>): this {
        this._whereArgs = args;
        return this;
    }

    public rebuild(callBack: (updatedRows: number) => void): void {
        let t = this;

        // Build relationship information for this table's model.
        let relations: {
            key: string;
            tablePK: string;
            table: string;
            type: "single" | "array" | string;
        }[] = t._db._models[t._tableName].filter((m) => {
            return t._db._tableNames.indexOf(m.type.replace("[]", "")) !== -1;
        }).map((m) => {
            let tableName = m.type.replace("[]", "");
            return {
                key: m.key,
                tablePK: t._db._models[tableName].reduce((prev, cur): string => {
                    if (cur.props && cur.props.indexOf("pk") !== -1) return cur.key;
                    return prev;
                }, ""),
                table: tableName,
                type: m.type.indexOf("[]") === -1 ? "single" : "array"
            };
        });

        // Get the primary key of the selected table.
        let tablePK: string = t._db._models[t._tableName].reduce((prev, cur): string => {
            if (cur.props && cur.props.indexOf("pk") !== -1) return cur.key;
            return prev;
        }, "");

        let ptr = 0;
        // One row at a time, one after another.
        const nextRow = () => {
            // Get current ORM Ids
            t._db.table(t._tableName).query("select").range(1, ptr).exec().then((rows) => {

                if (rows.length) {
                    // Loop through all ORM columns
                    Promise.all(relations.map((r) => {
                        return new Promise((res, rej) => {

                            let ids: any;
                            if (rows[0][r.key] === undefined) {
                                ids = r.type === "single" ? "" : [];
                            } else {
                                ids = _assign(rows[0][r.key]);
                            }

                            if (r.type === "single") ids = [ids];

                            ids = ids.filter((v, i, s) => {
                                return s.indexOf(v) === i;
                            });

                            // Query the ids to see if they exist
                            t._db.table(r.table).query("select").where([r.tablePK, "IN", ids]).exec().then((childRows) => {
                                // Build array of rows that still exist
                                let activeIDs: any[] = childRows.length ? childRows.map(row => row[r.tablePK]) : [];
                                // Restore activeIDs and their relationships in the current active row
                                return t._db.table(t._tableName).updateORM("set", r.key, activeIDs).where([tablePK, "=", rows[0][tablePK]]).exec();
                            }).then(() => {
                                res();
                            });
                        });
                    })).then(() => {
                        ptr++;
                        nextRow();
                    });
                } else {
                    callBack(ptr);
                }
            });
        };
        nextRow();
    }

    public tID(transactionID?: number): _NanoSQLORMQuery {
        return this._transactionID = transactionID || 0, this;
    }

    public exec(): Promise<number> {

        let t = this;
        return new Promise((res, rej) => {

            if (t._action === "rebuild") {
                return t.rebuild(res);
            }

            let pk = t._db._models[t._tableName].filter((m) => {
                return m.props && m.props.indexOf("pk") !== -1;
            })[0].key;

            let rowModel = t._db._models[t._tableName].filter(m => m.key === t._column)[0];
            let relationTable = rowModel.type.replace("[]", "");
            let relationPK = t._db._models[relationTable].filter((m) => {
                return m.props && m.props.indexOf("pk") !== -1;
            })[0].key;

            let isArrayRelation = rowModel.type.indexOf("[]") !== -1;

            let mapTo = rowModel.props && rowModel.props.filter(p => p.indexOf("ref=>") !== -1)[0];
            let mapToIsArray = "single";
            if (mapTo) {
                mapTo = mapTo.replace("ref=>", "");
                mapToIsArray = t._db._models[relationTable].filter(m => m.key === mapTo)[0].type.indexOf("[]") === -1 ? "single" : "array";
            }

            if (!pk || !pk.length || !relationPK || !relationPK.length) {
                rej("Relation models require a primary key!");
                return;
            }
            // Get all parent rows to be updated
            let query = t._db.table(t._tableName).query("select");

            if (t._whereArgs) query.where(t._whereArgs);

            query.exec().then((rows: DBRow[]) => {

                let ptr0 = 0;
                const nextRow = () => {
                    if (ptr0 < rows.length) {
                        let rowData = rows[ptr0];

                        let newRow = _assign(rowData);

                        let oldRelations = [];

                        if (newRow[t._column] !== undefined) oldRelations = _assign(newRow[t._column]);
                        if (!Array.isArray(oldRelations)) oldRelations = [oldRelations];

                        // Modify row
                        switch (t._action) {
                            case "set": // Set a relation, destroying old relations
                            case "add": // Add given ids to the relation
                                if (isArrayRelation) {
                                    if (newRow[t._column] === undefined) newRow[t._column] = [];
                                    if (!Array.isArray(newRow[t._column])) newRow[t._column] = [];

                                    if (t._action === "set") {
                                        newRow[t._column] = t._relationIDs;
                                    } else {
                                        newRow[t._column] = newRow[t._column].concat(t._relationIDs);
                                        newRow[t._column] = newRow[t._column].filter((v, i, s) => {
                                            return s.indexOf(v) === i;
                                        });
                                    }
                                } else {
                                    newRow[t._column] = t._relationIDs[0];
                                }

                                break;
                            case "delete": // Remove given Ids from the relation
                                if (isArrayRelation) {
                                    t._relationIDs.forEach((relId) => {
                                        let loc = newRow[t._column].indexOf(relId);
                                        if (loc !== -1) newRow[t._column].splice(loc, 1);
                                    });
                                } else {
                                    newRow[t._column] = "";
                                }
                                break;
                            case "drop": // Drop all relationships for all selected posts at the given column
                                newRow[t._column] = isArrayRelation ? [] : undefined;
                                break;
                        }

                        const updateRow = (newRow: DBRow, callBack: () => void) => {
                            t._db.table(relationTable).query("upsert", newRow, true).exec().then(() => {
                                setFast(callBack);
                            });
                        };

                        const removeOldRelations = (callBack: () => void) => {

                            let ptr = oldRelations.length;
                            const nextRelation = () => {
                                if (ptr < oldRelations.length) {
                                    t._db.table(relationTable).query("select").where([relationPK, "=", oldRelations[ptr]]).exec().then((relateRows: DBRow[]) => {

                                        // Row doesn't actually exist anymore.
                                        if (!relateRows.length) {
                                            ptr++;
                                            nextRelation();
                                            return;
                                        }

                                        let modifyRow = _assign(relateRows[0]);

                                        if (Array.isArray(modifyRow[mapTo])) {
                                            let idx = modifyRow[mapTo].indexOf(rowData[pk]);
                                            if (idx !== -1) {
                                                modifyRow[mapTo].splice(idx, 1);
                                            }
                                        } else {
                                            modifyRow[mapTo] = "";
                                        }
                                        updateRow(modifyRow, () => {
                                            ptr++;
                                            nextRelation();
                                        });
                                    });
                                } else {
                                    callBack();
                                }
                            };
                            nextRelation();

                        };

                        t._db.table(t._tableName).query("upsert", newRow, true).exec().then(() => {
                            if (mapTo) { // Adjust the row data mapped to this one
                                switch (t._action) {
                                    case "set":
                                    case "add":
                                        removeOldRelations(() => {
                                            let ptr = 0;

                                            const nextRelation = () => {
                                                if (ptr < t._relationIDs.length) {
                                                    t._db.table(relationTable).query("select").where([relationPK, "=", t._relationIDs[ptr]]).exec().then((relateRows: DBRow[]) => {

                                                        // Row doesn't actually exist anymore.
                                                        if (!relateRows.length) {
                                                            ptr++;
                                                            nextRelation();
                                                            return;
                                                        }

                                                        let modifyRow = _assign(relateRows[0]);

                                                        if (modifyRow[mapTo] === undefined) modifyRow[mapTo] = mapToIsArray === "array" ? [] : "";

                                                        if (mapToIsArray === "array") {

                                                            if (!Array.isArray(modifyRow[mapTo])) modifyRow[mapTo] = [];

                                                            modifyRow[mapTo].push(rowData[pk]);
                                                            modifyRow[mapTo] = modifyRow[mapTo].filter((v, i, s) => {
                                                                return s.indexOf(v) === i; // removes duplicates
                                                            });

                                                            updateRow(modifyRow, () => {
                                                                ptr++;
                                                                nextRelation();
                                                            });
                                                        } else {
                                                            modifyRow[mapTo] = rowData[pk];
                                                            updateRow(modifyRow, () => {
                                                                ptr++;
                                                                nextRelation();
                                                            });
                                                        }
                                                    });
                                                } else {
                                                    ptr0++;
                                                    nextRow();
                                                }
                                            };
                                            nextRelation();
                                        });
                                        break;
                                    case "delete":
                                    case "drop":
                                        removeOldRelations(() => {
                                            ptr0++;
                                            nextRow();
                                        });
                                        break;
                                }
                            } else {
                                ptr0++;
                                nextRow();
                            }
                        });

                    } else {
                        res(rows.length);
                    }
                };
                nextRow();
            });
        });
    }
}