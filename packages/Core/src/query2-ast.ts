import {
    TableQueryResult,
    InanoSQLGraphArgs,
    InanoSQLJoinArgs,
    InanoSQLQueryAST,
    InanoSQLProcessedSort,
    InanoSQLUnionArgs,
    InanoSQLFunctionQuery,
    InanoSQLWhereQuery,
    InanoSQLProcessedWhere,
    InanoSQLQuery,
    InanoSQLQuery2,
    InanoSQLInstance
} from "./interfaces";
import { isFunction, isObject } from "./utilities";




export class QueryAST {

    /**
     * Generate query into AST
     *
     * @static
     * @param {InanoSQLQuery} query
     * @returns {InanoSQLQueryAST}
     * @memberof QueryAST
     */
    static generate(nSQL: InanoSQLInstance, query: InanoSQLQuery2): InanoSQLQueryAST {
    
        const action = String(query.action).trim().toLowerCase();

        return {
            table: {
                str: typeof query.table === "string" ? query.table : undefined,
                arr: Array.isArray(query.table) ? query.table : undefined,
                prms:  isFunction(query.table) ? (query.table as any) : undefined,
                db: isObject(query.table) && (query.table as any).query ? (query.table as any) : undefined
            },
            db: query.databaseID ? nSQL.getDB(query.databaseID) : (Object.keys(nSQL.dbs).length ? nSQL.dbs[Object.keys(nSQL.dbs)[0]] : undefined),
            action: action,
            args: {
                raw: query.actionArgs,
                select: action === "select" && query.actionArgs ? QueryAST.select(query.actionArgs) : undefined,
            },
            where: QueryAST.where(query.where),
            originalWhere: query.where as any[],
            having: QueryAST.where(query.having),
            originalHaving: query.having as any[],
            range: QueryAST.offsetLimit(query.offset || 0, query.limit || 0),
            orderBy: QueryAST.sortBy(query.orderBy),
            groupBy: QueryAST.sortBy(query.groupBy),
            distinct: query.distinct && Array.isArray(query.distinct) ? query.distinct.map(q => QueryAST.functionString(q)) : undefined,
            graph: query.graph && !Array.isArray(query.graph) ? [query.graph] : query.graph as InanoSQLGraphArgs[],
            join: query.join && !Array.isArray(query.join) ? [query.join] : query.join as InanoSQLJoinArgs[],
            updateImmutable: query.updateImmutable,
            union: query.union
        };
    }

    /**
     * Process .orderBy() and .groupBy() arguments from user into AST.
     *
     * @static
     * @param {(string[] | {[column: string]: string})} [sortArgs]
     * @returns {(undefined | InanoSQLProcessedSort[])}
     * @memberof QueryAST
     */
    static sortBy(sortArgs?: string[] | {[column: string]: string}): undefined | InanoSQLProcessedSort[] {
        if (!sortArgs) return undefined;
    
        if (Array.isArray(sortArgs)) { // parse V2 format
            return sortArgs.map((v) => {
                const splitValue = v.split(" ").map(s => s.trim());
                return QueryAST.singleSortBy(splitValue[0], splitValue[1]);
            })
        } else { // parse V1 format
            return Object.keys(sortArgs).map((col) => {
                const dir = sortArgs[col];
                return QueryAST.singleSortBy(col, dir);
            })
        }
    }

    /**
     * Process single orderBy or groupBy objects into AST.
     *
     * @static
     * @param {string} column
     * @param {string} [direction]
     * @returns {InanoSQLProcessedSort}
     * @memberof QueryAST
     */
    static singleSortBy(column: string, direction?: string): InanoSQLProcessedSort {

        const dir = String(direction || "").trim().toLowerCase() || "asc";
    
        return {
            dir: dir !== "asc" && dir !== "desc" ? "asc" : dir,
            value: QueryAST.functionString(column)
        }
    }

    /**
     * Converts SELECT arguments into an AST.
     *
     * @static
     * @param {(string[] | undefined)} args
     * @returns
     * @memberof QueryAST
     */
    static select(args: string[] | undefined) {
        // prevent undefined behavior
        if (!args || !Array.isArray(args)) return undefined;
    
        return args.map(v => {
            const splitVal = String(v).split(/\s+as\s+/gmi).map(s => s.trim());
            return {
                value: QueryAST.functionString(splitVal[0]),
                as: splitVal[1],
            }
        });
    }

