#!/usr/bin/env node

import * as chokadir from "chokidar";
import * as path from "path";
import * as fs from "fs";
import * as chalk from "chalk";
import * as cliArgs from "command-line-args";
import { InanoSQLTableConfig, InanoSQLDataModel } from "./interfaces";
import { titleCase, resolvePath, objectsEqual } from "./utilities";

let packageJSON: any = {};

try {
    packageJSON = fs.readFileSync(path.join(__dirname, "../package.json"), {});
    packageJSON = JSON.parse(packageJSON.toString("utf-8"));
} catch(e) {
    throw new Error(e);
}

console.log(chalk.default.magenta(`nanoSQL v${packageJSON.version} CLI`));

const _cwd = process.cwd();

const options = cliArgs([
    {name: "package", alias: "p", type: String},
    {name: "watch", alias: "w", type: Boolean},
    {name: "watchPolling", alias: "l", type: Number},
    {name: "ignoreCasing", alias: "c", type: Boolean},
    {name: "files", alias: "f", type: String, multiple: true},
    {name: "outDir", alias: "o", type: String}
]);

let useOptions: {
    package?: string;
    watch?: boolean;
    watchPolling?: number;
    ignoreCasing?: boolean;
    files?: string[];
    outDir?: string;
} = options;

if (options.package) {
    try {
        const optionsFile = fs.readFileSync(path.join(_cwd, options.package), {});
        useOptions = {
            ...JSON.parse(optionsFile.toString("utf-8")),
            ...useOptions
        }
    } catch(e) {
        throw new Error(e);
    }
} else {
    try {
        const optionsFile = fs.readFileSync(path.join(_cwd, "nsql.json"), {});
        useOptions = {
            ...JSON.parse(optionsFile.toString("utf-8")),
            ...useOptions
        }
    } catch(e) {
        // silently fail
    }
}

const parseModel = (name: string, level: number, required: boolean, model: {[colAndType: string]: InanoSQLDataModel}): string => {
    let file: string = "";
    let tabs: string = "";
    let hasArr: string = "";
    for (let i = 0; i < level; i++) {
        tabs += "\t";
    }
    let hasStar: string = "";
    if (name) {
        hasArr = name.split("[]").filter((v, i) => i > 0).map(v => "[]").join("");
        file += tabs + `${name.split(":")[0]}${required ? "" : "?"}:{\n`
    }
    Object.keys(model).forEach((m) => {
        const mSplit = m.split(":");
        const modelProps = model[m];
        const nestedModel = model[m].model;
        const optnl = modelProps.notNull || modelProps.pk || typeof modelProps.default !== "undefined" ? "" : "?";
        if (nestedModel) { // nested object
            file += parseModel(m, level + 1, optnl === "", nestedModel);
        } else if (mSplit[0] === "*") {
            hasStar = mSplit[1] === "*" ? "any" : mSplit[1];
        } else { // primitive type
            const arrType = mSplit[1].split("[]").filter((v, i) => i > 0).map(v => "[]").join("");
            switch (mSplit[1].replace(/\[\]/gmi, "")) {
                case "any":
                case "blob":
                    file += tabs + `\t${mSplit[0]}${optnl}:any${arrType};\n`;
                break;
                case "*":
                    hasStar = "any";
                break;
                case "int":
                case "float":
                case "number":
                    file += tabs + `\t${mSplit[0]}${optnl}:number${arrType};\n`;
                break;
                case "safestr":
                case "string":
                    file += tabs + `\t${mSplit[0]}${optnl}:string${arrType};\n`;
                break;
                case "bool":
                case "boolean":
                    file += tabs + `\t${mSplit[0]}${optnl}:boolean${arrType};\n`;
                break;
                case "array":
                    file += tabs + `\t${mSplit[0]}${optnl}:any[]${arrType};\n`;
                break;
                case "uuid":
                    file += tabs + `\t${mSplit[0]}${optnl}:uuid${arrType};\n`;
                break;
                case "timeId":
                    file += tabs + `\t${mSplit[0]}${optnl}:timeId${arrType};\n`;
                break;
                case "timeIdms":
                    file += tabs + `\t${mSplit[0]}${optnl}:timeIdms${arrType}\n`;
                break;
                case "geo":
                    file += tabs + `\t${mSplit[0]}${optnl}:{\n`;
                    file += tabs + `\t\tlat:number;\n`;
                    file += tabs + `\t\tlon:number;\n`;
                    file += tabs + `\t}${arrType}\n`;
                break;
                default: 
                    const type = mSplit[1].replace(/\[\]/gmi, "");
                    file += tabs + `\t${mSplit[0]}${optnl}:Itype${useOptions.ignoreCasing ? type : titleCase(type)}${arrType};\n`;
                break;
            }
        }
    });

    if (hasStar) {
        file += tabs + `\t[key: string]: ${hasStar};\n`;
    }
    
    if (name) {
        file += tabs + `}${hasArr};\n`
    }
    return file;
}

