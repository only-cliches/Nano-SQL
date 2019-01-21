#!/usr/bin/env node

import * as chokadir from "chokidar";
import * as path from "path";
import * as fs from "fs";
import * as chalk from "chalk";
import * as cliArgs from "command-line-args";
import { InanoSQLTableConfig, InanoSQLDataModel } from "./interfaces";
import { DateTime } from "luxon";

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
    {name: "files", alias: "f", type: String, multiple: true},
    {name: "outDir", alias: "o", type: String}
]);

let useOptions: {
    package?: string;
    watch?: boolean;
    watchPolling?: number;
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

const parseModel = (name: string, level: number, model: {[colAndType: string]: InanoSQLDataModel}): string => {
    let file: string = "";
    let tabs: string = "";
    for (let i = 0; i < level; i++) {
        tabs += "\t";
    }
    let hasArr: string = "";
    if (name) {
        hasArr = name.split("[]").filter((v, i) => i > 0).map(v => "[]").join("");
        file += tabs + `${name.split(":")[0]}:{\n`
    }
    let hasStar: string = "";
    Object.keys(model).forEach((m) => {
        const mSplit = m.split(":");
        const nestedModel = model[m].model;
        if (nestedModel) { // nested object
            file += parseModel(m, level + 1, nestedModel);
        } else if (mSplit[0] === "*") {
            hasStar = mSplit[1] === "*" ? "any" : mSplit[1];
        } else { // primitive type
            const arrType = mSplit[1].split("[]").filter((v, i) => i > 0).map(v => "[]").join("")
            switch (mSplit[1].replace(/\[\]/gmi, "")) {
                case "any":
                case "blob":
                    file += tabs + `\t${mSplit[0]}:any${arrType};\n`;
                break;
                case "*":
                    hasStar = "any";
                break;
                case "int":
                case "float":
                case "number":
                    file += tabs + `\t${mSplit[0]}:number${arrType};\n`;
                break;
                case "safestr":
                case "string":
                    file += tabs + `\t${mSplit[0]}:string${arrType};\n`;
                break;
                case "bool":
                case "boolean":
                    file += tabs + `\t${mSplit[0]}:boolean${arrType};\n`;
                break;
                case "array":
                    file += tabs + `\t${mSplit[0]}:any[]${arrType};\n`;
                break;
                case "uuid":
                    file += tabs + `\t${mSplit[0]}:uuid${arrType};\n`;
                break;
                case "timeId":
                    file += tabs + `\t${mSplit[0]}:timeId${arrType};\n`;
                break;
                case "timeIdms":
                    file += tabs + `\t${mSplit[0]}:timeIdms${arrType}\n`;
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
        } = require(file);
        let tsFile = `import { uuid, timeId, timeIdms } from  "@nano-sql/core/lib/interfaces"\n\n`;
        if (mod.tables) {
            mod.tables.forEach((table) => {
                tsFile += `export interface I${table.name}Table {\n`;
                tsFile += parseModel("", 0, table.model as any);
                tsFile += `}`
                tsFile += "\n\n";
            })
        }
        const now = DateTime.local();
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
    const now = DateTime.local();
    console.log(`Running on ${now.toLocaleString(DateTime.DATETIME_FULL)}`);
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
            persist: true,
            usePolling: useOptions.watchPolling ? true : false,
            interval: useOptions.watchPolling,
        });
        watcher.on("change", (ev) => {
            const now = DateTime.local();
            console.log(`Change detected ${now.toLocaleString(DateTime.DATETIME_FULL)}`);
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