    /**
     * Turn offset/limit into range object
     *
     * @static
     * @param {number} offset
     * @param {number} limit
     * @returns {(undefined | [number, number])}
     * @memberof QueryAST
     */
    static offsetLimit(offset: number, limit: number): undefined | [number, number] {
        // prevent undefined behavior
        if (typeof offset !== "number" || typeof limit !== "number") return undefined;
    
        // no offset/limit
        if (offset + limit === 0) return undefined;
    
        return [offset, offset + limit];
    }

    /**
     * Convert a string that might contain a nested function call into an AST, or leave it as a string if it doesn't.
     *
     * @static
     * @param {string} functionString
     * @returns {(string | InanoSQLFunctionQuery)}
     * @memberof QueryAST
     */
    static functionString(functionString: string): string | InanoSQLFunctionQuery {

        // prevent undefined behavior
        if (typeof functionString !== "string") return "";

        const end = functionString.lastIndexOf(")");
    
        
        const start = functionString.indexOf("(")
    
        // no functions in this string
        if (start === -1 && end === -1) return functionString;
        
        // parentheses don't having matching pairs
        if (start === -1 || end === -1) {
            throw new Error(functionString + " has no matching parentheses!");
        }
    
        const functionName = functionString.slice(0, start).toLowerCase();
        const functionArgs = functionString.slice(start + 1, end);
    
        // find all the commas that are not inside nested function calls
        let splitCommas: number[] = [-1];
        let isNestedFunction = 0;
        let i = 0;
        while(i < functionArgs.length) {
            const char = functionArgs[i];
            if (char === "(") {
                isNestedFunction++;
            } else if (char === ")") {
                isNestedFunction--;
            } else if (char === "," && isNestedFunction === 0) {
                splitCommas.push(i);
            }
            i++;
        }
        splitCommas.push(functionArgs.length);
    
        if (isNestedFunction !== 0) {
            throw new Error(functionString + " has incorrect nesting of functions!");
        }
    
        const processedArgs = splitCommas.length > 2 ? splitCommas.reduce((prev: (string|InanoSQLFunctionQuery)[], cur: number, i: number) => {
            if (splitCommas[i + 1] === undefined) return prev;
    
            const section: [number, number] = [splitCommas[i] + 1, splitCommas[i + 1]];
            const fnArg = functionArgs.slice(...section).trim();
            prev.push(QueryAST.functionString(fnArg));
            return prev;
        }, []) : [functionArgs.replace(/\,/gmi, "").trim()];
    
        return {
            name: functionName,
            args: processedArgs
        }
    }

    /**
     * Convert nested .where() arrays into AST
     *
     * @static
     * @param {any[]} whereStatement
     * @returns {InanoSQLWhereQuery}
     * @memberof QueryAST
     */
    static arrayWhere(whereStatement: any[]): InanoSQLWhereQuery {

        // prevent undefined behavior
        if (Array.isArray(whereStatement) !== true) {
            throw new Error("Attempted to pass non array value into where array processing!");
        }
    
        if (typeof whereStatement[0] === "string") { // bottom of nested structure
            return {
                STMT: [
                    QueryAST.functionString(whereStatement[0]), // maybe function or string
                    whereStatement[1], // should be string of LIKE, =, !=, etc
                    typeof whereStatement[2] === "string" ? QueryAST.functionString(whereStatement[2]) : whereStatement[2] // could be string, function string or anything else
                ]
            }
        } else {
            return {
                NESTED: whereStatement.map((where, i) => {
                    if (i % 2 === 1) {
                        const ANDOR = String(where).trim().toUpperCase() as "OR"|"AND";
                        if (ANDOR !== "AND" && ANDOR !== "OR") {
                            throw new Error("Malformed WHERE statement:" + JSON.stringify(whereStatement))
                        }
                        return {ANDOR: ANDOR};
                    }
                    return QueryAST.arrayWhere(where);
                })
            }
        }
    }

    /**
     * Convert user provided .where() arguments into an AST
     *
     * @static
     * @param {(any[] | ((row: {[key: string]: any; }, i?: number) => boolean) | undefined)} whereStatement
     * @returns {(undefined | InanoSQLProcessedWhere)}
     * @memberof QueryAST
     */
    static where(whereStatement: any[] | ((row: {[key: string]: any; }, i?: number) => boolean) | undefined): undefined | InanoSQLProcessedWhere {
        // no where statement
        if (typeof whereStatement === "undefined") {
            return undefined;
        }
    
        // where statement is js function
        if (typeof whereStatement === "function") {
            return {
                type: "fn",
                eval: whereStatement
            }
        }
    
        // where statement is array or array of arrays
        return {
            type: "arr",
            arr: QueryAST.arrayWhere(whereStatement)
        }
    }

}