const parseFile = (file: string, idx: number): string => {
    try {
        delete require.cache[file];
        let mod: {
            tables?: InanoSQLTableConfig[];
            types?: {
                [typeName: string]: {
                    onInsert?: (colValue: any) => any,
                    onSelect?: (colValue: any) => any,
                    interfaceText?: string;
                    model?: {
                        [colAndType: string]: InanoSQLDataModel;
                    }
                }
            };
        } = require(file);

        let tsFile = `import { uuid, timeId, timeIdms } from  "@nano-sql/core/lib/interfaces";\n\n`;
        if (mod.tables) {
            mod.tables.forEach((table) => {
                
                if (typeof table.model === "string") {
                    let typeName = table.model.replace(/\[\]/gmi, "");
                    tsFile += `export interface Itable${useOptions.ignoreCasing ? table.name : titleCase(table.name)} extends Itype${useOptions.ignoreCasing ? typeName : titleCase(typeName)} {} \n\n`;
                } else {
                    tsFile += `export interface Itable${useOptions.ignoreCasing ? table.name : titleCase(table.name)} {\n`;
                    tsFile += parseModel("", 0, true, table.model);
                    tsFile += `}`
                    tsFile += "\n\n";
                }

                if (table.queries) {
                    Object.keys(table.queries || {}).forEach((fnName) => {
                        const fn = (table.queries || {})[fnName];
                        if (fn.args) {
                            if (typeof fn.args === "string") {
                                let typeName = fn.args.replace(/\[\]/gmi, "");
                                tsFile += `export interface Itable${useOptions.ignoreCasing ? table.name : titleCase(table.name)}FnArgs${useOptions.ignoreCasing ? fnName : titleCase(fnName)} extends Itype${useOptions.ignoreCasing ? typeName : titleCase(typeName)}  {} \n\n`;
                            } else {
                                tsFile += `export interface Itable${useOptions.ignoreCasing ? table.name : titleCase(table.name)}FnArgs${useOptions.ignoreCasing ? fnName : titleCase(fnName)} {\n`;
                                tsFile += parseModel("", 0, true, fn.args);
                                tsFile += `}`
                                tsFile += "\n\n";
                            }
                        }
                        if (fn.returns) { // manually declared
                            if (typeof fn.returns === "string") {
                                let typeName = fn.returns.replace(/\[\]/gmi, "");
                                tsFile += `export interface Itable${useOptions.ignoreCasing ? table.name : titleCase(table.name)}FnReturns${useOptions.ignoreCasing ? fnName : titleCase(fnName)} extends Itype${useOptions.ignoreCasing ? typeName : titleCase(typeName)}  {} \n\n`;
                            } else {
                                tsFile += `export interface Itable${useOptions.ignoreCasing ? table.name : titleCase(table.name)}FnReturns${useOptions.ignoreCasing ? fnName : titleCase(fnName)} {\n`;
                                tsFile += parseModel("", 0, true, fn.returns);
                                tsFile += `}`
                                tsFile += "\n\n";
                            }
                        } else { // autodetect 

                        }
                    })
                }
            })
        }
        if (mod.types) {
            Object.keys(mod.types).forEach((type) => {
                const typeObj = (mod.types || {})[type];
                if (typeObj.interfaceText) {
                    tsFile += typeObj.interfaceText;
                    tsFile += "\n\n";
                } else if (typeObj.model) {
                    tsFile += `export interface Itype${useOptions.ignoreCasing ? type : titleCase(type)} {\n`;
                    tsFile += parseModel("", 0, true, typeObj.model);
                    tsFile += `}`
                    tsFile += "\n\n";
                }
            })
        }
        console.log(`${idx + 1}. "${(file.split(/\\|\//gmi).pop() || "")}" types rendered.`);
        return tsFile;
    } catch(e) {
        throw new Error(e);
    }
}

if (!useOptions.files || !useOptions.files.length) {
    throw new Error("No files declared, need files with {files: []} or --files file1 file2!");
}

if (!useOptions.outDir) {
    throw new Error("No out directory declared, need it with {outDir: \".\"} or --outDir .!");
}

useOptions.files.forEach((file, i) => {
    console.log(`Running on ${new Date().toLocaleTimeString()}`);
    let newTypeFile = parseFile(path.join(_cwd, file), i);
    const fileName = (file.split(/\\|\//gmi).pop() || "").split(".").shift();
    try {
        fs.writeFileSync(path.join(useOptions.outDir || _cwd, fileName + ".ts"), newTypeFile);
    } catch(e) {
        throw new Error(e);
    }
})

if (useOptions.watch) {
    console.log("\nWatching files...");
    useOptions.files.forEach((file) => {
        const watcher = chokadir.watch(path.join(_cwd, file), {
            usePolling: useOptions.watchPolling ? true : false,
            interval: useOptions.watchPolling,
        });
        watcher.on("change", (ev) => {
            console.log(`Change detected ${new Date().toLocaleTimeString()}`);
            let newTypeFile = parseFile(ev, 0);
            const fileName = (ev.split(/\\|\//gmi).pop() || "").split(".").shift();
            try {
                fs.writeFileSync(path.join(useOptions.outDir || _cwd, fileName + ".ts"), newTypeFile);
            } catch(e) {
                throw new Error(e);
            }
        });
    })
}
