import { TableQueryResult, InanoSQLGraphArgs, InanoSQLJoinArgs, InanoSQLUnionArgs, InanoSQLQuery } from "./interfaces";


export interface InanoSQLQueryAST {
    table: {
        str: string,
        arr: any[],
        prms: (where?: any[] | ((row: {[key: string]: any}, i?: number) => boolean)) => Promise<TableQueryResult>
    }
    action: string;
    args: {
        raw?: any;
        select?: {as?: string, value: (string | InanoSQLFunctionQuery)}[]
    }
    where?: InanoSQLProcessedWhere;
    having?: InanoSQLProcessedWhere;
    range?: [number, number];
    orderBy?: InanoSQLProcessedSort[];
    groupBy?: InanoSQLProcessedSort[];
    distinct?: (InanoSQLFunctionQuery | string)[];
    graph?: InanoSQLGraphArgs[] | undefined;
    join?: InanoSQLJoinArgs[] | undefined;
    updateImmutable?: boolean;
    union?: InanoSQLUnionArgs;
}

export interface InanoSQLFunctionQuery {
    name: string,
    args: (string | InanoSQLFunctionQuery)[]
}

export interface InanoSQLProcessedSort { 
    value: string | InanoSQLFunctionQuery, 
    dir: "asc"|"desc" 
}

export interface InanoSQLProcessedWhere {
    type: "fn"|"arr",
    eval?: (row: {[key: string]: any; }, i?: number) => boolean,
    arr?: InanoSQLWhereQuery
}

export interface InanoSQLWhereQuery {
    ANDOR?: "AND"|"OR",
    STMT?: [string | InanoSQLFunctionQuery, string, any | InanoSQLFunctionQuery],
    NESTED?: InanoSQLWhereQuery[]
}

/**
 * Process nanoSQL query into AST
 *
 * @param {InanoSQLInstance} nSQL
 * @param {InanoSQLQuery} query
 * @returns {InanoSQLQueryAST}
 */
export const _generateAST = (query: InanoSQLQuery): InanoSQLQueryAST => {

    const action = String(query.action).trim().toLowerCase();

    return {
        table: {
            str: typeof query.table === "string" ? query.table : "",
            arr: Array.isArray(query.table) ? query.table : [],
            prms: typeof query.table === "function" ? query.table : () => Promise.resolve({rows: [], filtered: false})
        },
        action: action,
        args: {
            raw: query.actionArgs,
            select: action === "select" && query.actionArgs ? _processSelectArgs(query.actionArgs) : undefined,
        },
        where: _processWhere(query.where),
        having: _processWhere(query.having),
        range: _processOffsetLimit(query.offset || 0, query.limit || 0),
        orderBy: _processSortBy(query.orderBy),
        groupBy: _processSortBy(query.groupBy),
        distinct: query.distinct && Array.isArray(query.distinct) ? query.distinct.map(q => _processFunctionString(q)) : undefined,
        graph: query.graph && !Array.isArray(query.graph) ? [query.graph] : query.graph as InanoSQLGraphArgs[],
        join: query.join && !Array.isArray(query.join) ? [query.join] : query.join as InanoSQLJoinArgs[],
        updateImmutable: query.updateImmutable,
        union: query.union
    };
}

/**
 * Process .orderBy() and .groupBy() arguments from user into AST.
 *
 * @param {(string[] | {[column: string]: string})} [sortArgs]
 * @returns {(undefined | InanoSQLProcessedSort[])}
 */
export const _processSortBy = (sortArgs?: string[] | {[column: string]: string}): undefined | InanoSQLProcessedSort[] => {
    if (!sortArgs) return undefined;

    if (Array.isArray(sortArgs)) { // parse V2 format
        return sortArgs.map((v) => {
            const splitValue = v.split(" ").map(s => s.trim());
            return _processSingleSortBy(splitValue[0], splitValue[1]);
        })
    } else { // parse V1 format
        return Object.keys(sortArgs).map((col) => {
            const dir = sortArgs[col];
            return _processSingleSortBy(col, dir);
        })
    }
}

/**
 * Process single orderBy or groupBy objects into AST.
 *
 * @param {string} column
 * @param {string} [direction]
 * @returns {InanoSQLProcessedSort}
 */
export const _processSingleSortBy = (column: string, direction?: string): InanoSQLProcessedSort => {

    const dir = String(direction || "").trim().toLowerCase() || "asc";

    return {
        dir: dir !== "asc" && dir !== "desc" ? "asc" : dir,
        value: _processFunctionString(column)
    }
}

/**
 * Converts SELECT arguments into an AST.
 *
 * @param {(string[] | undefined)} args
 * @returns
 */
export const _processSelectArgs = (args: string[] | undefined) => {
    // prevent undefined behavior
    if (!args || !Array.isArray(args)) return undefined;

    return args.map(v => {
        const splitVal = String(v).split(/\s+as\s+/gmi).map(s => s.trim());
        return {
            value: _processFunctionString(splitVal[0]),
            as: splitVal[1],
        }
    });
}

/**
 * Process .offset() and .limit() queries from user into tuple.
 *
 * @param {number} offset
 * @param {number} limit
 * @returns {(undefined | [number, number])}
 */
export const _processOffsetLimit = (offset: number, limit: number): undefined | [number, number] => {
    // prevent undefined behavior
    if (typeof offset !== "number" || typeof limit !== "number") return undefined;

    // no offset/limit
    if (offset + limit === 0) return undefined;

    return [offset, offset + limit];
}

/**
 * Convert a string that might contain a nested function call into an AST, or leave it as a string if it doesn't.
 *
 * @param {string} functionString
 * @returns {(string | InanoSQLFunctionQuery)}
 */
export const _processFunctionString = (functionString: string): string | InanoSQLFunctionQuery => {

    // prevent undefined behavior
    if (typeof functionString !== "string") return "";

    
    const start = functionString.indexOf("(")

    // no functions in this string
    if (start === -1) return functionString;

    const end = functionString.lastIndexOf(")");

    if (end === -1) {
        throw new Error(functionString + " has no closing parentheses!");
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
        prev.push(_processFunctionString(fnArg));
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
 * @param {any[]} whereStatement
 * @returns {InanoSQLWhereQuery}
 */
export const _processArrayWhere = (whereStatement: any[]): InanoSQLWhereQuery => {

    // prevent undefined behavior
    if (Array.isArray(whereStatement) !== true) {
        throw new Error("Attempted to pass non array value into where array processing!");
    }

    if (typeof whereStatement[0] === "string") { // bottom of nested structure
        return {
            STMT: [
                _processFunctionString(whereStatement[0]), // maybe function or string
                whereStatement[1], // should be string of LIKE, =, !=, etc
                typeof whereStatement[2] === "string" ? _processFunctionString(whereStatement[2]) : whereStatement[2] // could be string, function string or anything else
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
                return _processArrayWhere(where);
            })
        }
    }
}

/**
 * Convert user provided .where() arguments into an AST
 *
 * @param {(any[] | ((row: {[key: string]: any; }, i?: number) => boolean) | undefined)} whereStatement
 * @returns {(undefined | InanoSQLProcessedWhere)}
 */
export const _processWhere = (whereStatement: any[] | ((row: {[key: string]: any; }, i?: number) => boolean) | undefined): undefined | InanoSQLProcessedWhere => {
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
        arr: _processArrayWhere(whereStatement)
    }
}