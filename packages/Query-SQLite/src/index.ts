const parser = require("./parser/alasqlparser.js");
require("./parser/28yy.js").fn(parser.parser.yy);

import { InanoSQLInstance, TableQueryResult, InanoSQLQuery } from "@nano-sql/core/lib/interfaces";
import { hash, buildQuery } from "@nano-sql/core/lib/utilities";
import { uncomment,  } from "./utils";
import { nanoSQL } from "@nano-sql/core";

export interface IastWhere {
    left: { columnid?: string, param?: number, right?: IastWhere };
    op: string;
    right: { columnid?: string, param?: number, right?: IastWhere };
}

export class nSQLite {

    private static _cache: {
        [key: string]: any;
    } = {};

    constructor(
        public parent: InanoSQLInstance
    ) {

    }

    public nSQL(table?: string | any[] | ((where?: any[] | ((row: {
        [key: string]: any;
    }, i?: number | undefined) => boolean) | undefined) => Promise<TableQueryResult>) | undefined): InanoSQLInstance {
        return this.parent.selectTable(table);
    }

    public query(queryStatement: any, args?: any[]): InanoSQLQuery {
        return nSQLite.query(queryStatement, args)(this.parent);
    }

    public static query(queryStatement: any, args?: any[]) {
        return (nSQL: InanoSQLInstance): InanoSQLQuery => {

            const q = buildQuery(nSQL,  "", "");
            const key = hash(queryStatement);
            let queryAST = this._cache[key];
            if (!queryAST) {
                try {
                    queryAST = {
                        cmd: uncomment(queryStatement).split(";").filter(s => s).map(s => {
                            const q = s.trim();
                            if (q.indexOf("SELECT") === 0) return "select";
                            if (q.indexOf("INSERT INTO") === 0) return "upsert";
                            if (q.indexOf("UPDATE") === 0) return "upsert";
                            if (q.indexOf("CREATE TABLE IF NOT EXISTS") === 0) return "create table";
                            if (q.indexOf("CREATE TABLE") === 0) return "create table";
                            if (q.indexOf("DESCRIBE") === 0) return "describe";
                            if (q.indexOf("DROP") === 0) return "drop";
                            if (q.indexOf("ALTER TABLE") === 0) return "alter table";
                            if (q.indexOf("DELETE") === 0) return "delete";
                            return "";
                        }),
                        ast: parser.parse(uncomment(queryStatement)).statements
                    }
                    this._cache[key] = queryAST;
                } catch (e) {
                    throw e;
                }
            }

            if (!queryAST.ast || queryAST.ast.length === 0) {
                return q;
            }

            if (queryAST.ast.length > 1) {
                throw new Error("Can't handle multiple statements in one query!");
            }

            q.action = queryAST.cmd[0];

            const table: { tableid: string, as?: string } = queryAST.ast[0].into || queryAST.ast[0].from[0] || queryAST.ast[0].table;

            // parse Table AS
            q.table = table.tableid;
            q.tableAS = table.as;

            // parse orderBy
            if (queryAST.ast[0].order) {
                let orderBy: any[] = [];
                queryAST.ast[0].order.forEach((order) => {
                    orderBy.push(`${order.expression.columnid} ${order.direction}`);
                })
                q.orderBy = orderBy;
            }

            // parse WHERE
            if (queryAST.ast[0].where && queryAST.ast[0].where.expression) {
                const resolveWhere = (astWhere: IastWhere): any[] => {

                    if (!astWhere.op) {
                        return resolveWhere(astWhere.right as any);
                    }

                    const left = astWhere.left ? astWhere.left.columnid || astWhere.left.param : undefined;
                    const right = astWhere.right ? astWhere.right.columnid || astWhere.right.param : undefined;

                    return [
                        typeof left !== "undefined" ? left : resolveWhere(astWhere.left as any),
                        astWhere.op,
                        typeof right !== "undefined" ? right : resolveWhere(astWhere.right as any)
                    ]
                }
                q.where = resolveWhere(queryAST.ast[0].where.expression);
            }

            switch (q.action) {
                case "select":
                    // parse select columns
                    if (queryAST.ast[0].columns) {
                        let selectAll = false;
                        const recursiveFunc = (s) => {
                            if (s.columnid) {
                                if (s.columnid === "*") {
                                    selectAll = true;
                                    return undefined;
                                }
                                return s.columnid + (s.as ? " AS " + s.as : "");
                            }
                            
                            if (s.left) {
                                if (typeof s.left === "string") {
                                    return s.left + "." + s.right.columnid;
                                } else {
                                    return recursiveFunc(s.left) + "." + s.right;
                                }
                            }
                            return `${s.funcid}(${s.args.map(recursiveFunc).join(", ")})`
                        }
                        q.actionArgs = queryAST.ast[0].columns.map(recursiveFunc).filter(s => s);

                        if (selectAll) {
                            q.actionArgs = q.actionArgs.concat(nSQL._tables[q.tableAS || q.table].columns.map(s => s.key)).filter((v, i, s) => s.indexOf(v) === i);
                        }
                    }
                    break;
                case "upsert":

                    break;
                case "delete":

                    break;
                case "create table":
                case "alter table":

                    break;
            }

            return q;
        }
    }
}
/*

const sqlite = new nSQLite(new nanoSQL());

sqlite.query("SELECT * FROM users WHERE (wings LIKE ?);");
sqlite.query("SELECT * FROM users WHERE wings LIKE ? AND (limbs = ? OR arms > ?);");
sqlite.query("SELECT * FROM users WHERE (limbs = ? OR arms > ?) AND (limbs = ? OR arms > ?);");
sqlite.query("SELECT * FROM users WHERE wings LIKE ?;");
sqlite.query("INSERT INTO users (name, pass, email) VALUES (?, 12, '13');");
sqlite.query(`
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name TEXT,
    pass TEXT,
    email TEXT
)
`);*/

var db = new nanoSQL();

function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var length = 5 + Math.round(Math.random() * 10);
    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

db.selectTable("users").connect({
    id: window["@nano-sql"].core.utilities.uuid(),
    queue: false,
    tables: [{
        name: "users",
        model: {
            "id:int": {
                pk: true,
                ai: true
            },
            "name:any": {},
            "pass:any": {},
            "email:any": {}
        }
    }]
}).then(function () {
    return new Promise((res, rej) => {
        var start = Date.now();
        let i = 0;
        const w = () => {
            if (i < 100) {
                db.query("upsert", {
                    name: makeid(),
                    pass: makeid(),
                    email: makeid()
                }).exec().then(() => {
                    i++;
                    Promise.resolve().then(w);
                });
            } else {
                res();
            }
        }
        w();
    })
}).then(() => {
    return db.query(nSQLite.query("SELECT AVG(name->length), UPPER(email), name, * FROM users ORDER BY name;")).exec();
}).then((rows) => {
    console.log(rows);
})